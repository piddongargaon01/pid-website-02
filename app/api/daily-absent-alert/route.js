import { admin, adminDb } from "../../../lib/firebase-admin";

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const cronSecret = process.env.CRON_SECRET || "pid_cron_2026";
    if (searchParams.get("secret") !== cronSecret) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Use IST date (UTC+5:30)
    const istNow = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" }));
    const today = istNow.toLocaleDateString("en-CA"); // YYYY-MM-DD in IST
    const dayOfWeek = istNow.getDay();

    // Skip Sunday
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

    // 2. Get today's 'in' attendance (IST date)
    const attSnap = await adminDb.collection("attendance")
      .where("date", "==", today)
      .where("type", "==", "in")
      .get();
    const presentIds = new Set(attSnap.docs.map(d => d.data().studentId));

    // 3. Get today's approved leaves
    const leavesSnap = await adminDb.collection("leave_applications")
      .where("date", "==", today)
      .where("status", "==", "approved")
      .get();
    const onLeaveIds = new Set(leavesSnap.docs.map(d => d.data().studentId));

    // 4. Check holidays for today
    const holidaySnap = await adminDb.collection("holidays")
      .where("date", "==", today)
      .get();
    if (!holidaySnap.empty) {
      return Response.json({ message: "Holiday today — skipping absence check", date: today });
    }

    const nativeFcmMessages = [];
    const expoPushMessages = [];
    let sentCount = 0;

    for (const studentDoc of studentsSnap.docs) {
      const student = studentDoc.data();
      const studentId = studentDoc.id;

      if (presentIds.has(studentId) || onLeaveIds.has(studentId)) continue;

      // Batch validity check
      if (student.batchStartDate && today < student.batchStartDate) continue;
      if (student.batchEndDate && today > student.batchEndDate) continue;

      const studentName = student.studentName || "Aapka Bachcha";
      const genderRaw = (student.gender || "").toLowerCase().trim();
      const isFemale = ["female", "girl", "f", "ladki"].includes(genderRaw);

      const actionWord = isFemale ? "nahi aayi" : "nahi aaya";
      const apka = isFemale ? "Aapki" : "Aapka";
      const bacha = isFemale ? "bachi" : "bachcha";

      const title = `⚠️ ${studentName} Aaj Absent!`;
      const body = `${apka} ${bacha} ${studentName} aaj coaching ${actionWord}. Please confirm karein.`;
      const data = { type: "absent", studentId, date: today };

      // Save to scheduled_notifications with studentId for parent app history
      await adminDb.collection("scheduled_notifications").add({
        title,
        message: body,
        notifType: "absent",
        date: today,
        time: "19:00",
        studentId: studentId,
        studentName: studentName,
        target: "parents",
        sent: true,
        isAutomatic: true,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      // Prepare push tokens
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

    // Batch send Native FCM
    if (nativeFcmMessages.length > 0) {
      for (let i = 0; i < nativeFcmMessages.length; i += 500) {
        await admin.messaging().sendEach(nativeFcmMessages.slice(i, i + 500));
      }
    }

    // Batch send Expo
    if (expoPushMessages.length > 0) {
      for (let i = 0; i < expoPushMessages.length; i += 100) {
        await fetch("https://exp.host/--/api/v2/push/send", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(expoPushMessages.slice(i, i + 100)),
        });
      }
    }

    return Response.json({ success: true, processed: sentCount, date: today, istTime: istNow.toTimeString() });
  } catch (e) {
    console.error("Daily Absent Error:", e.message);
    return Response.json({ error: e.message }, { status: 500 });
  }
}
