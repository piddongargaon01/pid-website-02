import { initializeApp, getApps } from "firebase/app";
import { getFirestore, collection, addDoc, serverTimestamp, query, where, getDocs } from "firebase/firestore";
import { NextResponse } from "next/server";

// Firebase config — same as firebase.js
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

// Initialize Firebase for API route
const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
const db = getFirestore(app);

// ═══════════════════════════════════════════
// POST — Device sends attendance data
// ═══════════════════════════════════════════
export async function POST(request) {
  try {
    const body = await request.json();
    const { rfidCode, type, deviceId, secret } = body;

    // Normalize RFID — uppercase, strip ALL whitespace
    const rfidUpper = rfidCode ? rfidCode.toString().toUpperCase().replace(/\s+/g, "").trim() : "";
    if (!rfidUpper || !type) {
      return NextResponse.json({ error: "rfidCode and type required" }, { status: 400 });
    }

    // Verify API secret
    const apiSecret = process.env.ATTENDANCE_API_SECRET || "pid_rfid_2026";
    if (secret !== apiSecret) {
      return NextResponse.json({ error: "Invalid secret" }, { status: 401 });
    }

    // ═══ Find student by RFID code ═══
    let studentData = null;
    try {
      const q = query(collection(db, "students"), where("rfidCode", "==", rfidUpper));
      const snap = await getDocs(q);

      if (!snap.empty) {
        const docSnap = snap.docs[0];
        studentData = { studentId: docSnap.id, ...docSnap.data() };
        console.log(`✅ RFID Match: "${rfidUpper}" → ${studentData.studentName} (ID: ${docSnap.id})`);
      } else {
        console.log(`❌ RFID No Match: "${rfidUpper}" — No student found`);
        // Debug: list all registered RFIDs
        try {
          const allSnap = await getDocs(collection(db, "students"));
          const rfidList = allSnap.docs
            .map(d => ({ name: d.data().studentName, rfid: d.data().rfidCode }))
            .filter(s => s.rfid);
          console.log(`📋 All registered RFIDs:`, JSON.stringify(rfidList));
        } catch (debugErr) {
          console.log("Debug list failed:", debugErr.message);
        }
      }
    } catch (e) {
      console.error("🔥 Student lookup FAILED:", e.message);
      console.error("⚠️  This usually means Firestore Security Rules are blocking the read!");
      console.error("⚠️  Fix: Update rules to allow read on 'students' collection without auth.");
    }

    // ═══ Check batch validity ═══
    let batchValid = true;
    let batchExpired = false;
    if (studentData) {
      const today = new Date().toISOString().split("T")[0];
      const startDate = studentData.batchStartDate || "";
      const endDate = studentData.batchEndDate || "";
      if (startDate && today < startDate) {
        batchValid = false;
      }
      if (endDate && today > endDate) {
        batchValid = false;
        batchExpired = true;
      }
    }

    // ═══ Save attendance record ═══
    const record = {
      rfidCode: rfidUpper,
      type: type,
      studentId: studentData?.studentId || null,
      studentName: studentData?.studentName || "Unknown",
      studentClass: studentData?.class || studentData?.presentClass || "",
      studentPhoto: studentData?.photo || "",
      batchValid: batchValid,
      batchExpired: batchExpired,
      deviceId: deviceId || "device-1",
      date: new Date().toISOString().split("T")[0],
      timestamp: new Date().toISOString(),
      createdAt: serverTimestamp(),
    };

    await addDoc(collection(db, "attendance"), record);

    console.log(`📝 Attendance saved: ${record.studentName} [${type}] RFID:${rfidUpper}`);

    return NextResponse.json({
      success: true,
      student: record.studentName,
      class: record.studentClass,
      type: type,
      batchValid: batchValid,
      batchExpired: batchExpired,
      matched: !!studentData,
    }, { status: 200 });

  } catch (error) {
    console.error("❌ Attendance API Error:", error);
    return NextResponse.json({ error: "Server error: " + error.message }, { status: 500 });
  }
}

// ═══════════════════════════════════════════
// GET — Fetch attendance records
// ═══════════════════════════════════════════
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const date = searchParams.get("date") || new Date().toISOString().split("T")[0];

    const q = query(collection(db, "attendance"), where("date", "==", date));
    const snap = await getDocs(q);
    const records = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    records.sort((a, b) => (b.timestamp || "").localeCompare(a.timestamp || ""));

    return NextResponse.json({ success: true, date, count: records.length, records }, { status: 200 });

  } catch (error) {
    console.error("❌ GET Attendance Error:", error);
    return NextResponse.json({ error: "Server error: " + error.message }, { status: 500 });
  }
}