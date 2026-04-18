"use client";
import { db, auth, googleProvider, storage } from "../firebase";
import { collection, addDoc, updateDoc, deleteDoc, doc, serverTimestamp, onSnapshot, Timestamp, setDoc, getDoc, query, where, getDocs } from "firebase/firestore";
import { ref, uploadBytesResumable, getDownloadURL, deleteObject } from "firebase/storage";
import { signInWithPopup, onAuthStateChanged } from "firebase/auth";
import { useEffect, useState, useRef } from "react";
import Link from "next/link";

const ADMIN_EMAILS = ["rkp042010@gmail.com","patelinstitutedongargaon1234@gmail.com","piddongargaon01@gmail.com"];

// ═══════════════════════════════════════════
// IMAGE UPLOADER COMPONENT (Reusable)
// ═══════════════════════════════════════════
function ImageUploader({ folder, currentUrl, onUpload, onRemove, label, maxSizeMB = 5 }) {
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState("");
  const fileRef = useRef(null);

  const handleFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setError("");

    // Validate type
    const allowed = ["image/jpeg", "image/png", "image/webp"];
    if (!allowed.includes(file.type)) {
      setError("Only JPG, PNG, WebP allowed");
      return;
    }

    // Validate size
    if (file.size > maxSizeMB * 1024 * 1024) {
      setError(`File too large. Max ${maxSizeMB}MB`);
      return;
    }

    setUploading(true);
    setProgress(0);

    try {
      // Create unique filename: folder/timestamp_originalname
      const timestamp = Date.now();
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
      const filePath = `${folder}/${timestamp}_${safeName}`;
      const storageRef = ref(storage, filePath);

      const uploadTask = uploadBytesResumable(storageRef, file);

      uploadTask.on("state_changed",
        (snap) => {
          const pct = Math.round((snap.bytesTransferred / snap.totalBytes) * 100);
          setProgress(pct);
        },
        (err) => {
          setError("Upload failed: " + err.message);
          setUploading(false);
        },
        async () => {
          const url = await getDownloadURL(uploadTask.snapshot.ref);
          onUpload(url);
          setUploading(false);
          setProgress(0);
          if (fileRef.current) fileRef.current.value = "";
        }
      );
    } catch (err) {
      setError("Upload error: " + err.message);
      setUploading(false);
    }
  };

  const handleRemove = () => {
    if (onRemove) onRemove();
    if (fileRef.current) fileRef.current.value = "";
  };

  const us = {
    wrap: { marginBottom: 12 },
    label: { display: "block", fontSize: ".78rem", fontWeight: 600, color: "#1C2E44", marginBottom: 5 },
    row: { display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" },
    btn: { padding: "8px 16px", borderRadius: 8, border: "1.5px dashed #C0D0E8", background: "#F8FAFD", color: "#1349A8", fontSize: ".8rem", fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", gap: 6, transition: "all .2s" },
    preview: { width: 70, height: 70, borderRadius: 10, overflow: "hidden", border: "2px solid #D4DEF0", background: "#F0F4FA", flexShrink: 0 },
    progress: { height: 4, borderRadius: 99, background: "#E8EFF8", overflow: "hidden", width: 120 },
    bar: (w) => ({ height: "100%", borderRadius: 99, background: "linear-gradient(90deg,#1349A8,#2A6FE0)", width: `${w}%`, transition: "width .3s" }),
    err: { fontSize: ".72rem", color: "#DC2626", marginTop: 4 },
    removeBtn: { width: 22, height: 22, borderRadius: "50%", border: "1px solid #FCA5A5", background: "#FEF2F2", color: "#DC2626", fontSize: ".65rem", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" },
  };

  return (
    <div style={us.wrap}>
      {label && <label style={us.label}>{label}</label>}
      <div style={us.row}>
        {/* Preview */}
        {currentUrl && currentUrl.startsWith("http") && (
          <div style={us.preview}>
            <img src={currentUrl} alt="Preview" style={{ width: "100%", height: "100%", objectFit: "cover" }}
              onError={(e) => { e.currentTarget.style.display = "none"; }} />
          </div>
        )}

        {/* Upload Button */}
        <label style={{ ...us.btn, opacity: uploading ? 0.6 : 1, pointerEvents: uploading ? "none" : "auto" }}>
          <i className={uploading ? "fas fa-spinner fa-spin" : "fas fa-cloud-upload-alt"} />
          {uploading ? `Uploading ${progress}%` : (currentUrl ? "Change Photo" : "Upload Photo")}
          <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" onChange={handleFile} style={{ display: "none" }} />
        </label>

        {/* Progress Bar */}
        {uploading && (
          <div style={us.progress}>
            <div style={us.bar(progress)} />
          </div>
        )}

        {/* Remove Button */}
        {currentUrl && !uploading && (
          <button onClick={handleRemove} style={us.removeBtn} title="Remove photo">
            <i className="fas fa-times" />
          </button>
        )}
      </div>

      {error && <div style={us.err}><i className="fas fa-exclamation-circle" style={{ marginRight: 4 }} />{error}</div>}

      {/* URL display */}
      {currentUrl && (
        <div style={{ fontSize: ".68rem", color: "#6B7F99", marginTop: 4, wordBreak: "break-all", maxWidth: 400 }}>
          <i className="fas fa-link" style={{ marginRight: 4 }} />{currentUrl.substring(0, 60)}...
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════
// PDF UPLOADER COMPONENT (For Study Materials — Future)
// ═══════════════════════════════════════════
function PDFUploader({ folder, currentUrl, onUpload, onRemove, label }) {
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState("");
  const fileRef = useRef(null);

  const handleFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setError("");

    if (file.type !== "application/pdf") {
      setError("Only PDF files allowed");
      return;
    }
    if (file.size > 20 * 1024 * 1024) {
      setError("File too large. Max 20MB");
      return;
    }

    setUploading(true);
    setProgress(0);

    try {
      const timestamp = Date.now();
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
      const filePath = `${folder}/${timestamp}_${safeName}`;
      const storageRef = ref(storage, filePath);

      const uploadTask = uploadBytesResumable(storageRef, file);

      uploadTask.on("state_changed",
        (snap) => setProgress(Math.round((snap.bytesTransferred / snap.totalBytes) * 100)),
        (err) => { setError("Upload failed: " + err.message); setUploading(false); },
        async () => {
          const url = await getDownloadURL(uploadTask.snapshot.ref);
          onUpload(url);
          setUploading(false);
          setProgress(0);
          if (fileRef.current) fileRef.current.value = "";
        }
      );
    } catch (err) {
      setError("Upload error: " + err.message);
      setUploading(false);
    }
  };

  return (
    <div style={{ marginBottom: 12 }}>
      {label && <label style={{ display: "block", fontSize: ".78rem", fontWeight: 600, color: "#1C2E44", marginBottom: 5 }}>{label}</label>}
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <label style={{ padding: "8px 16px", borderRadius: 8, border: "1.5px dashed #C0D0E8", background: "#F8FAFD", color: "#7C3AED", fontSize: ".8rem", fontWeight: 600, cursor: uploading ? "not-allowed" : "pointer", display: "flex", alignItems: "center", gap: 6 }}>
          <i className={uploading ? "fas fa-spinner fa-spin" : "fas fa-file-pdf"} />
          {uploading ? `Uploading ${progress}%` : "Upload PDF"}
          <input ref={fileRef} type="file" accept="application/pdf" onChange={handleFile} style={{ display: "none" }} />
        </label>
        {currentUrl && <a href={currentUrl} target="_blank" rel="noopener noreferrer" style={{ fontSize: ".72rem", color: "#1349A8" }}><i className="fas fa-external-link-alt" style={{ marginRight: 4 }} />View PDF</a>}
      </div>
      {error && <div style={{ fontSize: ".72rem", color: "#DC2626", marginTop: 4 }}><i className="fas fa-exclamation-circle" style={{ marginRight: 4 }} />{error}</div>}
    </div>
  );
}

// ═══════════════════════════════════════════
// TIME AGO HELPER
// ═══════════════════════════════════════════
function timeAgo(ts) {
  if (!ts) return "";
  const now = Date.now();
  const t = ts.toDate ? ts.toDate().getTime() : new Date(ts).getTime();
  const diff = now - t;
  const mins = Math.floor(diff / 60000);
  const hrs = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins} min ago`;
  if (hrs < 24) return `${hrs} hr${hrs > 1 ? "s" : ""} ago`;
  if (days < 30) return `${days} day${days > 1 ? "s" : ""} ago`;
  return `${Math.floor(days / 30)} month${Math.floor(days / 30) > 1 ? "s" : ""} ago`;
}

function formatDate(ts) {
  if (!ts) return "";
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

// ═══════════════════════════════════════════
// DEFAULT COURSE DATA (for seeding Firebase)
// ═══════════════════════════════════════════
const DEFAULT_COURSES = {
  "12": {
    classId: "12", title: "Class 12th", tag: "Board + Entrance", order: 1,
    desc: "Comprehensive preparation for board exams and competitive entrance tests. Dual focus on HSC board scoring and JEE/NEET/CET entrance exam readiness.",
    duration: "Board classes: 10 April to 20 January",
    batches: [
      { medium: "English", board: "CG Board", type: "Regular + Crash", regular: "3 hrs/day", crash: "4 hrs/day" },
      { medium: "English", board: "CBSE", type: "Regular + Crash", regular: "3 hrs/day", crash: "4 hrs/day" },
      { medium: "Hindi", board: "CG Board", type: "Regular + Crash", regular: "3 hrs/day", crash: "4 hrs/day" },
    ],
    subjects: ["Physics", "Chemistry", "Mathematics", "Biology"],
    teachers: [
      { name: "Mr. Temlal Patel", subject: "Physics", qual: "BSc. Maths, MSc. Physics, B.Ed", exp: "15 years", photo: "" },
      { name: "Mr. Aman Sharma", subject: "Chemistry", qual: "BSc. Maths, MSc. Chemistry, B.Ed", exp: "10 years", photo: "" },
      { name: "Mr. Kamta Prashad Sen", subject: "Maths", qual: "BSc. Maths, MSc. Maths, B.Ed", exp: "10 years", photo: "" },
      { name: "Mr. Naresh Sahu", subject: "Biology", qual: "BSc. Bio, MSc. Bio, B.Ed", exp: "8 years", photo: "" },
    ],
    fees: [
      { label: "12th English Medium (CG)", amount: "₹6,000/subject" },
      { label: "12th Hindi Medium (CG)", amount: "₹5,000/subject" },
      { label: "12th CBSE Board", amount: "₹7,000/subject" },
    ],
    features: ["Board exam focused preparation", "JEE/NEET parallel coaching available", "Regular mock tests & previous year papers", "DPP (Daily Practice Papers)", "Study material & reference books", "Personal doubt clearing sessions"],
  },
  "11": {
    classId: "11", title: "Class 11th", tag: "Science Stream", order: 2,
    desc: "Strong foundation building for higher secondary education. Stream-specific coaching for Science with focus on conceptual clarity.",
    duration: "Board classes: 10 April to 20 January. Local classes: June to February",
    batches: [
      { medium: "English", board: "CG Board", type: "Regular", regular: "3 hrs/day", crash: "—" },
      { medium: "English", board: "CBSE", type: "Regular", regular: "3 hrs/day", crash: "—" },
      { medium: "Hindi", board: "CG Board", type: "Regular", regular: "3 hrs/day", crash: "—" },
    ],
    subjects: ["Physics", "Chemistry", "Mathematics", "Biology"],
    teachers: [
      { name: "Mr. Temlal Patel", subject: "Physics", qual: "BSc. Maths, MSc. Physics, B.Ed", exp: "15 years", photo: "" },
      { name: "Mr. Aman Sharma", subject: "Chemistry", qual: "BSc. Maths, MSc. Chemistry, B.Ed", exp: "10 years", photo: "" },
      { name: "Mr. Kamlesh Rajput", subject: "Maths", qual: "BSc. Maths, MSc. Maths", exp: "4 years", photo: "" },
      { name: "Mr. Naresh Sahu", subject: "Biology", qual: "BSc. Bio, MSc. Bio, B.Ed", exp: "8 years", photo: "" },
    ],
    fees: [
      { label: "11th English Medium (CG)", amount: "₹6,000/subject" },
      { label: "11th Hindi Medium (CG)", amount: "₹5,000/subject" },
      { label: "11th CBSE Board", amount: "₹7,000/subject" },
    ],
    features: ["Strong conceptual foundation", "NCERT + reference book based teaching", "Regular assessments", "Study materials & DPP", "Doubt clearing sessions", "Board + entrance dual preparation"],
  },
  "10": {
    classId: "10", title: "Class 10th", tag: "Board Preparation", order: 3,
    desc: "Focused board exam preparation with regular mock tests, previous year papers, and intensive revision sessions.",
    duration: "Board classes: 10 April to 20 January. Local classes: June to February",
    batches: [
      { medium: "English", board: "CG Board", type: "Regular + Crash", regular: "2 hrs/day", crash: "Available" },
      { medium: "English", board: "CBSE", type: "Regular + Crash", regular: "2 hrs/day", crash: "Available" },
      { medium: "Hindi", board: "CG Board", type: "Regular + Crash", regular: "2 hrs/day", crash: "Available" },
    ],
    subjects: ["Science", "Mathematics", "English", "Social Science"],
    teachers: [
      { name: "Mr. Yuvraj Patel", subject: "Science", qual: "BSc. Bio, MSc. Bio, B.Ed", exp: "2 years", photo: "" },
      { name: "Mr. Kamta Prashad Sen", subject: "Maths", qual: "BSc. Maths, MSc. Maths, B.Ed", exp: "10 years", photo: "" },
      { name: "Mr. Kamlesh Rajput", subject: "Maths", qual: "BSc. Maths, MSc. Maths", exp: "4 years", photo: "" },
    ],
    fees: [
      { label: "10th English Medium (CG)", amount: "₹5,000/subject" },
      { label: "10th Hindi Medium (CG)", amount: "₹4,500/subject" },
      { label: "10th CBSE Board", amount: "₹6,000/subject" },
    ],
    features: ["Board exam intensive preparation", "Mock tests & model papers", "Previous year question practice", "Revision sessions before exams", "Study materials provided", "Regular parent-teacher meetings"],
  },
  "9": {
    classId: "9", title: "Class 9th", tag: "Foundation", order: 4,
    desc: "Build a rock-solid academic foundation across all subjects. Focus on conceptual understanding and strong basics.",
    duration: "Local classes: June to February",
    batches: [
      { medium: "English", board: "CG Board", type: "Regular", regular: "2 hrs/day", crash: "—" },
      { medium: "English", board: "CBSE", type: "Regular", regular: "2 hrs/day", crash: "—" },
      { medium: "Hindi", board: "CG Board", type: "Regular", regular: "2 hrs/day", crash: "—" },
    ],
    subjects: ["Science", "Mathematics", "English", "Social Science"],
    teachers: [
      { name: "Mr. Temlal Patel", subject: "Science", qual: "BSc. Maths, MSc. Physics, B.Ed", exp: "15 years", photo: "" },
      { name: "Mr. Kamlesh Rajput", subject: "Maths", qual: "BSc. Maths, MSc. Maths", exp: "4 years", photo: "" },
      { name: "Mr. Yuvraj Patel", subject: "Science", qual: "BSc. Bio, MSc. Bio, B.Ed", exp: "2 years", photo: "" },
    ],
    fees: [
      { label: "9th English Medium (CG)", amount: "₹5,000/subject" },
      { label: "9th Hindi Medium (CG)", amount: "₹4,500/subject" },
      { label: "9th CBSE Board", amount: "₹6,000/subject" },
    ],
    features: ["Strong foundation building", "Conceptual clarity focus", "Regular class tests", "NCERT based teaching", "Doubt clearing sessions", "Study material & worksheets"],
  },
  "2-8": {
    classId: "2-8", title: "Class 2nd to 8th", tag: "Foundation", order: 5,
    desc: "Building strong academic foundation for younger students. Focus on basics, concept clarity, and developing study habits.",
    duration: "Classes: 10 April to March",
    batches: [
      { medium: "English", board: "CG Board", type: "Regular", regular: "2 hrs/day", crash: "—" },
      { medium: "English", board: "CBSE", type: "Regular", regular: "2 hrs/day", crash: "—" },
    ],
    subjects: ["Maths", "Science", "English", "Hindi", "Social Science"],
    teachers: [
      { name: "Mrs. Hemlata Patel", subject: "All Subjects", qual: "BCA, MSc. Maths, D.El.Ed", exp: "10 years", photo: "" },
    ],
    fees: [
      { label: "Class 2-4", amount: "₹5,000/year" },
      { label: "Class 5 + Navodaya", amount: "₹6,000 + ₹2,000" },
      { label: "Class 6-7", amount: "₹7,000/year" },
      { label: "Class 8 (CG + Prayas)", amount: "₹8,000 + ₹2,000" },
      { label: "Class 8 (CBSE)", amount: "₹8,000/year" },
    ],
    features: ["Age-appropriate teaching methods", "Foundation building for higher classes", "Regular assessments", "Homework help", "Study material provided", "Personal attention to each student"],
  },
  "navodaya": {
    classId: "navodaya", title: "Navodaya", tag: "Entrance Exam", order: 6,
    desc: "Specialized coaching for Jawahar Navodaya Vidyalaya entrance exam. For Class 5th appearing students (any board).",
    duration: "Parallel to regular course",
    batches: [
      { medium: "Hindi + English", board: "All Boards", type: "Crash", regular: "2 hrs/day", crash: "—" },
    ],
    subjects: ["Mental Ability", "Arithmetic", "Language"],
    teachers: [
      { name: "Mrs. Hemlata Patel", subject: "All Subjects", qual: "BCA, MSc. Maths, D.El.Ed", exp: "10 years", photo: "" },
    ],
    fees: [
      { label: "Navodaya Coaching", amount: "₹2,000" },
    ],
    features: ["Navodaya pattern practice", "Mock tests", "Previous year papers", "Mental ability training", "Language practice"],
  },
  "prayas": {
    classId: "prayas", title: "Prayas Awasiya Vidyalaya", tag: "Entrance Exam", order: 7,
    desc: "Specialized coaching for Prayas Awasiya Vidyalaya entrance exam. For Class 8th appearing students (any board).",
    duration: "Parallel to regular course",
    batches: [
      { medium: "Hindi + English", board: "All Boards", type: "Crash", regular: "2 hrs/day", crash: "—" },
    ],
    subjects: ["Science", "Maths", "English", "Hindi", "General Knowledge"],
    teachers: [
      { name: "Mrs. Hemlata Patel", subject: "All Subjects", qual: "BCA, MSc. Maths, D.El.Ed", exp: "10 years", photo: "" },
    ],
    fees: [
      { label: "Prayas Coaching", amount: "₹2,000" },
    ],
    features: ["Prayas exam pattern practice", "Mock tests", "Previous year papers", "Subject-wise preparation"],
  },
};

export default function AdminPanel() {
  // ═══ BATCH OPTIONS (Class + Medium + Board) — As per PID Course Structure ═══
  const BATCH_OPTIONS = [
    // Class 12th
    { value: "12th-Eng-CBSE-ICSE", label: "12th English (CBSE+ICSE)", class: "12th", medium: "English", boards: ["CBSE", "ICSE"] },
    { value: "12th-Hindi-CG-CBSE", label: "12th Hindi (CG+CBSE)", class: "12th", medium: "Hindi", boards: ["CG", "CBSE"] },
    { value: "12th-Eng-CG", label: "12th English (CG Board)", class: "12th", medium: "English", boards: ["CG"] },
    // Class 11th
    { value: "11th-Eng-CBSE-ICSE", label: "11th English (CBSE+ICSE)", class: "11th", medium: "English", boards: ["CBSE", "ICSE"] },
    { value: "11th-Hindi-CG-CBSE", label: "11th Hindi (CG+CBSE)", class: "11th", medium: "Hindi", boards: ["CG", "CBSE"] },
    { value: "11th-Eng-CG", label: "11th English (CG Board)", class: "11th", medium: "English", boards: ["CG"] },
    // Class 10th
    { value: "10th-Eng-All", label: "10th English (CG+CBSE+ICSE)", class: "10th", medium: "English", boards: ["CG", "CBSE", "ICSE"] },
    { value: "10th-Hindi-CG-CBSE", label: "10th Hindi (CG+CBSE)", class: "10th", medium: "Hindi", boards: ["CG", "CBSE"] },
    // Class 9th
    { value: "9th-Eng-All", label: "9th English (CG+CBSE+ICSE)", class: "9th", medium: "English", boards: ["CG", "CBSE", "ICSE"] },
    { value: "9th-Hindi-CG-CBSE", label: "9th Hindi (CG+CBSE)", class: "9th", medium: "Hindi", boards: ["CG", "CBSE"] },
    // Junior Classes
    { value: "2nd-8th-All", label: "2nd-8th All Medium (CG+CBSE+ICSE)", class: "2nd-8th", medium: "All", boards: ["CG", "CBSE", "ICSE"] },
    // Entrance Coaching
    { value: "Navodaya", label: "Navodaya Entrance", class: "Navodaya", medium: "All", boards: [] },
    { value: "Prayas", label: "Prayas Awasiya Vidyalaya", class: "Prayas", medium: "All", boards: [] },
    // Competition Exam
    { value: "JEE-NEET", label: "IIT-JEE & NEET (9th-12th)", class: "JEE-NEET", medium: "All", boards: [] },
  ];

  // Helper: filter students by batch value
  function filterByBatch(list, batchValue) {
    if (batchValue === "all") return list;
    const batch = BATCH_OPTIONS.find(b => b.value === batchValue);
    if (!batch) {
      return list.filter(x => x.class === batchValue || x.class?.includes(batchValue.replace("th", "")));
    }
    // JEE-NEET = all students from 9th to 12th
    if (batch.class === "JEE-NEET") {
      return list.filter(x => ["9th", "10th", "11th", "12th"].includes(x.class));
    }
    // 2nd-8th = class 2 se 8 tak
    if (batch.class === "2nd-8th") {
      return list.filter(x => ["2nd","3rd","4th","5th","6th","7th","8th"].includes(x.class));
    }
    return list.filter(x => {
      // Class match — "12th" === "12th"
      const classMatch = x.class === batch.class || x.presentClass === batch.class;
      if (!classMatch) return false;

      // Medium match — "All" means koi bhi chalega
      const mediumMatch = batch.medium === "All" || !x.medium || x.medium === batch.medium;

      // Board match — "CG Board" ko "CG" se match karo, "CBSE" = "CBSE", "ICSE" = "ICSE"
      const normalizeBoard = (b) => {
        if (!b) return "";
        if (b === "CG Board") return "CG";
        return b; // CBSE, ICSE as-is
      };
      const studentBoard = normalizeBoard(x.board);
      const boardMatch = !batch.boards || batch.boards.length === 0 || !x.board || batch.boards.includes(studentBoard);

      return mediumMatch && boardMatch;
    });
  }

  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("dashboard");
  const [sidebarOpen, setSidebarOpen] = useState(true);

  // Data states
  const [courses, setCourses] = useState([]);
  const [toppers, setToppers] = useState([]);
  const [events, setEvents] = useState([]);
  const [reviews, setReviews] = useState([]);
  const [enquiries, setEnquiries] = useState([]);
  const [teachers, setTeachers] = useState([]);
  const [students, setStudents] = useState([]);
  const [studentSearch, setStudentSearch] = useState("");
  const [studentFilter, setStudentFilter] = useState("all");
  const [materials, setMaterials] = useState([]);
  const [matCourse, setMatCourse] = useState("");
  const [matSubject, setMatSubject] = useState("");
  const [matType, setMatType] = useState("all");

  // Attendance states
  const [attendance, setAttendance] = useState([]);
  const [attDate, setAttDate] = useState(new Date().toISOString().split("T")[0]);
  const [attSearch, setAttSearch] = useState("");
  const [attFilter, setAttFilter] = useState("all");
  const [attSubTab, setAttSubTab] = useState("students"); // students | teachers
  const [attClassFilter, setAttClassFilter] = useState("all");
  const [attViewMode, setAttViewMode] = useState("daily"); // daily | weekly | monthly
  const [manualAttModal, setManualAttModal] = useState(null);
  const [manualAttType, setManualAttType] = useState("present");
  // Individual teacher/student attendance calendar
  const [attSelectedPerson, setAttSelectedPerson] = useState(null); // {id, name, type: "teacher"|"student", photo}
  const [personAttData, setPersonAttData] = useState([]); // individual person ka full month attendance
  const [personCalMonth, setPersonCalMonth] = useState(new Date().getMonth());
  const [personCalYear, setPersonCalYear] = useState(new Date().getFullYear());
  // Weekly/Monthly teacher attendance data
  const [attRangeData, setAttRangeData] = useState([]); // weekly/monthly range ka data
  const [multiDayAtt, setMultiDayAtt] = useState([]);
  const [multiDayLoading, setMultiDayLoading] = useState(false);
  const [calendarStudent, setCalendarStudent] = useState(null);
  const [calMonthAtt, setCalMonthAtt] = useState([]);
  const [calStudentMonth, setCalStudentMonth] = useState(new Date().getMonth());
  const [calStudentYear, setCalStudentYear] = useState(new Date().getFullYear());
  const [holidays, setHolidays] = useState([]);
  const [holidayForm, setHolidayForm] = useState({});
  const [showHolidayForm, setShowHolidayForm] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [teacherNotifications, setTeacherNotifications] = useState([]);
  const [leaveApplications, setLeaveApplications] = useState([]); // parent/student leave requests
  const [teacherLeaves, setTeacherLeaves] = useState([]); // teacher leave requests
  const [notifForm, setNotifForm] = useState({});
  const [showNotifForm, setShowNotifForm] = useState(false);
  const [calMonth, setCalMonth] = useState(new Date().getMonth());
  const [calYear, setCalYear] = useState(new Date().getFullYear());

  // ═══ RECORDS SECTION STATES ═══
  const [recMainTab, setRecMainTab] = useState("attendance"); // attendance | students | teachers | fees
  const [recClassFilter, setRecClassFilter] = useState("all"); // BATCH_OPTIONS value ya "all"
  const [recWeekOffset, setRecWeekOffset] = useState(0);
  const [recData, setRecData] = useState([]);
  const [recLoading, setRecLoading] = useState(false);
  const [recShowHistory, setRecShowHistory] = useState(false);

  // ═══ BATCH/SESSION YEAR (Auto April-March) ═══
  const getCurrentBatchYear = () => {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth();
    return month >= 3 ? year : year - 1;
  };
  const [recBatchYear, setRecBatchYear] = useState(getCurrentBatchYear());

  // ═══ CLASS CATEGORIES (Image ke according) ═══
  const CLASS_CATEGORIES = [
    // Foundation Courses
    { id: "12th-Eng-CBSE-ICSE", label: "12th English (CBSE+ICSE)", shortLabel: "12 Eng CB+IC", icon: "fa-user-graduate", color: "#1349A8" },
    { id: "12th-Hindi-CG-CBSE", label: "12th Hindi (CG+CBSE)", shortLabel: "12 Hin CG+CB", icon: "fa-user-graduate", color: "#2A6FE0" },
    { id: "12th-Eng-CG", label: "12th English (CG Board)", shortLabel: "12 Eng CG", icon: "fa-user-graduate", color: "#3B82F6" },
    { id: "11th-Eng-CBSE-ICSE", label: "11th English (CBSE+ICSE)", shortLabel: "11 Eng CB+IC", icon: "fa-user-graduate", color: "#059669" },
    { id: "11th-Hindi-CG-CBSE", label: "11th Hindi (CG+CBSE)", shortLabel: "11 Hin CG+CB", icon: "fa-user-graduate", color: "#16A34A" },
    { id: "11th-Eng-CG", label: "11th English (CG Board)", shortLabel: "11 Eng CG", icon: "fa-user-graduate", color: "#4ADE80" },
    { id: "10th-Eng-All", label: "10th English (CG+CBSE+ICSE)", shortLabel: "10 Eng All", icon: "fa-user-graduate", color: "#7C3AED" },
    { id: "10th-Hindi-CG-CBSE", label: "10th Hindi (CG+CBSE)", shortLabel: "10 Hin CG+CB", icon: "fa-user-graduate", color: "#A78BFA" },
    { id: "9th-Eng-All", label: "9th English (CG+CBSE+ICSE)", shortLabel: "9 Eng All", icon: "fa-user-graduate", color: "#D98D04" },
    { id: "9th-Hindi-CG-CBSE", label: "9th Hindi (CG+CBSE)", shortLabel: "9 Hin CG+CB", icon: "fa-user-graduate", color: "#F5AC10" },
    { id: "2nd-8th-All", label: "2nd-8th All Medium (CG+CBSE+ICSE)", shortLabel: "2-8 All", icon: "fa-child", color: "#DC2626" },
    // Entrance
    { id: "Navodaya", label: "Navodaya Entrance", shortLabel: "Navodaya", icon: "fa-award", color: "#0891B2" },
    { id: "Prayas", label: "Prayas Awasiya Vidyalaya", shortLabel: "Prayas", icon: "fa-award", color: "#0E7490" },
    // Competition
    { id: "JEE-NEET", label: "IIT-JEE & NEET (9th-12th)", shortLabel: "JEE+NEET", icon: "fa-flask", color: "#BE185D" },
  ];

  // ═══ EXAM & TEST MANAGEMENT STATES ═══
  const [examList, setExamList] = useState([]); // Firebase se exams
  const [examForm, setExamForm] = useState({}); // new/edit exam form
  const [showExamForm, setShowExamForm] = useState(false);
  const [examEditId, setExamEditId] = useState(null);
  const [examClassFilter, setExamClassFilter] = useState("all"); // CLASS_CATEGORIES id
  const [examSearch, setExamSearch] = useState("");
  const [examMarksModal, setExamMarksModal] = useState(null); // exam id for marks entry
  const [marksData, setMarksData] = useState({}); // {studentId: {subject1: marks, subject2: marks...}}
  const [marksSaving, setMarksSaving] = useState(false);
  const [examViewMode, setExamViewMode] = useState("list"); // list | results

  // ═══ STUDENT PERFORMANCE TRACKER STATES ═══
  const [perfStudent, setPerfStudent] = useState(null); // selected student for performance view
  const [perfClassFilter, setPerfClassFilter] = useState("all");
  const [perfSearch, setPerfSearch] = useState("");
  const [perfExamData, setPerfExamData] = useState([]); // selected student ke saare exam results
  const [perfLoading, setPerfLoading] = useState(false);
  const [perfQuizData, setPerfQuizData] = useState([]); // AI quiz history
  const [perfDoubtData, setPerfDoubtData] = useState([]); // AI doubt history
  const [perfTab, setPerfTab] = useState("overview"); // overview | quizzes | doubts

  // ═══ ONLINE TEST STATES ═══
  const [allDoubtsData, setAllDoubtsData] = useState([]); // saare students ke doubts
  const [allDoubtsLoading, setAllDoubtsLoading] = useState(false);
  const [otList, setOtList] = useState([]); // online tests from Firebase
  const [otForm, setOtForm] = useState({}); // test creation form
  const [showOtForm, setShowOtForm] = useState(false);
  const [otEditId, setOtEditId] = useState(null);
  const [otStep, setOtStep] = useState(1); // 1 = test info, 2 = questions
  const [otQuestions, setOtQuestions] = useState([]); // [{question, options:[], correctAnswer, explanation}]
  const [otQuestionMode, setOtQuestionMode] = useState("manual"); // manual | ai | pdf
  const [otAiGenerating, setOtAiGenerating] = useState(false);
  const [otAiForm, setOtAiForm] = useState({}); // {chapter, topic, difficulty, count}
  const [otPdfFile, setOtPdfFile] = useState(null);
  const [otPdfProcessing, setOtPdfProcessing] = useState(false);
  const [otClassFilter, setOtClassFilter] = useState("all");
  const [otView, setOtView] = useState("tests"); // "tests" | "results"
  const [otResults, setOtResults] = useState([]); // test_submissions
  const [otResultsLoading, setOtResultsLoading] = useState(false);
  const [otSelectedTest, setOtSelectedTest] = useState(null); // specific test ke results

  // Fees states
  const [feeClassFilter, setFeeClassFilter] = useState("all");
  const [feeSearch, setFeeSearch] = useState("");
  const [feePaymentForm, setFeePaymentForm] = useState({});
  const [showFeePayment, setShowFeePayment] = useState(null); // student id
  const [showReceipt, setShowReceipt] = useState(null); // student id for receipt modal

  // Form states
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState(null);
  const [form, setForm] = useState({});
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");

  // ═══ FORM DRAFT SYSTEM — Tab switch pe data preserve karne ke liye ═══
  // Har tab ka form data independently store hoga useRef me
  const formDraftsRef = useRef({});

  // Tab switch karte waqt current tab ka draft save karo, naye tab ka draft restore karo
  function switchTab(newTab) {
    // Current tab ka form state draft me save karo (sirf jab form open ho)
    if (showForm || Object.keys(form).length > 0) {
      formDraftsRef.current[tab] = {
        form: { ...form },
        showForm,
        editId,
      };
    }
    // Naye tab pe jao
    setTab(newTab);
    // Check karo naye tab ka koi draft hai ya nahi
    const draft = formDraftsRef.current[newTab];
    if (draft && draft.showForm) {
      // Purana draft restore karo — form data vapas aa jayega
      setForm(draft.form);
      setShowForm(draft.showForm);
      setEditId(draft.editId);
    } else {
      // Koi draft nahi — clean slate
      setShowForm(false);
      setEditId(null);
      setForm({});
    }
  }

  // Explicit reset — sirf save/cancel ke baad call hoga, tab switch pe NAHI
  function resetForm() {
    setShowForm(false);
    setEditId(null);
    setForm({});
    // Current tab ka draft bhi clear karo
    delete formDraftsRef.current[tab];
  }

  // Sub-tabs for reviews/enquiries
  const [reviewTab, setReviewTab] = useState("pending");
  const [enquiryTab, setEnquiryTab] = useState("active");
  const [heroBanner, setHeroBanner] = useState("");
  const [bannerSaving, setBannerSaving] = useState(false);

  // Auth
  useEffect(() => { const u = onAuthStateChanged(auth, u => { setUser(u); setLoading(false); }); return () => u(); }, []);
  const isAdmin = user && ADMIN_EMAILS.includes(user.email);

  // ═══ REALTIME LISTENERS ═══
  useEffect(() => {
    if (!isAdmin) return;
    const unsubs = [];
    unsubs.push(onSnapshot(collection(db, "courses"), s => {
      const arr = s.docs.map(d => ({ id: d.id, ...d.data() }));
      arr.sort((a, b) => (a.order || 99) - (b.order || 99));
      setCourses(arr);
    }));
    unsubs.push(onSnapshot(collection(db, "featured_toppers"), s => {
      const arr = s.docs.map(d => ({ id: d.id, ...d.data() }));
      arr.sort((a, b) => (b.year || "").localeCompare(a.year || ""));
      setToppers(arr);
    }));
    unsubs.push(onSnapshot(collection(db, "events"), s => {
      const arr = s.docs.map(d => ({ id: d.id, ...d.data() }));
      arr.sort((a, b) => (b.date || "").localeCompare(a.date || ""));
      setEvents(arr);
    }));
    unsubs.push(onSnapshot(collection(db, "reviews"), s => {
      const arr = s.docs.map(d => ({ id: d.id, ...d.data() }));
      setReviews(arr);
    }));
    unsubs.push(onSnapshot(collection(db, "enquiries"), s => {
      const arr = s.docs.map(d => ({ id: d.id, ...d.data() }));
      arr.sort((a, b) => {
        const ta = b.createdAt?.toDate?.() || new Date(0);
        const tb = a.createdAt?.toDate?.() || new Date(0);
        return ta - tb;
      });
      setEnquiries(arr);
    }));
    unsubs.push(onSnapshot(collection(db, "public"), s => {
      s.docs.forEach(d => {
        const data = d.data();
        if (data.heroBanner) setHeroBanner(data.heroBanner);
      });
    }));
    unsubs.push(onSnapshot(collection(db, "teachers"), s => {
      const arr = s.docs.map(d => ({ id: d.id, ...d.data() }));
      arr.sort((a, b) => (a.order || 99) - (b.order || 99));
      setTeachers(arr);
    }));
    unsubs.push(onSnapshot(collection(db, "students"), s => {
      const arr = s.docs.map(d => ({ id: d.id, ...d.data() }));
      arr.sort((a, b) => {
        const ta = b.createdAt?.toDate?.() || new Date(0);
        const tb = a.createdAt?.toDate?.() || new Date(0);
        return ta - tb;
      });
      setStudents(arr);
    }));
    unsubs.push(onSnapshot(collection(db, "study_materials"), s => {
      const arr = s.docs.map(d => ({ id: d.id, ...d.data() }));
      arr.sort((a, b) => {
        const ta = b.createdAt?.toDate?.() || new Date(0);
        const tb = a.createdAt?.toDate?.() || new Date(0);
        return ta - tb;
      });
      setMaterials(arr);
    }));
    unsubs.push(onSnapshot(collection(db, "holidays"), s => {
      const arr = s.docs.map(d => ({ id: d.id, ...d.data() }));
      arr.sort((a, b) => (a.date || "").localeCompare(b.date || ""));
      setHolidays(arr);
    }));
    unsubs.push(onSnapshot(collection(db, "scheduled_notifications"), s => {
      const arr = s.docs.map(d => ({ id: d.id, ...d.data() }));
      arr.sort((a, b) => (a.date || "").localeCompare(b.date || ""));
      setNotifications(arr);
    }));
    // Teacher notifications listener
    unsubs.push(onSnapshot(collection(db, "notifications"), s => {
      const arr = s.docs.map(d => ({ id: d.id, ...d.data() }));
      arr.sort((a, b) => (b.createdAt?.toDate?.() || new Date(0)) - (a.createdAt?.toDate?.() || new Date(0)));
      setTeacherNotifications(arr);
    }));
    // ═══ EXAMS LISTENER ═══
    unsubs.push(onSnapshot(collection(db, "exams"), s => {
      const arr = s.docs.map(d => ({ id: d.id, ...d.data() }));
      arr.sort((a, b) => (b.examDate || "").localeCompare(a.examDate || ""));
      setExamList(arr);
    }));
    // ═══ ONLINE TESTS LISTENER ═══
    unsubs.push(onSnapshot(collection(db, "online_test_results"), s => {
      setOtResults(s.docs.map(d => ({ id: d.id, ...d.data() })));
    }));
    unsubs.push(onSnapshot(collection(db, "online_tests"), s => {
      const arr = s.docs.map(d => ({ id: d.id, ...d.data() }));
      arr.sort((a, b) => (b.createdAt?.toDate?.() || new Date(0)) - (a.createdAt?.toDate?.() || new Date(0)));
      setOtList(arr);
    }));
    // ═══ LEAVE APPLICATIONS LISTENER — student/parent ═══
    unsubs.push(onSnapshot(collection(db, "leave_applications"), s => {
      const arr = s.docs.map(d => ({ id: d.id, ...d.data() }));
      // Teacher leaves alag, student/parent leaves alag
      const teacherLv = arr.filter(lv => lv.teacherId);
      const studentLv = arr.filter(lv => !lv.teacherId);
      teacherLv.sort((a, b) => (b.createdAt?.toDate?.() || 0) - (a.createdAt?.toDate?.() || 0));
      studentLv.sort((a, b) => (b.date || "").localeCompare(a.date || ""));
      setLeaveApplications(studentLv);
    // teacher leaves alag collection se aayenge
  }));
  // Teacher leaves — leave_requests collection
unsubs.push(onSnapshot(collection(db, "leave_requests"), s => {
  const arr = s.docs.map(d => ({ id: d.id, ...d.data() }));
  arr.sort((a, b) => (b.createdAt?.toDate?.() || 0) - (a.createdAt?.toDate?.() || 0));
  setTeacherLeaves(arr);
}));
    return () => unsubs.forEach(u => u());
  }, [isAdmin]);

  // ═══ ONLINE TEST CRUD FUNCTIONS ═══
  async function saveOnlineTest() {
    if (!otForm.title?.trim()) { showMsg("Test title required!"); return; }
    if (!otForm.subject?.trim()) { showMsg("Subject required!"); return; }
    if (!otForm.forClass) { showMsg("Class select karo!"); return; }
    if (otQuestions.length === 0) { showMsg("Kam se kam 1 question add karo!"); return; }
    setSaving(true);
    try {
      const data = {
        title: otForm.title,
        subject: otForm.subject,
        forClass: otForm.forClass,
        testType: otForm.testType || "practice",
        duration: Number(otForm.duration) || 30,
        totalQuestions: otQuestions.length,
        totalMarks: otQuestions.length,
        instructions: otForm.instructions || "",
        chapter: otForm.chapter || "",
        topic: otForm.topic || "",
        board: otForm.board || "",
        medium: otForm.medium || "",
        difficulty: otForm.difficulty || "medium",
        isActive: false, // Hamesha inactive se start — scheduled time pe auto-active hoga
        scheduledDate: otForm.scheduledDate || "",
        scheduledTime: otForm.scheduledTime || "",
        questions: otQuestions.map(q => ({
          question: q.question,
          options: q.options || ["", "", "", ""],
          correctAnswer: Number(q.correctAnswer) || 0,
          explanation: q.explanation || "",
        })),
      };
      if (otEditId) {
        await updateDoc(doc(db, "online_tests", otEditId), { ...data, updatedAt: serverTimestamp() });
        showMsg("Test updated!");
      } else {
        await addDoc(collection(db, "online_tests"), { ...data, createdAt: serverTimestamp(), createdBy: user?.email || "admin" });
        showMsg("Online Test created! Students ab Student App me ye test de sakte hain.");
      }
      setShowOtForm(false); setOtForm({}); setOtQuestions([]); setOtEditId(null); setOtStep(1);
    } catch (e) { showMsg("Error: " + e.message); }
    setSaving(false);
  }

  async function deleteOnlineTest(id) {
    if (!confirm("Delete this online test? Students ab ye test nahi de payenge.")) return;
    try {
      await deleteDoc(doc(db, "online_tests", id));
      // Delete all submissions
      const subSnap = await getDocs(query(collection(db, "test_submissions"), where("testId", "==", id)));
      for (const d of subSnap.docs) { await deleteDoc(doc(db, "test_submissions", d.id)); }
      showMsg("Online Test deleted!");
    } catch (e) { showMsg("Error: " + e.message); }
  }

  function toggleTestActive(id, currentStatus) {
    updateDoc(doc(db, "online_tests", id), { isActive: !currentStatus, updatedAt: serverTimestamp() })
      .then(() => showMsg(currentStatus ? "Test deactivated — students ko ab nahi dikhega" : "Test activated — students ab de sakte hain"))
      .catch(e => showMsg("Error: " + e.message));
  }

  // ═══ AI Question Generation (Gemini API) ═══
  async function generateAiQuestions() {
    if (!otAiForm.chapter?.trim()) { showMsg("Chapter/Topic zaruri hai!"); return; }
    setOtAiGenerating(true);
    try {
      const count = Number(otAiForm.count) || 10;
      const difficulty = otAiForm.difficulty || "medium";
      const subject = otForm.subject || "General";
      const board = otForm.board || "CG Board";
      const medium = otForm.medium || "Hindi";
      const classLevel = otForm.forClass ? (CLASS_CATEGORIES.find(c => c.id === otForm.forClass)?.label || otForm.forClass) : "12th";

      const prompt = `You are an expert ${subject} teacher for ${classLevel} (${board}, ${medium} medium) in India.
Generate exactly ${count} MCQ questions from chapter/topic: "${otAiForm.chapter}" ${otAiForm.topic ? `(specific topic: ${otAiForm.topic})` : ""}.
Difficulty: ${difficulty}.

IMPORTANT: Respond ONLY in valid JSON array format, no markdown, no backticks, no explanation.
Each question object must have:
- "question": the question text (in ${medium === "Hindi" ? "Hindi" : "English"})
- "options": array of exactly 4 options
- "correctAnswer": index of correct option (0, 1, 2, or 3)
- "explanation": brief explanation why the answer is correct (in ${medium === "Hindi" ? "Hindi" : "English"})

Example format:
[{"question":"What is...","options":["A","B","C","D"],"correctAnswer":0,"explanation":"Because..."}]`;

      const GEMINI_KEY = process.env.NEXT_PUBLIC_GEMINI_API_KEY || "AIzaSyCqy0iboM1-q0LSARp1NMvHnG_EvmL0ItA";
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_KEY}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: { temperature: 0.7, maxOutputTokens: 8192 },
          }),
        }
      );
      if (!res.ok) { const e = await res.text(); showMsg("Gemini Error: " + e.slice(0, 100)); setOtAiGenerating(false); return; }
      const data = await res.json();
      let text = data?.candidates?.[0]?.content?.parts?.[0]?.text || "";
      // Clean markdown fences
      text = text.replace(/```json\s*/gi, "").replace(/```\s*/gi, "").trim();
      const arrStart = text.indexOf("[");
      const arrEnd = text.lastIndexOf("]");
      if (arrStart === -1 || arrEnd === -1) {
        showMsg("AI ne valid JSON array nahi diya. Dobara try karo.");
        setOtAiGenerating(false);
        return;
      }
      text = text.slice(arrStart, arrEnd + 1);
      text = text.replace(/[\u0000-\u001F\u007F-\u009F]/g, " ");
      let questions;
      try {
        questions = JSON.parse(text);
      } catch (parseErr) {
        console.error("AI JSON parse error:", parseErr);
        showMsg("AI response parse nahi hua — dobara try karo ya questions kam karo.");
        setOtAiGenerating(false);
        return;
      }

      if (Array.isArray(questions) && questions.length > 0) {
        const formatted = questions.map(q => ({
          question: q.question || "",
          options: Array.isArray(q.options) ? q.options : ["", "", "", ""],
          correctAnswer: Number(q.correctAnswer) || 0,
          explanation: q.explanation || "",
        }));
        setOtQuestions(prev => [...prev, ...formatted]);
        showMsg(`${formatted.length} questions AI se generate ho gaye! Review karo.`);
      } else {
        showMsg("AI ne valid questions nahi diye. Dobara try karo.");
      }
    } catch (e) {
      console.error("AI generation error:", e);
      showMsg("AI Error: " + e.message + " — Check karo Gemini API kaam kar rahi hai.");
    }
    setOtAiGenerating(false);
  }

  // ═══ PDF Question Extraction (Gemini API) ═══
  async function extractQuestionsFromPdf() {
    if (!otPdfFile) { showMsg("Pehle PDF file select karo!"); return; }
    setOtPdfProcessing(true);
    try {
      // PDF ko base64 me convert karo
      const reader = new FileReader();
      reader.onload = async (e) => {
        const base64 = e.target.result.split(",")[1];
        const subject = otForm.subject || "General";
        const medium = otForm.medium || "Hindi";

        const prompt = `You are an expert question paper analyzer. I am giving you a PDF of a question paper / worksheet.
Analyze this PDF and extract ALL questions from it. Convert them into MCQ format.
If questions are already MCQ, extract them as-is. If questions are subjective, convert them to MCQ with 4 options.

IMPORTANT: Respond ONLY in valid JSON array format, no markdown, no backticks.
Each question object must have:
- "question": the question text (keep original language ${medium})
- "options": array of exactly 4 options
- "correctAnswer": index of correct option (0, 1, 2, or 3)
- "explanation": brief explanation

Example: [{"question":"...","options":["A","B","C","D"],"correctAnswer":0,"explanation":"..."}]`;

        const GEMINI_KEY = process.env.NEXT_PUBLIC_GEMINI_API_KEY || "AIzaSyCqy0iboM1-q0LSARp1NMvHnG_EvmL0ItA";
        const res = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_KEY}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              contents: [{
                parts: [
                  { inline_data: { mime_type: otPdfFile.type || "application/pdf", data: base64 } },
                  { text: prompt },
                ],
              }],
              generationConfig: { temperature: 0.4, maxOutputTokens: 8192 },
            }),
          }
        );
        if (!res.ok) { const e = await res.text(); showMsg("PDF Gemini Error: " + e.slice(0, 100)); setOtPdfProcessing(false); return; }
        const data = await res.json();
        let text = data?.candidates?.[0]?.content?.parts?.[0]?.text || "";
        // Aggressive cleaning — markdown, extra text sab hatao
        text = text.replace(/```json\s*/gi, "").replace(/```\s*/gi, "").trim();
        // Sirf JSON array part extract karo — [ se ] tak
        const arrStart = text.indexOf("[");
        const arrEnd = text.lastIndexOf("]");
        if (arrStart === -1 || arrEnd === -1) {
          showMsg("PDF se valid JSON nahi mila. Clear/text-based PDF use karo.");
          setOtPdfProcessing(false);
          return;
        }
        text = text.slice(arrStart, arrEnd + 1);
        // Unicode escape issues fix
        text = text.replace(/[\u0000-\u001F\u007F-\u009F]/g, " ");
        let questions;
        try {
          questions = JSON.parse(text);
        } catch (parseErr) {
          console.error("JSON parse error:", parseErr, "\nText:", text.slice(0, 200));
          showMsg("PDF ka response parse nahi hua. Gemini ne incomplete JSON diya — dobara try karo ya simpler PDF use karo.");
          setOtPdfProcessing(false);
          return;
        }

        if (Array.isArray(questions) && questions.length > 0) {
          const formatted = questions.map(q => ({
            question: q.question || "",
            options: Array.isArray(q.options) ? q.options : ["", "", "", ""],
            correctAnswer: Number(q.correctAnswer) || 0,
            explanation: q.explanation || "",
          }));
          setOtQuestions(prev => [...prev, ...formatted]);
          showMsg(`PDF se ${formatted.length} questions extract ho gaye! Review karo.`);
        } else {
          showMsg("PDF se questions extract nahi ho paye. Clear PDF upload karo.");
        }
        setOtPdfProcessing(false);
      };
      reader.readAsDataURL(otPdfFile);
    } catch (e) {
      showMsg("PDF Error: " + e.message);
      setOtPdfProcessing(false);
    }
  }

  // ═══ EXAM CRUD FUNCTIONS ═══
  async function saveExam() {
    if (!examForm.title?.trim()) { showMsg("Exam title required!"); return; }
    if (!examForm.examDate) { showMsg("Exam date required!"); return; }
    setSaving(true);
    try {
      const data = { ...examForm };
      // Subjects array banao
      if (!data.subjects || data.subjects.length === 0) {
        data.subjects = ["Physics", "Chemistry", "Maths/Bio", "Science", "English", "Social Study"].filter((_, i) => data[`sub${i+1}`]);
        if (data.subjects.length === 0) data.subjects = ["Physics", "Chemistry", "Maths/Bio"];
      }
      Object.keys(data).forEach(key => { if (data[key] === undefined) delete data[key]; });
      if (examEditId) {
        const { id, ...rest } = data;
        await updateDoc(doc(db, "exams", examEditId), { ...rest, updatedAt: serverTimestamp() });
        showMsg("Exam updated!");
      } else {
        await addDoc(collection(db, "exams"), { ...data, createdAt: serverTimestamp() });
        showMsg("Exam created!");
      }
      setShowExamForm(false); setExamForm({}); setExamEditId(null);
    } catch (e) { showMsg("Error: " + e.message); }
    setSaving(false);
  }

  async function deleteExam(id) {
    if (!confirm("Delete this exam and all its marks data?")) return;
    try {
      await deleteDoc(doc(db, "exams", id));
      // Delete all marks for this exam
      const marksSnap = await getDocs(query(collection(db, "exam_marks"), where("examId", "==", id)));
      for (const d of marksSnap.docs) { await deleteDoc(doc(db, "exam_marks", d.id)); }
      showMsg("Exam deleted!");
    } catch (e) { showMsg("Error: " + e.message); }
  }

  // ═══ MARKS ENTRY — Load existing marks for an exam ═══
  async function openMarksEntry(exam) {
    setExamMarksModal(exam);
    setMarksData({});
    try {
      const snap = await getDocs(query(collection(db, "exam_marks"), where("examId", "==", exam.id)));
      const existing = {};
      snap.docs.forEach(d => {
        const data = d.data();
        existing[data.studentId] = { ...data.marks, _docId: d.id };
      });
      setMarksData(existing);
    } catch (e) { console.error("Marks load error:", e); }
  }

  // ═══ MARKS SAVE — Ek student ke marks save karo ═══
  async function saveStudentMarks(examId, studentId, marks, examTitle) {
    setMarksSaving(true);
    try {
      const st = students.find(x => x.id === studentId);
      const existingDocId = marksData[studentId]?._docId;
      const marksCopy = { ...marks };
      delete marksCopy._docId;
      const data = {
        examId,
        studentId,
        studentName: st?.studentName || "",
        studentClass: st?.class || "",
        studentBoard: st?.board || "",
        studentMedium: st?.medium || "",
        marks: marksCopy,
        totalMarks: Object.values(marksCopy).reduce((s, v) => s + (Number(v) || 0), 0),
        examTitle: examTitle || "",
        updatedAt: serverTimestamp(),
      };
      if (existingDocId) {
        await updateDoc(doc(db, "exam_marks", existingDocId), data);
      } else {
        const newDoc = await addDoc(collection(db, "exam_marks"), { ...data, createdAt: serverTimestamp() });
        setMarksData(prev => ({ ...prev, [studentId]: { ...marksCopy, _docId: newDoc.id } }));
      }
      showMsg(`${st?.studentName} marks saved!`);
    } catch (e) { showMsg("Error: " + e.message); }
    setMarksSaving(false);
  }

  // ═══ PERFORMANCE — Load student ke saare exam results + AI data ═══
  async function loadStudentPerformance(student) {
    setPerfStudent(student);
    setPerfLoading(true);
    setPerfTab("overview");
    try {
      // Exam marks
      const snap = await getDocs(query(collection(db, "exam_marks"), where("studentId", "==", student.id)));
      const results = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      results.sort((a, b) => {
        const examA = examList.find(e => e.id === a.examId);
        const examB = examList.find(e => e.id === b.examId);
        return (examB?.examDate || "").localeCompare(examA?.examDate || "");
      });
      setPerfExamData(results);

      // AI Quiz history
      try {
        const quizSnap = await getDocs(query(collection(db, "quiz_history"), where("studentId", "==", student.id)));
        const quizResults = quizSnap.docs.map(d => ({ id: d.id, ...d.data() }));
        quizResults.sort((a, b) => (b.createdAt?.toDate?.() || new Date(0)) - (a.createdAt?.toDate?.() || new Date(0)));
        setPerfQuizData(quizResults);
      } catch (e) { console.error("Quiz history load error:", e); setPerfQuizData([]); }

      // AI Doubt history
      try {
        const doubtSnap = await getDocs(query(collection(db, "doubt_history"), where("studentId", "==", student.id)));
        const doubtResults = doubtSnap.docs.map(d => ({ id: d.id, ...d.data() }));
        doubtResults.sort((a, b) => (b.createdAt?.toDate?.() || new Date(0)) - (a.createdAt?.toDate?.() || new Date(0)));
        setPerfDoubtData(doubtResults);
      } catch (e) { console.error("Doubt history load error:", e); setPerfDoubtData([]); }

    } catch (e) { console.error("Performance load error:", e); setPerfExamData([]); }
    setPerfLoading(false);
  }

  // Individual person attendance calendar listener
  useEffect(() => {
    if (!isAdmin || !attSelectedPerson) return;
    const firstDay = `${personCalYear}-${String(personCalMonth + 1).padStart(2, "0")}-01`;
    const lastDay = `${personCalYear}-${String(personCalMonth + 1).padStart(2, "0")}-${new Date(personCalYear, personCalMonth + 1, 0).getDate()}`;
    const personKey = attSelectedPerson.type === "teacher" ? `teacher_${attSelectedPerson.id}` : attSelectedPerson.id;
    const q = query(collection(db, "attendance"), where("studentId", "==", personKey), where("date", ">=", firstDay), where("date", "<=", lastDay));
    const unsub = onSnapshot(q, (snap) => {
      setPersonAttData(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    return () => unsub();
  }, [isAdmin, attSelectedPerson, personCalMonth, personCalYear]);

  // Weekly/Monthly range attendance listener
  useEffect(() => {
    if (!isAdmin || attViewMode === "daily") { setAttRangeData([]); return; }
    let startDate, endDate;
    const d = new Date(attDate);
    if (attViewMode === "weekly") {
      const day = d.getDay() || 7;
      const mon = new Date(d); mon.setDate(d.getDate() - day + 1);
      const sun = new Date(mon); sun.setDate(mon.getDate() + 6);
      startDate = mon.toISOString().split("T")[0];
      endDate = sun.toISOString().split("T")[0];
    } else {
      startDate = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
      endDate = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate()}`;
    }
    const q = query(collection(db, "attendance"), where("date", ">=", startDate), where("date", "<=", endDate));
    const unsub = onSnapshot(q, (snap) => {
      setAttRangeData(snap.docs.map(d2 => ({ id: d2.id, ...d2.data() })));
    });
    return () => unsub();
  }, [isAdmin, attViewMode, attDate]);

  // Attendance listener (date-based)
  useEffect(() => {
    if (!isAdmin || !attDate) return;
    const q = query(collection(db, "attendance"), where("date", "==", attDate));
    const unsub = onSnapshot(q, (snap) => {
      const arr = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      arr.sort((a, b) => (b.timestamp || "").localeCompare(a.timestamp || ""));
      setAttendance(arr);
    });
    return () => unsub();
  }, [isAdmin, attDate]);

  // Multi-day attendance fetch (weekly/monthly)
  useEffect(() => {
    if (!isAdmin || attViewMode === "daily") { setMultiDayAtt([]); return; }
    let dates = [];
    if (attViewMode === "weekly") {
      dates = getWeekDates(attDate);
    } else if (attViewMode === "monthly") {
      const d = new Date(attDate);
      dates = getMonthDates(d.getFullYear(), d.getMonth());
    }
    if (dates.length === 0) return;
    setMultiDayLoading(true);
    const fetchMulti = async () => {
      try {
        const startDate = dates[0];
        const endDate = dates[dates.length - 1];
        const q = query(collection(db, "attendance"), where("date", ">=", startDate), where("date", "<=", endDate));
        const snap = await getDocs(q);
        const arr = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        setMultiDayAtt(arr);
      } catch (e) { console.error("Multi-day fetch error:", e); setMultiDayAtt([]); }
      setMultiDayLoading(false);
    };
    fetchMulti();
  }, [isAdmin, attViewMode, attDate]);

  // Per-student calendar fetch
  async function fetchStudentCalendar(student, year, month) {
    setCalendarStudent(student);
    setCalStudentMonth(month);
    setCalStudentYear(year);
    try {
      const startDate = `${year}-${String(month + 1).padStart(2, "0")}-01`;
      const daysInMonth = new Date(year, month + 1, 0).getDate();
      const endDate = `${year}-${String(month + 1).padStart(2, "0")}-${String(daysInMonth).padStart(2, "0")}`;
      const q = query(collection(db, "attendance"), where("date", ">=", startDate), where("date", "<=", endDate), where("studentId", "==", student.id));
      const snap = await getDocs(q);
      const arr = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setCalMonthAtt(arr);
    } catch (e) { console.error("Calendar fetch error:", e); setCalMonthAtt([]); }
  }

  function showMsg(t) { setMsg(t); setTimeout(() => setMsg(""), 3000); }

  // ═══ ATTENDANCE RECORDS — Weekly Data Fetch ═══
  function getArWeekDates(offset = 0) {
    const today = new Date();
    const d = new Date(today);
    d.setDate(d.getDate() + (offset * 7));
    const day = d.getDay();
    const mon = new Date(d);
    mon.setDate(d.getDate() - (day === 0 ? 6 : day - 1));
    const dates = [];
    for (let i = 0; i < 7; i++) {
      const nd = new Date(mon);
      nd.setDate(mon.getDate() + i);
      dates.push(nd.toISOString().split("T")[0]);
    }
    return dates;
  }

  function getArWeekLabel(offset = 0) {
    const dates = getArWeekDates(offset);
    const s = new Date(dates[0]);
    const e = new Date(dates[6]);
    return `${s.toLocaleDateString("en-IN", { day: "2-digit", month: "short" })} — ${e.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}`;
  }

  useEffect(() => {
    if (!isAdmin || tab !== "records") return;
    // Attendance record ke liye weekly data fetch
    if (recMainTab === "attendance") {
      const dates = getArWeekDates(recWeekOffset);
      const startDate = dates[0];
      const endDate = dates[6];
      const batchStart = `${recBatchYear}-04-01`;
      const batchEnd = `${recBatchYear + 1}-03-31`;
      if (endDate < batchStart || startDate > batchEnd) {
        setRecData([]);
        setRecLoading(false);
        return;
      }
      setRecLoading(true);
      const q = query(collection(db, "attendance"), where("date", ">=", startDate), where("date", "<=", endDate));
      const unsub = onSnapshot(q, (snap) => {
        setRecData(snap.docs.map(d => ({ id: d.id, ...d.data() })));
        setRecLoading(false);
      });
      return () => unsub();
    }
  }, [isAdmin, tab, recWeekOffset, recBatchYear, recMainTab]);

  // ═══ Attendance Records — Excel Export (A4 Structured) ═══
 function exportRecordsExcel() {
    const dates = getArWeekDates(recWeekOffset);
    const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    let personList = [];
    let sectionLabel = "";

    if (recMainTab === "teachers" || (recMainTab === "attendance" && recClassFilter === "all-teachers")) {
      personList = teachers.map(t => ({
        id: `teacher_${t.id}`,
        name: t.name,
        classLabel: "Teacher — " + (t.subject || ""),
        rfidCode: t.rfidCode || "",
        batchStart: t.cardValidFrom || "",
        batchEnd: t.cardValidTo || "",
        isExpired: t.cardValidTo ? new Date().toISOString().split("T")[0] > t.cardValidTo : false,
      }));
      sectionLabel = "Teachers";
    } else {
      const cat = CLASS_CATEGORIES.find(c => c.id === recClassFilter);
      sectionLabel = cat ? cat.label : "All Students";
      let stList = [...students];
      if (recClassFilter !== "all" && cat) {
        stList = filterByBatch(stList, cat.id);
      }
      personList = stList.map(st => ({
        id: st.id,
        name: st.studentName,
        classLabel: `${st.class || "N/A"} · ${st.medium || ""} · ${st.board || ""}`,
        rfidCode: st.rfidCode || "",
        batchStart: st.batchStartDate || "",
        batchEnd: st.batchEndDate || "",
        isExpired: st.batchEndDate ? new Date().toISOString().split("T")[0] > st.batchEndDate : false,
      }));
    }

    let csv = "";
    csv += `"PATEL INSTITUTE DONGARGAON (PID)"\n`;
    csv += `"Reg. No. 122201880553"\n`;
    csv += `"Batch / Session: ${recBatchYear}-${String(recBatchYear + 1).slice(2)}"\n`;
    csv += `"${recMainTab === "attendance" ? "ATTENDANCE" : recMainTab === "students" ? "STUDENT" : recMainTab === "teachers" ? "TEACHER" : "FEE"} RECORD — ${sectionLabel}"\n`;
    csv += `"Week: ${getArWeekLabel(recWeekOffset)}"\n`;
    csv += `"Generated: ${new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' })}"\n`;
    csv += `\n`;

    csv += `"Sr","Name","Class / Medium / Board","RFID","Batch Period",`;
    csv += dates.map(d => {
      const dt = new Date(d + "T00:00:00");
      return `"${String(dt.getDate()).padStart(2,'0')}/${String(dt.getMonth()+1).padStart(2,'0')} ${dayNames[dt.getDay()]}"`;
    }).join(",");
    csv += `,"Total P","Total A","Attendance %","Status"\n`;

    personList.forEach((p, idx) => {
      let totalP = 0, totalA = 0, totalWorking = 0;
      const row = dates.map(d => {
        const isHol = isHoliday(d);
        const isSun = new Date(d + "T00:00:00").getDay() === 0;
        if (isHol) return "H";
        if (isSun) return "S";
        totalWorking++;
        const dayAtt = recData.filter(a => a.studentId === p.id && a.date === d);
        const hasIn = dayAtt.some(a => a.type === "in");
        if (hasIn) { totalP++; return "P"; }
        const isFuture = d > new Date().toISOString().split("T")[0];
        if (!isFuture) { totalA++; return "A"; }
        return "-";
      });
      const pct = totalWorking > 0 ? Math.round((totalP / totalWorking) * 100) : 0;
      const batchLabel = p.batchStart && p.batchEnd ? `${p.batchStart} to ${p.batchEnd}` : "Not Set";
      const statusLabel = p.isExpired ? "EXPIRED" : "ACTIVE";
      csv += `${idx + 1},"${p.name}","${p.classLabel}","${p.rfidCode}","${batchLabel}",${row.map(r => `"${r}"`).join(",")},${totalP},${totalA},${pct}%,"${statusLabel}"\n`;
    });

    csv += `\n`;
    csv += `"Director Signature: _______________","","","Teacher Signature: _______________","","","","","","","","",""\n`;

    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `PID_Record_${sectionLabel.replace(/\s+/g, "_")}_Batch${recBatchYear}_Week_${getArWeekDates(recWeekOffset)[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    showMsg(`${sectionLabel} Record exported! Excel me open karke A4 print karo.`);
  }

  // ═══════════════════════════════════════════
  // COURSES CRUD
  // ═══════════════════════════════════════════
  async function seedCourses() {
    if (!confirm("This will add default courses to Firebase. Continue?")) return;
    setSaving(true);
    try {
      for (const [key, data] of Object.entries(DEFAULT_COURSES)) {
        await addDoc(collection(db, "courses"), { ...data, createdAt: serverTimestamp() });
      }
      showMsg("Default courses added to Firebase!");
    } catch (e) { showMsg("Error: " + e.message); }
    setSaving(false);
  }

  async function saveCourse() {
    if (!form.title?.trim()) { showMsg("Course title is required!"); return; }
    setSaving(true);
    try {
      const data = { ...form };
      // Parse subjects/features from text if needed
      if (typeof data.subjectsText === "string") {
        data.subjects = data.subjectsText.split(",").map(s => s.trim()).filter(Boolean);
      }
      delete data.subjectsText;
      if (typeof data.featuresText === "string") {
        data.features = data.featuresText.split("\n").map(s => s.trim()).filter(Boolean);
      }
      delete data.featuresText;
      // Remove any undefined values — Firestore rejects them
      Object.keys(data).forEach(key => { if (data[key] === undefined) delete data[key]; });
      if (editId) {
        const { id, ...rest } = data;
        await updateDoc(doc(db, "courses", editId), { ...rest, updatedAt: serverTimestamp() });
        showMsg("Course updated!");
      } else {
        await addDoc(collection(db, "courses"), { ...data, createdAt: serverTimestamp() });
        showMsg("Course added!");
      }
      resetForm();
    } catch (e) { showMsg("Error: " + e.message); }
    setSaving(false);
  }

  async function deleteCourse(id) {
    if (!confirm("Delete this course? This action cannot be undone.")) return;
    try { await deleteDoc(doc(db, "courses", id)); showMsg("Course deleted!"); } catch (e) { showMsg("Error!"); }
  }

  // Batch helpers
  function addBatch() {
    const batches = [...(form.batches || []), { medium: "", board: "", type: "", regular: "", crash: "" }];
    setForm({ ...form, batches });
  }
  function updateBatch(idx, field, val) {
    const batches = [...(form.batches || [])];
    batches[idx] = { ...batches[idx], [field]: val };
    setForm({ ...form, batches });
  }
  function removeBatch(idx) {
    const batches = (form.batches || []).filter((_, i) => i !== idx);
    setForm({ ...form, batches });
  }

  // Teacher helpers
  function addTeacher() {
    const teachers = [...(form.teachers || []), { name: "", subject: "", qual: "", exp: "", photo: "" }];
    setForm({ ...form, teachers });
  }
  function updateTeacher(idx, field, val) {
    const teachers = [...(form.teachers || [])];
    teachers[idx] = { ...teachers[idx], [field]: val };
    setForm({ ...form, teachers });
  }
  function removeTeacher(idx) {
    const teachers = (form.teachers || []).filter((_, i) => i !== idx);
    setForm({ ...form, teachers });
  }

  // Fee helpers
  function addFee() {
    const fees = [...(form.fees || []), { label: "", amount: "" }];
    setForm({ ...form, fees });
  }
  function updateFee(idx, field, val) {
    const fees = [...(form.fees || [])];
    fees[idx] = { ...fees[idx], [field]: val };
    setForm({ ...form, fees });
  }
  function removeFee(idx) {
    const fees = (form.fees || []).filter((_, i) => i !== idx);
    setForm({ ...form, fees });
  }

  // ═══════════════════════════════════════════
  // TOPPERS CRUD
  // ═══════════════════════════════════════════
  async function saveTopper() {
    if (!form.name?.trim()) { showMsg("Student name is required!"); return; }
    setSaving(true);
    try {
      const data = { ...form };
      Object.keys(data).forEach(key => { if (data[key] === undefined) delete data[key]; });
      if (editId) {
        const { id, ...rest } = data;
        await updateDoc(doc(db, "featured_toppers", editId), { ...rest, updatedAt: serverTimestamp() });
        showMsg("Topper updated!");
      } else {
        await addDoc(collection(db, "featured_toppers"), { ...data, createdAt: serverTimestamp() });
        showMsg("Topper added!");
      }
      resetForm();
    } catch (e) { showMsg("Error: " + e.message); }
    setSaving(false);
  }

  async function deleteTopper(id) {
    if (!confirm("Delete this topper?")) return;
    try { await deleteDoc(doc(db, "featured_toppers", id)); showMsg("Deleted!"); } catch (e) { showMsg("Error!"); }
  }

  // ═══════════════════════════════════════════
  // EVENTS CRUD
  // ═══════════════════════════════════════════
  async function saveEvent() {
    if (!form.title?.trim()) { showMsg("Event title is required!"); return; }
    setSaving(true);
    try {
      const data = { ...form };
      if (typeof data.galleryText === "string") { data.gallery = data.galleryText.split("\n").map(s => s.trim()).filter(Boolean); }
      delete data.galleryText;
      Object.keys(data).forEach(key => { if (data[key] === undefined) delete data[key]; });
      if (editId) {
        const { id, ...rest } = data;
        await updateDoc(doc(db, "events", editId), { ...rest, updatedAt: serverTimestamp() });
        showMsg("Event updated!");
      } else {
        await addDoc(collection(db, "events"), { ...data, createdAt: serverTimestamp() });
        showMsg("Event added!");
      }
      resetForm();
    } catch (e) { showMsg("Error: " + e.message); }
    setSaving(false);
  }

  async function deleteEvent(id) {
    if (!confirm("Delete this event?")) return;
    try { await deleteDoc(doc(db, "events", id)); showMsg("Deleted!"); } catch (e) { showMsg("Error!"); }
  }

  // ═══════════════════════════════════════════
  // REVIEWS CRUD
  // ═══════════════════════════════════════════
  async function approveReview(id) {
    try { await updateDoc(doc(db, "reviews", id), { approved: true }); showMsg("Review approved!"); } catch (e) { showMsg("Error!"); }
  }
  async function rejectReview(id) {
    if (!confirm("Reject and delete this review?")) return;
    try { await deleteDoc(doc(db, "reviews", id)); showMsg("Review rejected!"); } catch (e) { showMsg("Error!"); }
  }
  async function archiveReview(id) {
    try { await updateDoc(doc(db, "reviews", id), { archived: true }); showMsg("Review archived!"); } catch (e) { showMsg("Error!"); }
  }
  async function unarchiveReview(id) {
    try { await updateDoc(doc(db, "reviews", id), { archived: false }); showMsg("Review restored!"); } catch (e) { showMsg("Error!"); }
  }
  async function deleteReview(id) {
    if (!confirm("Permanently delete this review?")) return;
    try { await deleteDoc(doc(db, "reviews", id)); showMsg("Deleted!"); } catch (e) { showMsg("Error!"); }
  }

  // ═══════════════════════════════════════════
  // ENQUIRIES CRUD
  // ═══════════════════════════════════════════
  async function highlightEnquiry(id, current) {
    try { await updateDoc(doc(db, "enquiries", id), { highlighted: !current }); } catch (e) { showMsg("Error!"); }
  }
  async function archiveEnquiry(id) {
    try { await updateDoc(doc(db, "enquiries", id), { archived: true, archivedAt: serverTimestamp() }); showMsg("Enquiry archived!"); } catch (e) { showMsg("Error!"); }
  }
  async function unarchiveEnquiry(id) {
    try { await updateDoc(doc(db, "enquiries", id), { archived: false, archivedAt: null }); showMsg("Enquiry restored!"); } catch (e) { showMsg("Error!"); }
  }
  async function deleteEnquiry(id) {
    if (!confirm("Permanently delete this enquiry?")) return;
    try { await deleteDoc(doc(db, "enquiries", id)); showMsg("Deleted!"); } catch (e) { showMsg("Error!"); }
  }

  // ═══════════════════════════════════════════
  // HERO BANNER MANAGEMENT
  // ═══════════════════════════════════════════
  async function saveHeroBanner() {
    if (!heroBanner.trim()) { showMsg("Please enter a banner image URL!"); return; }
    setBannerSaving(true);
    try {
      await setDoc(doc(db, "public", "settings"), { heroBanner: heroBanner.trim() }, { merge: true });
      showMsg("Hero banner updated! It will show on the website now.");
    } catch (e) { showMsg("Error: " + e.message); }
    setBannerSaving(false);
  }

  // ═══════════════════════════════════════════
  // TEACHERS CRUD
  // ═══════════════════════════════════════════
  async function saveTeacher() {
    if (!form.name?.trim()) { showMsg("Teacher name is required!"); return; }
    setSaving(true);
    try {
      const data = { ...form };
      // RFID Normalization
      if (data.rfidCode) {
        data.rfidCode = data.rfidCode.toString().toUpperCase().replace(/\s+/g, "").trim();
        // Check duplicate RFID in teachers
        const rfidDupTeacher = teachers.find(t => t.id !== editId && t.rfidCode === data.rfidCode);
        if (rfidDupTeacher) { showMsg(`RFID "${data.rfidCode}" already assigned to teacher ${rfidDupTeacher.name}!`); setSaving(false); return; }
        // Check duplicate RFID in students too
        const rfidDupStudent = students.find(st => st.rfidCode === data.rfidCode);
        if (rfidDupStudent) { showMsg(`RFID "${data.rfidCode}" already assigned to student ${rfidDupStudent.studentName}! Teacher aur student ka RFID same nahi ho sakta.`); setSaving(false); return; }
      }
      Object.keys(data).forEach(key => { if (data[key] === undefined) delete data[key]; });
      if (editId) {
        const { id, ...rest } = data;
        await updateDoc(doc(db, "teachers", editId), { ...rest, updatedAt: serverTimestamp() });
        showMsg("Teacher updated!");
      } else {
        await addDoc(collection(db, "teachers"), { ...data, createdAt: serverTimestamp() });
        showMsg("Teacher added!");
      }
      resetForm();
    } catch (e) { showMsg("Error: " + e.message); }
    setSaving(false);
  }

  async function deleteTeacher(id) {
    if (!confirm("Delete this teacher?")) return;
    try { await deleteDoc(doc(db, "teachers", id)); showMsg("Teacher deleted!"); } catch (e) { showMsg("Error!"); }
  }

  async function seedTeachers() {
    if (!confirm("This will add all PID teachers to Firebase. Continue?")) return;
    setSaving(true);
    try {
      const defaultTeachers = [
        { name: "Mr. Temlal Patel", subject: "Physics", qualification: "BSc. Maths, MSc. Physics, B.Ed", experience: "15 years", classes: "Class 9, 11, 12", photo: "", isDirector: true, order: 1 },
        { name: "Mrs. Hemlata Patel", subject: "Mathematics & All Subjects", qualification: "BCA, MSc. Maths, D.El.Ed", experience: "10 years", classes: "Class 2-8, Navodaya, Prayas", photo: "", isDirector: true, order: 2 },
        { name: "Mr. Aman Sharma", subject: "Chemistry", qualification: "BSc. Maths, MSc. Chemistry, B.Ed", experience: "10 years", classes: "Class 11 & 12", photo: "", isDirector: false, order: 3 },
        { name: "Mr. Kamta Prashad Sen", subject: "Mathematics", qualification: "BSc. Maths, MSc. Maths, B.Ed", experience: "10 years", classes: "Class 10 & 12", photo: "", isDirector: false, order: 4 },
        { name: "Mr. Naresh Sahu", subject: "Biology", qualification: "BSc. Bio, MSc. Bio, B.Ed", experience: "8 years", classes: "Class 11 & 12", photo: "", isDirector: false, order: 5 },
        { name: "Mr. Kamlesh Rajput", subject: "Mathematics", qualification: "BSc. Maths, MSc. Maths", experience: "4 years", classes: "Class 9, 10, 11", photo: "", isDirector: false, order: 6 },
        { name: "Mr. Yuvraj Patel", subject: "Science", qualification: "BSc. Bio, MSc. Bio, B.Ed", experience: "2 years", classes: "Class 9 & 10", photo: "", isDirector: false, order: 7 },
      ];
      for (const t of defaultTeachers) {
        await addDoc(collection(db, "teachers"), { ...t, createdAt: serverTimestamp() });
      }
      showMsg("All teachers added to Firebase!");
    } catch (e) { showMsg("Error: " + e.message); }
    setSaving(false);
  }

  // ═══════════════════════════════════════════
  // STUDENTS CRUD (Admission Form)
  // ═══════════════════════════════════════════
  async function saveStudent() {
    if (!form.studentName?.trim()) { showMsg("Student name is required!"); return; }
    if (!form.studentEmail?.trim()) { showMsg("Student email is required!"); return; }
    if (!form.studentPhone?.trim()) { showMsg("Student phone is required!"); return; }
    setSaving(true);
    try {
      const data = { ...form };
      // ═══ RFID NORMALIZATION — always uppercase + trim + remove extra spaces ═══
      if (data.rfidCode) {
        data.rfidCode = data.rfidCode.toString().toUpperCase().replace(/\s+/g, "").trim();
      }
      // ═══ Normalize email ═══
      if (data.studentEmail) {
        data.studentEmail = data.studentEmail.trim().toLowerCase();
      }
      Object.keys(data).forEach(key => { if (data[key] === undefined) delete data[key]; });
      if (editId) {
        const { id, ...rest } = data;
        // ═══ Check RFID duplicate (exclude current student) ═══
        if (rest.rfidCode) {
          const rfidDup = students.find(s => s.id !== editId && s.rfidCode === rest.rfidCode);
          if (rfidDup) { showMsg(`RFID "${rest.rfidCode}" already assigned to ${rfidDup.studentName}!`); setSaving(false); return; }
        }
        await updateDoc(doc(db, "students", editId), { ...rest, updatedAt: serverTimestamp() });
        showMsg("Student updated!");
      } else {
        // Check duplicate email
        const existing = students.find(s => s.studentEmail?.toLowerCase() === data.studentEmail?.toLowerCase());
        if (existing) { showMsg("This email is already registered!"); setSaving(false); return; }
        // ═══ Check RFID duplicate ═══
        if (data.rfidCode) {
          const rfidDup = students.find(s => s.rfidCode === data.rfidCode);
          if (rfidDup) { showMsg(`RFID "${data.rfidCode}" already assigned to ${rfidDup.studentName}!`); setSaving(false); return; }
        }
        await addDoc(collection(db, "students"), { ...data, status: "active", createdAt: serverTimestamp() });
        showMsg("Student enrolled successfully!");
      }
      resetForm();
    } catch (e) { showMsg("Error: " + e.message); }
    setSaving(false);
  }

  async function deleteStudent(id) {
    if (!confirm("Delete this student permanently? This cannot be undone.")) return;
    try { await deleteDoc(doc(db, "students", id)); showMsg("Student removed!"); } catch (e) { showMsg("Error!"); }
  }

  async function toggleStudentStatus(id, current) {
    try {
      await updateDoc(doc(db, "students", id), { status: current === "active" ? "inactive" : "active" });
      showMsg(current === "active" ? "Student deactivated" : "Student activated");
    } catch (e) { showMsg("Error!"); }
  }

  // Generate admission form number
  function genFormNo() {
    const yr = new Date().getFullYear().toString().slice(-2);
    const num = String(students.length + 1).padStart(4, "0");
    return `PID/${yr}/${num}`;
  }

  // ═══════════════════════════════════════════
  // STUDY MATERIALS CRUD
  // ═══════════════════════════════════════════
  async function saveMaterial() {
    if (!form.title?.trim()) { showMsg("Title is required!"); return; }
    if (!form.courseId) { showMsg("Please select a course!"); return; }
    if (!form.subject?.trim()) { showMsg("Subject is required!"); return; }
    if (!form.materialType) { showMsg("Select material type!"); return; }
    setSaving(true);
    try {
      const data = { ...form };
      Object.keys(data).forEach(key => { if (data[key] === undefined) delete data[key]; });
      // Get course title for display
      const linkedCourse = courses.find(c => c.classId === data.courseId || c.id === data.courseId);
      if (linkedCourse) data.courseTitle = linkedCourse.title || "";
      if (editId) {
        const { id, ...rest } = data;
        await updateDoc(doc(db, "study_materials", editId), { ...rest, updatedAt: serverTimestamp() });
        showMsg("Material updated!");
      } else {
        await addDoc(collection(db, "study_materials"), { ...data, createdAt: serverTimestamp() });
        showMsg("Material added!");
      }
      resetForm();
    } catch (e) { showMsg("Error: " + e.message); }
    setSaving(false);
  }

  async function deleteMaterial(id) {
    if (!confirm("Delete this study material?")) return;
    try { await deleteDoc(doc(db, "study_materials", id)); showMsg("Material deleted!"); } catch (e) { showMsg("Error!"); }
  }

  const materialTypes = [
    { value: "notes", label: "Notes / Chapter Summary", icon: "fa-file-alt", color: "#1349A8" },
    { value: "dpp", label: "DPP (Daily Practice Paper)", icon: "fa-tasks", color: "#D98D04" },
    { value: "lecture", label: "Video Lecture", icon: "fa-video", color: "#DC2626" },
    { value: "pyq", label: "Previous Year Questions", icon: "fa-history", color: "#7C3AED" },
    { value: "pdf", label: "PDF / Study Material", icon: "fa-file-pdf", color: "#059669" },
    { value: "assignment", label: "Assignment / Homework", icon: "fa-pen", color: "#0891B2" },
  ];

  function getMaterialIcon(type) {
    const mt = materialTypes.find(m => m.value === type);
    return mt || { icon: "fa-file", color: "#6B7F99", label: type };
  }

  // ═══════════════════════════════════════════
  // HOLIDAYS CRUD
  // ═══════════════════════════════════════════
  async function saveHoliday() {
    if (!holidayForm.title?.trim()) { showMsg("Holiday title is required!"); return; }
    setSaving(true);
    try {
      const data = { ...holidayForm };
      Object.keys(data).forEach(key => { if (data[key] === undefined) delete data[key]; });

      // ═══ Multiple days support ═══
      if (holidayForm.dateFrom && holidayForm.dateTo && holidayForm.dateFrom !== holidayForm.dateTo) {
        // Multiple days — har din ke liye alag holiday entry banao
        const start = new Date(holidayForm.dateFrom);
        const end = new Date(holidayForm.dateTo);
        if (end < start) { showMsg("End date start date se pehle nahi ho sakti!"); setSaving(false); return; }
        let count = 0;
        const current = new Date(start);
        while (current <= end) {
          const dateStr = current.toISOString().split("T")[0];
          const { dateFrom, dateTo, editId: eid, ...rest } = data;
          await addDoc(collection(db, "holidays"), { ...rest, date: dateStr, createdAt: serverTimestamp() });
          count++;
          current.setDate(current.getDate() + 1);
        }
        showMsg(`${count} din ki chhuttiyan add ho gayin! (${holidayForm.dateFrom} → ${holidayForm.dateTo})`);
      } else {
        // Single day
        const singleDate = holidayForm.date || holidayForm.dateFrom || "";
        if (!singleDate) { showMsg("Date is required!"); setSaving(false); return; }
        const { dateFrom, dateTo, ...cleanData } = data;
        cleanData.date = singleDate;
        if (holidayForm.editId) {
          const { editId: eid, ...rest } = cleanData;
          await updateDoc(doc(db, "holidays", eid), { ...rest, updatedAt: serverTimestamp() });
          showMsg("Holiday updated!");
        } else {
          await addDoc(collection(db, "holidays"), { ...cleanData, createdAt: serverTimestamp() });
          showMsg("Holiday added!");
        }
      }
      setShowHolidayForm(false); setHolidayForm({});
    } catch (e) { showMsg("Error: " + e.message); }
    setSaving(false);
  }
  async function deleteHoliday(id) {
    if (!confirm("Delete this holiday?")) return;
    try { await deleteDoc(doc(db, "holidays", id)); showMsg("Holiday deleted!"); } catch (e) { showMsg("Error!"); }
  }

  // ═══════════════════════════════════════════
  // SCHEDULED NOTIFICATIONS CRUD
  // ═══════════════════════════════════════════
  async function saveNotification() {
    if (!notifForm.date) { showMsg("Date is required!"); return; }
    if (!notifForm.message?.trim()) { showMsg("Message is required!"); return; }
    setSaving(true);
    try {
      const data = { ...notifForm };
      Object.keys(data).forEach(key => { if (data[key] === undefined) delete data[key]; });
      if (notifForm.editId) {
        const { editId: eid, ...rest } = data;
        await updateDoc(doc(db, "scheduled_notifications", eid), { ...rest, updatedAt: serverTimestamp() });
        // Agar teacher target hai to notifications collection bhi update karo
        if (rest.sendToTeachers && rest.teacherNotifDocId) {
          await updateDoc(doc(db, "notifications", rest.teacherNotifDocId), {
            message: rest.message, type: rest.notifType || "general", scheduledDate: rest.date, scheduledTime: rest.time || "",
            forTeacher: rest.teacherTarget || "all", targetType: "teacher", updatedAt: serverTimestamp(),
          });
        }
        showMsg("Notification updated!");
      } else {
        if (data.target === "teachers_all") {
          // Sirf teachers ko — notifications collection me save karo
          await addDoc(collection(db, "notifications"), {
            message: data.message,
            type: data.notifType || "general",
            scheduledDate: data.date,
            scheduledTime: data.time || "",
            forTeacher: "all",
            targetType: "teacher",
            sentBy: "Admin",
            createdAt: serverTimestamp(),
          });
          showMsg("Notification sabhi Teachers ko bhej diya!");
        } else {
          // Students/Parents ke liye — scheduled_notifications me save karo
          const newDoc = await addDoc(collection(db, "scheduled_notifications"), { ...data, createdAt: serverTimestamp() });
          if (data.sendToTeachers) {
            const teacherNotifDoc = await addDoc(collection(db, "notifications"), {
              message: data.message,
              type: data.notifType || "general",
              scheduledDate: data.date,
              scheduledTime: data.time || "",
              forTeacher: data.teacherTarget || "all",
              targetType: "teacher",
              sentBy: "Admin",
              createdAt: serverTimestamp(),
            });
            await updateDoc(doc(db, "scheduled_notifications", newDoc.id), { teacherNotifDocId: teacherNotifDoc.id });
          }
          showMsg("Notification scheduled!" + (data.sendToTeachers ? " Teachers ko bhi bheja gaya." : ""));
        }
      }
      setShowNotifForm(false); setNotifForm({});
    } catch (e) { showMsg("Error: " + e.message); }
    setSaving(false);
  }
  async function deleteNotification(id) {
    if (!confirm("Delete this notification?")) return;
    try { await deleteDoc(doc(db, "scheduled_notifications", id)); showMsg("Notification deleted!"); } catch (e) { showMsg("Error!"); }
  }

  async function deleteTeacherNotification(id) {
    if (!confirm("Is teacher notification ko delete karo?")) return;
    try { await deleteDoc(doc(db, "notifications", id)); showMsg("Teacher notification deleted!"); } catch (e) { showMsg("Error!"); }
  }

  async function saveTeacherNotification() {
    if (!notifForm.message?.trim()) { showMsg("Message required hai!"); return; }
    setSaving(true);
    try {
      if (notifForm.editTeacherId) {
        await updateDoc(doc(db, "notifications", notifForm.editTeacherId), {
          message: notifForm.message,
          type: notifForm.notifType || "general",
          scheduledDate: notifForm.date || "",
          scheduledTime: notifForm.time || "",
          forTeacher: notifForm.teacherTarget || "all",
          updatedAt: serverTimestamp(),
        });
        showMsg("Teacher notification updated!");
      }
      setShowNotifForm(false); setNotifForm({});
    } catch (e) { showMsg("Error: " + e.message); }
    setSaving(false);
  }

  // ═══════════════════════════════════════════
  // MANUAL ATTENDANCE
  // ═══════════════════════════════════════════
  async function markManualAttendance(student, type) {
    try {
      const today = new Date().toISOString().split("T")[0];
      const record = {
        rfidCode: student.rfidCode || "MANUAL",
        type: type,
        studentId: student.id,
        studentName: student.studentName,
        studentClass: student.class || student.presentClass || "",
        studentPhoto: student.photo || "",
        batchValid: true,
        batchExpired: false,
        deviceId: "manual-admin",
        date: attDate || today,
        timestamp: new Date().toISOString(),
        manual: true,
        markedBy: user?.email || "admin",
        createdAt: serverTimestamp(),
      };
      await addDoc(collection(db, "attendance"), record);
      showMsg(`${student.studentName} marked as ${type === "in" ? "Present (IN)" : type === "out" ? "Present (OUT)" : "Absent"}`);
      setManualAttModal(null);
    } catch (e) { showMsg("Error: " + e.message); }
  }

  // Mark absent for student (with reason)
  async function markAbsent(student, reason = "") {
    try {
      const today = attDate || new Date().toISOString().split("T")[0];
      const record = {
        rfidCode: student.rfidCode || "MANUAL",
        type: "absent",
        studentId: student.id,
        studentName: student.studentName,
        studentClass: student.class || student.presentClass || "",
        studentPhoto: student.photo || "",
        batchValid: true,
        deviceId: "manual-admin",
        date: today,
        timestamp: new Date().toISOString(),
        manual: true,
        absentReason: reason || "",
        markedBy: user?.email || "admin",
        createdAt: serverTimestamp(),
      };
      await addDoc(collection(db, "attendance"), record);
      showMsg(`${student.studentName} marked Absent${reason ? " — " + reason : ""}`);
    } catch (e) { showMsg("Error: " + e.message); }
  }

  // ═══════════════════════════════════════════
  // FEE PAYMENT CRUD
  // ═══════════════════════════════════════════
  async function addFeePayment(studentId) {
    if (!feePaymentForm.amount || Number(feePaymentForm.amount) <= 0) { showMsg("Enter valid amount!"); return; }
    setSaving(true);
    try {
      const st = students.find(x => x.id === studentId);
      const paymentData = {
        studentId,
        studentName: st?.studentName || "",
        studentClass: st?.class || "",
        amount: Number(feePaymentForm.amount),
        paymentMode: feePaymentForm.paymentMode || "cash",
        date: feePaymentForm.date || new Date().toISOString().split("T")[0],
        note: feePaymentForm.note || "",
        receivedBy: user?.email || "admin",
        createdAt: serverTimestamp(),
      };
      await addDoc(collection(db, "fee_payments"), paymentData);
      // Update student's paid amount
      const prevPaid = Number(st?.enrollmentFeePaid || 0);
      await updateDoc(doc(db, "students", studentId), {
        enrollmentFeePaid: String(prevPaid + Number(feePaymentForm.amount)),
        updatedAt: serverTimestamp(),
      });
      showMsg(`₹${feePaymentForm.amount} payment recorded for ${st?.studentName}`);
      setShowFeePayment(null); setFeePaymentForm({});
    } catch (e) { showMsg("Error: " + e.message); }
    setSaving(false);
  }

  // Helper: check if a date is a holiday
  // Check if date is holiday (optionally for a specific student)
  function isHoliday(dateStr, student) {
    return holidays.some(h => {
      if (h.date !== dateStr) return false;
      // If holiday is for all students OR no holidayFor set
      if (!h.holidayFor || h.holidayFor === "all") return true;
      // If holiday is for specific classes & student is provided
      if (h.holidayFor === "specific" && student && h.holidayClasses?.length > 0) {
        return h.holidayClasses.some(batchVal => {
          const batch = BATCH_OPTIONS.find(b => b.value === batchVal);
          if (!batch) return false;
          if (batch.class === "JEE-NEET") return ["9th", "10th", "11th", "12th"].includes(student.class);
          const classMatch = student.class === batch.class || student.presentClass === batch.class;
          const mediumMatch = batch.medium === "All" || !student.medium || student.medium === batch.medium;
          const boardMatch = !batch.boards || batch.boards.length === 0 || !student.board || batch.boards.includes(student.board);
          return classMatch && mediumMatch && boardMatch;
        });
      }
      // If specific but no student provided, still show as holiday in general calendar
      if (h.holidayFor === "specific") return false;
      return true;
    });
  }

  // Helper: get week dates
  function getWeekDates(dateStr) {
    const d = new Date(dateStr);
    const day = d.getDay();
    const start = new Date(d);
    start.setDate(d.getDate() - (day === 0 ? 6 : day - 1));
    const dates = [];
    for (let i = 0; i < 7; i++) {
      const nd = new Date(start);
      nd.setDate(start.getDate() + i);
      dates.push(nd.toISOString().split("T")[0]);
    }
    return dates;
  }

  // Helper: get month dates
  function getMonthDates(year, month) {
    const dates = [];
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    for (let i = 1; i <= daysInMonth; i++) {
      dates.push(`${year}-${String(month + 1).padStart(2, "0")}-${String(i).padStart(2, "0")}`);
    }
    return dates;
  }

  // ═══════════════════════════════════════════
  // EXCEL EXPORT (Attendance)
  // ═══════════════════════════════════════════
  function exportAttendanceExcel(mode) {
    let dates = [];
    let attData = [];
    if (mode === "daily") {
      dates = [attDate];
      attData = attendance;
    } else if (mode === "weekly") {
      dates = getWeekDates(attDate);
      attData = multiDayAtt;
    } else {
      const d = new Date(attDate);
      dates = getMonthDates(d.getFullYear(), d.getMonth());
      attData = multiDayAtt;
    }

    let stList = students.filter(x => x.status === "active");
    if (attClassFilter !== "all") stList = filterByBatch(stList, attClassFilter);

    // Build CSV
    const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    let csv = "";

    if (mode === "daily") {
      csv = "Sr,Student Name,Class,RFID,Check-IN,Check-OUT,Status\n";
      stList.forEach((st, idx) => {
        const stAtt = attData.filter(a => a.studentId === st.id);
        const checkIn = stAtt.find(a => a.type === "in");
        const checkOut = stAtt.find(a => a.type === "out");
        const isHol = isHoliday(attDate);
        const status = isHol ? "Holiday" : checkIn ? "Present" : stAtt.find(a => a.type === "absent") ? "Absent" : "—";
        const inTime = checkIn ? new Date(checkIn.timestamp).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" }) : "—";
        const outTime = checkOut ? new Date(checkOut.timestamp).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" }) : "—";
        csv += `${idx + 1},"${st.studentName}",${st.class || ""},${st.rfidCode || ""},${inTime},${outTime},${status}\n`;
      });
    } else {
      // Weekly / Monthly — dates as columns
      csv = "Sr,Student Name,Class," + dates.map(d => { const dt = new Date(d + "T00:00:00"); return `${String(dt.getDate()).padStart(2,"0")}/${String(dt.getMonth()+1).padStart(2,"0")} ${dayNames[dt.getDay()]}`; }).join(",") + ",Total P,Total A\n";
      stList.forEach((st, idx) => {
        let totalP = 0, totalA = 0;
        const row = dates.map(d => {
          const isHol = isHoliday(d);
          if (isHol) return "H";
          const dayAtt = attData.filter(a => a.studentId === st.id && a.date === d);
          const hasIn = dayAtt.some(a => a.type === "in");
          const hasAbsent = dayAtt.some(a => a.type === "absent");
          if (hasIn) { totalP++; return "P"; }
          if (hasAbsent) { totalA++; return "A"; }
          // If date is in the past and no record = absent
          if (d < new Date().toISOString().split("T")[0]) { totalA++; return "A"; }
          return "—";
        });
        csv += `${idx + 1},"${st.studentName}",${st.class || ""},${row.join(",")},${totalP},${totalA}\n`;
      });
    }

    // Download CSV
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `PID_Attendance_${mode}_${attDate}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    showMsg(`${mode.charAt(0).toUpperCase() + mode.slice(1)} attendance exported!`);
  }

  // ═══════════════════════════════════════════
  // STYLES
  // ═══════════════════════════════════════════
  const s = {
    page: { fontFamily: "'DM Sans',sans-serif", background: "#F0F4FA", minHeight: "100vh" },
    sidebar: { width: 230, background: "#0C1F36", color: "#fff", position: "fixed", top: 0, left: 0, overflowY: "auto", height: "100vh", bottom: 0, padding: "20px 0", overflowY: "auto", zIndex: 100, transition: "transform .3s" },
    main: { marginLeft: 230, padding: "24px", minHeight: "100vh" },
    tabBtn: (active) => ({ width: "100%", padding: "11px 20px", border: "none", background: active ? "rgba(255,255,255,.1)" : "transparent", color: active ? "#fff" : "#9FB8CF", fontSize: ".82rem", fontWeight: active ? 700 : 500, cursor: "pointer", textAlign: "left", display: "flex", alignItems: "center", gap: 10, borderLeft: active ? "3px solid #F5AC10" : "3px solid transparent", transition: "all .15s" }),
    card: { background: "#fff", borderRadius: 12, border: "1px solid #D4DEF0", padding: 20, marginBottom: 16 },
    input: { width: "100%", border: "1.5px solid #C0D0E8", borderRadius: 8, padding: "9px 12px", fontSize: ".85rem", outline: "none", fontFamily: "'DM Sans',sans-serif", marginBottom: 10, transition: "border .2s" },
    label: { display: "block", fontSize: ".78rem", fontWeight: 600, color: "#1C2E44", marginBottom: 3 },
    btnP: { padding: "9px 18px", borderRadius: 8, border: "none", background: "linear-gradient(135deg,#1349A8,#2A6FE0)", color: "#fff", fontSize: ".82rem", fontWeight: 700, cursor: "pointer" },
    btnD: { padding: "7px 14px", borderRadius: 8, border: "1px solid #FCA5A5", background: "#FEF2F2", color: "#DC2626", fontSize: ".76rem", fontWeight: 600, cursor: "pointer" },
    btnG: { padding: "7px 14px", borderRadius: 8, border: "1px solid #86EFAC", background: "#F0FDF4", color: "#16A34A", fontSize: ".76rem", fontWeight: 600, cursor: "pointer" },
    btnO: { padding: "7px 14px", borderRadius: 8, border: "1px solid #FDE68A", background: "#FFFBEB", color: "#92400E", fontSize: ".76rem", fontWeight: 600, cursor: "pointer" },
    btnGray: { padding: "7px 14px", borderRadius: 8, border: "1px solid #D4DEF0", background: "#F8FAFD", color: "#4A5E78", fontSize: ".76rem", fontWeight: 600, cursor: "pointer" },
    badge: (c, bg) => ({ display: "inline-block", padding: "3px 10px", borderRadius: 99, fontSize: ".7rem", fontWeight: 700, color: c, background: bg }),
    stat: { background: "#fff", borderRadius: 12, border: "1px solid #D4DEF0", padding: 18, textAlign: "center" },
    sectionTitle: { fontSize: ".9rem", fontWeight: 700, color: "#0B1826", marginBottom: 12, display: "flex", alignItems: "center", gap: 8 },
  };

  // ═══ LOGIN SCREEN ═══
  if (loading) return <div style={{ ...s.page, display: "flex", alignItems: "center", justifyContent: "center", height: "100vh" }}><div style={{ textAlign: "center" }}><i className="fas fa-spinner fa-spin" style={{ fontSize: "2rem", color: "#1349A8", marginBottom: 12 }} /><p style={{ color: "#6B7F99" }}>Loading...</p></div></div>;

  if (!user) return (
    <div style={{ ...s.page, display: "flex", alignItems: "center", justifyContent: "center", height: "100vh" }}>
      <div style={{ background: "#fff", borderRadius: 16, padding: 40, textAlign: "center", boxShadow: "0 4px 24px rgba(0,0,0,.08)", maxWidth: 400, border: "1px solid #D4DEF0" }}>
        <img src="/pid_logo.png" alt="PID" style={{ width: 60, height: 60, borderRadius: 12, margin: "0 auto 16px" }} />
        <h2 style={{ fontFamily: "'Plus Jakarta Sans',sans-serif", fontSize: "1.3rem", fontWeight: 800, marginBottom: 6 }}>Admin Panel</h2>
        <p style={{ color: "#6B7F99", fontSize: ".86rem", marginBottom: 24 }}>Patel Institute Dongargaon</p>
        <button onClick={() => signInWithPopup(auth, googleProvider)} style={{ ...s.btnP, padding: "12px 28px", fontSize: ".88rem", display: "flex", alignItems: "center", gap: 8, margin: "0 auto" }}>
          <i className="fab fa-google" /> Login with Google
        </button>
      </div>
    </div>
  );

  if (!isAdmin) return (
    <div style={{ ...s.page, display: "flex", alignItems: "center", justifyContent: "center", height: "100vh" }}>
      <div style={{ background: "#fff", borderRadius: 16, padding: 40, textAlign: "center", boxShadow: "0 4px 24px rgba(0,0,0,.08)", maxWidth: 420, border: "1px solid #D4DEF0" }}>
        <div style={{ width: 60, height: 60, borderRadius: "50%", background: "#FEF2F2", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px" }}><i className="fas fa-lock" style={{ color: "#DC2626", fontSize: "1.3rem" }} /></div>
        <h2 style={{ fontSize: "1.2rem", fontWeight: 700, marginBottom: 6 }}>Access Denied</h2>
        <p style={{ color: "#6B7F99", fontSize: ".86rem", marginBottom: 8 }}>Your email <strong>{user.email}</strong> is not authorized.</p>
        <p style={{ color: "#6B7F99", fontSize: ".78rem", marginBottom: 20 }}>Contact the institute director to get admin access.</p>
        <Link href="/" style={{ ...s.btnP, textDecoration: "none", display: "inline-block" }}>Go to Website</Link>
      </div>
    </div>
  );

  // ═══════════════════════════════════════════
  // ADMIN DASHBOARD LAYOUT
  // ═══════════════════════════════════════════
  const tabs = [
    { id: "dashboard", icon: "fa-th-large", label: "Dashboard" },
    { id: "courses", icon: "fa-book", label: "Courses & Batches" },
    { id: "toppers", icon: "fa-trophy", label: "Featured Toppers" },
    { id: "events", icon: "fa-calendar-alt", label: "Events" },
    { id: "teachers", icon: "fa-chalkboard-teacher", label: "Teachers" },
    { id: "reviews", icon: "fa-star", label: "Reviews" },
    { id: "enquiries", icon: "fa-envelope", label: "Enquiries" },
    { id: "students", icon: "fa-user-graduate", label: "Students" },
    { id: "materials", icon: "fa-folder-open", label: "Study Materials" },
    { id: "attendance", icon: "fa-id-card-alt", label: "Attendance" },
    { id: "records", icon: "fa-archive", label: "Records" },
    { id: "holidays", icon: "fa-calendar-check", label: "Holidays & Schedule" },
    { id: "exams", icon: "fa-file-alt", label: "Exams & Tests" },
    { id: "performance", icon: "fa-chart-line", label: "Performance" },
    { id: "online_tests", icon: "fa-laptop", label: "Online Tests" },
    { id: "ai_doubts", icon: "fa-brain", label: "AI Doubt Insights" },
    { id: "fees", icon: "fa-rupee-sign", label: "Fee Management" },
    { id: "settings", icon: "fa-cog", label: "Website Settings" },
    { id: "leave_alerts", icon: "fa-calendar-times", label: "Leave Alerts" },
    { id: "ranks", icon: "fa-medal", label: "Student Rankings" },
  ];

  const pendingReviews = reviews.filter(r => !r.approved);
  const approvedReviews = reviews.filter(r => r.approved && !r.archived);
  const archivedReviews = reviews.filter(r => r.archived);
  const activeEnquiries = enquiries.filter(e => !e.archived);
  const archivedEnquiries = enquiries.filter(e => e.archived);

  return (
    <div style={s.page}>
      {/* ═══ SIDEBAR ═══ */}
      <div style={s.sidebar}>
        <div style={{ padding: "0 20px 20px", borderBottom: "1px solid rgba(255,255,255,.1)", marginBottom: 12 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <img src="/pid_logo.png" alt="PID" style={{ width: 32, height: 32, borderRadius: 6 }} />
            <div><div style={{ fontSize: ".85rem", fontWeight: 700 }}>PID Admin</div><div style={{ fontSize: ".62rem", color: "#607888" }}>Control Panel</div></div>
          </div>
        </div>
        {tabs.map(t => (
          <button key={t.id} onClick={() => { switchTab(t.id); }} style={s.tabBtn(tab === t.id)}>
            <i className={`fas ${t.icon}`} style={{ width: 16, fontSize: ".8rem" }} />{t.label}
            {t.id === "reviews" && pendingReviews.length > 0 && <span style={{ marginLeft: "auto", background: "#DC2626", color: "#fff", fontSize: ".6rem", padding: "2px 6px", borderRadius: 99 }}>{pendingReviews.length}</span>}
            {t.id === "enquiries" && activeEnquiries.length > 0 && <span style={{ marginLeft: "auto", background: "#1349A8", color: "#fff", fontSize: ".6rem", padding: "2px 6px", borderRadius: 99 }}>{activeEnquiries.length}</span>}
            {t.id === "students" && students.length > 0 && <span style={{ marginLeft: "auto", background: "#059669", color: "#fff", fontSize: ".6rem", padding: "2px 6px", borderRadius: 99 }}>{students.length}</span>}
            {t.id === "materials" && materials.length > 0 && <span style={{ marginLeft: "auto", background: "#0891B2", color: "#fff", fontSize: ".6rem", padding: "2px 6px", borderRadius: 99 }}>{materials.length}</span>}
            {t.id === "attendance" && attendance.length > 0 && <span style={{ marginLeft: "auto", background: "#E11D48", color: "#fff", fontSize: ".6rem", padding: "2px 6px", borderRadius: 99 }}>{attendance.length}</span>}
            {t.id === "leave_alerts" && (() => {
              const today = new Date().toISOString().split("T")[0];
              const todayTeacherLeaves = teacherLeaves.filter(lv => lv.fromDate <= today && (lv.toDate || lv.fromDate) >= today).length;
              const todayStudentLeaves = leaveApplications.filter(lv => lv.date === today).length;
              const total = todayTeacherLeaves + todayStudentLeaves;
              return total > 0 ? <span style={{ marginLeft: "auto", background: "#D97706", color: "#fff", fontSize: ".6rem", padding: "2px 6px", borderRadius: 99 }}>{total}</span> : null;
            })()}
          </button>
        ))}
        <div style={{ padding: "16px 20px", marginTop: 16, borderTop: "1px solid rgba(255,255,255,.1)" }}>
          <div style={{ fontSize: ".72rem", color: "#607888", marginBottom: 6 }}>{user.email}</div>
          <Link href="/" style={{ fontSize: ".78rem", color: "#9FB8CF", display: "flex", alignItems: "center", gap: 6 }}><i className="fas fa-external-link-alt" />View Website</Link>
        </div>
      </div>

      {/* ═══ MAIN CONTENT ═══ */}
      <div style={s.main}>
        {/* Toast */}
        {msg && <div style={{ position: "fixed", top: 20, right: 20, background: "#166534", color: "#fff", padding: "12px 20px", borderRadius: 10, fontSize: ".84rem", fontWeight: 600, zIndex: 9999, boxShadow: "0 4px 16px rgba(0,0,0,.15)", display: "flex", alignItems: "center", gap: 8 }}><i className="fas fa-check-circle" />{msg}</div>}

        {/* ═══════════ DASHBOARD ═══════════ */}
        {tab === "dashboard" && <>
          <h2 style={{ fontSize: "1.3rem", fontWeight: 800, marginBottom: 20 }}>Dashboard</h2>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(180px,1fr))", gap: 16, marginBottom: 24 }}>
            {[
              { n: courses.length, l: "Courses", c: "#1349A8", icon: "fa-book", tab: "courses" },
              { n: toppers.length, l: "Featured Toppers", c: "#D98D04", icon: "fa-trophy", tab: "toppers" },
              { n: events.length, l: "Events", c: "#7C3AED", icon: "fa-calendar", tab: "events" },
              { n: teachers.length, l: "Teachers", c: "#059669", icon: "fa-chalkboard-teacher", tab: "teachers" },
              { n: pendingReviews.length, l: "Pending Reviews", c: "#DC2626", icon: "fa-clock", tab: "reviews" },
              { n: approvedReviews.length, l: "Approved Reviews", c: "#16A34A", icon: "fa-check", tab: "reviews" },
              { n: activeEnquiries.length, l: "Active Enquiries", c: "#1349A8", icon: "fa-envelope", tab: "enquiries" },
              { n: students.filter(s => s.status === "active").length, l: "Active Students", c: "#059669", icon: "fa-user-graduate", tab: "students" },
              { n: materials.length, l: "Study Materials", c: "#0891B2", icon: "fa-folder-open", tab: "materials" },
              { n: attendance.length, l: "Today's Attendance", c: "#E11D48", icon: "fa-id-card-alt", tab: "attendance" },
              { n: examList.length, l: "Exams & Tests", c: "#1349A8", icon: "fa-file-alt", tab: "exams" },
              { n: otList.length, l: "Online Tests", c: "#7C3AED", icon: "fa-laptop", tab: "online_tests" },
              { n: holidays.length, l: "Holidays", c: "#D98D04", icon: "fa-calendar-check", tab: "holidays" },
              { n: (() => { const tf = students.reduce((s, st) => s + Number(st.totalFee || 0), 0); const tp = students.reduce((s, st) => s + Number(st.inst1Amount || 0) + Number(st.inst2Amount || 0) + Number(st.inst3Amount || 0), 0); return `₹${Math.max(0, tf - tp).toLocaleString("en-IN")}`; })(), l: "Fee Due", c: "#DC2626", icon: "fa-rupee-sign", tab: "fees" },
            ].map((x, i) => (
              <div key={i} style={{ ...s.stat, cursor: "pointer", transition: "all .2s", border: "1px solid #E8EFF8" }} onClick={() => { switchTab(x.tab); }}>
                <i className={`fas ${x.icon}`} style={{ fontSize: "1.4rem", color: x.c, marginBottom: 8 }} />
                <div style={{ fontSize: "1.8rem", fontWeight: 800, color: x.c }}>{x.n}</div>
                <div style={{ fontSize: ".78rem", color: "#6B7F99" }}>{x.l}</div>
              </div>
            ))}
          </div>

          {/* Recent Enquiries */}
          <div style={s.card}>
            <h3 style={{ fontSize: ".95rem", fontWeight: 700, marginBottom: 12 }}>Recent Enquiries</h3>
            {activeEnquiries.slice(0, 5).map(e => (
              <div key={e.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 0", borderBottom: "1px solid #E8EFF8", fontSize: ".82rem" }}>
                <div><strong>{e.name}</strong> — {e.class || "N/A"} — <a href={`tel:${e.phone}`} style={{ color: "#1349A8" }}>{e.phone}</a></div>
                <span style={{ fontSize: ".72rem", color: "#6B7F99" }}>{timeAgo(e.createdAt)}</span>
              </div>
            ))}
            {activeEnquiries.length === 0 && <p style={{ color: "#6B7F99", fontSize: ".84rem" }}>No active enquiries.</p>}
          </div>

          {/* ═══ COMMON AI DOUBTS — Saare students ke common questions ═══ */}
          <div style={{ ...s.card, marginTop: 16, cursor: "pointer" }} onClick={() => switchTab("ai_doubts")}>
            <h3 style={{ fontSize: ".95rem", fontWeight: 700, marginBottom: 8 }}><i className="fas fa-brain" style={{ marginRight: 8, color: "#7C3AED" }} />AI Doubt Insights — Common Questions</h3>
            <p style={{ fontSize: ".78rem", color: "#6B7F99" }}>Click to see what students are commonly asking AI → Subject-wise analysis</p>
          </div>
        </>}

        {/* ═══════════ COURSES TAB ═══════════ */}
        {tab === "courses" && <>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20, flexWrap: "wrap", gap: 10 }}>
            <h2 style={{ fontSize: "1.3rem", fontWeight: 800 }}>Courses & Batches</h2>
            <div style={{ display: "flex", gap: 8 }}>
              {courses.length === 0 && <button onClick={seedCourses} disabled={saving} style={s.btnO}><i className="fas fa-database" style={{ marginRight: 6 }} />Load Default Courses</button>}
              <button onClick={() => { setShowForm(true); setEditId(null); setForm({ batches: [], teachers: [], fees: [], subjects: [], features: [], order: courses.length + 1 }); }} style={s.btnP}><i className="fas fa-plus" style={{ marginRight: 6 }} />Add Course</button>
            </div>
          </div>

          {/* Course Form */}
          {showForm && <div style={{ ...s.card, border: "2px solid #1349A8" }}>
            <h3 style={{ fontSize: "1rem", fontWeight: 700, marginBottom: 16, color: "#1349A8" }}><i className="fas fa-edit" style={{ marginRight: 8 }} />{editId ? "Edit" : "Add"} Course</h3>

            {/* Basic Info */}
            <div style={s.sectionTitle}><i className="fas fa-info-circle" style={{ color: "#1349A8" }} /> Basic Information</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
              <div><label style={s.label}>Class ID *</label><input style={s.input} placeholder="e.g. 12, 11, 10, 9, 2-8" value={form.classId || ""} onChange={e => setForm({ ...form, classId: e.target.value })} /></div>
              <div><label style={s.label}>Title *</label><input style={s.input} placeholder="e.g. Class 12th" value={form.title || ""} onChange={e => setForm({ ...form, title: e.target.value })} /></div>
              <div><label style={s.label}>Tag</label><input style={s.input} placeholder="e.g. Board + Entrance" value={form.tag || ""} onChange={e => setForm({ ...form, tag: e.target.value })} /></div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <div><label style={s.label}>Description</label><textarea style={{ ...s.input, height: 70, resize: "none" }} placeholder="Course description..." value={form.desc || ""} onChange={e => setForm({ ...form, desc: e.target.value })} /></div>
              <div>
                <div><label style={s.label}>Duration</label><input style={s.input} placeholder="e.g. 10 April to 20 January" value={form.duration || ""} onChange={e => setForm({ ...form, duration: e.target.value })} /></div>
                <div><label style={s.label}>Display Order</label><input style={s.input} type="number" placeholder="1" value={form.order || ""} onChange={e => setForm({ ...form, order: parseInt(e.target.value) || 0 })} /></div>
              </div>
            </div>

            {/* Subjects */}
            <div style={{ ...s.sectionTitle, marginTop: 16 }}><i className="fas fa-book" style={{ color: "#16A34A" }} /> Subjects (comma separated)</div>
            <input style={s.input} placeholder="Physics, Chemistry, Maths, Biology" value={form.subjectsText !== undefined ? form.subjectsText : (form.subjects || []).join(", ")} onChange={e => setForm({ ...form, subjectsText: e.target.value })} />

            {/* Batches */}
            <div style={{ ...s.sectionTitle, marginTop: 16 }}><i className="fas fa-layer-group" style={{ color: "#D98D04" }} /> Batches <button onClick={addBatch} style={{ ...s.btnG, padding: "4px 10px", fontSize: ".72rem", marginLeft: 8 }}><i className="fas fa-plus" /> Add</button></div>
            {(form.batches || []).map((b, i) => (
              <div key={i} style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr 1fr auto", gap: 8, marginBottom: 8, alignItems: "end" }}>
                <div><label style={s.label}>Medium</label><input style={{ ...s.input, marginBottom: 0 }} placeholder="English" value={b.medium} onChange={e => updateBatch(i, "medium", e.target.value)} /></div>
                <div><label style={s.label}>Board</label><input style={{ ...s.input, marginBottom: 0 }} placeholder="CG Board" value={b.board} onChange={e => updateBatch(i, "board", e.target.value)} /></div>
                <div><label style={s.label}>Type</label><input style={{ ...s.input, marginBottom: 0 }} placeholder="Regular + Crash" value={b.type} onChange={e => updateBatch(i, "type", e.target.value)} /></div>
                <div><label style={s.label}>Regular</label><input style={{ ...s.input, marginBottom: 0 }} placeholder="3 hrs/day" value={b.regular} onChange={e => updateBatch(i, "regular", e.target.value)} /></div>
                <div><label style={s.label}>Crash</label><input style={{ ...s.input, marginBottom: 0 }} placeholder="4 hrs/day" value={b.crash} onChange={e => updateBatch(i, "crash", e.target.value)} /></div>
                <button onClick={() => removeBatch(i)} style={{ ...s.btnD, padding: "8px", marginBottom: 0 }}><i className="fas fa-trash" /></button>
              </div>
            ))}

            {/* Teachers */}
            <div style={{ ...s.sectionTitle, marginTop: 16 }}><i className="fas fa-chalkboard-teacher" style={{ color: "#7C3AED" }} /> Teachers <button onClick={addTeacher} style={{ ...s.btnG, padding: "4px 10px", fontSize: ".72rem", marginLeft: 8 }}><i className="fas fa-plus" /> Add</button></div>
            {(form.teachers || []).map((t, i) => (
              <div key={i} style={{ background: "#F8FAFD", borderRadius: 10, padding: 12, marginBottom: 10, border: "1px solid #E8EFF8" }}>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr auto", gap: 8, alignItems: "end" }}>
                  <div><label style={s.label}>Name</label><input style={{ ...s.input, marginBottom: 0 }} placeholder="Mr. Temlal Patel" value={t.name} onChange={e => updateTeacher(i, "name", e.target.value)} /></div>
                  <div><label style={s.label}>Subject</label><input style={{ ...s.input, marginBottom: 0 }} placeholder="Physics" value={t.subject} onChange={e => updateTeacher(i, "subject", e.target.value)} /></div>
                  <div><label style={s.label}>Qualification</label><input style={{ ...s.input, marginBottom: 0 }} placeholder="BSc, MSc, B.Ed" value={t.qual} onChange={e => updateTeacher(i, "qual", e.target.value)} /></div>
                  <div><label style={s.label}>Experience</label><input style={{ ...s.input, marginBottom: 0 }} placeholder="15 years" value={t.exp} onChange={e => updateTeacher(i, "exp", e.target.value)} /></div>
                  <button onClick={() => removeTeacher(i)} style={{ ...s.btnD, padding: "8px", marginBottom: 0 }}><i className="fas fa-trash" /></button>
                </div>
                <div style={{ marginTop: 8 }}>
                  <ImageUploader
                    folder="teachers"
                    label="Teacher Photo"
                    currentUrl={t.photo || ""}
                    onUpload={(url) => updateTeacher(i, "photo", url)}
                    onRemove={() => updateTeacher(i, "photo", "")}
                  />
                </div>
              </div>
            ))}

            {/* Fees */}
            <div style={{ ...s.sectionTitle, marginTop: 16 }}><i className="fas fa-rupee-sign" style={{ color: "#D98D04" }} /> Fee Structure <button onClick={addFee} style={{ ...s.btnG, padding: "4px 10px", fontSize: ".72rem", marginLeft: 8 }}><i className="fas fa-plus" /> Add</button></div>
            {(form.fees || []).map((f, i) => (
              <div key={i} style={{ display: "grid", gridTemplateColumns: "2fr 1fr auto", gap: 8, marginBottom: 8, alignItems: "end" }}>
                <div><label style={s.label}>Label</label><input style={{ ...s.input, marginBottom: 0 }} placeholder="12th English Medium (CG)" value={f.label} onChange={e => updateFee(i, "label", e.target.value)} /></div>
                <div><label style={s.label}>Amount</label><input style={{ ...s.input, marginBottom: 0 }} placeholder="₹6,000/subject" value={f.amount} onChange={e => updateFee(i, "amount", e.target.value)} /></div>
                <button onClick={() => removeFee(i)} style={{ ...s.btnD, padding: "8px", marginBottom: 0 }}><i className="fas fa-trash" /></button>
              </div>
            ))}

            {/* Features */}
            <div style={{ ...s.sectionTitle, marginTop: 16 }}><i className="fas fa-star" style={{ color: "#F59E0B" }} /> Features (one per line)</div>
            <textarea style={{ ...s.input, height: 100, resize: "vertical" }} placeholder={"Board exam focused preparation\nJEE/NEET parallel coaching\nMock tests & DPP"} value={form.featuresText !== undefined ? form.featuresText : (form.features || []).join("\n")} onChange={e => setForm({ ...form, featuresText: e.target.value })} />

            {/* Actions */}
            <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
              <button onClick={saveCourse} disabled={saving} style={s.btnP}>{saving ? "Saving..." : editId ? "Update Course" : "Add Course"}</button>
              <button onClick={resetForm} style={s.btnGray}>Cancel</button>
            </div>
          </div>}

          {/* Courses List */}
          {courses.length > 0 ? (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(320px,1fr))", gap: 14 }}>
              {courses.map(c => (
                <div key={c.id} style={{ ...s.card, marginBottom: 0 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
                    <div>
                      <div style={{ fontWeight: 800, fontSize: "1rem", color: "#0B1826" }}>{c.title}</div>
                      <span style={s.badge("#1349A8", "#EFF6FF")}>{c.tag}</span>
                    </div>
                    <span style={{ fontSize: ".72rem", color: "#6B7F99", background: "#F0F4FA", padding: "2px 8px", borderRadius: 6 }}>ID: {c.classId}</span>
                  </div>
                  <p style={{ fontSize: ".8rem", color: "#4A5E78", marginBottom: 10, lineHeight: 1.5 }}>{(c.desc || "").slice(0, 100)}...</p>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 10 }}>
                    <span style={s.badge("#92400E", "#FEF3C7")}>{(c.batches || []).length} Batches</span>
                    <span style={s.badge("#166534", "#F0FDF4")}>{(c.teachers || []).length} Teachers</span>
                    <span style={s.badge("#7C3AED", "#FAF5FF")}>{(c.fees || []).length} Fee Plans</span>
                  </div>
                  <div style={{ display: "flex", gap: 6 }}>
                    <button onClick={() => {
                      setShowForm(true); setEditId(c.id);
                      setForm({ ...c, subjectsText: undefined, featuresText: undefined });
                    }} style={{ ...s.btnP, padding: "6px 12px", fontSize: ".74rem" }}><i className="fas fa-edit" style={{ marginRight: 4 }} />Edit</button>
                    <button onClick={() => deleteCourse(c.id)} style={{ ...s.btnD, padding: "6px 12px" }}><i className="fas fa-trash" /></button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div style={{ ...s.card, textAlign: "center", padding: 40 }}>
              <i className="fas fa-book" style={{ fontSize: "2.5rem", color: "#B0C4DC", marginBottom: 12 }} />
              <h3 style={{ fontSize: "1rem", fontWeight: 700, color: "#4A5E78", marginBottom: 6 }}>No Courses Yet</h3>
              <p style={{ fontSize: ".84rem", color: "#6B7F99", marginBottom: 16 }}>Click "Load Default Courses" to seed the database with your course data, or add courses manually.</p>
            </div>
          )}
        </>}

        {/* ═══════════ TOPPERS TAB ═══════════ */}
        {tab === "toppers" && <>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
            <h2 style={{ fontSize: "1.3rem", fontWeight: 800 }}>Featured Toppers</h2>
            <button onClick={() => { setShowForm(true); setEditId(null); setForm({}); }} style={s.btnP}><i className="fas fa-plus" style={{ marginRight: 6 }} />Add Topper</button>
          </div>

          {showForm && <div style={s.card}>
            <h3 style={{ fontSize: ".95rem", fontWeight: 700, marginBottom: 14 }}>{editId ? "Edit" : "Add"} Topper</h3>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <div><label style={s.label}>Student Name *</label><input style={s.input} placeholder="Name" value={form.name || ""} onChange={e => setForm({ ...form, name: e.target.value })} /></div>
              <div><label style={s.label}>Percentage *</label><input style={s.input} placeholder="96.5%" value={form.percentage || ""} onChange={e => setForm({ ...form, percentage: e.target.value })} /></div>
              <div><label style={s.label}>Class</label><input style={s.input} placeholder="Class 12th" value={form.class || ""} onChange={e => setForm({ ...form, class: e.target.value })} /></div>
              <div><label style={s.label}>Board</label><input style={s.input} placeholder="CG Board" value={form.board || ""} onChange={e => setForm({ ...form, board: e.target.value })} /></div>
              <div><label style={s.label}>Year</label><input style={s.input} placeholder="2024-25" value={form.year || ""} onChange={e => setForm({ ...form, year: e.target.value })} /></div>
              <div><label style={s.label}>Rank / Position</label><input style={s.input} placeholder="District Rank 1" value={form.rank || ""} onChange={e => setForm({ ...form, rank: e.target.value })} /></div>
              <div><label style={s.label}>Medium</label><input style={s.input} placeholder="Hindi / English" value={form.medium || ""} onChange={e => setForm({ ...form, medium: e.target.value })} /></div>
              <div><label style={s.label}>Category</label><input style={s.input} placeholder="12th Hindi CG / 10th English CBSE" value={form.category || ""} onChange={e => setForm({ ...form, category: e.target.value })} /></div>
            </div>
            <ImageUploader
              folder="toppers"
              label="Topper Photo"
              currentUrl={form.photo || ""}
              onUpload={(url) => setForm({ ...form, photo: url })}
              onRemove={() => setForm({ ...form, photo: "" })}
            />
            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={saveTopper} disabled={saving} style={s.btnP}>{saving ? "Saving..." : editId ? "Update" : "Add"} Topper</button>
              <button onClick={resetForm} style={s.btnGray}>Cancel</button>
            </div>
          </div>}

          {toppers.length > 0 ? <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(250px,1fr))", gap: 14 }}>
            {toppers.map(t => (
              <div key={t.id} style={{ ...s.card, marginBottom: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
                  <div style={{ width: 52, height: 52, borderRadius: "50%", background: "linear-gradient(135deg,#1349A8,#2A6FE0)", display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden", flexShrink: 0 }}>
                    {t.photo ? <img src={t.photo} alt={t.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : <span style={{ color: "#fff", fontWeight: 700, fontSize: "1.1rem" }}>{t.name?.charAt(0)}</span>}
                  </div>
                  <div><div style={{ fontWeight: 700, fontSize: ".88rem" }}>{t.name}</div><div style={{ fontSize: ".72rem", color: "#6B7F99" }}>{t.class} · {t.board} · {t.year}</div></div>
                </div>
                <div style={{ display: "flex", gap: 6, marginBottom: 10 }}>
                  {t.percentage && <span style={s.badge("#92400E", "#FEF3C7")}>{t.percentage}</span>}
                  {t.rank && <span style={s.badge("#1349A8", "#EFF6FF")}>{t.rank}</span>}
                  {t.medium && <span style={s.badge("#166534", "#F0FDF4")}>{t.medium}</span>}
                </div>
                <div style={{ display: "flex", gap: 6 }}>
                  <button onClick={() => { setShowForm(true); setEditId(t.id); setForm({ ...t }); }} style={{ ...s.btnP, padding: "6px 12px", fontSize: ".74rem" }}><i className="fas fa-edit" /></button>
                  <button onClick={() => deleteTopper(t.id)} style={{ ...s.btnD, padding: "6px 12px" }}><i className="fas fa-trash" /></button>
                </div>
              </div>
            ))}
          </div> : <p style={{ color: "#6B7F99" }}>No featured toppers yet. Click "Add Topper" to add.</p>}
        </>}

        {/* ═══════════ EVENTS TAB ═══════════ */}
        {tab === "events" && <>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
            <h2 style={{ fontSize: "1.3rem", fontWeight: 800 }}>Events & Seminars</h2>
            <button onClick={() => { setShowForm(true); setEditId(null); setForm({}); }} style={s.btnP}><i className="fas fa-plus" style={{ marginRight: 6 }} />Add Event</button>
          </div>

          {showForm && <div style={s.card}>
            <h3 style={{ fontSize: ".95rem", fontWeight: 700, marginBottom: 14 }}>{editId ? "Edit" : "Add"} Event</h3>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <div><label style={s.label}>Event Title *</label><input style={s.input} placeholder="Career Guidance Seminar" value={form.title || ""} onChange={e => setForm({ ...form, title: e.target.value })} /></div>
              <div><label style={s.label}>Type</label><input style={s.input} placeholder="seminar / workshop / function" value={form.type || ""} onChange={e => setForm({ ...form, type: e.target.value })} /></div>
              <div><label style={s.label}>Date</label><input style={s.input} type="date" value={form.date || ""} onChange={e => setForm({ ...form, date: e.target.value })} /></div>
              <div><label style={s.label}>Date</label><input style={s.input} type="date" value={form.date || ""} onChange={e => setForm({ ...form, date: e.target.value })} /></div>
            </div>
            <ImageUploader
              folder="events"
              label="Cover Image"
              currentUrl={form.image || ""}
              onUpload={(url) => setForm({ ...form, image: url })}
              onRemove={() => setForm({ ...form, image: "" })}
            />
            <div><label style={s.label}>Description</label><textarea style={{ ...s.input, height: 80, resize: "none" }} placeholder="Event details..." value={form.description || ""} onChange={e => setForm({ ...form, description: e.target.value })} /></div>
            <div><label style={s.label}>Video URL (YouTube embed)</label><input style={s.input} placeholder="https://youtube.com/embed/..." value={form.videoUrl || ""} onChange={e => setForm({ ...form, videoUrl: e.target.value })} /></div>
            {/* Gallery — Multiple images */}
            <div style={{ marginBottom: 12 }}>
              <label style={s.label}>Gallery Images</label>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 8 }}>
                {(form.gallery || []).map((img, i) => (
                  <div key={i} style={{ position: "relative", width: 70, height: 70, borderRadius: 8, overflow: "hidden", border: "1px solid #D4DEF0" }}>
                    <img src={img} alt={`Gallery ${i+1}`} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                    <button onClick={() => { const g = [...(form.gallery || [])]; g.splice(i, 1); setForm({ ...form, gallery: g }); }} style={{ position: "absolute", top: 2, right: 2, width: 18, height: 18, borderRadius: "50%", border: "none", background: "rgba(220,38,38,.85)", color: "#fff", fontSize: ".55rem", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}><i className="fas fa-times"/></button>
                  </div>
                ))}
              </div>
              <ImageUploader
                folder="events"
                label=""
                currentUrl=""
                onUpload={(url) => setForm({ ...form, gallery: [...(form.gallery || []), url] })}
                onRemove={() => {}}
              />
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={saveEvent} disabled={saving} style={s.btnP}>{saving ? "Saving..." : editId ? "Update" : "Add"} Event</button>
              <button onClick={resetForm} style={s.btnGray}>Cancel</button>
            </div>
          </div>}

          {events.length > 0 ? <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(300px,1fr))", gap: 14 }}>
            {events.map(ev => (
              <div key={ev.id} style={{ ...s.card, marginBottom: 0 }}>
                {ev.image && <img src={ev.image} alt={ev.title} style={{ width: "100%", height: 140, objectFit: "cover", borderRadius: 8, marginBottom: 10 }} />}
                <div style={{ display: "flex", gap: 6, marginBottom: 6 }}>
                  {ev.type && <span style={s.badge("#1349A8", "#EFF6FF")}>{ev.type}</span>}
                  {ev.date && <span style={{ fontSize: ".72rem", color: "#6B7F99" }}>{ev.date}</span>}
                </div>
                <div style={{ fontWeight: 700, fontSize: ".9rem", marginBottom: 4 }}>{ev.title}</div>
                {ev.description && <p style={{ fontSize: ".78rem", color: "#4A5E78", marginBottom: 10 }}>{ev.description.slice(0, 100)}...</p>}
                <div style={{ display: "flex", gap: 6 }}>
                  <button onClick={() => { setShowForm(true); setEditId(ev.id); setForm({ ...ev, galleryText: (ev.gallery || []).join("\n") }); }} style={{ ...s.btnP, padding: "6px 12px", fontSize: ".74rem" }}><i className="fas fa-edit" /></button>
                  <button onClick={() => deleteEvent(ev.id)} style={{ ...s.btnD, padding: "6px 12px" }}><i className="fas fa-trash" /></button>
                </div>
              </div>
            ))}
          </div> : <p style={{ color: "#6B7F99" }}>No events yet. Click "Add Event" to add.</p>}
        </>}

        {/* ═══════════ REVIEWS TAB ═══════════ */}
        {tab === "reviews" && <>
          <h2 style={{ fontSize: "1.3rem", fontWeight: 800, marginBottom: 16 }}>Reviews Management</h2>
          {/* Sub-tabs */}
          <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
            {[
              { id: "pending", label: `Pending (${pendingReviews.length})`, c: "#DC2626", bg: "#FEF2F2" },
              { id: "approved", label: `Approved (${approvedReviews.length})`, c: "#16A34A", bg: "#F0FDF4" },
              { id: "archived", label: `Archive (${archivedReviews.length})`, c: "#6B7F99", bg: "#F0F4FA" },
            ].map(t => (
              <button key={t.id} onClick={() => setReviewTab(t.id)} style={{
                padding: "8px 16px", borderRadius: 8, border: reviewTab === t.id ? `2px solid ${t.c}` : "1px solid #D4DEF0",
                background: reviewTab === t.id ? t.bg : "#fff", color: t.c, fontSize: ".82rem", fontWeight: 700, cursor: "pointer"
              }}>{t.label}</button>
            ))}
          </div>

          {/* Pending Reviews */}
          {reviewTab === "pending" && (pendingReviews.length > 0 ? pendingReviews.map(r => (
            <div key={r.id} style={{ ...s.card, display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16 }}>
              <div style={{ flex: 1 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                  <div style={{ width: 34, height: 34, borderRadius: "50%", background: "#FEF2F2", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: ".78rem", color: "#DC2626" }}>{r.name?.charAt(0)}</div>
                  <div><div style={{ fontWeight: 700, fontSize: ".86rem" }}>{r.name}</div><div style={{ fontSize: ".7rem", color: "#6B7F99" }}>{r.role} · {"★".repeat(r.stars || 5)}</div></div>
                </div>
                <p style={{ fontSize: ".82rem", color: "#4A5E78", fontStyle: "italic" }}>"{r.text}"</p>
                <div style={{ fontSize: ".7rem", color: "#B0C4DC", marginTop: 4 }}>{formatDate(r.createdAt)}</div>
              </div>
              <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                <button onClick={() => approveReview(r.id)} style={s.btnG}><i className="fas fa-check" style={{ marginRight: 4 }} />Approve</button>
                <button onClick={() => rejectReview(r.id)} style={s.btnD}><i className="fas fa-times" style={{ marginRight: 4 }} />Reject</button>
              </div>
            </div>
          )) : <p style={{ color: "#6B7F99", padding: 20 }}>No pending reviews.</p>)}

          {/* Approved Reviews (on website) */}
          {reviewTab === "approved" && (approvedReviews.length > 0 ? approvedReviews.map(r => (
            <div key={r.id} style={{ ...s.card, display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16, borderLeft: "4px solid #16A34A" }}>
              <div style={{ flex: 1 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                  <div style={{ width: 34, height: 34, borderRadius: "50%", background: "#F0FDF4", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: ".78rem", color: "#16A34A" }}>{r.name?.charAt(0)}</div>
                  <div><div style={{ fontWeight: 700, fontSize: ".86rem" }}>{r.name}</div><div style={{ fontSize: ".7rem", color: "#6B7F99" }}>{r.role} · {"★".repeat(r.stars || 5)}</div></div>
                  <span style={s.badge("#16A34A", "#F0FDF4")}>Live on Website</span>
                </div>
                <p style={{ fontSize: ".82rem", color: "#4A5E78", fontStyle: "italic" }}>"{r.text}"</p>
              </div>
              <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                <button onClick={() => archiveReview(r.id)} style={s.btnO}><i className="fas fa-archive" style={{ marginRight: 4 }} />Archive</button>
                <button onClick={() => deleteReview(r.id)} style={s.btnD}><i className="fas fa-trash" /></button>
              </div>
            </div>
          )) : <p style={{ color: "#6B7F99", padding: 20 }}>No approved reviews on website.</p>)}

          {/* Archived Reviews */}
          {reviewTab === "archived" && (archivedReviews.length > 0 ? archivedReviews.map(r => (
            <div key={r.id} style={{ ...s.card, display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16, opacity: .8 }}>
              <div style={{ flex: 1 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                  <div style={{ width: 34, height: 34, borderRadius: "50%", background: "#F0F4FA", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: ".78rem", color: "#6B7F99" }}>{r.name?.charAt(0)}</div>
                  <div><div style={{ fontWeight: 700, fontSize: ".86rem" }}>{r.name}</div><div style={{ fontSize: ".7rem", color: "#6B7F99" }}>{r.role} · {"★".repeat(r.stars || 5)}</div></div>
                  <span style={s.badge("#6B7F99", "#F0F4FA")}>Archived</span>
                </div>
                <p style={{ fontSize: ".82rem", color: "#4A5E78", fontStyle: "italic" }}>"{r.text}"</p>
              </div>
              <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                <button onClick={() => unarchiveReview(r.id)} style={s.btnG}><i className="fas fa-undo" style={{ marginRight: 4 }} />Restore</button>
                <button onClick={() => deleteReview(r.id)} style={s.btnD}><i className="fas fa-trash" /></button>
              </div>
            </div>
          )) : <p style={{ color: "#6B7F99", padding: 20 }}>No archived reviews.</p>)}
        </>}

        {/* ═══════════ ENQUIRIES TAB ═══════════ */}
        {tab === "enquiries" && <>
          <h2 style={{ fontSize: "1.3rem", fontWeight: 800, marginBottom: 16 }}>Student Enquiries</h2>
          {/* Sub-tabs */}
          <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
            <button onClick={() => setEnquiryTab("active")} style={{
              padding: "8px 16px", borderRadius: 8, border: enquiryTab === "active" ? "2px solid #1349A8" : "1px solid #D4DEF0",
              background: enquiryTab === "active" ? "#EFF6FF" : "#fff", color: "#1349A8", fontSize: ".82rem", fontWeight: 700, cursor: "pointer"
            }}>Active ({activeEnquiries.length})</button>
            <button onClick={() => setEnquiryTab("archived")} style={{
              padding: "8px 16px", borderRadius: 8, border: enquiryTab === "archived" ? "2px solid #6B7F99" : "1px solid #D4DEF0",
              background: enquiryTab === "archived" ? "#F0F4FA" : "#fff", color: "#6B7F99", fontSize: ".82rem", fontWeight: 700, cursor: "pointer"
            }}>Archive ({archivedEnquiries.length})</button>
          </div>

          {/* Active Enquiries */}
          {enquiryTab === "active" && (activeEnquiries.length > 0 ? activeEnquiries.map(e => (
            <div key={e.id} style={{
              ...s.card,
              borderLeft: e.highlighted ? "4px solid #16A34A" : "4px solid transparent",
              background: e.highlighted ? "#F0FDF4" : "#fff",
              transition: "all .3s"
            }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8, flexWrap: "wrap" }}>
                    <div style={{ fontWeight: 800, fontSize: "1rem", color: "#0B1826" }}>{e.name}</div>
                    {e.class && <span style={s.badge("#1349A8", "#EFF6FF")}>{e.class}</span>}
                    {e.board && <span style={s.badge("#92400E", "#FEF3C7")}>{e.board}</span>}
                    {e.medium && <span style={s.badge("#166534", "#F0FDF4")}>{e.medium}</span>}
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 8, fontSize: ".84rem" }}>
                    <div><i className="fas fa-phone" style={{ color: "#1349A8", marginRight: 6, fontSize: ".75rem" }} /><a href={`tel:${e.phone}`} style={{ color: "#1349A8", fontWeight: 600 }}>{e.phone}</a></div>
                    {e.parent && <div><i className="fas fa-user" style={{ color: "#6B7F99", marginRight: 6, fontSize: ".75rem" }} />{e.parent}</div>}
                    {e.address && <div style={{ gridColumn: "span 2" }}><i className="fas fa-map-marker-alt" style={{ color: "#6B7F99", marginRight: 6, fontSize: ".75rem" }} />{e.address}</div>}
                  </div>
                  {e.message && <div style={{ background: "#F8FAFD", borderRadius: 8, padding: 10, fontSize: ".82rem", color: "#4A5E78", fontStyle: "italic", marginBottom: 8 }}>"{e.message}"</div>}
                  {/* Timestamp Info */}
                  <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                    <span style={{ fontSize: ".72rem", color: "#B0C4DC", display: "flex", alignItems: "center", gap: 4 }}>
                      <i className="fas fa-clock" style={{ fontSize: ".65rem" }} />{formatDate(e.createdAt)}
                    </span>
                    <span style={{ fontSize: ".72rem", color: "#D98D04", fontWeight: 600, display: "flex", alignItems: "center", gap: 4 }}>
                      <i className="fas fa-hourglass-half" style={{ fontSize: ".65rem" }} />{timeAgo(e.createdAt)}
                    </span>
                  </div>
                </div>
                {/* Action Buttons */}
                <div style={{ display: "flex", flexDirection: "column", gap: 6, flexShrink: 0 }}>
                  <button onClick={() => highlightEnquiry(e.id, e.highlighted)} title={e.highlighted ? "Remove highlight" : "Highlight (In Progress)"} style={{
                    width: 36, height: 36, borderRadius: 8, border: "1px solid " + (e.highlighted ? "#86EFAC" : "#D4DEF0"),
                    background: e.highlighted ? "#16A34A" : "#fff", color: e.highlighted ? "#fff" : "#6B7F99",
                    cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", fontSize: ".85rem", transition: "all .2s"
                  }}>
                    <i className={e.highlighted ? "fas fa-star" : "far fa-star"} />
                  </button>
                  <button onClick={() => archiveEnquiry(e.id)} title="Mark as Complete" style={{
                    width: 36, height: 36, borderRadius: 8, border: "1px solid #86EFAC",
                    background: "#F0FDF4", color: "#16A34A",
                    cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", fontSize: ".85rem"
                  }}>
                    <i className="fas fa-check" />
                  </button>
                  <button onClick={() => deleteEnquiry(e.id)} title="Delete" style={{
                    width: 36, height: 36, borderRadius: 8, border: "1px solid #FCA5A5",
                    background: "#FEF2F2", color: "#DC2626",
                    cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", fontSize: ".85rem"
                  }}>
                    <i className="fas fa-trash" />
                  </button>
                </div>
              </div>
            </div>
          )) : <p style={{ color: "#6B7F99", padding: 20 }}>No active enquiries.</p>)}

          {/* Archived Enquiries */}
          {enquiryTab === "archived" && (archivedEnquiries.length > 0 ? archivedEnquiries.map(e => (
            <div key={e.id} style={{ ...s.card, opacity: .75, borderLeft: "4px solid #B0C4DC" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6, flexWrap: "wrap" }}>
                    <div style={{ fontWeight: 700, fontSize: ".92rem", color: "#4A5E78" }}>{e.name}</div>
                    {e.class && <span style={s.badge("#6B7F99", "#F0F4FA")}>{e.class}</span>}
                    <span style={s.badge("#6B7F99", "#F0F4FA")}>Completed</span>
                  </div>
                  <div style={{ fontSize: ".82rem", color: "#6B7F99", marginBottom: 4 }}>
                    <i className="fas fa-phone" style={{ marginRight: 6 }} />{e.phone} {e.parent && <span>· {e.parent}</span>}
                  </div>
                  <div style={{ display: "flex", gap: 12 }}>
                    <span style={{ fontSize: ".72rem", color: "#B0C4DC" }}><i className="fas fa-clock" style={{ marginRight: 4 }} />Enquiry: {formatDate(e.createdAt)}</span>
                    <span style={{ fontSize: ".72rem", color: "#B0C4DC" }}><i className="fas fa-archive" style={{ marginRight: 4 }} />Archived: {formatDate(e.archivedAt)}</span>
                  </div>
                </div>
                <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                  <button onClick={() => unarchiveEnquiry(e.id)} style={s.btnG}><i className="fas fa-undo" /></button>
                  <button onClick={() => deleteEnquiry(e.id)} style={s.btnD}><i className="fas fa-trash" /></button>
                </div>
              </div>
            </div>
          )) : <p style={{ color: "#6B7F99", padding: 20 }}>No archived enquiries.</p>)}
        </>}

        {/* ═══════════ SETTINGS TAB ═══════════ */}
        {/* ═══════════ LEAVE ALERTS TAB ═══════════ */}
        {tab === "ranks" && (() => {
          // ── Rankings Tab ──
          const CLASS_CATS_R = [
            { id: "all", label: "All Students" },
            { id: "12th-Eng-CG", label: "12th English (CG)", class: "12th", medium: "English", boards: ["CG"] },
            { id: "12th-Hindi-CG-CBSE", label: "12th Hindi (CG+CBSE)", class: "12th", medium: "Hindi", boards: ["CG","CBSE"] },
            { id: "12th-Eng-CBSE-ICSE", label: "12th English (CBSE+ICSE)", class: "12th", medium: "English", boards: ["CBSE","ICSE"] },
            { id: "11th-Eng-CG", label: "11th English (CG)", class: "11th", medium: "English", boards: ["CG"] },
            { id: "11th-Hindi-CG-CBSE", label: "11th Hindi (CG+CBSE)", class: "11th", medium: "Hindi", boards: ["CG","CBSE"] },
            { id: "10th-Eng-All", label: "10th English (All)", class: "10th", medium: "English", boards: ["CG","CBSE","ICSE"] },
            { id: "10th-Hindi-CG-CBSE", label: "10th Hindi (CG+CBSE)", class: "10th", medium: "Hindi", boards: ["CG","CBSE"] },
            { id: "9th-Eng-All", label: "9th English (All)", class: "9th", medium: "English", boards: ["CG","CBSE","ICSE"] },
            { id: "9th-Hindi-CG-CBSE", label: "9th Hindi (CG+CBSE)", class: "9th", medium: "Hindi", boards: ["CG","CBSE"] },
            { id: "2nd-8th-All", label: "2nd-8th All", class: "2nd-8th" },
            { id: "JEE-NEET", label: "JEE-NEET" },
          ];

          function filterStudentsR(studs, catId) {
            if (catId === "all") return studs;
            const cat = CLASS_CATS_R.find(c => c.id === catId);
            if (!cat || !cat.class) return studs;
            if (cat.class === "2nd-8th") return studs.filter(s => ["2nd","3rd","4th","5th","6th","7th","8th"].includes(s.class));
            if (cat.id === "JEE-NEET") return studs.filter(s => ["9th","10th","11th","12th"].includes(s.class));
            return studs.filter(s => {
              if ((s.class || s.presentClass) !== cat.class) return false;
              if (cat.medium && s.medium !== cat.medium) return false;
              const nb = s.board === "CG Board" ? "CG" : s.board;
              if (cat.boards?.length > 0 && !cat.boards.includes(nb)) return false;
              return true;
            });
          }

          function RankTab() {
            const [classCat, setClassCat] = useState("all");
            const [rankType, setRankType] = useState("exam");
            const [selExam, setSelExam] = useState(null);
            const [selTest, setSelTest] = useState(null);
            const [subjectView, setSubjectView] = useState("overall");
            const [examMarksData, setExamMarksData] = useState([]);
            const [otResultsData, setOtResultsData] = useState([]);
            const [loadingRank, setLoadingRank] = useState(false);

            const filteredStuds = filterStudentsR(students, classCat);
            const filteredIds = new Set(filteredStuds.map(s => s.id));

            useEffect(() => {
              if (!selExam) { setExamMarksData([]); return; }
              setLoadingRank(true);
              getDocs(query(collection(db, "exam_marks"), where("examId", "==", selExam.id)))
                .then(snap => { setExamMarksData(snap.docs.map(d => ({ id: d.id, ...d.data() }))); setLoadingRank(false); })
                .catch(() => setLoadingRank(false));
            }, [selExam]);

            useEffect(() => {
              if (!selTest) { setOtResultsData([]); return; }
              setLoadingRank(true);
              getDocs(query(collection(db, "quiz_history"), where("examId", "==", selTest.id)))
                .then(snap => {
                  const data = snap.docs.map(d => ({ id: d.id, ...d.data() }));
                  if (data.length > 0) { setOtResultsData(data); setLoadingRank(false); return; }
                  return getDocs(query(collection(db, "online_test_results"), where("testId", "==", selTest.id)));
                })
                .then(snap => { if (snap?.docs) setOtResultsData(snap.docs.map(d => ({ id: d.id, ...d.data() }))); setLoadingRank(false); })
                .catch(() => setLoadingRank(false));
            }, [selTest]);

            function getExamRankings() {
              if (!selExam) return [];
              const rows = examMarksData
                .filter(m => filteredIds.has(m.studentId))
                .map(m => {
                  const marks = m.marks || {};
                  const total = m.totalMarks || Object.values(marks).reduce((s, v) => s + (Number(v) || 0), 0);
                  const maxM = selExam.maxMarks || Object.keys(marks).length * 100;
                  const pct = maxM > 0 ? Math.round((total / maxM) * 100) : 0;
                  return { studentId: m.studentId, studentName: m.studentName || "Unknown", studentClass: m.studentClass || "", marks, total, pct };
                });
              if (subjectView === "overall") rows.sort((a, b) => b.pct - a.pct || b.total - a.total);
              else rows.sort((a, b) => (Number(b.marks[subjectView]) || 0) - (Number(a.marks[subjectView]) || 0));
              return rows.map((r, i) => ({ ...r, rank: i + 1 }));
            }

            function getTestRankings() {
              if (!selTest) return [];
              const rows = otResultsData
                .filter(r => filteredIds.has(r.studentId))
                .map(r => {
                  const score = r.correctAnswers || r.score || 0;
                  const total = r.totalQuestions || r.total || selTest.totalQuestions || 0;
                  const pct = total > 0 ? Math.round((score / total) * 100) : (r.percentage || 0);
                  return { studentId: r.studentId, studentName: r.studentName || "Unknown", studentClass: r.studentClass || "", score, total, pct };
                });
              rows.sort((a, b) => b.pct - a.pct || b.score - a.score);
              return rows.map((r, i) => ({ ...r, rank: i + 1 }));
            }

            const rankings = rankType === "exam" ? getExamRankings() : getTestRankings();
            const subjectList = selExam && examMarksData.length > 0
              ? [...new Set(examMarksData.flatMap(m => Object.keys(m.marks || {})))]
              : [];

            const medalColor = (i) => i === 0 ? "#D4A843" : i === 1 ? "#9CA3AF" : i === 2 ? "#C97B4B" : null;
            const pctColor = (p) => p >= 75 ? "#059669" : p >= 50 ? "#D97706" : "#DC2626";

            return (
              <div style={{ padding: "20px 24px" }}>
                <h2 style={{ fontSize: "1.2rem", fontWeight: 800, color: "#0B1826", marginBottom: 20, display: "flex", alignItems: "center", gap: 10 }}>
                  <i className="fas fa-medal" style={{ color: "#D4A843" }} /> Student Rankings
                  <span style={{ marginLeft: "auto", fontSize: ".72rem", background: "#F0F4FA", padding: "4px 12px", borderRadius: 20, color: "#6B7F99" }}>{filteredStuds.length} Students</span>
                </h2>

                {/* Filters */}
                <div style={{ background: "#F8FAFD", borderRadius: 14, padding: 16, marginBottom: 20, border: "1px solid #E8EFF8", display: "flex", gap: 16, flexWrap: "wrap", alignItems: "flex-end" }}>

                  {/* Class Filter */}
                  <div>
                    <div style={{ fontSize: ".72rem", fontWeight: 700, color: "#6B7F99", textTransform: "uppercase", marginBottom: 6 }}>Class / Batch</div>
                    <select
                      value={classCat}
                      onChange={e => setClassCat(e.target.value)}
                      style={{ padding: "8px 12px", borderRadius: 8, border: "1.5px solid #D4DEF0", fontSize: ".8rem", fontWeight: 600, cursor: "pointer", minWidth: 200 }}>
                      {CLASS_CATS_R.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
                    </select>
                  </div>

                  {/* Rank Type */}
                  <div>
                    <div style={{ fontSize: ".72rem", fontWeight: 700, color: "#6B7F99", textTransform: "uppercase", marginBottom: 6 }}>Rank By</div>
                    <div style={{ display: "flex", gap: 8 }}>
                      {[{ v: "exam", l: "Exam / Test", icon: "fa-file-alt" }, { v: "online_test", l: "Online Test", icon: "fa-laptop" }].map(t => (
                        <button key={t.v}
                          onClick={() => { setRankType(t.v); setSelExam(null); setSelTest(null); setSubjectView("overall"); }}
                          style={{ padding: "8px 16px", borderRadius: 8, border: `1.5px solid ${rankType === t.v ? "#1349A8" : "#D4DEF0"}`, background: rankType === t.v ? "#EFF6FF" : "#fff", color: rankType === t.v ? "#1349A8" : "#6B7F99", fontWeight: 700, fontSize: ".8rem", cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}>
                          <i className={`fas ${t.icon}`} />{t.l}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Exam / Test Selector */}
                  {rankType === "exam" && (
                    <div>
                      <div style={{ fontSize: ".72rem", fontWeight: 700, color: "#6B7F99", textTransform: "uppercase", marginBottom: 6 }}>Exam Select Karo</div>
                      <select
                        value={selExam?.id || ""}
                        onChange={e => { const ex = examList.find(ex => ex.id === e.target.value); setSelExam(ex || null); setSubjectView("overall"); }}
                        style={{ padding: "8px 12px", borderRadius: 8, border: "1.5px solid #D4DEF0", fontSize: ".8rem", fontWeight: 600, cursor: "pointer", minWidth: 200 }}>
                        <option value="">-- Exam Chuno --</option>
                        {examList.map(ex => <option key={ex.id} value={ex.id}>{ex.title || ex.name} ({ex.date || ""})</option>)}
                      </select>
                    </div>
                  )}

                  {rankType === "online_test" && (
                    <div>
                      <div style={{ fontSize: ".72rem", fontWeight: 700, color: "#6B7F99", textTransform: "uppercase", marginBottom: 6 }}>Online Test Select Karo</div>
                      <select
                        value={selTest?.id || ""}
                        onChange={e => { const t = otList.find(t => t.id === e.target.value); setSelTest(t || null); }}
                        style={{ padding: "8px 12px", borderRadius: 8, border: "1.5px solid #D4DEF0", fontSize: ".8rem", fontWeight: 600, cursor: "pointer", minWidth: 200 }}>
                        <option value="">-- Test Chuno --</option>
                        {otList.map(t => <option key={t.id} value={t.id}>{t.title} ({t.subject || ""})</option>)}
                      </select>
                    </div>
                  )}
                </div>

                {/* Subject Chips */}
                {rankType === "exam" && selExam && subjectList.length > 0 && (
                  <div style={{ marginBottom: 16, display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                    <span style={{ fontSize: ".72rem", fontWeight: 700, color: "#6B7F99" }}>Subject:</span>
                    {["overall", ...subjectList].map(sub => (
                      <button key={sub}
                        onClick={() => setSubjectView(sub)}
                        style={{ padding: "5px 14px", borderRadius: 20, border: `1.5px solid ${subjectView === sub ? "#1349A8" : "#D4DEF0"}`, background: subjectView === sub ? "#1349A8" : "#fff", color: subjectView === sub ? "#fff" : "#6B7F99", fontWeight: 700, fontSize: ".72rem", cursor: "pointer", textTransform: "capitalize" }}>
                        {sub === "overall" ? "Overall" : sub}
                      </button>
                    ))}
                  </div>
                )}

                {/* Rankings Table */}
                {loadingRank ? (
                  <div style={{ textAlign: "center", padding: "60px 20px", color: "#6B7F99" }}>
                    <i className="fas fa-spinner fa-spin" style={{ fontSize: "2rem", color: "#1349A8" }} />
                    <div style={{ marginTop: 10 }}>Loading ranks...</div>
                  </div>
                ) : !selExam && !selTest ? (
                  <div style={{ textAlign: "center", padding: "60px 20px", color: "#6B7F99" }}>
                    <i className="fas fa-medal" style={{ fontSize: "2.5rem", color: "#D4DEF0" }} />
                    <div style={{ marginTop: 12, fontWeight: 700, fontSize: "1rem", color: "#4A5E78" }}>Exam ya Test select karo</div>
                    <div style={{ marginTop: 4, fontSize: ".82rem" }}>Rankings yahan dikhenge</div>
                  </div>
                ) : rankings.length === 0 ? (
                  <div style={{ textAlign: "center", padding: "60px 20px", color: "#6B7F99" }}>
                    <i className="fas fa-inbox" style={{ fontSize: "2rem", color: "#D4DEF0" }} />
                    <div style={{ marginTop: 10, fontWeight: 700 }}>Koi result nahi mila</div>
                  </div>
                ) : (
                  <div style={{ background: "#fff", borderRadius: 16, border: "1px solid #E8EFF8", overflow: "hidden" }}>

                    {/* Table Header */}
                    <div style={{ padding: "12px 18px", borderBottom: "2px solid #E8EFF8", display: "flex", justifyContent: "space-between", alignItems: "center", background: "#F5F8FF" }}>
                      <div>
                        <div style={{ fontWeight: 800, fontSize: ".95rem", color: "#0B1826" }}>
                          {rankType === "exam" ? (selExam?.title || selExam?.name) : selTest?.title}
                        </div>
                        <div style={{ fontSize: ".72rem", color: "#6B7F99", marginTop: 2 }}>
                          {rankings.length} students ranked
                          {subjectView !== "overall" && <span style={{ marginLeft: 8, background: "#EFF6FF", color: "#1349A8", padding: "2px 8px", borderRadius: 20, fontWeight: 700 }}>Subject: {subjectView}</span>}
                        </div>
                      </div>
                      <span style={{ fontSize: ".72rem", fontWeight: 700, color: "#6B7F99" }}>{CLASS_CATS_R.find(c => c.id === classCat)?.label}</span>
                    </div>

                    {/* Table */}
                    <div style={{ overflowX: "auto" }}>
                      <table style={{ width: "100%", borderCollapse: "collapse" }}>
                        <thead>
                          <tr style={{ background: "#F8FAFD", borderBottom: "2px solid #E8EFF8" }}>
                            <th style={{ padding: "10px 14px", fontSize: ".72rem", fontWeight: 800, color: "#4A5E78", textAlign: "left", textTransform: "uppercase", width: 60 }}>Rank</th>
                            <th style={{ padding: "10px 14px", fontSize: ".72rem", fontWeight: 800, color: "#4A5E78", textAlign: "left", textTransform: "uppercase" }}>Student</th>
                            <th style={{ padding: "10px 14px", fontSize: ".72rem", fontWeight: 800, color: "#4A5E78", textAlign: "left", textTransform: "uppercase" }}>Class</th>
                            {rankType === "exam" && subjectView === "overall" && subjectList.map(sub => (
                              <th key={sub} style={{ padding: "10px 14px", fontSize: ".72rem", fontWeight: 800, color: "#4A5E78", textAlign: "center", textTransform: "uppercase" }}>{sub}</th>
                            ))}
                            {rankType === "exam" && subjectView !== "overall" && (
                              <th style={{ padding: "10px 14px", fontSize: ".72rem", fontWeight: 800, color: "#4A5E78", textAlign: "center" }}>{subjectView} Marks</th>
                            )}
                            {rankType === "online_test" && (
                              <th style={{ padding: "10px 14px", fontSize: ".72rem", fontWeight: 800, color: "#4A5E78", textAlign: "center" }}>Score</th>
                            )}
                            <th style={{ padding: "10px 14px", fontSize: ".72rem", fontWeight: 800, color: "#4A5E78", textAlign: "center", textTransform: "uppercase" }}>%</th>
                            <th style={{ padding: "10px 14px", fontSize: ".72rem", fontWeight: 800, color: "#4A5E78", textAlign: "center", textTransform: "uppercase" }}>Grade</th>
                          </tr>
                        </thead>
                        <tbody>
                          {rankings.map((r, i) => {
                            const mc = medalColor(i);
                            const grade = r.pct >= 90 ? "A+" : r.pct >= 80 ? "A" : r.pct >= 70 ? "B+" : r.pct >= 60 ? "B" : r.pct >= 50 ? "C" : "D";
                            return (
                              <tr key={r.studentId + '_' + i} style={{ background: i % 2 === 0 ? "#fff" : "#F8FAFD", borderBottom: "1px solid #F0F4FA" }}>
                                <td style={{ padding: "10px 14px", textAlign: "center" }}>
                                  <div style={{ width: 30, height: 30, borderRadius: 8, display: "inline-flex", alignItems: "center", justifyContent: "center", background: mc ? mc + "20" : "#F0F4FA", color: mc || "#6B7F99", fontWeight: 900, fontSize: ".8rem" }}>
                                    {mc ? <i className="fas fa-medal" /> : i + 1}
                                  </div>
                                </td>
                                <td style={{ padding: "10px 14px", fontWeight: 700, color: "#0B1826" }}>{r.studentName}</td>
                                <td style={{ padding: "10px 14px", fontSize: ".75rem", color: "#6B7F99" }}>{r.studentClass}</td>
                                {rankType === "exam" && subjectView === "overall" && subjectList.map(sub => (
                                  <td key={sub} style={{ padding: "10px 14px", textAlign: "center", fontWeight: 700 }}>{r.marks?.[sub] ?? "—"}</td>
                                ))}
                                {rankType === "exam" && subjectView !== "overall" && (
                                  <td style={{ padding: "10px 14px", textAlign: "center", fontWeight: 800, fontSize: "1rem", color: "#1349A8" }}>{r.marks?.[subjectView] ?? "—"}</td>
                                )}
                                {rankType === "online_test" && (
                                  <td style={{ padding: "10px 14px", textAlign: "center", fontWeight: 700 }}>{r.score}/{r.total}</td>
                                )}
                                <td style={{ padding: "10px 14px", textAlign: "center" }}>
                                  <span style={{ background: pctColor(r.pct) + "15", color: pctColor(r.pct), padding: "3px 10px", borderRadius: 20, fontWeight: 800, fontSize: ".78rem" }}>{r.pct}%</span>
                                </td>
                                <td style={{ padding: "10px 14px", textAlign: "center", fontWeight: 800, color: pctColor(r.pct) }}>{grade}</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>

                    {/* Summary Footer */}
                    <div style={{ padding: "12px 18px", background: "#F8FAFD", borderTop: "1px solid #E8EFF8", display: "flex", gap: 24, flexWrap: "wrap" }}>
                      {[
                        { label: "Top Score", val: rankings[0] ? `${rankings[0].pct}% — ${rankings[0].studentName}` : "—", color: "#D4A843" },
                        { label: "Average %", val: rankings.length > 0 ? `${Math.round(rankings.reduce((s, r) => s + r.pct, 0) / rankings.length)}%` : "—", color: "#1349A8" },
                        { label: "Pass (≥40%)", val: rankings.filter(r => r.pct >= 40).length, color: "#059669" },
                        { label: "Fail (<40%)", val: rankings.filter(r => r.pct < 40).length, color: "#DC2626" },
                      ].map((stat, i) => (
                        <div key={i}>
                          <div style={{ fontSize: ".68rem", fontWeight: 600, color: "#6B7F99" }}>{stat.label}</div>
                          <div style={{ fontSize: ".88rem", fontWeight: 800, color: stat.color }}>{stat.val}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          }

          return <RankTab />;
        })()}

        {tab === "leave_alerts" && (() => {
          const today = new Date().toISOString().split("T")[0];

          // Teachers on leave today
          const normalizeDate = (d) => {
  if (!d) return "";
  if (d.includes("-")) return d; // already YYYY-MM-DD
  const [dd, mm, yyyy] = d.split("/");
  return `${yyyy}-${mm}-${dd}`;
};
const teachersOnLeaveToday = teacherLeaves.filter(lv => {
  const from = normalizeDate(lv.fromDate);
  const to = normalizeDate(lv.toDate || lv.fromDate);
  return from <= today && to >= today;
});
          // Students on leave today
          const studentsOnLeaveToday = leaveApplications.filter(lv => lv.date === today);

          // All upcoming teacher leaves (future)
          const upcomingTeacherLeaves = teacherLeaves.filter(lv => normalizeDate(lv.fromDate) > today).slice(0, 10);

          // Recent student leaves (last 7 days)
          const sevenDaysAgo = new Date(); sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
          const recentStudentLeaves = leaveApplications.filter(lv => lv.date >= sevenDaysAgo.toISOString().split("T")[0]).slice(0, 20);

          return (
            <>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
                <h2 style={{ fontSize: "1.3rem", fontWeight: 800 }}>
                  <i className="fas fa-calendar-times" style={{ marginRight: 10, color: "#D97706" }} />
                  Leave Alerts
                </h2>
                <span style={{ fontSize: ".82rem", color: "#6B7F99", background: "#F0F4FA", padding: "6px 14px", borderRadius: 8, fontWeight: 600 }}>
                  Today: {new Date().toLocaleDateString("en-IN", { weekday: "long", day: "2-digit", month: "long" })}
                </span>
              </div>

              {/* ─── TODAY SUMMARY CARDS ─── */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16, marginBottom: 24 }}>
                <div style={{ background: "#fff", borderRadius: 14, border: "1px solid #FDE68A", padding: 18, borderLeft: "4px solid #D97706" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
                    <div style={{ width: 36, height: 36, borderRadius: 10, background: "#FFFBEB", display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <i className="fas fa-chalkboard-teacher" style={{ color: "#D97706", fontSize: "1rem" }} />
                    </div>
                    <div>
                      <div style={{ fontSize: "1.6rem", fontWeight: 900, color: "#D97706" }}>{teachersOnLeaveToday.length}</div>
                      <div style={{ fontSize: ".72rem", color: "#92400E", fontWeight: 600 }}>Teachers on Leave Today</div>
                    </div>
                  </div>
                </div>
                <div style={{ background: "#fff", borderRadius: 14, border: "1px solid #FCA5A5", padding: 18, borderLeft: "4px solid #DC2626" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
                    <div style={{ width: 36, height: 36, borderRadius: 10, background: "#FEF2F2", display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <i className="fas fa-user-graduate" style={{ color: "#DC2626", fontSize: "1rem" }} />
                    </div>
                    <div>
                      <div style={{ fontSize: "1.6rem", fontWeight: 900, color: "#DC2626" }}>{studentsOnLeaveToday.length}</div>
                      <div style={{ fontSize: ".72rem", color: "#991B1B", fontWeight: 600 }}>Students on Leave Today</div>
                    </div>
                  </div>
                </div>
                <div style={{ background: "#fff", borderRadius: 14, border: "1px solid #86EFAC", padding: 18, borderLeft: "4px solid #16A34A" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
                    <div style={{ width: 36, height: 36, borderRadius: 10, background: "#F0FDF4", display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <i className="fas fa-calendar-check" style={{ color: "#16A34A", fontSize: "1rem" }} />
                    </div>
                    <div>
                      <div style={{ fontSize: "1.6rem", fontWeight: 900, color: "#16A34A" }}>{upcomingTeacherLeaves.length}</div>
                      <div style={{ fontSize: ".72rem", color: "#166534", fontWeight: 600 }}>Upcoming Teacher Leaves</div>
                    </div>
                  </div>
                </div>
              </div>

              {/* ─── TEACHERS ON LEAVE TODAY ─── */}
              <div style={{ ...s.card, marginBottom: 20 }}>
                <h3 style={{ fontSize: "1rem", fontWeight: 800, marginBottom: 14, display: "flex", alignItems: "center", gap: 8, color: "#92400E" }}>
                  <i className="fas fa-chalkboard-teacher" style={{ color: "#D97706" }} />
                  Aaj Chutti Par — Teachers
                  {teachersOnLeaveToday.length > 0 && <span style={{ padding: "2px 10px", borderRadius: 99, background: "#FEF3C7", color: "#92400E", fontSize: ".72rem", fontWeight: 700 }}>{teachersOnLeaveToday.length} teacher</span>}
                </h3>
                {teachersOnLeaveToday.length === 0 ? (
                  <div style={{ textAlign: "center", padding: "24px 0", color: "#6B7F99" }}>
                    <i className="fas fa-check-circle" style={{ fontSize: "2rem", color: "#16A34A", marginBottom: 8, display: "block" }} />
                    <p style={{ fontSize: ".85rem", fontWeight: 600 }}>Aaj koi teacher chutti par nahi hai ✓</p>
                  </div>
                ) : teachersOnLeaveToday.map(lv => {
                  const days = lv.toDate && lv.toDate !== lv.fromDate
                    ? Math.ceil((new Date(lv.toDate) - new Date(lv.fromDate)) / (1000*60*60*24)) + 1
                    : 1;
                  return (
                    <div key={lv.id} style={{ display: "flex", alignItems: "center", gap: 14, padding: "12px 14px", borderRadius: 12, background: "#FFFBEB", border: "1px solid #FDE68A", marginBottom: 8 }}>
                      <div style={{ width: 42, height: 42, borderRadius: 12, background: "linear-gradient(135deg, #D97706, #F59E0B)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                        <span style={{ color: "#fff", fontWeight: 900, fontSize: "1rem" }}>{(lv.teacherName || "T").charAt(0)}</span>
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 800, fontSize: ".9rem", color: "#92400E" }}>{lv.teacherName}</div>
                        <div style={{ fontSize: ".72rem", color: "#B45309" }}>
  {(() => { const t = teachers.find(tc => tc.email === lv.teacherEmail || tc.name === lv.teacherName); return t?.subject || "—"; })()}
</div>
                        <div style={{ fontSize: ".7rem", color: "#78350F", marginTop: 2 }}>
                          <i className="fas fa-calendar-alt" style={{ marginRight: 4 }} />
                          {lv.fromDate}{lv.toDate && lv.toDate !== lv.fromDate ? ` → ${lv.toDate}` : ""} · {days} din
                        </div>
                      </div>
                      <div style={{ textAlign: "right" }}>
                        <div style={{ padding: "3px 10px", borderRadius: 99, background: "#FEF3C7", color: "#92400E", fontSize: ".65rem", fontWeight: 700, border: "1px solid #FDE68A", marginBottom: 4 }}>On Leave</div>
                        <div style={{ fontSize: ".65rem", color: "#B45309", maxWidth: 120, textAlign: "right" }}>{lv.reason?.substring(0, 40)}{lv.reason?.length > 40 ? "..." : ""}</div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* ─── STUDENTS ON LEAVE TODAY ─── */}
              <div style={{ ...s.card, marginBottom: 20 }}>
                <h3 style={{ fontSize: "1rem", fontWeight: 800, marginBottom: 14, display: "flex", alignItems: "center", gap: 8, color: "#991B1B" }}>
                  <i className="fas fa-user-graduate" style={{ color: "#DC2626" }} />
                  Aaj Chutti Par — Students
                  {studentsOnLeaveToday.length > 0 && <span style={{ padding: "2px 10px", borderRadius: 99, background: "#FEF2F2", color: "#991B1B", fontSize: ".72rem", fontWeight: 700 }}>{studentsOnLeaveToday.length} student</span>}
                </h3>
                {studentsOnLeaveToday.length === 0 ? (
                  <div style={{ textAlign: "center", padding: "24px 0", color: "#6B7F99" }}>
                    <i className="fas fa-check-circle" style={{ fontSize: "2rem", color: "#16A34A", marginBottom: 8, display: "block" }} />
                    <p style={{ fontSize: ".85rem", fontWeight: 600 }}>Aaj koi student chutti par nahi hai ✓</p>
                  </div>
                ) : studentsOnLeaveToday.map(lv => {
                  const typeLabel = { full_day: "Full Day", half_day: "Half Day", emergency: "Emergency" }[lv.leaveType] || "Leave";
                  const typeColor = { full_day: "#2563EB", half_day: "#7C3AED", emergency: "#DC2626" }[lv.leaveType] || "#6B7F99";
                  return (
                    <div key={lv.id} style={{ display: "flex", alignItems: "center", gap: 14, padding: "12px 14px", borderRadius: 12, background: "#FEF2F2", border: "1px solid #FCA5A5", marginBottom: 8 }}>
                      <div style={{ width: 42, height: 42, borderRadius: 12, background: "linear-gradient(135deg, #DC2626, #EF4444)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                        <span style={{ color: "#fff", fontWeight: 900, fontSize: "1rem" }}>{(lv.studentName || "S").charAt(0)}</span>
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 800, fontSize: ".9rem", color: "#991B1B" }}>{lv.studentName}</div>
                        <div style={{ fontSize: ".72rem", color: "#B91C1C" }}>Class {lv.studentClass || "—"}</div>
                        <div style={{ fontSize: ".7rem", color: "#7F1D1D", marginTop: 2 }}>{lv.reason?.substring(0, 60)}{lv.reason?.length > 60 ? "..." : ""}</div>
                      </div>
                      <div style={{ textAlign: "right" }}>
                        <span style={{ padding: "3px 10px", borderRadius: 99, background: "#fff", color: typeColor, fontSize: ".65rem", fontWeight: 700, border: `1px solid ${typeColor}33` }}>{typeLabel}</span>
                        {lv.parentName && <div style={{ fontSize: ".62rem", color: "#B91C1C", marginTop: 4 }}>Parent: {lv.parentName}</div>}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* ─── UPCOMING TEACHER LEAVES ─── */}
              {upcomingTeacherLeaves.length > 0 && (
                <div style={{ ...s.card, marginBottom: 20 }}>
                  <h3 style={{ fontSize: "1rem", fontWeight: 800, marginBottom: 14, display: "flex", alignItems: "center", gap: 8, color: "#1349A8" }}>
                    <i className="fas fa-calendar-plus" style={{ color: "#1349A8" }} />
                    Upcoming Teacher Leaves
                  </h3>
                  {upcomingTeacherLeaves.map(lv => {
                    const days = lv.toDate && lv.toDate !== lv.fromDate
                      ? Math.ceil((new Date(lv.toDate) - new Date(lv.fromDate)) / (1000*60*60*24)) + 1
                      : 1;
                    return (
                      <div key={lv.id} style={{ display: "flex", alignItems: "center", gap: 14, padding: "10px 14px", borderRadius: 10, background: "#F0F4FA", border: "1px solid #D4DEF0", marginBottom: 6 }}>
                        <div style={{ width: 36, height: 36, borderRadius: 10, background: "linear-gradient(135deg, #1349A8, #2A6FE0)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                          <span style={{ color: "#fff", fontWeight: 800, fontSize: ".85rem" }}>{(lv.teacherName || "T").charAt(0)}</span>
                        </div>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontWeight: 700, fontSize: ".85rem" }}>{lv.teacherName} <span style={{ fontSize: ".72rem", color: "#6B7F99" }}>· {(() => { const t = teachers.find(tc => tc.email === lv.teacherEmail || tc.name === lv.teacherName); return t?.subject || "—"; })()}</span></div>
                          <div style={{ fontSize: ".7rem", color: "#6B7F99" }}>
                            {lv.fromDate}{lv.toDate && lv.toDate !== lv.fromDate ? ` → ${lv.toDate}` : ""} · {days} din
                          </div>
                        </div>
                        <span style={{ fontSize: ".72rem", color: "#1349A8", background: "#EFF6FF", padding: "3px 10px", borderRadius: 99, border: "1px solid #BFDBFE", fontWeight: 600 }}>Upcoming</span>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* ─── RECENT STUDENT LEAVES (Last 7 days) ─── */}
              <div style={s.card}>
                <h3 style={{ fontSize: "1rem", fontWeight: 800, marginBottom: 14, display: "flex", alignItems: "center", gap: 8 }}>
                  <i className="fas fa-history" style={{ color: "#6B7F99" }} />
                  Recent Student Leaves (Last 7 Days)
                </h3>
                {recentStudentLeaves.length === 0 ? (
                  <p style={{ color: "#6B7F99", fontSize: ".84rem", textAlign: "center", padding: 16 }}>Koi recent student leave nahi hai</p>
                ) : (
                  <div style={{ overflowX: "auto" }}>
                    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: ".8rem" }}>
                      <thead>
                        <tr style={{ background: "#F8FAFD" }}>
                          {["Date", "Student", "Class", "Type", "Reason"].map(h => (
                            <th key={h} style={{ padding: "8px 12px", textAlign: "left", fontSize: ".72rem", fontWeight: 700, color: "#6B7F99", borderBottom: "1px solid #E8EFF8", whiteSpace: "nowrap" }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {recentStudentLeaves.map((lv, i) => {
                          const typeLabel = { full_day: "Full Day", half_day: "Half Day", emergency: "Emergency" }[lv.leaveType] || "—";
                          const typeColor = { full_day: "#2563EB", half_day: "#7C3AED", emergency: "#DC2626" }[lv.leaveType] || "#6B7F99";
                          return (
                            <tr key={lv.id} style={{ borderBottom: i < recentStudentLeaves.length - 1 ? "1px solid #F0F4FA" : "none", background: i % 2 === 0 ? "#fff" : "#FAFCFE" }}>
                              <td style={{ padding: "10px 12px", fontWeight: 600, whiteSpace: "nowrap" }}>{lv.date ? new Date(lv.date + "T00:00:00").toLocaleDateString("en-IN", { day: "2-digit", month: "short" }) : "—"}</td>
                              <td style={{ padding: "10px 12px", fontWeight: 600 }}>{lv.studentName || "—"}</td>
                              <td style={{ padding: "10px 12px", color: "#6B7F99" }}>{lv.studentClass || "—"}</td>
                              <td style={{ padding: "10px 12px" }}><span style={{ padding: "2px 8px", borderRadius: 6, background: typeColor + "15", color: typeColor, fontSize: ".7rem", fontWeight: 700 }}>{typeLabel}</span></td>
                              <td style={{ padding: "10px 12px", color: "#4A5E78", maxWidth: 200 }}>{lv.reason?.substring(0, 50)}{lv.reason?.length > 50 ? "..." : ""}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </>
          );
        })()}

        {tab === "settings" && <>
          <h2 style={{ fontSize: "1.3rem", fontWeight: 800, marginBottom: 20 }}>Website Settings</h2>

          {/* Hero Banner Management */}
          <div style={{ ...s.card, border: "2px solid #1349A8" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
              <div style={{ width: 40, height: 40, borderRadius: 10, background: "#EFF6FF", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <i className="fas fa-image" style={{ color: "#1349A8", fontSize: "1rem" }} />
              </div>
              <div>
                <h3 style={{ fontSize: "1rem", fontWeight: 800, color: "#0B1826" }}>Hero Section Banner</h3>
                <p style={{ fontSize: ".78rem", color: "#6B7F99" }}>Homepage ke hero section mein jo image box hai, uska banner yahan se change karo</p>
              </div>
            </div>

            {/* Current Banner Preview */}
            {heroBanner && (
              <div style={{ marginBottom: 16 }}>
                <label style={{ ...s.label, marginBottom: 8 }}>Current Banner Preview:</label>
                <div style={{ width: "100%", maxWidth: 400, height: 220, borderRadius: 12, overflow: "hidden", border: "2px solid #D4DEF0", background: "#F0F4FA" }}>
                  <img src={heroBanner} alt="Hero Banner Preview" style={{ width: "100%", height: "100%", objectFit: "cover" }}
                    onError={(e) => { e.currentTarget.style.display = "none"; }} />
                </div>
              </div>
            )}

            {/* Banner Upload */}
            <ImageUploader
              folder="hero"
              label="Upload New Banner (600x380px ya bada)"
              currentUrl=""
              onUpload={(url) => setHeroBanner(url)}
              onRemove={() => {}}
            />
            <p style={{ fontSize: ".72rem", color: "#6B7F99", marginBottom: 12 }}>Ya manually URL paste karo:</p>
            <input style={s.input} placeholder="https://... ya /hero_board.png" value={heroBanner} onChange={e => setHeroBanner(e.target.value)} />

            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={saveHeroBanner} disabled={bannerSaving} style={s.btnP}>
                <i className="fas fa-save" style={{ marginRight: 6 }} />{bannerSaving ? "Saving..." : "Update Banner"}
              </button>
              <button onClick={() => { setHeroBanner("/hero_board.png"); }} style={s.btnGray}>
                <i className="fas fa-undo" style={{ marginRight: 6 }} />Reset to Default
              </button>
            </div>
          </div>

          {/* Info */}
          <div style={{ marginTop: 16, background: "#FFFBEB", borderRadius: 12, padding: 16, border: "1px solid #FDE68A", fontSize: ".82rem", color: "#78350F", display: "flex", alignItems: "flex-start", gap: 10 }}>
            <i className="fas fa-lightbulb" style={{ marginTop: 2, flexShrink: 0, color: "#D98D04" }} />
            <div>
              <strong>Banner Change Tips:</strong><br />
              • Banner image homepage ke hero section mein right side pe dikhta hai<br />
              • "Upload New Banner" button se direct photo upload karo — Firebase Storage mein save hogi<br />
              • Events, seminars, admissions ka banner laga sakte ho — jab chahe change karo<br />
              • Default banner: <code>/hero_board.png</code> — Reset button se wapas laga sakte ho
            </div>
          </div>
        </>}

        {/* ═══════════ TEACHERS TAB ═══════════ */}
        {tab === "teachers" && <>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20, flexWrap: "wrap", gap: 10 }}>
            <h2 style={{ fontSize: "1.3rem", fontWeight: 800 }}>Teachers Management</h2>
            <div style={{ display: "flex", gap: 8 }}>
              {teachers.length === 0 && <button onClick={seedTeachers} disabled={saving} style={s.btnO}><i className="fas fa-database" style={{ marginRight: 6 }} />Load All Teachers</button>}
              <button onClick={() => { setShowForm(true); setEditId(null); setForm({ order: teachers.length + 1 }); }} style={s.btnP}><i className="fas fa-plus" style={{ marginRight: 6 }} />Add Teacher</button>
            </div>
          </div>

          {/* Teacher Form */}
          {showForm && <div style={{ ...s.card, border: "2px solid #059669" }}>
            <h3 style={{ fontSize: "1rem", fontWeight: 700, marginBottom: 16, color: "#059669" }}><i className="fas fa-edit" style={{ marginRight: 8 }} />{editId ? "Edit" : "Add"} Teacher</h3>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <div><label style={s.label}>Teacher Name *</label><input style={s.input} placeholder="e.g. Mr. Temlal Patel" value={form.name || ""} onChange={e => setForm({ ...form, name: e.target.value })} /></div>
              <div><label style={s.label}>Subject *</label><input style={s.input} placeholder="e.g. Physics" value={form.subject || ""} onChange={e => setForm({ ...form, subject: e.target.value })} /></div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <div><label style={s.label}>Qualification</label><input style={s.input} placeholder="e.g. BSc, MSc, B.Ed" value={form.qualification || ""} onChange={e => setForm({ ...form, qualification: e.target.value })} /></div>
              <div><label style={s.label}>Experience</label><input style={s.input} placeholder="e.g. 15 years" value={form.experience || ""} onChange={e => setForm({ ...form, experience: e.target.value })} /></div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <div><label style={s.label}>Teaching Classes</label><input style={s.input} placeholder="e.g. Class 11 & 12" value={form.classes || ""} onChange={e => setForm({ ...form, classes: e.target.value })} /></div>
              <div><label style={s.label}>Display Order</label><input style={s.input} type="number" placeholder="1, 2, 3..." value={form.order || ""} onChange={e => setForm({ ...form, order: parseInt(e.target.value) || 0 })} /></div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <div>
                <label style={s.label}><i className="fas fa-id-card" style={{ marginRight: 4, color: "#7C3AED" }} />RFID Card Code</label>
                <input style={{ ...s.input, fontFamily: "monospace", letterSpacing: 1 }} placeholder="e.g. A3B5C7D9 (RFID card scan/type karo)" value={form.rfidCode || ""} onChange={e => setForm({ ...form, rfidCode: e.target.value.toUpperCase().replace(/\s+/g, "").trim() })} />
                {form.rfidCode && <div style={{ fontSize: ".68rem", color: "#7C3AED", marginTop: -6, marginBottom: 6 }}><i className="fas fa-check-circle" style={{ marginRight: 3 }} />RFID: {form.rfidCode}</div>}
              </div>
              <div>
                <label style={s.label}>Phone Number</label>
                <input style={s.input} placeholder="e.g. 9876543210" value={form.phone || ""} onChange={e => setForm({ ...form, phone: e.target.value })} />
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <div>
                <label style={s.label}><i className="fas fa-envelope" style={{ marginRight: 4, color: "#DC2626" }} />Gmail ID</label>
                <input style={s.input} type="email" placeholder="e.g. teacher@gmail.com" value={form.email || ""} onChange={e => setForm({ ...form, email: e.target.value })} />
              </div>
              <div style={{ display: "flex", alignItems: "flex-end", paddingBottom: 10 }}>
                {form.email && <div style={{ fontSize: ".68rem", color: "#16A34A" }}><i className="fas fa-check-circle" style={{ marginRight: 3 }} />Email: {form.email}</div>}
              </div>
            </div>
            {/* ── RFID CARD VALIDITY PERIOD ── */}
            <div style={{ background: "#FAF5FF", borderRadius: 10, padding: 14, border: "1px solid #E9D5FF", marginBottom: 12 }}>
              <p style={{ fontSize: ".76rem", color: "#6B21A8", margin: "0 0 10px 0", fontWeight: 600 }}><i className="fas fa-clock" style={{ marginRight: 4 }} /> RFID Card Validity — Session/Batch Duration</p>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
                <div>
                  <label style={s.label}>Card Valid From *</label>
                  <input style={s.input} type="date" value={form.cardValidFrom || ""} onChange={e => setForm({ ...form, cardValidFrom: e.target.value })} />
                </div>
                <div>
                  <label style={s.label}>Card Valid To *</label>
                  <input style={s.input} type="date" value={form.cardValidTo || ""} onChange={e => setForm({ ...form, cardValidTo: e.target.value })} />
                </div>
                <div>
                  <label style={s.label}>Card Status</label>
                  <div style={{ padding: "9px 12px", borderRadius: 8, background: form.cardValidFrom && form.cardValidTo ? (() => { const t = new Date().toISOString().split("T")[0]; return t >= form.cardValidFrom && t <= form.cardValidTo ? "#F0FDF4" : t > form.cardValidTo ? "#FEF2F2" : "#FFFBEB"; })() : "#F8FAFD", border: "1px solid #D4DEF0", fontSize: ".82rem", fontWeight: 600, color: form.cardValidFrom && form.cardValidTo ? (() => { const t = new Date().toISOString().split("T")[0]; return t >= form.cardValidFrom && t <= form.cardValidTo ? "#16A34A" : t > form.cardValidTo ? "#DC2626" : "#D98D04"; })() : "#6B7F99", minHeight: 38, display: "flex", alignItems: "center" }}>
                    {form.cardValidFrom && form.cardValidTo ? (() => {
                      const t = new Date().toISOString().split("T")[0];
                      const isActive = t >= form.cardValidFrom && t <= form.cardValidTo;
                      const isExpired = t > form.cardValidTo;
                      const months = Math.round((new Date(form.cardValidTo) - new Date(form.cardValidFrom)) / (1000 * 60 * 60 * 24 * 30));
                      return <><i className={`fas ${isActive ? "fa-check-circle" : isExpired ? "fa-times-circle" : "fa-clock"}`} style={{ marginRight: 6 }} />{months} months {isActive ? "(Active)" : isExpired ? "(Expired)" : "(Upcoming)"}</>;
                    })() : "Valid From & To date select karo"}
                  </div>
                </div>
              </div>
              <p style={{ fontSize: ".68rem", color: "#7C3AED", marginTop: 8, marginBottom: 0 }}><i className="fas fa-info-circle" style={{ marginRight: 4 }} />Is duration ke andar hi teacher ka RFID card se attendance lagegi. Expire hone par card deactivate ho jayega.</p>
            </div>

            <ImageUploader
              folder="teachers"
              label="Teacher Photo"
              currentUrl={form.photo || ""}
              onUpload={(url) => setForm({ ...form, photo: url })}
              onRemove={() => setForm({ ...form, photo: "" })}
            />

            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
              <label style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer", fontSize: ".82rem", fontWeight: 600, color: "#1C2E44" }}>
                <input type="checkbox" checked={form.isDirector || false} onChange={e => setForm({ ...form, isDirector: e.target.checked })} style={{ width: 16, height: 16, accentColor: "#1349A8" }} />
                Is Director / Co-Director
              </label>
            </div>

            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={saveTeacher} disabled={saving} style={s.btnP}>
                <i className="fas fa-save" style={{ marginRight: 6 }} />{saving ? "Saving..." : (editId ? "Update Teacher" : "Add Teacher")}
              </button>
              <button onClick={resetForm} style={s.btnGray}>Cancel</button>
            </div>
          </div>}

          {/* Teachers List */}
          {teachers.length > 0 ? teachers.map((t, i) => (
            <div key={t.id} style={{ ...s.card, display: "flex", alignItems: "center", gap: 16 }}>
              {/* Teacher Photo */}
              <div style={{
                width: 70, height: 70, borderRadius: 12, overflow: "hidden", flexShrink: 0, position: "relative",
                background: `linear-gradient(135deg, ${["#1349A8","#D98D04","#16A34A","#7C3AED","#DC2626","#059669"][i % 6]}, ${["#2A6FE0","#F5AC10","#4ADE80","#A78BFA","#F87171","#34D399"][i % 6]})`,
                display: "flex", alignItems: "center", justifyContent: "center"
              }}>
                {t.photo && t.photo.startsWith("http") ? (
                  <img src={t.photo} alt={t.name} style={{ width: "100%", height: "100%", objectFit: "cover" }}
                    onError={(e) => { e.currentTarget.style.display = "none"; }} />
                ) : null}
                {(!t.photo || !t.photo.startsWith("http")) && (
                  <i className="fas fa-user-tie" style={{ fontSize: "1.5rem", color: "rgba(255,255,255,.25)" }} />
                )}
              </div>

              {/* Teacher Info */}
              <div style={{ flex: 1 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4, flexWrap: "wrap" }}>
                  <div style={{ fontWeight: 700, fontSize: ".92rem", color: "#0B1826" }}>{t.name}</div>
                  <span style={s.badge("#1349A8", "#EFF6FF")}>{t.subject}</span>
                  {t.isDirector && <span style={s.badge("#D98D04", "#FEF3C7")}>Director</span>}
                </div>
                <div style={{ fontSize: ".78rem", color: "#4A5E78", display: "flex", flexWrap: "wrap", gap: 12 }}>
                  {t.qualification && <span><i className="fas fa-graduation-cap" style={{ marginRight: 4, color: "#6B7F99" }} />{t.qualification}</span>}
                  {t.experience && <span><i className="fas fa-briefcase" style={{ marginRight: 4, color: "#6B7F99" }} />{t.experience}</span>}
                  {t.classes && <span><i className="fas fa-chalkboard" style={{ marginRight: 4, color: "#6B7F99" }} />{t.classes}</span>}
                  {t.rfidCode && <span><i className="fas fa-id-card" style={{ marginRight: 4, color: "#7C3AED" }} /><span style={{ fontFamily: "monospace", fontSize: ".72rem" }}>{t.rfidCode}</span></span>}
                  {t.email && <span><i className="fas fa-envelope" style={{ marginRight: 4, color: "#DC2626" }} />{t.email}</span>}
                </div>
                {/* RFID Card Validity Status */}
                {t.cardValidFrom && t.cardValidTo && (() => {
                  const today = new Date().toISOString().split("T")[0];
                  const isActive = today >= t.cardValidFrom && today <= t.cardValidTo;
                  const isExpired = today > t.cardValidTo;
                  return <div style={{ fontSize: ".72rem", color: isActive ? "#16A34A" : isExpired ? "#DC2626" : "#D98D04", marginTop: 4, fontWeight: 600 }}>
                    <i className={`fas ${isActive ? "fa-check-circle" : isExpired ? "fa-times-circle" : "fa-clock"}`} style={{ marginRight: 4 }} />
                    Card: {t.cardValidFrom} → {t.cardValidTo} {isActive ? "(Active)" : isExpired ? "(Expired — RFID Deactivated)" : "(Upcoming)"}
                  </div>;
                })()}
                {!t.cardValidFrom && t.rfidCode && <div style={{ fontSize: ".72rem", color: "#D98D04", marginTop: 4 }}><i className="fas fa-exclamation-triangle" style={{ marginRight: 4 }} />Card validity dates set nahi hain — Edit karke add karo</div>}
                {!t.rfidCode && <div style={{ fontSize: ".72rem", color: "#DC2626", marginTop: 4 }}><i className="fas fa-exclamation-triangle" style={{ marginRight: 4 }} />RFID card assign nahi hua — Edit karke RFID add karo</div>}
                {(!t.photo || !t.photo.startsWith("http")) && <div style={{ fontSize: ".72rem", color: "#D98D04", marginTop: 4 }}><i className="fas fa-camera" style={{ marginRight: 4 }} />Photo not added yet</div>}
              </div>

              {/* Order */}
              <div style={{ textAlign: "center", flexShrink: 0 }}>
                <div style={{ fontSize: ".65rem", color: "#6B7F99" }}>Order</div>
                <div style={{ fontSize: "1rem", fontWeight: 700, color: "#1349A8" }}>{t.order || "—"}</div>
              </div>

              {/* Actions */}
              <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                <button onClick={() => { setEditId(t.id); setForm({ ...t }); setShowForm(true); }} style={s.btnO}><i className="fas fa-edit" /></button>
                <button onClick={() => deleteTeacher(t.id)} style={s.btnD}><i className="fas fa-trash" /></button>
              </div>
            </div>
          )) : (
            <div style={{ ...s.card, textAlign: "center", padding: 40 }}>
              <i className="fas fa-chalkboard-teacher" style={{ fontSize: "2.5rem", color: "#B0C4DC", marginBottom: 12 }} />
              <h3 style={{ fontSize: "1rem", fontWeight: 700, color: "#4A5E78", marginBottom: 6 }}>No Teachers Added Yet</h3>
              <p style={{ fontSize: ".84rem", color: "#6B7F99", marginBottom: 16 }}>Click "Load All Teachers" to add all PID teachers automatically, or add them one by one.</p>
            </div>
          )}

          {/* Tips */}
          <div style={{ marginTop: 16, background: "#FFFBEB", borderRadius: 12, padding: 16, border: "1px solid #FDE68A", fontSize: ".82rem", color: "#78350F", display: "flex", alignItems: "flex-start", gap: 10 }}>
            <i className="fas fa-lightbulb" style={{ marginTop: 2, flexShrink: 0, color: "#D98D04" }} />
            <div>
              <strong>Teacher Management Tips:</strong><br />
              • Teachers added here will appear on the homepage "Our Faculty" section<br />
              • "Upload Photo" button se direct photo upload karo — Firebase Storage mein save hogi<br />
              • Max photo size: 5MB (JPG, PNG, WebP)<br />
              • Use "Order" field to control the display sequence (1 = first, 2 = second, etc.)<br />
              • Mark directors with the "Is Director" checkbox — they will get a special badge
            </div>
          </div>
        </>}

        {/* ═══════════ STUDY MATERIALS TAB ═══════════ */}
        {tab === "materials" && <>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20, flexWrap: "wrap", gap: 10 }}>
            <div>
              <h2 style={{ fontSize: "1.3rem", fontWeight: 800 }}>Study Materials</h2>
              <p style={{ fontSize: ".78rem", color: "#6B7F99" }}>Total: {materials.length} materials · Notes: {materials.filter(m => m.materialType === "notes").length} · DPPs: {materials.filter(m => m.materialType === "dpp").length} · Lectures: {materials.filter(m => m.materialType === "lecture").length}</p>
            </div>
            <button onClick={() => { setShowForm(true); setEditId(null); setForm({ uploadDate: new Date().toISOString().split("T")[0] }); }} style={s.btnP}><i className="fas fa-plus" style={{ marginRight: 6 }} />Add Material</button>
          </div>

          {/* ═══ ADD/EDIT MATERIAL FORM ═══ */}
          {showForm && <div style={{ ...s.card, border: "2px solid #0891B2" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 18 }}>
              <div style={{ width: 40, height: 40, borderRadius: 10, background: "#E0F7FA", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <i className="fas fa-folder-open" style={{ color: "#0891B2", fontSize: "1rem" }} />
              </div>
              <div>
                <h3 style={{ fontSize: "1.05rem", fontWeight: 800, color: "#0B1826" }}>{editId ? "Edit Material" : "Upload Study Material"}</h3>
                <p style={{ fontSize: ".72rem", color: "#6B7F99" }}>Notes, DPP, Lecture, PYQ — daily basis par upload karo</p>
              </div>
            </div>

            {/* Course Select */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <div>
                <label style={s.label}>Course / Class *</label>
                <select style={s.input} value={form.courseId || ""} onChange={e => setForm({ ...form, courseId: e.target.value })}>
                  <option value="">Select Course</option>
                  {courses.map(c => <option key={c.id} value={c.classId || c.id}>{c.title} {c.tag ? `(${c.tag})` : ""}</option>)}
                </select>
              </div>
              <div>
                <label style={s.label}>Material Type *</label>
                <select style={s.input} value={form.materialType || ""} onChange={e => setForm({ ...form, materialType: e.target.value })}>
                  <option value="">Select Type</option>
                  {materialTypes.map(mt => <option key={mt.value} value={mt.value}>{mt.label}</option>)}
                </select>
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
              <div><label style={s.label}>Subject *</label><input style={s.input} placeholder="Physics / Maths / Science" value={form.subject || ""} onChange={e => setForm({ ...form, subject: e.target.value })} /></div>
              <div><label style={s.label}>Chapter / Topic</label><input style={s.input} placeholder="Chapter 1: Motion" value={form.chapter || ""} onChange={e => setForm({ ...form, chapter: e.target.value })} /></div>
              <div><label style={s.label}>Date</label><input style={s.input} type="date" value={form.uploadDate || ""} onChange={e => setForm({ ...form, uploadDate: e.target.value })} /></div>
            </div>

            <div><label style={s.label}>Title *</label><input style={s.input} placeholder="e.g. Newton's Laws of Motion — Notes" value={form.title || ""} onChange={e => setForm({ ...form, title: e.target.value })} /></div>
            <div><label style={s.label}>Description (optional)</label><textarea style={{ ...s.input, height: 50, resize: "none" }} placeholder="Brief description..." value={form.description || ""} onChange={e => setForm({ ...form, description: e.target.value })} /></div>

            {/* File Upload — PDF/Image */}
            {form.materialType !== "lecture" && (
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div>
                  <PDFUploader folder="study-materials" label="Upload PDF / Document" currentUrl={form.fileUrl || ""} onUpload={(url) => setForm({ ...form, fileUrl: url })} onRemove={() => setForm({ ...form, fileUrl: "" })} />
                </div>
                <div>
                  <ImageUploader folder="study-materials" label="Thumbnail / Cover (optional)" currentUrl={form.thumbnail || ""} onUpload={(url) => setForm({ ...form, thumbnail: url })} onRemove={() => setForm({ ...form, thumbnail: "" })} />
                </div>
              </div>
            )}

            {/* Video URL — for lectures */}
            {form.materialType === "lecture" && (
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div>
                  <label style={s.label}>Video URL (YouTube / embed link) *</label>
                  <input style={s.input} placeholder="https://youtube.com/watch?v=... or embed URL" value={form.videoUrl || ""} onChange={e => setForm({ ...form, videoUrl: e.target.value })} />
                </div>
                <div>
                  <label style={s.label}>Video Duration</label>
                  <input style={s.input} placeholder="e.g. 45 min" value={form.duration || ""} onChange={e => setForm({ ...form, duration: e.target.value })} />
                </div>
              </div>
            )}

            {/* Also allow PDF with lecture */}
            {form.materialType === "lecture" && (
              <PDFUploader folder="study-materials" label="Lecture Notes PDF (optional)" currentUrl={form.fileUrl || ""} onUpload={(url) => setForm({ ...form, fileUrl: url })} onRemove={() => setForm({ ...form, fileUrl: "" })} />
            )}

            <div style={{ display: "flex", gap: 10, marginTop: 10 }}>
              <button onClick={saveMaterial} disabled={saving} style={{ ...s.btnP, padding: "11px 24px" }}>
                <i className="fas fa-save" style={{ marginRight: 6 }} />{saving ? "Saving..." : (editId ? "Update Material" : "Upload Material")}
              </button>
              <button onClick={resetForm} style={s.btnGray}>Cancel</button>
            </div>
          </div>}

          {/* ═══ FILTER BAR ═══ */}
          {!showForm && <>
            <div style={{ display: "flex", gap: 10, marginBottom: 16, flexWrap: "wrap" }}>
              <select style={{ ...s.input, width: 180 }} value={matCourse} onChange={e => setMatCourse(e.target.value)}>
                <option value="">All Courses</option>
                {courses.map(c => <option key={c.id} value={c.classId || c.id}>{c.title}</option>)}
              </select>
              <input style={{ ...s.input, flex: 1, minWidth: 150 }} placeholder="Filter by subject..." value={matSubject} onChange={e => setMatSubject(e.target.value)} />
              <select style={{ ...s.input, width: 160 }} value={matType} onChange={e => setMatType(e.target.value)}>
                <option value="all">All Types</option>
                {materialTypes.map(mt => <option key={mt.value} value={mt.value}>{mt.label}</option>)}
              </select>
            </div>

            {/* ═══ MATERIALS LIST ═══ */}
            {(() => {
              let list = materials;
              if (matCourse) list = list.filter(m => m.courseId === matCourse);
              if (matSubject.trim()) list = list.filter(m => m.subject?.toLowerCase().includes(matSubject.toLowerCase()));
              if (matType !== "all") list = list.filter(m => m.materialType === matType);

              // Group by course
              const grouped = {};
              list.forEach(m => {
                const key = m.courseTitle || m.courseId || "Other";
                if (!grouped[key]) grouped[key] = [];
                grouped[key].push(m);
              });

              return Object.keys(grouped).length > 0 ? Object.entries(grouped).map(([courseName, items]) => (
                <div key={courseName} style={{ marginBottom: 20 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10, padding: "8px 14px", background: "#fff", borderRadius: 10, border: "1px solid #D4DEF0" }}>
                    <i className="fas fa-book" style={{ color: "#1349A8", fontSize: ".85rem" }} />
                    <span style={{ fontWeight: 700, fontSize: ".9rem", color: "#0B1826" }}>{courseName}</span>
                    <span style={{ fontSize: ".72rem", color: "#6B7F99", marginLeft: 6 }}>{items.length} materials</span>
                  </div>
                  {items.map(m => {
                    const mt = getMaterialIcon(m.materialType);
                    return (
                      <div key={m.id} style={{ ...s.card, display: "flex", alignItems: "center", gap: 14, marginBottom: 10 }}>
                        {/* Type Icon */}
                        <div style={{ width: 44, height: 44, borderRadius: 10, background: `${mt.color}15`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                          <i className={`fas ${mt.icon}`} style={{ color: mt.color, fontSize: "1rem" }} />
                        </div>

                        {/* Info */}
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 3, flexWrap: "wrap" }}>
                            <span style={{ fontWeight: 700, fontSize: ".88rem", color: "#0B1826" }}>{m.title}</span>
                            <span style={s.badge(mt.color, `${mt.color}15`)}>{mt.label}</span>
                          </div>
                          <div style={{ fontSize: ".76rem", color: "#4A5E78", display: "flex", flexWrap: "wrap", gap: 10 }}>
                            <span><i className="fas fa-book" style={{ marginRight: 3, color: "#6B7F99" }} />{m.subject}</span>
                            {m.chapter && <span><i className="fas fa-bookmark" style={{ marginRight: 3, color: "#6B7F99" }} />{m.chapter}</span>}
                            {m.uploadDate && <span><i className="fas fa-calendar" style={{ marginRight: 3, color: "#6B7F99" }} />{m.uploadDate}</span>}
                            {m.duration && <span><i className="fas fa-clock" style={{ marginRight: 3, color: "#6B7F99" }} />{m.duration}</span>}
                          </div>
                        </div>

                        {/* File/Video Links */}
                        <div style={{ display: "flex", gap: 6, flexShrink: 0, alignItems: "center" }}>
                          {m.fileUrl && <a href={m.fileUrl} target="_blank" rel="noopener noreferrer" style={{ ...s.btnG, padding: "6px 10px", textDecoration: "none", display: "flex", alignItems: "center", gap: 4 }}><i className="fas fa-download" style={{ fontSize: ".7rem" }} /> PDF</a>}
                          {m.videoUrl && <a href={m.videoUrl} target="_blank" rel="noopener noreferrer" style={{ ...s.btnP, padding: "6px 10px", textDecoration: "none", display: "flex", alignItems: "center", gap: 4, fontSize: ".74rem" }}><i className="fas fa-play" style={{ fontSize: ".65rem" }} /> Video</a>}
                        </div>

                        {/* Actions */}
                        <div style={{ display: "flex", flexDirection: "column", gap: 4, flexShrink: 0 }}>
                          <button onClick={() => { setEditId(m.id); setForm({ ...m }); setShowForm(true); }} style={s.btnO}><i className="fas fa-edit" /></button>
                          <button onClick={() => deleteMaterial(m.id)} style={s.btnD}><i className="fas fa-trash" /></button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )) : (
                <div style={{ ...s.card, textAlign: "center", padding: 40 }}>
                  <i className="fas fa-folder-open" style={{ fontSize: "2.5rem", color: "#B0C4DC", marginBottom: 12 }} />
                  <h3 style={{ fontSize: "1rem", fontWeight: 700, color: "#4A5E78", marginBottom: 6 }}>No Study Materials Yet</h3>
                  <p style={{ fontSize: ".84rem", color: "#6B7F99", marginBottom: 16 }}>Click "Add Material" to upload notes, DPPs, video lectures, or previous year papers.</p>
                  <p style={{ fontSize: ".78rem", color: "#6B7F99" }}>Pehle "Courses & Batches" tab me courses create karo, phir yahan materials add karo.</p>
                </div>
              );
            })()}
          </>}

          {/* Tips */}
          <div style={{ marginTop: 16, background: "#FFFBEB", borderRadius: 12, padding: 16, border: "1px solid #FDE68A", fontSize: ".82rem", color: "#78350F", display: "flex", alignItems: "flex-start", gap: 10 }}>
            <i className="fas fa-lightbulb" style={{ marginTop: 2, flexShrink: 0, color: "#D98D04" }} />
            <div>
              <strong>Study Materials Tips:</strong><br />
              • Pehle "Courses & Batches" tab me courses banao — phir yahan materials add karo<br />
              • PDF max size: 20MB · Image max size: 5MB<br />
              • 6 types available: Notes, DPP, Video Lecture, PYQ, PDF, Assignment<br />
              • Video lectures ke liye YouTube link daalo — with optional lecture notes PDF<br />
              • Subject + Chapter fill karo — students ko organized dikhega<br />
              • Ye materials Student Portal aur Student App dono me dikhenge
            </div>
          </div>
        </>}

        {/* ═══════════ STUDENTS TAB (Admission Form) ═══════════ */}
        {tab === "students" && <>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20, flexWrap: "wrap", gap: 10 }}>
            <div>
              <h2 style={{ fontSize: "1.3rem", fontWeight: 800 }}>Student Management</h2>
              <p style={{ fontSize: ".78rem", color: "#6B7F99" }}>Total: {students.length} students · Active: {students.filter(x => x.status === "active").length} · Inactive: {students.filter(x => x.status === "inactive").length}</p>
            </div>
            <button onClick={() => { setShowForm(true); setEditId(null); setForm({ formNo: genFormNo(), submissionDate: new Date().toISOString().split("T")[0], status: "active" }); }} style={s.btnP}><i className="fas fa-plus" style={{ marginRight: 6 }} />New Admission</button>
          </div>

          {/* ═══ ADMISSION FORM ═══ */}
          {showForm && <div style={{ ...s.card, border: "2px solid #059669" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 20 }}>
              <div style={{ width: 40, height: 40, borderRadius: 10, background: "#F0FDF4", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <i className="fas fa-user-graduate" style={{ color: "#059669", fontSize: "1rem" }} />
              </div>
              <div>
                <h3 style={{ fontSize: "1.05rem", fontWeight: 800, color: "#0B1826" }}>{editId ? "Edit Student" : "New Admission Form"}</h3>
                <p style={{ fontSize: ".72rem", color: "#6B7F99" }}>Patel Institute Dongargaon — Reg. No. 122201880553</p>
              </div>
              <div style={{ marginLeft: "auto", textAlign: "right" }}>
                <div style={{ fontSize: ".72rem", color: "#6B7F99" }}>Form No.</div>
                <div style={{ fontSize: ".85rem", fontWeight: 700, color: "#1349A8" }}>{form.formNo || "—"}</div>
              </div>
            </div>

            {/* Profile Photo + RFID */}
            <div style={{ display: "flex", gap: 20, marginBottom: 16, flexWrap: "wrap", alignItems: "flex-end" }}>
              <ImageUploader folder="students" label="Student Photo (Passport Size)" currentUrl={form.photo || ""} onUpload={(url) => setForm({ ...form, photo: url })} onRemove={() => setForm({ ...form, photo: "" })} />
              <div style={{ flex: 1, minWidth: 200 }}>
                <label style={s.label}>RFID Number / Code (Digital Attendance) <i className="fas fa-id-card" style={{ color: "#7C3AED", fontSize: ".7rem" }} /></label>
                <input style={{ ...s.input, borderColor: form.rfidCode ? "#86EFAC" : "#C0D0E8", fontFamily: "monospace", letterSpacing: 1 }} placeholder="Scan or enter RFID card number" value={form.rfidCode || ""} onChange={e => setForm({ ...form, rfidCode: e.target.value.toUpperCase().replace(/\s+/g, "").trim() })} />
                <p style={{ fontSize: ".68rem", color: form.rfidCode ? "#16A34A" : "#6B7F99", marginTop: -6 }}>
                  {form.rfidCode ? `✓ RFID Set: ${form.rfidCode}` : "Ye code student ke RFID card se scan hoga attendance ke liye"}
                </p>
              </div>
            </div>

            {/* ── BATCH DURATION & ENROLLMENT FEE ── */}
            <div style={{ ...s.sectionTitle, marginTop: 8 }}><i className="fas fa-calendar-check" style={{ color: "#E11D48" }} /> Batch Duration & Enrollment Fee</div>
            <div style={{ background: "#FFF7ED", borderRadius: 10, padding: 14, border: "1px solid #FED7AA", marginBottom: 12 }}>
              <p style={{ fontSize: ".76rem", color: "#9A3412", margin: 0 }}><i className="fas fa-info-circle" style={{ marginRight: 4 }} /> Batch ki start date se student ka attendance count shuru hoga. End date ke baad tap in/out se absent nahi lagega.</p>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
              <div>
                <label style={s.label}>Batch Start Date *</label>
                <input style={s.input} type="date" value={form.batchStartDate || ""} onChange={e => setForm({ ...form, batchStartDate: e.target.value })} />
              </div>
              <div>
                <label style={s.label}>Batch End Date *</label>
                <input style={s.input} type="date" value={form.batchEndDate || ""} onChange={e => setForm({ ...form, batchEndDate: e.target.value })} />
              </div>
              <div>
                <label style={s.label}>Batch Validity</label>
                <div style={{ padding: "9px 12px", borderRadius: 8, background: "#F0FDF4", border: "1px solid #BBF7D0", fontSize: ".82rem", fontWeight: 600, color: form.batchStartDate && form.batchEndDate ? "#166534" : "#6B7F99", minHeight: 38, display: "flex", alignItems: "center" }}>
                  {form.batchStartDate && form.batchEndDate ? (() => {
                    const start = new Date(form.batchStartDate);
                    const end = new Date(form.batchEndDate);
                    const months = Math.round((end - start) / (1000 * 60 * 60 * 24 * 30));
                    const today = new Date();
                    const isActive = today >= start && today <= end;
                    return <><i className={`fas ${isActive ? "fa-check-circle" : "fa-clock"}`} style={{ marginRight: 6, color: isActive ? "#16A34A" : "#D98D04" }} />{months} months {isActive ? "(Active)" : today < start ? "(Upcoming)" : "(Expired)"}</>;
                  })() : "Start & End date select karo"}
                </div>
              </div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
              <div>
                <label style={s.label}>Total Course Fee (₹)</label>
                <input style={s.input} type="number" placeholder="e.g. 24000" value={form.totalFee || ""} onChange={e => setForm({ ...form, totalFee: e.target.value })} />
              </div>
              <div>
                <label style={s.label}>Enrollment Fee Status</label>
                <div style={{ display: "flex", gap: 8, marginTop: 2 }}>
                  <button type="button"
                    onClick={() => setForm({ ...form, enrollmentFeePaid: "paid" })}
                    style={{ flex: 1, padding: "9px 0", borderRadius: 8, border: `2px solid ${form.enrollmentFeePaid === "paid" ? "#16A34A" : "#D4DEF0"}`, background: form.enrollmentFeePaid === "paid" ? "#F0FDF4" : "#F8FAFD", color: form.enrollmentFeePaid === "paid" ? "#16A34A" : "#6B7F99", fontWeight: 700, fontSize: ".8rem", cursor: "pointer" }}>
                    <i className="fas fa-check-circle" style={{ marginRight: 4 }} />Paid
                  </button>
                  <button type="button"
                    onClick={() => setForm({ ...form, enrollmentFeePaid: "not_paid" })}
                    style={{ flex: 1, padding: "9px 0", borderRadius: 8, border: `2px solid ${form.enrollmentFeePaid === "not_paid" ? "#DC2626" : "#D4DEF0"}`, background: form.enrollmentFeePaid === "not_paid" ? "#FEF2F2" : "#F8FAFD", color: form.enrollmentFeePaid === "not_paid" ? "#DC2626" : "#6B7F99", fontWeight: 700, fontSize: ".8rem", cursor: "pointer" }}>
                    <i className="fas fa-times-circle" style={{ marginRight: 4 }} />Not Paid
                  </button>
                </div>
              </div>
              <div>
                <label style={s.label}>Remaining Fee</label>
                <div style={{ padding: "9px 12px", borderRadius: 8, background: form.totalFee ? "#FEF2F2" : "#F8FAFD", border: "1px solid #D4DEF0", fontSize: ".85rem", fontWeight: 700, color: form.totalFee ? "#DC2626" : "#6B7F99", minHeight: 38, display: "flex", alignItems: "center" }}>
                  {form.totalFee ? `₹${Number(form.totalFee).toLocaleString("en-IN")}` : "—"}
                </div>
              </div>
            </div>

            {/* ── 1st INSTALLMENT AMOUNT + SUBJECT DISTRIBUTION ── */}
            <div style={{ background: "#F0FDF4", borderRadius: 10, padding: 14, border: "1px solid #86EFAC", marginBottom: 12, marginTop: 4 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10, flexWrap: "wrap", gap: 8 }}>
                <p style={{ fontSize: ".82rem", fontWeight: 700, color: "#166534", margin: 0 }}><i className="fas fa-rupee-sign" style={{ marginRight: 6 }} />1st Installment — Amount & Subject Distribution</p>
                <button type="button"
                  onClick={() => {
                    const amt = Number(form.inst1Amount || 0);
                    if (!amt) return;
                    const subs = [form.subject1, form.subject2, form.subject3, form.subject4, form.subject5, form.subject6].filter(Boolean);
                    if (!subs.length) return;
                    const each = Math.floor(amt / subs.length);
                    const rem = amt - (each * subs.length);
                    const newForm = { ...form };
                    subs.forEach((_, i) => { newForm[`fee${i + 1}`] = String(i === 0 ? each + rem : each); });
                    setForm(newForm);
                  }}
                  style={{ padding: "6px 14px", borderRadius: 7, border: "1px solid #16A34A", background: "#16A34A", color: "#fff", fontSize: ".75rem", fontWeight: 700, cursor: "pointer" }}>
                  <i className="fas fa-magic" style={{ marginRight: 5 }} />Auto Distribute
                </button>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 }}>
                <div>
                  <label style={s.label}>1st Installment Amount (₹) *</label>
                  <input style={{ ...s.input, borderColor: "#86EFAC" }} type="number" placeholder="e.g. 8000" value={form.inst1Amount || ""}
                    onChange={e => setForm({ ...form, inst1Amount: e.target.value })} />
                </div>
                <div>
                  <label style={s.label}>Payment Date</label>
                  <input style={s.input} type="date" value={form.inst1Date || new Date().toISOString().split("T")[0]}
                    onChange={e => setForm({ ...form, inst1Date: e.target.value })} />
                </div>
              </div>
              <p style={{ fontSize: ".72rem", color: "#166534", margin: "0 0 8px" }}><i className="fas fa-info-circle" style={{ marginRight: 4 }} />Auto Distribute dabao — amount subjects me barabar distribute ho jayegi. Manually bhi change kar sakte ho.</p>
              {/* Subject Fee distribution (shared with Subject-wise Fee section) */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
                {[1,2,3,4,5,6].map(n => form[`subject${n}`] ? (
                  <div key={n}>
                    <label style={{ ...s.label, color: "#166534" }}>{form[`subject${n}`]} Fee (₹)</label>
                    <input style={{ ...s.input, borderColor: "#86EFAC" }} type="number" placeholder="0"
                      value={form[`fee${n}`] || ""}
                      onChange={e => {
                        const newForm = { ...form, [`fee${n}`]: e.target.value };
                        const total = [1,2,3,4,5,6].reduce((s, i) => s + Number(newForm[`fee${i}`] || 0), 0);
                        setForm({ ...newForm, inst1Amount: String(total) });
                      }} />
                  </div>
                ) : null)}
              </div>
            </div>

            {/* ── 2nd INSTALLMENT (optional) ── */}
            <div style={{ background: "#EFF6FF", borderRadius: 10, padding: 14, border: "1px solid #BFDBFE", marginBottom: 12 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10, flexWrap: "wrap", gap: 8 }}>
                <p style={{ fontSize: ".82rem", fontWeight: 700, color: "#1E3A8A", margin: 0 }}><i className="fas fa-layer-group" style={{ marginRight: 6 }} />2nd Installment (Optional)</p>
                <button type="button"
                  onClick={() => {
                    const amt = Number(form.inst2Amount || 0);
                    if (!amt) return;
                    const subs = [form.subject1, form.subject2, form.subject3, form.subject4, form.subject5, form.subject6].filter(Boolean);
                    if (!subs.length) return;
                    const each = Math.floor(amt / subs.length);
                    const rem = amt - (each * subs.length);
                    const newForm = { ...form };
                    subs.forEach((_, i) => { newForm[`fee2_sub${i + 1}`] = String(i === 0 ? each + rem : each); });
                    setForm(newForm);
                  }}
                  style={{ padding: "6px 14px", borderRadius: 7, border: "1px solid #1349A8", background: "#1349A8", color: "#fff", fontSize: ".75rem", fontWeight: 700, cursor: "pointer" }}>
                  <i className="fas fa-magic" style={{ marginRight: 5 }} />Auto Distribute
                </button>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 }}>
                <div>
                  <label style={s.label}>2nd Installment Amount (₹)</label>
                  <input style={{ ...s.input, borderColor: "#BFDBFE" }} type="number" placeholder="e.g. 8000" value={form.inst2Amount || ""}
                    onChange={e => setForm({ ...form, inst2Amount: e.target.value })} />
                </div>
                <div>
                  <label style={s.label}>Payment Date</label>
                  <input style={s.input} type="date" value={form.inst2Date || ""}
                    onChange={e => setForm({ ...form, inst2Date: e.target.value })} />
                </div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
                {[1,2,3,4,5,6].map(n => form[`subject${n}`] ? (
                  <div key={n}>
                    <label style={{ ...s.label, color: "#1E3A8A" }}>{form[`subject${n}`]} Fee (₹)</label>
                    <input style={{ ...s.input, borderColor: "#BFDBFE" }} type="number" placeholder="0"
                      value={form[`fee2_sub${n}`] || ""}
                      onChange={e => {
                        const newForm = { ...form, [`fee2_sub${n}`]: e.target.value };
                        const total = [1,2,3,4,5,6].reduce((s, i) => s + Number(newForm[`fee2_sub${i}`] || 0), 0);
                        setForm({ ...newForm, inst2Amount: String(total) });
                      }} />
                  </div>
                ) : null)}
              </div>
            </div>

            {/* ── CLASS AND SUBJECT DETAIL ── */}
            <div style={{ ...s.sectionTitle, marginTop: 8 }}><i className="fas fa-book" style={{ color: "#1349A8" }} /> Class & Subject Details</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
              <div><label style={s.label}>Class *</label><select style={s.input} value={form.class || ""} onChange={e => setForm({ ...form, class: e.target.value })}><option value="">Select</option><option>2nd</option><option>3rd</option><option>4th</option><option>5th</option><option>6th</option><option>7th</option><option>8th</option><option>9th</option><option>10th</option><option>11th</option><option>12th</option></select></div>
              <div><label style={s.label}>Medium</label><select style={s.input} value={form.medium || ""} onChange={e => setForm({ ...form, medium: e.target.value })}><option value="">Select</option><option>Hindi</option><option>English</option></select></div>
              <div><label style={s.label}>Board</label><select style={s.input} value={form.board || ""} onChange={e => setForm({ ...form, board: e.target.value })}><option value="">Select</option><option>CG Board</option><option>CBSE</option><option>ICSE</option></select></div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
              <div><label style={s.label}>Subject 1</label><input style={s.input} placeholder="Physics / Science" value={form.subject1 || ""} onChange={e => setForm({ ...form, subject1: e.target.value })} /></div>
              <div><label style={s.label}>Subject 2</label><input style={s.input} placeholder="Chemistry / Maths" value={form.subject2 || ""} onChange={e => setForm({ ...form, subject2: e.target.value })} /></div>
              <div><label style={s.label}>Subject 3</label><input style={s.input} placeholder="Maths / Bio" value={form.subject3 || ""} onChange={e => setForm({ ...form, subject3: e.target.value })} /></div>
            </div>

            {/* ── SUBJECT-WISE FEE (Receipt ke liye) — 1st installment ke saath sync ── */}
            <div style={{ ...s.sectionTitle, marginTop: 8 }}><i className="fas fa-receipt" style={{ color: "#D98D04" }} /> Subject Names (4, 5, 6)</div>
            <div style={{ background: "#FFFBEB", borderRadius: 10, padding: 14, border: "1px solid #FDE68A", marginBottom: 12 }}>
              <p style={{ fontSize: ".76rem", color: "#92400E", margin: "0 0 10px 0" }}><i className="fas fa-info-circle" style={{ marginRight: 4 }} /> Subjects 4, 5, 6 ke naam yahan bharo. Fee distribution upar 1st/2nd Installment section me hogi.</p>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
                <div><label style={s.label}>Subject 4 Name</label><input style={s.input} placeholder="Science / English" value={form.subject4 || ""} onChange={e => setForm({ ...form, subject4: e.target.value })} /></div>
                <div><label style={s.label}>Subject 5 Name</label><input style={s.input} placeholder="English / SST" value={form.subject5 || ""} onChange={e => setForm({ ...form, subject5: e.target.value })} /></div>
                <div><label style={s.label}>Subject 6 Name</label><input style={s.input} placeholder="Social Study" value={form.subject6 || ""} onChange={e => setForm({ ...form, subject6: e.target.value })} /></div>
              </div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
              <div><label style={s.label}>Navodaya Vidyalaya</label><select style={s.input} value={form.navodaya || ""} onChange={e => setForm({ ...form, navodaya: e.target.value })}><option value="">Select</option><option>Yes</option><option>No</option></select></div>
              <div><label style={s.label}>Prayas Aavashiy Vidyalaya</label><select style={s.input} value={form.prayas || ""} onChange={e => setForm({ ...form, prayas: e.target.value })}><option value="">Select</option><option>Yes</option><option>No</option></select></div>
              <div><label style={s.label}>IIT-JEE / NEET Foundation</label><select style={s.input} value={form.competitive || ""} onChange={e => setForm({ ...form, competitive: e.target.value })}><option value="">Select</option><option>IIT-JEE</option><option>NEET</option><option>Both</option><option>No</option></select></div>
            </div>

            {/* ── STUDENT DETAILS ── */}
            <div style={{ ...s.sectionTitle, marginTop: 8 }}><i className="fas fa-user" style={{ color: "#059669" }} /> Student Details</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <div><label style={s.label}>Student Name *</label><input style={s.input} placeholder="Full name" value={form.studentName || ""} onChange={e => setForm({ ...form, studentName: e.target.value })} /></div>
              <div><label style={s.label}>Date of Birth</label><input style={s.input} type="date" value={form.dob || ""} onChange={e => setForm({ ...form, dob: e.target.value })} /></div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <div><label style={s.label}>Birth Place</label><input style={s.input} placeholder="City / Village" value={form.birthPlace || ""} onChange={e => setForm({ ...form, birthPlace: e.target.value })} /></div>
              <div><label style={s.label}>E-mail (Gmail) *</label><input style={s.input} type="email" placeholder="student@gmail.com — Login ke liye" value={form.studentEmail || ""} onChange={e => setForm({ ...form, studentEmail: e.target.value })} /></div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <div><label style={s.label}>Mobile Number *</label><input style={s.input} type="tel" placeholder="Student mobile" value={form.studentPhone || ""} onChange={e => setForm({ ...form, studentPhone: e.target.value })} /></div>
              <div><label style={s.label}>WhatsApp Number</label><input style={s.input} type="tel" placeholder="WhatsApp number" value={form.studentWhatsapp || ""} onChange={e => setForm({ ...form, studentWhatsapp: e.target.value })} /></div>
            </div>

            {/* ── PARENTS DETAILS ── */}
            <div style={{ ...s.sectionTitle, marginTop: 8 }}><i className="fas fa-users" style={{ color: "#D98D04" }} /> Parents Details</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <div><label style={s.label}>Father&apos;s Name</label><input style={s.input} placeholder="Father's full name" value={form.fatherName || ""} onChange={e => setForm({ ...form, fatherName: e.target.value })} /></div>
              <div><label style={s.label}>Father&apos;s Last Name</label><input style={s.input} placeholder="Last name" value={form.fatherLastName || ""} onChange={e => setForm({ ...form, fatherLastName: e.target.value })} /></div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <div><label style={s.label}>Mother&apos;s Name</label><input style={s.input} placeholder="Mother's full name" value={form.motherName || ""} onChange={e => setForm({ ...form, motherName: e.target.value })} /></div>
              <div><label style={s.label}>Mother&apos;s Last Name</label><input style={s.input} placeholder="Last name" value={form.motherLastName || ""} onChange={e => setForm({ ...form, motherLastName: e.target.value })} /></div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <div><label style={s.label}>Parent Mobile</label><input style={s.input} type="tel" placeholder="Parent mobile" value={form.parentPhone || ""} onChange={e => setForm({ ...form, parentPhone: e.target.value })} /></div>
              <div><label style={s.label}>Parent WhatsApp</label><input style={s.input} type="tel" placeholder="Parent WhatsApp" value={form.parentWhatsapp || ""} onChange={e => setForm({ ...form, parentWhatsapp: e.target.value })} /></div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <div><label style={s.label}>Mother&apos;s Occupation</label><input style={s.input} placeholder="Occupation" value={form.motherOccupation || ""} onChange={e => setForm({ ...form, motherOccupation: e.target.value })} /></div>
              <div><label style={s.label}>Father&apos;s Occupation</label><input style={s.input} placeholder="Occupation" value={form.fatherOccupation || ""} onChange={e => setForm({ ...form, fatherOccupation: e.target.value })} /></div>
            </div>
            <div><label style={s.label}>Permanent Address</label><textarea style={{ ...s.input, height: 50, resize: "none" }} placeholder="Full permanent address" value={form.permanentAddress || ""} onChange={e => setForm({ ...form, permanentAddress: e.target.value })} /></div>
            <div style={{ display: "grid", gridTemplateColumns: "3fr 1fr", gap: 10 }}>
              <div><label style={s.label}>Residential Address</label><input style={s.input} placeholder="If different from permanent" value={form.residentialAddress || ""} onChange={e => setForm({ ...form, residentialAddress: e.target.value })} /></div>
              <div><label style={s.label}>PIN Code</label><input style={s.input} placeholder="491445" value={form.pinCode || ""} onChange={e => setForm({ ...form, pinCode: e.target.value })} /></div>
            </div>
            <div><label style={s.label}>Parent E-mail</label><input style={s.input} type="email" placeholder="parent@email.com" value={form.parentEmail || ""} onChange={e => setForm({ ...form, parentEmail: e.target.value })} /></div>

            {/* ── SCHOOL DETAILS ── */}
            <div style={{ ...s.sectionTitle, marginTop: 8 }}><i className="fas fa-school" style={{ color: "#7C3AED" }} /> School Details</div>
            <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1fr", gap: 10 }}>
              <div><label style={s.label}>School Name</label><input style={s.input} placeholder="Name of school" value={form.schoolName || ""} onChange={e => setForm({ ...form, schoolName: e.target.value })} /></div>
              <div><label style={s.label}>Present Class</label><input style={s.input} placeholder="10th" value={form.presentClass || ""} onChange={e => setForm({ ...form, presentClass: e.target.value })} /></div>
              <div><label style={s.label}>Last Year %</label><input style={s.input} placeholder="85%" value={form.lastYearPercent || ""} onChange={e => setForm({ ...form, lastYearPercent: e.target.value })} /></div>
              <div><label style={s.label}>School Medium</label><select style={s.input} value={form.schoolMedium || ""} onChange={e => setForm({ ...form, schoolMedium: e.target.value })}><option value="">Select</option><option>Hindi</option><option>English</option></select></div>
            </div>

            {/* ── FORM META ── */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 8 }}>
              <div><label style={s.label}>Form Number</label><input style={s.input} value={form.formNo || ""} onChange={e => setForm({ ...form, formNo: e.target.value })} /></div>
              <div><label style={s.label}>Submission Date</label><input style={s.input} type="date" value={form.submissionDate || ""} onChange={e => setForm({ ...form, submissionDate: e.target.value })} /></div>
            </div>

            {/* Action Buttons */}
            <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
              <button onClick={saveStudent} disabled={saving} style={{ ...s.btnP, padding: "11px 24px" }}>
                <i className="fas fa-save" style={{ marginRight: 6 }} />{saving ? "Saving..." : (editId ? "Update Student" : "Enroll Student")}
              </button>
              <button onClick={resetForm} style={s.btnGray}>Cancel</button>
            </div>
          </div>}

          {/* ═══ SEARCH & FILTER ═══ */}
          {!showForm && <div style={{ display: "flex", gap: 10, marginBottom: 16, flexWrap: "wrap" }}>
            <div style={{ flex: 1, minWidth: 200 }}>
              <input style={s.input} placeholder="Search by name, email, class, RFID..." value={studentSearch} onChange={e => setStudentSearch(e.target.value)} />
            </div>
            <select style={{ ...s.input, width: 160 }} value={studentFilter} onChange={e => setStudentFilter(e.target.value)}>
              <option value="all">All Students</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
              <option value="12th">Class 12</option>
              <option value="11th">Class 11</option>
              <option value="10th">Class 10</option>
              <option value="9th">Class 9</option>
            </select>
          </div>}

          {/* ═══ STUDENTS LIST ═══ */}
          {!showForm && (() => {
            let list = students;
            if (studentFilter !== "all") {
              if (studentFilter === "active" || studentFilter === "inactive") list = list.filter(x => x.status === studentFilter);
              else list = list.filter(x => x.class?.includes(studentFilter.replace("th", "")));
            }
            if (studentSearch.trim()) {
              const q = studentSearch.toLowerCase();
              list = list.filter(x => x.studentName?.toLowerCase().includes(q) || x.studentEmail?.toLowerCase().includes(q) || x.class?.toLowerCase().includes(q) || x.rfidCode?.toLowerCase().includes(q) || x.formNo?.toLowerCase().includes(q));
            }
            return list.length > 0 ? list.map(st => (
              <div key={st.id} style={{ ...s.card, display: "flex", alignItems: "center", gap: 14, borderLeft: `4px solid ${st.status === "active" ? "#16A34A" : "#B0C4DC"}` }}>
                {/* Photo */}
                <div style={{ width: 56, height: 56, borderRadius: 10, overflow: "hidden", flexShrink: 0, background: "linear-gradient(135deg,#1349A8,#2A6FE0)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  {st.photo && st.photo.startsWith("http") ? (
                    <img src={st.photo} alt={st.studentName} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                  ) : (
                    <span style={{ color: "#fff", fontWeight: 700, fontSize: "1.2rem" }}>{st.studentName?.charAt(0)?.toUpperCase()}</span>
                  )}
                </div>

                {/* Info */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 3, flexWrap: "wrap" }}>
                    <span style={{ fontWeight: 700, fontSize: ".9rem", color: "#0B1826" }}>{st.studentName}</span>
                    <span style={s.badge("#1349A8", "#EFF6FF")}>Class {st.class}</span>
                    <span style={s.badge(st.status === "active" ? "#16A34A" : "#6B7F99", st.status === "active" ? "#F0FDF4" : "#F0F4FA")}>{st.status}</span>
                    {st.rfidCode && <span style={s.badge("#7C3AED", "#FAF5FF")}><i className="fas fa-id-card" style={{ marginRight: 3, fontSize: ".55rem" }} />{st.rfidCode}</span>}
                  </div>
                  <div style={{ fontSize: ".76rem", color: "#4A5E78", display: "flex", flexWrap: "wrap", gap: 10 }}>
                    <span><i className="fas fa-envelope" style={{ marginRight: 3, color: "#6B7F99" }} />{st.studentEmail}</span>
                    <span><i className="fas fa-phone" style={{ marginRight: 3, color: "#6B7F99" }} />{st.studentPhone}</span>
                    {st.board && <span><i className="fas fa-book" style={{ marginRight: 3, color: "#6B7F99" }} />{st.board} · {st.medium}</span>}
                  </div>
                  <div style={{ fontSize: ".68rem", color: "#6B7F99", marginTop: 2, display: "flex", flexWrap: "wrap", gap: 10 }}>
                    <span>Form: {st.formNo || "—"}</span>
                    {st.fatherName && <span>Father: {st.fatherName}</span>}
                    <span>{formatDate(st.createdAt)}</span>
                    {st.batchStartDate && st.batchEndDate && (() => {
                      const today = new Date().toISOString().split("T")[0];
                      const isActive = today >= st.batchStartDate && today <= st.batchEndDate;
                      const isExpired = today > st.batchEndDate;
                      return <span style={{ color: isActive ? "#16A34A" : isExpired ? "#DC2626" : "#D98D04", fontWeight: 600 }}>
                        <i className={`fas ${isActive ? "fa-check-circle" : isExpired ? "fa-times-circle" : "fa-clock"}`} style={{ marginRight: 3 }} />
                        Batch: {st.batchStartDate} → {st.batchEndDate} {isActive ? "(Active)" : isExpired ? "(Expired)" : "(Upcoming)"}
                      </span>;
                    })()}
                    {st.totalFee && (() => {
                      const instPaid = Number(st.inst1Amount || 0) + Number(st.inst2Amount || 0) + Number(st.inst3Amount || 0);
                      const dueAmt = Math.max(0, Number(st.totalFee) - instPaid);
                      return <span style={{ color: dueAmt > 0 ? "#DC2626" : "#16A34A", fontWeight: 600 }}>
                        <i className="fas fa-rupee-sign" style={{ marginRight: 3 }} />
                        {instPaid > 0 ? `Paid: ₹${instPaid.toLocaleString("en-IN")} · ` : ""}Due: ₹{dueAmt.toLocaleString("en-IN")}
                      </span>;
                    })()}
                  </div>
                </div>

                {/* Actions */}
                <div style={{ display: "flex", flexDirection: "column", gap: 4, flexShrink: 0 }}>
                  <button onClick={() => { setEditId(st.id); setForm({ ...st }); setShowForm(true); }} style={s.btnO} title="Edit"><i className="fas fa-edit" /></button>
                  <button onClick={() => toggleStudentStatus(st.id, st.status)} style={st.status === "active" ? s.btnGray : s.btnG} title={st.status === "active" ? "Deactivate" : "Activate"}>
                    <i className={st.status === "active" ? "fas fa-ban" : "fas fa-check"} />
                  </button>
                  <button onClick={() => deleteStudent(st.id)} style={s.btnD} title="Delete"><i className="fas fa-trash" /></button>
                </div>
              </div>
            )) : (
              <div style={{ ...s.card, textAlign: "center", padding: 40 }}>
                <i className="fas fa-user-graduate" style={{ fontSize: "2.5rem", color: "#B0C4DC", marginBottom: 12 }} />
                <h3 style={{ fontSize: "1rem", fontWeight: 700, color: "#4A5E78", marginBottom: 6 }}>No Students Yet</h3>
                <p style={{ fontSize: ".84rem", color: "#6B7F99" }}>Click "New Admission" to enroll the first student.</p>
              </div>
            );
          })()}

          {/* Tips */}
          <div style={{ marginTop: 16, background: "#FFFBEB", borderRadius: 12, padding: 16, border: "1px solid #FDE68A", fontSize: ".82rem", color: "#78350F", display: "flex", alignItems: "flex-start", gap: 10 }}>
            <i className="fas fa-lightbulb" style={{ marginTop: 2, flexShrink: 0, color: "#D98D04" }} />
            <div>
              <strong>Student Management Tips:</strong><br />
              • Student ka Gmail ID admission time lena zaruri hai — isi se Student Portal login hoga<br />
              • RFID code daalke digital attendance system se connect hoga<br />
              • Student Photo passport size upload karo — app aur portal dono me dikhega<br />
              • Active/Inactive toggle se bina delete kiye access band kar sakte ho<br />
              • Search se naam, email, class, RFID se koi bhi student dhoondh sakte ho
            </div>
          </div>
        </>}

        {/* ═══════════ ATTENDANCE TAB (Redesigned) ═══════════ */}
        {tab === "attendance" && <>
          {/* Header */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, flexWrap: "wrap", gap: 10 }}>
            <div>
              <h2 style={{ fontSize: "1.3rem", fontWeight: 800 }}><i className="fas fa-clipboard-list" style={{ marginRight: 8, color: "#1349A8" }} />Attendance Management</h2>
              <p style={{ fontSize: ".78rem", color: "#6B7F99" }}>Register format · RFID + Manual · Daily / Weekly / Monthly view</p>
            </div>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <input type="date" value={attDate} onChange={(e) => setAttDate(e.target.value)} style={{ border: "1.5px solid #C0D0E8", borderRadius: 8, padding: "8px 12px", fontSize: ".85rem", outline: "none" }} />
              <button onClick={() => setAttDate(new Date().toISOString().split("T")[0])} style={{ padding: "8px 14px", borderRadius: 8, border: "1px solid #D4DEF0", background: "#F8FAFD", color: "#4A5E78", fontSize: ".78rem", fontWeight: 600, cursor: "pointer" }}>Today</button>
              <button onClick={() => exportAttendanceExcel(attViewMode)} style={{ padding: "8px 14px", borderRadius: 8, border: "1px solid #86EFAC", background: "#F0FDF4", color: "#059669", fontSize: ".78rem", fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", gap: 5 }}><i className="fas fa-file-excel" />Export {attViewMode.charAt(0).toUpperCase() + attViewMode.slice(1)}</button>
            </div>
          </div>

          {/* Sub-tabs: Student | Teacher */}
          <div style={{ display: "flex", gap: 4, marginBottom: 16, background: "#E8EFF8", borderRadius: 10, padding: 4 }}>
            {[{ id: "students", icon: "fa-user-graduate", label: "Student Attendance" }, { id: "teachers", icon: "fa-chalkboard-teacher", label: "Teacher Attendance" }].map(st => (
              <button key={st.id} onClick={() => setAttSubTab(st.id)} style={{ flex: 1, padding: "10px 16px", borderRadius: 8, border: "none", background: attSubTab === st.id ? "#fff" : "transparent", color: attSubTab === st.id ? "#1349A8" : "#6B7F99", fontSize: ".82rem", fontWeight: 700, cursor: "pointer", boxShadow: attSubTab === st.id ? "0 2px 8px rgba(0,0,0,.08)" : "none", transition: "all .2s", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
                <i className={`fas ${st.icon}`} style={{ fontSize: ".75rem" }} />{st.label}
              </button>
            ))}
          </div>

          {/* Stats Row */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))", gap: 10, marginBottom: 16 }}>
            {[
              { n: new Set(attendance.filter(a => a.type === "in" && a.studentId).map(a => a.studentId)).size, l: "Present", c: "#16A34A", icon: "fa-user-check" },
              { n: students.filter(x => x.status === "active").length - new Set(attendance.filter(a => a.type === "in" && a.studentId).map(a => a.studentId)).size, l: "Absent", c: "#DC2626", icon: "fa-user-times" },
              { n: attendance.filter(a => a.type === "in").length, l: "Check-INs", c: "#1349A8", icon: "fa-sign-in-alt" },
              { n: attendance.filter(a => a.type === "out").length, l: "Check-OUTs", c: "#D98D04", icon: "fa-sign-out-alt" },
              { n: attendance.filter(a => !a.studentId).length, l: "Unknown RFID", c: "#7C3AED", icon: "fa-question-circle" },
            ].map((x, i) => (
              <div key={i} style={{ ...s.stat, padding: 14 }}>
                <i className={`fas ${x.icon}`} style={{ fontSize: "1.1rem", color: x.c, marginBottom: 4 }} />
                <div style={{ fontSize: "1.4rem", fontWeight: 800, color: x.c }}>{Math.max(0, x.n)}</div>
                <div style={{ fontSize: ".72rem", color: "#6B7F99" }}>{x.l}</div>
              </div>
            ))}
          </div>

          {/* View Mode Toggle + Class Filter + Search */}
          <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap", alignItems: "center" }}>
            <div style={{ display: "flex", gap: 2, background: "#E8EFF8", borderRadius: 8, padding: 3 }}>
              {["daily", "weekly", "monthly"].map(vm => (
                <button key={vm} onClick={() => setAttViewMode(vm)} style={{ padding: "6px 14px", borderRadius: 6, border: "none", background: attViewMode === vm ? "#1349A8" : "transparent", color: attViewMode === vm ? "#fff" : "#6B7F99", fontSize: ".74rem", fontWeight: 600, cursor: "pointer", textTransform: "capitalize" }}>{vm}</button>
              ))}
            </div>
            <select style={{ border: "1.5px solid #C0D0E8", borderRadius: 8, padding: "8px 12px", fontSize: ".82rem", outline: "none" }} value={attClassFilter} onChange={(e) => setAttClassFilter(e.target.value)}>
              <option value="all">All Classes</option>
              <optgroup label="Class 12th">
                {BATCH_OPTIONS.filter(b => b.class === "12th").map(b => <option key={b.value} value={b.value}>{b.label}</option>)}
              </optgroup>
              <optgroup label="Class 11th">
                {BATCH_OPTIONS.filter(b => b.class === "11th").map(b => <option key={b.value} value={b.value}>{b.label}</option>)}
              </optgroup>
              <optgroup label="Class 10th">
                {BATCH_OPTIONS.filter(b => b.class === "10th").map(b => <option key={b.value} value={b.value}>{b.label}</option>)}
              </optgroup>
              <optgroup label="Class 9th">
                {BATCH_OPTIONS.filter(b => b.class === "9th").map(b => <option key={b.value} value={b.value}>{b.label}</option>)}
              </optgroup>
              <optgroup label="Junior Classes">
                {BATCH_OPTIONS.filter(b => b.class === "2nd-8th").map(b => <option key={b.value} value={b.value}>{b.label}</option>)}
              </optgroup>
              <optgroup label="Entrance Coaching">
                {BATCH_OPTIONS.filter(b => b.class === "Navodaya" || b.class === "Prayas").map(b => <option key={b.value} value={b.value}>{b.label}</option>)}
              </optgroup>
              <optgroup label="Competition Exam">
                {BATCH_OPTIONS.filter(b => b.class === "JEE-NEET").map(b => <option key={b.value} value={b.value}>{b.label}</option>)}
              </optgroup>
            </select>
            <input style={{ flex: 1, minWidth: 180, border: "1.5px solid #C0D0E8", borderRadius: 8, padding: "8px 12px", fontSize: ".82rem", outline: "none" }} placeholder="Search student name, RFID..." value={attSearch} onChange={(e) => setAttSearch(e.target.value)} />
            <select style={{ border: "1.5px solid #C0D0E8", borderRadius: 8, padding: "8px 12px", fontSize: ".82rem", outline: "none", width: 140 }} value={attFilter} onChange={(e) => setAttFilter(e.target.value)}>
              <option value="all">All Records</option>
              <option value="in">Check-IN Only</option>
              <option value="out">Check-OUT Only</option>
              <option value="unknown">Unknown RFID</option>
              <option value="manual">Manual Only</option>
            </select>
          </div>

          {/* ═══ STUDENT ATTENDANCE SUB-TAB ═══ */}
          {attSubTab === "students" && <>
            {/* Holiday Warning */}
            {isHoliday(attDate) && (
              <div style={{ background: "#FEF3C7", border: "1px solid #FDE68A", borderRadius: 10, padding: 12, marginBottom: 14, display: "flex", alignItems: "center", gap: 8 }}>
                <i className="fas fa-calendar-times" style={{ color: "#D98D04", fontSize: "1rem" }} />
                <span style={{ fontSize: ".82rem", fontWeight: 600, color: "#92400E" }}>
                  <i className="fas fa-info-circle" style={{ marginRight: 4 }} />Today is a Holiday: {holidays.find(h => h.date === attDate)?.title || "Holiday"} — Attendance will not count as absent
                </span>
              </div>
            )}

            {/* ═══ DAILY VIEW ═══ */}
            {attViewMode === "daily" && (
            <div style={{ ...s.card, padding: 0, overflow: "auto" }}>
              <div style={{ padding: "14px 18px", borderBottom: "2px solid #E2EAF4", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <h3 style={{ fontSize: ".95rem", fontWeight: 700, color: "#0B1826", margin: 0 }}>
                  <i className="fas fa-book-open" style={{ marginRight: 8, color: "#1349A8" }} />
                  Attendance Register — {attDate}
                </h3>
                <span style={{ fontSize: ".72rem", color: "#6B7F99" }}>
                  {attClassFilter !== "all" ? `Class ${attClassFilter}` : "All Classes"}
                </span>
              </div>

              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: ".8rem" }}>
                <thead>
                  <tr style={{ background: "#F0F4FA" }}>
                    <th style={{ padding: "10px 14px", textAlign: "left", fontWeight: 700, color: "#1C2E44", borderBottom: "2px solid #D4DEF0", position: "sticky", left: 0, background: "#F0F4FA", zIndex: 2, minWidth: 50 }}>#</th>
                    <th style={{ padding: "10px 14px", textAlign: "left", fontWeight: 700, color: "#1C2E44", borderBottom: "2px solid #D4DEF0", position: "sticky", left: 50, background: "#F0F4FA", zIndex: 2, minWidth: 180 }}>Student Name</th>
                    <th style={{ padding: "10px 14px", textAlign: "center", fontWeight: 700, color: "#1C2E44", borderBottom: "2px solid #D4DEF0", minWidth: 70 }}>Class</th>
                    <th style={{ padding: "10px 14px", textAlign: "center", fontWeight: 700, color: "#1C2E44", borderBottom: "2px solid #D4DEF0", minWidth: 100 }}>RFID</th>
                    <th style={{ padding: "10px 14px", textAlign: "center", fontWeight: 700, color: "#16A34A", borderBottom: "2px solid #D4DEF0", minWidth: 90 }}>Check-IN</th>
                    <th style={{ padding: "10px 14px", textAlign: "center", fontWeight: 700, color: "#D98D04", borderBottom: "2px solid #D4DEF0", minWidth: 90 }}>Check-OUT</th>
                    <th style={{ padding: "10px 14px", textAlign: "center", fontWeight: 700, color: "#1C2E44", borderBottom: "2px solid #D4DEF0", minWidth: 80 }}>Status</th>
                    <th style={{ padding: "10px 14px", textAlign: "center", fontWeight: 700, color: "#1C2E44", borderBottom: "2px solid #D4DEF0", minWidth: 100 }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {(() => {
                    let stList = students.filter(x => x.status === "active");
                    if (attClassFilter !== "all") stList = filterByBatch(stList, attClassFilter);
                    if (attSearch.trim()) {
                      const q = attSearch.toLowerCase();
                      stList = stList.filter(x => x.studentName?.toLowerCase().includes(q) || x.rfidCode?.toLowerCase().includes(q));
                    }
                    const today = attDate;
                    stList = stList.filter(st => {
                      if (!st.batchStartDate || !st.batchEndDate) return true;
                      return today >= st.batchStartDate && today <= st.batchEndDate;
                    });

                    if (stList.length === 0) return (
                      <tr><td colSpan={8} style={{ padding: 40, textAlign: "center", color: "#6B7F99" }}>
                        <i className="fas fa-user-graduate" style={{ fontSize: "2rem", color: "#B0C4DC", display: "block", marginBottom: 8 }} />
                        {attClassFilter !== "all" ? `Class ${attClassFilter} me koi active student nahi` : "Koi active student nahi"}
                      </td></tr>
                    );

                    return stList.map((st, idx) => {
                      const stAtt = attendance.filter(a => a.studentId === st.id);
                      const checkIn = stAtt.find(a => a.type === "in");
                      const checkOut = stAtt.find(a => a.type === "out");
                      const isAbsentManual = stAtt.find(a => a.type === "absent");
                      const isPresent = !!checkIn;
                      const isHol = isHoliday(attDate);

                      return (
                        <tr key={st.id} style={{ borderBottom: "1px solid #E8EFF8", background: idx % 2 === 0 ? "#fff" : "#FAFCFE" }}>
                          <td style={{ padding: "10px 14px", fontWeight: 600, color: "#6B7F99", position: "sticky", left: 0, background: idx % 2 === 0 ? "#fff" : "#FAFCFE", zIndex: 1 }}>{idx + 1}</td>
                          <td style={{ padding: "10px 14px", position: "sticky", left: 50, background: idx % 2 === 0 ? "#fff" : "#FAFCFE", zIndex: 1 }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }} onClick={() => fetchStudentCalendar(st, new Date().getFullYear(), new Date().getMonth())}>
                              <div style={{ width: 32, height: 32, borderRadius: 8, overflow: "hidden", flexShrink: 0, background: "linear-gradient(135deg,#1349A8,#2A6FE0)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                                {st.photo && st.photo.startsWith("http") ? <img src={st.photo} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : <span style={{ color: "#fff", fontWeight: 700, fontSize: ".7rem" }}>{st.studentName?.charAt(0)}</span>}
                              </div>
                              <div>
                                <span style={{ fontWeight: 600, fontSize: ".82rem", color: "#1349A8", textDecoration: "underline", textDecorationStyle: "dotted" }}>{st.studentName}</span>
                                <div style={{ fontSize: ".6rem", color: "#6B7F99" }}>Click for calendar</div>
                              </div>
                            </div>
                          </td>
                          <td style={{ padding: "10px 14px", textAlign: "center" }}><span style={s.badge("#1349A8", "#EFF6FF")}>{st.class}</span></td>
                          <td style={{ padding: "10px 14px", textAlign: "center", fontFamily: "monospace", fontSize: ".72rem", color: st.rfidCode ? "#7C3AED" : "#DC2626" }}>{st.rfidCode || "No RFID"}</td>
                          <td style={{ padding: "10px 14px", textAlign: "center" }}>
                            {checkIn ? (
                              <div>
                                <span style={{ color: "#16A34A", fontWeight: 700, fontSize: ".78rem" }}>
                                  {new Date(checkIn.timestamp).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}
                                </span>
                                {checkIn.manual && <div style={{ fontSize: ".62rem", color: "#6B7F99" }}>Manual</div>}
                              </div>
                            ) : <span style={{ color: "#B0C4DC" }}>—</span>}
                          </td>
                          <td style={{ padding: "10px 14px", textAlign: "center" }}>
                            {checkOut ? (
                              <div>
                                <span style={{ color: "#D98D04", fontWeight: 700, fontSize: ".78rem" }}>
                                  {new Date(checkOut.timestamp).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}
                                </span>
                                {checkOut.manual && <div style={{ fontSize: ".62rem", color: "#6B7F99" }}>Manual</div>}
                              </div>
                            ) : <span style={{ color: "#B0C4DC" }}>—</span>}
                          </td>
                          <td style={{ padding: "10px 14px", textAlign: "center" }}>
                            {(() => {
                              const stLeave = leaveApplications.find(la => la.studentId === st.id && la.date === attDate);
                              if (isHol) return <span style={s.badge("#D98D04", "#FEF3C7")}>Holiday</span>;
                              if (isPresent) return <span style={s.badge("#16A34A", "#F0FDF4")}>P</span>;
                              if (isAbsentManual) return (
                                <div>
                                  <span style={s.badge("#DC2626", "#FEF2F2")}>A</span>
                                  {stLeave && <div onClick={() => alert("Student: " + st.studentName + "\nDate: " + stLeave.date + "\nType: " + (stLeave.leaveType === "full_day" ? "Full Day" : stLeave.leaveType === "half_day" ? "Half Day" : "Emergency") + "\nReason: " + stLeave.reason + "\nStatus: " + (stLeave.status || "pending"))} style={{ marginTop: 4, cursor: "pointer", fontSize: ".62rem", color: "#f59e0b", fontWeight: 600, background: "#fffbeb", padding: "2px 6px", borderRadius: 4, border: "1px solid #fde68a", maxWidth: 80, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", display: "inline-block" }} title={stLeave.reason}>📝 {stLeave.reason?.slice(0, 10)}{stLeave.reason?.length > 10 ? "..." : ""}</div>}
                                  {isAbsentManual.absentReason && !stLeave && <div style={{ marginTop: 3, fontSize: ".6rem", color: "#6B7F99", maxWidth: 80, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={isAbsentManual.absentReason}>{isAbsentManual.absentReason.slice(0, 12)}{isAbsentManual.absentReason.length > 12 ? "..." : ""}</div>}
                                </div>
                              );
                              if (stLeave) return (
                                <div>
                                  <span style={s.badge("#6B7F99", "#F0F4FA")}>—</span>
                                  <div onClick={() => alert("Student: " + st.studentName + "\nDate: " + stLeave.date + "\nType: " + (stLeave.leaveType === "full_day" ? "Full Day" : stLeave.leaveType === "half_day" ? "Half Day" : "Emergency") + "\nReason: " + stLeave.reason + "\nStatus: " + (stLeave.status || "pending"))} style={{ marginTop: 4, cursor: "pointer", fontSize: ".62rem", color: "#f59e0b", fontWeight: 600, background: "#fffbeb", padding: "2px 6px", borderRadius: 4, border: "1px solid #fde68a", maxWidth: 80, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", display: "inline-block" }} title={stLeave.reason}>📝 {stLeave.reason?.slice(0, 10)}{stLeave.reason?.length > 10 ? "..." : ""}</div>
                                </div>
                              );
                              return <span style={s.badge("#6B7F99", "#F0F4FA")}>—</span>;
                            })()}
                          </td>
                          <td style={{ padding: "10px 14px", textAlign: "center" }}>
                            {!isPresent && !isAbsentManual && !isHol && (
                              <div style={{ display: "flex", gap: 4, justifyContent: "center" }}>
                                <button onClick={() => markManualAttendance(st, "in")} style={{ padding: "4px 10px", borderRadius: 6, border: "1px solid #86EFAC", background: "#F0FDF4", color: "#16A34A", fontSize: ".68rem", fontWeight: 700, cursor: "pointer" }} title="Mark Present">
                                  <i className="fas fa-check" style={{ marginRight: 3 }} />P
                                </button>
                                <button onClick={() => { const reason = prompt(`${st.studentName} absent kyun hai? (Reason likho, khali chhodne pe bina reason save hoga)`); if (reason !== null) markAbsent(st, reason); }} style={{ padding: "4px 10px", borderRadius: 6, border: "1px solid #FCA5A5", background: "#FEF2F2", color: "#DC2626", fontSize: ".68rem", fontWeight: 700, cursor: "pointer" }} title="Mark Absent with Reason">
                                  <i className="fas fa-times" style={{ marginRight: 3 }} />A
                                </button>
                              </div>
                            )}
                            {isPresent && !checkOut && (
                              <button onClick={() => markManualAttendance(st, "out")} style={{ padding: "4px 10px", borderRadius: 6, border: "1px solid #FDE68A", background: "#FFFBEB", color: "#92400E", fontSize: ".68rem", fontWeight: 700, cursor: "pointer" }} title="Mark Check-OUT">
                                <i className="fas fa-sign-out-alt" style={{ marginRight: 3 }} />OUT
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    });
                  })()}
                </tbody>
              </table>
            </div>
            )}

            {/* ═══ WEEKLY / MONTHLY VIEW ═══ */}
            {(attViewMode === "weekly" || attViewMode === "monthly") && (
            <div style={{ ...s.card, padding: 0, overflow: "auto" }}>
              <div style={{ padding: "14px 18px", borderBottom: "2px solid #E2EAF4", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <h3 style={{ fontSize: ".95rem", fontWeight: 700, color: "#0B1826", margin: 0 }}>
                  <i className="fas fa-calendar-alt" style={{ marginRight: 8, color: "#1349A8" }} />
                  {attViewMode === "weekly" ? "Weekly" : "Monthly"} Attendance Register
                </h3>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  {multiDayLoading && <span style={{ fontSize: ".72rem", color: "#D98D04" }}><i className="fas fa-spinner fa-spin" style={{ marginRight: 4 }} />Loading...</span>}
                  <span style={{ fontSize: ".72rem", color: "#6B7F99" }}>
                    {attClassFilter !== "all" ? `Class ${attClassFilter}` : "All Classes"}
                  </span>
                </div>
              </div>

              {(() => {
                const dates = attViewMode === "weekly" ? getWeekDates(attDate) : getMonthDates(new Date(attDate).getFullYear(), new Date(attDate).getMonth());
                const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
                let stList = students.filter(x => x.status === "active");
                if (attClassFilter !== "all") stList = filterByBatch(stList, attClassFilter);
                if (attSearch.trim()) {
                  const q = attSearch.toLowerCase();
                  stList = stList.filter(x => x.studentName?.toLowerCase().includes(q) || x.rfidCode?.toLowerCase().includes(q));
                }
                const todayStr = new Date().toISOString().split("T")[0];

                return (
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: ".72rem" }}>
                    <thead>
                      <tr style={{ background: "#F0F4FA" }}>
                        <th style={{ padding: "8px 10px", textAlign: "left", fontWeight: 700, borderBottom: "2px solid #D4DEF0", position: "sticky", left: 0, background: "#F0F4FA", zIndex: 2, minWidth: 40 }}>#</th>
                        <th style={{ padding: "8px 10px", textAlign: "left", fontWeight: 700, borderBottom: "2px solid #D4DEF0", position: "sticky", left: 40, background: "#F0F4FA", zIndex: 2, minWidth: 140 }}>Student</th>
                        {dates.map(d => {
                          const dt = new Date(d + "T00:00:00");
                          const isHol = isHoliday(d);
                          const isSun = dt.getDay() === 0;
                          return (
                            <th key={d} style={{ padding: "6px 4px", textAlign: "center", fontWeight: 600, borderBottom: "2px solid #D4DEF0", minWidth: 38, background: isHol ? "#FEF3C7" : isSun ? "#FEF2F2" : "#F0F4FA", fontSize: ".65rem" }}>
                              <div>{String(dt.getDate()).padStart(2, "0")}</div>
                              <div style={{ color: isSun ? "#DC2626" : "#6B7F99", fontSize: ".58rem" }}>{dayNames[dt.getDay()]}</div>
                            </th>
                          );
                        })}
                        <th style={{ padding: "8px 6px", textAlign: "center", fontWeight: 700, borderBottom: "2px solid #D4DEF0", minWidth: 36, color: "#16A34A", background: "#F0FDF4" }}>P</th>
                        <th style={{ padding: "8px 6px", textAlign: "center", fontWeight: 700, borderBottom: "2px solid #D4DEF0", minWidth: 36, color: "#DC2626", background: "#FEF2F2" }}>A</th>
                        <th style={{ padding: "8px 6px", textAlign: "center", fontWeight: 700, borderBottom: "2px solid #D4DEF0", minWidth: 36, color: "#1349A8" }}>%</th>
                      </tr>
                    </thead>
                    <tbody>
                      {stList.length === 0 ? (
                        <tr><td colSpan={dates.length + 5} style={{ padding: 40, textAlign: "center", color: "#6B7F99" }}>No active students found</td></tr>
                      ) : stList.map((st, idx) => {
                        let totalP = 0, totalA = 0, totalWorking = 0;
                        return (
                          <tr key={st.id} style={{ borderBottom: "1px solid #E8EFF8" }}>
                            <td style={{ padding: "8px 10px", fontWeight: 600, color: "#6B7F99", position: "sticky", left: 0, background: "#fff", zIndex: 1 }}>{idx + 1}</td>
                            <td style={{ padding: "8px 10px", position: "sticky", left: 40, background: "#fff", zIndex: 1 }}>
                              <div style={{ cursor: "pointer" }} onClick={() => fetchStudentCalendar(st, new Date(attDate).getFullYear(), new Date(attDate).getMonth())}>
                                <div style={{ fontWeight: 600, fontSize: ".76rem", color: "#1349A8", textDecoration: "underline", textDecorationStyle: "dotted" }}>{st.studentName}</div>
                                <div style={{ fontSize: ".6rem", color: "#6B7F99" }}>{st.class}</div>
                              </div>
                            </td>
                            {dates.map(d => {
                              const isHol = isHoliday(d);
                              const isSun = new Date(d + "T00:00:00").getDay() === 0;
                              if (isHol || isSun) {
                                return <td key={d} style={{ padding: "4px 2px", textAlign: "center", background: isHol ? "#FFFBEB" : "#FEF2F2" }}><span style={{ fontSize: ".6rem", fontWeight: 700, color: isHol ? "#D98D04" : "#FCA5A5" }}>{isHol ? "H" : "S"}</span></td>;
                              }
                              // Batch validity check — batch start se pehle ya end ke baad = colorless
                              const isBeforeBatch = st.batchStartDate && d < st.batchStartDate;
                              const isAfterBatch = st.batchEndDate && d > st.batchEndDate;
                              if (isBeforeBatch || isAfterBatch) {
                                return <td key={d} style={{ padding: "4px 2px", textAlign: "center", background: "#F8FAFD" }}><span style={{ color: "#D4DEF0", fontSize: ".6rem" }}>·</span></td>;
                              }
                              totalWorking++;
                              const dayAtt = multiDayAtt.filter(a => a.studentId === st.id && a.date === d);
                              const hasIn = dayAtt.some(a => a.type === "in");
                              const hasAbsent = dayAtt.some(a => a.type === "absent");
                              const isFuture = d > todayStr;
                              if (hasIn) { totalP++; return <td key={d} style={{ padding: "4px 2px", textAlign: "center", background: "#F0FDF4" }}><span style={{ color: "#16A34A", fontWeight: 800, fontSize: ".7rem" }}>P</span></td>; }
                              if (hasAbsent || (!isFuture && !hasIn)) { if (!isFuture) totalA++; return <td key={d} style={{ padding: "4px 2px", textAlign: "center", background: isFuture ? "#fff" : "#FEF2F2" }}><span style={{ color: isFuture ? "#B0C4DC" : "#DC2626", fontWeight: 700, fontSize: ".7rem" }}>{isFuture ? "—" : "A"}</span></td>; }
                              return <td key={d} style={{ padding: "4px 2px", textAlign: "center" }}><span style={{ color: "#B0C4DC", fontSize: ".65rem" }}>—</span></td>;
                            })}
                            <td style={{ padding: "6px 4px", textAlign: "center", fontWeight: 800, color: "#16A34A", background: "#F0FDF4", fontSize: ".76rem" }}>{totalP}</td>
                            <td style={{ padding: "6px 4px", textAlign: "center", fontWeight: 800, color: "#DC2626", background: "#FEF2F2", fontSize: ".76rem" }}>{totalA}</td>
                            <td style={{ padding: "6px 4px", textAlign: "center", fontWeight: 800, color: "#1349A8", fontSize: ".76rem" }}>{totalWorking > 0 ? Math.round((totalP / totalWorking) * 100) : 0}%</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                );
              })()}
            </div>
            )}
          </>}

          {/* ═══ PER-STUDENT/TEACHER CALENDAR MODAL (outside sub-tabs) ═══ */}
          {calendarStudent && (
              <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,.5)", zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }} onClick={() => setCalendarStudent(null)}>
                <div style={{ background: "#fff", borderRadius: 16, padding: 24, maxWidth: 520, width: "100%", maxHeight: "90vh", overflowY: "auto", boxShadow: "0 8px 40px rgba(0,0,0,.2)" }} onClick={(e) => e.stopPropagation()}>
                  {/* Header */}
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <div style={{ width: 40, height: 40, borderRadius: 10, background: "linear-gradient(135deg,#1349A8,#2A6FE0)", display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden" }}>
                        {calendarStudent.photo && calendarStudent.photo.startsWith("http") ? <img src={calendarStudent.photo} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : <span style={{ color: "#fff", fontWeight: 700 }}>{calendarStudent.studentName?.charAt(0)}</span>}
                      </div>
                      <div>
                        <div style={{ fontWeight: 800, fontSize: "1rem" }}>{calendarStudent.studentName}</div>
                        <div style={{ fontSize: ".75rem", color: "#6B7F99" }}>Class {calendarStudent.class} · {calendarStudent.rfidCode || "No RFID"}</div>
                      </div>
                    </div>
                    <button onClick={() => setCalendarStudent(null)} style={{ width: 32, height: 32, borderRadius: 8, border: "1px solid #D4DEF0", background: "#F8FAFD", color: "#6B7F99", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <i className="fas fa-times" />
                    </button>
                  </div>

                  {/* Month Navigation */}
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
                    <button onClick={() => {
                      const nm = calStudentMonth === 0 ? 11 : calStudentMonth - 1;
                      const ny = calStudentMonth === 0 ? calStudentYear - 1 : calStudentYear;
                      fetchStudentCalendar(calendarStudent, ny, nm);
                    }} style={{ padding: "6px 12px", borderRadius: 8, border: "1px solid #D4DEF0", background: "#F8FAFD", cursor: "pointer", fontSize: ".78rem", fontWeight: 600, color: "#4A5E78" }}>
                      <i className="fas fa-chevron-left" />
                    </button>
                    <span style={{ fontWeight: 700, fontSize: ".92rem", color: "#0B1826" }}>
                      {new Date(calStudentYear, calStudentMonth).toLocaleDateString("en-IN", { month: "long", year: "numeric" })}
                    </span>
                    <button onClick={() => {
                      const nm = calStudentMonth === 11 ? 0 : calStudentMonth + 1;
                      const ny = calStudentMonth === 11 ? calStudentYear + 1 : calStudentYear;
                      fetchStudentCalendar(calendarStudent, ny, nm);
                    }} style={{ padding: "6px 12px", borderRadius: 8, border: "1px solid #D4DEF0", background: "#F8FAFD", cursor: "pointer", fontSize: ".78rem", fontWeight: 600, color: "#4A5E78" }}>
                      <i className="fas fa-chevron-right" />
                    </button>
                  </div>

                  {/* Stats Row — Monthly */}
                  {(() => {
                    const daysInMonth = new Date(calStudentYear, calStudentMonth + 1, 0).getDate();
                    const todayStr = new Date().toISOString().split("T")[0];
                    const batchStart = calendarStudent?.batchStartDate || "";
                    const batchEnd = calendarStudent?.batchEndDate || "";
                    let totalP = 0, totalA = 0, totalH = 0;
                    for (let i = 1; i <= daysInMonth; i++) {
                      const dateStr = `${calStudentYear}-${String(calStudentMonth + 1).padStart(2, "0")}-${String(i).padStart(2, "0")}`;
                      if (dateStr > todayStr) continue;
                      if (batchStart && dateStr < batchStart) continue;
                      if (batchEnd && dateStr > batchEnd) continue;
                      if (isHoliday(dateStr) || new Date(dateStr + "T00:00:00").getDay() === 0) { totalH++; continue; }
                      const dayAtt = calMonthAtt.filter(a => a.date === dateStr);
                      if (dayAtt.some(a => a.type === "in")) totalP++;
                      else totalA++;
                    }
                    const totalWorking = totalP + totalA;
                    return (
                      <div style={{ marginBottom: 14 }}>
                        <div style={{ fontSize: ".72rem", fontWeight: 700, color: "#6B7F99", marginBottom: 6 }}>This Month</div>
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 8 }}>
                          <div style={{ textAlign: "center", padding: 8, borderRadius: 8, background: "#F0FDF4" }}><div style={{ fontWeight: 800, color: "#16A34A", fontSize: "1.1rem" }}>{totalP}</div><div style={{ fontSize: ".65rem", color: "#6B7F99" }}>Present</div></div>
                          <div style={{ textAlign: "center", padding: 8, borderRadius: 8, background: "#FEF2F2" }}><div style={{ fontWeight: 800, color: "#DC2626", fontSize: "1.1rem" }}>{totalA}</div><div style={{ fontSize: ".65rem", color: "#6B7F99" }}>Absent</div></div>
                          <div style={{ textAlign: "center", padding: 8, borderRadius: 8, background: "#FEF3C7" }}><div style={{ fontWeight: 800, color: "#D98D04", fontSize: "1.1rem" }}>{totalH}</div><div style={{ fontSize: ".65rem", color: "#6B7F99" }}>Holiday</div></div>
                          <div style={{ textAlign: "center", padding: 8, borderRadius: 8, background: "#EFF6FF" }}><div style={{ fontWeight: 800, color: "#1349A8", fontSize: "1.1rem" }}>{totalWorking > 0 ? Math.round((totalP / totalWorking) * 100) : 0}%</div><div style={{ fontSize: ".65rem", color: "#6B7F99" }}>Attendance</div></div>
                        </div>
                      </div>
                    );
                  })()}

                  {/* Overall Attendance — Batch start se aaj tak */}
                  {(() => {
                    const todayStr = new Date().toISOString().split("T")[0];
                    const batchStart = calendarStudent?.batchStartDate || "";
                    const batchEnd = calendarStudent?.batchEndDate || "";
                    if (!batchStart) return null;
                    const effectiveEnd = batchEnd && batchEnd < todayStr ? batchEnd : todayStr;
                    let ovP = 0, ovA = 0, ovH = 0;
                    const start = new Date(batchStart);
                    const end = new Date(effectiveEnd);
                    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
                      const dateStr = d.toISOString().split("T")[0];
                      if (new Date(dateStr + "T00:00:00").getDay() === 0 || isHoliday(dateStr)) { ovH++; continue; }
                      const dayAtt = calMonthAtt.filter(a => a.date === dateStr);
                      if (dayAtt.some(a => a.type === "in")) ovP++;
                      else ovA++;
                    }
                    const ovWorking = ovP + ovA;
                    const ovPct = ovWorking > 0 ? Math.round((ovP / ovWorking) * 100) : 0;
                    const pctColor = ovPct >= 75 ? "#16A34A" : ovPct >= 50 ? "#D98D04" : "#DC2626";
                    const pctBg = ovPct >= 75 ? "#F0FDF4" : ovPct >= 50 ? "#FFFBEB" : "#FEF2F2";
                    return (
                      <div style={{ background: "#F8FAFD", borderRadius: 10, border: "1px solid #D4DEF0", padding: "10px 14px", marginBottom: 14 }}>
                        <div style={{ fontSize: ".72rem", fontWeight: 700, color: "#6B7F99", marginBottom: 8 }}>
                          <i className="fas fa-chart-bar" style={{ marginRight: 5, color: "#1349A8" }} />
                          Overall Attendance — {batchStart} se {effectiveEnd} tak
                        </div>
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 8, marginBottom: 8 }}>
                          <div style={{ textAlign: "center", padding: 8, borderRadius: 8, background: "#F0FDF4" }}><div style={{ fontWeight: 800, color: "#16A34A", fontSize: "1.2rem" }}>{ovP}</div><div style={{ fontSize: ".65rem", color: "#6B7F99" }}>Present</div></div>
                          <div style={{ textAlign: "center", padding: 8, borderRadius: 8, background: "#FEF2F2" }}><div style={{ fontWeight: 800, color: "#DC2626", fontSize: "1.2rem" }}>{ovA}</div><div style={{ fontSize: ".65rem", color: "#6B7F99" }}>Absent</div></div>
                          <div style={{ textAlign: "center", padding: 8, borderRadius: 8, background: "#FEF3C7" }}><div style={{ fontWeight: 800, color: "#D98D04", fontSize: "1.2rem" }}>{ovH}</div><div style={{ fontSize: ".65rem", color: "#6B7F99" }}>Holiday</div></div>
                          <div style={{ textAlign: "center", padding: 8, borderRadius: 8, background: pctBg }}><div style={{ fontWeight: 800, color: pctColor, fontSize: "1.2rem" }}>{ovPct}%</div><div style={{ fontSize: ".65rem", color: "#6B7F99" }}>Overall</div></div>
                        </div>
                        {/* Progress bar */}
                        <div style={{ background: "#E8EFF8", borderRadius: 99, height: 8, overflow: "hidden" }}>
                          <div style={{ height: "100%", borderRadius: 99, background: `linear-gradient(90deg, ${pctColor}, ${pctColor}88)`, width: `${ovPct}%`, transition: "width .5s" }} />
                        </div>
                        <div style={{ display: "flex", justifyContent: "space-between", marginTop: 4 }}>
                          <span style={{ fontSize: ".62rem", color: "#6B7F99" }}>Total Working Days: {ovWorking}</span>
                          <span style={{ fontSize: ".62rem", fontWeight: 700, color: pctColor }}>{ovPct >= 75 ? "✓ Good" : ovPct >= 50 ? "⚠ Average" : "✗ Low"}</span>
                        </div>
                      </div>
                    );
                  })()}

                  {/* Legend */}
                  <div style={{ display: "flex", gap: 12, marginBottom: 10, fontSize: ".68rem", flexWrap: "wrap" }}>
                    <span style={{ display: "flex", alignItems: "center", gap: 4 }}><span style={{ width: 12, height: 12, borderRadius: 3, background: "#DCFCE7", border: "1px solid #86EFAC" }} /> Present</span>
                    <span style={{ display: "flex", alignItems: "center", gap: 4 }}><span style={{ width: 12, height: 12, borderRadius: 3, background: "#FEE2E2", border: "1px solid #FCA5A5" }} /> Absent</span>
                    <span style={{ display: "flex", alignItems: "center", gap: 4 }}><span style={{ width: 12, height: 12, borderRadius: 3, background: "#FEF3C7", border: "1px solid #FDE68A" }} /> Holiday</span>
                    <span style={{ display: "flex", alignItems: "center", gap: 4 }}><span style={{ width: 12, height: 12, borderRadius: 3, background: "#F3E8FF", border: "1px solid #D8B4FE" }} /> Sunday</span>
                    <span style={{ display: "flex", alignItems: "center", gap: 4 }}><span style={{ width: 12, height: 12, borderRadius: 3, background: "#F0F4FA", border: "1px solid #D4DEF0" }} /> Future</span>
                  </div>

                  {/* Calendar Grid */}
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 4, marginBottom: 12 }}>
                    {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map(d => (
                      <div key={d} style={{ textAlign: "center", fontSize: ".65rem", fontWeight: 700, color: d === "Sun" ? "#DC2626" : "#6B7F99", padding: "4px 0" }}>{d}</div>
                    ))}
                    {(() => {
                      const daysInMonth = new Date(calStudentYear, calStudentMonth + 1, 0).getDate();
                      const firstDay = new Date(calStudentYear, calStudentMonth, 1).getDay();
                      const startOffset = firstDay === 0 ? 6 : firstDay - 1; // Monday start
                      const todayStr = new Date().toISOString().split("T")[0];
                      const cells = [];

                      // Empty cells before first day
                      for (let i = 0; i < startOffset; i++) {
                        cells.push(<div key={`empty-${i}`} />);
                      }

                      for (let i = 1; i <= daysInMonth; i++) {
                        const dateStr = `${calStudentYear}-${String(calStudentMonth + 1).padStart(2, "0")}-${String(i).padStart(2, "0")}`;
                        const isSun = new Date(dateStr + "T00:00:00").getDay() === 0;
                        const isHol = isHoliday(dateStr);
                        const isFuture = dateStr > todayStr;
                        const isToday = dateStr === todayStr;
                        const dayAtt = calMonthAtt.filter(a => a.date === dateStr);
                        const hasIn = dayAtt.some(a => a.type === "in");
                        const checkIn = dayAtt.find(a => a.type === "in");
                        const checkOut = dayAtt.find(a => a.type === "out");

                        // Batch validity check for calendar
                        const batchStart = calendarStudent?.batchStartDate || "";
                        const batchEnd = calendarStudent?.batchEndDate || "";
                        const isBeforeBatchCal = batchStart && dateStr < batchStart;
                        const isAfterBatchCal = batchEnd && dateStr > batchEnd;
                        const isOutsideBatch = isBeforeBatchCal || isAfterBatchCal;

                        let bg = "#F8FAFD"; let border = "1px solid #E8EFF8"; let color = "#6B7F99";
                        if (isOutsideBatch) { bg = "#F8FAFD"; border = "1px solid #EEF2F8"; color = "#D4DEF0"; }
                        else if (isHol) { bg = "#FEF3C7"; border = "1px solid #FDE68A"; color = "#D98D04"; }
                        else if (isSun) { bg = "#F3E8FF"; border = "1px solid #D8B4FE"; color = "#7C3AED"; }
                        else if (isFuture) { bg = "#F0F4FA"; border = "1px solid #D4DEF0"; color = "#B0C4DC"; }
                        else if (hasIn) { bg = "#DCFCE7"; border = "1px solid #86EFAC"; color = "#16A34A"; }
                        else { bg = "#FEE2E2"; border = "1px solid #FCA5A5"; color = "#DC2626"; }
                        if (isToday) border = "2px solid #1349A8";

                        cells.push(
                          <div key={dateStr} style={{ background: bg, border, borderRadius: 8, padding: "6px 4px", textAlign: "center", cursor: hasIn || dayAtt.length > 0 ? "pointer" : "default", minHeight: 52, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", transition: "all .15s" }}
                            title={checkIn ? `IN: ${new Date(checkIn.timestamp).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}${checkOut ? ` · OUT: ${new Date(checkOut.timestamp).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}` : ""}` : isHol ? holidays.find(h => h.date === dateStr)?.title || "Holiday" : isSun ? "Sunday" : isFuture ? "Upcoming" : "Absent"}>
                            <div style={{ fontWeight: 700, fontSize: ".78rem", color }}>{i}</div>
                            {isHol ? <div style={{ fontSize: ".52rem", fontWeight: 700, color: "#D98D04" }}>H</div>
                              : isSun ? <div style={{ fontSize: ".52rem", fontWeight: 700, color: "#7C3AED" }}>S</div>
                              : isFuture ? <div style={{ fontSize: ".52rem", color: "#B0C4DC" }}>—</div>
                              : hasIn ? (
                                <div style={{ fontSize: ".5rem", color: "#16A34A", fontWeight: 600 }}>
                                  {checkIn ? new Date(checkIn.timestamp).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" }) : "P"}
                                </div>
                              ) : <div style={{ fontSize: ".52rem", fontWeight: 700, color: "#DC2626" }}>A</div>
                            }
                            {checkOut && !isHol && !isSun && (
                              <div style={{ fontSize: ".48rem", color: "#D98D04" }}>
                                → {new Date(checkOut.timestamp).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}
                              </div>
                            )}
                          </div>
                        );
                      }
                      return cells;
                    })()}
                  </div>

                  {/* Close Button */}
                  <div style={{ textAlign: "center" }}>
                    <button onClick={() => setCalendarStudent(null)} style={{ padding: "10px 24px", borderRadius: 8, border: "none", background: "linear-gradient(135deg,#1349A8,#2A6FE0)", color: "#fff", fontSize: ".82rem", fontWeight: 700, cursor: "pointer" }}>Close Calendar</button>
                  </div>
                </div>
              </div>
            )}

          {attSubTab === "students" && <>
            {/* Unknown RFID Taps */}
            {attendance.filter(a => !a.studentId).length > 0 && (
              <div style={{ ...s.card, border: "2px solid #FCA5A5" }}>
                <h4 style={{ fontSize: ".9rem", fontWeight: 700, color: "#DC2626", marginBottom: 12 }}>
                  <i className="fas fa-exclamation-triangle" style={{ marginRight: 6 }} />Unknown RFID Taps ({attendance.filter(a => !a.studentId).length})
                </h4>
                {attendance.filter(a => !a.studentId).map(a => (
                  <div key={a.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 0", borderBottom: "1px solid #FEE2E2", fontSize: ".82rem" }}>
                    <span style={{ fontFamily: "monospace", color: "#7C3AED", fontWeight: 700 }}>{a.rfidCode}</span>
                    <span style={{ color: "#6B7F99" }}>{a.type === "in" ? "IN" : "OUT"}</span>
                    <span style={{ color: "#6B7F99" }}>{a.timestamp ? new Date(a.timestamp).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", second: "2-digit" }) : ""}</span>
                    <span style={{ marginLeft: "auto", fontSize: ".72rem", color: "#DC2626" }}>Students tab me RFID assign karo</span>
                  </div>
                ))}
              </div>
            )}
          </>}

          {/* ═══ TEACHER ATTENDANCE SUB-TAB ═══ */}
          {attSubTab === "teachers" && <>
            <div style={{ ...s.card, padding: 0, overflow: "auto" }}>
              <div style={{ padding: "14px 18px", borderBottom: "2px solid #E2EAF4", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <h3 style={{ fontSize: ".95rem", fontWeight: 700, color: "#0B1826", margin: 0 }}>
                  <i className="fas fa-chalkboard-teacher" style={{ marginRight: 8, color: "#059669" }} />
                  Teacher Attendance — {attViewMode === "daily" ? attDate : attViewMode === "weekly" ? "This Week" : "This Month"}
                </h3>
                <span style={{ fontSize: ".72rem", color: "#6B7F99" }}>RFID + Manual</span>
              </div>

              {/* Weekly/Monthly Teacher Register */}
              {(attViewMode === "weekly" || attViewMode === "monthly") && (() => {
                const dates = attViewMode === "weekly" ? getWeekDates(attDate) : getMonthDates(new Date(attDate).getFullYear(), new Date(attDate).getMonth());
                const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
                const todayStr = new Date().toISOString().split("T")[0];
                return (
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: ".72rem" }}>
                    <thead>
                      <tr style={{ background: "#F0F4FA" }}>
                        <th style={{ padding: "8px 10px", textAlign: "left", fontWeight: 700, borderBottom: "2px solid #D4DEF0", position: "sticky", left: 0, background: "#F0F4FA", zIndex: 2, minWidth: 40 }}>#</th>
                        <th style={{ padding: "8px 10px", textAlign: "left", fontWeight: 700, borderBottom: "2px solid #D4DEF0", position: "sticky", left: 40, background: "#F0F4FA", zIndex: 2, minWidth: 140 }}>Teacher</th>
                        {dates.map(d => {
                          const dt = new Date(d + "T00:00:00");
                          const isHol = isHoliday(d);
                          const isSun = dt.getDay() === 0;
                          return (
                            <th key={d} style={{ padding: "6px 4px", textAlign: "center", fontWeight: 600, borderBottom: "2px solid #D4DEF0", minWidth: 38, background: isHol ? "#FEF3C7" : isSun ? "#FEF2F2" : "#F0F4FA", fontSize: ".65rem" }}>
                              <div>{String(dt.getDate()).padStart(2, "0")}</div>
                              <div style={{ color: isSun ? "#DC2626" : "#6B7F99", fontSize: ".58rem" }}>{dayNames[dt.getDay()]}</div>
                            </th>
                          );
                        })}
                        <th style={{ padding: "8px 6px", textAlign: "center", fontWeight: 700, borderBottom: "2px solid #D4DEF0", minWidth: 36, color: "#16A34A", background: "#F0FDF4" }}>P</th>
                        <th style={{ padding: "8px 6px", textAlign: "center", fontWeight: 700, borderBottom: "2px solid #D4DEF0", minWidth: 36, color: "#DC2626", background: "#FEF2F2" }}>A</th>
                        <th style={{ padding: "8px 6px", textAlign: "center", fontWeight: 700, borderBottom: "2px solid #D4DEF0", minWidth: 36, color: "#1349A8" }}>%</th>
                      </tr>
                    </thead>
                    <tbody>
                      {teachers.length === 0 ? (
                        <tr><td colSpan={dates.length + 5} style={{ padding: 40, textAlign: "center", color: "#6B7F99" }}>No teachers found</td></tr>
                      ) : teachers.map((t, idx) => {
                        let totalP = 0, totalA = 0, totalWorking = 0;
                        const personKey = `teacher_${t.id}`;
                        return (
                          <tr key={t.id} style={{ borderBottom: "1px solid #E8EFF8" }}>
                            <td style={{ padding: "8px 10px", fontWeight: 600, color: "#6B7F99", position: "sticky", left: 0, background: "#fff", zIndex: 1 }}>{idx + 1}</td>
                            <td style={{ padding: "8px 10px", position: "sticky", left: 40, background: "#fff", zIndex: 1 }}>
                              <div style={{ cursor: "pointer" }} onClick={() => {
                                const teacherAsStudent = { id: personKey, studentName: t.name, class: "Teacher", rfidCode: t.rfidCode || "", photo: t.photo || "", batchStartDate: t.cardValidFrom || "", batchEndDate: t.cardValidTo || "" };
                                fetchStudentCalendar(teacherAsStudent, new Date(attDate).getFullYear(), new Date(attDate).getMonth());
                              }}>
                                <div style={{ fontWeight: 600, fontSize: ".76rem", color: "#059669", textDecoration: "underline", textDecorationStyle: "dotted" }}>{t.name}</div>
                                <div style={{ fontSize: ".6rem", color: "#6B7F99" }}>{t.subject}</div>
                              </div>
                            </td>
                            {dates.map(d => {
                              const isHol = isHoliday(d);
                              const isSun = new Date(d + "T00:00:00").getDay() === 0;
                              if (isHol || isSun) {
                                return <td key={d} style={{ padding: "4px 2px", textAlign: "center", background: isHol ? "#FFFBEB" : "#FEF2F2" }}><span style={{ fontSize: ".6rem", fontWeight: 700, color: isHol ? "#D98D04" : "#FCA5A5" }}>{isHol ? "H" : "S"}</span></td>;
                              }
                              // Card validity check — card active hone se pehle ya expire ke baad = colorless
                              const isBeforeCard = t.cardValidFrom && d < t.cardValidFrom;
                              const isAfterCard = t.cardValidTo && d > t.cardValidTo;
                              if (isBeforeCard || isAfterCard) {
                                return <td key={d} style={{ padding: "4px 2px", textAlign: "center", background: "#F8FAFD" }}><span style={{ color: "#D4DEF0", fontSize: ".6rem" }}>·</span></td>;
                              }
                              totalWorking++;
                              const dayAtt = multiDayAtt.filter(a => (a.studentId === personKey || a.rfidCode === (t.rfidCode || `TEACHER_${t.id}`)) && a.date === d);
                              const hasIn = dayAtt.some(a => a.type === "in");
                              const hasAbsent = dayAtt.some(a => a.type === "absent");
                              const isFuture = d > todayStr;
                              if (hasIn) { totalP++; return <td key={d} style={{ padding: "4px 2px", textAlign: "center", background: "#F0FDF4" }}><span style={{ color: "#16A34A", fontWeight: 800, fontSize: ".7rem" }}>P</span></td>; }
                              if (hasAbsent || (!isFuture && !hasIn)) { if (!isFuture) totalA++; return <td key={d} style={{ padding: "4px 2px", textAlign: "center", background: isFuture ? "#fff" : "#FEF2F2" }}><span style={{ color: isFuture ? "#B0C4DC" : "#DC2626", fontWeight: 700, fontSize: ".7rem" }}>{isFuture ? "—" : "A"}</span></td>; }
                              return <td key={d} style={{ padding: "4px 2px", textAlign: "center" }}><span style={{ color: "#B0C4DC", fontSize: ".65rem" }}>—</span></td>;
                            })}
                            <td style={{ padding: "6px 4px", textAlign: "center", fontWeight: 800, color: "#16A34A", background: "#F0FDF4", fontSize: ".76rem" }}>{totalP}</td>
                            <td style={{ padding: "6px 4px", textAlign: "center", fontWeight: 800, color: "#DC2626", background: "#FEF2F2", fontSize: ".76rem" }}>{totalA}</td>
                            <td style={{ padding: "6px 4px", textAlign: "center", fontWeight: 800, color: "#1349A8", fontSize: ".76rem" }}>{totalWorking > 0 ? Math.round((totalP / totalWorking) * 100) : 0}%</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                );
              })()}

              {/* Daily Teacher Table */}
              {attViewMode === "daily" && <table style={{ width: "100%", borderCollapse: "collapse", fontSize: ".82rem" }}>
                <thead>
                  <tr style={{ background: "#F0F4FA" }}>
                    <th style={{ padding: "10px 14px", textAlign: "left", fontWeight: 700, borderBottom: "2px solid #D4DEF0" }}>#</th>
                    <th style={{ padding: "10px 14px", textAlign: "left", fontWeight: 700, borderBottom: "2px solid #D4DEF0" }}>Teacher Name</th>
                    <th style={{ padding: "10px 14px", textAlign: "center", fontWeight: 700, borderBottom: "2px solid #D4DEF0" }}>Subject</th>
                    <th style={{ padding: "10px 14px", textAlign: "center", fontWeight: 700, borderBottom: "2px solid #D4DEF0" }}>RFID</th>
                    <th style={{ padding: "10px 14px", textAlign: "center", fontWeight: 700, color: "#16A34A", borderBottom: "2px solid #D4DEF0" }}>Check-IN</th>
                    <th style={{ padding: "10px 14px", textAlign: "center", fontWeight: 700, color: "#D98D04", borderBottom: "2px solid #D4DEF0" }}>Check-OUT</th>
                    <th style={{ padding: "10px 14px", textAlign: "center", fontWeight: 700, borderBottom: "2px solid #D4DEF0" }}>Status</th>
                    <th style={{ padding: "10px 14px", textAlign: "center", fontWeight: 700, borderBottom: "2px solid #D4DEF0" }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {teachers.length > 0 ? teachers.filter(t => {
                    // ═══ Filter teachers whose card validity has expired ═══
                    if (!t.cardValidFrom || !t.cardValidTo) return true; // validity nahi set = show karo
                    const today = new Date().toISOString().split("T")[0];
                    return today >= t.cardValidFrom && today <= t.cardValidTo;
                  }).map((t, idx) => {
                    // Match by RFID code OR by teacher_ prefix ID
                    const tAtt = attendance.filter(a => (t.rfidCode && a.rfidCode === t.rfidCode) || a.rfidCode === `TEACHER_${t.id}` || a.studentId === `teacher_${t.id}`);
                    const checkIn = tAtt.find(a => a.type === "in");
                    const checkOut = tAtt.find(a => a.type === "out");
                    const isAbsentManual = tAtt.find(a => a.type === "absent");
                    const tPresent = !!checkIn;
                    const isHol = isHoliday(attDate);
                    return (
                      <tr key={t.id} style={{ borderBottom: "1px solid #E8EFF8", background: idx % 2 === 0 ? "#fff" : "#FAFCFE" }}>
                        <td style={{ padding: "10px 14px", fontWeight: 600, color: "#6B7F99" }}>{idx + 1}</td>
                        <td style={{ padding: "10px 14px" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }} onClick={() => {
                            // Open teacher calendar — reuse student calendar with teacher data
                            const teacherAsStudent = { id: `teacher_${t.id}`, studentName: t.name, class: "Teacher", rfidCode: t.rfidCode || "", photo: t.photo || "", batchStartDate: t.cardValidFrom || "", batchEndDate: t.cardValidTo || "" };
                            fetchStudentCalendar(teacherAsStudent, new Date().getFullYear(), new Date().getMonth());
                          }}>
                            <div style={{ width: 32, height: 32, borderRadius: 8, overflow: "hidden", background: "linear-gradient(135deg,#059669,#34D399)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                              {t.photo && t.photo.startsWith("http") ? <img src={t.photo} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : <span style={{ color: "#fff", fontWeight: 700, fontSize: ".7rem" }}>{t.name?.charAt(0)}</span>}
                            </div>
                            <div>
                              <div style={{ fontWeight: 600, color: "#059669", textDecoration: "underline", textDecorationStyle: "dotted" }}>{t.name}</div>
                              {t.isDirector && <span style={{ fontSize: ".62rem", color: "#D98D04", fontWeight: 700 }}>DIRECTOR</span>}
                              {!t.isDirector && <div style={{ fontSize: ".6rem", color: "#6B7F99" }}>Click for calendar</div>}
                            </div>
                          </div>
                        </td>
                        <td style={{ padding: "10px 14px", textAlign: "center" }}><span style={s.badge("#7C3AED", "#FAF5FF")}>{t.subject}</span></td>
                        <td style={{ padding: "10px 14px", textAlign: "center", fontFamily: "monospace", fontSize: ".72rem", color: t.rfidCode ? "#7C3AED" : "#DC2626" }}>{t.rfidCode || "No RFID"}</td>
                        <td style={{ padding: "10px 14px", textAlign: "center" }}>
                          {checkIn ? (
                            <div>
                              <span style={{ color: "#16A34A", fontWeight: 700, fontSize: ".78rem" }}>
                                {new Date(checkIn.timestamp).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}
                              </span>
                              {checkIn.manual && <div style={{ fontSize: ".62rem", color: "#6B7F99" }}>Manual</div>}
                            </div>
                          ) : <span style={{ color: "#B0C4DC" }}>—</span>}
                        </td>
                        <td style={{ padding: "10px 14px", textAlign: "center" }}>
                          {checkOut ? (
                            <div>
                              <span style={{ color: "#D98D04", fontWeight: 700, fontSize: ".78rem" }}>
                                {new Date(checkOut.timestamp).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}
                              </span>
                              {checkOut.manual && <div style={{ fontSize: ".62rem", color: "#6B7F99" }}>Manual</div>}
                            </div>
                          ) : <span style={{ color: "#B0C4DC" }}>—</span>}
                        </td>
                        <td style={{ padding: "10px 14px", textAlign: "center" }}>
                          {(() => {
                            const tLeave = teacherLeaves.find(lv =>
  (lv.teacherEmail === t.email || lv.teacherName === t.name) &&
  lv.fromDate <= attDate &&
  (lv.toDate || lv.fromDate) >= attDate
);
                            if (isHol) return <span style={s.badge("#D98D04", "#FEF3C7")}>Holiday</span>;
                            if (tPresent) return <span style={s.badge("#16A34A", "#F0FDF4")}>P</span>;
                            if (tLeave) return (
                              <div>
                                <span style={{ display: "inline-block", padding: "3px 8px", borderRadius: 99, fontSize: ".68rem", fontWeight: 800, background: "#FEF3C7", color: "#92400E", border: "1px solid #FDE68A" }}>🏖 Leave</span>
                                <div style={{ fontSize: ".6rem", color: "#B45309", marginTop: 2, maxWidth: 80, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={tLeave.reason}>{tLeave.reason?.slice(0, 15)}{tLeave.reason?.length > 15 ? "..." : ""}</div>
                              </div>
                            );
                            if (isAbsentManual) return <span style={s.badge("#DC2626", "#FEF2F2")}>A</span>;
                            return <span style={s.badge("#6B7F99", "#F0F4FA")}>—</span>;
                          })()}
                        </td>
                        <td style={{ padding: "10px 14px", textAlign: "center" }}>
                          {!tPresent && !isAbsentManual && !isHol && (
                            <div style={{ display: "flex", gap: 4, justifyContent: "center" }}>
                              <button onClick={async () => {
                                try {
                                  await addDoc(collection(db, "attendance"), {
                                    rfidCode: t.rfidCode || `TEACHER_${t.id}`, type: "in", studentId: `teacher_${t.id}`,
                                    studentName: t.name, studentClass: "Teacher", studentPhoto: t.photo || "",
                                    deviceId: "manual-admin", date: attDate, timestamp: new Date().toISOString(),
                                    manual: true, isTeacher: true, markedBy: user?.email, createdAt: serverTimestamp(),
                                  });
                                  showMsg(`${t.name} marked Present`);
                                } catch (e) { showMsg("Error: " + e.message); }
                              }} style={{ padding: "4px 10px", borderRadius: 6, border: "1px solid #86EFAC", background: "#F0FDF4", color: "#16A34A", fontSize: ".68rem", fontWeight: 700, cursor: "pointer" }}>
                                <i className="fas fa-check" style={{ marginRight: 3 }} />P
                              </button>
                              <button onClick={async () => {
                                const reason = prompt(`${t.name} absent kyun hai? (Reason likho, khali chhodne pe bina reason save hoga)`);
                                if (reason === null) return;
                                try {
                                  await addDoc(collection(db, "attendance"), {
                                    rfidCode: t.rfidCode || `TEACHER_${t.id}`, type: "absent", studentId: `teacher_${t.id}`,
                                    studentName: t.name, studentClass: "Teacher", studentPhoto: t.photo || "",
                                    deviceId: "manual-admin", date: attDate, timestamp: new Date().toISOString(),
                                    manual: true, isTeacher: true, absentReason: reason || "", markedBy: user?.email, createdAt: serverTimestamp(),
                                  });
                                  showMsg(`${t.name} marked Absent${reason ? " — " + reason : ""}`);
                                } catch (e) { showMsg("Error: " + e.message); }
                              }} style={{ padding: "4px 10px", borderRadius: 6, border: "1px solid #FCA5A5", background: "#FEF2F2", color: "#DC2626", fontSize: ".68rem", fontWeight: 700, cursor: "pointer" }}>
                                <i className="fas fa-times" style={{ marginRight: 3 }} />A
                              </button>
                            </div>
                          )}
                          {tPresent && !checkOut && (
                            <button onClick={async () => {
                              try {
                                await addDoc(collection(db, "attendance"), {
                                  rfidCode: t.rfidCode || `TEACHER_${t.id}`, type: "out", studentId: `teacher_${t.id}`,
                                  studentName: t.name, studentClass: "Teacher", studentPhoto: t.photo || "",
                                  deviceId: "manual-admin", date: attDate, timestamp: new Date().toISOString(),
                                  manual: true, isTeacher: true, markedBy: user?.email, createdAt: serverTimestamp(),
                                });
                                showMsg(`${t.name} Check-OUT marked`);
                              } catch (e) { showMsg("Error: " + e.message); }
                            }} style={{ padding: "4px 10px", borderRadius: 6, border: "1px solid #FDE68A", background: "#FFFBEB", color: "#92400E", fontSize: ".68rem", fontWeight: 700, cursor: "pointer" }}>
                              <i className="fas fa-sign-out-alt" style={{ marginRight: 3 }} />OUT
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  }) : (
                    <tr><td colSpan={8} style={{ padding: 40, textAlign: "center", color: "#6B7F99" }}>
                      Teachers tab me pehle teachers add karo
                    </td></tr>
                  )}
                </tbody>
              </table>}
            </div>
          </>}

          {/* Tips */}
          <div style={{ marginTop: 16, background: "#FFFBEB", borderRadius: 12, padding: 16, border: "1px solid #FDE68A", fontSize: ".82rem", color: "#78350F", display: "flex", alignItems: "flex-start", gap: 10 }}>
            <i className="fas fa-lightbulb" style={{ marginTop: 2, flexShrink: 0, color: "#D98D04" }} />
            <div>
              <strong>Attendance System Tips:</strong><br />
              • RFID card tap = auto check-in/out · RFID match nahi hua? Students tab me RFID code check karo<br />
              • Manual P/A buttons se teacher bhi attendance mark kar sakte hain (card bhul gaya to)<br />
              • Holiday add karo Holidays tab se — holiday ke din absent nahi lagega<br />
              • Batch expired students automatically hide ho jayenge register se<br />
              • Teacher attendance bhi daily track karo
            </div>
          </div>
        </>}

        {/* ═══════════ RECORDS TAB (Attendance + Students + Teachers + Fees) ═══════════ */}
        {tab === "records" && <>
          {/* Header */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, flexWrap: "wrap", gap: 10 }}>
            <div>
              <h2 style={{ fontSize: "1.3rem", fontWeight: 800 }}><i className="fas fa-archive" style={{ marginRight: 8, color: "#7C3AED" }} />Records</h2>
              <p style={{ fontSize: ".78rem", color: "#6B7F99" }}>Permanent archive — Attendance, Students, Teachers & Fee Records</p>
            </div>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              {recMainTab === "attendance" && <button onClick={exportRecordsExcel} style={{ padding: "8px 14px", borderRadius: 8, border: "1px solid #86EFAC", background: "#F0FDF4", color: "#059669", fontSize: ".78rem", fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", gap: 5 }}><i className="fas fa-file-excel" /> Export A4 Excel</button>}
            </div>
          </div>

          {/* ═══ BATCH / SESSION YEAR HEADING ═══ */}
          <div style={{ background: "linear-gradient(135deg, #1E1B4B, #312E81)", borderRadius: 14, padding: "18px 24px", marginBottom: 16, display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
              <div style={{ width: 48, height: 48, borderRadius: 12, background: "rgba(255,255,255,.12)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <i className="fas fa-graduation-cap" style={{ color: "#F5AC10", fontSize: "1.3rem" }} />
              </div>
              <div>
                <div style={{ fontSize: "1.25rem", fontWeight: 800, color: "#fff", letterSpacing: ".5px" }}>
                  Batch {recBatchYear}-{String(recBatchYear + 1).slice(2)}
                </div>
                <div style={{ fontSize: ".74rem", color: "rgba(255,255,255,.6)", marginTop: 2 }}>
                  Session: April {recBatchYear} — March {recBatchYear + 1} · {recBatchYear === getCurrentBatchYear() ? "Current Session" : "Previous Session"}
                </div>
              </div>
            </div>
            <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
              {recBatchYear !== getCurrentBatchYear() && (
                <button onClick={() => { setRecBatchYear(getCurrentBatchYear()); setRecWeekOffset(0); }} style={{ padding: "8px 16px", borderRadius: 8, border: "1px solid rgba(255,255,255,.25)", background: "rgba(255,255,255,.1)", color: "#fff", fontSize: ".78rem", fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}>
                  <i className="fas fa-arrow-left" />Current Batch
                </button>
              )}
              <button onClick={() => setRecShowHistory(!recShowHistory)} style={{ padding: "8px 16px", borderRadius: 8, border: "none", background: recShowHistory ? "#F5AC10" : "rgba(255,255,255,.15)", color: recShowHistory ? "#1E1B4B" : "#F5AC10", fontSize: ".78rem", fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}>
                <i className={`fas ${recShowHistory ? "fa-times" : "fa-history"}`} />
                {recShowHistory ? "Close" : "Previous Years"}
              </button>
            </div>
          </div>

          {/* ═══ PREVIOUS YEARS HISTORY PANEL ═══ */}
          {recShowHistory && (
            <div style={{ background: "#fff", borderRadius: 12, border: "2px solid #E9D5FF", padding: 20, marginBottom: 16 }}>
              <h3 style={{ fontSize: ".95rem", fontWeight: 700, color: "#1E1B4B", marginBottom: 14 }}><i className="fas fa-folder-open" style={{ marginRight: 8, color: "#7C3AED" }} />Select Batch / Session Year</h3>
              <p style={{ fontSize: ".76rem", color: "#6B7F99", marginBottom: 14 }}>Kisi bhi purane batch ka record dekhne ke liye year select karo. Data permanently saved hai — chahe RFID expire ho.</p>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {(() => {
                  const cy = getCurrentBatchYear();
                  const years = [];
                  for (let y = cy; y >= cy - 5; y--) years.push(y);
                  return years.map(y => (
                    <button key={y} onClick={() => { setRecBatchYear(y); setRecWeekOffset(0); setRecShowHistory(false); if (y !== cy) { const diff = Math.floor((new Date() - new Date(y, 3, 1)) / (1000*60*60*24*7)); setRecWeekOffset(-diff); } }} style={{ padding: "12px 20px", borderRadius: 10, border: recBatchYear === y ? "2px solid #7C3AED" : "1px solid #D4DEF0", background: recBatchYear === y ? "#FAF5FF" : y === cy ? "#F0FDF4" : "#F8FAFD", color: recBatchYear === y ? "#7C3AED" : "#1C2E44", fontSize: ".85rem", fontWeight: 700, cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: 4, minWidth: 100 }}>
                      <i className={`fas ${y === cy ? "fa-star" : "fa-folder"}`} style={{ color: y === cy ? "#16A34A" : "#6B7F99", fontSize: ".9rem" }} />
                      <span>{y}-{String(y + 1).slice(2)}</span>
                      <span style={{ fontSize: ".62rem", color: "#6B7F99", fontWeight: 500 }}>{y === cy ? "Current" : `Apr ${y} - Mar ${y+1}`}</span>
                    </button>
                  ));
                })()}
              </div>
            </div>
          )}

          {/* ═══ MAIN TABS: Attendance | Students | Teachers | Fees ═══ */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 6, marginBottom: 16 }}>
            {[
              { id: "attendance", icon: "fa-clipboard-list", label: "Attendance Record", color: "#1349A8" },
              { id: "students", icon: "fa-user-graduate", label: "Students Record", color: "#059669" },
              { id: "teachers", icon: "fa-chalkboard-teacher", label: "Teacher Records", color: "#7C3AED" },
              { id: "fees", icon: "fa-rupee-sign", label: "Fee Record", color: "#D98D04" },
            ].map(t => (
              <button key={t.id} onClick={() => { setRecMainTab(t.id); setRecClassFilter("all"); }} style={{
                padding: "14px 10px", borderRadius: 10, border: recMainTab === t.id ? `2px solid ${t.color}` : "1px solid #D4DEF0",
                background: recMainTab === t.id ? "#fff" : "#F8FAFD",
                color: recMainTab === t.id ? t.color : "#6B7F99",
                fontSize: ".78rem", fontWeight: 700, cursor: "pointer",
                boxShadow: recMainTab === t.id ? `0 4px 12px ${t.color}22` : "none",
                transition: "all .2s", display: "flex", flexDirection: "column", alignItems: "center", gap: 6
              }}>
                <i className={`fas ${t.icon}`} style={{ fontSize: "1.1rem" }} />{t.label}
              </button>
            ))}
          </div>

          {/* ═══ CLASS FILTER (Board + Medium wise — matching image) ═══ */}
          {(recMainTab === "attendance" || recMainTab === "students" || recMainTab === "fees") && (
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: ".78rem", fontWeight: 700, color: "#1C2E44", marginBottom: 8 }}><i className="fas fa-filter" style={{ marginRight: 6, color: "#7C3AED" }} />Filter by Class / Medium / Board:</div>
              <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                <button onClick={() => setRecClassFilter("all")} style={{ padding: "7px 14px", borderRadius: 8, border: recClassFilter === "all" ? "2px solid #1349A8" : "1px solid #D4DEF0", background: recClassFilter === "all" ? "#EFF6FF" : "#fff", color: recClassFilter === "all" ? "#1349A8" : "#6B7F99", fontSize: ".72rem", fontWeight: 700, cursor: "pointer" }}>All</button>
                {CLASS_CATEGORIES.map(cat => {
                  const count = filterByBatch(students, cat.id).length;
                  return (
                    <button key={cat.id} onClick={() => setRecClassFilter(cat.id)} style={{
                      padding: "7px 12px", borderRadius: 8,
                      border: recClassFilter === cat.id ? `2px solid ${cat.color}` : "1px solid #D4DEF0",
                      background: recClassFilter === cat.id ? `${cat.color}15` : "#fff",
                      color: recClassFilter === cat.id ? cat.color : "#4A5E78",
                      fontSize: ".68rem", fontWeight: 600, cursor: "pointer",
                      display: "flex", alignItems: "center", gap: 4, whiteSpace: "nowrap"
                    }}>
                      <i className={`fas ${cat.icon}`} style={{ fontSize: ".6rem" }} />
                      {cat.shortLabel}
                      <span style={{ background: recClassFilter === cat.id ? cat.color : "#E8EFF8", color: recClassFilter === cat.id ? "#fff" : "#6B7F99", padding: "1px 6px", borderRadius: 10, fontSize: ".58rem", fontWeight: 700 }}>{count}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* ═══════════════════════════════════════════ */}
          {/* ═══ ATTENDANCE RECORD SUB-TAB ═══ */}
          {/* ═══════════════════════════════════════════ */}
          {recMainTab === "attendance" && <>
            {/* Week Navigation */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16, background: "#fff", borderRadius: 12, border: "1px solid #D4DEF0", padding: "12px 18px" }}>
              <button onClick={() => setRecWeekOffset(recWeekOffset - 1)} style={{ padding: "8px 14px", borderRadius: 8, border: "1px solid #D4DEF0", background: "#F8FAFD", cursor: "pointer", fontSize: ".82rem", fontWeight: 600, color: "#4A5E78" }}>
                <i className="fas fa-chevron-left" style={{ marginRight: 6 }} />Prev Week
              </button>
              <div style={{ textAlign: "center" }}>
                <div style={{ fontWeight: 700, fontSize: ".92rem", color: "#0B1826" }}>{getArWeekLabel(recWeekOffset)}</div>
                <div style={{ fontSize: ".68rem", color: "#6B7F99" }}>{recWeekOffset === 0 ? "Current Week" : recWeekOffset === -1 ? "Last Week" : `${Math.abs(recWeekOffset)} weeks ${recWeekOffset < 0 ? "ago" : "ahead"}`}</div>
              </div>
              <div style={{ display: "flex", gap: 6 }}>
                <button onClick={() => setRecWeekOffset(0)} style={{ padding: "8px 12px", borderRadius: 8, border: "1px solid #D4DEF0", background: recWeekOffset === 0 ? "#EFF6FF" : "#F8FAFD", cursor: "pointer", fontSize: ".72rem", fontWeight: 600, color: "#1349A8" }}>This Week</button>
                <button onClick={() => setRecWeekOffset(recWeekOffset + 1)} style={{ padding: "8px 14px", borderRadius: 8, border: "1px solid #D4DEF0", background: "#F8FAFD", cursor: "pointer", fontSize: ".82rem", fontWeight: 600, color: "#4A5E78" }}>
                  Next Week<i className="fas fa-chevron-right" style={{ marginLeft: 6 }} />
                </button>
              </div>
            </div>

            {/* Loading */}
            {recLoading && <div style={{ textAlign: "center", padding: 30, color: "#6B7F99" }}><i className="fas fa-spinner fa-spin" style={{ fontSize: "1.5rem", marginBottom: 8 }} /><p style={{ fontSize: ".82rem" }}>Loading records...</p></div>}

            {/* Attendance Register Table */}
            {!recLoading && (() => {
              const dates = getArWeekDates(recWeekOffset);
              const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
              const todayStr = new Date().toISOString().split("T")[0];
              let personList = [];

              if (recClassFilter === "all") {
                // Sabhi students (all classes) + teachers
                personList = [
                  ...teachers.map(t => ({ id: `teacher_${t.id}`, name: t.name, classLabel: "Teacher", detail: t.subject || "", rfidCode: t.rfidCode || "", photo: t.photo || "", batchStart: t.cardValidFrom || "", batchEnd: t.cardValidTo || "", isExpired: t.cardValidTo ? todayStr > t.cardValidTo : false, isTeacher: true })),
                  ...students.map(st => ({ id: st.id, name: st.studentName, classLabel: st.class || "N/A", detail: `${st.medium || ""} · ${st.board || ""}`, rfidCode: st.rfidCode || "", photo: st.photo || "", batchStart: st.batchStartDate || "", batchEnd: st.batchEndDate || "", isExpired: st.batchEndDate ? todayStr > st.batchEndDate : false, isTeacher: false })),
                ];
              } else {
                // Specific class filter
                const filtered = filterByBatch(students, recClassFilter);
                personList = filtered.map(st => ({ id: st.id, name: st.studentName, classLabel: st.class || "N/A", detail: `${st.medium || ""} · ${st.board || ""}`, rfidCode: st.rfidCode || "", photo: st.photo || "", batchStart: st.batchStartDate || "", batchEnd: st.batchEndDate || "", isExpired: st.batchEndDate ? todayStr > st.batchEndDate : false, isTeacher: false }));
              }

              personList.sort((a, b) => { if (a.isExpired && !b.isExpired) return 1; if (!a.isExpired && b.isExpired) return -1; return (a.name || "").localeCompare(b.name || ""); });

              const activeCount = personList.filter(p => !p.isExpired).length;
              const expiredCount = personList.filter(p => p.isExpired).length;
              const catLabel = recClassFilter === "all" ? "All" : (CLASS_CATEGORIES.find(c => c.id === recClassFilter)?.label || recClassFilter);

              return <>
                <div style={{ display: "flex", gap: 12, marginBottom: 12, fontSize: ".78rem", color: "#6B7F99", flexWrap: "wrap" }}>
                  <span style={{ fontWeight: 700, color: "#1C2E44" }}>{catLabel}</span>
                  <span><i className="fas fa-users" style={{ marginRight: 4, color: "#1349A8" }} />{personList.length} Total</span>
                  <span><i className="fas fa-check-circle" style={{ marginRight: 4, color: "#16A34A" }} />{activeCount} Active</span>
                  {expiredCount > 0 && <span><i className="fas fa-times-circle" style={{ marginRight: 4, color: "#DC2626" }} />{expiredCount} Expired</span>}
                </div>

                <div style={{ ...s.card, padding: 0, overflow: "auto" }}>
                  <div style={{ padding: "14px 18px", borderBottom: "2px solid #E2EAF4", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <h3 style={{ fontSize: ".92rem", fontWeight: 700, color: "#0B1826", margin: 0 }}>
                      <i className="fas fa-table" style={{ marginRight: 8, color: "#7C3AED" }} />
                      Attendance Record — Batch {recBatchYear}-{String(recBatchYear + 1).slice(2)} — {catLabel}
                    </h3>
                  </div>

                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: ".72rem" }}>
                    <thead>
                      <tr style={{ background: "#F0F4FA" }}>
                        <th style={{ padding: "8px 8px", textAlign: "left", fontWeight: 700, borderBottom: "2px solid #D4DEF0", position: "sticky", left: 0, background: "#F0F4FA", zIndex: 2, minWidth: 32 }}>#</th>
                        <th style={{ padding: "8px 8px", textAlign: "left", fontWeight: 700, borderBottom: "2px solid #D4DEF0", position: "sticky", left: 32, background: "#F0F4FA", zIndex: 2, minWidth: 140 }}>Name</th>
                        <th style={{ padding: "8px 6px", textAlign: "center", fontWeight: 700, borderBottom: "2px solid #D4DEF0", minWidth: 50, fontSize: ".65rem" }}>Class</th>
                        <th style={{ padding: "8px 6px", textAlign: "center", fontWeight: 700, borderBottom: "2px solid #D4DEF0", minWidth: 80, fontSize: ".62rem" }}>Medium/Board</th>
                        {dates.map(d => {
                          const dt = new Date(d + "T00:00:00");
                          const isHol = isHoliday(d);
                          const isSun = dt.getDay() === 0;
                          return (
                            <th key={d} style={{ padding: "6px 3px", textAlign: "center", fontWeight: 600, borderBottom: "2px solid #D4DEF0", minWidth: 34, background: isHol ? "#FEF3C7" : isSun ? "#FEF2F2" : "#F0F4FA", fontSize: ".63rem" }}>
                              <div>{String(dt.getDate()).padStart(2, "0")}</div>
                              <div style={{ color: isSun ? "#DC2626" : "#6B7F99", fontSize: ".55rem" }}>{dayNames[dt.getDay()]}</div>
                            </th>
                          );
                        })}
                        <th style={{ padding: "8px 4px", textAlign: "center", fontWeight: 700, borderBottom: "2px solid #D4DEF0", minWidth: 28, color: "#16A34A", background: "#F0FDF4", fontSize: ".65rem" }}>P</th>
                        <th style={{ padding: "8px 4px", textAlign: "center", fontWeight: 700, borderBottom: "2px solid #D4DEF0", minWidth: 28, color: "#DC2626", background: "#FEF2F2", fontSize: ".65rem" }}>A</th>
                        <th style={{ padding: "8px 4px", textAlign: "center", fontWeight: 700, borderBottom: "2px solid #D4DEF0", minWidth: 32, color: "#1349A8", fontSize: ".65rem" }}>%</th>
                        <th style={{ padding: "8px 4px", textAlign: "center", fontWeight: 700, borderBottom: "2px solid #D4DEF0", minWidth: 50, fontSize: ".62rem" }}>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {personList.length === 0 ? (
                        <tr><td colSpan={dates.length + 8} style={{ padding: 40, textAlign: "center", color: "#6B7F99" }}><i className="fas fa-folder-open" style={{ fontSize: "2rem", color: "#B0C4DC", display: "block", marginBottom: 8 }} />Is category me koi record nahi mila</td></tr>
                      ) : personList.map((p, idx) => {
                        let totalP = 0, totalA = 0, totalWorking = 0;
                        const bgColor = p.isExpired ? "#FFF5F5" : idx % 2 === 0 ? "#fff" : "#FAFCFE";
                        return (
                          <tr key={p.id} style={{ borderBottom: "1px solid #E8EFF8", background: bgColor }}>
                            <td style={{ padding: "7px 8px", fontWeight: 600, color: "#6B7F99", position: "sticky", left: 0, background: bgColor, zIndex: 1, fontSize: ".7rem" }}>{idx + 1}</td>
                            <td style={{ padding: "7px 8px", position: "sticky", left: 32, background: bgColor, zIndex: 1 }}>
                              <div style={{ display: "flex", alignItems: "center", gap: 5, cursor: "pointer" }} onClick={() => {
                                const calP = { id: p.id, studentName: p.name, class: p.classLabel, rfidCode: p.rfidCode, photo: p.photo };
                                fetchStudentCalendar(calP, new Date().getFullYear(), new Date().getMonth());
                              }}>
                                <div style={{ width: 24, height: 24, borderRadius: 5, overflow: "hidden", flexShrink: 0, background: p.isTeacher ? "linear-gradient(135deg,#059669,#34D399)" : "linear-gradient(135deg,#1349A8,#2A6FE0)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                                  {p.photo && p.photo.startsWith("http") ? <img src={p.photo} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : <span style={{ color: "#fff", fontWeight: 700, fontSize: ".5rem" }}>{p.name?.charAt(0)}</span>}
                                </div>
                                <span style={{ fontWeight: 600, fontSize: ".72rem", color: p.isExpired ? "#DC2626" : p.isTeacher ? "#059669" : "#1349A8", textDecoration: "underline", textDecorationStyle: "dotted" }}>{p.name}</span>
                              </div>
                            </td>
                            <td style={{ padding: "4px 4px", textAlign: "center" }}><span style={s.badge(p.isTeacher ? "#059669" : "#1349A8", p.isTeacher ? "#F0FDF4" : "#EFF6FF")}>{p.classLabel}</span></td>
                            <td style={{ padding: "4px 4px", textAlign: "center", fontSize: ".6rem", color: "#6B7F99" }}>{p.detail || "—"}</td>
                            {dates.map(d => {
                              const isHol = isHoliday(d);
                              const isSun = new Date(d + "T00:00:00").getDay() === 0;
                              if (isHol || isSun) return <td key={d} style={{ padding: "3px 2px", textAlign: "center", background: isHol ? "#FFFBEB" : "#FEF2F2" }}><span style={{ fontSize: ".58rem", fontWeight: 700, color: isHol ? "#D98D04" : "#FCA5A5" }}>{isHol ? "H" : "S"}</span></td>;
                              totalWorking++;
                              const dayAtt = recData.filter(a => a.studentId === p.id && a.date === d);
                              const hasIn = dayAtt.some(a => a.type === "in");
                              const isFuture = d > todayStr;
                              if (hasIn) { totalP++; return <td key={d} style={{ padding: "3px 2px", textAlign: "center", background: "#F0FDF4" }}><span style={{ color: "#16A34A", fontWeight: 800, fontSize: ".68rem" }}>P</span></td>; }
                              if (!isFuture) { totalA++; return <td key={d} style={{ padding: "3px 2px", textAlign: "center", background: "#FEF2F2" }}><span style={{ color: "#DC2626", fontWeight: 700, fontSize: ".68rem" }}>A</span></td>; }
                              return <td key={d} style={{ padding: "3px 2px", textAlign: "center" }}><span style={{ color: "#B0C4DC", fontSize: ".6rem" }}>—</span></td>;
                            })}
                            <td style={{ padding: "4px 3px", textAlign: "center", fontWeight: 800, color: "#16A34A", background: "#F0FDF4", fontSize: ".72rem" }}>{totalP}</td>
                            <td style={{ padding: "4px 3px", textAlign: "center", fontWeight: 800, color: "#DC2626", background: "#FEF2F2", fontSize: ".72rem" }}>{totalA}</td>
                            <td style={{ padding: "4px 3px", textAlign: "center", fontWeight: 800, color: "#1349A8", fontSize: ".72rem" }}>{totalWorking > 0 ? Math.round((totalP / totalWorking) * 100) : 0}%</td>
                            <td style={{ padding: "4px 3px", textAlign: "center" }}>{p.isExpired ? <span style={s.badge("#DC2626", "#FEF2F2")}>Exp</span> : <span style={s.badge("#16A34A", "#F0FDF4")}>Act</span>}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {expiredCount > 0 && (
                  <div style={{ background: "#FEF2F2", borderRadius: 10, padding: 12, border: "1px solid #FCA5A5", marginTop: 10, fontSize: ".76rem", color: "#991B1B", display: "flex", alignItems: "flex-start", gap: 8 }}>
                    <i className="fas fa-info-circle" style={{ marginTop: 2, flexShrink: 0 }} />
                    <span><strong>{expiredCount} Expired records</strong> — Pink background me dikhenge. Ye data permanently saved hai. Attendance tab se hata diye gaye hain par yahan hamesha dikhenge.</span>
                  </div>
                )}
              </>;
            })()}
          </>}

          {/* ═══════════════════════════════════════════ */}
          {/* ═══ STUDENTS RECORD SUB-TAB ═══ */}
          {/* ═══════════════════════════════════════════ */}
          {recMainTab === "students" && (() => {
            let stList = [...students];
            if (recClassFilter !== "all") stList = filterByBatch(stList, recClassFilter);
            stList.sort((a, b) => (a.studentName || "").localeCompare(b.studentName || ""));
            const catLabel = recClassFilter === "all" ? "All Students" : (CLASS_CATEGORIES.find(c => c.id === recClassFilter)?.label || recClassFilter);

            return <>
              <div style={{ ...s.card, marginBottom: 0 }}>
                <h3 style={{ fontSize: ".95rem", fontWeight: 700, color: "#0B1826", marginBottom: 14 }}><i className="fas fa-user-graduate" style={{ marginRight: 8, color: "#059669" }} />Students Record — Batch {recBatchYear}-{String(recBatchYear + 1).slice(2)} — {catLabel} ({stList.length})</h3>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: ".78rem" }}>
                  <thead>
                    <tr style={{ background: "#F0F4FA" }}>
                      <th style={{ padding: "10px 10px", textAlign: "left", fontWeight: 700, borderBottom: "2px solid #D4DEF0" }}>#</th>
                      <th style={{ padding: "10px 10px", textAlign: "left", fontWeight: 700, borderBottom: "2px solid #D4DEF0" }}>Student Name</th>
                      <th style={{ padding: "10px 8px", textAlign: "center", fontWeight: 700, borderBottom: "2px solid #D4DEF0" }}>Class</th>
                      <th style={{ padding: "10px 8px", textAlign: "center", fontWeight: 700, borderBottom: "2px solid #D4DEF0" }}>Medium</th>
                      <th style={{ padding: "10px 8px", textAlign: "center", fontWeight: 700, borderBottom: "2px solid #D4DEF0" }}>Board</th>
                      <th style={{ padding: "10px 8px", textAlign: "center", fontWeight: 700, borderBottom: "2px solid #D4DEF0" }}>RFID</th>
                      <th style={{ padding: "10px 8px", textAlign: "center", fontWeight: 700, borderBottom: "2px solid #D4DEF0" }}>Batch Period</th>
                      <th style={{ padding: "10px 8px", textAlign: "center", fontWeight: 700, borderBottom: "2px solid #D4DEF0" }}>Father</th>
                      <th style={{ padding: "10px 8px", textAlign: "center", fontWeight: 700, borderBottom: "2px solid #D4DEF0" }}>Phone</th>
                      <th style={{ padding: "10px 8px", textAlign: "center", fontWeight: 700, borderBottom: "2px solid #D4DEF0" }}>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stList.length === 0 ? (
                      <tr><td colSpan={10} style={{ padding: 40, textAlign: "center", color: "#6B7F99" }}>No students in this category</td></tr>
                    ) : stList.map((st, idx) => {
                      const today = new Date().toISOString().split("T")[0];
                      const isExp = st.batchEndDate ? today > st.batchEndDate : false;
                      return (
                        <tr key={st.id} style={{ borderBottom: "1px solid #E8EFF8", background: isExp ? "#FFF5F5" : idx % 2 === 0 ? "#fff" : "#FAFCFE" }}>
                          <td style={{ padding: "8px 10px", fontWeight: 600, color: "#6B7F99" }}>{idx + 1}</td>
                          <td style={{ padding: "8px 10px" }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                              <div style={{ width: 28, height: 28, borderRadius: 6, overflow: "hidden", flexShrink: 0, background: "linear-gradient(135deg,#1349A8,#2A6FE0)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                                {st.photo && st.photo.startsWith("http") ? <img src={st.photo} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : <span style={{ color: "#fff", fontWeight: 700, fontSize: ".55rem" }}>{st.studentName?.charAt(0)}</span>}
                              </div>
                              <span style={{ fontWeight: 600, color: isExp ? "#DC2626" : "#0B1826" }}>{st.studentName}</span>
                            </div>
                          </td>
                          <td style={{ padding: "8px 6px", textAlign: "center" }}><span style={s.badge("#1349A8", "#EFF6FF")}>{st.class}</span></td>
                          <td style={{ padding: "8px 6px", textAlign: "center", fontSize: ".72rem", color: "#4A5E78" }}>{st.medium || "—"}</td>
                          <td style={{ padding: "8px 6px", textAlign: "center", fontSize: ".72rem", color: "#4A5E78" }}>{st.board || "—"}</td>
                          <td style={{ padding: "8px 6px", textAlign: "center", fontFamily: "monospace", fontSize: ".68rem", color: st.rfidCode ? "#7C3AED" : "#B0C4DC" }}>{st.rfidCode || "—"}</td>
                          <td style={{ padding: "8px 6px", textAlign: "center", fontSize: ".68rem", color: "#6B7F99" }}>{st.batchStartDate && st.batchEndDate ? `${st.batchStartDate} → ${st.batchEndDate}` : "—"}</td>
                          <td style={{ padding: "8px 6px", textAlign: "center", fontSize: ".72rem", color: "#4A5E78" }}>{st.fatherName || "—"}</td>
                          <td style={{ padding: "8px 6px", textAlign: "center", fontSize: ".72rem", color: "#4A5E78" }}>{st.studentPhone || "—"}</td>
                          <td style={{ padding: "8px 6px", textAlign: "center" }}>{isExp ? <span style={s.badge("#DC2626", "#FEF2F2")}>Expired</span> : st.status === "active" ? <span style={s.badge("#16A34A", "#F0FDF4")}>Active</span> : <span style={s.badge("#6B7F99", "#F0F4FA")}>Inactive</span>}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </>;
          })()}

          {/* ═══════════════════════════════════════════ */}
          {/* ═══ TEACHER RECORDS SUB-TAB ═══ */}
          {/* ═══════════════════════════════════════════ */}
          {recMainTab === "teachers" && (
            <div style={{ ...s.card, marginBottom: 0 }}>
              <h3 style={{ fontSize: ".95rem", fontWeight: 700, color: "#0B1826", marginBottom: 14 }}><i className="fas fa-chalkboard-teacher" style={{ marginRight: 8, color: "#7C3AED" }} />Teacher Records — Batch {recBatchYear}-{String(recBatchYear + 1).slice(2)} ({teachers.length})</h3>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: ".78rem" }}>
                <thead>
                  <tr style={{ background: "#F0F4FA" }}>
                    <th style={{ padding: "10px 10px", textAlign: "left", fontWeight: 700, borderBottom: "2px solid #D4DEF0" }}>#</th>
                    <th style={{ padding: "10px 10px", textAlign: "left", fontWeight: 700, borderBottom: "2px solid #D4DEF0" }}>Teacher Name</th>
                    <th style={{ padding: "10px 8px", textAlign: "center", fontWeight: 700, borderBottom: "2px solid #D4DEF0" }}>Subject</th>
                    <th style={{ padding: "10px 8px", textAlign: "center", fontWeight: 700, borderBottom: "2px solid #D4DEF0" }}>Qualification</th>
                    <th style={{ padding: "10px 8px", textAlign: "center", fontWeight: 700, borderBottom: "2px solid #D4DEF0" }}>Experience</th>
                    <th style={{ padding: "10px 8px", textAlign: "center", fontWeight: 700, borderBottom: "2px solid #D4DEF0" }}>Classes</th>
                    <th style={{ padding: "10px 8px", textAlign: "center", fontWeight: 700, borderBottom: "2px solid #D4DEF0" }}>RFID</th>
                    <th style={{ padding: "10px 8px", textAlign: "center", fontWeight: 700, borderBottom: "2px solid #D4DEF0" }}>Card Validity</th>
                    <th style={{ padding: "10px 8px", textAlign: "center", fontWeight: 700, borderBottom: "2px solid #D4DEF0" }}>Phone</th>
                    <th style={{ padding: "10px 8px", textAlign: "center", fontWeight: 700, borderBottom: "2px solid #D4DEF0" }}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {teachers.length === 0 ? (
                    <tr><td colSpan={10} style={{ padding: 40, textAlign: "center", color: "#6B7F99" }}>No teachers found</td></tr>
                  ) : teachers.map((t, idx) => {
                    const today = new Date().toISOString().split("T")[0];
                    const isExp = t.cardValidTo ? today > t.cardValidTo : false;
                    return (
                      <tr key={t.id} style={{ borderBottom: "1px solid #E8EFF8", background: isExp ? "#FFF5F5" : idx % 2 === 0 ? "#fff" : "#FAFCFE" }}>
                        <td style={{ padding: "8px 10px", fontWeight: 600, color: "#6B7F99" }}>{idx + 1}</td>
                        <td style={{ padding: "8px 10px" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                            <div style={{ width: 28, height: 28, borderRadius: 6, overflow: "hidden", flexShrink: 0, background: "linear-gradient(135deg,#059669,#34D399)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                              {t.photo && t.photo.startsWith("http") ? <img src={t.photo} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : <span style={{ color: "#fff", fontWeight: 700, fontSize: ".55rem" }}>{t.name?.charAt(0)}</span>}
                            </div>
                            <div>
                              <span style={{ fontWeight: 600, color: isExp ? "#DC2626" : "#0B1826" }}>{t.name}</span>
                              {t.isDirector && <span style={{ fontSize: ".58rem", color: "#D98D04", fontWeight: 700, marginLeft: 6 }}>DIRECTOR</span>}
                            </div>
                          </div>
                        </td>
                        <td style={{ padding: "8px 6px", textAlign: "center" }}><span style={s.badge("#7C3AED", "#FAF5FF")}>{t.subject}</span></td>
                        <td style={{ padding: "8px 6px", textAlign: "center", fontSize: ".72rem", color: "#4A5E78" }}>{t.qualification || "—"}</td>
                        <td style={{ padding: "8px 6px", textAlign: "center", fontSize: ".72rem", color: "#4A5E78" }}>{t.experience || "—"}</td>
                        <td style={{ padding: "8px 6px", textAlign: "center", fontSize: ".72rem", color: "#4A5E78" }}>{t.classes || "—"}</td>
                        <td style={{ padding: "8px 6px", textAlign: "center", fontFamily: "monospace", fontSize: ".68rem", color: t.rfidCode ? "#7C3AED" : "#B0C4DC" }}>{t.rfidCode || "—"}</td>
                        <td style={{ padding: "8px 6px", textAlign: "center", fontSize: ".68rem", color: "#6B7F99" }}>{t.cardValidFrom && t.cardValidTo ? `${t.cardValidFrom} → ${t.cardValidTo}` : "—"}</td>
                        <td style={{ padding: "8px 6px", textAlign: "center", fontSize: ".72rem", color: "#4A5E78" }}>{t.phone || "—"}</td>
                        <td style={{ padding: "8px 6px", textAlign: "center" }}>{isExp ? <span style={s.badge("#DC2626", "#FEF2F2")}>Expired</span> : <span style={s.badge("#16A34A", "#F0FDF4")}>Active</span>}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* ═══════════════════════════════════════════ */}
          {/* ═══ FEE RECORD SUB-TAB ═══ */}
          {/* ═══════════════════════════════════════════ */}
          {recMainTab === "fees" && (() => {
            let stList = [...students];
            if (recClassFilter !== "all") stList = filterByBatch(stList, recClassFilter);
            stList.sort((a, b) => (a.studentName || "").localeCompare(b.studentName || ""));
            const catLabel = recClassFilter === "all" ? "All Students" : (CLASS_CATEGORIES.find(c => c.id === recClassFilter)?.label || recClassFilter);
            const totalFees = stList.reduce((s, st) => s + Number(st.totalFee || 0), 0);
            const totalPaid = stList.reduce((s, st) => s + Number(st.enrollmentFeePaid || 0), 0);
            const totalDue = totalFees - totalPaid;

            return <>
              {/* Fee Stats */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: 10, marginBottom: 14 }}>
                {[
                  { n: `₹${totalFees.toLocaleString("en-IN")}`, l: "Total Fees", c: "#1349A8", icon: "fa-money-bill-wave" },
                  { n: `₹${totalPaid.toLocaleString("en-IN")}`, l: "Collected", c: "#16A34A", icon: "fa-check-circle" },
                  { n: `₹${Math.max(0, totalDue).toLocaleString("en-IN")}`, l: "Due", c: "#DC2626", icon: "fa-exclamation-circle" },
                  { n: stList.filter(st => st.totalFee && Number(st.enrollmentFeePaid || 0) >= Number(st.totalFee)).length, l: "Fully Paid", c: "#059669", icon: "fa-user-check" },
                ].map((x, i) => (
                  <div key={i} style={s.stat}><i className={`fas ${x.icon}`} style={{ fontSize: "1rem", color: x.c, marginBottom: 4 }} /><div style={{ fontSize: "1.2rem", fontWeight: 800, color: x.c }}>{x.n}</div><div style={{ fontSize: ".7rem", color: "#6B7F99" }}>{x.l}</div></div>
                ))}
              </div>

              <div style={{ ...s.card, marginBottom: 0 }}>
                <h3 style={{ fontSize: ".95rem", fontWeight: 700, color: "#0B1826", marginBottom: 14 }}><i className="fas fa-rupee-sign" style={{ marginRight: 8, color: "#D98D04" }} />Fee Record — Batch {recBatchYear}-{String(recBatchYear + 1).slice(2)} — {catLabel} ({stList.length})</h3>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: ".78rem" }}>
                  <thead>
                    <tr style={{ background: "#F0F4FA" }}>
                      <th style={{ padding: "10px 10px", textAlign: "left", fontWeight: 700, borderBottom: "2px solid #D4DEF0" }}>#</th>
                      <th style={{ padding: "10px 10px", textAlign: "left", fontWeight: 700, borderBottom: "2px solid #D4DEF0" }}>Student Name</th>
                      <th style={{ padding: "10px 8px", textAlign: "center", fontWeight: 700, borderBottom: "2px solid #D4DEF0" }}>Class</th>
                      <th style={{ padding: "10px 8px", textAlign: "center", fontWeight: 700, borderBottom: "2px solid #D4DEF0" }}>Medium</th>
                      <th style={{ padding: "10px 8px", textAlign: "center", fontWeight: 700, borderBottom: "2px solid #D4DEF0" }}>Board</th>
                      <th style={{ padding: "10px 8px", textAlign: "center", fontWeight: 700, borderBottom: "2px solid #D4DEF0" }}>Total Fee</th>
                      <th style={{ padding: "10px 8px", textAlign: "center", fontWeight: 700, borderBottom: "2px solid #D4DEF0" }}>Paid</th>
                      <th style={{ padding: "10px 8px", textAlign: "center", fontWeight: 700, borderBottom: "2px solid #D4DEF0" }}>Due</th>
                      <th style={{ padding: "10px 8px", textAlign: "center", fontWeight: 700, borderBottom: "2px solid #D4DEF0" }}>Batch</th>
                      <th style={{ padding: "10px 8px", textAlign: "center", fontWeight: 700, borderBottom: "2px solid #D4DEF0" }}>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stList.length === 0 ? (
                      <tr><td colSpan={10} style={{ padding: 40, textAlign: "center", color: "#6B7F99" }}>No students found</td></tr>
                    ) : stList.map((st, idx) => {
                      const due = Math.max(0, Number(st.totalFee || 0) - Number(st.enrollmentFeePaid || 0));
                      const fullyPaid = st.totalFee && due === 0;
                      const today = new Date().toISOString().split("T")[0];
                      const isExp = st.batchEndDate ? today > st.batchEndDate : false;
                      return (
                        <tr key={st.id} style={{ borderBottom: "1px solid #E8EFF8", background: isExp ? "#FFF5F5" : idx % 2 === 0 ? "#fff" : "#FAFCFE" }}>
                          <td style={{ padding: "8px 10px", fontWeight: 600, color: "#6B7F99" }}>{idx + 1}</td>
                          <td style={{ padding: "8px 10px", fontWeight: 600, color: isExp ? "#DC2626" : "#0B1826" }}>{st.studentName}</td>
                          <td style={{ padding: "8px 6px", textAlign: "center" }}><span style={s.badge("#1349A8", "#EFF6FF")}>{st.class}</span></td>
                          <td style={{ padding: "8px 6px", textAlign: "center", fontSize: ".72rem", color: "#4A5E78" }}>{st.medium || "—"}</td>
                          <td style={{ padding: "8px 6px", textAlign: "center", fontSize: ".72rem", color: "#4A5E78" }}>{st.board || "—"}</td>
                          <td style={{ padding: "8px 6px", textAlign: "center", fontWeight: 700, color: "#1349A8" }}>{st.totalFee ? `₹${Number(st.totalFee).toLocaleString("en-IN")}` : "—"}</td>
                          <td style={{ padding: "8px 6px", textAlign: "center", fontWeight: 700, color: "#16A34A" }}>{st.enrollmentFeePaid ? `₹${Number(st.enrollmentFeePaid).toLocaleString("en-IN")}` : "—"}</td>
                          <td style={{ padding: "8px 6px", textAlign: "center", fontWeight: 700, color: due > 0 ? "#DC2626" : "#16A34A" }}>{st.totalFee ? `₹${due.toLocaleString("en-IN")}` : "—"}</td>
                          <td style={{ padding: "8px 6px", textAlign: "center", fontSize: ".68rem", color: "#6B7F99" }}>{st.batchStartDate && st.batchEndDate ? `${st.batchStartDate.slice(5)} → ${st.batchEndDate.slice(5)}` : "—"}</td>
                          <td style={{ padding: "8px 6px", textAlign: "center" }}>{fullyPaid ? <span style={s.badge("#16A34A", "#F0FDF4")}>Paid</span> : due > 0 ? <span style={s.badge("#DC2626", "#FEF2F2")}>Due</span> : <span style={s.badge("#6B7F99", "#F0F4FA")}>—</span>}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </>;
          })()}

          {/* Tips */}
          <div style={{ marginTop: 16, background: "#FFFBEB", borderRadius: 12, padding: 16, border: "1px solid #FDE68A", fontSize: ".82rem", color: "#78350F", display: "flex", alignItems: "flex-start", gap: 10 }}>
            <i className="fas fa-lightbulb" style={{ marginTop: 2, flexShrink: 0, color: "#D98D04" }} />
            <div>
              <strong>Records Section Tips:</strong><br />
              • Batch {getCurrentBatchYear()}-{String(getCurrentBatchYear() + 1).slice(2)} current session hai (April {getCurrentBatchYear()} — March {getCurrentBatchYear() + 1}). Ye har saal automatically change hota hai<br />
              • "Previous Years" button se kisi bhi purane batch ka complete record dekh sakte ho<br />
              • Saara data <strong>permanently saved</strong> hai — RFID expire hone par bhi yahan hamesha dikhega<br />
              • Class filter se Board + Medium ke hisaab se students ko separate dekho (e.g. 12th Hindi CG+CBSE)<br />
              • 4 sections: Attendance Record (weekly P/A), Students Record (details), Teacher Records, Fee Record<br />
              • Expired batch wale pink background me dikhenge
            </div>
          </div>
        </>}

        {/* ═══════════ HOLIDAYS & SCHEDULE TAB ═══════════ */}
        {tab === "holidays" && <>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, flexWrap: "wrap", gap: 10 }}>
            <div>
              <h2 style={{ fontSize: "1.3rem", fontWeight: 800 }}><i className="fas fa-calendar-check" style={{ marginRight: 8, color: "#7C3AED" }} />Holidays & Scheduled Notifications</h2>
              <p style={{ fontSize: ".78rem", color: "#6B7F99" }}>Manage holidays, events calendar, and send notifications to students & parents</p>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={() => { setShowHolidayForm(true); setHolidayForm({}); }} style={s.btnP}><i className="fas fa-plus" style={{ marginRight: 6 }} />Add Holiday</button>
              <button onClick={() => { setShowNotifForm(true); setNotifForm({}); }} style={s.btnO}><i className="fas fa-bell" style={{ marginRight: 6 }} />Schedule Notification</button>
            </div>
          </div>

          {/* Calendar View */}
          <div style={{ ...s.card }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
              <button onClick={() => { if (calMonth === 0) { setCalMonth(11); setCalYear(calYear - 1); } else setCalMonth(calMonth - 1); }} style={s.btnGray}><i className="fas fa-chevron-left" /></button>
              <h3 style={{ fontSize: "1rem", fontWeight: 700, color: "#0B1826" }}>
                {new Date(calYear, calMonth).toLocaleDateString("en-IN", { month: "long", year: "numeric" })}
              </h3>
              <button onClick={() => { if (calMonth === 11) { setCalMonth(0); setCalYear(calYear + 1); } else setCalMonth(calMonth + 1); }} style={s.btnGray}><i className="fas fa-chevron-right" /></button>
            </div>

            {/* Day Headers */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 2, marginBottom: 4 }}>
              {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map(d => (
                <div key={d} style={{ textAlign: "center", fontSize: ".72rem", fontWeight: 700, color: "#6B7F99", padding: 6 }}>{d}</div>
              ))}
            </div>

            {/* Calendar Grid */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 2 }}>
              {(() => {
                const firstDay = new Date(calYear, calMonth, 1).getDay();
                const offset = firstDay === 0 ? 6 : firstDay - 1;
                const daysInMonth = new Date(calYear, calMonth + 1, 0).getDate();
                const cells = [];
                for (let i = 0; i < offset; i++) cells.push(<div key={`e${i}`} />);
                for (let d = 1; d <= daysInMonth; d++) {
                  const dateStr = `${calYear}-${String(calMonth + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
                  const hol = holidays.find(h => h.date === dateStr);
                  const notif = notifications.filter(n => n.date === dateStr);
                  const isToday = dateStr === new Date().toISOString().split("T")[0];
                  const isSun = new Date(calYear, calMonth, d).getDay() === 0;
                  cells.push(
                    <div key={d} style={{ minHeight: 70, padding: 6, borderRadius: 8, border: isToday ? "2px solid #1349A8" : "1px solid #E8EFF8", background: hol ? "#FEF3C7" : isSun ? "#FFF1F2" : "#fff", position: "relative", cursor: "pointer" }}
                      onClick={() => { if (!hol) { setShowHolidayForm(true); setHolidayForm({ date: dateStr }); } }}>
                      <div style={{ fontSize: ".75rem", fontWeight: isToday ? 800 : 600, color: isToday ? "#1349A8" : isSun ? "#DC2626" : "#1C2E44" }}>{d}</div>
                      {hol && <div style={{ fontSize: ".58rem", color: "#92400E", fontWeight: 600, marginTop: 2, lineHeight: 1.3 }}><i className="fas fa-star" style={{ marginRight: 2, fontSize: ".5rem" }} />{hol.title}</div>}
                      {notif.map((n, ni) => (
                        <div key={ni} style={{ fontSize: ".55rem", color: "#7C3AED", fontWeight: 600, marginTop: 1, lineHeight: 1.2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          <i className="fas fa-bell" style={{ marginRight: 2, fontSize: ".45rem" }} />{n.message?.substring(0, 20)}
                        </div>
                      ))}
                    </div>
                  );
                }
                return cells;
              })()}
            </div>
          </div>

          {/* Holiday Form */}
          {showHolidayForm && (
            <div style={{ ...s.card, border: "2px solid #7C3AED" }}>
              <h3 style={{ fontSize: "1rem", fontWeight: 700, color: "#7C3AED", marginBottom: 14 }}><i className="fas fa-calendar-plus" style={{ marginRight: 8 }} />{holidayForm.editId ? "Edit" : "Add"} Holiday</h3>

              {/* Single vs Multi Day Toggle */}
              {!holidayForm.editId && <div style={{ display: "flex", gap: 6, marginBottom: 12 }}>
                <button onClick={() => setHolidayForm({ ...holidayForm, multiDay: false })} style={{ padding: "7px 16px", borderRadius: 8, border: !holidayForm.multiDay ? "2px solid #7C3AED" : "1px solid #D4DEF0", background: !holidayForm.multiDay ? "#FAF5FF" : "#fff", color: !holidayForm.multiDay ? "#7C3AED" : "#6B7F99", fontSize: ".78rem", fontWeight: 700, cursor: "pointer" }}>
                  <i className="fas fa-calendar-day" style={{ marginRight: 6 }} />Single Day
                </button>
                <button onClick={() => setHolidayForm({ ...holidayForm, multiDay: true })} style={{ padding: "7px 16px", borderRadius: 8, border: holidayForm.multiDay ? "2px solid #7C3AED" : "1px solid #D4DEF0", background: holidayForm.multiDay ? "#FAF5FF" : "#fff", color: holidayForm.multiDay ? "#7C3AED" : "#6B7F99", fontSize: ".78rem", fontWeight: 700, cursor: "pointer" }}>
                  <i className="fas fa-calendar-week" style={{ marginRight: 6 }} />Multiple Days (Date Range)
                </button>
              </div>}

              <div style={{ display: "grid", gridTemplateColumns: holidayForm.multiDay ? "1fr 1fr 2fr 1fr" : "1fr 2fr 1fr", gap: 10 }}>
                {holidayForm.multiDay ? <>
                  <div><label style={s.label}>From Date *</label><input style={s.input} type="date" value={holidayForm.dateFrom || ""} onChange={e => setHolidayForm({ ...holidayForm, dateFrom: e.target.value })} /></div>
                  <div><label style={s.label}>To Date *</label><input style={s.input} type="date" value={holidayForm.dateTo || ""} onChange={e => setHolidayForm({ ...holidayForm, dateTo: e.target.value })} />
                    {holidayForm.dateFrom && holidayForm.dateTo && (() => {
                      const days = Math.ceil((new Date(holidayForm.dateTo) - new Date(holidayForm.dateFrom)) / (1000*60*60*24)) + 1;
                      return days > 0 ? <div style={{ fontSize: ".68rem", color: "#7C3AED", marginTop: -6, fontWeight: 600 }}>{days} din ki chhutthi</div> : null;
                    })()}
                  </div>
                </> : <div><label style={s.label}>Date *</label><input style={s.input} type="date" value={holidayForm.date || ""} onChange={e => setHolidayForm({ ...holidayForm, date: e.target.value })} /></div>}
                <div><label style={s.label}>Holiday Title *</label><input style={s.input} placeholder="e.g. Republic Day, Holi, Diwali Break" value={holidayForm.title || ""} onChange={e => setHolidayForm({ ...holidayForm, title: e.target.value })} /></div>
                <div><label style={s.label}>Type</label>
                  <select style={s.input} value={holidayForm.type || ""} onChange={e => setHolidayForm({ ...holidayForm, type: e.target.value })}>
                    <option value="">Select</option><option>National Holiday</option><option>Festival</option><option>Institute Holiday</option><option>Exam Break</option><option>Other</option>
                  </select>
                </div>
              </div>
              <div><label style={s.label}>Description (optional)</label><input style={s.input} placeholder="Any additional details..." value={holidayForm.description || ""} onChange={e => setHolidayForm({ ...holidayForm, description: e.target.value })} /></div>
              <div style={{ marginBottom: 10 }}>
                <label style={s.label}>Holiday For *</label>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 8 }}>
                  <button type="button" onClick={() => setHolidayForm({ ...holidayForm, holidayFor: "all", holidayClasses: [] })} style={{ padding: "6px 14px", borderRadius: 8, border: holidayForm.holidayFor !== "specific" ? "2px solid #16A34A" : "1px solid #D4DEF0", background: holidayForm.holidayFor !== "specific" ? "#F0FDF4" : "#fff", color: holidayForm.holidayFor !== "specific" ? "#16A34A" : "#6B7F99", fontSize: ".78rem", fontWeight: 700, cursor: "pointer" }}>
                    <i className="fas fa-users" style={{ marginRight: 4 }} />All Students (Sabhi ke liye)
                  </button>
                  <button type="button" onClick={() => setHolidayForm({ ...holidayForm, holidayFor: "specific" })} style={{ padding: "6px 14px", borderRadius: 8, border: holidayForm.holidayFor === "specific" ? "2px solid #1349A8" : "1px solid #D4DEF0", background: holidayForm.holidayFor === "specific" ? "#EFF6FF" : "#fff", color: holidayForm.holidayFor === "specific" ? "#1349A8" : "#6B7F99", fontSize: ".78rem", fontWeight: 700, cursor: "pointer" }}>
                    <i className="fas fa-user-tag" style={{ marginRight: 4 }} />Specific Class (Sirf kuch classes ke liye)
                  </button>
                </div>
                {holidayForm.holidayFor === "specific" && (
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap", padding: 12, background: "#F8FAFD", borderRadius: 10, border: "1px solid #E8EFF8" }}>
                    {BATCH_OPTIONS.map(b => {
                      const selected = (holidayForm.holidayClasses || []).includes(b.value);
                      return (
                        <button key={b.value} type="button" onClick={() => {
                          const current = holidayForm.holidayClasses || [];
                          const updated = selected ? current.filter(v => v !== b.value) : [...current, b.value];
                          setHolidayForm({ ...holidayForm, holidayClasses: updated });
                        }} style={{ padding: "5px 12px", borderRadius: 6, border: selected ? "2px solid #1349A8" : "1px solid #D4DEF0", background: selected ? "#EFF6FF" : "#fff", color: selected ? "#1349A8" : "#6B7F99", fontSize: ".72rem", fontWeight: 600, cursor: "pointer", transition: "all .15s" }}>
                          {selected && <i className="fas fa-check" style={{ marginRight: 4, fontSize: ".6rem" }} />}{b.label}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
              <div style={{ display: "flex", gap: 10 }}>
                <button onClick={saveHoliday} disabled={saving} style={s.btnP}><i className="fas fa-save" style={{ marginRight: 6 }} />{saving ? "Saving..." : "Save Holiday"}</button>
                <button onClick={() => { setShowHolidayForm(false); setHolidayForm({}); }} style={s.btnGray}>Cancel</button>
              </div>
            </div>
          )}

          {/* Notification Form */}
          {showNotifForm && (
            <div style={{ ...s.card, border: "2px solid #D98D04" }}>
              <h3 style={{ fontSize: "1rem", fontWeight: 700, color: "#D98D04", marginBottom: 14 }}><i className="fas fa-bell" style={{ marginRight: 8 }} />Schedule Notification</h3>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
                <div><label style={s.label}>Date *</label><input style={s.input} type="date" value={notifForm.date || ""} onChange={e => setNotifForm({ ...notifForm, date: e.target.value })} /></div>
                <div><label style={s.label}>Time to Send</label><input style={s.input} type="time" value={notifForm.time || ""} onChange={e => setNotifForm({ ...notifForm, time: e.target.value })} /></div>
                <div><label style={s.label}>Send To (Students)</label>
                  <select style={s.input} value={notifForm.target || "all"} onChange={e => setNotifForm({ ...notifForm, target: e.target.value })}>
                    <option value="all">All Students & Parents</option>
                    <option value="students">All Students Only</option>
                    <option value="parents">All Parents Only</option>
                    <option value="teachers_all">🏫 All Teachers Only</option>
                    <optgroup label="Class 12th">
                      {BATCH_OPTIONS.filter(b => b.class === "12th").map(b => <option key={b.value} value={b.value}>{b.label}</option>)}
                    </optgroup>
                    <optgroup label="Class 11th">
                      {BATCH_OPTIONS.filter(b => b.class === "11th").map(b => <option key={b.value} value={b.value}>{b.label}</option>)}
                    </optgroup>
                    <optgroup label="Class 10th">
                      {BATCH_OPTIONS.filter(b => b.class === "10th").map(b => <option key={b.value} value={b.value}>{b.label}</option>)}
                    </optgroup>
                    <optgroup label="Class 9th">
                      {BATCH_OPTIONS.filter(b => b.class === "9th").map(b => <option key={b.value} value={b.value}>{b.label}</option>)}
                    </optgroup>
                    <optgroup label="Junior Classes">
                      {BATCH_OPTIONS.filter(b => b.class === "2nd-8th").map(b => <option key={b.value} value={b.value}>{b.label}</option>)}
                    </optgroup>
                    <optgroup label="Entrance Coaching">
                      {BATCH_OPTIONS.filter(b => b.class === "Navodaya" || b.class === "Prayas").map(b => <option key={b.value} value={b.value}>{b.label}</option>)}
                    </optgroup>
                  </select>
                </div>
              </div>
              {/* ═══ TEACHER NOTIFICATION SECTION ═══ */}
              <div style={{ background: "#FAF5FF", borderRadius: 10, border: "1px solid #E9D5FF", padding: "12px 14px", marginBottom: 4 }}>
                <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", marginBottom: notifForm.sendToTeachers ? 10 : 0 }}>
                  <input type="checkbox" checked={notifForm.sendToTeachers || false}
                    onChange={e => setNotifForm({ ...notifForm, sendToTeachers: e.target.checked, teacherTarget: "all" })}
                    style={{ width: 16, height: 16, accentColor: "#7C3AED" }} />
                  <span style={{ fontSize: ".82rem", fontWeight: 700, color: "#7C3AED" }}>
                    <i className="fas fa-chalkboard-teacher" style={{ marginRight: 6 }} />Teachers ko bhi yahi notification bhejo
                  </span>
                </label>
                {notifForm.sendToTeachers && (
                  <div>
                    <label style={s.label}>Kaun se Teacher(s) ko bhejo?</label>
                    <select style={s.input} value={notifForm.teacherTarget || "all"}
                      onChange={e => setNotifForm({ ...notifForm, teacherTarget: e.target.value })}>
                      <option value="all">All Teachers (Sabhi)</option>
                      {teachers.map(t => (
                        <option key={t.id} value={t.email || t.id}>
                          {t.name} — {t.subject}
                        </option>
                      ))}
                    </select>
                    <p style={{ fontSize: ".7rem", color: "#7C3AED", margin: "-6px 0 0" }}>
                      <i className="fas fa-info-circle" style={{ marginRight: 4 }} />
                      Ye notification Teacher App mein bell icon pe dikhega
                    </p>
                  </div>
                )}
              </div>
              <div><label style={s.label}>Notification Type</label>
                <select style={s.input} value={notifForm.notifType || ""} onChange={e => {
                  const val = e.target.value;
                  if (val === "fee") {
                    // Fee Reminder = auto set to parents only
                    setNotifForm({ ...notifForm, notifType: val, target: notifForm.target === "all" || notifForm.target === "students" ? "parents" : notifForm.target, isFeeReminder: true });
                  } else {
                    setNotifForm({ ...notifForm, notifType: val, isFeeReminder: false });
                  }
                }}>
                  <option value="">Select Type</option><option value="test">Test / Exam</option><option value="holiday">Holiday Notice</option><option value="fee">Fee Reminder</option><option value="event">Event</option><option value="general">General</option>
                </select>
              </div>

              {/* Fee Reminder Info Box */}
              {notifForm.notifType === "fee" && (
                <div style={{ background: "#FEF3C7", border: "1px solid #FDE68A", borderRadius: 10, padding: 14, marginBottom: 12, fontSize: ".8rem" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
                    <i className="fas fa-info-circle" style={{ color: "#D98D04" }} />
                    <strong style={{ color: "#92400E" }}>Fee Reminder Settings</strong>
                  </div>
                  <div style={{ color: "#78350F", lineHeight: 1.6, fontSize: ".76rem" }}>
                    <i className="fas fa-check-circle" style={{ color: "#16A34A", marginRight: 4 }} />Fee reminder <strong>sirf Parents</strong> ke paas jaayega (auto-selected)<br/>
                    <i className="fas fa-check-circle" style={{ color: "#16A34A", marginRight: 4 }} />Har parent ko unke <strong>bachche ka pending fee amount</strong> dikhega<br/>
                    <i className="fas fa-check-circle" style={{ color: "#16A34A", marginRight: 4 }} />Upar "Send To" se <strong>specific batch</strong> select karo ya "All Parents" rakho
                  </div>
                  {/* Preview of fee data for selected batch */}
                  {(() => {
                    let feeStudents = students.filter(x => x.status === "active");
                    if (notifForm.target && notifForm.target !== "all" && notifForm.target !== "parents" && notifForm.target !== "students") {
                      feeStudents = filterByBatch(feeStudents, notifForm.target);
                    }
                    const withDue = feeStudents.filter(st => {
                      const total = Number(st.totalFee || 0);
                      const paid = Number(st.enrollmentFeePaid || 0);
                      return total > 0 && paid < total;
                    });
                    const totalDue = withDue.reduce((sum, st) => sum + (Number(st.totalFee || 0) - Number(st.enrollmentFeePaid || 0)), 0);
                    return (
                      <div style={{ marginTop: 10, padding: 10, background: "#fff", borderRadius: 8, border: "1px solid #FDE68A" }}>
                        <div style={{ display: "flex", gap: 16, flexWrap: "wrap", fontSize: ".74rem" }}>
                          <span><strong style={{ color: "#DC2626" }}>{withDue.length}</strong> students with pending fees</span>
                          <span>Total due: <strong style={{ color: "#DC2626" }}>₹{totalDue.toLocaleString("en-IN")}</strong></span>
                        </div>
                        {withDue.length > 0 && withDue.length <= 10 && (
                          <div style={{ marginTop: 8, fontSize: ".7rem", color: "#4A5E78" }}>
                            {withDue.map(st => {
                              const due = Number(st.totalFee || 0) - Number(st.enrollmentFeePaid || 0);
                              return (
                                <div key={st.id} style={{ display: "flex", justifyContent: "space-between", padding: "3px 0", borderBottom: "1px solid #FEF3C7" }}>
                                  <span>{st.studentName} ({st.class})</span>
                                  <span style={{ color: "#DC2626", fontWeight: 700 }}>₹{due.toLocaleString("en-IN")} due</span>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })()}
                </div>
              )}

              <div><label style={s.label}>Message *</label><textarea style={{ ...s.input, height: 80, resize: "none" }} placeholder={notifForm.notifType === "fee" ? "e.g. Respected Parents, aapke bachche ki pending fees ₹{amount} hai. Kripya jald se jald jama karein. — Patel Institute Dongargaon" : "e.g. Kal 10th class ka Science test hai 10:00 AM se..."} value={notifForm.message || ""} onChange={e => setNotifForm({ ...notifForm, message: e.target.value })} /></div>
              <div style={{ display: "flex", gap: 10 }}>
                <button onClick={saveNotification} disabled={saving} style={s.btnP}><i className="fas fa-paper-plane" style={{ marginRight: 6 }} />{saving ? "Saving..." : "Schedule"}</button>
                <button onClick={() => { setShowNotifForm(false); setNotifForm({}); }} style={s.btnGray}>Cancel</button>
              </div>
            </div>
          )}

          {/* Holiday List */}
          <div style={{ ...s.card }}>
            <h3 style={{ fontSize: ".95rem", fontWeight: 700, marginBottom: 12 }}><i className="fas fa-list" style={{ marginRight: 6, color: "#7C3AED" }} />All Holidays ({holidays.length})</h3>
            {holidays.length > 0 ? holidays.map(h => (
              <div key={h.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 0", borderBottom: "1px solid #E8EFF8" }}>
                <div style={{ width: 44, textAlign: "center" }}>
                  <div style={{ fontSize: "1.1rem", fontWeight: 800, color: "#7C3AED" }}>{new Date(h.date + "T00:00:00").getDate()}</div>
                  <div style={{ fontSize: ".62rem", color: "#6B7F99" }}>{new Date(h.date + "T00:00:00").toLocaleDateString("en-IN", { month: "short" })}</div>
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 700, fontSize: ".86rem" }}>{h.title}</div>
                  <div style={{ fontSize: ".72rem", color: "#6B7F99" }}>
                    {h.type || ""} {h.description ? `· ${h.description}` : ""}
                    {h.holidayFor === "specific" && h.holidayClasses?.length > 0 && (
                      <span style={{ marginLeft: 6 }}>
                        · <i className="fas fa-user-tag" style={{ marginRight: 3, fontSize: ".6rem", color: "#1349A8" }} />
                        {h.holidayClasses.map(v => { const b = BATCH_OPTIONS.find(x => x.value === v); return b ? b.label : v; }).join(", ")}
                      </span>
                    )}
                    {(!h.holidayFor || h.holidayFor === "all") && <span style={{ marginLeft: 6 }}>· <i className="fas fa-users" style={{ marginRight: 3, fontSize: ".6rem", color: "#16A34A" }} />All Students</span>}
                  </div>
                </div>
                <div style={{ display: "flex", gap: 4 }}>
                  <button onClick={() => { setShowHolidayForm(true); setHolidayForm({ ...h, editId: h.id }); }} style={s.btnO}><i className="fas fa-edit" /></button>
                  <button onClick={() => deleteHoliday(h.id)} style={s.btnD}><i className="fas fa-trash" /></button>
                </div>
              </div>
            )) : <p style={{ fontSize: ".84rem", color: "#6B7F99" }}>Koi holiday add nahi hua abhi tak. Calendar me click karo ya "Add Holiday" button use karo.</p>}
          </div>

          {/* Student/Parent Notification List */}
          <div style={{ ...s.card }}>
            <h3 style={{ fontSize: ".95rem", fontWeight: 700, marginBottom: 12 }}>
              <i className="fas fa-bell" style={{ marginRight: 6, color: "#D98D04" }} />
              Student/Parent Notifications ({notifications.length})
            </h3>
            {notifications.length > 0 ? notifications.map(n => (
              <div key={n.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 0", borderBottom: "1px solid #E8EFF8" }}>
                <div style={{ width: 44, textAlign: "center" }}>
                  <div style={{ fontSize: "1.1rem", fontWeight: 800, color: "#D98D04" }}>{new Date(n.date + "T00:00:00").getDate()}</div>
                  <div style={{ fontSize: ".62rem", color: "#6B7F99" }}>{new Date(n.date + "T00:00:00").toLocaleDateString("en-IN", { month: "short" })}</div>
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 700, fontSize: ".86rem" }}>{n.message}</div>
                  <div style={{ fontSize: ".72rem", color: "#6B7F99" }}>
                    {n.notifType && <span style={s.badge("#7C3AED", "#FAF5FF")}>{n.notifType}</span>}
                    {" "}{n.time || ""} · Target: {n.target || "all"}
                  </div>
                </div>
                <div style={{ display: "flex", gap: 4 }}>
                  <button onClick={() => { setShowNotifForm(true); setNotifForm({ ...n, editId: n.id }); }} style={s.btnO}><i className="fas fa-edit" /></button>
                  <button onClick={() => deleteNotification(n.id)} style={s.btnD}><i className="fas fa-trash" /></button>
                </div>
              </div>
            )) : <p style={{ fontSize: ".84rem", color: "#6B7F99" }}>Koi notification scheduled nahi hai.</p>}
          </div>

          {/* ═══ TEACHER NOTIFICATIONS LIST ═══ */}
          <div style={{ ...s.card, border: "1px solid #E9D5FF" }}>
            <h3 style={{ fontSize: ".95rem", fontWeight: 700, marginBottom: 12 }}>
              <i className="fas fa-chalkboard-teacher" style={{ marginRight: 6, color: "#7C3AED" }} />
              Teacher Notifications ({teacherNotifications.length})
            </h3>

            {/* Edit Form — inline */}
            {notifForm.editTeacherId && (
              <div style={{ background: "#FAF5FF", borderRadius: 10, border: "2px solid #7C3AED", padding: 14, marginBottom: 14 }}>
                <h4 style={{ fontSize: ".88rem", fontWeight: 700, color: "#7C3AED", marginBottom: 10 }}>
                  <i className="fas fa-edit" style={{ marginRight: 6 }} />Teacher Notification Edit Karo
                </h4>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 }}>
                  <div>
                    <label style={s.label}>Scheduled Date</label>
                    <input style={s.input} type="date" value={notifForm.date || ""}
                      onChange={e => setNotifForm({ ...notifForm, date: e.target.value })} />
                  </div>
                  <div>
                    <label style={s.label}>Time</label>
                    <input style={s.input} type="time" value={notifForm.time || ""}
                      onChange={e => setNotifForm({ ...notifForm, time: e.target.value })} />
                  </div>
                </div>
                <div style={{ marginBottom: 10 }}>
                  <label style={s.label}>Type</label>
                  <select style={s.input} value={notifForm.notifType || "general"}
                    onChange={e => setNotifForm({ ...notifForm, notifType: e.target.value })}>
                    <option value="general">General</option>
                    <option value="holiday">Holiday</option>
                    <option value="exam">Exam</option>
                    <option value="urgent">Urgent</option>
                  </select>
                </div>
                <div style={{ marginBottom: 10 }}>
                  <label style={s.label}>Teacher</label>
                  <select style={s.input} value={notifForm.teacherTarget || "all"}
                    onChange={e => setNotifForm({ ...notifForm, teacherTarget: e.target.value })}>
                    <option value="all">All Teachers</option>
                    {teachers.map(t => (
                      <option key={t.id} value={t.email || t.id}>{t.name} — {t.subject}</option>
                    ))}
                  </select>
                </div>
                <div style={{ marginBottom: 12 }}>
                  <label style={s.label}>Message *</label>
                  <textarea style={{ ...s.input, height: 70, resize: "none" }}
                    value={notifForm.message || ""}
                    onChange={e => setNotifForm({ ...notifForm, message: e.target.value })} />
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <button onClick={saveTeacherNotification} disabled={saving} style={s.btnP}>
                    <i className="fas fa-save" style={{ marginRight: 6 }} />{saving ? "Saving..." : "Update Karo"}
                  </button>
                  <button onClick={() => setNotifForm({})} style={s.btnGray}>Cancel</button>
                </div>
              </div>
            )}

            {teacherNotifications.length > 0 ? teacherNotifications.map(n => {
              const typeColor = { holiday: "#16A34A", exam: "#1349A8", urgent: "#DC2626", general: "#7C3AED" }[n.type] || "#7C3AED";
              const typeBg = { holiday: "#F0FDF4", exam: "#EFF6FF", urgent: "#FEF2F2", general: "#FAF5FF" }[n.type] || "#FAF5FF";
              return (
                <div key={n.id} style={{ display: "flex", alignItems: "flex-start", gap: 12, padding: "12px 0", borderBottom: "1px solid #F3E8FF" }}>
                  {/* Type color dot */}
                  <div style={{ width: 10, height: 10, borderRadius: "50%", background: typeColor, flexShrink: 0, marginTop: 5 }} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 700, fontSize: ".86rem", marginBottom: 4 }}>{n.message}</div>
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
                      {n.type && <span style={s.badge(typeColor, typeBg)}>{n.type}</span>}
                      <span style={{ fontSize: ".7rem", color: "#6B7F99" }}>
                        <i className="fas fa-user" style={{ marginRight: 3 }} />
                        {n.forTeacher === "all" ? "All Teachers" : (teachers.find(t => t.email === n.forTeacher || t.id === n.forTeacher)?.name || n.forTeacher)}
                      </span>
                      {n.scheduledDate && (
                        <span style={{ fontSize: ".7rem", color: "#6B7F99" }}>
                          <i className="fas fa-calendar" style={{ marginRight: 3 }} />{n.scheduledDate} {n.scheduledTime || ""}
                        </span>
                      )}
                      <span style={{ fontSize: ".7rem", color: "#B0C4DC" }}>{timeAgo(n.createdAt)}</span>
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 4, flexShrink: 0 }}>
                    <button onClick={() => setNotifForm({
                      editTeacherId: n.id,
                      message: n.message,
                      notifType: n.type || "general",
                      date: n.scheduledDate || "",
                      time: n.scheduledTime || "",
                      teacherTarget: n.forTeacher || "all",
                    })} style={s.btnO}><i className="fas fa-edit" /></button>
                    <button onClick={() => deleteTeacherNotification(n.id)} style={s.btnD}><i className="fas fa-trash" /></button>
                  </div>
                </div>
              );
            }) : (
              <p style={{ fontSize: ".84rem", color: "#6B7F99" }}>
                Koi teacher notification nahi hai. "Schedule Notification" me "All Teachers Only" select karke bhejo.
              </p>
            )}
          </div>
        </>}

        {/* ═══════════ EXAMS & TESTS TAB ═══════════ */}
        {tab === "exams" && (() => {
          const typeColors = { weekly: "#1349A8", monthly: "#7C3AED", halfyearly: "#D98D04", annual: "#DC2626", mock: "#059669", practice: "#0891B2" };
          const typeLabels = { weekly: "Weekly", monthly: "Monthly", halfyearly: "Half-Yearly", annual: "Annual", mock: "Mock", practice: "Practice" };
          let filteredExams = [...examList];
          if (examClassFilter !== "all") filteredExams = filteredExams.filter(e => e.forClass === examClassFilter || e.forClass === "all");

          return (
            <div>
              {/* Header */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, flexWrap: "wrap", gap: 10 }}>
                <div>
                  <h2 style={{ fontSize: "1.3rem", fontWeight: 800 }}><i className="fas fa-file-alt" style={{ marginRight: 8, color: "#1349A8" }} />Exams & Test Management</h2>
                  <p style={{ fontSize: ".78rem", color: "#6B7F99" }}>Create exams · Enter marks · View results · Weekly / Monthly / Half-yearly</p>
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <button onClick={() => { setShowExamForm(true); setExamEditId(null); setExamForm({ examDate: new Date().toISOString().split("T")[0], totalMarksPerSubject: 100, examType: "weekly" }); }} style={{ ...s.btnP, display: "flex", alignItems: "center", gap: 6 }}>
                    <i className="fas fa-plus" /> Create Exam
                  </button>
                </div>
              </div>

              {/* View Toggle */}
              <div style={{ display: "flex", gap: 4, marginBottom: 16, background: "#E8EFF8", borderRadius: 10, padding: 4 }}>
                {[{ id: "list", icon: "fa-list", label: "Exam List" }, { id: "results", icon: "fa-poll", label: "Results View" }].map(v => (
                  <button key={v.id} onClick={() => setExamViewMode(v.id)} style={{ flex: 1, padding: "10px 16px", borderRadius: 8, border: "none", background: examViewMode === v.id ? "#fff" : "transparent", color: examViewMode === v.id ? "#1349A8" : "#6B7F99", fontSize: ".82rem", fontWeight: 700, cursor: "pointer", boxShadow: examViewMode === v.id ? "0 2px 8px rgba(0,0,0,.08)" : "none", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
                    <i className={`fas ${v.icon}`} style={{ fontSize: ".75rem" }} />{v.label}
                  </button>
                ))}
              </div>

              {/* Create/Edit Exam Form */}
              {showExamForm && (
                <div style={{ ...s.card, border: "2px solid #1349A8" }}>
                  <h3 style={{ fontSize: "1rem", fontWeight: 700, marginBottom: 16, color: "#1349A8" }}><i className="fas fa-edit" style={{ marginRight: 8 }} />{examEditId ? "Edit" : "Create New"} Exam</h3>
                  <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr", gap: 12 }}>
                    <div><label style={s.label}>Exam Title *</label><input style={s.input} placeholder="e.g. Weekly Test - Week 1 April" value={examForm.title || ""} onChange={e => setExamForm({ ...examForm, title: e.target.value })} /></div>
                    <div><label style={s.label}>Exam Date *</label><input style={s.input} type="date" value={examForm.examDate || ""} onChange={e => setExamForm({ ...examForm, examDate: e.target.value })} /></div>
                    <div><label style={s.label}>Exam Type *</label>
                      <select style={s.input} value={examForm.examType || "weekly"} onChange={e => setExamForm({ ...examForm, examType: e.target.value })}>
                        <option value="weekly">Weekly Test</option><option value="monthly">Monthly Test</option><option value="halfyearly">Half-Yearly Exam</option><option value="annual">Annual Exam</option><option value="mock">Mock Test</option><option value="practice">Practice Test</option>
                      </select>
                    </div>
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
                    <div><label style={s.label}>Total Marks Per Subject</label><input style={s.input} type="number" placeholder="100" value={examForm.totalMarksPerSubject || ""} onChange={e => setExamForm({ ...examForm, totalMarksPerSubject: Number(e.target.value) })} /></div>
                    <div><label style={s.label}>For Class / Batch</label>
                      <select style={s.input} value={examForm.forClass || "all"} onChange={e => setExamForm({ ...examForm, forClass: e.target.value })}>
                        <option value="all">All Classes</option>
                        {CLASS_CATEGORIES.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
                      </select>
                    </div>
                    <div><label style={s.label}>Description (optional)</label><input style={s.input} placeholder="e.g. Chapter 1-5 Syllabus" value={examForm.description || ""} onChange={e => setExamForm({ ...examForm, description: e.target.value })} /></div>
                  </div>
                  <div style={{ ...s.sectionTitle, marginTop: 8 }}><i className="fas fa-book" style={{ color: "#7C3AED" }} /> Exam Subjects (tick karo)</div>
                  <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 12 }}>
                    {["Physics", "Chemistry", "Maths", "Biology", "Science", "English", "Hindi", "Social Study", "Sanskrit", "Computer"].map(sub => (
                      <label key={sub} style={{ display: "flex", alignItems: "center", gap: 5, fontSize: ".82rem", fontWeight: 600, cursor: "pointer", padding: "6px 12px", borderRadius: 8, border: (examForm.subjects || []).includes(sub) ? "2px solid #1349A8" : "1px solid #D4DEF0", background: (examForm.subjects || []).includes(sub) ? "#EFF6FF" : "#fff" }}>
                        <input type="checkbox" checked={(examForm.subjects || []).includes(sub)} onChange={e => { const c = examForm.subjects || []; setExamForm({ ...examForm, subjects: e.target.checked ? [...c, sub] : c.filter(x => x !== sub) }); }} style={{ accentColor: "#1349A8" }} />{sub}
                      </label>
                    ))}
                  </div>
                  <div style={{ display: "flex", gap: 10 }}>
                    <button onClick={saveExam} disabled={saving} style={s.btnP}><i className="fas fa-save" style={{ marginRight: 6 }} />{saving ? "Saving..." : (examEditId ? "Update Exam" : "Create Exam")}</button>
                    <button onClick={() => { setShowExamForm(false); setExamForm({}); setExamEditId(null); }} style={s.btnGray}>Cancel</button>
                  </div>
                </div>
              )}

              {/* Class Filter */}
              <div style={{ display: "flex", gap: 6, marginBottom: 16, flexWrap: "wrap", alignItems: "center" }}>
                <button onClick={() => setExamClassFilter("all")} style={{ padding: "6px 14px", borderRadius: 8, border: examClassFilter === "all" ? "2px solid #1349A8" : "1px solid #D4DEF0", background: examClassFilter === "all" ? "#EFF6FF" : "#fff", color: "#1349A8", fontSize: ".74rem", fontWeight: 700, cursor: "pointer" }}>All</button>
                {CLASS_CATEGORIES.map(c => (
                  <button key={c.id} onClick={() => setExamClassFilter(c.id)} style={{ padding: "6px 10px", borderRadius: 8, border: examClassFilter === c.id ? "2px solid " + c.color : "1px solid #D4DEF0", background: examClassFilter === c.id ? "#EFF6FF" : "#fff", color: c.color, fontSize: ".68rem", fontWeight: 600, cursor: "pointer" }}>{c.shortLabel}</button>
                ))}
              </div>

              {/* Exam List View */}
              {examViewMode === "list" && (
                <div>
                  {filteredExams.length === 0 ? (
                    <div style={{ ...s.card, textAlign: "center", padding: 40 }}>
                      <i className="fas fa-file-alt" style={{ fontSize: "2.5rem", color: "#B0C4DC", marginBottom: 12 }} />
                      <h3 style={{ fontSize: "1rem", fontWeight: 700, color: "#4A5E78", marginBottom: 6 }}>No Exams Created Yet</h3>
                      <p style={{ fontSize: ".84rem", color: "#6B7F99" }}>Click "Create Exam" to add your first test.</p>
                    </div>
                  ) : filteredExams.map(exam => {
                    const catLabel = exam.forClass === "all" ? "All Classes" : (CLASS_CATEGORIES.find(c => c.id === exam.forClass)?.label || exam.forClass);
                    return (
                      <div key={exam.id} style={{ ...s.card, display: "flex", alignItems: "center", gap: 14, borderLeft: "4px solid " + (typeColors[exam.examType] || "#1349A8") }}>
                        <div style={{ width: 50, height: 50, borderRadius: 12, background: (typeColors[exam.examType] || "#1349A8") + "15", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                          <i className="fas fa-file-alt" style={{ fontSize: "1.2rem", color: typeColors[exam.examType] || "#1349A8" }} />
                        </div>
                        <div style={{ flex: 1 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4, flexWrap: "wrap" }}>
                            <span style={{ fontWeight: 700, fontSize: ".92rem" }}>{exam.title}</span>
                            <span style={s.badge(typeColors[exam.examType] || "#1349A8", (typeColors[exam.examType] || "#1349A8") + "15")}>{typeLabels[exam.examType] || exam.examType}</span>
                            <span style={s.badge("#6B7F99", "#F0F4FA")}>{catLabel}</span>
                          </div>
                          <div style={{ fontSize: ".76rem", color: "#4A5E78", display: "flex", gap: 12, flexWrap: "wrap" }}>
                            <span><i className="fas fa-calendar" style={{ marginRight: 4, color: "#6B7F99" }} />{exam.examDate}</span>
                            <span><i className="fas fa-star" style={{ marginRight: 4, color: "#6B7F99" }} />{exam.totalMarksPerSubject || 100} marks/subject</span>
                            <span><i className="fas fa-book" style={{ marginRight: 4, color: "#6B7F99" }} />{(exam.subjects || []).join(", ") || "No subjects"}</span>
                          </div>
                          {exam.description && <div style={{ fontSize: ".72rem", color: "#6B7F99", marginTop: 2 }}>{exam.description}</div>}
                        </div>
                        <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                          <button onClick={() => openMarksEntry(exam)} style={{ ...s.btnG, display: "flex", alignItems: "center", gap: 4 }}><i className="fas fa-pen" /> Marks</button>
                          <button onClick={() => { setExamEditId(exam.id); setExamForm({ ...exam }); setShowExamForm(true); }} style={s.btnO}><i className="fas fa-edit" /></button>
                          <button onClick={() => deleteExam(exam.id)} style={s.btnD}><i className="fas fa-trash" /></button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Results View */}
              {examViewMode === "results" && (
                <div>
                  {filteredExams.length === 0 ? (
                    <div style={{ ...s.card, textAlign: "center", padding: 30, color: "#6B7F99" }}>No exams found. Create an exam first.</div>
                  ) : filteredExams.map(exam => {
                    let stList = students.filter(x => x.status === "active");
                    if (exam.forClass !== "all") stList = filterByBatch(stList, exam.forClass);
                    const subjects = exam.subjects || [];
                    return (
                      <div key={exam.id} style={{ ...s.card, padding: 0, overflow: "auto", marginBottom: 16 }}>
                        <div style={{ padding: "14px 18px", borderBottom: "2px solid #E2EAF4", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
                          <h3 style={{ fontSize: ".95rem", fontWeight: 700, color: "#0B1826", margin: 0 }}><i className="fas fa-poll" style={{ marginRight: 8, color: "#1349A8" }} />{exam.title} — {exam.examDate}</h3>
                          <span style={{ fontSize: ".72rem", color: "#6B7F99" }}>{(CLASS_CATEGORIES.find(c => c.id === exam.forClass)?.label || "All Classes")} · {exam.totalMarksPerSubject || 100} marks/subject</span>
                        </div>
                        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: ".76rem" }}>
                          <thead><tr style={{ background: "#F0F4FA" }}>
                            <th style={{ padding: "8px 10px", textAlign: "left", fontWeight: 700, borderBottom: "2px solid #D4DEF0", minWidth: 30 }}>#</th>
                            <th style={{ padding: "8px 10px", textAlign: "left", fontWeight: 700, borderBottom: "2px solid #D4DEF0", minWidth: 140 }}>Student</th>
                            <th style={{ padding: "8px 8px", textAlign: "center", fontWeight: 700, borderBottom: "2px solid #D4DEF0" }}>Class</th>
                            {subjects.map(sub => <th key={sub} style={{ padding: "8px 6px", textAlign: "center", fontWeight: 700, borderBottom: "2px solid #D4DEF0", minWidth: 50 }}>{sub}</th>)}
                            <th style={{ padding: "8px 6px", textAlign: "center", fontWeight: 800, borderBottom: "2px solid #D4DEF0", color: "#1349A8", minWidth: 50 }}>Total</th>
                            <th style={{ padding: "8px 6px", textAlign: "center", fontWeight: 800, borderBottom: "2px solid #D4DEF0", color: "#059669", minWidth: 40 }}>%</th>
                          </tr></thead>
                          <tbody>
                            {stList.length === 0 ? <tr><td colSpan={subjects.length + 5} style={{ padding: 30, textAlign: "center", color: "#6B7F99" }}>No students for this class</td></tr>
                            : stList.map((st, idx) => {
                              const stMarks = marksData[st.id] || {};
                              const totalObtained = subjects.reduce((sm, sub) => sm + (Number(stMarks[sub]) || 0), 0);
                              const maxTotal = subjects.length * (exam.totalMarksPerSubject || 100);
                              const pct = maxTotal > 0 ? Math.round((totalObtained / maxTotal) * 100) : 0;
                              return (
                                <tr key={st.id} style={{ borderBottom: "1px solid #E8EFF8", background: idx % 2 === 0 ? "#fff" : "#FAFCFE" }}>
                                  <td style={{ padding: "8px 10px", color: "#6B7F99", fontWeight: 600 }}>{idx + 1}</td>
                                  <td style={{ padding: "8px 10px", fontWeight: 600 }}>{st.studentName}</td>
                                  <td style={{ padding: "8px 8px", textAlign: "center" }}><span style={s.badge("#1349A8", "#EFF6FF")}>{st.class}</span></td>
                                  {subjects.map(sub => <td key={sub} style={{ padding: "6px 4px", textAlign: "center", fontWeight: 600, color: stMarks[sub] ? "#0B1826" : "#B0C4DC" }}>{stMarks[sub] || "—"}</td>)}
                                  <td style={{ padding: "6px 4px", textAlign: "center", fontWeight: 800, color: "#1349A8" }}>{totalObtained > 0 ? totalObtained : "—"}</td>
                                  <td style={{ padding: "6px 4px", textAlign: "center", fontWeight: 800, color: pct >= 75 ? "#16A34A" : pct >= 50 ? "#D98D04" : pct > 0 ? "#DC2626" : "#B0C4DC" }}>{totalObtained > 0 ? pct + "%" : "—"}</td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Marks Entry Modal */}
              {examMarksModal && (() => {
                const exam = examMarksModal;
                const subjects = exam.subjects || [];
                let stList = students.filter(x => x.status === "active");
                if (exam.forClass !== "all") stList = filterByBatch(stList, exam.forClass);
                if (examSearch.trim()) { const q = examSearch.toLowerCase(); stList = stList.filter(x => x.studentName?.toLowerCase().includes(q)); }
                return (
                  <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.5)", zIndex: 9999, display: "flex", alignItems: "flex-start", justifyContent: "center", padding: 20, overflowY: "auto" }} onClick={() => setExamMarksModal(null)}>
                    <div style={{ background: "#fff", borderRadius: 16, padding: 24, maxWidth: 900, width: "100%", boxShadow: "0 20px 60px rgba(0,0,0,.2)", marginTop: 20, maxHeight: "90vh", overflowY: "auto" }} onClick={e => e.stopPropagation()}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, flexWrap: "wrap", gap: 8 }}>
                        <div>
                          <h3 style={{ fontSize: "1.05rem", fontWeight: 800, marginBottom: 2 }}><i className="fas fa-pen" style={{ marginRight: 8, color: "#16A34A" }} />Enter Marks — {exam.title}</h3>
                          <p style={{ fontSize: ".76rem", color: "#6B7F99", margin: 0 }}>{exam.examDate} · {exam.totalMarksPerSubject || 100} marks/subject · {(CLASS_CATEGORIES.find(c => c.id === exam.forClass)?.label || "All Classes")}</p>
                        </div>
                        <button onClick={() => setExamMarksModal(null)} style={{ width: 32, height: 32, borderRadius: 8, border: "1px solid #D4DEF0", background: "#F8FAFD", color: "#6B7F99", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}><i className="fas fa-times" /></button>
                      </div>
                      <input style={{ ...s.input, marginBottom: 12 }} placeholder="Search student name..." value={examSearch} onChange={e => setExamSearch(e.target.value)} />
                      <div style={{ overflow: "auto" }}>
                        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: ".78rem" }}>
                          <thead><tr style={{ background: "#F0F4FA" }}>
                            <th style={{ padding: "8px 10px", textAlign: "left", fontWeight: 700, borderBottom: "2px solid #D4DEF0" }}>#</th>
                            <th style={{ padding: "8px 10px", textAlign: "left", fontWeight: 700, borderBottom: "2px solid #D4DEF0", minWidth: 140 }}>Student</th>
                            <th style={{ padding: "8px 8px", textAlign: "center", fontWeight: 700, borderBottom: "2px solid #D4DEF0" }}>Class</th>
                            {subjects.map(sub => <th key={sub} style={{ padding: "8px 6px", textAlign: "center", fontWeight: 700, borderBottom: "2px solid #D4DEF0", minWidth: 65 }}>{sub}<br/><span style={{ fontSize: ".6rem", color: "#6B7F99" }}>/{exam.totalMarksPerSubject || 100}</span></th>)}
                            <th style={{ padding: "8px 6px", textAlign: "center", fontWeight: 700, borderBottom: "2px solid #D4DEF0", minWidth: 60 }}>Save</th>
                          </tr></thead>
                          <tbody>
                            {stList.length === 0 ? <tr><td colSpan={subjects.length + 4} style={{ padding: 30, textAlign: "center", color: "#6B7F99" }}>No students found</td></tr>
                            : stList.map((st, idx) => {
                              const stMarks = marksData[st.id] || {};
                              return (
                                <tr key={st.id} style={{ borderBottom: "1px solid #E8EFF8", background: idx % 2 === 0 ? "#fff" : "#FAFCFE" }}>
                                  <td style={{ padding: "6px 10px", color: "#6B7F99", fontWeight: 600 }}>{idx + 1}</td>
                                  <td style={{ padding: "6px 10px", fontWeight: 600, fontSize: ".82rem" }}>{st.studentName}</td>
                                  <td style={{ padding: "6px 8px", textAlign: "center" }}><span style={s.badge("#1349A8", "#EFF6FF")}>{st.class}</span></td>
                                  {subjects.map(sub => (
                                    <td key={sub} style={{ padding: "4px 4px", textAlign: "center" }}>
                                      <input type="number" min="0" max={exam.totalMarksPerSubject || 100} placeholder="—" value={stMarks[sub] || ""} onChange={e => { setMarksData(prev => ({ ...prev, [st.id]: { ...prev[st.id], [sub]: e.target.value } })); }} style={{ width: 50, textAlign: "center", border: "1.5px solid #C0D0E8", borderRadius: 6, padding: "5px 4px", fontSize: ".78rem", outline: "none" }} />
                                    </td>
                                  ))}
                                  <td style={{ padding: "4px 4px", textAlign: "center" }}>
                                    <button onClick={() => { const m = { ...(marksData[st.id] || {}) }; delete m._docId; saveStudentMarks(exam.id, st.id, m, exam.title); }} disabled={marksSaving} style={{ padding: "4px 10px", borderRadius: 6, border: "1px solid #86EFAC", background: "#F0FDF4", color: "#16A34A", fontSize: ".68rem", fontWeight: 700, cursor: "pointer" }}><i className="fas fa-check" /></button>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                      <div style={{ textAlign: "center", marginTop: 16 }}>
                        <button onClick={() => setExamMarksModal(null)} style={{ padding: "10px 24px", borderRadius: 8, border: "none", background: "#1349A8", color: "#fff", fontSize: ".82rem", fontWeight: 700, cursor: "pointer" }}>Close</button>
                      </div>
                    </div>
                  </div>
                );
              })()}

              {/* Tips */}
              <div style={{ marginTop: 16, background: "#FFFBEB", borderRadius: 12, padding: 16, border: "1px solid #FDE68A", fontSize: ".82rem", color: "#78350F", display: "flex", alignItems: "flex-start", gap: 10 }}>
                <i className="fas fa-lightbulb" style={{ marginTop: 2, flexShrink: 0, color: "#D98D04" }} />
                <div>
                  <strong>Exam & Test Tips:</strong><br />
                  • "Create Exam" se naya test banao — Weekly, Monthly, Half-Yearly, Mock sab types hain<br />
                  • Subjects tick karo jo exam me hain — marks entry me wahi dikhenge<br />
                  • "Marks" button se har student ke marks enter karo<br />
                  • "Results View" se class-wise result dekho — percentage auto-calculate hoti hai<br />
                  • Ye marks Student App aur Parent App me dikhenge automatically
                </div>
              </div>
            </div>
          );
        })()}


        {/* ═══════════ PERFORMANCE TRACKER TAB ═══════════ */}
        {tab === "performance" && (() => {
          let perfStudentList = students.filter(x => x.status === "active");
          if (perfClassFilter !== "all") perfStudentList = filterByBatch(perfStudentList, perfClassFilter);
          if (perfSearch.trim()) { const q = perfSearch.toLowerCase(); perfStudentList = perfStudentList.filter(x => x.studentName?.toLowerCase().includes(q)); }

          // AI Quiz stats helper
          const getQuizStats = (quizArr) => {
            if (!quizArr || quizArr.length === 0) return { total: 0, correct: 0, wrong: 0, accuracy: 0, subjects: {}, recentTopics: [] };
            let correct = 0, wrong = 0;
            const subjects = {};
            quizArr.forEach(q => {
              if (q.isCorrect) correct++; else wrong++;
              const sub = q.subject || "General";
              if (!subjects[sub]) subjects[sub] = { total: 0, correct: 0 };
              subjects[sub].total++;
              if (q.isCorrect) subjects[sub].correct++;
            });
            return { total: quizArr.length, correct, wrong, accuracy: Math.round((correct / quizArr.length) * 100), subjects, recentTopics: quizArr.slice(0, 5) };
          };

          // AI Doubt stats helper
          const getDoubtStats = (doubtArr) => {
            if (!doubtArr || doubtArr.length === 0) return { total: 0, subjects: {}, recentDoubts: [] };
            const subjects = {};
            doubtArr.forEach(d => {
              const sub = d.subject || "General";
              if (!subjects[sub]) subjects[sub] = 0;
              subjects[sub]++;
            });
            return { total: doubtArr.length, subjects, recentDoubts: doubtArr.slice(0, 10) };
          };

          return (
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, flexWrap: "wrap", gap: 10 }}>
                <div>
                  <h2 style={{ fontSize: "1.3rem", fontWeight: 800 }}><i className="fas fa-chart-line" style={{ marginRight: 8, color: "#7C3AED" }} />Student Performance Tracker</h2>
                  <p style={{ fontSize: ".78rem", color: "#6B7F99" }}>Marks graph · Exam history · AI Quiz tracking · Doubt analysis</p>
                </div>
              </div>

              {/* Class Filter */}
              <div style={{ display: "flex", gap: 6, marginBottom: 16, flexWrap: "wrap", alignItems: "center" }}>
                <button onClick={() => setPerfClassFilter("all")} style={{ padding: "6px 14px", borderRadius: 8, border: perfClassFilter === "all" ? "2px solid #7C3AED" : "1px solid #D4DEF0", background: perfClassFilter === "all" ? "#FAF5FF" : "#fff", color: "#7C3AED", fontSize: ".74rem", fontWeight: 700, cursor: "pointer" }}>All</button>
                {CLASS_CATEGORIES.map(c => (
                  <button key={c.id} onClick={() => setPerfClassFilter(c.id)} style={{ padding: "6px 10px", borderRadius: 8, border: perfClassFilter === c.id ? "2px solid " + c.color : "1px solid #D4DEF0", background: perfClassFilter === c.id ? "#FAF5FF" : "#fff", color: c.color, fontSize: ".68rem", fontWeight: 600, cursor: "pointer" }}>{c.shortLabel}</button>
                ))}
              </div>

              <input style={{ ...s.input, marginBottom: 16 }} placeholder="Search student name..." value={perfSearch} onChange={e => setPerfSearch(e.target.value)} />

              {/* Student List */}
              {!perfStudent ? (
                <div>
                  {perfStudentList.length === 0 ? (
                    <div style={{ ...s.card, textAlign: "center", padding: 40 }}>
                      <i className="fas fa-chart-line" style={{ fontSize: "2.5rem", color: "#B0C4DC", marginBottom: 12 }} />
                      <h3 style={{ fontSize: "1rem", fontWeight: 700, color: "#4A5E78" }}>No Students Found</h3>
                    </div>
                  ) : (
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 12 }}>
                      {perfStudentList.map(st => (
                        <div key={st.id} onClick={() => loadStudentPerformance(st)} style={{ ...s.card, cursor: "pointer", display: "flex", alignItems: "center", gap: 12, transition: "all .2s", border: "1px solid #D4DEF0" }}>
                          <div style={{ width: 44, height: 44, borderRadius: 10, overflow: "hidden", flexShrink: 0, background: "linear-gradient(135deg,#7C3AED,#A78BFA)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                            {st.photo && st.photo.startsWith("http") ? <img src={st.photo} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : <span style={{ color: "#fff", fontWeight: 700, fontSize: "1rem" }}>{st.studentName?.charAt(0)}</span>}
                          </div>
                          <div style={{ flex: 1 }}>
                            <div style={{ fontWeight: 700, fontSize: ".88rem", color: "#0B1826" }}>{st.studentName}</div>
                            <div style={{ fontSize: ".72rem", color: "#6B7F99" }}>Class {st.class} · {st.board || ""} · {st.medium || ""}</div>
                          </div>
                          <i className="fas fa-chevron-right" style={{ color: "#B0C4DC" }} />
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <div>
                  {/* Back + Student Info */}
                  <div style={{ ...s.card, display: "flex", alignItems: "center", gap: 14, marginBottom: 16 }}>
                    <button onClick={() => { setPerfStudent(null); setPerfExamData([]); setPerfQuizData([]); setPerfDoubtData([]); setPerfTab("overview"); }} style={{ ...s.btnGray, flexShrink: 0 }}><i className="fas fa-arrow-left" style={{ marginRight: 6 }} />Back</button>
                    <div style={{ width: 50, height: 50, borderRadius: 12, overflow: "hidden", flexShrink: 0, background: "linear-gradient(135deg,#7C3AED,#A78BFA)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                      {perfStudent.photo && perfStudent.photo.startsWith("http") ? <img src={perfStudent.photo} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : <span style={{ color: "#fff", fontWeight: 700, fontSize: "1.1rem" }}>{perfStudent.studentName?.charAt(0)}</span>}
                    </div>
                    <div>
                      <div style={{ fontWeight: 800, fontSize: "1.05rem" }}>{perfStudent.studentName}</div>
                      <div style={{ fontSize: ".78rem", color: "#6B7F99" }}>Class {perfStudent.class} · {perfStudent.board || ""} · {perfStudent.medium || ""} · RFID: {perfStudent.rfidCode || "N/A"}</div>
                    </div>
                  </div>

                  {perfLoading ? (
                    <div style={{ textAlign: "center", padding: 40, color: "#6B7F99" }}><i className="fas fa-spinner fa-spin" style={{ fontSize: "1.5rem", marginBottom: 8 }} /><p>Loading performance data...</p></div>
                  ) : (
                    <div>
                      {/* Sub-Tab Navigation */}
                      <div style={{ display: "flex", gap: 4, marginBottom: 20, background: "#E8EFF8", borderRadius: 10, padding: 4 }}>
                        {[
                          { id: "overview", icon: "fa-th-large", label: "Overview" },
                          { id: "exams", icon: "fa-file-alt", label: "Exam Results" },
                          { id: "online_tests", icon: "fa-laptop", label: "Online Tests" },
                          { id: "quizzes", icon: "fa-robot", label: "AI Quiz (" + perfQuizData.length + ")" },
                          { id: "doubts", icon: "fa-question-circle", label: "AI Doubts (" + perfDoubtData.length + ")" },
                        ].map(v => (
                          <button key={v.id} onClick={() => setPerfTab(v.id)} style={{ flex: 1, padding: "10px 12px", borderRadius: 8, border: "none", background: perfTab === v.id ? "#fff" : "transparent", color: perfTab === v.id ? "#7C3AED" : "#6B7F99", fontSize: ".76rem", fontWeight: 700, cursor: "pointer", boxShadow: perfTab === v.id ? "0 2px 8px rgba(0,0,0,.08)" : "none", display: "flex", alignItems: "center", justifyContent: "center", gap: 5 }}>
                            <i className={"fas " + v.icon} style={{ fontSize: ".7rem" }} />{v.label}
                          </button>
                        ))}
                      </div>

                      {/* ═══ OVERVIEW TAB ═══ */}
                      {perfTab === "overview" && (
                        <div>
                          {/* Summary Stats Cards */}
                          {(() => {
                            const totalExams = perfExamData.length;
                            const avgPct = totalExams > 0 ? Math.round(perfExamData.reduce((sum, d) => {
                              const exam = examList.find(e => e.id === d.examId);
                              const subs = exam?.subjects || [];
                              const maxT = subs.length * (exam?.totalMarksPerSubject || 100);
                              return sum + (maxT > 0 ? (d.totalMarks / maxT) * 100 : 0);
                            }, 0) / totalExams) : 0;
                            const qStats = getQuizStats(perfQuizData);
                            const dStats = getDoubtStats(perfDoubtData);
                            return (
                              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))", gap: 10, marginBottom: 20 }}>
                                <div style={s.stat}><div style={{ fontSize: "1.4rem", fontWeight: 800, color: "#1349A8" }}>{totalExams}</div><div style={{ fontSize: ".72rem", color: "#6B7F99" }}>Total Exams</div></div>
                                <div style={s.stat}><div style={{ fontSize: "1.4rem", fontWeight: 800, color: avgPct >= 75 ? "#16A34A" : avgPct >= 50 ? "#D98D04" : "#DC2626" }}>{avgPct}%</div><div style={{ fontSize: ".72rem", color: "#6B7F99" }}>Avg Exam Score</div></div>
                                <div style={s.stat}><div style={{ fontSize: "1.4rem", fontWeight: 800, color: "#0891B2" }}>{qStats.total}</div><div style={{ fontSize: ".72rem", color: "#6B7F99" }}>AI Quizzes Done</div></div>
                                <div style={s.stat}><div style={{ fontSize: "1.4rem", fontWeight: 800, color: qStats.accuracy >= 70 ? "#16A34A" : qStats.accuracy >= 40 ? "#D98D04" : "#DC2626" }}>{qStats.accuracy}%</div><div style={{ fontSize: ".72rem", color: "#6B7F99" }}>Quiz Accuracy</div></div>
                                <div style={s.stat}><div style={{ fontSize: "1.4rem", fontWeight: 800, color: "#7C3AED" }}>{dStats.total}</div><div style={{ fontSize: ".72rem", color: "#6B7F99" }}>Doubts Asked</div></div>
                                <div style={s.stat}><div style={{ fontSize: "1.4rem", fontWeight: 800, color: "#059669" }}>{Object.keys(dStats.subjects).length}</div><div style={{ fontSize: ".72rem", color: "#6B7F99" }}>Subjects Covered</div></div>
                              </div>
                            );
                          })()}

                          {/* Performance Graph */}
                          {perfExamData.length > 0 && (
                            <div style={{ ...s.card, marginBottom: 16 }}>
                              <h3 style={{ fontSize: ".95rem", fontWeight: 700, marginBottom: 14 }}><i className="fas fa-chart-bar" style={{ marginRight: 8, color: "#7C3AED" }} />Exam Performance Trend</h3>
                              <div style={{ display: "flex", alignItems: "flex-end", gap: 8, height: 180, padding: "0 10px", borderBottom: "2px solid #E8EFF8" }}>
                                {perfExamData.slice(0, 12).reverse().map((d, i) => {
                                  const exam = examList.find(e => e.id === d.examId);
                                  const subs = exam?.subjects || [];
                                  const maxT = subs.length * (exam?.totalMarksPerSubject || 100);
                                  const pct = maxT > 0 ? Math.round((d.totalMarks / maxT) * 100) : 0;
                                  const barColor = pct >= 75 ? "#16A34A" : pct >= 50 ? "#D98D04" : "#DC2626";
                                  return (
                                    <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
                                      <div style={{ fontSize: ".62rem", fontWeight: 700, color: barColor }}>{pct}%</div>
                                      <div style={{ width: "100%", maxWidth: 40, height: Math.max(pct * 1.5, 8) + "px", background: "linear-gradient(180deg, " + barColor + ", " + barColor + "88)", borderRadius: "6px 6px 0 0", transition: "height .3s" }} title={(d.examTitle || "") + ": " + pct + "%"} />
                                      <div style={{ fontSize: ".5rem", color: "#6B7F99", textAlign: "center", lineHeight: 1.2, maxWidth: 50, overflow: "hidden" }}>{(d.examTitle || "").slice(0, 8)}</div>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          )}

                          {/* AI Quiz Accuracy by Subject (Visual Bars) */}
                          {perfQuizData.length > 0 && (() => {
                            const qStats = getQuizStats(perfQuizData);
                            const subEntries = Object.entries(qStats.subjects).sort((a, b) => b[1].total - a[1].total);
                            return (
                              <div style={{ ...s.card, marginBottom: 16 }}>
                                <h3 style={{ fontSize: ".95rem", fontWeight: 700, marginBottom: 14 }}><i className="fas fa-robot" style={{ marginRight: 8, color: "#0891B2" }} />AI Quiz — Subject-wise Accuracy</h3>
                                {subEntries.map(([sub, data]) => {
                                  const acc = Math.round((data.correct / data.total) * 100);
                                  const barColor = acc >= 70 ? "#16A34A" : acc >= 40 ? "#D98D04" : "#DC2626";
                                  return (
                                    <div key={sub} style={{ marginBottom: 12 }}>
                                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                                        <span style={{ fontSize: ".78rem", fontWeight: 600 }}>{sub}</span>
                                        <span style={{ fontSize: ".72rem", color: barColor, fontWeight: 700 }}>{data.correct}/{data.total} correct ({acc}%)</span>
                                      </div>
                                      <div style={{ width: "100%", height: 10, background: "#E8EFF8", borderRadius: 99, overflow: "hidden" }}>
                                        <div style={{ width: acc + "%", height: "100%", background: "linear-gradient(90deg, " + barColor + ", " + barColor + "CC)", borderRadius: 99, transition: "width .5s" }} />
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            );
                          })()}

                          {/* Recent AI Doubts Summary */}
                          {perfDoubtData.length > 0 && (() => {
                            const dStats = getDoubtStats(perfDoubtData);
                            const subEntries = Object.entries(dStats.subjects).sort((a, b) => b[1] - a[1]);
                            return (
                              <div style={{ ...s.card, marginBottom: 16 }}>
                                <h3 style={{ fontSize: ".95rem", fontWeight: 700, marginBottom: 14 }}><i className="fas fa-question-circle" style={{ marginRight: 8, color: "#7C3AED" }} />Doubt Analysis — Subjects</h3>
                                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                                  {subEntries.map(([sub, count]) => (
                                    <div key={sub} style={{ padding: "8px 16px", borderRadius: 10, background: "#FAF5FF", border: "1px solid #E9D5FF", display: "flex", alignItems: "center", gap: 8 }}>
                                      <span style={{ fontSize: "1.1rem", fontWeight: 800, color: "#7C3AED" }}>{count}</span>
                                      <span style={{ fontSize: ".78rem", fontWeight: 600, color: "#4A5E78" }}>{sub}</span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            );
                          })()}
                        </div>
                      )}

                      {/* ═══ EXAM RESULTS TAB ═══ */}
                      {perfTab === "exams" && (
                        <div style={{ ...s.card }}>
                          <h3 style={{ fontSize: ".95rem", fontWeight: 700, marginBottom: 14 }}><i className="fas fa-list-ol" style={{ marginRight: 8, color: "#1349A8" }} />Exam-wise Results</h3>
                          {perfExamData.length === 0 ? (
                            <div style={{ textAlign: "center", padding: 30, color: "#6B7F99" }}>No exam results found yet.</div>
                          ) : (
                            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: ".78rem" }}>
                              <thead><tr style={{ background: "#F0F4FA" }}>
                                <th style={{ padding: "8px 10px", textAlign: "left", fontWeight: 700, borderBottom: "2px solid #D4DEF0" }}>#</th>
                                <th style={{ padding: "8px 10px", textAlign: "left", fontWeight: 700, borderBottom: "2px solid #D4DEF0" }}>Exam</th>
                                <th style={{ padding: "8px 8px", textAlign: "center", fontWeight: 700, borderBottom: "2px solid #D4DEF0" }}>Type</th>
                                <th style={{ padding: "8px 8px", textAlign: "center", fontWeight: 700, borderBottom: "2px solid #D4DEF0" }}>Date</th>
                                <th style={{ padding: "8px 8px", textAlign: "center", fontWeight: 700, borderBottom: "2px solid #D4DEF0" }}>Marks</th>
                                <th style={{ padding: "8px 8px", textAlign: "center", fontWeight: 700, borderBottom: "2px solid #D4DEF0" }}>%</th>
                                <th style={{ padding: "8px 8px", textAlign: "left", fontWeight: 700, borderBottom: "2px solid #D4DEF0" }}>Subject-wise</th>
                              </tr></thead>
                              <tbody>
                                {perfExamData.map((d, idx) => {
                                  const exam = examList.find(e => e.id === d.examId);
                                  const subs = exam?.subjects || [];
                                  const maxT = subs.length * (exam?.totalMarksPerSubject || 100);
                                  const pct = maxT > 0 ? Math.round((d.totalMarks / maxT) * 100) : 0;
                                  const tLabels = { weekly: "Weekly", monthly: "Monthly", halfyearly: "Half-Yearly", annual: "Annual", mock: "Mock", practice: "Practice" };
                                  return (
                                    <tr key={d.id} style={{ borderBottom: "1px solid #E8EFF8", background: idx % 2 === 0 ? "#fff" : "#FAFCFE" }}>
                                      <td style={{ padding: "8px 10px", color: "#6B7F99", fontWeight: 600 }}>{idx + 1}</td>
                                      <td style={{ padding: "8px 10px", fontWeight: 600 }}>{d.examTitle || exam?.title || "—"}</td>
                                      <td style={{ padding: "8px 8px", textAlign: "center" }}><span style={s.badge("#7C3AED", "#FAF5FF")}>{tLabels[exam?.examType] || "—"}</span></td>
                                      <td style={{ padding: "8px 8px", textAlign: "center", fontSize: ".72rem" }}>{exam?.examDate || "—"}</td>
                                      <td style={{ padding: "8px 8px", textAlign: "center", fontWeight: 800, color: "#1349A8" }}>{d.totalMarks}/{maxT}</td>
                                      <td style={{ padding: "8px 8px", textAlign: "center", fontWeight: 800, color: pct >= 75 ? "#16A34A" : pct >= 50 ? "#D98D04" : "#DC2626" }}>{pct}%</td>
                                      <td style={{ padding: "8px 8px", fontSize: ".68rem" }}>{d.marks ? Object.entries(d.marks).map(([sub, m]) => sub + ": " + m).join(" · ") : "—"}</td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          )}
                        </div>
                      )}

                      {/* ═══ AI QUIZZES TAB ═══ */}
                      {perfTab === "quizzes" && (() => {
                        const qStats = getQuizStats(perfQuizData);
                        return (
                          <div>
                            {/* Quiz Stats */}
                            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(130px, 1fr))", gap: 10, marginBottom: 16 }}>
                              <div style={s.stat}><div style={{ fontSize: "1.4rem", fontWeight: 800, color: "#0891B2" }}>{qStats.total}</div><div style={{ fontSize: ".72rem", color: "#6B7F99" }}>Total Questions</div></div>
                              <div style={s.stat}><div style={{ fontSize: "1.4rem", fontWeight: 800, color: "#16A34A" }}>{qStats.correct}</div><div style={{ fontSize: ".72rem", color: "#6B7F99" }}>Correct</div></div>
                              <div style={s.stat}><div style={{ fontSize: "1.4rem", fontWeight: 800, color: "#DC2626" }}>{qStats.wrong}</div><div style={{ fontSize: ".72rem", color: "#6B7F99" }}>Wrong</div></div>
                              <div style={s.stat}><div style={{ fontSize: "1.4rem", fontWeight: 800, color: qStats.accuracy >= 70 ? "#16A34A" : "#D98D04" }}>{qStats.accuracy}%</div><div style={{ fontSize: ".72rem", color: "#6B7F99" }}>Accuracy</div></div>
                            </div>

                            {/* Quiz Accuracy Visual Meter */}
                            {qStats.total > 0 && (
                              <div style={{ ...s.card, marginBottom: 16 }}>
                                <h3 style={{ fontSize: ".95rem", fontWeight: 700, marginBottom: 14 }}><i className="fas fa-bullseye" style={{ marginRight: 8, color: "#0891B2" }} />Accuracy Meter</h3>
                                <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                                  <div style={{ position: "relative", width: 100, height: 100 }}>
                                    <svg viewBox="0 0 36 36" style={{ width: 100, height: 100, transform: "rotate(-90deg)" }}>
                                      <circle cx="18" cy="18" r="15.915" fill="none" stroke="#E8EFF8" strokeWidth="3" />
                                      <circle cx="18" cy="18" r="15.915" fill="none" stroke={qStats.accuracy >= 70 ? "#16A34A" : qStats.accuracy >= 40 ? "#D98D04" : "#DC2626"} strokeWidth="3" strokeDasharray={qStats.accuracy + " " + (100 - qStats.accuracy)} strokeLinecap="round" />
                                    </svg>
                                    <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1.2rem", fontWeight: 800, color: "#0B1826" }}>{qStats.accuracy}%</div>
                                  </div>
                                  <div style={{ flex: 1 }}>
                                    <div style={{ marginBottom: 6, fontSize: ".82rem" }}><span style={{ color: "#16A34A", fontWeight: 700 }}>{qStats.correct}</span> correct out of <span style={{ fontWeight: 700 }}>{qStats.total}</span></div>
                                    <div style={{ fontSize: ".78rem", color: "#6B7F99" }}>
                                      {qStats.accuracy >= 80 ? "Excellent! Student is performing very well in AI quizzes." :
                                       qStats.accuracy >= 60 ? "Good progress. Some areas need improvement." :
                                       qStats.accuracy >= 40 ? "Average. Needs more practice and focus." :
                                       "Needs attention. Student struggling with quiz questions."}
                                    </div>
                                  </div>
                                </div>
                              </div>
                            )}

                            {/* Subject-wise Breakdown */}
                            {Object.keys(qStats.subjects).length > 0 && (
                              <div style={{ ...s.card, marginBottom: 16 }}>
                                <h3 style={{ fontSize: ".95rem", fontWeight: 700, marginBottom: 14 }}><i className="fas fa-book" style={{ marginRight: 8, color: "#7C3AED" }} />Subject-wise Quiz Performance</h3>
                                {Object.entries(qStats.subjects).sort((a, b) => b[1].total - a[1].total).map(([sub, data]) => {
                                  const acc = Math.round((data.correct / data.total) * 100);
                                  const barColor = acc >= 70 ? "#16A34A" : acc >= 40 ? "#D98D04" : "#DC2626";
                                  return (
                                    <div key={sub} style={{ marginBottom: 14 }}>
                                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                                        <span style={{ fontSize: ".82rem", fontWeight: 600 }}>{sub}</span>
                                        <span style={{ fontSize: ".74rem", color: barColor, fontWeight: 700 }}>{data.correct}/{data.total} ({acc}%)</span>
                                      </div>
                                      <div style={{ width: "100%", height: 12, background: "#E8EFF8", borderRadius: 99, overflow: "hidden" }}>
                                        <div style={{ width: acc + "%", height: "100%", background: "linear-gradient(90deg, " + barColor + ", " + barColor + "CC)", borderRadius: 99, transition: "width .5s" }} />
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            )}

                            {/* Recent Quiz Questions */}
                            <div style={{ ...s.card }}>
                              <h3 style={{ fontSize: ".95rem", fontWeight: 700, marginBottom: 14 }}><i className="fas fa-history" style={{ marginRight: 8, color: "#1349A8" }} />Recent Quiz Questions</h3>
                              {perfQuizData.length === 0 ? (
                                <div style={{ textAlign: "center", padding: 30, color: "#6B7F99" }}>No AI quiz data yet. Student hasn't used AI Quiz feature.</div>
                              ) : perfQuizData.slice(0, 20).map((q, idx) => (
                                <div key={q.id} style={{ padding: "12px 14px", borderBottom: "1px solid #E8EFF8", display: "flex", gap: 12, alignItems: "flex-start" }}>
                                  <div style={{ width: 28, height: 28, borderRadius: 8, background: q.isCorrect ? "#F0FDF4" : "#FEF2F2", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                                    <i className={"fas " + (q.isCorrect ? "fa-check" : "fa-times")} style={{ fontSize: ".72rem", color: q.isCorrect ? "#16A34A" : "#DC2626" }} />
                                  </div>
                                  <div style={{ flex: 1 }}>
                                    <div style={{ fontSize: ".82rem", fontWeight: 600, marginBottom: 3 }}>{q.question || "Quiz Question"}</div>
                                    <div style={{ fontSize: ".72rem", color: "#6B7F99", display: "flex", gap: 10, flexWrap: "wrap" }}>
                                      <span style={s.badge("#0891B2", "#ECFEFF")}>{q.subject || "General"}</span>
                                      {q.userAnswer && <span>Answer: <strong style={{ color: q.isCorrect ? "#16A34A" : "#DC2626" }}>{q.userAnswer}</strong></span>}
                                      {q.correctAnswer && !q.isCorrect && <span>Correct: <strong style={{ color: "#16A34A" }}>{q.correctAnswer}</strong></span>}
                                      {q.createdAt?.toDate && <span>{q.createdAt.toDate().toLocaleDateString("en-IN")}</span>}
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        );
                      })()}

                      {/* ═══ AI DOUBTS TAB ═══ */}
                      {/* ═══ ONLINE TESTS TAB ═══ */}
                      {perfTab === "online_tests" && (() => {
                        // Is student ke test submissions fetch karo
                        const studentSubs = otResults.filter(r => r.studentId === perfStudent?.id || r.studentName === perfStudent?.studentName);
                        const totalTests = studentSubs.length;
                        const avgPct = totalTests > 0 ? Math.round(studentSubs.reduce((s, r) => s + (r.percentage || 0), 0) / totalTests) : 0;
                        const passed = studentSubs.filter(r => (r.percentage || 0) >= 40).length;
                        return (
                          <div>
                            {/* Stats */}
                            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(130px, 1fr))", gap: 10, marginBottom: 16 }}>
                              <div style={s.stat}><div style={{ fontSize: "1.4rem", fontWeight: 800, color: "#7C3AED" }}>{totalTests}</div><div style={{ fontSize: ".72rem", color: "#6B7F99" }}>Tests Given</div></div>
                              <div style={s.stat}><div style={{ fontSize: "1.4rem", fontWeight: 800, color: "#1349A8" }}>{avgPct}%</div><div style={{ fontSize: ".72rem", color: "#6B7F99" }}>Avg Score</div></div>
                              <div style={s.stat}><div style={{ fontSize: "1.4rem", fontWeight: 800, color: "#16A34A" }}>{passed}</div><div style={{ fontSize: ".72rem", color: "#6B7F99" }}>Passed</div></div>
                              <div style={s.stat}><div style={{ fontSize: "1.4rem", fontWeight: 800, color: "#DC2626" }}>{totalTests - passed}</div><div style={{ fontSize: ".72rem", color: "#6B7F99" }}>Failed</div></div>
                            </div>

                            {totalTests === 0 ? (
                              <div style={{ ...s.card, textAlign: "center", padding: 40 }}>
                                <i className="fas fa-laptop" style={{ fontSize: "2rem", color: "#B0C4DC", marginBottom: 10 }} />
                                <p style={{ color: "#6B7F99", marginBottom: 4 }}>Student ne abhi koi online test nahi diya।</p>
                                <p style={{ fontSize: ".78rem", color: "#B0C4DC" }}>Jab student test dega, yahan results dikhenge।</p>
                              </div>
                            ) : (
                              <div style={{ ...s.card, padding: 0, overflow: "hidden" }}>
                                <div style={{ padding: "12px 16px", borderBottom: "2px solid #E2EAF4", background: "#F8FAFD" }}>
                                  <h3 style={{ fontSize: ".92rem", fontWeight: 700, margin: 0 }}>
                                    <i className="fas fa-history" style={{ marginRight: 8, color: "#7C3AED" }} />Test History
                                  </h3>
                                </div>
                                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: ".82rem" }}>
                                  <thead>
                                    <tr style={{ background: "#F0F4FA" }}>
                                      <th style={{ padding: "10px 14px", textAlign: "left", fontWeight: 700, borderBottom: "2px solid #D4DEF0" }}>#</th>
                                      <th style={{ padding: "10px 14px", textAlign: "left", fontWeight: 700, borderBottom: "2px solid #D4DEF0" }}>Test</th>
                                      <th style={{ padding: "10px 14px", textAlign: "center", fontWeight: 700, borderBottom: "2px solid #D4DEF0", color: "#16A34A" }}>Score</th>
                                      <th style={{ padding: "10px 14px", textAlign: "center", fontWeight: 700, borderBottom: "2px solid #D4DEF0", color: "#1349A8" }}>%</th>
                                      <th style={{ padding: "10px 14px", textAlign: "center", fontWeight: 700, borderBottom: "2px solid #D4DEF0" }}>Grade</th>
                                      <th style={{ padding: "10px 14px", textAlign: "center", fontWeight: 700, borderBottom: "2px solid #D4DEF0" }}>Status</th>
                                      <th style={{ padding: "10px 14px", textAlign: "center", fontWeight: 700, borderBottom: "2px solid #D4DEF0" }}>Date</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {studentSubs.sort((a, b) => (b.submittedAt?.toDate?.() || 0) - (a.submittedAt?.toDate?.() || 0)).map((r, idx) => {
                                      const pct = r.percentage || Math.round(((r.correct || 0) / (r.totalQuestions || 1)) * 100);
                                      const grade = pct >= 90 ? "A+" : pct >= 75 ? "A" : pct >= 60 ? "B" : pct >= 40 ? "C" : "D";
                                      const gc = pct >= 75 ? "#16A34A" : pct >= 50 ? "#D98D04" : "#DC2626";
                                      const isPassed = pct >= 40;
                                      // Test title dhundho
                                      const testTitle = otList.find(t => t.id === r.testId)?.title || r.testTitle || "Unknown Test";
                                      const testSubject = otList.find(t => t.id === r.testId)?.subject || r.subject || "";
                                      const submDate = r.submittedAt?.toDate ? r.submittedAt.toDate().toLocaleDateString("en-IN") : "—";
                                      return (
                                        <tr key={r.id} style={{ borderBottom: "1px solid #E8EFF8", background: idx % 2 === 0 ? "#fff" : "#FAFCFE" }}>
                                          <td style={{ padding: "10px 14px", color: "#6B7F99", fontWeight: 600 }}>{idx + 1}</td>
                                          <td style={{ padding: "10px 14px" }}>
                                            <div style={{ fontWeight: 600, fontSize: ".85rem" }}>{testTitle}</div>
                                            {testSubject && <div style={{ fontSize: ".7rem", color: "#6B7F99" }}>{testSubject}</div>}
                                          </td>
                                          <td style={{ padding: "10px 14px", textAlign: "center", fontWeight: 700, color: "#16A34A" }}>{r.correct || 0}/{r.totalQuestions || "—"}</td>
                                          <td style={{ padding: "10px 14px", textAlign: "center", fontWeight: 800, color: gc, fontSize: ".92rem" }}>{pct}%</td>
                                          <td style={{ padding: "10px 14px", textAlign: "center", fontWeight: 900, fontSize: "1rem", color: gc }}>{grade}</td>
                                          <td style={{ padding: "10px 14px", textAlign: "center" }}>
                                            <span style={s.badge(isPassed ? "#16A34A" : "#DC2626", isPassed ? "#F0FDF4" : "#FEF2F2")}>{isPassed ? "Pass" : "Fail"}</span>
                                          </td>
                                          <td style={{ padding: "10px 14px", textAlign: "center", fontSize: ".75rem", color: "#6B7F99" }}>{submDate}</td>
                                        </tr>
                                      );
                                    })}
                                  </tbody>
                                </table>
                              </div>
                            )}
                          </div>
                        );
                      })()}

                      {perfTab === "doubts" && (() => {
                        const dStats = getDoubtStats(perfDoubtData);
                        return (
                          <div>
                            {/* Doubt Stats */}
                            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))", gap: 10, marginBottom: 16 }}>
                              <div style={s.stat}><div style={{ fontSize: "1.4rem", fontWeight: 800, color: "#7C3AED" }}>{dStats.total}</div><div style={{ fontSize: ".72rem", color: "#6B7F99" }}>Total Doubts</div></div>
                              <div style={s.stat}><div style={{ fontSize: "1.4rem", fontWeight: 800, color: "#059669" }}>{Object.keys(dStats.subjects).length}</div><div style={{ fontSize: ".72rem", color: "#6B7F99" }}>Subjects</div></div>
                              <div style={s.stat}><div style={{ fontSize: "1.4rem", fontWeight: 800, color: "#1349A8" }}>{perfDoubtData.filter(d => d.hasImage).length}</div><div style={{ fontSize: ".72rem", color: "#6B7F99" }}>With Images</div></div>
                            </div>

                            {/* Doubt Subject Distribution */}
                            {Object.keys(dStats.subjects).length > 0 && (
                              <div style={{ ...s.card, marginBottom: 16 }}>
                                <h3 style={{ fontSize: ".95rem", fontWeight: 700, marginBottom: 14 }}><i className="fas fa-chart-pie" style={{ marginRight: 8, color: "#7C3AED" }} />Doubt Distribution by Subject</h3>
                                <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                                  {Object.entries(dStats.subjects).sort((a, b) => b[1] - a[1]).map(([sub, count]) => {
                                    const pct = Math.round((count / dStats.total) * 100);
                                    const colors = ["#7C3AED", "#1349A8", "#059669", "#D98D04", "#DC2626", "#0891B2", "#BE185D"];
                                    const ci = Object.keys(dStats.subjects).indexOf(sub) % colors.length;
                                    return (
                                      <div key={sub} style={{ flex: "1 1 200px", padding: 14, borderRadius: 12, border: "1px solid #E8EFF8", background: "#FAFCFE" }}>
                                        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                                          <span style={{ fontSize: ".82rem", fontWeight: 700, color: colors[ci] }}>{sub}</span>
                                          <span style={{ fontSize: ".74rem", fontWeight: 700, color: "#4A5E78" }}>{count} ({pct}%)</span>
                                        </div>
                                        <div style={{ width: "100%", height: 8, background: "#E8EFF8", borderRadius: 99, overflow: "hidden" }}>
                                          <div style={{ width: pct + "%", height: "100%", background: colors[ci], borderRadius: 99 }} />
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            )}

                            {/* Recent Doubts List */}
                            <div style={{ ...s.card }}>
                              <h3 style={{ fontSize: ".95rem", fontWeight: 700, marginBottom: 14 }}><i className="fas fa-history" style={{ marginRight: 8, color: "#7C3AED" }} />Recent Doubts Asked</h3>
                              {perfDoubtData.length === 0 ? (
                                <div style={{ textAlign: "center", padding: 30, color: "#6B7F99" }}>No doubt history yet. Student hasn't used AI Doubt Solver.</div>
                              ) : perfDoubtData.slice(0, 25).map((d, idx) => (
                                <div key={d.id} style={{ padding: "12px 16px", borderBottom: "1px solid #E8EFF8", display: "flex", gap: 12, alignItems: "center" }}>
                                  <div style={{ width: 28, height: 28, borderRadius: 8, background: "#FAF5FF", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, fontSize: ".72rem", fontWeight: 700, color: "#7C3AED" }}>{idx + 1}</div>
                                  <div style={{ flex: 1 }}>
                                    <div style={{ fontSize: ".84rem", fontWeight: 600, color: "#0B1826" }}>{d.messages?.[0]?.content || d.question || "No question"}</div>
                                    <div style={{ fontSize: ".7rem", color: "#6B7F99", display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", marginTop: 4 }}>
                                      <span style={s.badge("#7C3AED", "#FAF5FF")}>{d.subject || "General"}</span>
                                      {d.language && <span style={s.badge("#0891B2", "#ECFEFF")}>{d.language}</span>}
                                      {d.hasImage && <span style={s.badge("#D98D04", "#FFFBEB")}><i className="fas fa-image" style={{ marginRight: 3 }} />Image</span>}
                                      {d.createdAt?.toDate && <span>{d.createdAt.toDate().toLocaleDateString("en-IN")} {d.createdAt.toDate().toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}</span>}
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        );
                      })()}
                    </div>
                  )}
                </div>
              )}

              {/* Tips */}
              <div style={{ marginTop: 16, background: "#FFFBEB", borderRadius: 12, padding: 16, border: "1px solid #FDE68A", fontSize: ".82rem", color: "#78350F", display: "flex", alignItems: "flex-start", gap: 10 }}>
                <i className="fas fa-lightbulb" style={{ marginTop: 2, flexShrink: 0, color: "#D98D04" }} />
                <div>
                  <strong>Performance Tracker Tips:</strong><br />
                  • Student pe click karo — Overview, Exam Results, AI Quiz aur Doubts sab dikhega<br />
                  • AI Quiz tab me dekho kitne questions sahi kiye — subject-wise accuracy bhi hai<br />
                  • AI Doubts tab me dekho student kya sawaal puchh raha hai — weak areas identify karo<br />
                  • Circular meter se quiz accuracy instantly samjho<br />
                  • Bar graphs se exam trend aur subject-wise quiz performance dekho
                </div>
              </div>
            </div>
          );
        })()}

        {/* ═══════════ ONLINE TESTS TAB ═══════════ */}
        {tab === "online_tests" && <>
          {/* Header */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, flexWrap: "wrap", gap: 10 }}>
            <div>
              <h2 style={{ fontSize: "1.3rem", fontWeight: 800 }}><i className="fas fa-laptop" style={{ marginRight: 8, color: "#7C3AED" }} />Online Test Management</h2>
              <p style={{ fontSize: ".78rem", color: "#6B7F99" }}>Create tests · Manual / AI / PDF questions · Students ghar baithe Student App me test denge</p>
            </div>
            <button onClick={() => { setShowOtForm(true); setOtEditId(null); setOtStep(1); setOtQuestions([]); setOtForm({ testType: "practice", duration: 30, isActive: true }); }} style={{ ...s.btnP, display: "flex", alignItems: "center", gap: 6 }}>
              <i className="fas fa-plus" /> Create Online Test
            </button>
          </div>

          {/* ── View Toggle: Tests | Results ── */}
          {!showOtForm && (
            <div style={{ display: "flex", gap: 4, background: "#F0F4FA", borderRadius: 10, padding: 4, marginBottom: 16, width: "fit-content" }}>
              <button onClick={() => setOtView("tests")} style={{ padding: "8px 20px", borderRadius: 8, border: "none", background: otView === "tests" ? "#fff" : "transparent", color: otView === "tests" ? "#7C3AED" : "#6B7F99", fontSize: ".82rem", fontWeight: 700, cursor: "pointer", boxShadow: otView === "tests" ? "0 2px 8px rgba(0,0,0,.08)" : "none", display: "flex", alignItems: "center", gap: 6 }}>
                <i className="fas fa-laptop" style={{ fontSize: ".75rem" }} />Tests
              </button>
              <button onClick={() => {
                setOtView("results");
                setOtSelectedTest(null);
                if (otResults.length === 0 && !otResultsLoading) {
                  setOtResultsLoading(true);
                  getDocs(collection(db, "test_submissions")).then(snap => {
                    const arr = snap.docs.map(d => ({ id: d.id, ...d.data() }));
                    arr.sort((a, b) => (b.submittedAt?.toDate?.() || 0) - (a.submittedAt?.toDate?.() || 0));
                    setOtResults(arr);
                    setOtResultsLoading(false);
                  }).catch(() => setOtResultsLoading(false));
                }
              }} style={{ padding: "8px 20px", borderRadius: 8, border: "none", background: otView === "results" ? "#fff" : "transparent", color: otView === "results" ? "#7C3AED" : "#6B7F99", fontSize: ".82rem", fontWeight: 700, cursor: "pointer", boxShadow: otView === "results" ? "0 2px 8px rgba(0,0,0,.08)" : "none", display: "flex", alignItems: "center", gap: 6 }}>
                <i className="fas fa-chart-bar" style={{ fontSize: ".75rem" }} />Results
                {otResults.length > 0 && <span style={{ background: "#7C3AED", color: "#fff", borderRadius: 99, padding: "1px 6px", fontSize: ".6rem", fontWeight: 700 }}>{otResults.length}</span>}
              </button>
            </div>
          )}

          {/* ═══ TEST CREATION FORM ═══ */}
          {showOtForm && <div style={{ ...s.card, border: "2px solid #7C3AED" }}>
            {/* Step Indicator */}
            <div style={{ display: "flex", gap: 8, marginBottom: 20, alignItems: "center" }}>
              <div onClick={() => setOtStep(1)} style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer", padding: "8px 16px", borderRadius: 8, background: otStep === 1 ? "#7C3AED" : "#F0F4FA", color: otStep === 1 ? "#fff" : "#6B7F99", fontWeight: 700, fontSize: ".82rem" }}>
                <span style={{ width: 22, height: 22, borderRadius: "50%", background: otStep === 1 ? "#fff" : "#D4DEF0", color: otStep === 1 ? "#7C3AED" : "#6B7F99", display: "flex", alignItems: "center", justifyContent: "center", fontSize: ".7rem", fontWeight: 800 }}>1</span>
                Test Info
              </div>
              <i className="fas fa-chevron-right" style={{ color: "#B0C4DC", fontSize: ".6rem" }} />
              <div onClick={() => { if (otForm.title && otForm.subject && otForm.forClass) setOtStep(2); else showMsg("Pehle Step 1 fill karo!"); }} style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer", padding: "8px 16px", borderRadius: 8, background: otStep === 2 ? "#7C3AED" : "#F0F4FA", color: otStep === 2 ? "#fff" : "#6B7F99", fontWeight: 700, fontSize: ".82rem" }}>
                <span style={{ width: 22, height: 22, borderRadius: "50%", background: otStep === 2 ? "#fff" : "#D4DEF0", color: otStep === 2 ? "#7C3AED" : "#6B7F99", display: "flex", alignItems: "center", justifyContent: "center", fontSize: ".7rem", fontWeight: 800 }}>2</span>
                Questions ({otQuestions.length})
              </div>
            </div>

            {/* ═══ STEP 1: Test Info ═══ */}
            {otStep === 1 && <>
              <h3 style={{ fontSize: "1rem", fontWeight: 700, marginBottom: 16, color: "#7C3AED" }}><i className="fas fa-info-circle" style={{ marginRight: 8 }} />Test Information</h3>
              <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr", gap: 12 }}>
                <div><label style={s.label}>Test Title *</label><input style={s.input} placeholder="e.g. Physics Weekly Test - Motion" value={otForm.title || ""} onChange={e => setOtForm({ ...otForm, title: e.target.value })} /></div>
                <div><label style={s.label}>Subject *</label>
                  <select style={s.input} value={otForm.subject || ""} onChange={e => setOtForm({ ...otForm, subject: e.target.value })}>
                    <option value="">Select Subject</option>
                    {["Physics", "Chemistry", "Maths", "Biology", "Science", "English", "Hindi", "Social Study", "Sanskrit", "Computer"].map(sub => <option key={sub} value={sub}>{sub}</option>)}
                  </select>
                </div>
                <div><label style={s.label}>Test Type</label>
                  <select style={s.input} value={otForm.testType || "practice"} onChange={e => setOtForm({ ...otForm, testType: e.target.value })}>
                    <option value="practice">Practice Test</option><option value="weekly">Weekly Test</option><option value="monthly">Monthly Test</option><option value="mock">Mock Test</option><option value="chapter">Chapter Test</option>
                  </select>
                </div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
                <div><label style={s.label}>For Class / Batch *</label>
                  <select style={s.input} value={otForm.forClass || ""} onChange={e => setOtForm({ ...otForm, forClass: e.target.value })}>
                    <option value="">Select Class</option><option value="all">All Classes</option>
                    {CLASS_CATEGORIES.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
                  </select>
                </div>
                <div><label style={s.label}>Board</label>
                  <select style={s.input} value={otForm.board || ""} onChange={e => setOtForm({ ...otForm, board: e.target.value })}>
                    <option value="">Select</option><option>CG Board</option><option>CBSE</option><option>ICSE</option>
                  </select>
                </div>
                <div><label style={s.label}>Medium</label>
                  <select style={s.input} value={otForm.medium || ""} onChange={e => setOtForm({ ...otForm, medium: e.target.value })}>
                    <option value="">Select</option><option>Hindi</option><option>English</option>
                  </select>
                </div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 12 }}>
                <div><label style={s.label}>Duration (minutes)</label><input style={s.input} type="number" placeholder="30" value={otForm.duration || ""} onChange={e => setOtForm({ ...otForm, duration: e.target.value })} /></div>
                <div><label style={s.label}>Chapter</label><input style={s.input} placeholder="e.g. Motion" value={otForm.chapter || ""} onChange={e => setOtForm({ ...otForm, chapter: e.target.value })} /></div>
                <div><label style={s.label}>Topic (optional)</label><input style={s.input} placeholder="e.g. Newton's Laws" value={otForm.topic || ""} onChange={e => setOtForm({ ...otForm, topic: e.target.value })} /></div>
                <div><label style={s.label}>Difficulty</label>
                  <select style={s.input} value={otForm.difficulty || "medium"} onChange={e => setOtForm({ ...otForm, difficulty: e.target.value })}>
                    <option value="easy">Easy</option><option value="medium">Medium</option><option value="hard">Hard</option><option value="mixed">Mixed</option>
                  </select>
                </div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div><label style={s.label}>Schedule Date (optional)</label><input style={s.input} type="date" value={otForm.scheduledDate || ""} onChange={e => setOtForm({ ...otForm, scheduledDate: e.target.value })} /></div>
                <div><label style={s.label}>Schedule Time (optional)</label><input style={s.input} type="time" value={otForm.scheduledTime || ""} onChange={e => setOtForm({ ...otForm, scheduledTime: e.target.value })} /></div>
              </div>
              <div><label style={s.label}>Instructions (optional)</label><textarea style={{ ...s.input, height: 60, resize: "none" }} placeholder="e.g. Sabhi questions attempt karo. Negative marking nahi hai." value={otForm.instructions || ""} onChange={e => setOtForm({ ...otForm, instructions: e.target.value })} /></div>
              <div style={{ display: "flex", gap: 10, marginTop: 8 }}>
                <button onClick={() => { if (!otForm.title || !otForm.subject || !otForm.forClass) { showMsg("Title, Subject aur Class required hai!"); return; } setOtStep(2); }} style={s.btnP}><i className="fas fa-arrow-right" style={{ marginRight: 6 }} />Next → Add Questions</button>
                <button onClick={() => { setShowOtForm(false); setOtForm({}); setOtQuestions([]); setOtStep(1); }} style={s.btnGray}>Cancel</button>
              </div>
            </>}

            {/* ═══ STEP 2: Questions ═══ */}
            {otStep === 2 && <>
              <h3 style={{ fontSize: "1rem", fontWeight: 700, marginBottom: 6, color: "#7C3AED" }}><i className="fas fa-question-circle" style={{ marginRight: 8 }} />Add Questions — {otForm.title}</h3>
              <p style={{ fontSize: ".76rem", color: "#6B7F99", marginBottom: 16 }}>{otForm.subject} · {CLASS_CATEGORIES.find(c => c.id === otForm.forClass)?.label || otForm.forClass} · {otQuestions.length} questions added</p>

              {/* Question Mode Selector */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginBottom: 20 }}>
                {[
                  { id: "manual", icon: "fa-pen", label: "Manual Entry", desc: "Khud question likho", color: "#1349A8" },
                  { id: "ai", icon: "fa-robot", label: "AI Generate", desc: "AI se auto-generate karo", color: "#7C3AED" },
                  { id: "pdf", icon: "fa-file-pdf", label: "PDF Upload", desc: "PDF se questions extract karo", color: "#DC2626" },
                ].map(m => (
                  <div key={m.id} onClick={() => setOtQuestionMode(m.id)} style={{ padding: 16, borderRadius: 12, border: otQuestionMode === m.id ? `2px solid ${m.color}` : "1px solid #D4DEF0", background: otQuestionMode === m.id ? `${m.color}08` : "#fff", cursor: "pointer", textAlign: "center", transition: "all .2s" }}>
                    <i className={`fas ${m.icon}`} style={{ fontSize: "1.3rem", color: m.color, marginBottom: 6 }} />
                    <div style={{ fontWeight: 700, fontSize: ".85rem", color: m.color }}>{m.label}</div>
                    <div style={{ fontSize: ".68rem", color: "#6B7F99" }}>{m.desc}</div>
                  </div>
                ))}
              </div>

              {/* ═══ MANUAL QUESTION ENTRY ═══ */}
              {otQuestionMode === "manual" && (
                <div style={{ background: "#EFF6FF", borderRadius: 12, padding: 16, border: "1px solid #BFDBFE", marginBottom: 16 }}>
                  <h4 style={{ fontSize: ".9rem", fontWeight: 700, color: "#1349A8", marginBottom: 12 }}><i className="fas fa-pen" style={{ marginRight: 6 }} />Manual Question Entry</h4>
                  {(() => {
                    const newQ = otQuestions.length > 0 && otQuestions[otQuestions.length - 1]._editing ? otQuestions[otQuestions.length - 1] : { question: "", options: ["", "", "", ""], correctAnswer: 0, explanation: "", _editing: true };
                    const updateNewQ = (field, val) => {
                      if (otQuestions.length > 0 && otQuestions[otQuestions.length - 1]._editing) {
                        const updated = [...otQuestions]; updated[updated.length - 1] = { ...updated[updated.length - 1], [field]: val }; setOtQuestions(updated);
                      } else { setOtQuestions([...otQuestions, { ...newQ, [field]: val }]); }
                    };
                    const updateOption = (idx, val) => {
                      const opts = [...(newQ.options || ["", "", "", ""])]; opts[idx] = val; updateNewQ("options", opts);
                    };
                    return <>
                      <div><label style={s.label}>Question *</label><textarea style={{ ...s.input, height: 60, resize: "none" }} placeholder="Question likho..." value={newQ.question} onChange={e => updateNewQ("question", e.target.value)} /></div>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                        {[0, 1, 2, 3].map(i => (
                          <div key={i} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                            <input type="radio" name="correctOpt" checked={newQ.correctAnswer === i} onChange={() => updateNewQ("correctAnswer", i)} style={{ accentColor: "#16A34A" }} />
                            <input style={{ ...s.input, marginBottom: 0, borderColor: newQ.correctAnswer === i ? "#16A34A" : "#C0D0E8" }} placeholder={`Option ${String.fromCharCode(65 + i)}`} value={(newQ.options || [])[i] || ""} onChange={e => updateOption(i, e.target.value)} />
                          </div>
                        ))}
                      </div>
                      <p style={{ fontSize: ".68rem", color: "#16A34A", marginTop: -4, marginBottom: 8 }}><i className="fas fa-check-circle" style={{ marginRight: 3 }} />Green radio button = sahi jawab select karo</p>
                      <div><label style={s.label}>Explanation (optional)</label><input style={s.input} placeholder="Ye answer sahi kyun hai..." value={newQ.explanation} onChange={e => updateNewQ("explanation", e.target.value)} /></div>
                      <button onClick={() => {
                        if (!newQ.question?.trim()) { showMsg("Question likho!"); return; }
                        if (!(newQ.options || []).some(o => o.trim())) { showMsg("Kam se kam 1 option bharo!"); return; }
                        const cleaned = { ...newQ }; delete cleaned._editing;
                        if (otQuestions.length > 0 && otQuestions[otQuestions.length - 1]._editing) {
                          const updated = [...otQuestions]; updated[updated.length - 1] = cleaned; setOtQuestions(updated);
                        } else { setOtQuestions([...otQuestions, cleaned]); }
                        showMsg(`Q${otQuestions.length} added!`);
                      }} style={s.btnG}><i className="fas fa-plus" style={{ marginRight: 6 }} />Add Question</button>
                    </>;
                  })()}
                </div>
              )}

              {/* ═══ AI QUESTION GENERATION ═══ */}
              {otQuestionMode === "ai" && (
                <div style={{ background: "#FAF5FF", borderRadius: 12, padding: 16, border: "1px solid #E9D5FF", marginBottom: 16 }}>
                  <h4 style={{ fontSize: ".9rem", fontWeight: 700, color: "#7C3AED", marginBottom: 12 }}><i className="fas fa-robot" style={{ marginRight: 6 }} />AI Question Generator (Gemini)</h4>
                  <p style={{ fontSize: ".76rem", color: "#6B7F99", marginBottom: 12 }}>Chapter aur topic batao — AI automatically {otForm.subject || "subject"} ke questions generate karega {otForm.board || "board"} pattern me.</p>
                  <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr", gap: 10 }}>
                    <div><label style={s.label}>Chapter / Topic *</label><input style={s.input} placeholder="e.g. Motion, Chemical Reactions" value={otAiForm.chapter || ""} onChange={e => setOtAiForm({ ...otAiForm, chapter: e.target.value })} /></div>
                    <div><label style={s.label}>Specific Topic</label><input style={s.input} placeholder="e.g. Newton's 3rd Law" value={otAiForm.topic || ""} onChange={e => setOtAiForm({ ...otAiForm, topic: e.target.value })} /></div>
                    <div><label style={s.label}>No. of Questions</label><input style={s.input} type="number" placeholder="10" value={otAiForm.count || ""} onChange={e => setOtAiForm({ ...otAiForm, count: e.target.value })} /></div>
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 10 }}>
                    <div><label style={s.label}>Difficulty</label>
                      <select style={s.input} value={otAiForm.difficulty || "medium"} onChange={e => setOtAiForm({ ...otAiForm, difficulty: e.target.value })}>
                        <option value="easy">Easy — Basic concepts</option><option value="medium">Medium — Board level</option><option value="hard">Hard — Competitive level</option><option value="mixed">Mixed — Sab level ke</option>
                      </select>
                    </div>
                  </div>
                  <button onClick={generateAiQuestions} disabled={otAiGenerating} style={{ ...s.btnP, background: "linear-gradient(135deg,#7C3AED,#A78BFA)", display: "flex", alignItems: "center", gap: 6 }}>
                    {otAiGenerating ? <><i className="fas fa-spinner fa-spin" /> Generating...</> : <><i className="fas fa-magic" /> Generate Questions</>}
                  </button>
                </div>
              )}

              {/* ═══ PDF UPLOAD ═══ */}
              {otQuestionMode === "pdf" && (
                <div style={{ background: "#FEF2F2", borderRadius: 12, padding: 16, border: "1px solid #FCA5A5", marginBottom: 16 }}>
                  <h4 style={{ fontSize: ".9rem", fontWeight: 700, color: "#DC2626", marginBottom: 12 }}><i className="fas fa-file-pdf" style={{ marginRight: 6 }} />PDF se Questions Extract Karo</h4>
                  <p style={{ fontSize: ".76rem", color: "#6B7F99", marginBottom: 12 }}>Question paper ya worksheet ka PDF upload karo — AI automatically questions extract karke MCQ format me convert karega.</p>
                  <div style={{ marginBottom: 12 }}>
                    <input type="file" accept=".pdf" onChange={e => setOtPdfFile(e.target.files?.[0] || null)} style={{ fontSize: ".82rem" }} />
                    {otPdfFile && <div style={{ fontSize: ".72rem", color: "#16A34A", marginTop: 4 }}><i className="fas fa-check-circle" style={{ marginRight: 4 }} />{otPdfFile.name} ({(otPdfFile.size / 1024).toFixed(0)} KB)</div>}
                  </div>
                  <button onClick={extractQuestionsFromPdf} disabled={otPdfProcessing || !otPdfFile} style={{ ...s.btnP, background: "linear-gradient(135deg,#DC2626,#F87171)", display: "flex", alignItems: "center", gap: 6 }}>
                    {otPdfProcessing ? <><i className="fas fa-spinner fa-spin" /> Processing PDF...</> : <><i className="fas fa-file-pdf" /> Extract Questions</>}
                  </button>
                </div>
              )}

              {/* ═══ QUESTIONS LIST (Preview) ═══ */}
              {otQuestions.length > 0 && (
                <div style={{ ...s.card, border: "1px solid #D4DEF0" }}>
                  <h4 style={{ fontSize: ".9rem", fontWeight: 700, color: "#0B1826", marginBottom: 12 }}><i className="fas fa-list-ol" style={{ marginRight: 8, color: "#1349A8" }} />Questions Preview ({otQuestions.filter(q => !q._editing).length})</h4>
                  {otQuestions.filter(q => !q._editing).map((q, idx) => (
                    <div key={idx} style={{ padding: "12px 14px", borderBottom: "1px solid #E8EFF8", display: "flex", gap: 10, alignItems: "flex-start" }}>
                      <div style={{ width: 28, height: 28, borderRadius: 8, background: "#EFF6FF", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, fontWeight: 800, fontSize: ".75rem", color: "#1349A8" }}>{idx + 1}</div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 600, fontSize: ".84rem", marginBottom: 6 }}>{q.question}</div>
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 4, fontSize: ".76rem" }}>
                          {(q.options || []).map((opt, oi) => (
                            <div key={oi} style={{ padding: "4px 8px", borderRadius: 6, background: q.correctAnswer === oi ? "#F0FDF4" : "#F8FAFD", border: q.correctAnswer === oi ? "1px solid #86EFAC" : "1px solid #E8EFF8", color: q.correctAnswer === oi ? "#16A34A" : "#4A5E78", fontWeight: q.correctAnswer === oi ? 700 : 400 }}>
                              {String.fromCharCode(65 + oi)}. {opt} {q.correctAnswer === oi && <i className="fas fa-check" style={{ marginLeft: 4, fontSize: ".6rem" }} />}
                            </div>
                          ))}
                        </div>
                        {q.explanation && <div style={{ fontSize: ".7rem", color: "#6B7F99", marginTop: 4 }}><i className="fas fa-lightbulb" style={{ marginRight: 3, color: "#D98D04" }} />{q.explanation}</div>}
                      </div>
                      <button onClick={() => { setOtQuestions(otQuestions.filter((_, i) => i !== idx)); showMsg("Question removed"); }} style={{ ...s.btnD, padding: "4px 8px", fontSize: ".65rem" }}><i className="fas fa-trash" /></button>
                    </div>
                  ))}
                </div>
              )}

              {/* Action Buttons */}
              <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
                <button onClick={() => setOtStep(1)} style={s.btnGray}><i className="fas fa-arrow-left" style={{ marginRight: 6 }} />Back to Info</button>
                <button onClick={saveOnlineTest} disabled={saving} style={{ ...s.btnP, background: "linear-gradient(135deg,#7C3AED,#A78BFA)" }}>
                  <i className="fas fa-upload" style={{ marginRight: 6 }} />{saving ? "Saving..." : `Publish Test (${otQuestions.filter(q => !q._editing).length} Q)`}
                </button>
                <button onClick={() => { setShowOtForm(false); setOtForm({}); setOtQuestions([]); setOtStep(1); }} style={s.btnGray}>Cancel</button>
              </div>
            </>}
          </div>}

          {/* ═══ CLASS FILTER ═══ */}
          {!showOtForm && <div style={{ display: "flex", gap: 6, marginBottom: 16, flexWrap: "wrap", alignItems: "center" }}>
            <button onClick={() => setOtClassFilter("all")} style={{ padding: "6px 14px", borderRadius: 8, border: otClassFilter === "all" ? "2px solid #7C3AED" : "1px solid #D4DEF0", background: otClassFilter === "all" ? "#FAF5FF" : "#fff", color: "#7C3AED", fontSize: ".74rem", fontWeight: 700, cursor: "pointer" }}>All</button>
            {CLASS_CATEGORIES.map(c => (
              <button key={c.id} onClick={() => setOtClassFilter(c.id)} style={{ padding: "6px 10px", borderRadius: 8, border: otClassFilter === c.id ? `2px solid ${c.color}` : "1px solid #D4DEF0", background: otClassFilter === c.id ? "#FAF5FF" : "#fff", color: c.color, fontSize: ".68rem", fontWeight: 600, cursor: "pointer" }}>{c.shortLabel}</button>
            ))}
          </div>}

          {/* ═══ TESTS LIST ═══ */}
          {!showOtForm && <>
            {otList.length === 0 ? (
              <div style={{ ...s.card, textAlign: "center", padding: 40 }}>
                <i className="fas fa-laptop" style={{ fontSize: "2.5rem", color: "#B0C4DC", marginBottom: 12 }} />
                <h3 style={{ fontSize: "1rem", fontWeight: 700, color: "#4A5E78", marginBottom: 6 }}>No Online Tests Yet</h3>
                <p style={{ fontSize: ".84rem", color: "#6B7F99" }}>Click "Create Online Test" to make your first test for students.</p>
              </div>
            ) : (() => {
              let filtered = [...otList];
              if (otClassFilter !== "all") filtered = filtered.filter(t => t.forClass === otClassFilter || t.forClass === "all");
              const typeColors = { practice: "#1349A8", weekly: "#7C3AED", monthly: "#D98D04", mock: "#059669", chapter: "#DC2626" };
              const typeLabels = { practice: "Practice", weekly: "Weekly", monthly: "Monthly", mock: "Mock", chapter: "Chapter" };
              return filtered.length === 0 ? (
                <div style={{ ...s.card, textAlign: "center", padding: 30, color: "#6B7F99" }}>No tests for this class filter.</div>
              ) : filtered.map(test => {
                const catLabel = test.forClass === "all" ? "All Classes" : (CLASS_CATEGORIES.find(c => c.id === test.forClass)?.label || test.forClass);
                return (
                  <div key={test.id} style={{ ...s.card, display: "flex", alignItems: "center", gap: 14, borderLeft: `4px solid ${test.isActive ? (typeColors[test.testType] || "#7C3AED") : "#B0C4DC"}`, opacity: test.isActive ? 1 : 0.7 }}>
                    <div style={{ width: 50, height: 50, borderRadius: 12, background: test.isActive ? "#FAF5FF" : "#F0F4FA", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                      <i className={`fas ${test.isActive ? "fa-laptop" : "fa-pause-circle"}`} style={{ fontSize: "1.2rem", color: test.isActive ? "#7C3AED" : "#B0C4DC" }} />
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4, flexWrap: "wrap" }}>
                        <span style={{ fontWeight: 700, fontSize: ".92rem" }}>{test.title}</span>
                        <span style={s.badge(typeColors[test.testType] || "#7C3AED", `${typeColors[test.testType] || "#7C3AED"}15`)}>{typeLabels[test.testType] || test.testType}</span>
                        <span style={s.badge("#6B7F99", "#F0F4FA")}>{catLabel}</span>
                        <span style={s.badge(test.isActive ? "#16A34A" : "#DC2626", test.isActive ? "#F0FDF4" : "#FEF2F2")}>{test.isActive ? "Active" : "Inactive"}</span>
                      </div>
                      <div style={{ fontSize: ".76rem", color: "#4A5E78", display: "flex", gap: 12, flexWrap: "wrap" }}>
                        <span><i className="fas fa-book" style={{ marginRight: 4, color: "#6B7F99" }} />{test.subject}</span>
                        <span><i className="fas fa-clock" style={{ marginRight: 4, color: "#6B7F99" }} />{test.duration} min</span>
                        <span><i className="fas fa-question-circle" style={{ marginRight: 4, color: "#6B7F99" }} />{test.totalQuestions} Q</span>
                        {test.chapter && <span><i className="fas fa-bookmark" style={{ marginRight: 4, color: "#6B7F99" }} />{test.chapter}</span>}
                        {test.scheduledDate && <span><i className="fas fa-calendar" style={{ marginRight: 4, color: "#6B7F99" }} />{test.scheduledDate} {test.scheduledTime || ""}</span>}
                      </div>
                    </div>
                    <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                      <button onClick={() => toggleTestActive(test.id, test.isActive)} style={test.isActive ? s.btnO : s.btnG} title={test.isActive ? "Deactivate" : "Activate"}>
                        <i className={`fas ${test.isActive ? "fa-pause" : "fa-play"}`} />
                      </button>
                      <button onClick={() => { setOtEditId(test.id); setOtForm({ ...test }); setOtQuestions(test.questions || []); setShowOtForm(true); setOtStep(1); }} style={s.btnO}><i className="fas fa-edit" /></button>
                      <button onClick={() => deleteOnlineTest(test.id)} style={s.btnD}><i className="fas fa-trash" /></button>
                    </div>
                  </div>
                );
              });
            })()}
          </>}

          {/* Tips */}
          {otView === "tests" && <div style={{ marginTop: 16, background: "#FFFBEB", borderRadius: 12, padding: 16, border: "1px solid #FDE68A", fontSize: ".82rem", color: "#78350F", display: "flex", alignItems: "flex-start", gap: 10 }}>
            <i className="fas fa-lightbulb" style={{ marginTop: 2, flexShrink: 0, color: "#D98D04" }} />
            <div>
              <strong>Online Test Tips:</strong><br />
              • 3 tarike se questions add karo: Manual type karo, AI se generate karo, ya PDF upload karo<br />
              • AI generate me chapter/topic dalo — Gemini automatically board pattern ke questions banayega<br />
              • PDF upload me question paper ka PDF dalo — AI MCQ format me convert karega<br />
              • Test Active/Inactive toggle se control karo ki students ko dikhega ya nahi<br />
              • Schedule date/time set karo — students ko us time pe test milega Student App me<br />
              • Questions review karo publish karne se pehle — galat questions hata sakte ho
            </div>
          </div>}

          {/* ═══ RESULTS SECTION ═══ */}
          {!showOtForm && otView === "results" && (() => {
            if (otResultsLoading) return (
              <div style={{ textAlign: "center", padding: 40 }}>
                <i className="fas fa-spinner fa-spin" style={{ fontSize: "1.5rem", color: "#7C3AED", marginBottom: 8 }} />
                <p style={{ color: "#6B7F99" }}>Loading results...</p>
              </div>
            );

            // Test select kiya hua hai — us test ke saare students ke results
            if (otSelectedTest) {
              const testSubs = otResults.filter(r => r.testId === otSelectedTest.id);
              const avgScore = testSubs.length > 0
                ? Math.round(testSubs.reduce((s, r) => s + (r.percentage || 0), 0) / testSubs.length)
                : 0;
              const passed = testSubs.filter(r => (r.percentage || 0) >= 40).length;
              return (
                <div>
                  {/* Back button */}
                  <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
                    <button onClick={() => setOtSelectedTest(null)} style={{ ...s.btnGray, display: "flex", alignItems: "center", gap: 6 }}>
                      <i className="fas fa-arrow-left" />Back
                    </button>
                    <div>
                      <h3 style={{ fontSize: "1rem", fontWeight: 800, margin: 0 }}>{otSelectedTest.title}</h3>
                      <p style={{ fontSize: ".72rem", color: "#6B7F99", margin: 0 }}>{otSelectedTest.subject} · {otSelectedTest.totalQuestions} Q · {testSubs.length} students submitted</p>
                    </div>
                  </div>

                  {/* Stats */}
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 10, marginBottom: 16 }}>
                    {[
                      { n: testSubs.length, l: "Submitted", c: "#7C3AED", icon: "fa-users" },
                      { n: avgScore + "%", l: "Avg Score", c: "#1349A8", icon: "fa-chart-line" },
                      { n: passed, l: "Passed (≥40%)", c: "#16A34A", icon: "fa-check-circle" },
                      { n: testSubs.length - passed, l: "Failed", c: "#DC2626", icon: "fa-times-circle" },
                    ].map((x, i) => (
                      <div key={i} style={s.stat}>
                        <i className={`fas ${x.icon}`} style={{ color: x.c, fontSize: "1.1rem", marginBottom: 4 }} />
                        <div style={{ fontSize: "1.4rem", fontWeight: 800, color: x.c }}>{x.n}</div>
                        <div style={{ fontSize: ".65rem", color: "#6B7F99" }}>{x.l}</div>
                      </div>
                    ))}
                  </div>

                  {testSubs.length === 0 ? (
                    <div style={{ ...s.card, textAlign: "center", padding: 40 }}>
                      <i className="fas fa-inbox" style={{ fontSize: "2rem", color: "#B0C4DC", marginBottom: 10 }} />
                      <p style={{ color: "#6B7F99" }}>Kisi bhi student ne abhi tak ye test nahi diya।</p>
                    </div>
                  ) : (
                    <div style={{ ...s.card, padding: 0, overflow: "auto" }}>
                      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: ".82rem" }}>
                        <thead>
                          <tr style={{ background: "#F0F4FA" }}>
                            <th style={{ padding: "10px 14px", textAlign: "left", fontWeight: 700, borderBottom: "2px solid #D4DEF0" }}>#</th>
                            <th style={{ padding: "10px 14px", textAlign: "left", fontWeight: 700, borderBottom: "2px solid #D4DEF0" }}>Student</th>
                            <th style={{ padding: "10px 14px", textAlign: "center", fontWeight: 700, borderBottom: "2px solid #D4DEF0", color: "#16A34A" }}>Score</th>
                            <th style={{ padding: "10px 14px", textAlign: "center", fontWeight: 700, borderBottom: "2px solid #D4DEF0", color: "#1349A8" }}>%</th>
                            <th style={{ padding: "10px 14px", textAlign: "center", fontWeight: 700, borderBottom: "2px solid #D4DEF0" }}>Grade</th>
                            <th style={{ padding: "10px 14px", textAlign: "center", fontWeight: 700, borderBottom: "2px solid #D4DEF0" }}>Status</th>
                            <th style={{ padding: "10px 14px", textAlign: "center", fontWeight: 700, borderBottom: "2px solid #D4DEF0" }}>Submitted</th>
                          </tr>
                        </thead>
                        <tbody>
                          {testSubs.sort((a, b) => (b.percentage || 0) - (a.percentage || 0)).map((r, idx) => {
                            const pct = r.percentage || Math.round(((r.correct || 0) / (r.totalQuestions || 1)) * 100);
                            const grade = pct >= 90 ? "A+" : pct >= 75 ? "A" : pct >= 60 ? "B" : pct >= 40 ? "C" : "D";
                            const gradeColor = pct >= 75 ? "#16A34A" : pct >= 50 ? "#D98D04" : "#DC2626";
                            const isPassed = pct >= 40;
                            const submDate = r.submittedAt?.toDate ? r.submittedAt.toDate().toLocaleDateString("en-IN") : r.submittedAt || "—";
                            return (
                              <tr key={r.id} style={{ borderBottom: "1px solid #E8EFF8", background: idx % 2 === 0 ? "#fff" : "#FAFCFE" }}>
                                <td style={{ padding: "10px 14px", color: "#6B7F99", fontWeight: 600 }}>{idx + 1}</td>
                                <td style={{ padding: "10px 14px" }}>
                                  <div style={{ fontWeight: 600 }}>{r.studentName || "Unknown"}</div>
                                  <div style={{ fontSize: ".7rem", color: "#6B7F99" }}>{r.studentClass || ""}</div>
                                </td>
                                <td style={{ padding: "10px 14px", textAlign: "center", fontWeight: 700, color: "#16A34A" }}>{r.correct || 0} / {r.totalQuestions || otSelectedTest.totalQuestions}</td>
                                <td style={{ padding: "10px 14px", textAlign: "center", fontWeight: 800, color: gradeColor, fontSize: ".92rem" }}>{pct}%</td>
                                <td style={{ padding: "10px 14px", textAlign: "center" }}>
                                  <span style={{ fontWeight: 900, fontSize: "1rem", color: gradeColor }}>{grade}</span>
                                </td>
                                <td style={{ padding: "10px 14px", textAlign: "center" }}>
                                  <span style={s.badge(isPassed ? "#16A34A" : "#DC2626", isPassed ? "#F0FDF4" : "#FEF2F2")}>{isPassed ? "Pass" : "Fail"}</span>
                                </td>
                                <td style={{ padding: "10px 14px", textAlign: "center", fontSize: ".75rem", color: "#6B7F99" }}>{submDate}</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              );
            }

            // All tests ka overview — har test ke liye kitne students ne diya
            const testsWithSubs = otList.map(t => ({
              ...t,
              submissions: otResults.filter(r => r.testId === t.id),
              avgPct: (() => {
                const subs = otResults.filter(r => r.testId === t.id);
                return subs.length > 0 ? Math.round(subs.reduce((s, r) => s + (r.percentage || 0), 0) / subs.length) : null;
              })()
            }));

            return (
              <div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
                  <h3 style={{ fontSize: ".95rem", fontWeight: 800, margin: 0 }}>
                    <i className="fas fa-chart-bar" style={{ marginRight: 8, color: "#7C3AED" }} />Test-wise Results
                  </h3>
                  <button onClick={() => {
                    setOtResultsLoading(true);
                    getDocs(collection(db, "test_submissions")).then(snap => {
                      const arr = snap.docs.map(d => ({ id: d.id, ...d.data() }));
                      arr.sort((a, b) => (b.submittedAt?.toDate?.() || 0) - (a.submittedAt?.toDate?.() || 0));
                      setOtResults(arr);
                      setOtResultsLoading(false);
                    }).catch(() => setOtResultsLoading(false));
                  }} style={{ ...s.btnO, display: "flex", alignItems: "center", gap: 6 }}>
                    <i className="fas fa-sync" />Refresh
                  </button>
                </div>

                {testsWithSubs.length === 0 ? (
                  <div style={{ ...s.card, textAlign: "center", padding: 40 }}>
                    <i className="fas fa-chart-bar" style={{ fontSize: "2rem", color: "#B0C4DC", marginBottom: 10 }} />
                    <p style={{ color: "#6B7F99" }}>Koi test create nahi hua abhi।</p>
                  </div>
                ) : testsWithSubs.map(t => (
                  <div key={t.id} style={{ ...s.card, display: "flex", alignItems: "center", gap: 14, cursor: "pointer", transition: "all .2s" }}
                    onClick={() => setOtSelectedTest(t)}>
                    <div style={{ width: 48, height: 48, borderRadius: 12, background: "#FAF5FF", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                      <i className="fas fa-file-alt" style={{ color: "#7C3AED", fontSize: "1.1rem" }} />
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 700, fontSize: ".92rem", marginBottom: 3 }}>{t.title}</div>
                      <div style={{ fontSize: ".75rem", color: "#6B7F99", display: "flex", gap: 10, flexWrap: "wrap" }}>
                        <span><i className="fas fa-book" style={{ marginRight: 3 }} />{t.subject}</span>
                        <span><i className="fas fa-question-circle" style={{ marginRight: 3 }} />{t.totalQuestions} Q</span>
                        <span><i className="fas fa-users" style={{ marginRight: 3 }} />{t.submissions.length} submitted</span>
                        {t.avgPct !== null && <span style={{ color: t.avgPct >= 60 ? "#16A34A" : t.avgPct >= 40 ? "#D98D04" : "#DC2626", fontWeight: 700 }}>
                          <i className="fas fa-chart-line" style={{ marginRight: 3 }} />Avg: {t.avgPct}%
                        </span>}
                      </div>
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4 }}>
                      {t.submissions.length > 0 ? (
                        <span style={s.badge("#7C3AED", "#FAF5FF")}>{t.submissions.length} Results</span>
                      ) : (
                        <span style={s.badge("#6B7F99", "#F0F4FA")}>No submissions</span>
                      )}
                      <i className="fas fa-chevron-right" style={{ color: "#B0C4DC", fontSize: ".7rem" }} />
                    </div>
                  </div>
                ))}
              </div>
            );
          })()}
        </>}


        {/* ═══════════ AI DOUBT INSIGHTS TAB ═══════════ */}
        {tab === "ai_doubts" && (() => {
          // Load all doubts on first render
          if (allDoubtsData.length === 0 && !allDoubtsLoading) {
            setAllDoubtsLoading(true);
            getDocs(collection(db, "doubt_history")).then(snap => {
              const arr = snap.docs.map(d => ({ id: d.id, ...d.data() }));
              arr.sort((a, b) => (b.createdAt?.toDate?.() || new Date(0)) - (a.createdAt?.toDate?.() || new Date(0)));
              setAllDoubtsData(arr);
              setAllDoubtsLoading(false);
            }).catch(e => { console.error("Doubt load error:", e); setAllDoubtsLoading(false); });
          }

          // Subject-wise grouping
          const subjectMap = {};
          allDoubtsData.forEach(d => {
            const sub = d.subject || "General";
            if (!subjectMap[sub]) subjectMap[sub] = [];
            subjectMap[sub].push(d);
          });
          const subjectEntries = Object.entries(subjectMap).sort((a, b) => b[1].length - a[1].length);

          // Common questions — group similar first messages
          const questionMap = {};
          allDoubtsData.forEach(d => {
            const q = (d.messages?.[0]?.content || d.question || "").trim().toLowerCase().slice(0, 80);
            if (!q) return;
            const key = q.replace(/[^a-zA-Z0-9\u0900-\u097F\s]/g, "").trim();
            if (!questionMap[key]) questionMap[key] = { question: d.messages?.[0]?.content || d.question || "", count: 0, students: [], subject: d.subject || "General", latest: d.createdAt };
            questionMap[key].count++;
            if (!questionMap[key].students.includes(d.studentName)) questionMap[key].students.push(d.studentName);
          });
          const commonQuestions = Object.values(questionMap).sort((a, b) => b.count - a.count).slice(0, 30);

          // Student-wise grouping
          const studentMap = {};
          allDoubtsData.forEach(d => {
            const name = d.studentName || "Unknown";
            if (!studentMap[name]) studentMap[name] = { count: 0, subjects: {} };
            studentMap[name].count++;
            const sub = d.subject || "General";
            studentMap[name].subjects[sub] = (studentMap[name].subjects[sub] || 0) + 1;
          });
          const studentEntries = Object.entries(studentMap).sort((a, b) => b[1].count - a[1].count);

          return <>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, flexWrap: "wrap", gap: 10 }}>
              <div>
                <h2 style={{ fontSize: "1.3rem", fontWeight: 800 }}><i className="fas fa-brain" style={{ marginRight: 8, color: "#7C3AED" }} />AI Doubt Insights</h2>
                <p style={{ fontSize: ".78rem", color: "#6B7F99" }}>Saare students ke common doubts · Subject-wise analysis · Most asked questions</p>
              </div>
              <button onClick={() => { setAllDoubtsData([]); setAllDoubtsLoading(false); }} style={s.btnO}><i className="fas fa-sync" style={{ marginRight: 6 }} />Refresh</button>
            </div>

            {allDoubtsLoading ? (
              <div style={{ textAlign: "center", padding: 40, color: "#6B7F99" }}><i className="fas fa-spinner fa-spin" style={{ fontSize: "1.5rem", marginBottom: 8 }} /><p>Loading all doubt data...</p></div>
            ) : <>
              {/* Stats */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: 12, marginBottom: 16 }}>
                <div style={s.stat}><div style={{ fontSize: "1.6rem", fontWeight: 800, color: "#7C3AED" }}>{allDoubtsData.length}</div><div style={{ fontSize: ".72rem", color: "#6B7F99" }}>Total Doubts Asked</div></div>
                <div style={s.stat}><div style={{ fontSize: "1.6rem", fontWeight: 800, color: "#1349A8" }}>{subjectEntries.length}</div><div style={{ fontSize: ".72rem", color: "#6B7F99" }}>Subjects</div></div>
                <div style={s.stat}><div style={{ fontSize: "1.6rem", fontWeight: 800, color: "#059669" }}>{studentEntries.length}</div><div style={{ fontSize: ".72rem", color: "#6B7F99" }}>Students Using AI</div></div>
                <div style={s.stat}><div style={{ fontSize: "1.6rem", fontWeight: 800, color: "#D98D04" }}>{allDoubtsData.filter(d => d.hasImage).length}</div><div style={{ fontSize: ".72rem", color: "#6B7F99" }}>Image Doubts</div></div>
              </div>

              {/* Subject Distribution */}
              <div style={{ ...s.card, marginBottom: 16 }}>
                <h3 style={{ fontSize: ".95rem", fontWeight: 700, marginBottom: 14 }}><i className="fas fa-chart-pie" style={{ marginRight: 8, color: "#7C3AED" }} />Subject-wise Doubt Distribution</h3>
                <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                  {subjectEntries.map(([sub, doubts]) => {
                    const pct = Math.round((doubts.length / allDoubtsData.length) * 100);
                    const colors = ["#7C3AED", "#1349A8", "#059669", "#D98D04", "#DC2626", "#0891B2", "#BE185D", "#16A34A"];
                    const ci = subjectEntries.findIndex(e => e[0] === sub) % colors.length;
                    return (
                      <div key={sub} style={{ flex: "1 1 220px", padding: 14, borderRadius: 12, border: "1px solid #E8EFF8", background: "#FAFCFE" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                          <span style={{ fontSize: ".85rem", fontWeight: 700, color: colors[ci] }}>{sub}</span>
                          <span style={{ fontSize: ".74rem", fontWeight: 700, color: "#4A5E78" }}>{doubts.length} ({pct}%)</span>
                        </div>
                        <div style={{ width: "100%", height: 8, background: "#E8EFF8", borderRadius: 99, overflow: "hidden" }}>
                          <div style={{ width: pct + "%", height: "100%", background: colors[ci], borderRadius: 99 }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Most Common Questions */}
              <div style={{ ...s.card, marginBottom: 16 }}>
                <h3 style={{ fontSize: ".95rem", fontWeight: 700, marginBottom: 14 }}><i className="fas fa-fire" style={{ marginRight: 8, color: "#DC2626" }} />Most Common Questions (Sabse zyada puchhe gaye)</h3>
                {commonQuestions.length === 0 ? (
                  <div style={{ textAlign: "center", padding: 20, color: "#6B7F99" }}>No doubt data yet.</div>
                ) : commonQuestions.map((q, idx) => (
                  <div key={idx} style={{ padding: "12px 14px", borderBottom: "1px solid #E8EFF8", display: "flex", gap: 10, alignItems: "flex-start" }}>
                    <div style={{ width: 28, height: 28, borderRadius: 8, background: q.count > 1 ? "#FEF2F2" : "#F0F4FA", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, fontWeight: 800, fontSize: ".72rem", color: q.count > 1 ? "#DC2626" : "#6B7F99" }}>{idx + 1}</div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: ".84rem", fontWeight: 600, color: "#0B1826", marginBottom: 4 }}>{q.question}</div>
                      <div style={{ fontSize: ".7rem", color: "#6B7F99", display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                        <span style={s.badge("#7C3AED", "#FAF5FF")}>{q.subject}</span>
                        {q.count > 1 && <span style={s.badge("#DC2626", "#FEF2F2")}>{q.count}x asked</span>}
                        <span style={{ fontSize: ".65rem" }}>by: {q.students.slice(0, 3).join(", ")}{q.students.length > 3 ? ` +${q.students.length - 3} more` : ""}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Student-wise Doubt Activity */}
              <div style={{ ...s.card }}>
                <h3 style={{ fontSize: ".95rem", fontWeight: 700, marginBottom: 14 }}><i className="fas fa-users" style={{ marginRight: 8, color: "#059669" }} />Student-wise AI Usage</h3>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: ".78rem" }}>
                  <thead><tr style={{ background: "#F0F4FA" }}>
                    <th style={{ padding: "8px 10px", textAlign: "left", fontWeight: 700, borderBottom: "2px solid #D4DEF0" }}>#</th>
                    <th style={{ padding: "8px 10px", textAlign: "left", fontWeight: 700, borderBottom: "2px solid #D4DEF0" }}>Student</th>
                    <th style={{ padding: "8px 8px", textAlign: "center", fontWeight: 700, borderBottom: "2px solid #D4DEF0" }}>Total Doubts</th>
                    <th style={{ padding: "8px 8px", textAlign: "left", fontWeight: 700, borderBottom: "2px solid #D4DEF0" }}>Subjects</th>
                  </tr></thead>
                  <tbody>
                    {studentEntries.map(([name, data], idx) => (
                      <tr key={name} style={{ borderBottom: "1px solid #E8EFF8", background: idx % 2 === 0 ? "#fff" : "#FAFCFE" }}>
                        <td style={{ padding: "8px 10px", color: "#6B7F99", fontWeight: 600 }}>{idx + 1}</td>
                        <td style={{ padding: "8px 10px", fontWeight: 600 }}>{name}</td>
                        <td style={{ padding: "8px 8px", textAlign: "center", fontWeight: 800, color: "#7C3AED" }}>{data.count}</td>
                        <td style={{ padding: "8px 8px" }}>
                          <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                            {Object.entries(data.subjects).map(([sub, cnt]) => (
                              <span key={sub} style={s.badge("#1349A8", "#EFF6FF")}>{sub}: {cnt}</span>
                            ))}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>}

            {/* Tips */}
            <div style={{ marginTop: 16, background: "#FFFBEB", borderRadius: 12, padding: 16, border: "1px solid #FDE68A", fontSize: ".82rem", color: "#78350F", display: "flex", alignItems: "flex-start", gap: 10 }}>
              <i className="fas fa-lightbulb" style={{ marginTop: 2, flexShrink: 0, color: "#D98D04" }} />
              <div>
                <strong>AI Doubt Insights Tips:</strong><br />
                • Ye section saare students ke AI doubts ka analysis dikhata hai<br />
                • "Most Common Questions" se pata chalta hai ki students ko kis topic me problem aa rahi hai<br />
                • Subject distribution se weak areas identify karo aur class me us topic pe zyada focus karo<br />
                • Student-wise usage se pata chalta hai kaun kitna AI use kar raha hai
              </div>
            </div>
          </>;
        })()}

        {/* ═══════════ FEE MANAGEMENT TAB ═══════════ */}
        {tab === "fees" && <>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, flexWrap: "wrap", gap: 10 }}>
            <div>
              <h2 style={{ fontSize: "1.3rem", fontWeight: 800 }}><i className="fas fa-rupee-sign" style={{ marginRight: 8, color: "#059669" }} />Fee Management</h2>
              <p style={{ fontSize: ".78rem", color: "#6B7F99" }}>Track student fees, payments, and send reminders</p>
            </div>
          </div>

          {/* Fee Stats */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: 12, marginBottom: 16 }}>
            {(() => {
              // inst1+inst2+inst3 ka total = actual paid amount
              const calcPaid = (st) => Number(st.inst1Amount || 0) + Number(st.inst2Amount || 0) + Number(st.inst3Amount || 0);
              const totalFees = students.reduce((sum, st) => sum + Number(st.totalFee || 0), 0);
              const totalPaid = students.reduce((sum, st) => sum + calcPaid(st), 0);
              const totalDue = totalFees - totalPaid;
              const fullyPaid = students.filter(st => st.totalFee && calcPaid(st) >= Number(st.totalFee)).length;
              return [
                { n: `₹${totalFees.toLocaleString("en-IN")}`, l: "Total Fees", c: "#1349A8", icon: "fa-money-bill-wave" },
                { n: `₹${totalPaid.toLocaleString("en-IN")}`, l: "Total Collected", c: "#16A34A", icon: "fa-check-circle" },
                { n: `₹${Math.max(0, totalDue).toLocaleString("en-IN")}`, l: "Total Due", c: "#DC2626", icon: "fa-exclamation-circle" },
                { n: fullyPaid, l: "Fully Paid", c: "#059669", icon: "fa-user-check" },
              ].map((x, i) => (
                <div key={i} style={s.stat}>
                  <i className={`fas ${x.icon}`} style={{ fontSize: "1.2rem", color: x.c, marginBottom: 4 }} />
                  <div style={{ fontSize: "1.3rem", fontWeight: 800, color: x.c }}>{x.n}</div>
                  <div style={{ fontSize: ".72rem", color: "#6B7F99" }}>{x.l}</div>
                </div>
              ));
            })()}
          </div>

          {/* Filters */}
          <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
            <select style={{ border: "1.5px solid #C0D0E8", borderRadius: 8, padding: "8px 12px", fontSize: ".82rem", outline: "none" }} value={feeClassFilter} onChange={(e) => setFeeClassFilter(e.target.value)}>
              <option value="all">All Classes</option>
              <optgroup label="Class 12th">
                {BATCH_OPTIONS.filter(b => b.class === "12th").map(b => <option key={b.value} value={b.value}>{b.label}</option>)}
              </optgroup>
              <optgroup label="Class 11th">
                {BATCH_OPTIONS.filter(b => b.class === "11th").map(b => <option key={b.value} value={b.value}>{b.label}</option>)}
              </optgroup>
              <optgroup label="Class 10th">
                {BATCH_OPTIONS.filter(b => b.class === "10th").map(b => <option key={b.value} value={b.value}>{b.label}</option>)}
              </optgroup>
              <optgroup label="Class 9th">
                {BATCH_OPTIONS.filter(b => b.class === "9th").map(b => <option key={b.value} value={b.value}>{b.label}</option>)}
              </optgroup>
              <optgroup label="Junior Classes">
                {BATCH_OPTIONS.filter(b => b.class === "2nd-8th").map(b => <option key={b.value} value={b.value}>{b.label}</option>)}
              </optgroup>
              <optgroup label="Entrance Coaching">
                {BATCH_OPTIONS.filter(b => b.class === "Navodaya" || b.class === "Prayas").map(b => <option key={b.value} value={b.value}>{b.label}</option>)}
              </optgroup>
            </select>
            <input style={{ flex: 1, minWidth: 200, border: "1.5px solid #C0D0E8", borderRadius: 8, padding: "8px 12px", fontSize: ".82rem", outline: "none" }} placeholder="Search student..." value={feeSearch} onChange={(e) => setFeeSearch(e.target.value)} />
          </div>

          {/* Fee Table */}
          <div style={{ ...s.card, padding: 0, overflow: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: ".82rem" }}>
              <thead>
                <tr style={{ background: "#F0F4FA" }}>
                  <th style={{ padding: "10px 14px", textAlign: "left", fontWeight: 700, borderBottom: "2px solid #D4DEF0" }}>#</th>
                  <th style={{ padding: "10px 14px", textAlign: "left", fontWeight: 700, borderBottom: "2px solid #D4DEF0" }}>Student</th>
                  <th style={{ padding: "10px 14px", textAlign: "center", fontWeight: 700, borderBottom: "2px solid #D4DEF0" }}>Class</th>
                  <th style={{ padding: "10px 14px", textAlign: "center", fontWeight: 700, borderBottom: "2px solid #D4DEF0" }}>Total Fee</th>
                  <th style={{ padding: "10px 14px", textAlign: "center", fontWeight: 700, color: "#7C3AED", borderBottom: "2px solid #D4DEF0" }}>Enroll. Fee</th>
                  <th style={{ padding: "10px 14px", textAlign: "center", fontWeight: 700, color: "#16A34A", borderBottom: "2px solid #D4DEF0" }}>Paid</th>
                  <th style={{ padding: "10px 14px", textAlign: "center", fontWeight: 700, color: "#DC2626", borderBottom: "2px solid #D4DEF0" }}>Due</th>
                  <th style={{ padding: "10px 14px", textAlign: "center", fontWeight: 700, borderBottom: "2px solid #D4DEF0" }}>Status</th>
                  <th style={{ padding: "10px 14px", textAlign: "center", fontWeight: 700, borderBottom: "2px solid #D4DEF0" }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {(() => {
                  let feeList = students.filter(x => x.status === "active");
                  if (feeClassFilter !== "all") feeList = filterByBatch(feeList, feeClassFilter);
                  if (feeSearch.trim()) { const q = feeSearch.toLowerCase(); feeList = feeList.filter(x => x.studentName?.toLowerCase().includes(q)); }

                  if (feeList.length === 0) return <tr><td colSpan={9} style={{ padding: 40, textAlign: "center", color: "#6B7F99" }}>No students found</td></tr>;

                  return feeList.map((st, idx) => {
                    const total = Number(st.totalFee || 0);
                    // Installment-wise actual paid amount
                    const inst1 = Number(st.inst1Amount || 0);
                    const inst2 = Number(st.inst2Amount || 0);
                    const inst3 = Number(st.inst3Amount || 0);
                    const paidTotal = inst1 + inst2 + inst3;
                    const due = Math.max(0, total - paidTotal);
                    const isFullyPaid = total > 0 && paidTotal >= total;
                    const enrollStatus = st.enrollmentFeePaid; // "paid" | "not_paid" | undefined

                    // Kitne installments complete hain
                    const instsDone = [inst1, inst2, inst3].filter(x => x > 0).length;

                    return (
                      <tr key={st.id} style={{ borderBottom: "1px solid #E8EFF8", background: idx % 2 === 0 ? "#fff" : "#FAFCFE" }}>
                        <td style={{ padding: "10px 14px", color: "#6B7F99", fontWeight: 600 }}>{idx + 1}</td>
                        <td style={{ padding: "10px 14px" }}>
                          <div style={{ fontWeight: 600 }}>{st.studentName}</div>
                          <div style={{ fontSize: ".7rem", color: "#6B7F99" }}>{st.studentPhone}</div>
                          {instsDone > 0 && (
                            <div style={{ fontSize: ".68rem", color: "#1349A8", marginTop: 2 }}>
                              {[inst1,inst2,inst3].map((amt, i) => amt > 0 ? (
                                <span key={i} style={{ marginRight: 6, background: "#EFF6FF", borderRadius: 4, padding: "1px 5px" }}>
                                  Inst{i+1}: ₹{amt.toLocaleString("en-IN")}
                                </span>
                              ) : null)}
                            </div>
                          )}
                        </td>
                        <td style={{ padding: "10px 14px", textAlign: "center" }}><span style={s.badge("#1349A8", "#EFF6FF")}>{st.class}</span></td>
                        <td style={{ padding: "10px 14px", textAlign: "center", fontWeight: 600 }}>{total > 0 ? `₹${total.toLocaleString("en-IN")}` : "—"}</td>

                        {/* Enrollment Fee Status column */}
                        <td style={{ padding: "10px 14px", textAlign: "center" }}>
                          {enrollStatus === "paid"
                            ? <span style={{ ...s.badge("#16A34A", "#F0FDF4"), fontSize: ".68rem" }}><i className="fas fa-check" style={{ marginRight: 3 }} />Paid</span>
                            : enrollStatus === "not_paid"
                            ? <span style={{ ...s.badge("#DC2626", "#FEF2F2"), fontSize: ".68rem" }}><i className="fas fa-times" style={{ marginRight: 3 }} />Not Paid</span>
                            : <span style={{ ...s.badge("#6B7F99", "#F0F4FA"), fontSize: ".68rem" }}>—</span>}
                        </td>

                        <td style={{ padding: "10px 14px", textAlign: "center", fontWeight: 700, color: "#16A34A" }}>{paidTotal > 0 ? `₹${paidTotal.toLocaleString("en-IN")}` : "—"}</td>
                        <td style={{ padding: "10px 14px", textAlign: "center", fontWeight: 700, color: due > 0 ? "#DC2626" : "#16A34A" }}>{total > 0 ? `₹${due.toLocaleString("en-IN")}` : "—"}</td>
                        <td style={{ padding: "10px 14px", textAlign: "center" }}>
                          {total === 0 ? <span style={s.badge("#6B7F99", "#F0F4FA")}>No Fee</span>
                            : isFullyPaid ? <span style={s.badge("#16A34A", "#F0FDF4")}>Fully Paid</span>
                            : paidTotal > 0 ? <span style={s.badge("#D98D04", "#FFFBEB")}>Partial</span>
                            : <span style={s.badge("#DC2626", "#FEF2F2")}>Due</span>}
                        </td>
                        <td style={{ padding: "10px 14px", textAlign: "center" }}>
                          <div style={{ display: "flex", gap: 4, justifyContent: "center", flexWrap: "wrap" }}>
                            {total > 0 && (
                              <button onClick={() => { setShowFeePayment(st.id); setFeePaymentForm({ date: new Date().toISOString().split("T")[0], installmentNo: String(instsDone + 1 <= 3 ? instsDone + 1 : 3) }); }}
                                style={{ padding: "4px 10px", borderRadius: 6, border: "1px solid #86EFAC", background: "#F0FDF4", color: "#16A34A", fontSize: ".7rem", fontWeight: 700, cursor: "pointer" }}>
                                <i className="fas fa-plus" style={{ marginRight: 3 }} />Pay
                              </button>
                            )}
                            {total > 0 && (
                              <button onClick={() => { setShowReceipt(st.id); setFeePaymentForm({}); }}
                                style={{ padding: "4px 10px", borderRadius: 6, border: "1px solid #FDE68A", background: "#FFFBEB", color: "#92400E", fontSize: ".7rem", fontWeight: 700, cursor: "pointer" }}>
                                <i className="fas fa-receipt" style={{ marginRight: 3 }} />Receipt
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  });
                })()}
              </tbody>
            </table>
          </div>

          {/* Fee Payment Modal — Full Installment System */}
          {showFeePayment && (() => {
            const st = students.find(x => x.id === showFeePayment);
            if (!st) return null;
            const totalFee = Number(st.totalFee || 0);
            const inst1 = Number(st.inst1Amount || 0);
            const inst2 = Number(st.inst2Amount || 0);
            const inst3 = Number(st.inst3Amount || 0);
            const alreadyPaid = inst1 + inst2 + inst3;
            const due = Math.max(0, totalFee - alreadyPaid);
            const instNo = feePaymentForm.installmentNo || "1";

            // Student ke existing subjects
            const subjects = [1,2,3,4,5,6].map(n => ({ n, name: st[`subject${n}`] })).filter(x => x.name);

            // Auto distribute function
            const autoDistribute = () => {
              const amt = Number(feePaymentForm.instAmount || 0);
              if (!amt || !subjects.length) return;
              const each = Math.floor(amt / subjects.length);
              const rem = amt - (each * subjects.length);
              const newSubFees = {};
              subjects.forEach((sub, i) => { newSubFees[`sf${sub.n}`] = i === 0 ? each + rem : each; });
              setFeePaymentForm(prev => ({ ...prev, subjectFees: newSubFees }));
            };

            // Save installment to Firebase + update student doc
            const saveInstallment = async () => {
              const amt = Number(feePaymentForm.instAmount || 0);
              if (!amt || amt <= 0) { alert("Amount required"); return; }
              setSaving(true);
              try {
                const stRef = doc(db, "students", showFeePayment);
                const instAmtKey = `inst${instNo}Amount`;
                const instDateKey = `inst${instNo}Date`;
                const subFees = feePaymentForm.subjectFees || {};

                // Student doc update karo — installment + subject fees
                const updateData = {
                  [instAmtKey]: amt,
                  [instDateKey]: feePaymentForm.date || new Date().toISOString().split("T")[0],
                  updatedAt: serverTimestamp(),
                };
                // Subject fees bhi student doc me save karo (installment ke according key)
                subjects.forEach(sub => {
                  const feeVal = subFees[`sf${sub.n}`];
                  if (feeVal !== undefined) {
                    // 1st installment = fee1..fee6, 2nd = fee2_sub1..fee2_sub6, 3rd = fee3_sub1..fee3_sub6
                    const feeKey = instNo === "1" ? `fee${sub.n}` : `fee${instNo}_sub${sub.n}`;
                    updateData[feeKey] = Number(feeVal);
                  }
                });
                if (feePaymentForm.paymentMode) updateData.paymentMode = feePaymentForm.paymentMode;
                if (feePaymentForm.note) updateData[`inst${instNo}Note`] = feePaymentForm.note;

                await updateDoc(stRef, updateData);

                // fee_payments collection me history save karo
                await addDoc(collection(db, "fee_payments"), {
                  studentId: showFeePayment,
                  studentName: st.studentName,
                  class: st.class,
                  installmentNo: instNo,
                  amount: amt,
                  date: feePaymentForm.date || new Date().toISOString().split("T")[0],
                  paymentMode: feePaymentForm.paymentMode || "cash",
                  note: feePaymentForm.note || "",
                  subjectFees: subFees,
                  createdAt: serverTimestamp(),
                });

                setShowFeePayment(null);
                setFeePaymentForm({});
                setMsg("✅ Installment saved!");
                setTimeout(() => setMsg(""), 3000);
              } catch (e) {
                alert("Save error: " + e.message);
              }
              setSaving(false);
            };

            return (
              <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.5)", zIndex: 9999, display: "flex", alignItems: "flex-start", justifyContent: "center", padding: "20px 16px", overflowY: "auto" }} onClick={() => { setShowFeePayment(null); setFeePaymentForm({}); }}>
                <div style={{ background: "#fff", borderRadius: 16, padding: 24, maxWidth: 520, width: "100%", boxShadow: "0 20px 60px rgba(0,0,0,.2)", marginTop: 20 }} onClick={e => e.stopPropagation()}>

                  {/* Header */}
                  <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
                    <div style={{ width: 40, height: 40, borderRadius: 10, background: "#EFF6FF", display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <i className="fas fa-layer-group" style={{ color: "#1349A8" }} />
                    </div>
                    <div>
                      <h3 style={{ fontSize: "1rem", fontWeight: 800, margin: 0 }}>Fee Payment — {st.studentName}</h3>
                      <p style={{ fontSize: ".75rem", color: "#6B7F99", margin: 0 }}>Class {st.class} · Total: ₹{totalFee.toLocaleString("en-IN")} · Paid: <span style={{ color: "#16A34A", fontWeight: 700 }}>₹{alreadyPaid.toLocaleString("en-IN")}</span> · Due: <span style={{ color: "#DC2626", fontWeight: 700 }}>₹{due.toLocaleString("en-IN")}</span></p>
                    </div>
                  </div>

                  {/* Existing installments summary */}
                  {(inst1 > 0 || inst2 > 0 || inst3 > 0) && (
                    <div style={{ background: "#F0FDF4", borderRadius: 8, padding: 10, marginBottom: 14, display: "flex", gap: 10, flexWrap: "wrap" }}>
                      {[{n:"1",amt:inst1,date:st.inst1Date},{n:"2",amt:inst2,date:st.inst2Date},{n:"3",amt:inst3,date:st.inst3Date}].map(x => x.amt > 0 ? (
                        <div key={x.n} style={{ fontSize: ".72rem", color: "#166534", background: "#DCFCE7", borderRadius: 6, padding: "4px 10px" }}>
                          <strong>Inst {x.n}:</strong> ₹{x.amt.toLocaleString("en-IN")} {x.date ? `(${x.date})` : ""}
                        </div>
                      ) : null)}
                    </div>
                  )}

                  {/* Installment selector — only show available ones + create new */}
                  <div style={{ marginBottom: 14 }}>
                    <label style={{ ...s.label, marginBottom: 6 }}>Installment Select / Create</label>
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                      {["1","2","3"].map(n => {
                        const existingAmt = n === "1" ? inst1 : n === "2" ? inst2 : inst3;
                        const isNew = existingAmt === 0;
                        return (
                          <button key={n} type="button"
                            onClick={() => setFeePaymentForm(prev => ({ ...prev, installmentNo: n, instAmount: existingAmt > 0 ? String(existingAmt) : "", subjectFees: {} }))}
                            style={{ padding: "8px 14px", borderRadius: 8, border: `2px solid ${instNo === n ? "#1349A8" : isNew ? "#86EFAC" : "#D4DEF0"}`, background: instNo === n ? "#EFF6FF" : isNew ? "#F0FDF4" : "#F8FAFD", color: instNo === n ? "#1349A8" : isNew ? "#16A34A" : "#6B7F99", fontWeight: 700, fontSize: ".78rem", cursor: "pointer" }}>
                            {isNew ? <><i className="fas fa-plus" style={{ marginRight: 4 }} />New {n}{n==="1"?"st":n==="2"?"nd":"rd"} Inst</> : <>{n}{n==="1"?"st":n==="2"?"nd":"rd"} Inst — ₹{existingAmt.toLocaleString("en-IN")}</>}
                          </button>
                        );
                      })}
                    </div>
                    {inst1 > 0 && inst2 === 0 && instNo === "1" && (
                      <p style={{ fontSize: ".7rem", color: "#D98D04", marginTop: 6 }}><i className="fas fa-info-circle" style={{ marginRight: 4 }} />Tip: 2nd Inst create karne ke liye "New 2nd Inst" button dabao</p>
                    )}
                  </div>

                  {/* Amount + Date */}
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 }}>
                    <div>
                      <label style={s.label}>{instNo === "1" ? "1st" : instNo === "2" ? "2nd" : "3rd"} Installment Amount (₹) *</label>
                      <input style={{ ...s.input, borderColor: "#86EFAC" }} type="number" placeholder="e.g. 8000"
                        value={feePaymentForm.instAmount || ""}
                        onChange={e => setFeePaymentForm(prev => ({ ...prev, instAmount: e.target.value, subjectFees: {} }))} />
                    </div>
                    <div>
                      <label style={s.label}>Payment Date</label>
                      <input style={s.input} type="date" value={feePaymentForm.date || new Date().toISOString().split("T")[0]}
                        onChange={e => setFeePaymentForm(prev => ({ ...prev, date: e.target.value }))} />
                    </div>
                  </div>

                  {/* Subject Distribution */}
                  {subjects.length > 0 && (
                    <div style={{ background: "#F0FDF4", borderRadius: 10, padding: 12, border: "1px solid #86EFAC", marginBottom: 12 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                        <span style={{ fontSize: ".78rem", fontWeight: 700, color: "#166534" }}><i className="fas fa-list" style={{ marginRight: 5 }} />Subject-wise Fee Distribution</span>
                        <button type="button" onClick={autoDistribute}
                          style={{ padding: "4px 12px", borderRadius: 6, border: "none", background: "#16A34A", color: "#fff", fontSize: ".72rem", fontWeight: 700, cursor: "pointer" }}>
                          <i className="fas fa-magic" style={{ marginRight: 4 }} />Auto Distribute
                        </button>
                      </div>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
                        {subjects.map(sub => {
                          const val = feePaymentForm.subjectFees?.[`sf${sub.n}`] ?? "";
                          return (
                            <div key={sub.n}>
                              <label style={{ fontSize: ".7rem", fontWeight: 600, color: "#166534", display: "block", marginBottom: 3 }}>{sub.name}</label>
                              <input style={{ ...s.input, borderColor: "#86EFAC", padding: "6px 8px", fontSize: ".8rem" }} type="number" placeholder="0" value={val}
                                onChange={e => {
                                  const newFees = { ...(feePaymentForm.subjectFees || {}), [`sf${sub.n}`]: Number(e.target.value) };
                                  const tot = Object.values(newFees).reduce((a, b) => a + Number(b || 0), 0);
                                  setFeePaymentForm(prev => ({ ...prev, subjectFees: newFees, instAmount: String(tot) }));
                                }} />
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Payment Mode + Note */}
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 16 }}>
                    <div>
                      <label style={s.label}>Payment Mode</label>
                      <select style={s.input} value={feePaymentForm.paymentMode || "cash"} onChange={e => setFeePaymentForm(prev => ({ ...prev, paymentMode: e.target.value }))}>
                        <option value="cash">Cash</option>
                        <option value="upi">UPI</option>
                        <option value="bank">Bank Transfer</option>
                        <option value="other">Other</option>
                      </select>
                    </div>
                    <div>
                      <label style={s.label}>Note (optional)</label>
                      <input style={s.input} placeholder="e.g. Remaining fee" value={feePaymentForm.note || ""} onChange={e => setFeePaymentForm(prev => ({ ...prev, note: e.target.value }))} />
                    </div>
                  </div>

                  {/* Save + Cancel */}
                  <div style={{ display: "flex", gap: 10 }}>
                    <button onClick={saveInstallment} disabled={saving} style={{ ...s.btnP, flex: 1 }}>
                      <i className="fas fa-check" style={{ marginRight: 6 }} />{saving ? "Saving..." : `Save ${instNo === "1" ? "1st" : instNo === "2" ? "2nd" : "3rd"} Installment`}
                    </button>
                    <button onClick={() => { setShowFeePayment(null); setFeePaymentForm({}); }} style={s.btnGray}>Cancel</button>
                  </div>
                </div>
              </div>
            );
          })()}
          {/* Tips */}
          <div style={{ marginTop: 16, background: "#FFFBEB", borderRadius: 12, padding: 16, border: "1px solid #FDE68A", fontSize: ".82rem", color: "#78350F", display: "flex", alignItems: "flex-start", gap: 10 }}>
            <i className="fas fa-lightbulb" style={{ marginTop: 2, flexShrink: 0, color: "#D98D04" }} />
            <div>
              <strong>Fee Management Tips:</strong><br />
              • Admission form me Total Fee aur Enrollment Fee Paid bharo<br />
              • "Pay" button se installment wise payment record karo<br />
              • "Receipt" button se rasid print karo — exact coaching receipt format me<br />
              • Subject-wise fees admission form me "Subject-wise Fee" section me bharo<br />
              • Due amount auto-calculate hota hai<br />
              • Fee payments history "fee_payments" collection me save hoti hai
            </div>
          </div>

 {/* ═══ FEE RECEIPT MODAL ═══ */}
          {showReceipt && (() => {
            const st = students.find(x => x.id === showReceipt);
            if (!st) return null;

            // ── Installment data ──
            const inst1 = Number(st.inst1Amount || 0);
            const inst2 = Number(st.inst2Amount || 0);
            const inst3 = Number(st.inst3Amount || 0);
            const totalPaid = inst1 + inst2 + inst3;
            const total = Number(st.totalFee || 0);
            const due = Math.max(0, total - totalPaid);

            // Selected installment (from feePaymentForm.receiptInst)
            const selInst = feePaymentForm?.receiptInst || "all";

            // Installment ke according date aur mode
            const getInstDate = (n) => st[`inst${n}Date`] || new Date().toLocaleDateString("en-IN", { day: "2-digit", month: "2-digit", year: "numeric" });
            const getInstMode = (n) => st[`inst${n}Mode`] || st.paymentMode || "Cash";
            const getInstNote = (n) => st[`inst${n}Note`] || "";

            const receiptDate = selInst === "all"
              ? new Date().toLocaleDateString("en-IN", { day: "2-digit", month: "2-digit", year: "numeric" })
              : (() => { const d = st[`inst${selInst}Date`]; return d ? new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "2-digit", year: "numeric" }) : new Date().toLocaleDateString("en-IN", { day: "2-digit", month: "2-digit", year: "numeric" }); })();

            const receiptAmount = selInst === "all" ? totalPaid
              : selInst === "1" ? inst1
              : selInst === "2" ? inst2
              : inst3;

            const receiptMode = selInst === "all" ? (st.paymentMode || "Cash") : getInstMode(selInst);
            const instLabel = selInst === "1" ? "1st Installment" : selInst === "2" ? "2nd Installment" : selInst === "3" ? "3rd Installment" : "Full Receipt";

            // Subject fees — installment ke according
            const getSubFee = (n) => {
              if (selInst === "2") return st[`fee2_sub${n}`] || "";
              if (selInst === "3") return st[`fee3_sub${n}`] || "";
              if (selInst === "all") {
                // Saare installments ki fees combine karo
                const f1 = Number(st[`fee${n}`] || 0);
                const f2 = Number(st[`fee2_sub${n}`] || 0);
                const f3 = Number(st[`fee3_sub${n}`] || 0);
                const combined = f1 + f2 + f3;
                return combined > 0 ? String(combined) : "";
              }
              return st[`fee${n}`] || "";
            };
            const subjects = [1,2,3,4,5,6]
              .map(n => ({ name: st[`subject${n}`], fee: getSubFee(n) }))
              .filter(x => x.name);
            const subjectTotal = subjects.reduce((s, sub) => s + Number(sub.fee || 0), 0);
            // All/Full me totalPaid use karo, individual installment me subjectTotal
            const displayTotal = selInst === "all" ? totalPaid : (subjectTotal > 0 ? subjectTotal : receiptAmount);

            // Number to words
            const numToWords = (n) => {
              if (!n || n === 0) return "Zero";
              const ones = ["","One","Two","Three","Four","Five","Six","Seven","Eight","Nine","Ten","Eleven","Twelve","Thirteen","Fourteen","Fifteen","Sixteen","Seventeen","Eighteen","Nineteen"];
              const tens = ["","","Twenty","Thirty","Forty","Fifty","Sixty","Seventy","Eighty","Ninety"];
              if (n < 20) return ones[n];
              if (n < 100) return tens[Math.floor(n/10)] + (n%10 ? " "+ones[n%10] : "");
              if (n < 1000) return ones[Math.floor(n/100)] + " Hundred" + (n%100 ? " "+numToWords(n%100) : "");
              if (n < 100000) return numToWords(Math.floor(n/1000)) + " Thousand" + (n%1000 ? " "+numToWords(n%1000) : "");
              if (n < 10000000) return numToWords(Math.floor(n/100000)) + " Lakh" + (n%100000 ? " "+numToWords(n%100000) : "");
              return String(n);
            };


            // ── PRINT FUNCTION ──
            const printReceipt = (size) => {
              const isS = size === "small";
              const isM = size === "medium";
              const pageSize = isS ? "80mm 150mm" : isM ? "A5 portrait" : "A4 portrait";
              const mg = isS ? "3mm" : isM ? "6mm" : "8mm";
              const fs = isS ? "9px" : isM ? "11px" : "13px";
              const titleFs = isS ? "20px" : isM ? "26px" : "32px";
              const pad = isS ? "6px 10px" : "10px 16px";
              const tdPad = isS ? "3px 6px" : "5px 10px";
              const subRows = subjects.map(function(sub, i) {
                return "<tr><td style='border:1px solid #B91C1C;padding:" + tdPad + ";font-weight:700'>" + (i+1) + ".</td>"
                  + "<td style='border:1px solid #B91C1C;padding:" + tdPad + ";font-weight:700'>" + sub.name.toUpperCase() + "</td>"
                  + "<td style='border:1px solid #B91C1C;padding:" + tdPad + ";text-align:right'>" + (sub.fee ? "&#8377;" + Number(sub.fee).toLocaleString("en-IN") : "") + "</td></tr>";
              }).join("");
              const html = "<!DOCTYPE html><html><head><meta charset='utf-8'>"
                + "<style>"
                + "*{box-sizing:border-box;-webkit-print-color-adjust:exact!important;print-color-adjust:exact!important;color-adjust:exact!important;margin:0;padding:0;}"
                + "@page{size:" + pageSize + ";margin:" + mg + ";}"
                + "html,body{width:100%;background:#fff;font-family:Arial,sans-serif;font-size:" + fs + ";color:#333;}"
                + ".rc{width:100%;border:3px solid #B91C1C;border-radius:4px;}"
                + ".hd{text-align:center;padding:" + pad + ";border-bottom:2px solid #B91C1C;}"
                + ".hd-top{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:2px;}"
                + ".reg{font-size:" + (isS?"7px":"9px") + ";border:1px solid #333;padding:2px 6px;background:#FEF3C7;text-align:center;line-height:1.4;}"
                + ".ib{font-size:" + (isS?"7px":"9px") + ";border:1px solid #B91C1C;padding:2px 8px;background:#FEF2F2;color:#B91C1C;font-weight:700;}"
                + ".tit{font-size:" + titleFs + ";font-weight:900;color:#B91C1C;letter-spacing:2px;font-family:Impact,Arial,sans-serif;line-height:1.1;margin:2px 0;}"
                + ".addr{font-size:" + (isS?"9px":"12px") + ";font-weight:700;}"
                + ".ph{display:inline-block;background:#B91C1C;color:#fff;padding:2px 14px;border-radius:4px;font-size:" + (isS?"8px":"11px") + ";font-weight:700;margin-top:3px;}"
                + ".si{padding:" + pad + ";font-size:" + fs + ";}"
                + ".sr{display:flex;justify-content:space-between;margin-bottom:5px;}"
                + ".dv{border-bottom:1px dotted #999;display:inline-block;min-width:" + (isS?"100px":"200px") + ";}"
                + ".cr{display:flex;gap:16px;margin-bottom:4px;}"
                + ".pb{background:#F0FDF4;border-top:1px solid #86EFAC;border-bottom:1px solid #86EFAC;padding:" + (isS?"4px 10px":"6px 16px") + ";font-size:" + (isS?"8px":"10px") + ";display:flex;gap:16px;flex-wrap:wrap;}"
                + ".tw{padding:0 " + (isS?"10px":"16px") + " 10px;}"
                + "table{width:100%;border-collapse:collapse;border:2px solid #B91C1C;margin-top:8px;}"
                + "th,td{border:1px solid #B91C1C;}"
                + ".th{background:#FEF2F2;font-weight:700;text-align:left;padding:" + tdPad + ";}"
                + ".thr{text-align:right;}"
                + ".tot{background:#FEF2F2;}"
                + ".sg{padding:" + pad + ";display:flex;justify-content:space-between;align-items:flex-end;}"
                + "@media print{*{-webkit-print-color-adjust:exact!important;print-color-adjust:exact!important;}html,body{width:100%;}}"
                + "</style></head><body>"
                + "<div class='rc'>"
                + "<div class='hd'><div class='hd-top'>"
                + "<span style='font-size:" + (isS?"7px":"9px") + ";color:#555'>&#2346;&#2335;&#2375;&#2354; &#2358;&#2367;&#2325;&#2381;&#2359;&#2339; &#2319;&#2357;&#2306; &#2360;&#2375;&#2357;&#2366; &#2360;&#2350;&#2367;&#2340;&#2367; &#2342;&#2381;&#2357;&#2366;&#2352;&#2366; &#2360;&#2306;&#2330;&#2366;&#2354;&#2367;&#2340;...</span>"
                + "<div style='display:flex;gap:4px'><span class='ib'>" + instLabel + "</span><span class='reg'>&#2346;&#2306;&#2332;&#2368;&#2351;&#2344; &#2325;&#2381;&#2352;&#2350;&#2366;&#2306;&#2325;<br/><strong>122201880553</strong></span></div>"
                + "</div>"
                + "<div class='tit'>PATEL INSTITUTE</div>"
                + "<div class='addr'>Matiya Road, Near Saket Dham, Dongargaon</div>"
                + "<span class='ph'>Mo. 8319002877, 7470412110</span>"
                + "</div>"
                + "<div class='si'>"
                + "<div class='sr'><span><strong>S.No.:</strong> " + (st.formNo||"&mdash;") + "</span><span><strong>Date:</strong> " + receiptDate + "</span></div>"
                + "<div style='margin-bottom:4px'><strong>Student Name:</strong> <span class='dv'>" + (st.studentName||"") + "</span></div>"
                + "<div style='margin-bottom:4px'><strong>Father Name:</strong> <span class='dv'>" + (st.fatherName||"") + "</span></div>"
                + "<div style='margin-bottom:4px'><strong>Address:</strong> <span class='dv'>" + (st.permanentAddress||"") + "</span></div>"
                + "<div class='cr'><span><strong>Class:</strong> " + (st.class||"") + "</span><span><strong>Medium:</strong> " + (st.medium||"") + "</span><span><strong>Board:</strong> " + (st.board||"") + "</span></div>"
                + "</div>"
                + "<div class='pb'>"
                + "<span><strong>Mode:</strong> " + receiptMode + "</span>"
                + "<span><strong>Date:</strong> " + receiptDate + "</span>"
                + (total > 0 ? "<span><strong>Total:</strong> &#8377;" + total.toLocaleString("en-IN") + " | <strong>Due:</strong> <span style='color:" + (due>0?"#DC2626":"#16A34A") + "'>&#8377;" + due.toLocaleString("en-IN") + "</span></span>" : "")
                + "</div>"
                + "<div class='tw'><table>"
                + "<thead><tr><th class='th' style='width:35px'>S.N.</th><th class='th'>SUBJECT</th><th class='th thr' style='width:90px'>AMOUNT</th></tr></thead>"
                + "<tbody>" + subRows
                + "<tr class='tot'><td colspan='2' style='border:1px solid #B91C1C;padding:" + tdPad + ";font-weight:800;color:#B91C1C'>Total</td>"
                + "<td style='border:1px solid #B91C1C;padding:" + tdPad + ";text-align:right;font-weight:800;color:#B91C1C'>&#8377;" + displayTotal.toLocaleString("en-IN") + "</td></tr>"
                + "<tr><td colspan='3' style='border:1px solid #B91C1C;padding:" + tdPad + ";font-size:" + (isS?"8px":"11px") + "'><strong>In Words -</strong> " + numToWords(displayTotal) + " Rupees Only</td></tr>"
                + "</tbody></table></div>"
                + "<div class='sg'><span style='font-weight:700'>Signature</span>"
                + (due>0 ? "<span style='color:#DC2626;font-weight:700'>&#8377;" + due.toLocaleString("en-IN") + " Remaining Due</span>" : "<span style='color:#16A34A;font-weight:700'>Fully Paid</span>")
                + "</div></div></body></html>";
              const w = window.open("","_blank","width=800,height=900");
              w.document.write(html);
              w.document.close();
              setTimeout(function(){w.focus();w.print();},700);
            };
            return (
              <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.5)", zIndex: 9999, display: "flex", alignItems: "flex-start", justifyContent: "center", padding: 20, overflowY: "auto" }} onClick={() => { setShowReceipt(null); setFeePaymentForm({}); }}>
                <div style={{ background: "#F8FAFD", borderRadius: 16, padding: 24, maxWidth: 580, width: "100%", boxShadow: "0 20px 60px rgba(0,0,0,.2)", marginTop: 20 }} onClick={e => e.stopPropagation()}>

                  {/* Controls */}
                  <div style={{ marginBottom: 14 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                      <h3 style={{ fontSize: "1rem", fontWeight: 800, color: "#0B1826", margin: 0 }}><i className="fas fa-receipt" style={{ marginRight: 8, color: "#D98D04" }} />Fee Receipt</h3>
                      <button onClick={() => { setShowReceipt(null); setFeePaymentForm({}); }} style={{ background: "none", border: "none", fontSize: "1.1rem", cursor: "pointer", color: "#6B7F99" }}>✕</button>
                    </div>

                    {/* Installment selector */}
                    <div style={{ display: "flex", gap: 6, marginBottom: 10, flexWrap: "wrap", alignItems: "center" }}>
                      <span style={{ fontSize: ".75rem", fontWeight: 700, color: "#4A5E78" }}>Installment:</span>
                      {["all","1","2","3"].map(n => {
                        const hasAmt = n === "all" ? totalPaid > 0 : Number(st[`inst${n}Amount`] || 0) > 0;
                        if (n !== "all" && !hasAmt) return null;
                        return (
                          <button key={n} type="button"
                            onClick={() => setFeePaymentForm(prev => ({ ...prev, receiptInst: n }))}
                            style={{ padding: "5px 12px", borderRadius: 6, border: `1.5px solid ${selInst === n ? "#1349A8" : "#D4DEF0"}`, background: selInst === n ? "#EFF6FF" : "#fff", color: selInst === n ? "#1349A8" : "#6B7F99", fontSize: ".72rem", fontWeight: 700, cursor: "pointer" }}>
                            {n === "all" ? "All / Full" : `${n}${n==="1"?"st":n==="2"?"nd":"rd"} Inst — ₹${Number(st[`inst${n}Amount`]||0).toLocaleString("en-IN")}`}
                          </button>
                        );
                      })}
                    </div>

                    {/* Print size buttons */}
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                      <button onClick={() => printReceipt("small")} style={{ padding: "6px 12px", borderRadius: 6, border: "1px solid #D4DEF0", background: "#fff", color: "#4A5E78", fontSize: ".72rem", fontWeight: 600, cursor: "pointer" }}><i className="fas fa-print" style={{ marginRight: 4 }} />Small (80mm)</button>
                      <button onClick={() => printReceipt("medium")} style={{ padding: "6px 12px", borderRadius: 6, border: "1px solid #FDE68A", background: "#FFFBEB", color: "#92400E", fontSize: ".72rem", fontWeight: 600, cursor: "pointer" }}><i className="fas fa-print" style={{ marginRight: 4 }} />A5 Medium</button>
                      <button onClick={() => printReceipt("large")} style={{ padding: "6px 12px", borderRadius: 6, border: "1px solid #86EFAC", background: "#F0FDF4", color: "#059669", fontSize: ".72rem", fontWeight: 600, cursor: "pointer" }}><i className="fas fa-print" style={{ marginRight: 4 }} />A4 Full</button>
                    </div>
                  </div>

                  {/* ═══ RECEIPT PREVIEW ═══ */}
                  <div id="pid-receipt" style={{ background: "#fff", border: "3px solid #B91C1C", borderRadius: 4, fontFamily: "Arial, sans-serif", fontSize: "13px", color: "#333" }}>

                    {/* Header */}
                    <div style={{ textAlign: "center", padding: "10px 16px 8px", borderBottom: "2px solid #B91C1C" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 2 }}>
                        <div style={{ fontSize: ".6rem", color: "#555" }}>पटेल शिक्षण एवं सेवा समिति द्वारा संचालित...</div>
                        <div style={{ display: "flex", gap: 4 }}>
                          <div style={{ fontSize: ".62rem", border: "1px solid #B91C1C", padding: "1px 6px", background: "#FEF2F2", color: "#B91C1C", fontWeight: 700 }}>{instLabel}</div>
                          <div style={{ fontSize: ".6rem", border: "1px solid #333", padding: "1px 6px", background: "#FEF3C7", textAlign: "center" }}>पंजीयन क्रमांक<br/><strong>122201880553</strong></div>
                        </div>
                      </div>
                      <div style={{ fontSize: "1.6rem", fontWeight: 900, color: "#B91C1C", fontFamily: "Impact, sans-serif", letterSpacing: 2 }}>PATEL INSTITUTE</div>
                      <div style={{ fontSize: ".78rem", fontWeight: 700, color: "#333" }}>Matiya Road, Near Saket Dham, Dongargaon</div>
                      <div style={{ fontSize: ".72rem", fontWeight: 700, color: "#fff", background: "#B91C1C", display: "inline-block", padding: "2px 12px", borderRadius: 4, marginTop: 4 }}>Mo. 8319002877, 7470412110</div>
                    </div>

                    {/* Student Details */}
                    <div style={{ padding: "10px 16px 6px", fontSize: ".78rem" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5 }}>
                        <span><strong>S.No.:</strong> {st.formNo || "—"}</span>
                        <span><strong>Date:</strong> {receiptDate}</span>
                      </div>
                      <div style={{ marginBottom: 4 }}><strong>Student Name:</strong> <span style={{ borderBottom: "1px dotted #999", paddingBottom: 1, minWidth: 200, display: "inline-block" }}>{st.studentName || ""}</span></div>
                      <div style={{ marginBottom: 4 }}><strong>Father Name:</strong> <span style={{ borderBottom: "1px dotted #999", paddingBottom: 1, minWidth: 200, display: "inline-block" }}>{st.fatherName || ""}</span></div>
                      <div style={{ marginBottom: 4 }}><strong>Address:</strong> <span style={{ borderBottom: "1px dotted #999", paddingBottom: 1, minWidth: 200, display: "inline-block" }}>{st.permanentAddress || ""}</span></div>
                      <div style={{ display: "flex", gap: 16, marginBottom: 4 }}>
                        <span><strong>Class:</strong> <span style={{ borderBottom: "1px dotted #999" }}>{st.class || ""}</span></span>
                        <span><strong>Medium:</strong> <span style={{ borderBottom: "1px dotted #999" }}>{st.medium || ""}</span></span>
                        <span><strong>Board:</strong> <span style={{ borderBottom: "1px dotted #999" }}>{st.board || ""}</span></span>
                      </div>
                    </div>

                    {/* Payment Info Bar */}
                    <div style={{ background: "#F0FDF4", borderTop: "1px solid #86EFAC", borderBottom: "1px solid #86EFAC", padding: "6px 16px", fontSize: ".72rem", display: "flex", gap: 16, flexWrap: "wrap" }}>
                      <span>💳 <strong>Mode:</strong> {receiptMode}</span>
                      <span>📅 <strong>Date:</strong> {receiptDate}</span>
                      {selInst !== "all" && getInstNote(selInst) && <span>📝 {getInstNote(selInst)}</span>}
                      {total > 0 && <span>💰 <strong>Total Fee:</strong> ₹{total.toLocaleString("en-IN")} | <strong>Due:</strong> <span style={{ color: due > 0 ? "#DC2626" : "#16A34A" }}>₹{due.toLocaleString("en-IN")}</span></span>}
                    </div>

                    {/* Subject Fee Table */}
                    <div style={{ padding: "0 16px 10px" }}>
                      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: ".78rem", border: "2px solid #B91C1C", marginTop: 10 }}>
                        <thead>
                          <tr style={{ background: "#FEF2F2" }}>
                            <th style={{ border: "1px solid #B91C1C", padding: "6px 10px", textAlign: "left", fontWeight: 700, width: 35 }}>S.N.</th>
                            <th style={{ border: "1px solid #B91C1C", padding: "6px 10px", textAlign: "left", fontWeight: 700 }}>SUBJECT</th>
                            <th style={{ border: "1px solid #B91C1C", padding: "6px 10px", textAlign: "right", fontWeight: 700, width: 90 }}>AMOUNT</th>
                          </tr>
                        </thead>
                        <tbody>
                          {subjects.map((sub, i) => (
                            <tr key={i}>
                              <td style={{ border: "1px solid #B91C1C", padding: "5px 10px", fontWeight: 700 }}>{i+1}.</td>
                              <td style={{ border: "1px solid #B91C1C", padding: "5px 10px", fontWeight: 700 }}>{sub.name.toUpperCase()}</td>
                              <td style={{ border: "1px solid #B91C1C", padding: "5px 10px", textAlign: "right" }}>{sub.fee ? `₹${Number(sub.fee).toLocaleString("en-IN")}` : ""}</td>
                            </tr>
                          ))}
                          <tr style={{ background: "#FEF2F2" }}>
                            <td colSpan={2} style={{ border: "1px solid #B91C1C", padding: "6px 10px", fontWeight: 800, color: "#B91C1C" }}>Total</td>
                            <td style={{ border: "1px solid #B91C1C", padding: "6px 10px", textAlign: "right", fontWeight: 800, color: "#B91C1C" }}>₹{displayTotal.toLocaleString("en-IN")}</td>
                          </tr>
                          <tr>
                            <td colSpan={3} style={{ border: "1px solid #B91C1C", padding: "6px 10px", fontSize: ".72rem" }}><strong>In Words -</strong> {numToWords(displayTotal)} Rupees Only</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>

                    {/* Signature + Due */}
                    <div style={{ padding: "12px 16px 14px", display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
                      <div style={{ fontSize: ".78rem", fontWeight: 700 }}>Signature</div>
                      {due > 0
                        ? <div style={{ fontSize: ".72rem", color: "#DC2626", fontWeight: 700 }}>Remaining Due: ₹{due.toLocaleString("en-IN")}</div>
                        : <div style={{ fontSize: ".72rem", color: "#16A34A", fontWeight: 700 }}>✓ Fully Paid</div>}
                    </div>
                  </div>

                  {/* Close Button */}
                  <div style={{ textAlign: "center", marginTop: 16 }}>
                    <button onClick={() => { setShowReceipt(null); setFeePaymentForm({}); }} style={{ padding: "10px 28px", borderRadius: 8, border: "none", background: "#1349A8", color: "#fff", fontSize: ".82rem", fontWeight: 700, cursor: "pointer" }}>Close Receipt</button>
                  </div>
                </div>
              </div>
            );
          })()}
        </>}

      </div>
    </div>
  );
}