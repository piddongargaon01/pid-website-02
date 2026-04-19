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

    const snap = await db.collection("scheduled_notifications")
      .where("sent", "!=", true)
      .get();

    for (const docSnap of snap.docs) {
      const n = { id: docSnap.id, ...docSnap.data() };

      const dateStr = n.date || n.scheduledDate;
      const timeStr = n.time || n.scheduledTime || "00:00";
      if (!dateStr) { results.skipped.push(n.id); continue; }

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
          title: getTitleByType(n.notifType || n.type),
          body: n.message,
          sound: "default",
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

async function getTargetTokens(db, n) {
  const target = n.target || "all";
  let tokens = [];

  if (target === "teachers_all") {
    const snap = await db.collection("teachers").where("expoPushToken", "!=", null).get();
    snap.docs.forEach(d => { if (d.data().expoPushToken) tokens.push(d.data().expoPushToken); });
    return tokens;
  }

  const studentsSnap = await db.collection("students").where("status", "==", "active").get();
  studentsSnap.docs.forEach(d => {
    const st = d.data();
    if (target !== "all" && target !== "students" && target !== "parents") {
      if (!matchesBatch(st, target)) return;
    }
    if (st.expoPushToken) tokens.push(st.expoPushToken);
  });

  return tokens;
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