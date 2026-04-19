import { adminDb } from "../../lib/firebase-admin";

export async function GET(request) {
  try {
    // Secret check
    const { searchParams } = new URL(request.url);
    if (searchParams.get("secret") !== "pid_cron_2026") {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const today = new Date().toISOString().split("T")[0];
    const dayOfWeek = new Date().getDay();

    // Sunday skip
    if (dayOfWeek === 0) {
      return Response.json({ message: "Sunday — skip" });
    }

    // Active students lo
    const studentsSnap = await adminDb.collection("students")
      .where("status", "==", "active")
      .get();

    // Aaj ki attendance lo
    const attSnap = await adminDb.collection("attendance")
      .where("date", "==", today)
      .where("type", "==", "in")
      .get();

    const presentIds = new Set(attSnap.docs.map(d => d.data().studentId));

    const notifications = [];

    for (const studentDoc of studentsSnap.docs) {
      const student = studentDoc.data();

      // Batch validity check
      if (student.batchStartDate && today < student.batchStartDate) continue;
      if (student.batchEndDate && today > student.batchEndDate) continue;

      const token = student.parentPushToken;
      if (!token) continue;

      // Absent hai?
      if (!presentIds.has(studentDoc.id)) {
        notifications.push({
          to: token,
          sound: "default",
          title: `⚠️ ${student.studentName} Absent!`,
          body: `Aaj ${student.studentName} coaching nahi aaya/aayi. Please confirm karo.`,
          data: { type: "absent", studentId: studentDoc.id, date: today },
          priority: "high",
          channelId: "default",
        });
      }
    }

    if (notifications.length === 0) {
      return Response.json({ message: "Koi absent nahi", sent: 0 });
    }

    const response = await fetch("https://exp.host/--/api/v2/push/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(notifications),
    });

    const result = await response.json();
    return Response.json({ success: true, sent: notifications.length, result });
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}