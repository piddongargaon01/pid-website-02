import { NextResponse } from "next/server";
import admin from "firebase-admin";

// 1. Firebase Admin Initialization (Singleton Pattern)
if (!admin.apps.length) {
  try {
    const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });
    console.log("✅ Firebase Admin Initialized Successfully");
  } catch (error) {
    console.error("❌ Firebase Admin Init Error:", error.message);
  }
}

const db = admin.firestore();

// ═══════════════════════════════════════════
// POST — RFID Device sends data here
// ═══════════════════════════════════════════
export async function POST(request) {
  try {
    const body = await request.json();
    const { rfidCode, type, deviceId, secret } = body;

    // A. Security Check (Secret Key Match)
    const apiSecret = process.env.ATTENDANCE_API_SECRET || "pid_rfid_2026";
    if (secret !== apiSecret) {
      return NextResponse.json({ error: "Invalid secret" }, { status: 401 });
    }

    // B. RFID Normalization
    const rfidUpper = rfidCode ? rfidCode.toString().toUpperCase().replace(/\s+/g, "").trim() : "";
    if (!rfidUpper || !type) {
      return NextResponse.json({ error: "rfidCode and type required" }, { status: 400 });
    }

    // C. Find Student by RFID (Admin Way)
    const studentSnap = await db.collection("students")
      .where("rfidCode", "==", rfidUpper)
      .limit(1)
      .get();

    let studentData = null;
    let studentId = null;

    if (!studentSnap.empty) {
      const doc = studentSnap.docs[0];
      studentId = doc.id;
      studentData = doc.data();
    }

    // D. Check Batch Validity
    let batchValid = true;
    let batchExpired = false;
    if (studentData) {
      const today = new Date().toISOString().split("T")[0];
      const startDate = studentData.batchStartDate || "";
      const endDate = studentData.batchEndDate || "";
      
      if (startDate && today < startDate) batchValid = false;
      if (endDate && today > endDate) {
        batchValid = false;
        batchExpired = true;
      }
    }

    // E. Prepare Record
    const record = {
      rfidCode: rfidUpper,
      type: type, // "in" or "out"
      studentId: studentId,
      studentName: studentData?.name || studentData?.studentName || "Unknown Student",
      studentClass: studentData?.class || studentData?.presentClass || "N/A",
      studentPhoto: studentData?.photo || "",
      batchValid: batchValid,
      batchExpired: batchExpired,
      deviceId: deviceId || "device-1",
      date: new Date().toISOString().split("T")[0], // YYYY-MM-DD for easy filtering
      timestamp: new Date().toISOString(),
      createdAt: admin.firestore.FieldValue.serverTimestamp(), // Server side timestamp
    };

    // F. Save to 'attendance' collection
    await db.collection("attendance").add(record);

    console.log(`📝 Attendance saved: ${record.studentName} [${type}]`);

    return NextResponse.json({
      success: true,
      student: record.studentName,
      type: type,
      matched: !!studentData
    }, { status: 200 });

  } catch (error) {
    console.error("❌ Attendance POST Error:", error);
    return NextResponse.json({ error: "Server error: " + error.message }, { status: 500 });
  }
}

// ═══════════════════════════════════════════
// GET — Fetch attendance for Dashboard
// ═══════════════════════════════════════════
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const date = searchParams.get("date") || new Date().toISOString().split("T")[0];

    const snap = await db.collection("attendance")
      .where("date", "==", date)
      .get();

    const records = snap.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      // Firestore timestamp ko JSON readable banane ke liye
      createdAt: doc.data().createdAt?.toDate ? doc.data().createdAt.toDate() : doc.data().createdAt
    }));

    // Time ke hisab se sort karein (Latest First)
    records.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

    return NextResponse.json({ 
      success: true, 
      date, 
      count: records.length, 
      records 
    }, { status: 200 });

  } catch (error) {
    console.error("❌ GET Attendance Error:", error);
    return NextResponse.json({ error: "Server error: " + error.message }, { status: 500 });
  }
}