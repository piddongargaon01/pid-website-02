import { admin, adminDb } from "../../../lib/firebase-admin";

export async function GET(request) {
  try {
    // Secret check
    const { searchParams } = new URL(request.url);
    const cronSecret = process.env.CRON_SECRET || "pid_cron_2026";
    if (searchParams.get("secret") !== cronSecret) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const today = new Date().toISOString().split("T")[0];
    const dayOfWeek = new Date().getDay();

    // Sunday skip
    if (dayOfWeek === 0) {
      return Response.json({ message: "Sunday — skipping absence check" });
    }

    if (!adminDb) {
      return Response.json({ error: "Database not initialized" }, { status: 500 });
    }

    // 1. Get all active students
    const studentsSnap = await adminDb.collection("students")
      .where("status", "==", "active")
      .get();

    // 2. Get today's 'in' attendance
    const attSnap = await adminDb.collection("attendance")
      .where("date", "==", today)
      .where("type", "==", "in")
      .get();
    const presentIds = new Set(attSnap.docs.map(d => d.data().studentId));

    // 3. Get today's approved leave applications
    const leavesSnap = await adminDb.collection("leave_applications")
      .where("date", "==", today)
      .where("status", "==", "approved")
      .get();
    const onLeaveIds = new Set(leavesSnap.docs.map(d => d.data().studentId));

    const nativeFcmMessages = [];
    const expoPushMessages = [];
    let sentCount = 0;

    for (const studentDoc of studentsSnap.docs) {
      const student = studentDoc.data();
      const studentId = studentDoc.id;

      // Skip if present or on leave
      if (presentIds.has(studentId) || onLeaveIds.has(studentId)) continue;

      // Batch validity check
      if (student.batchStartDate && today < student.batchStartDate) continue;
      if (student.batchEndDate && today > student.batchEndDate) continue;

      const studentName = student.studentName || "Bachcha";
      const title = `⚠️ ${studentName} Absent!`;
      const body = `Aaj ${studentName} coaching nahi aaya/aayi. Please confirm karein.`;
      const data = { type: "absent", studentId, date: today };

      // ─── Save to History (scheduled_notifications) ───
      await adminDb.collection("scheduled_notifications").add({
        message: body,
        title: title,
        notifType: "urgent",
        date: today,
        time: "19:00",
        studentId: studentId, // For private filtering
        target: "parents",
        sent: true,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      // ─── Prepare Push ───
      const tokens = [];
      if (student.parentNativeFcmToken) tokens.push(student.parentNativeFcmToken);
      if (student.parentNativeToken) tokens.push(student.parentNativeToken);
      if (student.parentPushToken) tokens.push(student.parentPushToken);

      const uniqueTokens = [...new Set(tokens)];
      uniqueTokens.forEach(token => {
        if (!token.startsWith("ExponentPushToken")) {
          nativeFcmMessages.push({
            token,
            notification: { title, body },
            android: { priority: "high", notification: { channelId: "pid_alerts", sound: "default" } },
            data,
          });
        } else {
          expoPushMessages.push({
            to: token, title, body, sound: "default", priority: "high", channelId: "pid_alerts", data,
          });
        }
      });
      sentCount++;
    }

    // ─── Batch Send Native FCM ───
    if (nativeFcmMessages.length > 0) {
      for (let i = 0; i < nativeFcmMessages.length; i += 500) {
        await admin.messaging().sendEach(nativeFcmMessages.slice(i, i + 500));
      }
    }

    // ─── Batch Send Expo ───
    if (expoPushMessages.length > 0) {
      for (let i = 0; i < expoPushMessages.length; i += 100) {
        await fetch("https://exp.host/--/api/v2/push/send", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(expoPushMessages.slice(i, i + 100)),
        });
      }
    }

    return Response.json({ success: true, processed: sentCount, date: today });
  } catch (e) {
    console.error("Daily Absent Error:", e.message);
    return Response.json({ error: e.message }, { status: 500 });
  }
}