import { NextResponse } from "next/server";
import admin from "firebase-admin";

// ═══════════════════════════════════════════
// BULLETPROOF FIREBASE ADMIN INIT
// ═══════════════════════════════════════════
if (!admin.apps.length) {
  try {
    const projectId = process.env.FIREBASE_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
    const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
    let privateKey = process.env.FIREBASE_PRIVATE_KEY;

    if (!projectId || !clientEmail || !privateKey) {
      console.error("❌ Error: Firebase environment variables are missing!");
    } else {
      // 1. Agar Vercel ne extra quotes lagaye hain, toh unhe hatayein
      privateKey = privateKey.replace(/^"|"$/g, '');
      privateKey = privateKey.replace(/^'|'$/g, '');
      
      // 2. Literal "\n" ko asli Line Break mein badlein (Yeh sabse pakka tarika hai)
      privateKey = privateKey.split('\\n').join('\n');

      admin.initializeApp({
        credential: admin.credential.cert({
          projectId: projectId,
          clientEmail: clientEmail,
          privateKey: privateKey,
        }),
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
    const { rfidCode, type, deviceId, secret } = body;

    const apiSecret = process.env.ATTENDANCE_API_SECRET || "pid_rfid_2026";
    if (secret !== apiSecret) return NextResponse.json({ error: "Invalid secret" }, { status: 401 });

    const rfidUpper = rfidCode ? rfidCode.toString().toUpperCase().replace(/\s+/g, "").trim() : "";
    if (!rfidUpper || !type) return NextResponse.json({ error: "rfidCode and type required" }, { status: 400 });

    const studentSnap = await db.collection("students").where("rfidCode", "==", rfidUpper).limit(1).get();

    let studentData = null;
    let studentId = null;

    if (!studentSnap.empty) {
      studentId = studentSnap.docs[0].id;
      studentData = studentSnap.docs[0].data();
    }

    let batchValid = true;
    let batchExpired = false;
    if (studentData) {
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

    return NextResponse.json({ success: true, student: record.studentName, type: type, matched: !!studentData }, { status: 200 });
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