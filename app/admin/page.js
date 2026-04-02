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
  const [manualAttModal, setManualAttModal] = useState(null); // student object for manual marking
  const [manualAttType, setManualAttType] = useState("present");

  // Holidays & Notifications states
  const [holidays, setHolidays] = useState([]);
  const [holidayForm, setHolidayForm] = useState({});
  const [showHolidayForm, setShowHolidayForm] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [notifForm, setNotifForm] = useState({});
  const [showNotifForm, setShowNotifForm] = useState(false);
  const [calMonth, setCalMonth] = useState(new Date().getMonth());
  const [calYear, setCalYear] = useState(new Date().getFullYear());

  // Fees states
  const [feeClassFilter, setFeeClassFilter] = useState("all");
  const [feeSearch, setFeeSearch] = useState("");
  const [feePaymentForm, setFeePaymentForm] = useState({});
  const [showFeePayment, setShowFeePayment] = useState(null); // student id

  // Form states
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState(null);
  const [form, setForm] = useState({});
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");

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
    return () => unsubs.forEach(u => u());
  }, [isAdmin]);

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

  function showMsg(t) { setMsg(t); setTimeout(() => setMsg(""), 3000); }
  function resetForm() { setShowForm(false); setEditId(null); setForm({}); }

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
    if (!holidayForm.date) { showMsg("Date is required!"); return; }
    if (!holidayForm.title?.trim()) { showMsg("Holiday title is required!"); return; }
    setSaving(true);
    try {
      const data = { ...holidayForm };
      Object.keys(data).forEach(key => { if (data[key] === undefined) delete data[key]; });
      if (holidayForm.editId) {
        const { editId: eid, ...rest } = data;
        await updateDoc(doc(db, "holidays", eid), { ...rest, updatedAt: serverTimestamp() });
        showMsg("Holiday updated!");
      } else {
        await addDoc(collection(db, "holidays"), { ...data, createdAt: serverTimestamp() });
        showMsg("Holiday added!");
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
        showMsg("Notification updated!");
      } else {
        await addDoc(collection(db, "scheduled_notifications"), { ...data, createdAt: serverTimestamp() });
        showMsg("Notification scheduled!");
      }
      setShowNotifForm(false); setNotifForm({});
    } catch (e) { showMsg("Error: " + e.message); }
    setSaving(false);
  }
  async function deleteNotification(id) {
    if (!confirm("Delete this notification?")) return;
    try { await deleteDoc(doc(db, "scheduled_notifications", id)); showMsg("Notification deleted!"); } catch (e) { showMsg("Error!"); }
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

  // Mark absent for student
  async function markAbsent(student) {
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
        markedBy: user?.email || "admin",
        createdAt: serverTimestamp(),
      };
      await addDoc(collection(db, "attendance"), record);
      showMsg(`${student.studentName} marked Absent`);
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
  function isHoliday(dateStr) {
    return holidays.some(h => h.date === dateStr);
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
  // STYLES
  // ═══════════════════════════════════════════
  const s = {
    page: { fontFamily: "'DM Sans',sans-serif", background: "#F0F4FA", minHeight: "100vh" },
    sidebar: { width: 230, background: "#0C1F36", color: "#fff", position: "fixed", top: 0, left: 0, bottom: 0, padding: "20px 0", overflowY: "auto", zIndex: 100, transition: "transform .3s" },
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
    { id: "holidays", icon: "fa-calendar-check", label: "Holidays & Schedule" },
    { id: "fees", icon: "fa-rupee-sign", label: "Fee Management" },
    { id: "settings", icon: "fa-cog", label: "Website Settings" },
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
          <button key={t.id} onClick={() => { setTab(t.id); resetForm(); }} style={s.tabBtn(tab === t.id)}>
            <i className={`fas ${t.icon}`} style={{ width: 16, fontSize: ".8rem" }} />{t.label}
            {t.id === "reviews" && pendingReviews.length > 0 && <span style={{ marginLeft: "auto", background: "#DC2626", color: "#fff", fontSize: ".6rem", padding: "2px 6px", borderRadius: 99 }}>{pendingReviews.length}</span>}
            {t.id === "enquiries" && activeEnquiries.length > 0 && <span style={{ marginLeft: "auto", background: "#1349A8", color: "#fff", fontSize: ".6rem", padding: "2px 6px", borderRadius: 99 }}>{activeEnquiries.length}</span>}
            {t.id === "students" && students.length > 0 && <span style={{ marginLeft: "auto", background: "#059669", color: "#fff", fontSize: ".6rem", padding: "2px 6px", borderRadius: 99 }}>{students.length}</span>}
            {t.id === "materials" && materials.length > 0 && <span style={{ marginLeft: "auto", background: "#0891B2", color: "#fff", fontSize: ".6rem", padding: "2px 6px", borderRadius: 99 }}>{materials.length}</span>}
            {t.id === "attendance" && attendance.length > 0 && <span style={{ marginLeft: "auto", background: "#E11D48", color: "#fff", fontSize: ".6rem", padding: "2px 6px", borderRadius: 99 }}>{attendance.length}</span>}
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
              { n: courses.length, l: "Courses", c: "#1349A8", icon: "fa-book" },
              { n: toppers.length, l: "Featured Toppers", c: "#D98D04", icon: "fa-trophy" },
              { n: events.length, l: "Events", c: "#7C3AED", icon: "fa-calendar" },
              { n: teachers.length, l: "Teachers", c: "#059669", icon: "fa-chalkboard-teacher" },
              { n: pendingReviews.length, l: "Pending Reviews", c: "#DC2626", icon: "fa-clock" },
              { n: approvedReviews.length, l: "Approved Reviews", c: "#16A34A", icon: "fa-check" },
              { n: activeEnquiries.length, l: "Active Enquiries", c: "#1349A8", icon: "fa-envelope" },
              { n: students.filter(s => s.status === "active").length, l: "Active Students", c: "#059669", icon: "fa-user-graduate" },
              { n: materials.length, l: "Study Materials", c: "#0891B2", icon: "fa-folder-open" },
              { n: attendance.length, l: "Today's Attendance", c: "#E11D48", icon: "fa-id-card-alt" },
            ].map((x, i) => (
              <div key={i} style={s.stat} onClick={() => { if (x.l.includes("Enquir")) setTab("enquiries"); else if (x.l.includes("Review")) setTab("reviews"); else if (x.l.includes("Course")) setTab("courses"); }} className={x.l.includes("Enquir") || x.l.includes("Review") || x.l.includes("Course") ? "clickable" : ""}>
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
                </div>
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
                <label style={s.label}>Enrollment Fee Paid (₹)</label>
                <input style={s.input} type="number" placeholder="e.g. 5000" value={form.enrollmentFeePaid || ""} onChange={e => setForm({ ...form, enrollmentFeePaid: e.target.value })} />
              </div>
              <div>
                <label style={s.label}>Remaining Fee</label>
                <div style={{ padding: "9px 12px", borderRadius: 8, background: form.totalFee && form.enrollmentFeePaid ? ((Number(form.totalFee) - Number(form.enrollmentFeePaid)) > 0 ? "#FEF2F2" : "#F0FDF4") : "#F8FAFD", border: "1px solid #D4DEF0", fontSize: ".85rem", fontWeight: 700, color: form.totalFee && form.enrollmentFeePaid ? ((Number(form.totalFee) - Number(form.enrollmentFeePaid)) > 0 ? "#DC2626" : "#16A34A") : "#6B7F99", minHeight: 38, display: "flex", alignItems: "center" }}>
                  {form.totalFee && form.enrollmentFeePaid ? `₹${Math.max(0, Number(form.totalFee) - Number(form.enrollmentFeePaid)).toLocaleString("en-IN")}` : "—"}
                </div>
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
                    {st.totalFee && <span style={{ color: (Number(st.totalFee) - Number(st.enrollmentFeePaid || 0)) > 0 ? "#DC2626" : "#16A34A", fontWeight: 600 }}>
                      <i className="fas fa-rupee-sign" style={{ marginRight: 3 }} />
                      Due: ₹{Math.max(0, Number(st.totalFee) - Number(st.enrollmentFeePaid || 0)).toLocaleString("en-IN")}
                    </span>}
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
              {["12th", "11th", "10th", "9th", "8th", "7th", "6th", "5th", "4th", "3rd", "2nd"].map(c => <option key={c} value={c}>Class {c}</option>)}
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

            {/* Register Format Table */}
            <div style={{ ...s.card, padding: 0, overflow: "auto" }}>
              <div style={{ padding: "14px 18px", borderBottom: "2px solid #E2EAF4", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <h3 style={{ fontSize: ".95rem", fontWeight: 700, color: "#0B1826", margin: 0 }}>
                  <i className="fas fa-book-open" style={{ marginRight: 8, color: "#1349A8" }} />
                  Attendance Register — {attViewMode === "daily" ? attDate : attViewMode === "weekly" ? "This Week" : "This Month"}
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
                    if (attClassFilter !== "all") stList = stList.filter(x => x.class === attClassFilter);
                    if (attSearch.trim()) {
                      const q = attSearch.toLowerCase();
                      stList = stList.filter(x => x.studentName?.toLowerCase().includes(q) || x.rfidCode?.toLowerCase().includes(q));
                    }
                    // Check batch validity for each student
                    const today = attDate;
                    stList = stList.filter(st => {
                      if (!st.batchStartDate || !st.batchEndDate) return true; // no batch dates = show always
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
                            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                              <div style={{ width: 32, height: 32, borderRadius: 8, overflow: "hidden", flexShrink: 0, background: "linear-gradient(135deg,#1349A8,#2A6FE0)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                                {st.photo && st.photo.startsWith("http") ? <img src={st.photo} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : <span style={{ color: "#fff", fontWeight: 700, fontSize: ".7rem" }}>{st.studentName?.charAt(0)}</span>}
                              </div>
                              <span style={{ fontWeight: 600, fontSize: ".82rem" }}>{st.studentName}</span>
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
                            {isHol ? <span style={s.badge("#D98D04", "#FEF3C7")}>Holiday</span>
                              : isPresent ? <span style={s.badge("#16A34A", "#F0FDF4")}>P</span>
                              : isAbsentManual ? <span style={s.badge("#DC2626", "#FEF2F2")}>A</span>
                              : <span style={s.badge("#6B7F99", "#F0F4FA")}>—</span>}
                          </td>
                          <td style={{ padding: "10px 14px", textAlign: "center" }}>
                            {!isPresent && !isAbsentManual && !isHol && (
                              <div style={{ display: "flex", gap: 4, justifyContent: "center" }}>
                                <button onClick={() => markManualAttendance(st, "in")} style={{ padding: "4px 10px", borderRadius: 6, border: "1px solid #86EFAC", background: "#F0FDF4", color: "#16A34A", fontSize: ".68rem", fontWeight: 700, cursor: "pointer" }} title="Mark Present">
                                  <i className="fas fa-check" style={{ marginRight: 3 }} />P
                                </button>
                                <button onClick={() => markAbsent(st)} style={{ padding: "4px 10px", borderRadius: 6, border: "1px solid #FCA5A5", background: "#FEF2F2", color: "#DC2626", fontSize: ".68rem", fontWeight: 700, cursor: "pointer" }} title="Mark Absent">
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
              <div style={{ padding: "14px 18px", borderBottom: "2px solid #E2EAF4" }}>
                <h3 style={{ fontSize: ".95rem", fontWeight: 700, color: "#0B1826", margin: 0 }}>
                  <i className="fas fa-chalkboard-teacher" style={{ marginRight: 8, color: "#059669" }} />
                  Teacher Attendance — {attDate}
                </h3>
              </div>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: ".82rem" }}>
                <thead>
                  <tr style={{ background: "#F0F4FA" }}>
                    <th style={{ padding: "10px 14px", textAlign: "left", fontWeight: 700, borderBottom: "2px solid #D4DEF0" }}>#</th>
                    <th style={{ padding: "10px 14px", textAlign: "left", fontWeight: 700, borderBottom: "2px solid #D4DEF0" }}>Teacher Name</th>
                    <th style={{ padding: "10px 14px", textAlign: "center", fontWeight: 700, borderBottom: "2px solid #D4DEF0" }}>Subject</th>
                    <th style={{ padding: "10px 14px", textAlign: "center", fontWeight: 700, borderBottom: "2px solid #D4DEF0" }}>Status</th>
                    <th style={{ padding: "10px 14px", textAlign: "center", fontWeight: 700, borderBottom: "2px solid #D4DEF0" }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {teachers.length > 0 ? teachers.map((t, idx) => {
                    const tAtt = attendance.filter(a => a.rfidCode === `TEACHER_${t.id}` || (a.studentId === `teacher_${t.id}`));
                    const tPresent = tAtt.length > 0;
                    const isHol = isHoliday(attDate);
                    return (
                      <tr key={t.id} style={{ borderBottom: "1px solid #E8EFF8", background: idx % 2 === 0 ? "#fff" : "#FAFCFE" }}>
                        <td style={{ padding: "10px 14px", fontWeight: 600, color: "#6B7F99" }}>{idx + 1}</td>
                        <td style={{ padding: "10px 14px" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            <div style={{ width: 32, height: 32, borderRadius: 8, overflow: "hidden", background: "linear-gradient(135deg,#059669,#34D399)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                              {t.photo && t.photo.startsWith("http") ? <img src={t.photo} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : <span style={{ color: "#fff", fontWeight: 700, fontSize: ".7rem" }}>{t.name?.charAt(0)}</span>}
                            </div>
                            <div>
                              <div style={{ fontWeight: 600 }}>{t.name}</div>
                              {t.isDirector && <span style={{ fontSize: ".62rem", color: "#D98D04", fontWeight: 700 }}>DIRECTOR</span>}
                            </div>
                          </div>
                        </td>
                        <td style={{ padding: "10px 14px", textAlign: "center" }}><span style={s.badge("#7C3AED", "#FAF5FF")}>{t.subject}</span></td>
                        <td style={{ padding: "10px 14px", textAlign: "center" }}>
                          {isHol ? <span style={s.badge("#D98D04", "#FEF3C7")}>Holiday</span>
                            : tPresent ? <span style={s.badge("#16A34A", "#F0FDF4")}>Present</span>
                            : <span style={s.badge("#6B7F99", "#F0F4FA")}>—</span>}
                        </td>
                        <td style={{ padding: "10px 14px", textAlign: "center" }}>
                          {!tPresent && !isHol && (
                            <div style={{ display: "flex", gap: 4, justifyContent: "center" }}>
                              <button onClick={async () => {
                                try {
                                  await addDoc(collection(db, "attendance"), {
                                    rfidCode: `TEACHER_${t.id}`, type: "in", studentId: `teacher_${t.id}`,
                                    studentName: t.name, studentClass: "Teacher", studentPhoto: t.photo || "",
                                    deviceId: "manual-admin", date: attDate, timestamp: new Date().toISOString(),
                                    manual: true, isTeacher: true, markedBy: user?.email, createdAt: serverTimestamp(),
                                  });
                                  showMsg(`${t.name} marked Present`);
                                } catch (e) { showMsg("Error: " + e.message); }
                              }} style={{ padding: "4px 12px", borderRadius: 6, border: "1px solid #86EFAC", background: "#F0FDF4", color: "#16A34A", fontSize: ".7rem", fontWeight: 700, cursor: "pointer" }}>
                                <i className="fas fa-check" style={{ marginRight: 3 }} />Present
                              </button>
                              <button onClick={async () => {
                                try {
                                  await addDoc(collection(db, "attendance"), {
                                    rfidCode: `TEACHER_${t.id}`, type: "absent", studentId: `teacher_${t.id}`,
                                    studentName: t.name, studentClass: "Teacher", studentPhoto: t.photo || "",
                                    deviceId: "manual-admin", date: attDate, timestamp: new Date().toISOString(),
                                    manual: true, isTeacher: true, markedBy: user?.email, createdAt: serverTimestamp(),
                                  });
                                  showMsg(`${t.name} marked Absent`);
                                } catch (e) { showMsg("Error: " + e.message); }
                              }} style={{ padding: "4px 12px", borderRadius: 6, border: "1px solid #FCA5A5", background: "#FEF2F2", color: "#DC2626", fontSize: ".7rem", fontWeight: 700, cursor: "pointer" }}>
                                <i className="fas fa-times" style={{ marginRight: 3 }} />Absent
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  }) : (
                    <tr><td colSpan={5} style={{ padding: 40, textAlign: "center", color: "#6B7F99" }}>
                      Teachers tab me pehle teachers add karo
                    </td></tr>
                  )}
                </tbody>
              </table>
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
              <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr 1fr", gap: 10 }}>
                <div><label style={s.label}>Date *</label><input style={s.input} type="date" value={holidayForm.date || ""} onChange={e => setHolidayForm({ ...holidayForm, date: e.target.value })} /></div>
                <div><label style={s.label}>Holiday Title *</label><input style={s.input} placeholder="e.g. Republic Day, Holi" value={holidayForm.title || ""} onChange={e => setHolidayForm({ ...holidayForm, title: e.target.value })} /></div>
                <div><label style={s.label}>Type</label>
                  <select style={s.input} value={holidayForm.type || ""} onChange={e => setHolidayForm({ ...holidayForm, type: e.target.value })}>
                    <option value="">Select</option><option>National Holiday</option><option>Festival</option><option>Institute Holiday</option><option>Exam Break</option><option>Other</option>
                  </select>
                </div>
              </div>
              <div><label style={s.label}>Description (optional)</label><input style={s.input} placeholder="Any additional details..." value={holidayForm.description || ""} onChange={e => setHolidayForm({ ...holidayForm, description: e.target.value })} /></div>
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
                <div><label style={s.label}>Send To</label>
                  <select style={s.input} value={notifForm.target || "all"} onChange={e => setNotifForm({ ...notifForm, target: e.target.value })}>
                    <option value="all">All Students & Parents</option><option value="students">Students Only</option><option value="parents">Parents Only</option>
                    <option value="12th">Class 12 Only</option><option value="11th">Class 11 Only</option><option value="10th">Class 10 Only</option><option value="9th">Class 9 Only</option>
                  </select>
                </div>
              </div>
              <div><label style={s.label}>Notification Type</label>
                <select style={s.input} value={notifForm.notifType || ""} onChange={e => setNotifForm({ ...notifForm, notifType: e.target.value })}>
                  <option value="">Select Type</option><option value="test">Test / Exam</option><option value="holiday">Holiday Notice</option><option value="fee">Fee Reminder</option><option value="event">Event</option><option value="general">General</option>
                </select>
              </div>
              <div><label style={s.label}>Message *</label><textarea style={{ ...s.input, height: 80, resize: "none" }} placeholder="e.g. Kal 10th class ka Science test hai 10:00 AM se..." value={notifForm.message || ""} onChange={e => setNotifForm({ ...notifForm, message: e.target.value })} /></div>
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
                  <div style={{ fontSize: ".72rem", color: "#6B7F99" }}>{h.type || ""} {h.description ? `· ${h.description}` : ""}</div>
                </div>
                <div style={{ display: "flex", gap: 4 }}>
                  <button onClick={() => { setShowHolidayForm(true); setHolidayForm({ ...h, editId: h.id }); }} style={s.btnO}><i className="fas fa-edit" /></button>
                  <button onClick={() => deleteHoliday(h.id)} style={s.btnD}><i className="fas fa-trash" /></button>
                </div>
              </div>
            )) : <p style={{ fontSize: ".84rem", color: "#6B7F99" }}>Koi holiday add nahi hua abhi tak. Calendar me click karo ya "Add Holiday" button use karo.</p>}
          </div>

          {/* Notification List */}
          <div style={{ ...s.card }}>
            <h3 style={{ fontSize: ".95rem", fontWeight: 700, marginBottom: 12 }}><i className="fas fa-bell" style={{ marginRight: 6, color: "#D98D04" }} />Scheduled Notifications ({notifications.length})</h3>
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
            )) : <p style={{ fontSize: ".84rem", color: "#6B7F99" }}>Koi notification scheduled nahi hai. "Schedule Notification" button use karo.</p>}
          </div>
        </>}

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
              const totalFees = students.reduce((sum, st) => sum + Number(st.totalFee || 0), 0);
              const totalPaid = students.reduce((sum, st) => sum + Number(st.enrollmentFeePaid || 0), 0);
              const totalDue = totalFees - totalPaid;
              const fullyPaid = students.filter(st => st.totalFee && Number(st.enrollmentFeePaid || 0) >= Number(st.totalFee)).length;
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
              {["12th", "11th", "10th", "9th", "8th", "7th", "6th", "5th", "4th", "3rd", "2nd"].map(c => <option key={c} value={c}>Class {c}</option>)}
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
                  <th style={{ padding: "10px 14px", textAlign: "center", fontWeight: 700, color: "#16A34A", borderBottom: "2px solid #D4DEF0" }}>Paid</th>
                  <th style={{ padding: "10px 14px", textAlign: "center", fontWeight: 700, color: "#DC2626", borderBottom: "2px solid #D4DEF0" }}>Due</th>
                  <th style={{ padding: "10px 14px", textAlign: "center", fontWeight: 700, borderBottom: "2px solid #D4DEF0" }}>Status</th>
                  <th style={{ padding: "10px 14px", textAlign: "center", fontWeight: 700, borderBottom: "2px solid #D4DEF0" }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {(() => {
                  let feeList = students.filter(x => x.status === "active");
                  if (feeClassFilter !== "all") feeList = feeList.filter(x => x.class === feeClassFilter);
                  if (feeSearch.trim()) { const q = feeSearch.toLowerCase(); feeList = feeList.filter(x => x.studentName?.toLowerCase().includes(q)); }

                  if (feeList.length === 0) return <tr><td colSpan={8} style={{ padding: 40, textAlign: "center", color: "#6B7F99" }}>No students found</td></tr>;

                  return feeList.map((st, idx) => {
                    const total = Number(st.totalFee || 0);
                    const paid = Number(st.enrollmentFeePaid || 0);
                    const due = Math.max(0, total - paid);
                    const isFullyPaid = total > 0 && paid >= total;
                    return (
                      <tr key={st.id} style={{ borderBottom: "1px solid #E8EFF8", background: idx % 2 === 0 ? "#fff" : "#FAFCFE" }}>
                        <td style={{ padding: "10px 14px", color: "#6B7F99", fontWeight: 600 }}>{idx + 1}</td>
                        <td style={{ padding: "10px 14px" }}>
                          <div style={{ fontWeight: 600 }}>{st.studentName}</div>
                          <div style={{ fontSize: ".7rem", color: "#6B7F99" }}>{st.studentPhone}</div>
                        </td>
                        <td style={{ padding: "10px 14px", textAlign: "center" }}><span style={s.badge("#1349A8", "#EFF6FF")}>{st.class}</span></td>
                        <td style={{ padding: "10px 14px", textAlign: "center", fontWeight: 600 }}>{total > 0 ? `₹${total.toLocaleString("en-IN")}` : "—"}</td>
                        <td style={{ padding: "10px 14px", textAlign: "center", fontWeight: 700, color: "#16A34A" }}>{paid > 0 ? `₹${paid.toLocaleString("en-IN")}` : "—"}</td>
                        <td style={{ padding: "10px 14px", textAlign: "center", fontWeight: 700, color: due > 0 ? "#DC2626" : "#16A34A" }}>{total > 0 ? `₹${due.toLocaleString("en-IN")}` : "—"}</td>
                        <td style={{ padding: "10px 14px", textAlign: "center" }}>
                          {total === 0 ? <span style={s.badge("#6B7F99", "#F0F4FA")}>No Fee</span>
                            : isFullyPaid ? <span style={s.badge("#16A34A", "#F0FDF4")}>Paid</span>
                            : <span style={s.badge("#DC2626", "#FEF2F2")}>Due</span>}
                        </td>
                        <td style={{ padding: "10px 14px", textAlign: "center" }}>
                          <div style={{ display: "flex", gap: 4, justifyContent: "center" }}>
                            {!isFullyPaid && total > 0 && (
                              <button onClick={() => { setShowFeePayment(st.id); setFeePaymentForm({ date: new Date().toISOString().split("T")[0] }); }} style={{ padding: "4px 12px", borderRadius: 6, border: "1px solid #86EFAC", background: "#F0FDF4", color: "#16A34A", fontSize: ".7rem", fontWeight: 700, cursor: "pointer" }}>
                                <i className="fas fa-plus" style={{ marginRight: 3 }} />Pay
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

          {/* Fee Payment Modal */}
          {showFeePayment && (() => {
            const st = students.find(x => x.id === showFeePayment);
            if (!st) return null;
            const due = Math.max(0, Number(st.totalFee || 0) - Number(st.enrollmentFeePaid || 0));
            return (
              <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.4)", zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }} onClick={() => setShowFeePayment(null)}>
                <div style={{ background: "#fff", borderRadius: 16, padding: 28, maxWidth: 420, width: "100%", boxShadow: "0 20px 60px rgba(0,0,0,.15)" }} onClick={e => e.stopPropagation()}>
                  <h3 style={{ fontSize: "1.05rem", fontWeight: 800, marginBottom: 4 }}>Record Fee Payment</h3>
                  <p style={{ fontSize: ".82rem", color: "#6B7F99", marginBottom: 16 }}>{st.studentName} · Class {st.class} · Due: <strong style={{ color: "#DC2626" }}>₹{due.toLocaleString("en-IN")}</strong></p>
                  <div><label style={s.label}>Amount (₹) *</label><input style={s.input} type="number" placeholder={`Max: ${due}`} value={feePaymentForm.amount || ""} onChange={e => setFeePaymentForm({ ...feePaymentForm, amount: e.target.value })} /></div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                    <div><label style={s.label}>Payment Mode</label>
                      <select style={s.input} value={feePaymentForm.paymentMode || "cash"} onChange={e => setFeePaymentForm({ ...feePaymentForm, paymentMode: e.target.value })}>
                        <option value="cash">Cash</option><option value="upi">UPI</option><option value="bank">Bank Transfer</option><option value="other">Other</option>
                      </select>
                    </div>
                    <div><label style={s.label}>Date</label><input style={s.input} type="date" value={feePaymentForm.date || ""} onChange={e => setFeePaymentForm({ ...feePaymentForm, date: e.target.value })} /></div>
                  </div>
                  <div><label style={s.label}>Note (optional)</label><input style={s.input} placeholder="e.g. 2nd installment" value={feePaymentForm.note || ""} onChange={e => setFeePaymentForm({ ...feePaymentForm, note: e.target.value })} /></div>
                  <div style={{ display: "flex", gap: 10 }}>
                    <button onClick={() => addFeePayment(showFeePayment)} disabled={saving} style={{ ...s.btnP, flex: 1 }}>
                      <i className="fas fa-check" style={{ marginRight: 6 }} />{saving ? "Saving..." : "Record Payment"}
                    </button>
                    <button onClick={() => setShowFeePayment(null)} style={s.btnGray}>Cancel</button>
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
              • Due amount auto-calculate hota hai<br />
              • Fee payments history "fee_payments" collection me save hoti hai
            </div>
          </div>
        </>}

      </div>
    </div>
  );
}