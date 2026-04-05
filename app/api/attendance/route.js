import { NextResponse } from "next/server";
import admin from "firebase-admin";

// 1. Firebase Admin Initialization (Safe & Full Version)
if (!admin.apps.length) {
  try {
    const serviceKey = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;

    if (!serviceKey) {
      console.error("❌ Error: FIREBASE_SERVICE_ACCOUNT_KEY is missing in .env");
    } else {
      // JSON parse karein
      const serviceAccount = typeof serviceKey === 'string' ? JSON.parse(serviceKey) : serviceKey;

      // Sabse important fix: Private Key ke \n (line breaks) ko sahi karna
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
    if (!db) {
      return NextResponse.json({ error: "Database not initialized" }, { status: 500 });
    }

    const body = await request.json();
    const { rfidCode, type, deviceId, secret } = body;

    // A. Security Check
    const apiSecret = process.env.ATTENDANCE_API_SECRET || "pid_rfid_2026";
    if (secret !== apiSecret) {
      return NextResponse.json({ error: "Invalid secret" }, { status: 401 });
    }

    // B. RFID Normalization
    const rfidUpper = rfidCode ? rfidCode.toString().toUpperCase().replace(/\s+/g, "").trim() : "";
    if (!rfidUpper || !type) {
      return NextResponse.json({ error: "rfidCode and type required" }, { status: 400 });
    }

    // C. Find student by RFID code (Admin Read)
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
      console.log(`✅ RFID Match: ${studentData.studentName || studentData.name}`);
    } else {
      console.log(`❌ No student found for RFID: ${rfidUpper}`);
    }

    // D. Check batch validity
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

    // E. Save attendance record
    const record = {
      rfidCode: rfidUpper,
      type: type, // "in" or "out"
      studentId: studentId,
      studentName: studentData?.name || studentData?.studentName || "Unknown",
      studentClass: studentData?.class || studentData?.presentClass || "N/A",
      studentPhoto: studentData?.photo || "",
      batchValid: batchValid,
      batchExpired: batchExpired,
      deviceId: deviceId || "device-1",
      date: new Date().toISOString().split("T")[0],
      timestamp: new Date().toISOString(),
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    };

    await db.collection("attendance").add(record);

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
// GET — Fetch attendance records for Admin
// ═══════════════════════════════════════════
export async function GET(request) {
  try {
    if (!db) {
      return NextResponse.json({ error: "Database not initialized" }, { status: 500 });
    }

    const { searchParams } = new URL(request.url);
    const date = searchParams.get("date") || new Date().toISOString().split("T")[0];

    const snap = await db.collection("attendance")
      .where("date", "==", date)
      .get();

    const records = snap.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      createdAt: doc.data().createdAt?.toDate ? doc.data().createdAt.toDate() : doc.data().createdAt
    }));

    // Latest first sort
    records.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

    return NextResponse.json({ success: true, date, count: records.length, records }, { status: 200 });

  } catch (error) {
    console.error("❌ GET Attendance Error:", error);
    return NextResponse.json({ error: "Server error: " + error.message }, { status: 500 });
  }
}