import { NextResponse } from "next/server";
import { admin, adminDb as db } from "../../../lib/firebase-admin";

// ═══════════════════════════════════════════
// POST — RFID Device sends attendance data
// ═══════════════════════════════════════════
export async function POST(request) {
  try {
    if (!db) return NextResponse.json({ error: "Database not initialized" }, { status: 500 });

    const body = await request.json();
    const { rfidCode, type, deviceId, secret } = body;

    const apiSecret = process.env.ATTENDANCE_API_SECRET || "pid_rfid_2026";
    if (secret !== apiSecret) return NextResponse.json({ error: "Invalid secret" }, { status: 401 });

    const rfidUpper = rfidCode ? rfidCode.toString().toUpperCase().replace(/\s+/g, "").trim() : "";
    if (!rfidUpper || !type) return NextResponse.json({ error: "rfidCode and type required" }, { status: 400 });

    const studentSnap = await db.collection("students").where("rfidCode", "==", rfidUpper).limit(1).get();

    let studentData = null;
    let studentId = null;
    let isTeacher = false;

    if (!studentSnap.empty) {
      studentId = studentSnap.docs[0].id;
      studentData = studentSnap.docs[0].data();
    }

    // If not found in students, check teachers collection
    if (!studentData) {
      const teacherSnap = await db.collection("teachers").where("rfidCode", "==", rfidUpper).limit(1).get();
      if (!teacherSnap.empty) {
        studentId = "teacher_" + teacherSnap.docs[0].id;
        studentData = teacherSnap.docs[0].data();
        isTeacher = true;
      }
    }

    let batchValid = true;
    let batchExpired = false;
    if (studentData && !isTeacher) {
      const today = new Date().toISOString().split("T")[0];
      const startDate = studentData.batchStartDate || "";
      const endDate = studentData.batchEndDate || "";
      if (startDate && today < startDate) batchValid = false;
      if (endDate && today > endDate) { batchValid = false; batchExpired = true; }
    }

    const record = {
      rfidCode: rfidUpper,
      type: type,
      studentId: studentId,
      studentName: isTeacher ? (studentData?.name || "Unknown Teacher") : (studentData?.name || studentData?.studentName || "Unknown"),
      studentClass: isTeacher ? "Teacher" : (studentData?.class || studentData?.presentClass || "N/A"),
      studentPhoto: studentData?.photo || "",
      batchValid: batchValid,
      batchExpired: batchExpired,
      isTeacher: isTeacher,
      deviceId: deviceId || "device-1",
      date: new Date().toISOString().split("T")[0],
      timestamp: new Date().toISOString(),
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    };

    await db.collection("attendance").add(record);

    // ─── Automated Push Notification for Parents ───
    if (studentData && !isTeacher) {
      const parentTokens = [];
      if (studentData.parentNativeFcmToken) parentTokens.push(studentData.parentNativeFcmToken);
      if (studentData.parentNativeToken) parentTokens.push(studentData.parentNativeToken);
      if (studentData.parentPushToken) parentTokens.push(studentData.parentPushToken);

      try {
        // IST time
        const istTime = new Date().toLocaleTimeString("en-IN", {
          hour: "2-digit", minute: "2-digit", hour12: true,
          timeZone: "Asia/Kolkata"
        });
        const istDate = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" }); // YYYY-MM-DD

        const studentName = record.studentName || "Bachcha";
        const genderRaw = (studentData.gender || "").toLowerCase().trim();
        const isFemale = ["female", "girl", "f", "ladki"].includes(genderRaw);

        // Gender-aware terms
        const apka    = isFemale ? "Aapki" : "Aapka";
        const bacha   = isFemale ? "bachi" : "bachcha";
        const actionIn  = isFemale ? "aayi" : "aaya";
        const actionOut = isFemale ? "nikli" : "nikla";

        const title = type === "in"
          ? `🎒 ${studentName} Coaching Pahunch${isFemale ? "i" : "a"}`
          : `🏠 ${studentName} Coaching Se Nikal${isFemale ? "i" : "a"}`;
        const body = type === "in"
          ? `${apka} ${bacha} ${studentName} aaj ${istTime} baje coaching ${actionIn}.`
          : `${apka} ${bacha} ${studentName} aaj ${istTime} baje coaching se ${actionOut}.`;

        // ── Save to scheduled_notifications for parent app history ──
        await db.collection("scheduled_notifications").add({
          title,
          message: body,
          notifType: "attendance",
          attendanceType: type,
          date: istDate,
          time: istTime,
          studentId: studentId,
          studentName: studentName,
          target: "parents",
          sent: true,
          isAutomatic: true,
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
        });

        if (parentTokens.length > 0) {
          const uniqueTokens = [...new Set(parentTokens)];
          const fcmMessages = uniqueTokens.filter(t => !t.startsWith("ExponentPushToken")).map(token => ({
            token,
            notification: { title, body },
            android: { priority: "high", notification: { channelId: "pid_alerts_v2", sound: "default" } },
            data: { type: "attendance", attendanceType: type, studentId: studentId || "unknown" }
          }));

          if (fcmMessages.length > 0) await admin.messaging().sendEach(fcmMessages);

          const expoTokens = uniqueTokens.filter(t => t.startsWith("ExponentPushToken"));
          if (expoTokens.length > 0) {
            await fetch("https://exp.host/--/api/v2/push/send", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(expoTokens.map(to => ({
                to, title, body, sound: "default", priority: "high", channelId: "pid_alerts_v2",
                data: { type: "attendance", attendanceType: type, studentId: studentId || "unknown" }
              })))
            });
          }
        }
      } catch (pushErr) {
        console.error("Attendance Push Error:", pushErr.message);
      }
    }

    return NextResponse.json({ success: true, name: record.studentName, type: type, matched: !!studentData, isTeacher: isTeacher }, { status: 200 });
  } catch (error) {
    return NextResponse.json({ error: "Server error: " + error.message }, { status: 500 });
  }
}
// ═══════════════════════════════════════════
// GET — Fetch attendance records for Admin
// ═══════════════════════════════════════════
export async function GET(request) {
  try {
    if (!db) return NextResponse.json({ error: "Database not initialized" }, { status: 500 });

    const { searchParams } = new URL(request.url);
    const date = searchParams.get("date") || new Date().toISOString().split("T")[0];

    const snap = await db.collection("attendance").where("date", "==", date).get();
    const records = snap.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      createdAt: doc.data().createdAt?.toDate ? doc.data().createdAt.toDate() : doc.data().createdAt
    }));

    records.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    return NextResponse.json({ success: true, date, count: records.length, records }, { status: 200 });
  } catch (error) {
    return NextResponse.json({ error: "Server error: " + error.message }, { status: 500 });
  }
}