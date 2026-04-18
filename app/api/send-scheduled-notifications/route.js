import { NextResponse } from "next/server";
import { initializeApp, getApps, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

// Firebase Admin initialize
if (!getApps().length) {
  initializeApp({
    credential: cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY)),
  });
}
const db = getFirestore();

export async function GET(req) {
  // Vercel Cron secret check — unauthorized access band karo
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();
  const results = { sent: [], skipped: [], errors: [] };

  try {
    // Saare pending notifications fetch karo
    const snap = await db.collection("scheduled_notifications")
      .where("sent", "!=", true)
      .get();

    for (const docSnap of snap.docs) {
      const n = { id: docSnap.id, ...docSnap.data() };

      // Date + time combine karo
      const dateStr = n.date || n.scheduledDate;
      const timeStr = n.time || n.scheduledTime || "00:00";
      if (!dateStr) { results.skipped.push(n.id); continue; }

      const scheduledAt = new Date(`${dateStr}T${timeStr}:00`);

      // Time nahi aaya abhi
      if (now < scheduledAt) { results.skipped.push(n.id); continue; }

      // FCM tokens fetch karo — target ke hisaab se
      let tokens = [];
      try {
        tokens = await getTargetTokens(db, n);
      } catch (e) {
        results.errors.push({ id: n.id, error: "Token fetch failed: " + e.message });
        continue;
      }

      if (tokens.length === 0) {
        // Koi token nahi mila — sent mark karo taaki dobara na bheje
        await docSnap.ref.update({ sent: true, sentAt: new Date().toISOString(), sentCount: 0 });
        results.skipped.push(n.id + " (no tokens)");
        continue;
      }

      // Expo Push Notification bhejo
      try {
        const expoPushUrl = "https://exp.host/--/api/v2/push/send";
        const messages = tokens.map(token => ({
          to: token,
          title: getTitleByType(n.notifType || n.type),
          body: n.message,
          sound: "default",
          data: {
            type: n.notifType || n.type || "general",
            notifId: n.id,
          },
        }));

        // Expo 100 messages ek baar mein leta hai — batch karo
        const batches = [];
        for (let i = 0; i < messages.length; i += 100) {
          batches.push(messages.slice(i, i + 100));
        }

        for (const batch of batches) {
          await fetch(expoPushUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(batch),
          });
        }

        // Sent mark karo — dobara na bheje
        await docSnap.ref.update({
          sent: true,
          sentAt: new Date().toISOString(),
          sentCount: tokens.length,
        });

        results.sent.push({ id: n.id, tokens: tokens.length });
      } catch (e) {
        results.errors.push({ id: n.id, error: "Push failed: " + e.message });
      }
    }

    return NextResponse.json({ success: true, results, checkedAt: now.toISOString() });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

// Target ke hisaab se FCM/Expo tokens fetch karo
async function getTargetTokens(db, n) {
  const target = n.target || "all";
  let tokens = [];

  if (target === "teachers_all") {
    // Teachers ke tokens
    const snap = await db.collection("teachers").where("expoPushToken", "!=", null).get();
    snap.docs.forEach(d => { if (d.data().expoPushToken) tokens.push(d.data().expoPushToken); });
    return tokens;
  }

  // Students fetch karo
  let studentsSnap;
  if (target === "all" || target === "students" || target === "parents") {
    studentsSnap = await db.collection("students").where("status", "==", "active").get();
  } else {
    // Specific batch — class filter
    studentsSnap = await db.collection("students")
      .where("status", "==", "active")
      .get();
  }

  studentsSnap.docs.forEach(d => {
    const st = d.data();
    // Batch filter
    if (target !== "all" && target !== "students" && target !== "parents") {
      if (!matchesBatch(st, target)) return;
    }
    if (st.expoPushToken) tokens.push(st.expoPushToken);
  });

  return tokens;
}

// Batch match helper
function matchesBatch(student, batchValue) {
  const classMap = {
    "12th-Eng-CBSE-ICSE": { class: "12th", medium: "English", boards: ["CBSE","ICSE"] },
    "12th-Hindi-CG-CBSE": { class: "12th", medium: "Hindi", boards: ["CG","CBSE"] },
    "12th-Eng-CG": { class: "12th", medium: "English", boards: ["CG"] },
    "11th-Eng-CBSE-ICSE": { class: "11th", medium: "English", boards: ["CBSE","ICSE"] },
    "11th-Hindi-CG-CBSE": { class: "11th", medium: "Hindi", boards: ["CG","CBSE"] },
    "11th-Eng-CG": { class: "11th", medium: "English", boards: ["CG"] },
    "10th-Eng-All": { class: "10th", medium: "English", boards: ["CG","CBSE","ICSE"] },
    "10th-Hindi-CG-CBSE": { class: "10th", medium: "Hindi", boards: ["CG","CBSE"] },
    "9th-Eng-All": { class: "9th", medium: "English", boards: ["CG","CBSE","ICSE"] },
    "9th-Hindi-CG-CBSE": { class: "9th", medium: "Hindi", boards: ["CG","CBSE"] },
  };
  const batch = classMap[batchValue];
  if (!batch) return true;
  if (student.class !== batch.class) return false;
  if (batch.medium && student.medium !== batch.medium) return false;
  const nb = student.board === "CG Board" ? "CG" : student.board;
  if (batch.boards?.length && !batch.boards.includes(nb)) return false;
  return true;
}

// Type ke hisaab se title
function getTitleByType(type) {
  const titles = {
    holiday: "🏖️ Holiday Notice — PID",
    exam: "📝 Exam Alert — PID",
    urgent: "🚨 Urgent — PID",
    fee: "💰 Fee Reminder — PID",
    general: "🔔 PID Notification",
    test: "📋 Test Reminder — PID",
    event: "🎉 Event — PID",
  };
  return titles[type] || "🔔 PID Notification";
}