import { NextResponse } from "next/server";
import admin from "firebase-admin";

// 1. Firebase Admin Initialization (Strong PEM Fix)
if (!admin.apps.length) {
  try {
    const serviceKey = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;

    if (!serviceKey) {
      console.error("❌ Error: FIREBASE_SERVICE_ACCOUNT_KEY is missing");
    } else {
      let serviceAccount = typeof serviceKey === 'string' ? JSON.parse(serviceKey) : serviceKey;

      // PEM FIX: Ye do lines kisi bhi tarah ke format error ko theek kar dengi
      if (serviceAccount.private_key) {
        serviceAccount.private_key = serviceAccount.private_key
          .replace(/\\n/g, '\n')     // Double backslash ko single mein badlega
          .replace(/\n/g, '\n');     // New lines ko confirm karega
      }

      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
      });
      console.log("✅ Firebase Admin Success");
    }
  } catch (error) {
    console.error("❌ Firebase Admin Init Error:", error.message);
  }
}

const db = admin.apps.length ? admin.firestore() : null;

// ═══════════════════════════════════════════
// POST — RFID Device sends data
// ═══════════════════════════════════════════
export async function POST(request) {
  try {
    if (!db) {
      return NextResponse.json({ error: "Database not initialized" }, { status: 500 });
    }

    const body = await request.json();
    const { rfidCode, type, deviceId, secret } = body;

    const apiSecret = process.env.ATTENDANCE_API_SECRET || "pid_rfid_2026";
    if (secret !== apiSecret) {
      return NextResponse.json({ error: "Invalid secret" }, { status: 401 });
    }

    const rfidUpper = rfidCode ? rfidCode.toString().toUpperCase().replace(/\s+/g, "").trim() : "";
    if (!rfidUpper || !type) {
      return NextResponse.json({ error: "rfidCode and type required" }, { status: 400 });
    }

    const studentSnap = await db.collection("students").where("rfidCode", "==", rfidUpper).limit(1).get();

    let studentData = null;
    let studentId = null;
    if (!studentSnap.empty) {
      studentId = studentSnap.docs[0].id;
      studentData = studentSnap.docs[0].data();
    }

    const record = {
      rfidCode: rfidUpper,
      type,
      studentId,
      studentName: studentData?.name || studentData?.studentName || "Unknown",
      studentClass: studentData?.class || studentData?.presentClass || "N/A",
      timestamp: new Date().toISOString(),
      date: new Date().toISOString().split("T")[0],
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    };

    await db.collection("attendance").add(record);

    return NextResponse.json({ success: true, student: record.studentName }, { status: 200 });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// ═══════════════════════════════════════════
// GET — Attendance Records
// ═══════════════════════════════════════════
export async function GET(request) {
  try {
    if (!db) return NextResponse.json({ error: "Database not initialized" }, { status: 500 });
    const { searchParams } = new URL(request.url);
    const date = searchParams.get("date") || new Date().toISOString().split("T")[0];
    const snap = await db.collection("attendance").where("date", "==", date).get();
    const records = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    return NextResponse.json({ success: true, records }, { status: 200 });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}