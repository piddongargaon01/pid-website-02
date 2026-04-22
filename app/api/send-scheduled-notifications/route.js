import { NextResponse } from "next/server";
import { admin, adminDb } from "../../../lib/firebase-admin";

function getAdminDb() {
  return adminDb;
}

export async function GET(req) {
  const authHeader = req.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET || "pid_cron_2026";
  if (authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();
  const results = { sent: [], skipped: [], errors: [] };

  try {
    const db = getAdminDb();
    if (!db) {
      return NextResponse.json({ error: "Firebase not initialized" }, { status: 500 });
    }

    // 1. Process Scheduled Notifications (Admin)
    const scheduledSnap = await db.collection("scheduled_notifications")
      .where("sent", "!=", true)
      .get();

    // 2. Process Teacher Notifications
    const teacherSnap = await db.collection("notifications")
      .where("sent", "!=", true)
      .get();

    const allNotifs = [
      ...scheduledSnap.docs.map(d => ({ doc: d, data: { id: d.id, ...d.data() }, type: "scheduled" })),
      ...teacherSnap.docs.map(d => ({ doc: d, data: { id: d.id, ...d.data() }, type: "teacher" }))
    ];

    for (const item of allNotifs) {
      const n = item.data;
      const docSnap = item.doc;

      // For teacher notifications, they are usually sent immediately or by today's date
      const dateStr = n.date || n.scheduledDate || n.createdAt?.toDate?.()?.toISOString()?.split("T")?.[0] || new Date().toISOString().split("T")[0];
      const timeStr = n.time || n.scheduledTime || "00:00";

      const scheduledAt = new Date(`${dateStr}T${timeStr}:00`);
      if (now < scheduledAt) { results.skipped.push(n.id); continue; }

      let tokenData = { expo: [], native: [] };
      try {
        try {
          tokenData = await getTargetTokens(db, n);
        } catch (e) {
        results.errors.push({ id: n.id, error: "Token fetch failed: " + e.message });
        continue;
      }

      if (tokenData.expo.length === 0 && tokenData.native.length === 0) {
        await docSnap.ref.update({ sent: true, sentAt: new Date().toISOString(), sentCount: 0 });
        results.skipped.push(n.id + " (no tokens)");
        continue;
      }

      const title = n.title || getTitleByType(n.notifType || n.type);
      const body = n.message || "";

      // ─── Path 1: Native FCM (Direct) ───
      if (tokenData.native.length > 0) {
        try {
          const fcmMessages = tokenData.native.map(token => ({
            token: token,
            notification: { title, body },
            android: {
              priority: "high",
              notification: { channelId: "pid_alerts", sound: "default" }
            },
            data: { 
              type: n.notifType || n.type || "general", 
              notifId: n.id,
              click_action: "FLUTTER_NOTIFICATION_CLICK" // for some legacy android handlers
            }
          }));

          // Send in batches of 500 (Firebase limit)
          for (let i = 0; i < fcmMessages.length; i += 500) {
            await admin.messaging().sendEach(fcmMessages.slice(i, i + 500));
          }
        } catch (fcmErr) {
          console.error("FCM Direct failed:", fcmErr.message);
        }
      }

      // ─── Path 2: Expo Push (Fallback) ───
      if (tokenData.expo.length > 0) {
        try {
          const expoPushUrl = "https://exp.host/--/api/v2/push/send";
          const expoMessages = tokenData.expo.map(token => ({
            to: token,
            title, body,
            sound: "default",
            priority: "high",
            channelId: "pid_alerts",
            _contentAvailable: true,
            data: { type: n.notifType || n.type || "general", notifId: n.id, displayMode: "popup" },
          }));

          for (let i = 0; i < expoMessages.length; i += 100) {
            await fetch(expoPushUrl, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(expoMessages.slice(i, i + 100)),
            });
          }
        } catch (expoErr) {
          console.error("Expo Fallback failed:", expoErr.message);
        }
      }

      await docSnap.ref.update({
        sent: true,
        sentAt: new Date().toISOString(),
        sentCount: tokenData.native.length + tokenData.expo.length,
      });

      results.sent.push({ id: n.id, tokens: tokenData.native.length + tokenData.expo.length, source: item.type });
    } catch (e) {
      results.errors.push({ id: n.id, error: "Processing failed: " + e.message });
    }
  }

    return NextResponse.json({ success: true, results, checkedAt: now.toISOString() });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
export async function POST(req) {
  try {
    const { notifId, secret } = await req.json();
    const cronSecret = process.env.CRON_SECRET || "pid_cron_2026";
    if (secret !== cronSecret) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const db = getAdminDb();
    // Try both collections
    let docRef = db.collection("scheduled_notifications").doc(notifId);
    let docSnap = await docRef.get();
    
    if (!docSnap.exists) {
      docRef = db.collection("notifications").doc(notifId);
      docSnap = await docRef.get();
    }

    if (!docSnap.exists) return NextResponse.json({ error: "Notification not found" }, { status: 404 });

    const n = { id: docSnap.id, ...docSnap.data() };
    const isFeePersonalized = n.isFeePersonalized || reqData.isFeePersonalized;
    
    // Get target recipients (with potential personalization)
    const targets = await getTargetRecipients(db, n, isFeePersonalized);

    if (targets.length === 0) {
      return NextResponse.json({ error: "No target recipients found" });
    }

    const baseTitle = n.title || getTitleByType(n.notifType || n.type);
    const baseBody = n.message || "";
    let sentCount = 0;

    // Send individually if personalized, else broadcast
    for (const recipient of targets) {
      const title = baseTitle;
      const body = isFeePersonalized ? baseBody.replace("{amount}", recipient.amount || "0") : (recipient.message || baseBody);
      const tokens = recipient.tokens;

      // ─── Path 1: Native FCM ───
      if (tokens.native.length > 0) {
        try {
          const fcmMessages = tokens.native.map(token => ({
            token,
            notification: { title, body },
            android: { priority: "high", notification: { channelId: "pid_alerts", sound: "default" } },
            data: { type: n.notifType || n.type || "general", notifId: n.id, displayMode: "popup" }
          }));
          for (let i = 0; i < fcmMessages.length; i += 500) {
            await admin.messaging().sendEach(fcmMessages.slice(i, i + 500));
          }
        } catch (e) { console.error("FCM Error:", e); }
      }

      // ─── Path 2: Expo Push ───
      if (tokens.expo.length > 0) {
        try {
          const expoMessages = tokens.expo.map(token => ({
            to: token, title, body, sound: "default", priority: "high", channelId: "pid_alerts",
            _contentAvailable: true, data: { type: n.notifType || n.type || "general", notifId: n.id },
          }));
          for (let i = 0; i < expoMessages.length; i += 100) {
            await fetch("https://exp.host/--/api/v2/push/send", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(expoMessages.slice(i, i + 100)),
            });
          }
        } catch (e) { console.error("Expo Error:", e); }
      }
      sentCount += tokens.native.length + tokens.expo.length;
    }

    await docRef.update({ sent: true, sentAt: new Date().toISOString(), sentCount });
    return NextResponse.json({ success: true, sentCount });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

async function getTargetRecipients(db, n, isFeePersonalized) {
  let targetRaw = n.forClass || n.target || "all";
  const targets = (typeof targetRaw === "string" && targetRaw.includes(",")) ? targetRaw.split(",") : [targetRaw];
  const recipients = [];

  const getTokens = (data) => {
    const native = [];
    const expo = [];
    if (data.parentNativeFcmToken) native.push(data.parentNativeFcmToken);
    if (data.parentNativeToken) native.push(data.parentNativeToken);
    if (data.parentPushToken) expo.push(data.parentPushToken);
    if (data.nativeFcmToken) native.push(data.nativeFcmToken);
    if (data.expoPushToken) expo.push(data.expoPushToken);
    return {
      native: [...new Set(native)],
      expo: [...new Set(expo)]
    };
  };

  // Case 1: Specific Student (Result Notification)
  if (target === "specific" && n.specificStudentId) {
    const doc = await db.collection("students").doc(n.specificStudentId).get();
    if (doc.exists) {
      recipients.push({ tokens: getTokens(doc.data()) });
    }
    return recipients;
  }

  // Case 2: Broadcasters / Batches
  if (target === "teachers_all") {
    const snap = await db.collection("teachers").get();
    snap.docs.forEach(d => {
      const tokens = getTokens(d.data());
      if (tokens.native.length || tokens.expo.length) recipients.push({ tokens });
    });
  } else {
    // Optimized: Fetch all students
    const studentsSnap = await db.collection("students").where("status", "==", "active").get();
    
    // Fetch payments if personalized fee
    let payments = [];
    if (isFeePersonalized) {
      const pSnap = await db.collection("fee_payments").get();
      payments = pSnap.docs.map(d => d.data());
    }

    studentsSnap.docs.forEach(d => {
      const st = d.data();
      st.id = d.id;

      // Class filtering (Supports array of targets)
      if (!targets.includes("all") && !targets.includes("students") && !targets.includes("parents")) {
        const matchesAny = targets.some(t => matchesBatch(st, t));
        if (!matchesAny) return;
      }

      // Fee filtering
      let balance = 0;
      if (isFeePersonalized) {
        const total = Number(st.totalFee || 0);
        const paid = payments
          .filter(p => p.studentId === st.id)
          .reduce((s, p) => s + (Number(p.amount) || 0), 0);
        balance = total - paid;
        if (balance <= 0) return; // Skip if no balance
      }

      const tokens = getTokens(st);
      if (tokens.native.length || tokens.expo.length) {
        recipients.push({ 
          tokens, 
          amount: balance.toString()
        });
      }
    });
  }

  // Group by identical combinations (tokens + amount) to minimize push requests
  if (!isFeePersonalized) {
    const combinedTokens = { native: [], expo: [] };
    recipients.forEach(r => {
      combinedTokens.native.push(...r.tokens.native);
      combinedTokens.expo.push(...r.tokens.expo);
    });
    return [{ tokens: { native: [...new Set(combinedTokens.native)], expo: [...new Set(combinedTokens.expo)] } }];
  }

  return recipients;
}

function matchesBatch(student, batchValue) {
  // 1. Special hardcoded batches
  const specialMap = {
    "2nd-8th-All": ["2nd","3rd","4th","5th","6th","7th","8th"],
    "JEE-NEET": ["9th", "10th", "11th", "12th"],
    "Navodaya": "5th",
    "Prayas": "8th",
  };

  if (specialMap[batchValue]) {
    const targetClass = specialMap[batchValue];
    if (Array.isArray(targetClass)) return targetClass.includes(student.class);
    if (batchValue === "Navodaya") return student.class === "5th" || student.courseId === "navodaya";
    if (batchValue === "Prayas") return student.class === "8th" || student.courseId === "prayas";
    return student.class === targetClass;
  }

  // 2. Dynamic matching by value (e.g., "12th-Eng-CBSE")
  if (batchValue.includes("-")) {
    const [c, m, b] = batchValue.split("-");
    if (student.class !== c) return false;
    if (m && m !== "All" && student.medium !== (m === "Eng" ? "English" : m === "Hin" ? "Hindi" : m)) return false;
    const studentBoard = student.board === "CG Board" ? "CG" : student.board;
    if (b && b !== "All" && studentBoard !== b) return false;
    return true;
  }

  // 3. Fallback to older class map
  const classMap = {
    "12th-Eng-CBSE-ICSE": { class: "12th", medium: "English", boards: ["CBSE","ICSE"] },
    "12th-Hindi-CG-CBSE": { class: "12th", medium: "Hindi", boards: ["CG","CBSE"] },
    "11th-Eng-CBSE-ICSE": { class: "11th", medium: "English", boards: ["CBSE","ICSE"] },
    "11th-Hindi-CG-CBSE": { class: "11th", medium: "Hindi", boards: ["CG","CBSE"] },
    "10th-Eng-All":        { class: "10th", medium: "English", boards: ["CG","CBSE","ICSE"] },
    "10th-Hindi-CG-CBSE": { class: "10th", medium: "Hindi", boards: ["CG","CBSE"] },
    "9th-Eng-All":         { class: "9th",  medium: "English", boards: ["CG","CBSE","ICSE"] },
    "9th-Hindi-CG-CBSE":  { class: "9th",  medium: "Hindi",   boards: ["CG","CBSE"] },
  };
  const batch = classMap[batchValue];
  if (!batch) return true;

  if (student.class !== batch.class) return false;
  if (batch.medium && student.medium !== batch.medium) return false;
  const nb = student.board === "CG Board" ? "CG" : student.board;
  if (batch.boards?.length && !batch.boards.includes(nb)) return false;
  return true;
}

function getTitleByType(type) {
  const titles = {
    holiday: "🏖️ Holiday Notice — PID",
    exam:    "📝 Exam Alert — PID",
    urgent:  "🚨 Urgent — PID",
    fee:     "💰 Fee Reminder — PID",
    general: "🔔 PID Notification",
    test:    "📋 Test Reminder — PID",
    event:   "🎉 Event — PID",
  };
  return titles[type] || "🔔 PID Notification";
}