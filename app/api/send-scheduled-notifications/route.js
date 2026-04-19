import { NextResponse } from "next/server";
import { adminDb } from "../../../lib/firebase-admin";

function getAdminDb() {
  return adminDb;
}

export async function GET(req) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
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

      let tokens = [];
      try {
        tokens = await getTargetTokens(db, n);
      } catch (e) {
        results.errors.push({ id: n.id, error: "Token fetch failed: " + e.message });
        continue;
      }

      if (tokens.length === 0) {
        await docSnap.ref.update({ sent: true, sentAt: new Date().toISOString(), sentCount: 0 });
        results.skipped.push(n.id + " (no tokens)");
        continue;
      }

      try {
        const expoPushUrl = "https://exp.host/--/api/v2/push/send";
        const messages = tokens.map(token => ({
          to: token,
          title: n.title || getTitleByType(n.notifType || n.type),
          body: n.message,
          sound: "default",
          priority: "high",
          channelId: "default",
          ttl: 2419200,
          data: { type: n.notifType || n.type || "general", notifId: n.id },
        }));

        for (let i = 0; i < messages.length; i += 100) {
          await fetch(expoPushUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(messages.slice(i, i + 100)),
          });
        }

        await docSnap.ref.update({
          sent: true,
          sentAt: new Date().toISOString(),
          sentCount: tokens.length,
        });

        results.sent.push({ id: n.id, tokens: tokens.length, source: item.type });
      } catch (e) {
        results.errors.push({ id: n.id, error: "Push failed: " + e.message });
      }
    }

    return NextResponse.json({ success: true, results, checkedAt: now.toISOString() });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

async function getTargetTokens(db, n) {
  const target = n.forClass || n.target || "all";
  let tokens = [];

  if (target === "teachers_all") {
    const snap = await db.collection("teachers").where("expoPushToken", "!=", null).get();
    snap.docs.forEach(d => { if (d.data().expoPushToken) tokens.push(d.data().expoPushToken); });
    return tokens;
  }

  const studentsSnap = await db.collection("students").where("status", "==", "active").get();
  studentsSnap.docs.forEach(d => {
    const st = d.data();
    // Batch filtering
    if (target !== "all" && target !== "students" && target !== "parents") {
      if (!matchesBatch(st, target)) return;
    }

    // Add tokens based on target
    if (target === "students") {
      if (st.expoPushToken) tokens.push(st.expoPushToken);
    } else if (target === "parents") {
      if (st.parentPushToken) tokens.push(st.parentPushToken);
    } else {
      // For "all" or specific batches, send to both student and parent
      if (st.expoPushToken) tokens.push(st.expoPushToken);
      if (st.parentPushToken) tokens.push(st.parentPushToken);
    }
  });

  // Remove duplicates
  return [...new Set(tokens)];
}

function matchesBatch(student, batchValue) {
  const classMap = {
    "12th-Eng-CBSE-ICSE": { class: "12th", medium: "English", boards: ["CBSE","ICSE"] },
    "12th-Hindi-CG-CBSE": { class: "12th", medium: "Hindi", boards: ["CG","CBSE"] },
    "12th-Eng-CG":         { class: "12th", medium: "English", boards: ["CG"] },
    "11th-Eng-CBSE-ICSE": { class: "11th", medium: "English", boards: ["CBSE","ICSE"] },
    "11th-Hindi-CG-CBSE": { class: "11th", medium: "Hindi", boards: ["CG","CBSE"] },
    "11th-Eng-CG":         { class: "11th", medium: "English", boards: ["CG"] },
    "10th-Eng-All":        { class: "10th", medium: "English", boards: ["CG","CBSE","ICSE"] },
    "10th-Hindi-CG-CBSE": { class: "10th", medium: "Hindi", boards: ["CG","CBSE"] },
    "9th-Eng-All":         { class: "9th",  medium: "English", boards: ["CG","CBSE","ICSE"] },
    "9th-Hindi-CG-CBSE":  { class: "9th",  medium: "Hindi",   boards: ["CG","CBSE"] },
    "2nd-8th-All":        { class: "2nd-8th" },
    "JEE-NEET":           { class: "JEE-NEET" },
    "Navodaya":           { class: "Navodaya" },
    "Prayas":             { class: "Prayas" },
  };
  const batch = classMap[batchValue];
  if (!batch) return true;

  // Custom logic for special batches
  if (batchValue === "2nd-8th-All") {
    return ["2nd","3rd","4th","5th","6th","7th","8th"].includes(student.class);
  }
  if (batchValue === "JEE-NEET") {
    return ["9th", "10th", "11th", "12th"].includes(student.class);
  }
  if (batchValue === "Navodaya") {
    return student.class === "5th" || student.courseId === "navodaya";
  }
  if (batchValue === "Prayas") {
     return student.class === "8th" || student.courseId === "prayas";
  }

  // Standard class/medium/board matching
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