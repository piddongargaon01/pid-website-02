import { NextResponse } from "next/server";
import admin from "firebase-admin";

// ═══════════════════════════════════════════
// CLEAN & SIMPLE FIREBASE INIT
// ═══════════════════════════════════════════
if (!admin.apps.length) {
  try {
    const envVar = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
    
    if (!envVar) {
      console.error("❌ Error: FIREBASE_SERVICE_ACCOUNT_KEY is missing!");
    } else {
      // Vercel se aane wale raw JSON ko direct parse karna
      const serviceAccount = JSON.parse(envVar.trim());

      // Line breaks ko specifically check aur fix karna
      if (serviceAccount.private_key) {
        serviceAccount.private_key = serviceAccount.private_key.replace(/\\n/g, '\n');
      }

      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
      });
      console.log("✅ Firebase Admin Initialized Successfully");
    }
  } catch (error) {
    console.error("❌ Firebase Admin Init Error:", error.message);
  }
}

const db = admin.apps.length ? admin.firestore() : null;

// ═══════════════════════════════════════════
// POST — RFID Device sends attendance data
// ═══════════════════════════════════════════
export async function POST(request) {
  try {
    if (!db) return NextResponse.json({ error: "Database not initialized" }, { status: 500 });

    const body = await request.json();
    // 1. CHANGE: NodeMCU se aane wala 'timestamp' bhi receive karein
    const { rfidCode, type, deviceId, secret, timestamp } = body; 

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

    // 2. CHANGE: Real Time Calculate Karein (Agar offline data hai to device ka time, warna server ka time)
    const exactTapTime = timestamp ? new Date(Number(timestamp)) : new Date();

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
      // 3. CHANGE: Niche wali dono line me exactTapTime use kiya gaya hai
      date: exactTapTime.toISOString().split("T")[0], 
      timestamp: exactTapTime.toISOString(),          
      createdAt: admin.firestore.FieldValue.serverTimestamp(), // Ye batayega ki server par kis waqt sync hua
    };

    await db.collection("attendance").add(record);

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