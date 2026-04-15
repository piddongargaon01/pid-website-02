"use client";
import { useState, useEffect, useRef } from "react";
import { db, auth, googleProvider } from "../firebase";
import { collection, query, where, onSnapshot, addDoc, updateDoc, doc, deleteDoc, serverTimestamp } from "firebase/firestore";
import { signInWithPopup, onAuthStateChanged, signOut } from "firebase/auth";
import { GoogleGenerativeAI } from "@google/generative-ai";

// ═══════════════════════════════════════════
// HELPER COMPONENTS
// ═══════════════════════════════════════════
const I = ({ n, s = 16, c = "currentColor", cls = "", style = {} }) => (
  <i className={`fas fa-${n} ${cls}`} style={{ fontSize: s, color: c, ...style }} />
);

const Ring = ({ val, sz = 72, sw = 6, c = "#D4A843", bg = "rgba(0,0,0,0.08)" }) => {
  const r = (sz - sw) / 2, ci = 2 * Math.PI * r, off = ci - (val / 100) * ci;
  return (
    <svg width={sz} height={sz} style={{ transform: "rotate(-90deg)" }}>
      <circle cx={sz / 2} cy={sz / 2} r={r} fill="none" stroke={bg} strokeWidth={sw} />
      <circle cx={sz / 2} cy={sz / 2} r={r} fill="none" stroke={c} strokeWidth={sw}
        strokeDasharray={ci} strokeDashoffset={off} strokeLinecap="round"
        style={{ transition: "stroke-dashoffset 1s ease-out" }} />
    </svg>
  );
};

// ═══════════════════════════════════════════
// MAIN APP COMPONENT
// ═══════════════════════════════════════════
export default function StudentApp() {
  // ── Auth & User State ──
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [student, setStudent] = useState(null);
  const [studentLoading, setStudentLoading] = useState(false);
  const [loginRole, setLoginRole] = useState(null); // "student" | "teacher" | null
  // ── Teacher State ──
  const [teacher, setTeacher] = useState(null);
  const [teacherLoading, setTeacherLoading] = useState(false);
  const [teacherTab, setTeacherTab] = useState("students");
  const [tStudents, setTStudents] = useState([]);
  const [tAttendance, setTAttendance] = useState([]);
  const [tExamMarks, setTExamMarks] = useState([]);
  const [tQuizHistory, setTQuizHistory] = useState([]);
  const [tNotifications, setTNotifications] = useState([]);
  const [leaveFrom, setLeaveFrom] = useState("");
  const [leaveTo, setLeaveTo] = useState("");
  const [leaveReason, setLeaveReason] = useState("");
  const [leaveSubmitting, setLeaveSubmitting] = useState(false);
  const [myLeaves, setMyLeaves] = useState([]);
  const [tSelectedStudent, setTSelectedStudent] = useState(null);
  const [tSelectedClass, setTSelectedClass] = useState("all");
  const [tNotifClass, setTNotifClass] = useState("all");
  const [tNotifMsg, setTNotifMsg] = useState("");
  const [tNotifType, setTNotifType] = useState("general");
  const [editingLeave, setEditingLeave] = useState(null); // { id, fromDate, toDate, reason }
  const [editLeaveFrom, setEditLeaveFrom] = useState("");
  const [editLeaveTo, setEditLeaveTo] = useState("");
  const [editLeaveReason, setEditLeaveReason] = useState("");
  const [editLeaveSubmitting, setEditLeaveSubmitting] = useState(false);

  // ── App Navigation ──
  const [activeTab, setActiveTab] = useState("dashboard");
  const [aiSubTab, setAiSubTab] = useState("doubt");
  const [dark, setDark] = useState(false);
  const [exploreExpanded, setExploreExpanded] = useState(null);
  const [enrollContact, setEnrollContact] = useState(null);
  const [exploreDetailCourse, setExploreDetailCourse] = useState(null);
  const [answerLang, setAnswerLang] = useState("hinglish");

  // ── Global Data ──
  const [courses, setCourses] = useState([]);
  const [materials, setMaterials] = useState([]);
  const [attendance, setAttendance] = useState([]);
  const [allAttendance, setAllAttendance] = useState([]);
  const [quizHistory, setQuizHistory] = useState([]);
  const [tests, setTests] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [activeTest, setActiveTest] = useState(null);
  const [testPhase, setTestPhase] = useState("idle");
  const [testAnswers, setTestAnswers] = useState({});
  const [currentQIdx, setCurrentQIdx] = useState(0);
  const [testTimeLeft, setTestTimeLeft] = useState(0);
  const [testTimerRef, setTestTimerRef] = useState(null);
  const [completedTests, setCompletedTests] = useState(() => { try { return JSON.parse(localStorage.getItem("pid_done_tests")||"[]"); } catch(e){ return []; } });
  const [seenNotifCount, setSeenNotifCount] = useState(() => { try { return Number(localStorage.getItem("pid_seen_notif")||0); } catch(e){ return 0; } });

  // ── Explore & My Batches State ──
  const [selectedCourse, setSelectedCourse] = useState(null);
  const [selectedSubject, setSelectedSubject] = useState(null);
  const [showUpiModal, setShowUpiModal] = useState(false);

  // ── AI Doubt Solver State ──
  const [dInput, setDInput] = useState("");
  const [dChat, setDChat] = useState([]);
  const [dLoading, setDLoading] = useState(false);
  const [dImgPreview, setDImgPreview] = useState("");
  const [dImgB64, setDImgB64] = useState(null);
  const [isTyping, setIsTyping] = useState(false);
  const [thinkingText, setThinkingText] = useState("");
  const [showAttach, setShowAttach] = useState(false);
  const [doubtSubject, setDoubtSubject] = useState("");
  const chatEndRef = useRef(null);
  const typingRef = useRef(null);
  const fileInputRef = useRef(null);
  const camInputRef = useRef(null);
  const textareaRef = useRef(null);

  // ── Doubt History State ──
  const [doubtHistory, setDoubtHistory] = useState([]);
  const [showDoubtHistory, setShowDoubtHistory] = useState(false);
  const [activeSessionId, setActiveSessionId] = useState(null);

  // ── AI Quiz State ──
  const [quizState, setQuizState] = useState("setup");
  const [quizSubject, setQuizSubject] = useState("");
  const [quizChapter, setQuizChapter] = useState("");
  const [quizCount, setQuizCount] = useState(5);
  const [quizDifficulty, setQuizDifficulty] = useState("medium");
  const [quizQs, setQuizQs] = useState([]);
  const [quizIdx, setQuizIdx] = useState(0);
  const [quizAns, setQuizAns] = useState({});
  const [quizExpl, setQuizExpl] = useState(false);
  const [quizScore, setQuizScore] = useState(0);
  const [quizErr, setQuizErr] = useState("");
  const [showQuizHistory, setShowQuizHistory] = useState(false);

  // ── Close attach menu on outside click ──
  useEffect(() => {
    if (!showAttach) return;
    const handler = () => setShowAttach(false);
    setTimeout(() => document.addEventListener("click", handler), 10);
    return () => document.removeEventListener("click", handler);
  }, [showAttach]);

  // ═══ FIREBASE SETUP & LISTENERS ═══
  useEffect(() => {
    const u = onAuthStateChanged(auth, u => { setUser(u); setLoading(false); });
    return () => u();
  }, []);

  // Auto-detect language from student medium
  useEffect(() => {
    if (student?.medium) {
      const m = student.medium.toLowerCase();
      if (m.includes("hindi")) setAnswerLang("hindi");
      else if (m.includes("english")) setAnswerLang("english");
      else setAnswerLang("hinglish");
    }
  }, [student]);

  useEffect(() => {
    if (!user?.email) { setStudent(null); setTeacher(null); return; }
    if (loginRole === "student") {
      setStudentLoading(true);
      const email = user.email.toLowerCase();
      const unsub = onSnapshot(collection(db, "students"), snap => {
        const found = snap.docs.find(d => d.data().studentEmail?.toLowerCase() === email);
        if (found) {
          setStudent({ id: found.id, ...found.data(), isEnrolled: true });
        } else {
          setStudent({ studentName: user.displayName || "Guest Student", studentEmail: email, isEnrolled: false, class: "N/A" });
          setActiveTab("explore");
        }
        setStudentLoading(false);
      });
      return () => unsub();
    } else if (loginRole === "teacher") {
      setTeacherLoading(true);
      const email = user.email.toLowerCase();
      const unsub = onSnapshot(collection(db, "teachers"), snap => {
        const found = snap.docs.find(d => d.data().email?.toLowerCase() === email);
        if (found) {
          setTeacher({ id: found.id, ...found.data() });
        } else {
          setTeacher(null);
          alert("Aapka email teacher list mein nahi hai. Admin se contact karo.");
          signOut(auth);
          setLoginRole(null);
        }
        setTeacherLoading(false);
      });
      return () => unsub();
    }
  }, [user, loginRole]);

  // Teacher data listeners
  useEffect(() => {
    if (!teacher) return;
    const unsubs = [];
    const isDirector = teacher.isDirector === true;
    const teacherClasses = (teacher.classes || "").split(/[,&]/).map(c => c.trim().replace(/class\s*/i, "")).filter(Boolean);
    // Students — director ko saare milenge, baaki teacher ko sirf apni classes ke
    unsubs.push(onSnapshot(collection(db, "students"), s => {
      const all = s.docs.map(d => ({ id: d.id, ...d.data() }));
      const filtered = isDirector
        ? all.filter(st => st.status === "active")
        : all.filter(st => {
            const stClass = (st.class || st.presentClass || "").replace(/[^0-9]/g, "");
            return teacherClasses.some(tc => tc.replace(/[^0-9]/g, "") === stClass) && st.status === "active";
          });
      setTStudents(filtered);
    }));
    // Attendance for those students
    unsubs.push(onSnapshot(collection(db, "attendance"), s => {
      setTAttendance(s.docs.map(d => ({ id: d.id, ...d.data() })));
    }));
    // Quiz history
    unsubs.push(onSnapshot(collection(db, "quiz_history"), s => {
      setTQuizHistory(s.docs.map(d => ({ id: d.id, ...d.data() })));
    }));
    // Exam marks
    unsubs.push(onSnapshot(collection(db, "exam_marks"), s => {
      setTExamMarks(s.docs.map(d => ({ id: d.id, ...d.data() })));
    }));
    // Notifications
    unsubs.push(onSnapshot(collection(db, "scheduled_notifications"), s => {
      const arr = s.docs.map(d => ({ id: d.id, ...d.data() }));
      arr.sort((a, b) => (b.date || "").localeCompare(a.date || ""));
      setTNotifications(arr);
    }));
    // My leaves
    unsubs.push(onSnapshot(query(collection(db, "leave_applications"), where("teacherId", "==", teacher.id)), s => {
      const arr = s.docs.map(d => ({ id: d.id, ...d.data() }));
      arr.sort((a, b) => (b.createdAt?.toDate?.() || 0) - (a.createdAt?.toDate?.() || 0));
      setMyLeaves(arr);
    }));
    return () => unsubs.forEach(u => u());
  }, [teacher]);

  // Leave application submit — auto approved
  async function submitLeave() {
    if (!leaveFrom || !leaveReason.trim()) { alert("Date aur reason dono fill karo!"); return; }
    setLeaveSubmitting(true);
    try {
      await addDoc(collection(db, "leave_applications"), {
        teacherId: teacher.id, teacherName: teacher.name, teacherEmail: teacher.email || "",
        teacherSubject: teacher.subject || "", fromDate: leaveFrom, toDate: leaveTo || leaveFrom,
        reason: leaveReason.trim(), status: "approved",
        createdAt: serverTimestamp()
      });
      setLeaveFrom(""); setLeaveTo(""); setLeaveReason("");
      alert("✅ Chutti mil gayi! Leave approved ho gayi hai.");
    } catch (e) { alert("Error: " + e.message); }
    setLeaveSubmitting(false);
  }

  // Edit leave (within 24 hrs only)
  async function saveEditLeave() {
    if (!editLeaveFrom || !editLeaveReason.trim()) { alert("Date aur reason fill karo!"); return; }
    setEditLeaveSubmitting(true);
    try {
      await updateDoc(doc(db, "leave_applications", editingLeave.id), {
        fromDate: editLeaveFrom, toDate: editLeaveTo || editLeaveFrom,
        reason: editLeaveReason.trim(), status: "approved"
      });
      setEditingLeave(null);
      alert("✅ Leave update ho gayi!");
    } catch (e) { alert("Error: " + e.message); }
    setEditLeaveSubmitting(false);
  }

  // Delete leave (within 24 hrs only)
  async function deleteLeave(leaveId) {
    if (!confirm("Kya aap is leave application ko delete karna chahte ho?")) return;
    try {
      await deleteDoc(doc(db, "leave_applications", leaveId));
      alert("Leave delete ho gayi.");
    } catch (e) { alert("Error: " + e.message); }
  }

  // Fetch Global Data
  useEffect(() => {
    if (!student) return;
    const unsubs = [];
    unsubs.push(onSnapshot(collection(db, "courses"), s => setCourses(s.docs.map(d => ({ id: d.id, ...d.data() })))));
    unsubs.push(onSnapshot(collection(db, "study_materials"), s => {
      setMaterials(s.docs.map(d => ({ id: d.id, ...d.data() })));
    }));
    unsubs.push(onSnapshot(query(collection(db, "online_tests"), where("isActive", "==", true)), s => {
      const all = s.docs.map(d => ({ id: d.id, ...d.data() }));
      const today = new Date().toISOString().split("T")[0];
      const sc = student?.class||"", sm = student?.medium||"";
      const sb = student?.board==="CG Board"?"CG":(student?.board||"");
      const ok = (fc) => {
        if (!fc||fc==="all") return true;
        // Normalize student class: "12" → "12th", "11" → "11th" etc.
        const scNorm = sc.includes("th") ? sc : (sc && !isNaN(parseInt(sc)) ? parseInt(sc)+"th" : sc);
        if (fc==="JEE-NEET") return ["9th","10th","11th","12th"].includes(scNorm);
        if (fc==="2nd-8th-All") return ["2nd","3rd","4th","5th","6th","7th","8th"].includes(scNorm);
        const p=fc.split("-");
        if (p[0]!==scNorm) return false;
        if (p[1]&&sm){ const mo=(p[1]==="Eng"&&sm==="English")||((p[1]==="Hin"||p[1]==="Hindi")&&sm==="Hindi"); if(!mo) return false; }
        const bp=p.slice(2);
        if (bp.length>0&&sb){ const bo=bp.some(x=>x===sb||x==="All"||(x==="CB"&&sb==="CBSE")||(x==="IC"&&sb==="ICSE")); if(!bo) return false; }
        return true;
      };
      const f=all.filter(t=>ok(t.forClass)&&(!t.scheduledDate||t.scheduledDate<=today));
      f.sort((a,b)=>(b.createdAt?.toDate?.()||0)-(a.createdAt?.toDate?.()||0));
      setTests(f);
    }));
    unsubs.push(onSnapshot(collection(db, "scheduled_notifications"), s => {
      const arr = s.docs.map(d => ({ id: d.id, ...d.data() }));
      arr.sort((a, b) => (b.date || "").localeCompare(a.date || ""));
      const scN = (student?.class||"").includes("th") ? (student?.class||"") : ((student?.class && !isNaN(parseInt(student?.class))) ? parseInt(student?.class)+"th" : (student?.class||""));
      setNotifications(arr.filter(n => !n.classFilter || n.classFilter === student?.class || n.classFilter === scN || n.classFilter === "all"));
    }));
    if (student?.id) {
      const monthStart = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, "0")}-01`;
      unsubs.push(onSnapshot(query(collection(db, "attendance"), where("studentId", "==", student.id)), s => {
        const allAtt = s.docs.map(d => ({ id: d.id, ...d.data() }));
        setAllAttendance(allAtt);
        setAttendance(allAtt.filter(a => a.date >= monthStart));
      }));
      unsubs.push(onSnapshot(query(collection(db, "quiz_history"), where("studentId", "==", student.id)), s => {
        const arr = s.docs.map(d => ({ id: d.id, ...d.data() }));
        arr.sort((a, b) => (b.createdAt?.toDate?.() || 0) - (a.createdAt?.toDate?.() || 0));
        setQuizHistory(arr);
      }));
      // Doubt history listener
      unsubs.push(onSnapshot(query(collection(db, "doubt_history"), where("studentId", "==", student.id)), s => {
        const arr = s.docs.map(d => ({ id: d.id, ...d.data() }));
        arr.sort((a, b) => (b.createdAt?.toDate?.() || 0) - (a.createdAt?.toDate?.() || 0));
        setDoubtHistory(arr);
      }));
    }
    return () => unsubs.forEach(u => u());
  }, [student]);

  // ═══ CALCULATED STATS ═══
  // Monthly attendance: unique dates with "in" / working days so far this month
  const monthPresentDays = new Set(attendance.filter(a => a.type === "in").map(a => a.date)).size;
  const monthWorkingDays = (() => {
    const now = new Date();
    let count = 0;
    for (let d = 1; d <= now.getDate(); d++) {
      const ds = new Date(now.getFullYear(), now.getMonth(), d);
      if (ds.getDay() !== 0) count++; // Sunday skip
    }
    return count || 1;
  })();
  const attPct = Math.min(100, Math.round((monthPresentDays / monthWorkingDays) * 100));

  // Overall attendance: unique dates with "in" across all time / total unique attendance dates
  const overallPresentDays = new Set(allAttendance.filter(a => a.type === "in").map(a => a.date)).size;
  const overallTotalDays = new Set(allAttendance.map(a => a.date)).size || 1;
  const overallAttPct = Math.min(100, Math.round((overallPresentDays / overallTotalDays) * 100));

  const avgQuiz = quizHistory.length > 0 ? Math.round(quizHistory.reduce((s, q) => s + (q.percentage || 0), 0) / quizHistory.length) : 0;
  const weakSubjects = [...new Set(quizHistory.filter(q => q.percentage < 60).map(q => q.subject))];
  const subjects = [...new Set(materials.map(m => m.subject).filter(Boolean))];
  const quizChapters = [...new Set(materials.filter(m => m.subject === quizSubject).map(m => m.chapter).filter(Boolean))];
  const langLabel = answerLang === "hindi" ? "Hindi (Devanagari)" : answerLang === "english" ? "English only" : "Hinglish";

  // Sample questions for empty state
  const sampleQs = {
    "": ["Newton's 3rd Law kya hai?", "Solve: 2x + 5 = 15", "Photosynthesis explain karo", "Ohm's Law define karo"],
    Physics: ["Newton ke 3 laws batao", "Electromagnetic induction?", "Refraction kya hai?"],
    Chemistry: ["pH scale kya hai?", "Ionic vs covalent bond?", "Mole concept samjhao"],
    Mathematics: ["2x² - 5x + 3 = 0 solve karo", "Pythagorean theorem?", "d/dx of x³ + 2x?"],
    Biology: ["Photosynthesis process?", "DNA replication?", "Osmosis vs diffusion?"],
  };
  const currentSamples = sampleQs[doubtSubject] || sampleQs[""];

  // ═══ THEME ENGINE — Navy/Blue/Gold Coaching Theme ═══
  const T = dark ? {
    bg: "#0B1120", card: "#111B2E", text: "#E8EDF5", text2: "#A3B5CC", text3: "#6B7F99",
    border: "#1C2D45", accent: "#2563EB", gold: "#D4A843", userChat: "#1E3A5F",
    aiChat: "#111B2E", inputBg: "#1C2D45", navBg: "#070D1A", gradStart: "#0B1120",
    gradEnd: "#162544", cardHover: "#162544", success: "#10B981", danger: "#EF4444",
    purple: "#8B5CF6", orange: "#F59E0B",
  } : {
    bg: "#F0F4FA", card: "#FFFFFF", text: "#0B1826", text2: "#374151", text3: "#6B7F99",
    border: "#D4DEF0", accent: "#1349A8", gold: "#D4A843", userChat: "#1349A8",
    aiChat: "#F8FAF9", inputBg: "#FFFFFF", navBg: "#0C1F36", gradStart: "#0C1F36",
    gradEnd: "#1A3A5C", cardHover: "#F5F8FF", success: "#059669", danger: "#DC2626",
    purple: "#7C3AED", orange: "#D98D04",
  };

  // ═══ RENDER MARKDOWN ═══
  function renderMd(text) {
    if (!text) return "";
    let h = text
      .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
      .replace(/\*(.*?)\*/g, "<em>$1</em>")
      .replace(/`([^`]+)`/g, `<code style="background:${dark ? '#1C2D45' : '#EFF6FF'};padding:2px 6px;border-radius:6px;font-size:.83rem;color:${dark ? '#60A5FA' : '#1349A8'}">$1</code>`)
      .replace(/^• /gm, "→ ")
      .replace(/\n/g, "<br/>");
    return <span dangerouslySetInnerHTML={{ __html: h }} />;
  }

  function getGemini() {
    const k = process.env.NEXT_PUBLIC_GEMINI_API_KEY;
    if (!k) throw new Error("API Key Missing");
    return new GoogleGenerativeAI(k).getGenerativeModel({ model: "gemini-2.5-flash" });
  }

  function formatDate(ts) {
    if (!ts) return "";
    const d = ts.toDate ? ts.toDate() : new Date(ts);
    return d.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
  }

  // ═══ IMAGE HANDLING ═══
  function processImage(file) {
    if (!file) return;
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) { alert("JPG/PNG/WebP only"); return; }
    if (file.size > 10 * 1024 * 1024) { alert("Max 10MB"); return; }
    const reader = new FileReader();
    reader.onload = (ev) => {
      setDImgPreview(ev.target.result);
      setDImgB64(ev.target.result.split(",")[1]);
      setShowAttach(false);
    };
    reader.readAsDataURL(file);
  }
  function handleImageUpload(e) { processImage(e.target.files?.[0]); if (e.target) e.target.value = ""; }
  function removeImage() { setDImgPreview(""); setDImgB64(null); }

  // Auto-resize textarea
  function handleTextareaInput(e) {
    setDInput(e.target.value);
    const el = e.target;
    el.style.height = "42px";
    el.style.height = Math.min(el.scrollHeight, 120) + "px";
  }

  // ═══ AI DOUBT SOLVER ═══
  const thinkSteps = ["Samajh raha hoon...", "Concept analyze kar raha hoon...", "Solution prepare kar raha hoon...", "Answer likh raha hoon..."];

  async function askDoubt() {
    if (!dInput.trim() && !dImgB64) return;
    const msgText = dInput.trim();
    const imgPrev = dImgPreview;
    const imgData = dImgB64;
    setDInput("");
    removeImage();
    if (textareaRef.current) textareaRef.current.style.height = "42px";
    setDChat(p => [...p, { role: "user", text: msgText, image: imgPrev, time: new Date() }]);
    setDLoading(true);

    let ti = 0;
    setThinkingText(thinkSteps[0]);
    const thinkInt = setInterval(() => { ti = (ti + 1) % thinkSteps.length; setThinkingText(thinkSteps[ti]); }, 2500);

    try {
      const ci = student?.class || student?.presentClass || "12";
      const si = doubtSubject ? `Subject: ${doubtSubject}` : "Any subject";
      const hist = dChat.slice(-6).map(m => `${m.role === "user" ? "Student" : "Teacher"}: ${m.text}`).join("\n");

      const prompt = `You are ${student?.studentName || "Student"}'s PERSONAL AI tutor at Patel Institute Dongargaon. You know this student deeply:

═══ STUDENT PROFILE ═══
- Name: ${student?.studentName || "Student"}
- Class: ${ci} | Board: ${student?.board || "CG Board"} | Medium: ${student?.medium || "Hindi"}
- Monthly Attendance: ${attPct}% (${monthPresentDays}/${monthWorkingDays} days this month)
- Overall Attendance: ${overallAttPct}%
- Average Quiz Score: ${avgQuiz}%
- Total Quizzes Taken: ${quizHistory.length}
- Weak Subjects: ${weakSubjects.length ? weakSubjects.join(", ") : "None identified yet"}
- Strong Subjects: ${[...new Set(quizHistory.filter(q => (q.percentage || 0) >= 75).map(q => q.subject))].join(", ") || "Building up"}
- Recent Quiz Performance: ${quizHistory.slice(0, 3).map(q => q.subject + " " + (q.percentage || 0) + "%").join(", ") || "No recent quizzes"}

═══ YOUR TEACHING PERSONALITY ═══
You are like a brilliant elder brother/sister (bhaiya/didi) who explains things in a fun, relatable way.
- ${si}
- Language: ${langLabel}

═══ RESPONSE INTELLIGENCE (CRITICAL) ═══
Adapt your answer LENGTH and DEPTH based on what the student asked:

IF simple fact/definition → 2-4 lines. Direct answer. No unnecessary explanation.
   Example: "Newton ka 3rd law kya hai?" → Short, crisp, done.

IF solve/calculate → Full step-by-step numbered solution. Show every step clearly. Circle the final answer.
   Example: "2x+5=15 solve karo" → Step 1, Step 2... **Answer: x = 5** ✓

IF explain/concept → 5-15 lines. Build the concept from scratch.
   - Start with WHY this concept matters (1 line real-life connection)
   - Explain the core idea simply
   - Give a real-life Indian example (cricket, chai, market, train, phone — whatever fits)
   - End with a memory trick or formula shortcut
   Example: "Photosynthesis explain karo" → Detailed with sunlight-plant-food analogy

IF doubt on weak subject (${weakSubjects.join(", ") || "none"}) → Be EXTRA careful:
   - Assume student has gaps in basics
   - Explain from fundamentals, don't skip steps
   - Use Feynman technique (explain like teaching a 10-year-old)
   - Add 1-2 practice questions at the end

IF student scores low (avg ${avgQuiz}%) → Be encouraging. Never say "ye easy hai." 
   - Celebrate small understanding: "Bahut accha! Ab samajh aa raha hai 🎯"
   - Build confidence while teaching

IF image attached → Analyze carefully. Solve step-by-step. If handwriting is unclear, mention what you see.

═══ FORMATTING RULES ═══
- Use **bold** for key terms, formulas, and important words
- Use numbered steps (1. 2. 3.) for solutions
- Use bullet points (•) for listing concepts
- Use real-life examples from Indian context when relevant
- End tricky topics with: "💡 Yaad rakhne ka trick: ..." (1 line memory aid)
- If student asks follow-up, remember the conversation context below

${hist ? `═══ CONVERSATION SO FAR ═══\n${hist}\n\n` : ""}Student asks: ${msgText || "Analyze this image and solve/explain it."}`;

      let result;
      if (imgData) {
        result = await getGemini().generateContent([{ text: prompt }, { inlineData: { mimeType: "image/jpeg", data: imgData } }]);
      } else {
        result = await getGemini().generateContent(prompt);
      }

      clearInterval(thinkInt);
      setThinkingText("");
      const answer = result.response.text();

      // Save to Firebase doubt_history — filter undefined fields
      try {
        if (student?.id) {
          const msgs = [...dChat, { role: "user", text: msgText, image: imgPrev ? "img" : "", time: new Date().toISOString() }, { role: "ai", text: answer, time: new Date().toISOString() }];
          const saveData = Object.fromEntries(Object.entries({
            studentId: student.id, studentName: student.studentName || "",
            studentClass: student.class || student.presentClass || "",
            subject: doubtSubject || "General",
            messages: [msgs[msgs.length - 2], msgs[msgs.length - 1]],
            lastMessage: answer.substring(0, 100),
            createdAt: serverTimestamp(), updatedAt: serverTimestamp()
          }).filter(([_, v]) => v !== undefined));
          if (activeSessionId) {
            await updateDoc(doc(db, "doubt_history", activeSessionId), { messages: msgs, lastMessage: answer.substring(0, 100), subject: doubtSubject || "General", updatedAt: serverTimestamp() });
          } else {
            const ref = await addDoc(collection(db, "doubt_history"), saveData);
            setActiveSessionId(ref.id);
          }
        }
      } catch (se) { console.error("Save:", se); }

      // Typing animation
      setDLoading(false);
      setDChat(p => [...p, { role: "ai", text: "", time: new Date() }]);
      setIsTyping(true);

      const words = answer.split(/(\s+)/);
      let wi = 0;
      typingRef.current = setInterval(() => {
        wi += 3;
        if (wi >= words.length) {
          clearInterval(typingRef.current);
          typingRef.current = null;
          setDChat(p => { const u = [...p]; u[u.length - 1] = { ...u[u.length - 1], text: answer }; return u; });
          setIsTyping(false);
        } else {
          setDChat(p => { const u = [...p]; u[u.length - 1] = { ...u[u.length - 1], text: words.slice(0, wi).join("") }; return u; });
        }
      }, 25);
    } catch (e) {
      clearInterval(thinkInt);
      setThinkingText("");
      setDLoading(false);
      setDChat(p => [...p, { role: "ai", text: "Error aa gaya. Dobara try karo.", time: new Date() }]);
    }
  }

  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [dChat, isTyping, dLoading]);
  useEffect(() => { return () => { if (typingRef.current) clearInterval(typingRef.current); }; }, []);

  // Doubt helper functions
  function clearDoubtChat() {
    setDChat([]);
    setActiveSessionId(null);
    if (typingRef.current) { clearInterval(typingRef.current); typingRef.current = null; }
    setIsTyping(false);
  }
  function loadSession(ses) {
    setDChat(ses.messages.map(m => ({ ...m, time: m.time ? new Date(m.time) : new Date() })));
    setActiveSessionId(ses.id);
    setDoubtSubject(ses.subject || "");
    setShowDoubtHistory(false);
  }

  // ═══ AI QUIZ LOGIC ═══
  async function genQuiz() {
    if (!quizSubject) { setQuizErr("Subject select karo!"); return; }
    setQuizErr(""); setQuizState("loading"); setQuizQs([]); setQuizAns({}); setQuizIdx(0); setQuizExpl(false); setQuizScore(0);
    try {
      const ci = student?.class || student?.presentClass || "12";
      const ch = quizChapter ? `Chapter: ${quizChapter}` : "Any chapter";
      const r = await getGemini().generateContent(`Expert Indian education quiz for Class ${ci}. Generate ${quizCount} MCQs: Subject: ${quizSubject}, ${ch}, Difficulty: ${quizDifficulty}, Board: ${student?.board || "CG Board"}. LANGUAGE: ${langLabel}. NCERT based. Respond ONLY JSON array: [{"question":"text","options":["A","B","C","D"],"correct":0,"explanation":"text"}]`);
      let t = r.response.text().replace(/```json\s*/gi, "").replace(/```\s*/gi, "").trim();
      const si = t.indexOf("["), ei = t.lastIndexOf("]");
      if (si !== -1 && ei !== -1) t = t.substring(si, ei + 1);
      const v = JSON.parse(t).filter(q => q.question && q.options?.length === 4 && typeof q.correct === "number");
      if (!v.length) throw new Error("No valid questions");
      setQuizQs(v); setQuizState("active");
    } catch (e) { setQuizErr("Failed to generate. Try again."); setQuizState("setup"); }
  }

  function selAns(qi, oi) { if (quizAns[qi] !== undefined) return; setQuizAns(p => ({ ...p, [qi]: oi })); setQuizExpl(true); }

  function nextQ() {
    setQuizExpl(false);
    if (quizIdx < quizQs.length - 1) setQuizIdx(quizIdx + 1);
    else {
      let s = 0;
      quizQs.forEach((q, i) => { if (quizAns[i] === q.correct) s++; });
      setQuizScore(s);
      setQuizState("results");
      saveQuizHistory(s);
    }
  }

  async function saveQuizHistory(score) {
    if (!student?.id) return;
    try {
      const total = quizQs.length;
      const pct = Math.round((score / total) * 100);
      const data = Object.fromEntries(Object.entries({
        studentId: student.id, studentName: student.studentName || "",
        studentClass: student.class || student.presentClass || "",
        subject: quizSubject, chapter: quizChapter || "All",
        difficulty: quizDifficulty, totalQuestions: total,
        correctAnswers: score, percentage: pct,
        grade: pct >= 90 ? "A+" : pct >= 80 ? "A" : pct >= 70 ? "B+" : pct >= 60 ? "B" : pct >= 50 ? "C" : "F",
        questions: quizQs.map((q, i) => ({ question: q.question, correct: q.correct, selected: quizAns[i], isCorrect: quizAns[i] === q.correct })),
        language: answerLang, createdAt: serverTimestamp(),
      }).filter(([_, v]) => v !== undefined));
      await addDoc(collection(db, "quiz_history"), data);
    } catch (e) { console.error("Quiz save error:", e); }
  }

  async function deleteQuizEntry(qhId) {
    if (!confirm("Delete this quiz result?")) return;
    try { await deleteDoc(doc(db, "quiz_history", qhId)); } catch (e) { console.error("Delete error:", e); }
  }

  function resetQuiz() { setQuizState("setup"); setQuizQs([]); setQuizAns({}); setQuizIdx(0); setQuizExpl(false); setQuizScore(0); setQuizErr(""); }

  // ═══ PRE-LOGIN UI ═══
  if (loading) return (
    <div style={{ height: "100vh", background: "linear-gradient(135deg, #0C1F36, #1A3A5C)", display: "flex", alignItems: "center", justifyContent: "center", color: "#D4A843", fontSize: "2rem" }}>
      <I n="spinner" cls="fa-spin" />
    </div>
  );

  if (!user || !loginRole) return (
    <div style={{ background: "linear-gradient(150deg, #070D1A 0%, #0C1F36 50%, #162544 100%)", minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'Nunito', 'Inter', sans-serif" }}>
      <style>{`@keyframes float{0%,100%{transform:translateY(0)}50%{transform:translateY(-8px)}}@keyframes glow{0%,100%{box-shadow:0 0 20px rgba(212,168,67,0.15)}50%{box-shadow:0 0 40px rgba(212,168,67,0.3)}}`}</style>
      <div style={{ background: "linear-gradient(145deg, #111B2E, #0C1F36)", padding: "48px 36px", borderRadius: 28, maxWidth: 400, width: "92%", textAlign: "center", border: "1px solid #1C2D45", boxShadow: "0 25px 60px rgba(0,0,0,0.5)", animation: "glow 3s ease-in-out infinite" }}>
        <div style={{ width: 80, height: 80, borderRadius: 20, background: "linear-gradient(135deg, #D4A843, #B8912E)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 24px", boxShadow: "0 8px 30px rgba(212,168,67,0.3)", animation: "float 3s ease-in-out infinite" }}>
          <img src="/pid_logo.png" alt="PID" style={{ width: 52, height: 52, borderRadius: 12 }} onError={e => { e.target.style.display = 'none'; e.target.nextSibling && (e.target.nextSibling.style.display = 'flex'); }} />
          <span style={{ display: "none", color: "#0C1F36", fontWeight: 900, fontSize: "1.4rem" }}>PID</span>
        </div>
        <h1 style={{ color: "#E8EDF5", fontSize: "1.7rem", fontWeight: 800, margin: "0 0 6px", fontFamily: "'Nunito', sans-serif", letterSpacing: "-0.5px" }}>PID App</h1>
        <p style={{ color: "#D4A843", fontSize: ".85rem", fontWeight: 700, margin: "0 0 8px", textTransform: "uppercase", letterSpacing: "2px" }}>Patel Institute Dongargaon</p>
        <p style={{ color: "#6B7F99", fontSize: ".85rem", marginBottom: 28, lineHeight: 1.6 }}>Login karo apni registered Gmail ID se</p>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <button onClick={() => { setLoginRole("student"); if (!user) signInWithPopup(auth, googleProvider).catch(console.log); }}
            style={{ width: "100%", padding: "16px", borderRadius: 16, background: "#E8EDF5", color: "#0C1F36", border: "none", fontSize: "1rem", fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 12 }}>
            <I n="user-graduate" s={20} c="#1349A8" /> Student Login
          </button>
          <button onClick={() => { setLoginRole("teacher"); if (!user) signInWithPopup(auth, googleProvider).catch(console.log); }}
            style={{ width: "100%", padding: "16px", borderRadius: 16, background: "transparent", color: "#D4A843", border: "2px solid #D4A843", fontSize: "1rem", fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 12 }}>
            <I n="chalkboard-teacher" s={20} c="#D4A843" /> Teacher Login
          </button>
        </div>
      </div>
    </div>
  );

  if (studentLoading || teacherLoading) return (
    <div style={{ height: "100vh", background: "#0B1120", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", fontFamily: "'Inter', sans-serif" }}>
      <I n="spinner" cls="fa-spin" s={40} c="#D4A843" />
      <p style={{ color: "#E8EDF5", fontWeight: 600, marginTop: 16 }}>Loading your profile...</p>
    </div>
  );

  // ═══ TEACHER DASHBOARD ═══
  if (loginRole === "teacher" && teacher) {
    const myStudentIds = new Set(tStudents.map(s => s.id));
    const today = new Date().toISOString().split("T")[0];
    return (
      <div style={{ background: "#F0F4FA", minHeight: "100vh", fontFamily: "'Inter', 'DM Sans', sans-serif", maxWidth: 480, margin: "0 auto" }}>
        {/* Teacher Header */}
        <div style={{ background: "#0C1F36", padding: "16px 20px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ width: 40, height: 40, borderRadius: 12, background: "linear-gradient(135deg, #D4A843, #B8912E)", display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden" }}>
              {teacher.photo ? <img src={teacher.photo} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : <I n="chalkboard-teacher" s={18} c="#fff" />}
            </div>
            <div><h3 style={{ margin: 0, fontSize: ".95rem", fontWeight: 800, color: "#E8EDF5" }}>{teacher.name}</h3><p style={{ margin: 0, fontSize: ".65rem", color: "#6B7F99" }}>{teacher.subject} · {teacher.classes || "All Classes"}</p></div>
          </div>
          <button onClick={() => { signOut(auth); setLoginRole(null); setTeacher(null); }} style={{ background: "rgba(255,255,255,.08)", border: "1px solid rgba(255,255,255,.15)", color: "#9FB8CF", padding: "6px 12px", borderRadius: 8, fontSize: ".72rem", cursor: "pointer" }}>Logout</button>
        </div>

        {/* Teacher Tabs */}
        <div style={{ display: "flex", gap: 4, padding: "12px 16px", overflowX: "auto" }}>
          {[{ id: "students", l: "Students", i: "users" }, { id: "notify", l: "Notify", i: "bell" }, { id: "leave", l: "Leave", i: "calendar-minus" }].map(t => (
            <button key={t.id} onClick={() => { setTeacherTab(t.id); setTSelectedStudent(null); }} style={{ padding: "8px 16px", borderRadius: 12, border: `1.5px solid ${teacherTab === t.id ? "#1349A8" : "#D4DEF0"}`, background: teacherTab === t.id ? "#1349A8" : "#fff", color: teacherTab === t.id ? "#fff" : "#4A5E78", fontSize: ".78rem", fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", gap: 6, whiteSpace: "nowrap" }}><I n={t.i} s={12} /> {t.l}</button>
          ))}
        </div>

        <div style={{ padding: "0 16px 100px" }}>
          {/* ═══ STUDENTS PERFORMANCE — Class-wise + Board/Medium Partition ═══ */}
          {teacherTab === "students" && !tSelectedStudent && (() => {
            // Build unique class list from teacher's students
            const classNums = [...new Set(tStudents.map(st => st.class || st.presentClass).filter(Boolean))].sort((a, b) => {
              const n1 = parseInt(a), n2 = parseInt(b);
              return isNaN(n1) || isNaN(n2) ? a.localeCompare(b) : n1 - n2;
            });

            // Filter students by selected class
            const classFiltered = tSelectedClass === "all" ? tStudents : tStudents.filter(st => (st.class || st.presentClass) === tSelectedClass);

            // Group by board+medium
            const groups = {};
            classFiltered.forEach(st => {
              const board = st.board || "CG Board";
              const medium = st.medium || "Hindi";
              const key = `${board}__${medium}`;
              if (!groups[key]) groups[key] = { board, medium, students: [] };
              groups[key].students.push(st);
            });

            // Board colors
            const boardColors = { "CG Board": "#1349A8", "CBSE": "#D98D04", "ICSE": "#7C3AED", "MP Board": "#059669" };

            return (
              <div>
                {/* Header */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", margin: "8px 0 12px" }}>
                  <div>
                    <h3 style={{ fontSize: "1rem", fontWeight: 800, margin: "0 0 3px" }}>
                      {teacher.isDirector ? "All Students" : "My Students"} ({tStudents.length})
                    </h3>
                    {teacher.isDirector && <span style={{ fontSize: ".62rem", color: "#92400E", background: "#FFFBEB", border: "1px solid #FDE68A", padding: "2px 8px", borderRadius: 6, fontWeight: 700 }}>👑 Director — Sabhi Classes</span>}
                  </div>
                  <span style={{ fontSize: ".72rem", color: "#6B7F99", background: "#F0F4FA", padding: "4px 10px", borderRadius: 8, fontWeight: 600 }}>
                    {classFiltered.length} showing
                  </span>
                </div>

                {/* Class Filter Buttons */}
                <div style={{ display: "flex", gap: 6, overflowX: "auto", paddingBottom: 8, marginBottom: 14 }}>
                  {[{ id: "all", label: `All (${tStudents.length})` }, ...classNums.map(c => ({ id: c, label: `Class ${c}` }))].map(btn => (
                    <button key={btn.id} onClick={() => setTSelectedClass(btn.id)}
                      style={{ padding: "6px 14px", borderRadius: 20, border: `1.5px solid ${tSelectedClass === btn.id ? "#1349A8" : "#D4DEF0"}`, background: tSelectedClass === btn.id ? "#1349A8" : "#fff", color: tSelectedClass === btn.id ? "#fff" : "#4A5E78", fontSize: ".72rem", fontWeight: 700, cursor: "pointer", whiteSpace: "nowrap", flexShrink: 0 }}>
                      {btn.label}
                    </button>
                  ))}
                </div>

                {tStudents.length === 0 ? (
                  <p style={{ color: "#6B7F99", fontSize: ".82rem", textAlign: "center", padding: 30 }}>Koi student nahi mila aapki classes mein</p>
                ) : classFiltered.length === 0 ? (
                  <p style={{ color: "#6B7F99", fontSize: ".82rem", textAlign: "center", padding: 30 }}>Is class mein koi student nahi</p>
                ) : Object.values(groups).map(group => {
                  const boardColor = boardColors[group.board] || "#1349A8";
                  return (
                    <div key={`${group.board}__${group.medium}`} style={{ marginBottom: 20 }}>
                      {/* Group Header — Board + Medium */}
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                        <div style={{ height: 2, flex: 1, background: `${boardColor}30`, borderRadius: 2 }} />
                        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                          <span style={{ padding: "3px 10px", borderRadius: 20, background: `${boardColor}15`, color: boardColor, fontSize: ".65rem", fontWeight: 800, border: `1px solid ${boardColor}30` }}>{group.board}</span>
                          <span style={{ padding: "3px 10px", borderRadius: 20, background: "#F5F0FF", color: "#7C3AED", fontSize: ".65rem", fontWeight: 700, border: "1px solid #DDD6FE" }}>{group.medium} Medium</span>
                          <span style={{ fontSize: ".6rem", color: "#9FB8CF", fontWeight: 600 }}>{group.students.length} students</span>
                        </div>
                        <div style={{ height: 2, flex: 1, background: `${boardColor}30`, borderRadius: 2 }} />
                      </div>

                      {/* Students in this group */}
                      {group.students.map(st => {
                        const stAtt = tAttendance.filter(a => a.studentId === st.id && a.type === "in");
                        const stPresent = new Set(stAtt.map(a => a.date)).size;
                        const stTotal = new Set(tAttendance.filter(a => a.studentId === st.id).map(a => a.date)).size || 1;
                        const attPct = Math.min(100, Math.round((stPresent / stTotal) * 100));
                        const stQuiz = tQuizHistory.filter(q => q.studentId === st.id);
                        const avgQ = stQuiz.length > 0 ? Math.round(stQuiz.reduce((s, q) => s + (q.percentage || 0), 0) / stQuiz.length) : 0;
                        const attColor = attPct >= 75 ? "#16A34A" : attPct >= 50 ? "#D98D04" : "#DC2626";
                        const quizColor = avgQ >= 70 ? "#16A34A" : avgQ >= 50 ? "#D98D04" : "#DC2626";
                        return (
                          <div key={st.id} onClick={() => setTSelectedStudent(st)}
                            style={{ background: "#fff", border: "1px solid #D4DEF0", borderRadius: 14, padding: "12px 14px", marginBottom: 8, display: "flex", alignItems: "center", gap: 12, cursor: "pointer", transition: "box-shadow 0.2s" }}>
                            {/* Avatar */}
                            <div style={{ width: 42, height: 42, borderRadius: 12, background: `linear-gradient(135deg, ${boardColor}, ${boardColor}AA)`, display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden", flexShrink: 0 }}>
                              {st.photo ? <img src={st.photo} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : <span style={{ color: "#fff", fontWeight: 800, fontSize: ".9rem" }}>{(st.studentName || "S").charAt(0)}</span>}
                            </div>
                            {/* Info */}
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <h4 style={{ margin: 0, fontSize: ".85rem", fontWeight: 700, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{st.studentName}</h4>
                              <p style={{ margin: "2px 0 0", fontSize: ".62rem", color: "#6B7F99" }}>
                                Class {st.class || st.presentClass} · Roll {st.rollNumber || st.rollNo || "—"}
                              </p>
                            </div>
                            {/* Stats */}
                            <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                              <div style={{ textAlign: "center" }}>
                                <div style={{ fontSize: ".75rem", fontWeight: 800, color: attColor }}>{attPct}%</div>
                                <div style={{ fontSize: ".52rem", color: "#9FB8CF" }}>Att.</div>
                              </div>
                              <div style={{ textAlign: "center" }}>
                                <div style={{ fontSize: ".75rem", fontWeight: 800, color: quizColor }}>{avgQ}%</div>
                                <div style={{ fontSize: ".52rem", color: "#9FB8CF" }}>Quiz</div>
                              </div>
                            </div>
                            <I n="chevron-right" s={11} c="#D4DEF0" />
                          </div>
                        );
                      })}
                    </div>
                  );
                })}
              </div>
            );
          })()}

          {/* Student Detail — Full Performance View */}
          {teacherTab === "students" && tSelectedStudent && (() => {
            const st = tSelectedStudent;
            const stAtt = tAttendance.filter(a => a.studentId === st.id);
            const stPresent = new Set(stAtt.filter(a => a.type === "in").map(a => a.date)).size;
            const stTotal = new Set(stAtt.map(a => a.date)).size || 1;
            const stAttPct = Math.min(100, Math.round((stPresent / stTotal) * 100));
            // This month attendance
            const monthStart = `${new Date().getFullYear()}-${String(new Date().getMonth()+1).padStart(2,"0")}-01`;
            const stMonthAtt = stAtt.filter(a => a.type === "in" && a.date >= monthStart);
            const stMonthPresent = new Set(stMonthAtt.map(a => a.date)).size;
            const stQuiz = tQuizHistory.filter(q => q.studentId === st.id).sort((a,b) => (b.createdAt?.toDate?.() || 0) - (a.createdAt?.toDate?.() || 0));
            const avgQ = stQuiz.length > 0 ? Math.round(stQuiz.reduce((s, q) => s + (q.percentage || 0), 0) / stQuiz.length) : 0;
            const stMarks = tExamMarks.filter(m => m.studentId === st.id);
            const attColor = stAttPct >= 75 ? "#16A34A" : stAttPct >= 50 ? "#D98D04" : "#DC2626";
            const quizColor = avgQ >= 70 ? "#16A34A" : avgQ >= 50 ? "#D98D04" : "#DC2626";
            const boardColors = { "CG Board": "#1349A8", "CBSE": "#D98D04", "ICSE": "#7C3AED", "MP Board": "#059669" };
            const boardColor = boardColors[st.board] || "#1349A8";

            // Subject-wise quiz breakdown
            const subjectQuizMap = {};
            stQuiz.forEach(q => {
              if (!subjectQuizMap[q.subject]) subjectQuizMap[q.subject] = [];
              subjectQuizMap[q.subject].push(q.percentage || 0);
            });
            const subjectAvgs = Object.entries(subjectQuizMap).map(([sub, pcts]) => ({
              sub, avg: Math.round(pcts.reduce((a,b) => a+b, 0) / pcts.length), count: pcts.length
            })).sort((a,b) => b.avg - a.avg);

            // Recent attendance dates
            const recentDates = [...new Set(stAtt.map(a => a.date))].sort().reverse().slice(0, 7);

            return (
              <div>
                {/* Back Button */}
                <button onClick={() => setTSelectedStudent(null)} style={{ background: "#fff", border: "1px solid #D4DEF0", borderRadius: 10, padding: "8px 14px", marginBottom: 14, display: "flex", alignItems: "center", gap: 6, fontWeight: 600, cursor: "pointer", color: "#6B7F99", fontSize: ".8rem" }}>
                  <I n="arrow-left" s={12} /> Back to Students
                </button>

                {/* Profile Card */}
                <div style={{ background: `linear-gradient(135deg, #0C1F36, #1A3A5C)`, borderRadius: 18, padding: 20, color: "#fff", marginBottom: 14, position: "relative", overflow: "hidden" }}>
                  <div style={{ position: "absolute", right: -20, top: -20, width: 100, height: 100, borderRadius: "50%", background: `${boardColor}20` }} />
                  <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                    <div style={{ width: 54, height: 54, borderRadius: 14, background: `linear-gradient(135deg, ${boardColor}, ${boardColor}AA)`, display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden", flexShrink: 0 }}>
                      {st.photo ? <img src={st.photo} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : <span style={{ color: "#fff", fontWeight: 900, fontSize: "1.3rem" }}>{(st.studentName || "S").charAt(0)}</span>}
                    </div>
                    <div>
                      <h3 style={{ margin: "0 0 3px", fontSize: "1.05rem", fontWeight: 800 }}>{st.studentName}</h3>
                      <p style={{ margin: "0 0 2px", fontSize: ".72rem", opacity: .8 }}>Class {st.class || st.presentClass} · Roll {st.rollNumber || st.rollNo || "—"}</p>
                      <div style={{ display: "flex", gap: 6, marginTop: 4 }}>
                        <span style={{ padding: "2px 8px", borderRadius: 6, background: `${boardColor}40`, color: "#fff", fontSize: ".6rem", fontWeight: 700, border: `1px solid ${boardColor}60` }}>{st.board || "CG Board"}</span>
                        <span style={{ padding: "2px 8px", borderRadius: 6, background: "rgba(255,255,255,0.12)", color: "#fff", fontSize: ".6rem", fontWeight: 600 }}>{st.medium || "Hindi"} Medium</span>
                        <span style={{ padding: "2px 8px", borderRadius: 6, background: st.status === "active" ? "rgba(16,185,129,0.25)" : "rgba(239,68,68,0.25)", color: st.status === "active" ? "#6EE7B7" : "#FCA5A5", fontSize: ".6rem", fontWeight: 700 }}>{st.status === "active" ? "● Active" : "● Inactive"}</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* 4 Stats Cards */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 14 }}>
                  {[
                    ["Overall Att.", stAttPct + "%", attColor, "calendar-check"],
                    ["This Month", stMonthPresent + " days", "#2563EB", "calendar-alt"],
                    ["Quiz Avg", avgQ + "%", quizColor, "brain"],
                    ["Exams Done", String(stMarks.length), "#D98D04", "file-alt"],
                  ].map(([l, v, c, ic]) => (
                    <div key={l} style={{ background: "#fff", border: "1px solid #D4DEF0", borderRadius: 14, padding: "14px 12px", display: "flex", alignItems: "center", gap: 10 }}>
                      <div style={{ width: 36, height: 36, borderRadius: 10, background: `${c}15`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                        <I n={ic} s={16} c={c} />
                      </div>
                      <div>
                        <div style={{ fontSize: "1rem", fontWeight: 800, color: c }}>{v}</div>
                        <div style={{ fontSize: ".6rem", color: "#6B7F99", marginTop: 1 }}>{l}</div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Recent Attendance Strip */}
                {recentDates.length > 0 && (
                  <div style={{ background: "#fff", border: "1px solid #D4DEF0", borderRadius: 14, padding: 14, marginBottom: 14 }}>
                    <h4 style={{ margin: "0 0 10px", fontSize: ".82rem", fontWeight: 800, color: "#0C1F36" }}><I n="calendar-check" s={12} c="#16A34A" /> Recent Attendance (Last 7 days)</h4>
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                      {recentDates.map(d => {
                        const hasIn = stAtt.some(a => a.date === d && a.type === "in");
                        const dt = new Date(d + "T00:00:00");
                        return (
                          <div key={d} style={{ textAlign: "center", padding: "6px 8px", borderRadius: 10, background: hasIn ? "#F0FDF4" : "#FEF2F2", border: `1px solid ${hasIn ? "#86EFAC" : "#FCA5A5"}`, minWidth: 40 }}>
                            <div style={{ fontSize: ".55rem", color: "#9FB8CF", marginBottom: 1 }}>{["Su","Mo","Tu","We","Th","Fr","Sa"][dt.getDay()]}</div>
                            <div style={{ fontSize: ".7rem", fontWeight: 800, color: hasIn ? "#16A34A" : "#DC2626" }}>{hasIn ? "P" : "A"}</div>
                            <div style={{ fontSize: ".52rem", color: "#9FB8CF" }}>{dt.getDate()}</div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Subject-wise Quiz Performance */}
                {subjectAvgs.length > 0 && (
                  <div style={{ background: "#fff", border: "1px solid #D4DEF0", borderRadius: 14, padding: 14, marginBottom: 14 }}>
                    <h4 style={{ margin: "0 0 12px", fontSize: ".82rem", fontWeight: 800, color: "#0C1F36" }}><I n="chart-bar" s={12} c="#2563EB" /> Subject-wise Performance</h4>
                    {subjectAvgs.map(({ sub, avg, count }) => {
                      const barColor = avg >= 70 ? "#16A34A" : avg >= 50 ? "#D98D04" : "#DC2626";
                      return (
                        <div key={sub} style={{ marginBottom: 10 }}>
                          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                            <span style={{ fontSize: ".78rem", fontWeight: 600 }}>{sub}</span>
                            <span style={{ fontSize: ".72rem", fontWeight: 800, color: barColor }}>{avg}% <span style={{ color: "#9FB8CF", fontWeight: 500 }}>({count} quiz)</span></span>
                          </div>
                          <div style={{ height: 7, background: "#E8EFF8", borderRadius: 99, overflow: "hidden" }}>
                            <div style={{ width: `${avg}%`, height: "100%", background: barColor, borderRadius: 99, transition: "width 0.8s ease" }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Recent Quizzes */}
                {stQuiz.length > 0 && (
                  <div style={{ background: "#fff", border: "1px solid #D4DEF0", borderRadius: 14, padding: 14, marginBottom: 14 }}>
                    <h4 style={{ margin: "0 0 10px", fontSize: ".82rem", fontWeight: 800, color: "#0C1F36" }}><I n="brain" s={12} c="#7C3AED" /> Recent Quizzes</h4>
                    {stQuiz.slice(0, 8).map((q, i) => (
                      <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 0", borderBottom: i < Math.min(stQuiz.length, 8) - 1 ? "1px solid #E8EFF8" : "none" }}>
                        <div>
                          <span style={{ fontSize: ".78rem", fontWeight: 600 }}>{q.subject}</span>
                          {q.chapter && <span style={{ fontSize: ".65rem", color: "#9FB8CF" }}> · {q.chapter}</span>}
                          <div style={{ fontSize: ".6rem", color: "#9FB8CF" }}>{q.difficulty || "medium"} · {q.totalQuestions || 0} Qs</div>
                        </div>
                        <div style={{ textAlign: "right" }}>
                          <span style={{ fontSize: ".82rem", fontWeight: 800, color: (q.percentage || 0) >= 70 ? "#16A34A" : (q.percentage || 0) >= 50 ? "#D98D04" : "#DC2626" }}>{q.percentage || 0}%</span>
                          <div style={{ fontSize: ".6rem", color: "#9FB8CF" }}>{q.grade || ""}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Exam Marks */}
                {stMarks.length > 0 && (
                  <div style={{ background: "#fff", border: "1px solid #D4DEF0", borderRadius: 14, padding: 14, marginBottom: 14 }}>
                    <h4 style={{ margin: "0 0 10px", fontSize: ".82rem", fontWeight: 800, color: "#0C1F36" }}><I n="file-alt" s={12} c="#D98D04" /> Exam Results</h4>
                    {stMarks.slice(0, 5).map((m, i) => {
                      const totalMax = m.totalMax || 100;
                      const pct = Math.round(((m.totalMarks || 0) / totalMax) * 100);
                      const pctColor = pct >= 75 ? "#16A34A" : pct >= 50 ? "#D98D04" : "#DC2626";
                      return (
                        <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 0", borderBottom: i < Math.min(stMarks.length, 5) - 1 ? "1px solid #E8EFF8" : "none" }}>
                          <div>
                            <span style={{ fontSize: ".78rem", fontWeight: 600 }}>{m.examTitle || m.examId || "Exam"}</span>
                            <div style={{ fontSize: ".6rem", color: "#9FB8CF" }}>{m.examDate || ""}</div>
                          </div>
                          <div style={{ textAlign: "right" }}>
                            <span style={{ fontSize: ".82rem", fontWeight: 800, color: pctColor }}>{m.totalMarks || 0}/{totalMax}</span>
                            <div style={{ fontSize: ".6rem", color: pctColor }}>{pct}%</div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Contact Actions */}
                <div style={{ display: "flex", gap: 10, marginBottom: 14 }}>
                  {st.studentPhone && <a href={`tel:${st.studentPhone}`} style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 8, padding: "12px", background: "#1349A8", color: "#fff", borderRadius: 12, textDecoration: "none", fontSize: ".82rem", fontWeight: 700 }}><I n="phone" s={13} c="#fff" /> Call Student</a>}
                  {st.fatherPhone && <a href={`tel:${st.fatherPhone}`} style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 8, padding: "12px", background: "#059669", color: "#fff", borderRadius: 12, textDecoration: "none", fontSize: ".82rem", fontWeight: 700 }}><I n="phone-alt" s={13} c="#fff" /> Call Parent</a>}
                </div>
              </div>
            );
          })()}

          {/* ═══ SEND NOTIFICATION — PID Official Class Structure ═══ */}
          {teacherTab === "notify" && (() => {
            const isDirector = teacher.isDirector === true;
            const notifMsg = tNotifMsg;
            const setNotifMsg = setTNotifMsg;
            const notifType = tNotifType;
            const setNotifType = setTNotifType;

            // PID Official Batch Structure — image ke according
            const PID_BATCHES = [
              { id: "all", label: "All Classes", shortLabel: "All", color: "#0C1F36", desc: "Sabhi students" },
              // Class 12
              { id: "12-eng-cbse-icse", label: "12th English (CBSE+ICSE)", shortLabel: "12 Eng\nCBSE+ICSE", color: "#1349A8", class: "12th", medium: "English", boards: ["CBSE", "ICSE"] },
              { id: "12-hindi-cg-cbse", label: "12th Hindi (CG+CBSE)", shortLabel: "12 Hindi\nCG+CBSE", color: "#2A6FE0", class: "12th", medium: "Hindi", boards: ["CG Board", "CBSE"] },
              { id: "12-eng-cg", label: "12th English (CG Board)", shortLabel: "12 Eng\nCG", color: "#3B82F6", class: "12th", medium: "English", boards: ["CG Board"] },
              // Class 11
              { id: "11-eng-cbse-icse", label: "11th English (CBSE+ICSE)", shortLabel: "11 Eng\nCBSE+ICSE", color: "#059669", class: "11th", medium: "English", boards: ["CBSE", "ICSE"] },
              { id: "11-hindi-cg-cbse", label: "11th Hindi (CG+CBSE)", shortLabel: "11 Hindi\nCG+CBSE", color: "#16A34A", class: "11th", medium: "Hindi", boards: ["CG Board", "CBSE"] },
              { id: "11-eng-cg", label: "11th English (CG Board)", shortLabel: "11 Eng\nCG", color: "#4ADE80", class: "11th", medium: "English", boards: ["CG Board"] },
              // Class 10
              { id: "10-eng-all", label: "10th English (CG+CBSE+ICSE)", shortLabel: "10 Eng\nAll Boards", color: "#7C3AED", class: "10th", medium: "English", boards: ["CG Board", "CBSE", "ICSE"] },
              { id: "10-hindi-cg-cbse", label: "10th Hindi (CG+CBSE)", shortLabel: "10 Hindi\nCG+CBSE", color: "#A78BFA", class: "10th", medium: "Hindi", boards: ["CG Board", "CBSE"] },
              // Class 9
              { id: "9-eng-all", label: "9th English (CG+CBSE+ICSE)", shortLabel: "9 Eng\nAll Boards", color: "#D98D04", class: "9th", medium: "English", boards: ["CG Board", "CBSE", "ICSE"] },
              { id: "9-hindi-cg-cbse", label: "9th Hindi (CG+CBSE)", shortLabel: "9 Hindi\nCG+CBSE", color: "#F5AC10", class: "9th", medium: "Hindi", boards: ["CG Board", "CBSE"] },
              // Lower + Special
              { id: "2-8-all", label: "Class 2nd–8th (All Medium)", shortLabel: "2–8\nAll", color: "#DC2626", class: "2-8", medium: "All", boards: ["CG Board", "CBSE", "ICSE"] },
              { id: "navodaya", label: "Navodaya Entrance", shortLabel: "Navo-\ndaya", color: "#0891B2", class: "Navodaya", medium: "All", boards: [] },
              { id: "prayas", label: "Prayas Awasiya", shortLabel: "Prayas", color: "#0E7490", class: "Prayas", medium: "All", boards: [] },
              { id: "jee-neet", label: "IIT-JEE & NEET (9–12)", shortLabel: "JEE\nNEET", color: "#BE185D", class: "JEE-NEET", medium: "All", boards: [] },
            ];

            // Teacher ke liye sirf relevant batches dikhao (unki classes ke based on)
            // Director ko saare dikhenge
            const teacherClassNums = (teacher.classes || "").split(/[,&]/).map(c => c.trim().replace(/class\s*/i, "").replace(/th/i, "").trim()).filter(Boolean);

            const visibleBatches = isDirector ? PID_BATCHES : PID_BATCHES.filter(b => {
              if (b.id === "all") return true;
              if (!b.class) return false;
              if (b.class === "JEE-NEET") return teacherClassNums.some(tc => ["9","10","11","12"].includes(tc));
              if (b.class === "Navodaya" || b.class === "Prayas" || b.class === "2-8") return teacherClassNums.some(tc => ["2","3","4","5","6","7","8","navodaya","prayas"].includes(tc.toLowerCase()));
              const bClass = b.class.replace(/th/i, "");
              return teacherClassNums.includes(bClass);
            });

            // Count students for selected batch
            const selectedBatch = PID_BATCHES.find(b => b.id === tNotifClass);
            const matchedStudents = tNotifClass === "all" ? tStudents : tStudents.filter(st => {
              if (!selectedBatch || !selectedBatch.class) return false;
              if (selectedBatch.class === "JEE-NEET") {
                const cls = parseInt(st.class || st.presentClass || "0");
                return cls >= 9 && cls <= 12;
              }
              if (selectedBatch.class === "2-8") {
                const cls = parseInt(st.class || st.presentClass || "0");
                return cls >= 2 && cls <= 8;
              }
              if (selectedBatch.class === "Navodaya" || selectedBatch.class === "Prayas") {
                return (st.class || "").toLowerCase().includes(selectedBatch.class.toLowerCase());
              }
              // Class match
              const stClassNum = (st.class || st.presentClass || "").replace(/[^0-9]/g, "");
              const batchClassNum = selectedBatch.class.replace(/[^0-9]/g, "");
              if (stClassNum !== batchClassNum) return false;
              // Medium match
              if (selectedBatch.medium !== "All" && st.medium && st.medium !== selectedBatch.medium) return false;
              // Board match
              if (selectedBatch.boards && selectedBatch.boards.length > 0 && st.board && !selectedBatch.boards.includes(st.board)) return false;
              return true;
            });

            return (
              <div>
                {/* Header */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", margin: "8px 0 14px" }}>
                  <h3 style={{ fontSize: "1rem", fontWeight: 800, margin: 0 }}>Send Notification</h3>
                  {isDirector && <span style={{ fontSize: ".62rem", background: "#FFFBEB", color: "#92400E", border: "1px solid #FDE68A", padding: "3px 8px", borderRadius: 6, fontWeight: 700 }}>👑 Director</span>}
                </div>

                {/* PID Batch Selector Grid */}
                <div style={{ background: "#fff", border: "1px solid #D4DEF0", borderRadius: 14, padding: 14, marginBottom: 14 }}>
                  <p style={{ fontSize: ".72rem", fontWeight: 700, color: "#6B7F99", margin: "0 0 10px" }}>📚 Batch Select Karo (Kis class ko bhejna hai?)</p>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 6 }}>
                    {visibleBatches.map(b => {
                      const isSelected = tNotifClass === b.id;
                      return (
                        <button key={b.id} onClick={() => setTNotifClass(b.id)}
                          style={{
                            padding: "8px 4px", borderRadius: 10,
                            border: `2px solid ${isSelected ? b.color : "#E8EFF8"}`,
                            background: isSelected ? b.color : "#F8FAFD",
                            color: isSelected ? "#fff" : "#4A5E78",
                            fontSize: ".6rem", fontWeight: 700, cursor: "pointer",
                            whiteSpace: "pre-line", lineHeight: 1.3, textAlign: "center",
                            transition: "all 0.15s",
                            boxShadow: isSelected ? `0 2px 8px ${b.color}40` : "none"
                          }}>
                          {b.shortLabel || b.label}
                        </button>
                      );
                    })}
                  </div>

                  {/* Selected Batch Info */}
                  {selectedBatch && tNotifClass !== "all" && (
                    <div style={{ marginTop: 10, padding: "8px 12px", borderRadius: 10, background: `${selectedBatch.color}08`, border: `1px solid ${selectedBatch.color}25`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <div>
                        <span style={{ fontSize: ".72rem", fontWeight: 800, color: selectedBatch.color }}>{selectedBatch.label}</span>
                        {selectedBatch.medium !== "All" && <span style={{ fontSize: ".62rem", color: "#7C3AED", marginLeft: 6 }}>· {selectedBatch.medium} Medium</span>}
                        {selectedBatch.boards?.length > 0 && <span style={{ fontSize: ".62rem", color: "#6B7F99", marginLeft: 6 }}>· {selectedBatch.boards.join("+")}</span>}
                      </div>
                      <span style={{ fontSize: ".75rem", fontWeight: 800, color: selectedBatch.color, background: `${selectedBatch.color}15`, padding: "3px 10px", borderRadius: 20 }}>
                        {matchedStudents.length} students
                      </span>
                    </div>
                  )}
                  {tNotifClass === "all" && (
                    <div style={{ marginTop: 10, padding: "8px 12px", borderRadius: 10, background: "#0C1F3608", border: "1px solid #0C1F3625", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <span style={{ fontSize: ".72rem", fontWeight: 800, color: "#0C1F36" }}>All Classes — Sabhi Students</span>
                      <span style={{ fontSize: ".75rem", fontWeight: 800, color: "#0C1F36", background: "#0C1F3615", padding: "3px 10px", borderRadius: 20 }}>{tStudents.length} students</span>
                    </div>
                  )}
                </div>

                {/* Notification Form */}
                <div style={{ background: "#fff", border: "1px solid #D4DEF0", borderRadius: 16, padding: 16, marginBottom: 14 }}>
                  <label style={{ display: "block", fontSize: ".75rem", fontWeight: 700, color: "#6B7F99", marginBottom: 4 }}>Type</label>
                  <select value={notifType} onChange={e => setNotifType(e.target.value)} style={{ width: "100%", padding: "10px", borderRadius: 10, border: "1px solid #D4DEF0", fontSize: ".85rem", marginBottom: 12, outline: "none" }}>
                    <option value="general">📢 General</option>
                    <option value="test">📝 Test</option>
                    <option value="holiday">🎉 Holiday</option>
                    <option value="fee">💰 Fee</option>
                    <option value="result">🏆 Result</option>
                  </select>
                  <label style={{ display: "block", fontSize: ".75rem", fontWeight: 700, color: "#6B7F99", marginBottom: 4 }}>Message *</label>
                  <textarea rows={3} value={notifMsg} onChange={e => setNotifMsg(e.target.value)} placeholder="Notification message likho..." style={{ width: "100%", padding: "10px", borderRadius: 10, border: "1px solid #D4DEF0", fontSize: ".85rem", marginBottom: 4, outline: "none", resize: "none", fontFamily: "'Inter', sans-serif" }} />
                  <p style={{ fontSize: ".65rem", color: "#9FB8CF", margin: "0 0 12px" }}>
                    → {selectedBatch ? selectedBatch.label : "All Classes"} · {matchedStudents.length} students ko milegi
                  </p>
                  <button onClick={async () => {
                    if (!notifMsg.trim()) { alert("Message likho!"); return; }
                    try {
                      await addDoc(collection(db, "scheduled_notifications"), {
                        message: notifMsg.trim(),
                        notifType: notifType,
                        classFilter: tNotifClass,
                        batchLabel: selectedBatch?.label || "All Classes",
                        date: new Date().toISOString().split("T")[0],
                        time: new Date().toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" }),
                        sentBy: teacher.name,
                        sentByRole: isDirector ? "director" : "teacher",
                        createdAt: serverTimestamp()
                      });
                      setNotifMsg("");
                      alert("✅ Notification sent!");
                    } catch (e) { alert("Error: " + e.message); }
                  }} style={{ width: "100%", padding: "12px", borderRadius: 12, border: "none", background: `linear-gradient(135deg, ${selectedBatch?.color || "#1349A8"}, #2A6FE0)`, color: "#fff", fontSize: ".88rem", fontWeight: 700, cursor: "pointer" }}>
                    <I n="paper-plane" s={13} c="#fff" /> Send to {selectedBatch?.shortLabel?.replace("\n", " ") || "All Classes"}
                  </button>
                </div>

                {/* Recent Notifications */}
                <h4 style={{ fontSize: ".85rem", fontWeight: 700, margin: "0 0 10px" }}>Recent Notifications</h4>
                {tNotifications.length === 0 ? (
                  <p style={{ fontSize: ".78rem", color: "#6B7F99", textAlign: "center", padding: 20 }}>Koi notification nahi bheji gayi abhi</p>
                ) : tNotifications.slice(0, 15).map(n => {
                  const typeColors = { general: "#1349A8", test: "#7C3AED", holiday: "#059669", fee: "#D98D04", result: "#DC2626" };
                  const tc = typeColors[n.notifType] || "#1349A8";
                  const batchInfo = PID_BATCHES.find(b => b.id === n.classFilter);
                  return (
                    <div key={n.id} style={{ background: "#fff", border: "1px solid #D4DEF0", borderRadius: 12, padding: "10px 14px", marginBottom: 6, borderLeft: `3px solid ${batchInfo?.color || tc}` }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 4 }}>
                        <p style={{ margin: 0, fontSize: ".8rem", fontWeight: 600, flex: 1, paddingRight: 6 }}>{n.message}</p>
                        <span style={{ fontSize: ".58rem", color: "#fff", background: tc, padding: "2px 7px", borderRadius: 6, fontWeight: 700, flexShrink: 0 }}>{n.notifType || "general"}</span>
                      </div>
                      <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
                        <span style={{ fontSize: ".6rem", color: "#6B7F99" }}>{n.date || ""}</span>
                        <span style={{ fontSize: ".6rem", fontWeight: 700, color: batchInfo?.color || "#1349A8", background: `${batchInfo?.color || "#1349A8"}12`, padding: "1px 7px", borderRadius: 4 }}>
                          {n.batchLabel || (n.classFilter === "all" || !n.classFilter ? "All Classes" : `Class ${n.classFilter}`)}
                        </span>
                        {n.sentBy && <span style={{ fontSize: ".6rem", color: "#6B7F99" }}>· {n.sentBy}</span>}
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })()}

          {/* ═══ LEAVE APPLICATION ═══ */}
          {teacherTab === "leave" && (
            <div>
              <h3 style={{ fontSize: "1rem", fontWeight: 800, margin: "8px 0 12px" }}>Leave Application</h3>
              <div style={{ background: "#fff", border: "1px solid #D4DEF0", borderRadius: 16, padding: 18, marginBottom: 14 }}>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
                  <div><label style={{ display: "block", fontSize: ".75rem", fontWeight: 700, color: "#6B7F99", marginBottom: 4 }}>From Date *</label><input type="date" value={leaveFrom} onChange={e => setLeaveFrom(e.target.value)} style={{ width: "100%", padding: "10px", borderRadius: 10, border: "1px solid #D4DEF0", fontSize: ".85rem", outline: "none" }} /></div>
                  <div><label style={{ display: "block", fontSize: ".75rem", fontWeight: 700, color: "#6B7F99", marginBottom: 4 }}>To Date</label><input type="date" value={leaveTo} onChange={e => setLeaveTo(e.target.value)} min={leaveFrom} style={{ width: "100%", padding: "10px", borderRadius: 10, border: "1px solid #D4DEF0", fontSize: ".85rem", outline: "none" }} /></div>
                </div>
                <label style={{ display: "block", fontSize: ".75rem", fontWeight: 700, color: "#6B7F99", marginBottom: 4 }}>Reason *</label>
                <textarea rows={3} placeholder="Leave ka reason likho..." value={leaveReason} onChange={e => setLeaveReason(e.target.value)} style={{ width: "100%", padding: "10px", borderRadius: 10, border: "1px solid #D4DEF0", fontSize: ".85rem", marginBottom: 12, outline: "none", resize: "none", fontFamily: "'Inter', sans-serif" }} />
                <p style={{ fontSize: ".7rem", color: "#6B7F99", margin: "0 0 12px" }}>{leaveFrom && leaveTo ? `${Math.ceil((new Date(leaveTo) - new Date(leaveFrom)) / (1000*60*60*24)) + 1} din ki chutti` : leaveFrom ? "1 din ki chutti" : "Dates select karo"}</p>
                <button onClick={submitLeave} disabled={leaveSubmitting} style={{ width: "100%", padding: "12px", borderRadius: 12, border: "none", background: "linear-gradient(135deg, #059669, #10B981)", color: "#fff", fontSize: ".88rem", fontWeight: 700, cursor: "pointer", opacity: leaveSubmitting ? 0.6 : 1 }}><I n="paper-plane" s={13} c="#fff" /> {leaveSubmitting ? "Submitting..." : "Submit Leave"}</button>
              </div>
              <h4 style={{ fontSize: ".85rem", fontWeight: 700, margin: "0 0 10px" }}>My Leave History</h4>
              {myLeaves.length === 0 ? <p style={{ fontSize: ".78rem", color: "#6B7F99", textAlign: "center", padding: 20 }}>Koi leave application nahi hai</p> : myLeaves.map(lv => {
                // Check if within 24 hours of creation
                const createdAt = lv.createdAt?.toDate?.() || null;
                const canEdit = createdAt && (Date.now() - createdAt.getTime()) < 24 * 60 * 60 * 1000;
                const isEditing = editingLeave?.id === lv.id;
                return (
                  <div key={lv.id} style={{ background: "#fff", border: "1px solid #D4DEF0", borderRadius: 12, padding: "12px 14px", marginBottom: 8, borderLeft: "3px solid #16A34A" }}>
                    {isEditing ? (
                      <div>
                        <p style={{ margin: "0 0 8px", fontSize: ".75rem", fontWeight: 700, color: "#1349A8" }}>✏️ Leave Edit Karo</p>
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 8 }}>
                          <div><label style={{ fontSize: ".7rem", color: "#6B7F99", fontWeight: 600 }}>From *</label><input type="date" value={editLeaveFrom} onChange={e => setEditLeaveFrom(e.target.value)} style={{ width: "100%", padding: "8px", borderRadius: 8, border: "1px solid #D4DEF0", fontSize: ".8rem", outline: "none" }} /></div>
                          <div><label style={{ fontSize: ".7rem", color: "#6B7F99", fontWeight: 600 }}>To</label><input type="date" value={editLeaveTo} onChange={e => setEditLeaveTo(e.target.value)} min={editLeaveFrom} style={{ width: "100%", padding: "8px", borderRadius: 8, border: "1px solid #D4DEF0", fontSize: ".8rem", outline: "none" }} /></div>
                        </div>
                        <textarea rows={2} value={editLeaveReason} onChange={e => setEditLeaveReason(e.target.value)} style={{ width: "100%", padding: "8px", borderRadius: 8, border: "1px solid #D4DEF0", fontSize: ".8rem", outline: "none", resize: "none", fontFamily: "inherit", marginBottom: 8 }} />
                        <div style={{ display: "flex", gap: 8 }}>
                          <button onClick={saveEditLeave} disabled={editLeaveSubmitting} style={{ flex: 1, padding: "8px", borderRadius: 8, border: "none", background: "#059669", color: "#fff", fontSize: ".78rem", fontWeight: 700, cursor: "pointer" }}>{editLeaveSubmitting ? "Saving..." : "Save"}</button>
                          <button onClick={() => setEditingLeave(null)} style={{ flex: 1, padding: "8px", borderRadius: 8, border: "1px solid #D4DEF0", background: "#fff", color: "#6B7F99", fontSize: ".78rem", fontWeight: 700, cursor: "pointer" }}>Cancel</button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                          <span style={{ fontSize: ".82rem", fontWeight: 700 }}>{lv.fromDate}{lv.toDate && lv.toDate !== lv.fromDate ? ` → ${lv.toDate}` : ""}</span>
                          <span style={{ padding: "2px 8px", borderRadius: 6, fontSize: ".6rem", fontWeight: 700, background: "#F0FDF4", color: "#16A34A" }}>✓ Approved</span>
                        </div>
                        <p style={{ margin: "0 0 8px", fontSize: ".78rem", color: "#4A5E78" }}>{lv.reason}</p>
                        {canEdit && (
                          <div style={{ display: "flex", gap: 6 }}>
                            <button onClick={() => { setEditingLeave(lv); setEditLeaveFrom(lv.fromDate); setEditLeaveTo(lv.toDate || ""); setEditLeaveReason(lv.reason); }} style={{ padding: "5px 12px", borderRadius: 8, border: "1px solid #1349A8", background: "#EFF6FF", color: "#1349A8", fontSize: ".7rem", fontWeight: 700, cursor: "pointer" }}>✏️ Edit</button>
                            <button onClick={() => deleteLeave(lv.id)} style={{ padding: "5px 12px", borderRadius: 8, border: "1px solid #DC2626", background: "#FEF2F2", color: "#DC2626", fontSize: ".7rem", fontWeight: 700, cursor: "pointer" }}>🗑 Delete</button>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    );
  }

  if (!student) return (
    <div style={{ height: "100vh", background: "#0B1120", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
      <I n="exclamation-triangle" s={40} c="#D4A843" />
      <p style={{ color: "#E8EDF5", fontWeight: 600, marginTop: 16 }}>Profile not found</p>
      <button onClick={() => { signOut(auth); setLoginRole(null); }} style={{ marginTop: 12, padding: "10px 24px", borderRadius: 12, background: "#D4A843", color: "#0C1F36", border: "none", fontWeight: 700, cursor: "pointer" }}>Try Again</button>
    </div>
  );

  // ═══ APP WRAPPER ═══
  return (
    <div style={{ background: dark ? "#070D1A" : "#D4DEF0", minHeight: "100vh", display: "flex", justifyContent: "center", fontFamily: "'Inter', 'DM Sans', sans-serif" }}>
      <style>{`
        * { box-sizing: border-box; -webkit-tap-highlight-color: transparent; }
        ::-webkit-scrollbar { display: none; }
        .fade-in { animation: fadeIn 0.35s ease; }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes blink { 0%,100% { opacity: 1; } 50% { opacity: 0; } }
        @keyframes pulse { 0%,100% { opacity: 1; } 50% { opacity: 0.5; } }
        @keyframes slideUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
        .typCur::after { content: '▊'; animation: blink .7s infinite; color: ${T.success}; margin-left: 1px; }
        .fadeMsg { animation: fadeIn .35s ease; }
        .slideIn { animation: slideUp .25s ease; }
        textarea:focus, input:focus, select:focus { border-color: ${T.accent} !important; }
      `}</style>

      {/* Hidden file inputs */}
      <input ref={fileInputRef} type="file" accept="image/*" onChange={handleImageUpload} style={{ display: "none" }} />
      <input ref={camInputRef} type="file" accept="image/*" capture="environment" onChange={handleImageUpload} style={{ display: "none" }} />
      <input id="pdfInput" type="file" accept=".pdf,image/*" onChange={handleImageUpload} style={{ display: "none" }} />

      {/* Mobile Frame */}
      <div style={{ width: "100%", maxWidth: 460, height: "100vh", background: T.bg, color: T.text, display: "flex", flexDirection: "column", position: "relative", overflow: "hidden", boxShadow: "0 0 60px rgba(0,0,0,0.3)" }}>

        {/* ═══ TOP HEADER — Navy Bar ═══ */}
        <div style={{ padding: "16px 20px 12px", display: "flex", justifyContent: "space-between", alignItems: "center", background: T.navBg, zIndex: 10, borderBottom: `1px solid ${dark ? '#1C2D45' : '#0C1F3680'}` }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ width: 38, height: 38, borderRadius: 10, background: `linear-gradient(135deg, ${T.gold}, #B8912E)`, display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 2px 10px rgba(212,168,67,0.25)" }}>
              <img src="/pid_logo.png" alt="" style={{ width: 24, height: 24, borderRadius: 4 }} onError={e => e.target.style.display = 'none'} />
            </div>
            <div>
              <h2 style={{ margin: 0, fontSize: "1rem", fontWeight: 800, color: "#E8EDF5" }}>
                {student.isEnrolled ? `Hi, ${student.studentName.split(" ")[0]} 👋` : "Welcome, Guest"}
              </h2>
              <p style={{ margin: 0, fontSize: ".7rem", color: "#6B7F99" }}>
                {student.isEnrolled ? `Class ${student.class || student.presentClass} · PID` : "Explore our batches"}
              </p>
            </div>
          </div>
          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <button onClick={() => setDark(!dark)} style={{ width: 34, height: 34, borderRadius: 10, background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", color: dark ? "#D4A843" : "#9FB8CF", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <I n={dark ? "sun" : "moon"} s={14} />
            </button>
            <div onClick={() => signOut(auth)} style={{ width: 34, height: 34, borderRadius: 10, background: `linear-gradient(135deg, ${T.accent}, #2563EB)`, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, cursor: "pointer", fontSize: ".85rem" }}>
              {student.studentName.charAt(0).toUpperCase()}
            </div>
          </div>
        </div>

        {/* ═══ MAIN CONTENT AREA ═══ */}
        <div style={{ flex: 1, overflowY: activeTab === "ai" ? "hidden" : "auto", paddingBottom: activeTab === "ai" ? 0 : 80, display: "flex", flexDirection: "column" }} className="fade-in">

          {/* ═══ 1. DASHBOARD TAB ═══ */}
          {activeTab === "dashboard" && student.isEnrolled && (
            <div style={{ padding: 20 }}>
              {/* Hero Card */}
              <div style={{ background: `linear-gradient(135deg, ${T.gradStart}, ${T.gradEnd})`, borderRadius: 22, padding: 24, color: "#fff", marginBottom: 20, position: "relative", overflow: "hidden", border: `1px solid ${dark ? '#1C2D45' : '#1A3A5C'}` }}>
                <div style={{ position: "absolute", right: -15, bottom: -15, width: 100, height: 100, borderRadius: "50%", background: "rgba(212,168,67,0.08)" }} />
                <div style={{ position: "absolute", right: 20, top: 20, width: 50, height: 50, borderRadius: "50%", background: "rgba(212,168,67,0.06)" }} />
                <p style={{ margin: "0 0 4px", fontSize: ".8rem", opacity: 0.8, fontWeight: 600, textTransform: "uppercase", letterSpacing: "1px" }}>Overall Performance</p>
                <div style={{ display: "flex", alignItems: "flex-end", gap: 12 }}>
                  <h1 style={{ margin: 0, fontSize: "2.8rem", fontWeight: 900, color: "#D4A843", lineHeight: 1 }}>{avgQuiz}%</h1>
                  <span style={{ padding: "4px 10px", background: "rgba(212,168,67,0.15)", borderRadius: 8, fontSize: ".72rem", fontWeight: 700, marginBottom: 6, color: "#D4A843", border: "1px solid rgba(212,168,67,0.2)" }}>Avg Score</span>
                </div>
                <div style={{ display: "flex", gap: 16, marginTop: 20, flexWrap: "wrap" }}>
                  <div><p style={{ margin: 0, fontSize: ".68rem", opacity: 0.7, textTransform: "uppercase", letterSpacing: "1px" }}>Monthly</p><p style={{ margin: 0, fontSize: "1.15rem", fontWeight: 800 }}>{attPct}%</p><p style={{ margin: 0, fontSize: ".55rem", opacity: 0.5 }}>{monthPresentDays}/{monthWorkingDays} days</p></div>
                  <div><p style={{ margin: 0, fontSize: ".68rem", opacity: 0.7, textTransform: "uppercase", letterSpacing: "1px" }}>Overall</p><p style={{ margin: 0, fontSize: "1.15rem", fontWeight: 800 }}>{overallAttPct}%</p><p style={{ margin: 0, fontSize: ".55rem", opacity: 0.5 }}>{overallPresentDays}/{overallTotalDays} days</p></div>
                  <div><p style={{ margin: 0, fontSize: ".68rem", opacity: 0.7, textTransform: "uppercase", letterSpacing: "1px" }}>Tests</p><p style={{ margin: 0, fontSize: "1.15rem", fontWeight: 800 }}>{quizHistory.length}</p></div>
                  <div><p style={{ margin: 0, fontSize: ".68rem", opacity: 0.7, textTransform: "uppercase", letterSpacing: "1px" }}>Doubts</p><p style={{ margin: 0, fontSize: "1.15rem", fontWeight: 800 }}>{doubtHistory.length}</p></div>
                </div>
              </div>

              {/* Quick Access Grid */}
              <h3 style={{ fontSize: "1rem", fontWeight: 800, margin: "0 0 14px", display: "flex", alignItems: "center", gap: 8 }}>
                <I n="bolt" s={14} c={T.gold} /> Quick Access
              </h3>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                {[
                  { tab: "myBatches", i: "chalkboard-user", l: "My Batches", d: "Lectures & DPPs", c: T.accent, bg: dark ? "#0F1E38" : "#EFF6FF" },
                  { tab: "ai", i: "robot", l: "AI Tutor", d: "24/7 Doubt Solver", c: T.success, bg: dark ? "#0D2118" : "#ECFDF5" },
                  { tab: "tests", i: "laptop-code", l: "Online Tests", d: "Live MCQ Tests", c: T.orange, bg: dark ? "#1C1A0E" : "#FFFBEB" },
                  { tab: "library", i: "book", l: "E-Books", d: "Free NCERTs", c: T.purple, bg: dark ? "#1A0F2E" : "#FAF5FF" },
                ].map(item => (
                  <div key={item.tab} onClick={() => { setActiveTab(item.tab === "ai" ? "ai" : item.tab); if (item.tab === "ai") setAiSubTab("doubt"); }}
                    style={{ background: T.card, padding: 18, borderRadius: 18, border: `1px solid ${T.border}`, cursor: "pointer", transition: "all 0.2s", borderLeft: `3px solid ${item.c}` }}
                    onMouseEnter={e => e.currentTarget.style.background = T.cardHover}
                    onMouseLeave={e => e.currentTarget.style.background = T.card}
                  >
                    <div style={{ width: 40, height: 40, borderRadius: 12, background: item.bg, color: item.c, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 12 }}>
                      <I n={item.i} s={18} />
                    </div>
                    <h4 style={{ margin: 0, fontSize: ".88rem", fontWeight: 700 }}>{item.l}</h4>
                    <p style={{ margin: "4px 0 0", fontSize: ".72rem", color: T.text3 }}>{item.d}</p>
                  </div>
                ))}
              </div>

              {/* Weak Subjects Alert */}
              {weakSubjects.length > 0 && (
                <div style={{ marginTop: 16, background: dark ? "#1C1A0E" : "#FFFBEB", borderRadius: 14, padding: 16, border: `1px solid ${dark ? '#3D3516' : '#FDE68A'}`, display: "flex", alignItems: "center", gap: 12 }}>
                  <I n="exclamation-triangle" s={18} c={T.orange} />
                  <div>
                    <p style={{ margin: 0, fontSize: ".8rem", fontWeight: 700, color: T.orange }}>Focus Areas</p>
                    <p style={{ margin: "2px 0 0", fontSize: ".75rem", color: T.text3 }}>{weakSubjects.join(", ")} — Practice more!</p>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ═══ 2. EXPLORE BATCHES TAB ═══ */}
          {activeTab === "explore" && (
            <div style={{ padding: 20 }}>
              {!exploreDetailCourse ? (
                <>
                  <h2 style={{ fontSize: "1.3rem", fontWeight: 800, margin: "0 0 6px" }}>Explore Batches</h2>
                  <p style={{ fontSize: ".82rem", color: T.text3, margin: "0 0 20px" }}>PID Institute ke courses dekho aur enroll karo</p>
                  <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                    {courses.map(c => (
                      <div key={c.id} style={{ background: T.card, borderRadius: 20, overflow: "hidden", border: `1px solid ${T.border}` }}>
                        <div style={{ height: 120, background: c.posterUrl ? `url(${c.posterUrl}) center/cover` : `linear-gradient(135deg, ${T.gradStart}, ${T.gradEnd})`, position: "relative" }}>
                          <div style={{ position: "absolute", bottom: 10, left: 14, background: "rgba(0,0,0,0.65)", color: "#D4A843", padding: "4px 10px", borderRadius: 8, fontSize: ".72rem", backdropFilter: "blur(4px)", fontWeight: 700 }}>{c.duration || "1 Year"}</div>
                        </div>
                        <div style={{ padding: 16 }}>
                          <h3 style={{ margin: "0 0 8px", fontSize: "1.1rem", fontWeight: 800 }}>{c.title}</h3>
                          <p style={{ margin: "0 0 12px", fontSize: ".78rem", color: T.text3, lineHeight: 1.5 }}>{(c.desc || "").slice(0, 100)}{(c.desc || "").length > 100 ? "..." : ""}</p>
                          <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginBottom: 14 }}>
                            {(c.subjects || []).map((sub, i) => <span key={i} style={{ padding: "3px 8px", borderRadius: 6, background: dark ? T.card : "#F0F4FA", border: `1px solid ${T.border}`, fontSize: ".65rem", fontWeight: 600, color: T.text2 }}>{sub}</span>)}
                          </div>
                          <div style={{ display: "flex", gap: 8 }}>
                            <button onClick={() => setEnrollContact(enrollContact === c.id ? null : c.id)} style={{ flex: 1, padding: "10px 0", borderRadius: 12, border: "none", background: `linear-gradient(135deg, ${T.success}, #10B981)`, color: "#fff", fontSize: ".8rem", fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}><I n="user-plus" s={13} c="#fff" /> Enroll Now</button>
                            <button onClick={() => setExploreDetailCourse(c)} style={{ flex: 1, padding: "10px 0", borderRadius: 12, border: `1px solid ${T.accent}`, background: "transparent", color: T.accent, fontSize: ".8rem", fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}><I n="info-circle" s={13} /> Explore</button>
                          </div>
                          {enrollContact === c.id && (
                            <div style={{ marginTop: 12, background: dark ? "#0D2118" : "#ECFDF5", border: `1px solid ${dark ? '#1B4332' : '#86EFAC'}`, borderRadius: 14, padding: 16 }}>
                              <p style={{ margin: "0 0 10px", fontSize: ".82rem", fontWeight: 700, color: T.success }}><I n="phone-alt" s={12} c={T.success} /> Admission ke liye contact karo</p>
                              <p style={{ margin: "0 0 12px", fontSize: ".88rem", fontWeight: 800, color: T.text }}>8319002877 / 7470412110</p>
                              <div style={{ display: "flex", gap: 8 }}>
                                <a href="tel:8319002877" style={{ flex: 1, padding: "10px 0", borderRadius: 10, background: `linear-gradient(135deg, ${T.accent}, #2563EB)`, color: "#fff", fontSize: ".8rem", fontWeight: 700, textDecoration: "none", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}><I n="phone" s={13} c="#fff" /> Call</a>
                                <a href={`https://wa.me/918319002877?text=${encodeURIComponent("Hi, I want to enroll in *" + c.title + "* at PID Dongargaon. Please share details.")}`} target="_blank" rel="noopener noreferrer" style={{ flex: 1, padding: "10px 0", borderRadius: 10, background: `linear-gradient(135deg, ${T.success}, #10B981)`, color: "#fff", fontSize: ".8rem", fontWeight: 700, textDecoration: "none", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}><I n="comment-dots" s={13} c="#fff" /> WhatsApp</a>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <div>
                  <button onClick={() => setExploreDetailCourse(null)} style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 10, padding: "8px 14px", marginBottom: 16, display: "flex", alignItems: "center", gap: 6, fontWeight: 600, cursor: "pointer", color: T.text3, fontSize: ".8rem" }}><I n="arrow-left" s={12} /> Back to Courses</button>
                  <div style={{ height: 160, borderRadius: 20, overflow: "hidden", marginBottom: 16, background: exploreDetailCourse.posterUrl ? `url(${exploreDetailCourse.posterUrl}) center/cover` : `linear-gradient(135deg, ${T.gradStart}, ${T.gradEnd})`, display: "flex", alignItems: "flex-end", padding: 20 }}>
                    <div><h2 style={{ margin: "0 0 4px", fontSize: "1.3rem", fontWeight: 900, color: "#fff" }}>{exploreDetailCourse.title}</h2>
                    {exploreDetailCourse.tag && <span style={{ padding: "3px 10px", borderRadius: 8, fontSize: ".65rem", fontWeight: 700, background: "rgba(255,255,255,.2)", color: "#fff" }}>{exploreDetailCourse.tag}</span>}</div>
                  </div>
                  {exploreDetailCourse.desc && <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 16, padding: 16, marginBottom: 14 }}><p style={{ margin: 0, fontSize: ".82rem", color: T.text2, lineHeight: 1.7 }}>{exploreDetailCourse.desc}</p></div>}
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 14 }}>
                    {[["Duration", exploreDetailCourse.duration, "clock", T.accent], ["Timing", exploreDetailCourse.timing, "calendar-alt", T.purple], ["Batch Size", exploreDetailCourse.batchSize ? exploreDetailCourse.batchSize + " students" : null, "users", T.success], ["Start Date", exploreDetailCourse.startDate, "calendar-check", T.orange]].filter(([,v]) => v).map(([l, v, ic, col]) => (
                      <div key={l} style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 14, padding: "14px 12px", display: "flex", alignItems: "center", gap: 10 }}>
                        <div style={{ width: 34, height: 34, borderRadius: 10, background: col + "15", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><I n={ic} s={14} c={col} /></div>
                        <div><p style={{ margin: 0, fontSize: ".62rem", color: T.text3 }}>{l}</p><p style={{ margin: "2px 0 0", fontSize: ".85rem", fontWeight: 700 }}>{v}</p></div>
                      </div>
                    ))}
                  </div>
                  {(exploreDetailCourse.subjects || []).length > 0 && <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 16, padding: 16, marginBottom: 14 }}>
                    <h4 style={{ margin: "0 0 10px", fontSize: ".85rem", fontWeight: 800 }}><I n="book" s={12} c={T.accent} /> Subjects</h4>
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>{(exploreDetailCourse.subjects || []).map((sub, i) => <span key={i} style={{ padding: "6px 14px", borderRadius: 10, background: `linear-gradient(135deg, ${T.accent}, #2563EB)`, color: "#fff", fontSize: ".75rem", fontWeight: 700 }}>{sub}</span>)}</div>
                  </div>}
                  {(exploreDetailCourse.teachers || []).length > 0 && <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 16, padding: 16, marginBottom: 14 }}>
                    <h4 style={{ margin: "0 0 12px", fontSize: ".85rem", fontWeight: 800 }}><I n="chalkboard-teacher" s={12} c={T.accent} /> Our Faculty</h4>
                    {exploreDetailCourse.teachers.map((t, i) => (
                      <div key={i} style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 10, padding: "12px 14px", background: dark ? "#162544" : "#F5F8FF", borderRadius: 14, border: `1px solid ${T.border}` }}>
                        <div style={{ width: 48, height: 48, borderRadius: 14, overflow: "hidden", flexShrink: 0, background: `linear-gradient(135deg, ${T.accent}, #2563EB)`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                          {t.photo ? <img src={t.photo} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : <I n="user-tie" s={20} c="#fff" />}
                        </div>
                        <div style={{ flex: 1 }}>
                          <h4 style={{ margin: 0, fontSize: ".88rem", fontWeight: 800 }}>{t.name}</h4>
                          <p style={{ margin: "2px 0 0", fontSize: ".7rem", color: T.text3 }}>{t.subject || ""}{t.exp ? ` · ${t.exp}` : ""}{t.qualification ? ` · ${t.qualification}` : ""}</p>
                        </div>
                      </div>
                    ))}
                  </div>}
                  {(exploreDetailCourse.facilities || exploreDetailCourse.features || []).length > 0 && <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 16, padding: 16, marginBottom: 14 }}>
                    <h4 style={{ margin: "0 0 10px", fontSize: ".85rem", fontWeight: 800 }}><I n="check-circle" s={12} c={T.success} /> Facilities</h4>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>{(exploreDetailCourse.facilities || exploreDetailCourse.features || []).map((f, i) => <span key={i} style={{ padding: "6px 12px", borderRadius: 10, background: dark ? "#0D2118" : "#ECFDF5", border: `1px solid ${dark ? '#1B4332' : '#86EFAC'}`, fontSize: ".75rem", fontWeight: 600, color: T.success, display: "flex", alignItems: "center", gap: 6 }}><I n="check" s={10} c={T.success} /> {f}</span>)}</div>
                  </div>}
                  <div style={{ background: `linear-gradient(135deg, ${T.gradStart}, ${T.gradEnd})`, borderRadius: 16, padding: 20, marginBottom: 14, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div><p style={{ margin: 0, fontSize: ".72rem", color: "rgba(255,255,255,.6)" }}>Course Fee</p><p style={{ margin: "4px 0 0", fontSize: "1.4rem", fontWeight: 900, color: "#D4A843" }}>{exploreDetailCourse.price ? `₹${Number(exploreDetailCourse.price).toLocaleString("en-IN")}` : "Contact for fee"}</p></div>
                    <span style={{ fontSize: ".72rem", color: "rgba(255,255,255,.6)" }}>{exploreDetailCourse.duration || "Full Course"}</span>
                  </div>
                  <button onClick={() => setEnrollContact(enrollContact === exploreDetailCourse.id ? null : exploreDetailCourse.id)} style={{ width: "100%", padding: "14px", borderRadius: 14, border: "none", background: `linear-gradient(135deg, ${T.success}, #10B981)`, color: "#fff", fontSize: ".9rem", fontWeight: 800, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, marginBottom: 10 }}><I n="user-plus" s={14} c="#fff" /> Enroll Now</button>
                  {enrollContact === exploreDetailCourse.id && (
                    <div style={{ background: dark ? "#0D2118" : "#ECFDF5", border: `1px solid ${dark ? '#1B4332' : '#86EFAC'}`, borderRadius: 14, padding: 16 }}>
                      <p style={{ margin: "0 0 10px", fontSize: ".82rem", fontWeight: 700, color: T.success }}><I n="phone-alt" s={12} c={T.success} /> Admission ke liye contact karo</p>
                      <p style={{ margin: "0 0 12px", fontSize: ".88rem", fontWeight: 800, color: T.text }}>8319002877 / 7470412110</p>
                      <div style={{ display: "flex", gap: 8 }}>
                        <a href="tel:8319002877" style={{ flex: 1, padding: "10px 0", borderRadius: 10, background: `linear-gradient(135deg, ${T.accent}, #2563EB)`, color: "#fff", fontSize: ".8rem", fontWeight: 700, textDecoration: "none", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}><I n="phone" s={13} c="#fff" /> Call</a>
                        <a href={`https://wa.me/918319002877?text=${encodeURIComponent("Hi, I want to enroll in *" + exploreDetailCourse.title + "* at PID Dongargaon. Please share details.")}`} target="_blank" rel="noopener noreferrer" style={{ flex: 1, padding: "10px 0", borderRadius: 10, background: `linear-gradient(135deg, ${T.success}, #10B981)`, color: "#fff", fontSize: ".8rem", fontWeight: 700, textDecoration: "none", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}><I n="comment-dots" s={13} c="#fff" /> WhatsApp</a>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* ═══ 3. MY BATCHES TAB ═══ */}
          {activeTab === "myBatches" && (
            <div style={{ padding: 20 }}>
              {!selectedCourse ? (
                <>
                  <h2 style={{ fontSize: "1.3rem", fontWeight: 800, margin: "0 0 16px" }}>My Batches</h2>
                  {courses.filter(c => {
                    if (!student?.isEnrolled) return false;
                    const cls = (student.class || student.presentClass || "").toLowerCase().trim();
                    const enrolledId = (student.courseId || student.batchId || "").toLowerCase().trim();
                    const cId = (c.id || "").toLowerCase();
                    const cClassId = (c.classId || "").toLowerCase();
                    const cTitle = (c.title || "").toLowerCase();
                    if (enrolledId && (cId === enrolledId || cClassId === enrolledId)) return true;
                    if (cls && cClassId && cClassId === cls) return true;
                    const clsNum = cls.replace(/[^0-9]/g, "");
                    if (clsNum && cTitle.includes("class " + clsNum)) return true;
                    if (clsNum && cClassId.includes(clsNum)) return true;
                    return false;
                  }).map(c => (
                    <div key={c.id} onClick={() => setSelectedCourse(c)} style={{ background: T.card, borderRadius: 18, overflow: "hidden", border: `1px solid ${T.border}`, cursor: "pointer", marginBottom: 16 }}>
                      <div style={{ height: 90, background: `linear-gradient(135deg, ${T.gradStart}, ${T.gradEnd})`, display: "flex", alignItems: "center", padding: 20, position: "relative" }}>
                        <div style={{ position: "absolute", right: 15, top: 15, width: 40, height: 40, borderRadius: "50%", background: "rgba(212,168,67,0.1)" }} />
                        <h3 style={{ color: "#E8EDF5", margin: 0, fontSize: "1.15rem", fontWeight: 800 }}>{c.title}</h3>
                      </div>
                      <div style={{ padding: 14, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <span style={{ fontSize: ".82rem", color: T.text2, fontWeight: 600 }}>Includes: {c.subjects?.join(", ") || "All Subjects"}</span>
                        <I n="arrow-right" c={T.accent} />
                      </div>
                    </div>
                  ))}
                </>
              ) : !selectedSubject ? (
                <>
                  <button onClick={() => setSelectedCourse(null)} style={{ background: "none", border: "none", color: T.text3, marginBottom: 16, display: "flex", alignItems: "center", gap: 6, fontWeight: 600, cursor: "pointer" }}><I n="arrow-left" /> Back</button>
                  <h2 style={{ fontSize: "1.3rem", fontWeight: 800, margin: "0 0 16px" }}>Subjects</h2>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                    {(selectedCourse.subjects || ["Physics", "Chemistry", "Maths"]).map(sub => (
                      <div key={sub} onClick={() => setSelectedSubject(sub)} style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 16, padding: 20, textAlign: "center", cursor: "pointer" }}>
                        <I n="book" s={24} c={T.accent} style={{ marginBottom: 10 }} />
                        <h4 style={{ margin: 0, fontWeight: 700, fontSize: ".92rem" }}>{sub}</h4>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <>
                  <button onClick={() => setSelectedSubject(null)} style={{ background: "none", border: "none", color: T.text3, marginBottom: 16, display: "flex", alignItems: "center", gap: 6, fontWeight: 600, cursor: "pointer" }}><I n="arrow-left" /> Back</button>
                  <h2 style={{ fontSize: "1.3rem", fontWeight: 800, margin: "0 0 16px" }}>{selectedSubject} Materials</h2>
                  {materials.filter(m => m.subject === selectedSubject).map(m => (
                    <div key={m.id} style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 14, padding: 14, marginBottom: 12, display: "flex", alignItems: "center", gap: 12 }}>
                      <div style={{ width: 40, height: 40, borderRadius: 10, background: dark ? "#0F1E38" : "#EFF6FF", display: "flex", alignItems: "center", justifyContent: "center" }}>
                        <I n={m.materialType === "video" ? "play" : "file-pdf"} c={T.accent} />
                      </div>
                      <div style={{ flex: 1 }}>
                        <h4 style={{ margin: 0, fontSize: ".88rem", fontWeight: 700 }}>{m.title}</h4>
                        <p style={{ margin: "2px 0 0", fontSize: ".7rem", color: T.text3 }}>{m.chapter} • {m.materialType?.toUpperCase()}</p>
                      </div>
                      <a href={m.fileUrl || m.videoUrl} target="_blank" rel="noopener noreferrer" style={{ background: `linear-gradient(135deg, ${T.accent}, #2563EB)`, color: "#fff", padding: "6px 14px", borderRadius: 8, fontSize: ".75rem", fontWeight: 700, textDecoration: "none" }}>View</a>
                    </div>
                  ))}
                  {materials.filter(m => m.subject === selectedSubject).length === 0 && <p style={{ fontSize: ".85rem", color: T.text3, textAlign: "center", marginTop: 40 }}>No materials uploaded yet.</p>}
                </>
              )}
            </div>
          )}

          {/* ═══ 4. AI PORTAL TAB ═══ */}
          {activeTab === "ai" && (
            <div style={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0, overflow: "hidden" }}>
              {/* Sub-tab bar */}
              <div style={{ display: "flex", overflowX: "auto", gap: 6, padding: "16px 16px 8px", background: T.bg }}>
                {[
                  { id: "doubt", l: "Doubt Solver", i: "comments" },
                  { id: "quiz", l: "AI Quiz", i: "brain" },
                  { id: "graph", l: "Desmos Graph", i: "chart-line" },
                  { id: "prompt", l: "My Prompt", i: "wand-magic-sparkles" }
                ].map(t => (
                  <button key={t.id} onClick={() => setAiSubTab(t.id)} style={{
                    padding: "8px 14px", borderRadius: 12,
                    border: `1.5px solid ${aiSubTab === t.id ? T.accent : T.border}`,
                    background: aiSubTab === t.id ? `linear-gradient(135deg, ${T.accent}, #2563EB)` : T.card,
                    color: aiSubTab === t.id ? "#fff" : T.text2,
                    fontSize: ".76rem", fontWeight: 700,
                    display: "flex", alignItems: "center", gap: 6, whiteSpace: "nowrap", cursor: "pointer"
                  }}>
                    <I n={t.i} s={12} /> {t.l}
                  </button>
                ))}
              </div>

              {/* ══ 4a. DOUBT SOLVER — Portal Style ══ */}
              {aiSubTab === "doubt" && (
                <div style={{ flex: 1, display: "flex", flexDirection: "column", background: T.bg, minHeight: 0, overflow: "hidden" }}>
                  {/* Controls Row */}
                  <div style={{ display: "flex", gap: 6, padding: "8px 16px", flexWrap: "wrap", alignItems: "center" }}>
                    <select style={{ flex: "1 1 100px", border: `1.5px solid ${T.border}`, borderRadius: 10, padding: "6px 10px", fontSize: ".76rem", background: T.card, color: T.text, outline: "none", fontWeight: 600 }} value={doubtSubject} onChange={e => setDoubtSubject(e.target.value)}>
                      <option value="">All Subjects</option>
                      {subjects.length > 0 ? subjects.map(sub => <option key={sub}>{sub}</option>) : <><option>Physics</option><option>Chemistry</option><option>Mathematics</option><option>Biology</option></>}
                    </select>
                    {[{ v: "hinglish", l: "HI+EN" }, { v: "hindi", l: "हिंदी" }, { v: "english", l: "EN" }].map(la => (
                      <button key={la.v} onClick={() => setAnswerLang(la.v)} style={{
                        padding: "5px 10px", borderRadius: 8,
                        border: `1.5px solid ${answerLang === la.v ? T.success : T.border}`,
                        background: answerLang === la.v ? (dark ? "#0D2118" : "#ECFDF5") : T.card,
                        color: answerLang === la.v ? T.success : T.text3,
                        fontSize: ".7rem", fontWeight: 700, cursor: "pointer"
                      }}>{la.l}</button>
                    ))}
                    <div style={{ marginLeft: "auto", display: "flex", gap: 4 }}>
                      <button onClick={() => setShowDoubtHistory(!showDoubtHistory)} style={{ padding: "5px 10px", borderRadius: 8, border: `1px solid ${dark ? '#3D3516' : '#FDE68A'}`, background: dark ? "#1C1A0E" : "#FFFBEB", color: T.orange, fontSize: ".7rem", fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", gap: 4 }}>
                        <I n="history" s={10} /> {doubtHistory.length}
                      </button>
                      {dChat.length > 0 && (
                        <button onClick={clearDoubtChat} style={{ padding: "5px 10px", borderRadius: 8, border: `1px solid ${T.border}`, background: T.card, color: T.text3, fontSize: ".7rem", fontWeight: 700, cursor: "pointer" }}>
                          <I n="plus" s={10} /> New
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Doubt History Panel */}
                  {showDoubtHistory && (
                    <div className="slideIn" style={{ margin: "0 16px 8px", maxHeight: 220, overflowY: "auto", background: dark ? "#1C1A0E" : "#FFFDF7", border: `1.5px solid ${dark ? '#3D3516' : '#FDE68A'}`, borderRadius: 14, padding: 12 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                        <span style={{ fontSize: ".82rem", fontWeight: 700 }}><I n="history" s={12} c={T.orange} /> History</span>
                        <button onClick={() => setShowDoubtHistory(false)} style={{ background: "none", border: "none", cursor: "pointer", color: T.text3, fontSize: ".9rem" }}>✕</button>
                      </div>
                      {doubtHistory.length === 0 ? <p style={{ fontSize: ".78rem", color: T.text3, textAlign: "center", padding: 12 }}>Koi history nahi hai</p> : (
                        doubtHistory.map(ses => (
                          <div key={ses.id} style={{
                            padding: "8px 12px", borderRadius: 10,
                            border: `1px solid ${activeSessionId === ses.id ? T.success : T.border}`,
                            background: activeSessionId === ses.id ? (dark ? "#0D2118" : "#ECFDF5") : T.card,
                            marginBottom: 6, fontSize: ".78rem", display: "flex", alignItems: "center", gap: 8
                          }}>
                            <div style={{ flex: 1, cursor: "pointer", minWidth: 0 }} onClick={() => loadSession(ses)}>
                              <p style={{ margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontSize: ".78rem", fontWeight: 700, color: T.text }}>{ses.messages?.[0]?.text || ses.lastMessage || "Doubt"}</p>
                              <div style={{ display: "flex", gap: 6, marginTop: 3, alignItems: "center" }}>
                                <span style={{ padding: "1px 6px", borderRadius: 4, fontSize: ".6rem", fontWeight: 700, background: dark ? "#0D2118" : "#ECFDF5", color: T.success }}>{ses.subject || "General"}</span>
                                <span style={{ fontSize: ".58rem", color: T.text3 }}>{ses.createdAt?.toDate?.()?.toLocaleDateString?.("en-IN", { day: "numeric", month: "short" }) || ""}</span>
                              </div>
                            </div>
                            <button onClick={(e) => { e.stopPropagation(); if (confirm("Delete this chat?")) deleteDoc(doc(db, "doubt_history", ses.id)).catch(console.error); }} style={{ width: 28, height: 28, borderRadius: 8, border: `1px solid ${T.danger}30`, background: `${T.danger}10`, color: T.danger, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><I n="trash" s={10} /></button>
                          </div>
                        ))
                      )}
                    </div>
                  )}

                  {/* Chat Messages */}
                  <div style={{ flex: 1, overflowY: "auto", padding: "8px 16px" }}>
                    {dChat.length === 0 && (
                      <div style={{ textAlign: "center", padding: "30px 16px", opacity: 0.8 }}>
                        <div style={{ width: 52, height: 52, borderRadius: 14, background: `linear-gradient(135deg, ${T.success}, #10B981)`, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 14px" }}>
                          <I n="robot" s={22} c="#fff" />
                        </div>
                        <h2 style={{ fontSize: "1.1rem", fontWeight: 800, margin: "0 0 8px" }}>Kya doubt hai? Pucho!</h2>
                        <p style={{ fontSize: ".8rem", margin: "0 0 16px", color: T.text3 }}>Text likho, photo attach karo, ya neeche se choose karo</p>
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, justifyContent: "center" }}>
                          {currentSamples.map((q, i) => (
                            <button key={i} onClick={() => setDInput(q)} style={{
                              padding: "6px 12px", borderRadius: 20,
                              border: `1px solid ${T.border}`, background: T.card,
                              color: T.text2, fontSize: ".74rem", cursor: "pointer", transition: "all .15s"
                            }}
                              onMouseEnter={e => { e.currentTarget.style.background = dark ? "#0D2118" : "#ECFDF5"; e.currentTarget.style.borderColor = T.success; e.currentTarget.style.color = T.success; }}
                              onMouseLeave={e => { e.currentTarget.style.background = T.card; e.currentTarget.style.borderColor = T.border; e.currentTarget.style.color = T.text2; }}
                            >{q}</button>
                          ))}
                        </div>
                      </div>
                    )}

                    {dChat.map((msg, i) => (
                      <div key={i} className="fadeMsg" style={{ marginBottom: 14 }}>
                        {msg.role === "user" ? (
                          <div style={{ display: "flex", justifyContent: "flex-end" }}>
                            <div style={{ maxWidth: "80%", padding: "10px 16px", borderRadius: "18px 18px 4px 18px", background: `linear-gradient(135deg, ${T.accent}, #2563EB)`, color: "#fff" }}>
                              {msg.image && <div style={{ marginBottom: 8, borderRadius: 10, overflow: "hidden", maxWidth: 180 }}><img src={msg.image} alt="" style={{ width: "100%", borderRadius: 10 }} /></div>}
                              {msg.text && <div style={{ fontSize: ".86rem", lineHeight: 1.5 }}>{msg.text}</div>}
                              <div style={{ fontSize: ".58rem", opacity: 0.5, textAlign: "right", marginTop: 4 }}>{msg.time?.toLocaleTimeString?.("en-IN", { hour: "2-digit", minute: "2-digit" })}</div>
                            </div>
                          </div>
                        ) : (
                          <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                            <div style={{ width: 28, height: 28, borderRadius: 8, background: `linear-gradient(135deg, ${T.success}, #10B981)`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, marginTop: 2 }}>
                              <I n="robot" s={12} c="#fff" />
                            </div>
                            <div style={{ flex: 1, maxWidth: "85%" }}>
                              <div style={{ fontSize: ".65rem", fontWeight: 700, color: T.success, marginBottom: 3 }}>AI Teacher · {langLabel}</div>
                              <div style={{ padding: "12px 16px", borderRadius: "4px 18px 18px 18px", background: T.aiChat, border: `1px solid ${T.border}`, fontSize: ".86rem", lineHeight: 1.8, color: T.text }} className={isTyping && i === dChat.length - 1 ? "typCur" : ""}>
                                {renderMd(msg.text)}
                              </div>
                              <div style={{ fontSize: ".58rem", color: T.text3, marginTop: 3 }}>{msg.time?.toLocaleTimeString?.("en-IN", { hour: "2-digit", minute: "2-digit" })}</div>
                            </div>
                          </div>
                        )}
                      </div>
                    ))}

                    {/* Thinking indicator */}
                    {dLoading && (
                      <div className="fadeMsg" style={{ display: "flex", gap: 10, alignItems: "flex-start", marginBottom: 14 }}>
                        <div style={{ width: 28, height: 28, borderRadius: 8, background: `linear-gradient(135deg, ${T.success}, #10B981)`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                          <I n="robot" s={12} c="#fff" />
                        </div>
                        <div>
                          <div style={{ fontSize: ".65rem", fontWeight: 700, color: T.success, marginBottom: 3 }}>AI Teacher</div>
                          <div style={{ padding: "10px 16px", borderRadius: "4px 18px 18px 18px", background: T.aiChat, border: `1px solid ${T.border}` }}>
                            <div style={{ display: "flex", gap: 5, marginBottom: 6 }}>
                              {[0, .15, .3].map((d, i) => <div key={i} style={{ width: 7, height: 7, borderRadius: "50%", background: T.success, animation: `blink .8s infinite ${d}s` }} />)}
                            </div>
                            <div style={{ fontSize: ".76rem", color: T.success, fontWeight: 500 }}>{thinkingText}</div>
                          </div>
                        </div>
                      </div>
                    )}
                    <div ref={chatEndRef} />
                  </div>

                  {/* Image preview bar */}
                  {dImgPreview && (
                    <div style={{ padding: "8px 16px", borderTop: `1px solid ${T.border}`, background: T.card, display: "flex", alignItems: "center", gap: 10 }}>
                      <div style={{ width: 44, height: 44, borderRadius: 8, overflow: "hidden", border: `1.5px solid ${T.border}`, flexShrink: 0 }}>
                        <img src={dImgPreview} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                      </div>
                      <div style={{ flex: 1, fontSize: ".76rem" }}><strong>Photo ready</strong><div style={{ fontSize: ".68rem", color: T.text3 }}>Send karo</div></div>
                      <button onClick={removeImage} style={{ background: "none", border: "none", color: T.danger, cursor: "pointer", fontSize: ".9rem" }}>✕</button>
                    </div>
                  )}

                  {/* Input Bar — ChatGPT Style */}
                  <div style={{ padding: "10px 16px 14px", background: T.bg, flexShrink: 0, borderTop: `1px solid ${T.border}`, marginBottom: 70 }}>
                    <div style={{ display: "flex", gap: 8, alignItems: "flex-end", background: T.inputBg, border: `1.5px solid ${T.border}`, borderRadius: 16, padding: "6px 8px 6px 4px" }}>
                      {/* Attach button */}
                      <div style={{ position: "relative" }}>
                        <button onClick={(e) => { e.stopPropagation(); setShowAttach(!showAttach); }} style={{ width: 36, height: 36, borderRadius: 10, border: "none", background: "transparent", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: T.text3, fontSize: "1rem" }}>
                          <I n="paperclip" s={16} />
                        </button>
                        {showAttach && (
                          <div className="slideIn" style={{ position: "absolute", bottom: 44, left: 0, background: T.card, borderRadius: 14, boxShadow: `0 4px 20px rgba(0,0,0,${dark ? 0.4 : 0.12})`, border: `1px solid ${T.border}`, padding: 6, minWidth: 160, zIndex: 10 }} onClick={e => e.stopPropagation()}>
                            <button onClick={() => { camInputRef.current?.click(); }} style={{ width: "100%", padding: "10px 14px", border: "none", background: "transparent", cursor: "pointer", display: "flex", alignItems: "center", gap: 10, borderRadius: 8, fontSize: ".82rem", color: T.text }}>
                              <I n="camera" c={T.success} s={14} /> Camera
                            </button>
                            <button onClick={() => { fileInputRef.current?.click(); }} style={{ width: "100%", padding: "10px 14px", border: "none", background: "transparent", cursor: "pointer", display: "flex", alignItems: "center", gap: 10, borderRadius: 8, fontSize: ".82rem", color: T.text }}>
                              <I n="image" c={T.accent} s={14} /> Gallery
                            </button>
                            <button onClick={() => { document.getElementById("pdfInput")?.click(); }} style={{ width: "100%", padding: "10px 14px", border: "none", background: "transparent", cursor: "pointer", display: "flex", alignItems: "center", gap: 10, borderRadius: 8, fontSize: ".82rem", color: T.text }}>
                              <I n="file-pdf" c={T.danger} s={14} /> PDF File
                            </button>
                          </div>
                        )}
                      </div>
                      <textarea
                        ref={textareaRef}
                        style={{ flex: 1, border: "none", outline: "none", resize: "none", fontSize: ".86rem", fontFamily: "'Inter', sans-serif", lineHeight: 1.5, padding: "8px 4px", height: 42, maxHeight: 120, background: "transparent", color: T.text }}
                        placeholder="Apna doubt yahan likho..."
                        value={dInput}
                        onChange={handleTextareaInput}
                        onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); askDoubt(); } }}
                        disabled={dLoading}
                        rows={1}
                      />
                      <button onClick={askDoubt} disabled={dLoading || (!dInput.trim() && !dImgB64)} style={{
                        width: 36, height: 36, borderRadius: 10, border: "none",
                        background: (dLoading || (!dInput.trim() && !dImgB64)) ? T.border : `linear-gradient(135deg, ${T.success}, #10B981)`,
                        color: "#fff", cursor: (dLoading || (!dInput.trim() && !dImgB64)) ? "default" : "pointer",
                        display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0
                      }}>
                        <I n={dLoading ? "spinner" : "arrow-up"} cls={dLoading ? "fa-spin" : ""} s={14} />
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* ══ 4b. AI QUIZ — With History & Delete ══ */}
              {aiSubTab === "quiz" && (
                <div style={{ padding: 16, overflowY: "auto" }}>
                  {quizState === "setup" && (
                    <>
                      {/* Header with history toggle */}
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
                        <div>
                          <h3 style={{ margin: 0, fontSize: "1.05rem", fontWeight: 800 }}>AI Quiz Generator</h3>
                          <p style={{ margin: 0, fontSize: ".7rem", color: T.text3 }}>Gemini AI se MCQs generate karo</p>
                        </div>
                        <button onClick={() => setShowQuizHistory(!showQuizHistory)} style={{
                          padding: "6px 12px", borderRadius: 8, fontSize: ".72rem", fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", gap: 4,
                          border: `1px solid ${dark ? '#3D3516' : '#FDE68A'}`, background: dark ? "#1C1A0E" : "#FFFBEB", color: T.orange
                        }}>
                          <I n="history" s={10} /> History ({quizHistory.length})
                        </button>
                      </div>

                      {/* Quiz History Panel */}
                      {showQuizHistory && (
                        <div className="slideIn" style={{ marginBottom: 14, maxHeight: 280, overflowY: "auto", background: dark ? "#1A0F2E" : "#FDFAFF", border: `1.5px solid ${dark ? '#2D1B5E' : '#E9D5FF'}`, borderRadius: 14, padding: 14 }}>
                          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10 }}>
                            <span style={{ fontSize: ".82rem", fontWeight: 700 }}><I n="history" s={12} c={T.purple} /> Past Quizzes</span>
                            <button onClick={() => setShowQuizHistory(false)} style={{ background: "none", border: "none", cursor: "pointer", color: T.text3 }}>✕</button>
                          </div>
                          {quizHistory.length === 0 ? (
                            <p style={{ fontSize: ".78rem", color: T.text3, textAlign: "center", padding: 16 }}>Koi quiz history nahi hai.</p>
                          ) : (
                            quizHistory.map(qh => {
                              const gc = qh.percentage >= 80 ? T.success : qh.percentage >= 60 ? T.orange : T.danger;
                              return (
                                <div key={qh.id} style={{ padding: "10px 12px", borderRadius: 10, border: `1px solid ${T.border}`, background: T.card, marginBottom: 6, display: "flex", alignItems: "center", gap: 10 }}>
                                  <div style={{ width: 42, height: 42, borderRadius: 10, border: `2.5px solid ${gc}`, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                                    <div style={{ fontSize: ".85rem", fontWeight: 900, color: gc, lineHeight: 1 }}>{qh.percentage}%</div>
                                    <div style={{ fontSize: ".5rem", fontWeight: 700, color: gc }}>{qh.grade}</div>
                                  </div>
                                  <div style={{ flex: 1, minWidth: 0 }}>
                                    <div style={{ fontWeight: 700, fontSize: ".8rem" }}>{qh.subject}</div>
                                    <div style={{ fontSize: ".68rem", color: T.text3 }}>{qh.correctAnswers}/{qh.totalQuestions} · {qh.difficulty} · {qh.createdAt?.toDate?.()?.toLocaleDateString?.("en-IN", { day: "numeric", month: "short" }) || ""}</div>
                                  </div>
                                  <button onClick={(e) => { e.stopPropagation(); deleteQuizEntry(qh.id); }} style={{ width: 30, height: 30, borderRadius: 8, border: `1px solid ${dark ? '#5C2020' : '#FCA5A5'}`, background: dark ? "#2D1010" : "#FEF2F2", color: T.danger, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", flexShrink: 0 }}>
                                    <I n="trash" s={11} />
                                  </button>
                                </div>
                              );
                            })
                          )}
                        </div>
                      )}

                      {/* Quiz Setup Form */}
                      <div style={{ background: T.card, borderRadius: 18, padding: 20, border: `2px solid ${T.purple}` }}>
                        {/* Language Select */}
                        <div style={{ marginBottom: 14 }}>
                          <label style={{ display: "block", fontSize: ".72rem", fontWeight: 700, color: T.text3, textTransform: "uppercase", marginBottom: 6, letterSpacing: "0.5px" }}>Language</label>
                          <div style={{ display: "flex", gap: 8 }}>
                            {[{ v: "hinglish", l: "Hinglish", e: "🇮🇳🇬🇧" }, { v: "hindi", l: "हिंदी", e: "🇮🇳" }, { v: "english", l: "English", e: "🇬🇧" }].map(la => (
                              <button key={la.v} onClick={() => setAnswerLang(la.v)} style={{
                                flex: 1, padding: 8, borderRadius: 10,
                                border: `2px solid ${answerLang === la.v ? T.purple : T.border}`,
                                background: answerLang === la.v ? (dark ? "#1A0F2E" : "#FAF5FF") : T.card,
                                cursor: "pointer", textAlign: "center"
                              }}>
                                <div style={{ fontSize: "1rem" }}>{la.e}</div>
                                <div style={{ fontSize: ".72rem", fontWeight: 700, color: answerLang === la.v ? T.purple : T.text3 }}>{la.l}</div>
                              </button>
                            ))}
                          </div>
                        </div>
                        <div style={{ marginBottom: 14 }}>
                          <label style={{ display: "block", fontSize: ".72rem", fontWeight: 700, color: T.text3, textTransform: "uppercase", marginBottom: 6 }}>Subject *</label>
                          <select value={quizSubject} onChange={e => { setQuizSubject(e.target.value); setQuizChapter(""); }} style={{ width: "100%", padding: "10px 14px", borderRadius: 12, border: `1.5px solid ${T.border}`, background: T.card, color: T.text, fontSize: ".86rem", outline: "none", fontWeight: 600 }}>
                            <option value="">Pick a subject...</option>
                            {(subjects.length ? subjects : ["Physics", "Chemistry", "Mathematics", "Biology"]).map(s => <option key={s} value={s}>{s}</option>)}
                          </select>
                        </div>
                        <div style={{ marginBottom: 14 }}>
                          <label style={{ display: "block", fontSize: ".72rem", fontWeight: 700, color: T.text3, textTransform: "uppercase", marginBottom: 6 }}>Chapter</label>
                          {quizChapters.length > 0 ? (
                            <select style={{ width: "100%", padding: "10px 14px", borderRadius: 12, border: `1.5px solid ${T.border}`, background: T.card, color: T.text, fontSize: ".86rem", fontWeight: 600, outline: "none" }} value={quizChapter} onChange={e => setQuizChapter(e.target.value)}>
                              <option value="">All</option>
                              {quizChapters.map(c => <option key={c}>{c}</option>)}
                            </select>
                          ) : (
                            <input style={{ width: "100%", padding: "10px 14px", borderRadius: 12, border: `1.5px solid ${T.border}`, background: T.card, color: T.text, fontSize: ".86rem", fontWeight: 600, outline: "none" }} placeholder="e.g. Newton's Laws" value={quizChapter} onChange={e => setQuizChapter(e.target.value)} />
                          )}
                        </div>
                        <div style={{ display: "flex", gap: 12, marginBottom: 14 }}>
                          <div style={{ flex: 1 }}>
                            <label style={{ display: "block", fontSize: ".72rem", fontWeight: 700, color: T.text3, textTransform: "uppercase", marginBottom: 6 }}>Questions</label>
                            <select value={quizCount} onChange={e => setQuizCount(Number(e.target.value))} style={{ width: "100%", padding: "10px", borderRadius: 12, border: `1.5px solid ${T.border}`, background: T.card, color: T.text, fontSize: ".86rem", fontWeight: 600, outline: "none" }}>
                              {[5, 10, 15].map(n => <option key={n} value={n}>{n}</option>)}
                            </select>
                          </div>
                          <div style={{ flex: 1 }}>
                            <label style={{ display: "block", fontSize: ".72rem", fontWeight: 700, color: T.text3, textTransform: "uppercase", marginBottom: 6 }}>Level</label>
                            <select value={quizDifficulty} onChange={e => setQuizDifficulty(e.target.value)} style={{ width: "100%", padding: "10px", borderRadius: 12, border: `1.5px solid ${T.border}`, background: T.card, color: T.text, fontSize: ".86rem", fontWeight: 600, outline: "none" }}>
                              <option value="easy">Easy</option><option value="medium">Medium</option><option value="hard">Hard</option>
                            </select>
                          </div>
                        </div>
                        {quizErr && <p style={{ color: T.danger, fontSize: ".78rem", marginBottom: 12, fontWeight: 600 }}>{quizErr}</p>}
                        <button onClick={genQuiz} style={{ width: "100%", padding: "14px", borderRadius: 14, border: "none", background: `linear-gradient(135deg, ${T.purple}, #9333EA)`, color: "#fff", fontSize: ".95rem", fontWeight: 800, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
                          <I n="magic" s={14} /> Generate Quiz
                        </button>
                      </div>
                    </>
                  )}

                  {quizState === "loading" && (
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: 60, color: T.purple }}>
                      <I n="brain" s={40} cls="fa-spin" style={{ marginBottom: 20 }} />
                      <h3 style={{ margin: 0, fontWeight: 700, color: T.text }}>Generating Questions...</h3>
                    </div>
                  )}

                  {quizState === "active" && quizQs[quizIdx] && (() => {
                    const q = quizQs[quizIdx]; const sel = quizAns[quizIdx];
                    const pct = ((quizIdx + (sel !== undefined ? 1 : 0)) / quizQs.length) * 100;
                    return (
                      <>
                        <div style={{ marginBottom: 16 }}>
                          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                            <span style={{ fontWeight: 700, fontSize: ".85rem" }}>Q{quizIdx + 1}/{quizQs.length}</span>
                            <span style={{ padding: "3px 10px", borderRadius: 8, fontSize: ".7rem", fontWeight: 700, background: dark ? "#1A0F2E" : "#FAF5FF", color: T.purple }}>{quizSubject}</span>
                          </div>
                          <div style={{ height: 5, background: dark ? "#1C2D45" : "#E9D5FF", borderRadius: 99, overflow: "hidden" }}>
                            <div style={{ height: "100%", width: `${pct}%`, background: T.purple, borderRadius: 99, transition: "width .5s" }} />
                          </div>
                        </div>
                        <div style={{ background: T.card, borderRadius: 20, padding: 22, border: `2px solid ${dark ? '#2D1B5E' : '#E9D5FF'}` }}>
                          <h3 style={{ fontSize: "1.02rem", fontWeight: 700, lineHeight: 1.5, margin: "0 0 20px" }}>{q.question}</h3>
                          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                            {q.options.map((o, oi) => {
                              const isSel = sel === oi; const isCorr = q.correct === oi;
                              const ol = ["A", "B", "C", "D"][oi];
                              let bg = T.card, bdr = T.border, tc = T.text, op = 1;
                              if (sel !== undefined) {
                                if (isCorr) { bg = dark ? "#0D2118" : "#F0FDF4"; bdr = T.success; tc = T.success; }
                                else if (isSel && !isCorr) { bg = dark ? "#2D1010" : "#FEF2F2"; bdr = T.danger; tc = T.danger; }
                                else op = 0.5;
                              }
                              return (
                                <button key={oi} onClick={() => selAns(quizIdx, oi)} style={{
                                  width: "100%", padding: "12px 16px", borderRadius: 14,
                                  border: `2px solid ${bdr}`, background: bg, color: tc,
                                  fontSize: ".9rem", fontWeight: 600, textAlign: "left",
                                  cursor: sel !== undefined ? "default" : "pointer",
                                  display: "flex", alignItems: "center", gap: 12,
                                  opacity: op, transition: "all .2s"
                                }}>
                                  <div style={{ width: 30, height: 30, borderRadius: 8, background: sel !== undefined && isCorr ? T.success : sel !== undefined && isSel ? T.danger : (dark ? "#1C2D45" : "#E8EFF8"), display: "flex", alignItems: "center", justifyContent: "center", color: sel !== undefined ? "#fff" : T.text3, fontWeight: 800, fontSize: ".78rem", flexShrink: 0 }}>
                                    {sel !== undefined && isCorr ? "✓" : sel !== undefined && isSel ? "✗" : ol}
                                  </div>
                                  {o}
                                </button>
                              );
                            })}
                          </div>
                          {quizExpl && q.explanation && (
                            <div style={{ background: sel === q.correct ? (dark ? "#0D2118" : "#F0FDF4") : (dark ? "#2D1010" : "#FEF2F2"), borderRadius: 14, padding: 14, marginTop: 14, fontSize: ".82rem", lineHeight: 1.6, border: `1px solid ${sel === q.correct ? (dark ? '#1B4332' : '#86EFAC') : (dark ? '#5C2020' : '#FCA5A5')}` }}>
                              <strong style={{ color: sel === q.correct ? T.success : T.danger }}>{sel === q.correct ? "Correct! 🎉" : `Wrong → ${["A", "B", "C", "D"][q.correct]}`}</strong>
                              <p style={{ margin: "6px 0 0", color: T.text2 }}>{q.explanation}</p>
                            </div>
                          )}
                          {sel !== undefined && (
                            <button onClick={nextQ} style={{ width: "100%", marginTop: 18, padding: "14px", borderRadius: 14, border: "none", background: `linear-gradient(135deg, ${T.purple}, #9333EA)`, color: "#fff", fontSize: ".95rem", fontWeight: 800, cursor: "pointer" }}>
                              {quizIdx < quizQs.length - 1 ? "Next Question →" : "View Results 🏁"}
                            </button>
                          )}
                        </div>
                      </>
                    );
                  })()}

                  {quizState === "results" && (() => {
                    const pct = Math.round((quizScore / quizQs.length) * 100);
                    const gc = pct >= 80 ? T.success : pct >= 60 ? T.orange : T.danger;
                    return (
                      <>
                        <div style={{ background: T.card, borderRadius: 22, padding: 30, border: `1px solid ${T.border}`, textAlign: "center" }}>
                          <div style={{ fontSize: "2.5rem", marginBottom: 8 }}>{pct >= 90 ? "🏆" : pct >= 70 ? "🌟" : "💪"}</div>
                          <h2 style={{ margin: "0 0 6px", fontSize: "1.3rem", fontWeight: 800 }}>Quiz Complete!</h2>
                          <div style={{ position: "relative", width: 110, height: 110, margin: "16px auto" }}>
                            <Ring val={pct} sz={110} sw={9} c={gc} bg={dark ? "#1C2D45" : "#E8EFF8"} />
                            <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
                              <span style={{ fontSize: "1.8rem", fontWeight: 900, lineHeight: 1, color: gc }}>{quizScore}/{quizQs.length}</span>
                              <span style={{ fontSize: ".72rem", color: T.text3, fontWeight: 700 }}>{pct}%</span>
                            </div>
                          </div>
                          <button onClick={resetQuiz} style={{ padding: "12px 28px", borderRadius: 14, border: "none", background: `linear-gradient(135deg, ${T.purple}, #9333EA)`, color: "#fff", fontSize: ".9rem", fontWeight: 800, cursor: "pointer", marginTop: 8 }}>
                            <I n="redo" s={12} /> Play Again
                          </button>
                        </div>
                        {/* Review */}
                        <h4 style={{ fontWeight: 700, margin: "20px 0 12px", fontSize: ".9rem" }}>Review Answers</h4>
                        {quizQs.map((q, i) => {
                          const ir = quizAns[i] === q.correct;
                          return (
                            <div key={i} style={{ background: T.card, borderRadius: 14, padding: 14, marginBottom: 10, border: `1px solid ${T.border}`, borderLeft: `4px solid ${ir ? T.success : T.danger}` }}>
                              <p style={{ fontWeight: 600, marginBottom: 4, fontSize: ".84rem" }}>Q{i + 1}. {q.question}</p>
                              <div style={{ fontSize: ".78rem" }}>
                                <span style={{ color: T.success }}>✓ {["A", "B", "C", "D"][q.correct]}. {q.options[q.correct]}</span>
                                {!ir && <span style={{ color: T.danger, marginLeft: 12 }}>✗ {["A", "B", "C", "D"][quizAns[i]]}. {q.options[quizAns[i]]}</span>}
                              </div>
                              <p style={{ fontSize: ".74rem", color: T.text3, margin: "4px 0 0" }}>{q.explanation}</p>
                            </div>
                          );
                        })}
                      </>
                    );
                  })()}
                </div>
              )}

              {/* ══ 4c. DESMOS GRAPH INTEGRATION ══ */}
              {aiSubTab === "graph" && (
                <div style={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 16px", flexShrink: 0 }}>
                    <div style={{ width: 34, height: 34, borderRadius: 10, background: dark ? "#2D1010" : "#FEF2F2", display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <I n="chart-line" s={16} c={T.danger} />
                    </div>
                    <div style={{ flex: 1 }}>
                      <h3 style={{ fontSize: "1rem", fontWeight: 800, margin: 0 }}>Desmos Graph Calculator</h3>
                      <p style={{ fontSize: ".7rem", color: T.text3, margin: 0 }}>Full-featured graphing tool</p>
                    </div>
                  </div>
                  <div style={{ flex: 1, overflow: "hidden", minHeight: 0 }}>
                    <iframe
                      src="https://www.desmos.com/calculator"
                      style={{ width: "100%", height: "100%", border: "none", display: "block" }}
                      title="Desmos Graphing Calculator"
                      allow="clipboard-write"
                    />
                  </div>
                </div>
              )}

              {/* ══ 4d. PERSONALIZED PROMPT ══ */}
              {aiSubTab === "prompt" && (
                <div style={{ flex: 1, overflowY: "auto", padding: 16 }}>
                  <div style={{ background: `linear-gradient(135deg, ${T.gradStart}, ${T.gradEnd})`, borderRadius: 18, padding: 20, color: "#fff", marginBottom: 16 }}>
                    <h2 style={{ margin: "0 0 8px", fontSize: "1.1rem", fontWeight: 800 }}><I n="wand-magic-sparkles" s={16} /> Magic Prompt Engine</h2>
                    <p style={{ margin: 0, fontSize: ".82rem", opacity: 0.85 }}>Based on your daily app usage, we generated a personalized context block. Paste this into any AI to get custom tutoring.</p>
                  </div>

                  <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 16, padding: 18 }}>
                    <div style={{ fontSize: ".82rem", color: T.text, lineHeight: 1.7, fontFamily: "monospace", whiteSpace: "pre-wrap", background: dark ? "#0B1120" : "#F8FAFC", padding: 16, borderRadius: 12, border: `1px solid ${T.border}` }}>
{`Act as an expert Indian private tutor.
Student Profile:
- Name: ${student?.studentName || "Student"}
- Class: ${student?.class || student?.presentClass || "N/A"}
- Board: ${student?.board || "CG Board"}
- Current Attendance: ${attPct}%
- Avg Test Score: ${avgQuiz}%
- Areas of Struggle: ${weakSubjects.length ? weakSubjects.join(", ") : "Advanced Problem Solving"}
- Preferred Language: ${langLabel}

Instructions:
1. Explain concepts simply, with real-world Indian examples.
2. If teaching a struggle area, use the Feynman technique.
3. Keep answers concise. Step-by-step for math/science.
4. Respond in ${langLabel}.

Now, teach me: [TYPE YOUR TOPIC HERE]`}
                    </div>
                    <button
                      onClick={() => navigator.clipboard.writeText(`Act as an expert Indian private tutor.\nStudent Profile:\n- Name: ${student?.studentName || "Student"}\n- Class: ${student?.class || student?.presentClass || "N/A"}\n- Board: ${student?.board || "CG Board"}\n- Current Attendance: ${attPct}%\n- Avg Test Score: ${avgQuiz}%\n- Areas of Struggle: ${weakSubjects.length ? weakSubjects.join(", ") : "Advanced Problem Solving"}\n- Preferred Language: ${langLabel}\n\nInstructions:\n1. Explain concepts simply, with real-world Indian examples.\n2. If teaching a struggle area, use the Feynman technique.\n3. Keep answers concise. Step-by-step for math/science.\n4. Respond in ${langLabel}.\n\nNow, teach me: `)}
                      style={{ marginTop: 16, width: "100%", padding: "12px", background: `linear-gradient(135deg, ${T.accent}, #2563EB)`, border: "none", borderRadius: 12, color: "#fff", fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, fontSize: ".88rem" }}
                    >
                      <I n="copy" s={14} /> Copy Base Prompt
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ═══ 5. E-BOOKS / LIBRARY TAB ═══ */}
          {activeTab === "library" && (
            <div style={{ padding: 20 }}>
              <h2 style={{ fontSize: "1.3rem", fontWeight: 800, margin: "0 0 6px" }}>Digital Library</h2>
              <p style={{ fontSize: ".82rem", color: T.text3, margin: "0 0 20px" }}>Free NCERTs & Modules</p>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                {materials.filter(m => m.materialType === "pdf").map(m => (
                  <div key={m.id} style={{ background: T.card, borderRadius: 16, border: `1px solid ${T.border}`, padding: 16, textAlign: "center" }}>
                    <I n="file-pdf" s={30} c={T.danger} style={{ marginBottom: 10 }} />
                    <h4 style={{ margin: "0 0 4px", fontSize: ".88rem", fontWeight: 700 }}>{m.title}</h4>
                    <p style={{ margin: "0 0 12px", fontSize: ".68rem", color: T.text3 }}>{m.subject}</p>
                    <a href={m.fileUrl} target="_blank" rel="noopener noreferrer" style={{ display: "block", background: dark ? "#0F1E38" : "#EFF6FF", padding: "8px", borderRadius: 10, fontSize: ".75rem", fontWeight: 700, color: T.accent, textDecoration: "none" }}>Read Book</a>
                  </div>
                ))}
                {materials.filter(m => m.materialType === "pdf").length === 0 && <p style={{ fontSize: ".82rem", color: T.text3, gridColumn: "span 2", textAlign: "center", marginTop: 20 }}>No PDFs uploaded yet.</p>}
              </div>
            </div>
          )}

          {/* ═══ 6. ONLINE TESTS TAB ═══ */}
          {activeTab === "tests" && (
            <div style={{ padding: testPhase==="idle"?20:16 }}>

              {/* ── RUNNING ── */}
              {testPhase==="running" && activeTest && (() => {
                const qs = activeTest.questions||[];
                const q = qs[currentQIdx];
                const mins = Math.floor(testTimeLeft/60);
                const secs = testTimeLeft%60;
                const answered = Object.keys(testAnswers).length;
                return (
                  <div>
                    {/* Header bar */}
                    <div style={{ background:T.card, borderRadius:14, padding:"10px 14px", marginBottom:12, border:`1px solid ${T.border}`, display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                      <div>
                        <div style={{ fontSize:".7rem", color:T.text3, fontWeight:600 }}>{activeTest.title}</div>
                        <div style={{ fontSize:".78rem", fontWeight:700 }}>{answered}/{qs.length} answered</div>
                      </div>
                      <div style={{ textAlign:"center" }}>
                        <div style={{ fontSize:"1.5rem", fontWeight:900, color:testTimeLeft<60?"#DC2626":T.accent, fontVariantNumeric:"tabular-nums" }}>
                          {String(mins).padStart(2,"0")}:{String(secs).padStart(2,"0")}
                        </div>
                        <div style={{ fontSize:".58rem", color:T.text3 }}>Time Left</div>
                      </div>
                      <button onClick={()=>{ if(window.confirm("Test submit karo? Baad mein change nahi hoga।")){ clearInterval(testTimerRef); setTestPhase("result"); } }}
                        style={{ background:"#DC2626", color:"#fff", border:"none", padding:"8px 14px", borderRadius:10, fontWeight:700, fontSize:".75rem", cursor:"pointer" }}>
                        Submit
                      </button>
                    </div>
                    {/* Question dots */}
                    <div style={{ display:"flex", gap:4, flexWrap:"wrap", marginBottom:14 }}>
                      {qs.map((_,i)=>(
                        <div key={i} style={{ width:28, height:28, borderRadius:8, display:"flex", alignItems:"center", justifyContent:"center", fontSize:".65rem", fontWeight:700,
                          background: i===currentQIdx ? T.accent : testAnswers[i]!==undefined ? (dark?"#16532D":"#DCFCE7") : dark?"rgba(255,255,255,.08)":"#F0F4FA",
                          color: i===currentQIdx ? "#fff" : testAnswers[i]!==undefined ? "#16A34A" : T.text3,
                          border: i===currentQIdx ? `2px solid ${T.accent}` : "2px solid transparent",
                          cursor:"pointer"
                        }} onClick={()=>setCurrentQIdx(i)}>{i+1}</div>
                      ))}
                    </div>
                    {/* Question card */}
                    {q && (
                      <div style={{ background:T.card, borderRadius:18, padding:20, border:`1px solid ${T.border}` }}>
                        <div style={{ fontSize:".7rem", color:T.accent, fontWeight:700, marginBottom:8 }}>
                          Question {currentQIdx+1} of {qs.length}
                        </div>
                        <p style={{ fontSize:".95rem", fontWeight:700, marginBottom:18, lineHeight:1.55 }}>{q.question}</p>
                        <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
                          {(q.options||[]).map((opt,oi)=>{
                            const selected = testAnswers[currentQIdx]===oi;
                            return (
                              <button key={oi} onClick={()=>{
                                // Sirf select karo — auto-next nahi
                                setTestAnswers(prev=>({...prev,[currentQIdx]:oi}));
                              }} style={{
                                background: selected ? `${T.accent}18` : dark?"rgba(255,255,255,.05)":"#F8FAFD",
                                border: selected ? `2px solid ${T.accent}` : `1.5px solid ${T.border}`,
                                borderRadius:12, padding:"12px 16px", textAlign:"left", cursor:"pointer",
                                fontSize:".88rem", fontWeight: selected?700:400,
                                color: selected?T.accent:T.text1, transition:"all .15s",
                                display:"flex", alignItems:"center", gap:10
                              }}>
                                <span style={{ width:24, height:24, borderRadius:6, background:selected?T.accent:dark?"rgba(255,255,255,.1)":"#E8EFF8", color:selected?"#fff":T.text3, display:"flex", alignItems:"center", justifyContent:"center", fontSize:".72rem", fontWeight:800, flexShrink:0 }}>
                                  {["A","B","C","D"][oi]}
                                </span>
                                {opt}
                              </button>
                            );
                          })}
                        </div>
                        {/* Prev / Next */}
                        <div style={{ display:"flex", justifyContent:"space-between", marginTop:18, gap:10 }}>
                          <button onClick={()=>{ if(currentQIdx>0) setCurrentQIdx(i=>i-1); }}
                            disabled={currentQIdx===0}
                            style={{ flex:1, background:dark?"rgba(255,255,255,.08)":"#F0F4FA", border:"none", padding:"12px 0", borderRadius:12, fontWeight:600, cursor:currentQIdx===0?"not-allowed":"pointer", color:T.text2, fontSize:".85rem", opacity:currentQIdx===0?0.4:1 }}>
                            ← Prev
                          </button>
                          {currentQIdx < qs.length-1 ? (
                            <button onClick={()=>setCurrentQIdx(i=>i+1)}
                              style={{ flex:1, background:T.accent, color:"#fff", border:"none", padding:"12px 0", borderRadius:12, fontWeight:700, cursor:"pointer", fontSize:".85rem" }}>
                              Next →
                            </button>
                          ) : (
                            <button onClick={()=>{ clearInterval(testTimerRef); setTestPhase("result"); }}
                              style={{ flex:1, background:"#16A34A", color:"#fff", border:"none", padding:"12px 0", borderRadius:12, fontWeight:700, cursor:"pointer", fontSize:".85rem" }}>
                              ✓ Finish Test
                            </button>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })()}

              {/* ── RESULT ── */}
              {testPhase==="result" && activeTest && (() => {
                const qs = activeTest.questions||[];
                let correct=0;
                qs.forEach((q,i)=>{ if(testAnswers[i]===q.correctAnswer) correct++; });
                const pct = qs.length>0?Math.round((correct/qs.length)*100):0;
                const grade = pct>=90?"A+":pct>=75?"A":pct>=60?"B":pct>=40?"C":"D";
                const gc = pct>=75?"#16A34A":pct>=50?"#D98D04":"#DC2626";
                return (
                  <div>
                    <div style={{ background:T.card, borderRadius:20, padding:28, textAlign:"center", marginBottom:16, border:`1px solid ${T.border}` }}>
                      <div style={{ fontSize:"3.5rem", fontWeight:900, color:gc, lineHeight:1 }}>{grade}</div>
                      <div style={{ fontSize:"1.6rem", fontWeight:800, marginTop:4 }}>{pct}%</div>
                      <div style={{ fontSize:".82rem", color:T.text3, marginTop:4 }}>{correct} / {qs.length} correct</div>
                      <div style={{ fontSize:".82rem", fontWeight:700, color:T.text2, marginTop:6 }}>{activeTest.title}</div>
                      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:8, marginTop:16 }}>
                        <div style={{ background:dark?"#0D2118":"#F0FDF4", borderRadius:10, padding:10 }}><div style={{ fontWeight:800, color:"#16A34A", fontSize:"1.2rem" }}>{correct}</div><div style={{ fontSize:".62rem", color:T.text3 }}>Correct</div></div>
                        <div style={{ background:dark?"#2A0A0A":"#FEF2F2", borderRadius:10, padding:10 }}><div style={{ fontWeight:800, color:"#DC2626", fontSize:"1.2rem" }}>{qs.length-correct}</div><div style={{ fontSize:".62rem", color:T.text3 }}>Wrong</div></div>
                        <div style={{ background:dark?"#162544":"#EFF6FF", borderRadius:10, padding:10 }}><div style={{ fontWeight:800, color:T.accent, fontSize:"1.2rem" }}>{qs.length}</div><div style={{ fontSize:".62rem", color:T.text3 }}>Total</div></div>
                      </div>
                    </div>
                    {/* Answer Review */}
                    <h3 style={{ fontSize:".92rem", fontWeight:800, marginBottom:12 }}>Answer Review</h3>
                    {qs.map((q,i)=>{
                      const ua = testAnswers[i];
                      const isC = ua===q.correctAnswer;
                      return (
                        <div key={i} style={{ background:T.card, borderRadius:14, padding:14, marginBottom:10, border:`1.5px solid ${isC?"#86EFAC":"#FCA5A5"}` }}>
                          <div style={{ display:"flex", gap:8, marginBottom:8 }}>
                            <span style={{ background:isC?"#F0FDF4":"#FEF2F2", color:isC?"#16A34A":"#DC2626", borderRadius:6, padding:"2px 8px", fontSize:".65rem", fontWeight:800, flexShrink:0 }}>{isC?"✓":"✗"} Q{i+1}</span>
                            <p style={{ margin:0, fontSize:".82rem", fontWeight:600 }}>{q.question}</p>
                          </div>
                          <div style={{ fontSize:".75rem", color:"#16A34A", marginBottom:2 }}>✓ Correct: {q.options?.[q.correctAnswer]}</div>
                          {ua!==undefined&&!isC&&<div style={{ fontSize:".75rem", color:"#DC2626", marginBottom:4 }}>✗ Your Answer: {q.options?.[ua]}</div>}
                          {q.explanation&&<div style={{ fontSize:".72rem", color:T.text3, background:dark?"rgba(255,255,255,.04)":"#F8FAFD", borderRadius:8, padding:"6px 10px", marginTop:6 }}>{q.explanation}</div>}
                        </div>
                      );
                    })}
                    <button onClick={async ()=>{
                      // Test ko completed mark karo — dobara nahi khulega
                      if(activeTest?.id){
                        const newDone = [...new Set([...completedTests, activeTest.id])];
                        setCompletedTests(newDone);
                        try{ localStorage.setItem("pid_done_tests", JSON.stringify(newDone)); }catch(e){}
                        // Firestore me result save karo
                        try {
                          const qs = activeTest.questions || [];
                          let correct = 0;
                          qs.forEach((q, i) => { if (testAnswers[i] === q.correctAnswer) correct++; });
                          const pct = qs.length > 0 ? Math.round((correct / qs.length) * 100) : 0;
                          await addDoc(collection(db, "test_submissions"), {
                            testId: activeTest.id,
                            testTitle: activeTest.title || "",
                            subject: activeTest.subject || "",
                            studentId: student?.id || "",
                            studentName: student?.studentName || "",
                            studentClass: student?.class || student?.presentClass || "",
                            correct: correct,
                            totalQuestions: qs.length,
                            percentage: pct,
                            answers: testAnswers,
                            submittedAt: serverTimestamp(),
                          });
                        } catch(e){ console.error("Result save error:", e); }
                      }
                      setTestPhase("idle"); setActiveTest(null); setTestAnswers({}); setCurrentQIdx(0); setTestTimeLeft(0);
                    }} style={{ width:"100%", background:T.accent, color:"#fff", border:"none", padding:"14px 0", borderRadius:14, fontWeight:700, fontSize:".92rem", cursor:"pointer", marginTop:8 }}>
                      ← Back to Tests
                    </button>
                  </div>
                );
              })()}

              {/* ── IDLE — Test List ── */}
              {testPhase==="idle" && (
                <div>
                  <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:6 }}>
                    <h2 style={{ fontSize:"1.3rem", fontWeight:800, margin:0 }}>Online Tests</h2>
                    <span style={{ background:tests.length>0?T.accent:T.text3, color:"#fff", borderRadius:99, padding:"3px 12px", fontSize:".72rem", fontWeight:700 }}>{tests.length} Active</span>
                  </div>
                  <p style={{ fontSize:".82rem", color:T.text3, margin:"0 0 20px" }}>Ghar baithe MCQ tests do — results turant milenge।</p>
                  {tests.length===0 ? (
                    <div style={{ textAlign:"center", padding:50, color:T.text3 }}>
                      <I n="clipboard-list" s={44} style={{ marginBottom:14, opacity:0.35 }} />
                      <p style={{ fontWeight:700, fontSize:".92rem", marginBottom:6 }}>Abhi koi active test nahi hai।</p>
                      <p style={{ fontSize:".78rem", opacity:0.6 }}>Jab teacher test publish karega, yahan dikhega।</p>
                    </div>
                  ) : tests.map(t => {
                    const isDone = completedTests.includes(t.id);
                    return (
                      <div key={t.id} style={{ background:T.card, borderRadius:18, border:`1.5px solid ${isDone?"#86EFAC":`${T.accent}30`}`, padding:20, marginBottom:14 }}>
                        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:10 }}>
                          <div style={{ flex:1 }}>
                            <h3 style={{ margin:"0 0 5px", fontSize:"1.08rem", fontWeight:800 }}>{t.title}</h3>
                            <p style={{ margin:0, fontSize:".78rem", color:T.text3 }}>{t.subject} · {t.duration||30} mins · {t.totalQuestions||t.questions?.length||0} Questions</p>
                          </div>
                          {isDone
                            ? <span style={{ background:"#F0FDF4", color:"#16A34A", borderRadius:8, padding:"3px 10px", fontSize:".68rem", fontWeight:700, marginLeft:8, whiteSpace:"nowrap" }}>✓ Completed</span>
                            : <span style={{ background:`${T.accent}18`, color:T.accent, borderRadius:8, padding:"3px 10px", fontSize:".68rem", fontWeight:700, marginLeft:8, whiteSpace:"nowrap" }}>{t.testType==="practice"?"Practice":t.testType==="weekly"?"Weekly":t.testType==="monthly"?"Monthly":"Test"}</span>
                          }
                        </div>
                        {t.chapter&&<p style={{ margin:"0 0 8px", fontSize:".72rem", color:T.text3 }}><I n="bookmark" s={10} style={{ marginRight:5 }}/>{t.chapter}{t.topic?` — ${t.topic}`:""}</p>}
                        {(t.scheduledDate||t.scheduledTime)&&(
                          <div style={{ background:dark?"rgba(217,141,4,.1)":"#FFFBEB", borderRadius:8, padding:"6px 10px", marginBottom:10, display:"flex", alignItems:"center", gap:6 }}>
                            <I n="clock" s={12} c={T.gold}/>
                            <span style={{ fontSize:".72rem", color:T.gold, fontWeight:700 }}>Available from: {t.scheduledDate||""}{t.scheduledTime?" at "+t.scheduledTime:""}</span>
                          </div>
                        )}
                        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                          <div style={{ display:"flex", gap:6 }}>
                            {t.difficulty&&<span style={{ fontSize:".65rem", color:T.text3, background:dark?"rgba(255,255,255,.06)":"#F0F4FA", borderRadius:6, padding:"2px 8px", textTransform:"capitalize" }}>{t.difficulty}</span>}
                          </div>
                          {isDone ? (
                            <span style={{ fontSize:".78rem", color:"#16A34A", fontWeight:700 }}>✓ Test diya ja chuka hai</span>
                          ) : (
                            <button onClick={()=>{
                              if(!t.questions||t.questions.length===0){ alert("Is test mein questions nahi hain। Admin se contact karo।"); return; }
                              setActiveTest(t);
                              setTestAnswers({});
                              setCurrentQIdx(0);
                              const secs=(t.duration||30)*60;
                              setTestTimeLeft(secs);
                              setTestPhase("running");
                              const tid=setInterval(()=>{
                                setTestTimeLeft(prev=>{
                                  if(prev<=1){ clearInterval(tid); setTestPhase("result"); return 0; }
                                  return prev-1;
                                });
                              },1000);
                              setTestTimerRef(tid);
                            }} style={{ background:`linear-gradient(135deg,${T.accent},${T.purple})`, color:"#fff", border:"none", padding:"10px 24px", borderRadius:12, fontWeight:700, cursor:"pointer", fontSize:".85rem", display:"flex", alignItems:"center", gap:6 }}>
                              <I n="play" s={12}/>Start Test
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* ═══ 7. NOTIFICATIONS TAB ═══ */}
          {activeTab === "notifications" && (
            <div style={{ padding: 20 }}>
              <h2 style={{ fontSize: "1.3rem", fontWeight: 800, margin: "0 0 6px" }}>Notifications & Alerts</h2>
              <p style={{ fontSize: ".82rem", color: T.text3, margin: "0 0 16px" }}>Tests, fees, holidays aur class alerts</p>

              {/* Active Tests Section */}
              {tests.length > 0 && (
                <div style={{ marginBottom: 16 }}>
                  <div style={{ fontSize: ".72rem", fontWeight: 700, color: T.accent, marginBottom: 8, display: "flex", alignItems: "center", gap: 6 }}>
                    <I n="laptop-code" s={11} c={T.accent} />
                    ACTIVE TESTS ({tests.length})
                  </div>
                  {tests.map(t => (
                    <div key={t.id} style={{ background: dark ? "#0F1E38" : "#EFF6FF", border: `1.5px solid ${T.accent}40`, borderRadius: 14, padding: 14, marginBottom: 8, borderLeft: `3px solid ${T.accent}` }}>
                      <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
                        <div style={{ width: 38, height: 38, borderRadius: 10, background: `${T.accent}20`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                          <I n="laptop-code" s={16} c={T.accent} />
                        </div>
                        <div style={{ flex: 1 }}>
                          <h4 style={{ margin: "0 0 3px", fontSize: ".88rem", fontWeight: 800 }}>New Test: {t.title}</h4>
                          <p style={{ margin: 0, fontSize: ".75rem", color: T.text2 }}>
                            {t.subject} · {t.totalQuestions || t.questions?.length || 0} Questions · {t.duration || 30} mins
                          </p>
                          {t.chapter && <p style={{ margin: "3px 0 0", fontSize: ".7rem", color: T.text3 }}>{t.chapter}{t.topic ? ` — ${t.topic}` : ""}</p>}
                          <div style={{ display: "flex", gap: 6, marginTop: 8, alignItems: "center", flexWrap: "wrap" }}>
                            <span style={{ fontSize: ".6rem", fontWeight: 700, background: `${T.accent}20`, color: T.accent, borderRadius: 5, padding: "2px 7px" }}>Test Available</span>
                            {t.difficulty && <span style={{ fontSize: ".6rem", color: T.text3, background: dark ? "rgba(255,255,255,.08)" : "#F0F4FA", borderRadius: 5, padding: "2px 7px", textTransform: "capitalize" }}>{t.difficulty}</span>}
                            <button onClick={() => setActiveTab("tests")} style={{ fontSize: ".65rem", fontWeight: 700, color: T.accent, background: "none", border: `1px solid ${T.accent}`, borderRadius: 6, padding: "2px 10px", cursor: "pointer" }}>
                              Give Test →
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Scheduled Notifications */}
              {notifications.length > 0 && (
                <div>
                  {tests.length > 0 && <div style={{ fontSize: ".72rem", fontWeight: 700, color: T.text3, marginBottom: 8, display: "flex", alignItems: "center", gap: 6 }}>
                    <I n="bell" s={11} />OTHER ALERTS
                  </div>}
                  {notifications.map(n => {
                    const typeConfig = { fee: { icon: "rupee-sign", color: T.orange, bg: dark ? "#1C1A0E" : "#FFFBEB" }, test: { icon: "laptop-code", color: T.accent, bg: dark ? "#0F1E38" : "#EFF6FF" }, holiday: { icon: "calendar-alt", color: T.purple, bg: dark ? "#1A0F2E" : "#FAF5FF" }, result: { icon: "chart-bar", color: T.success, bg: dark ? "#0D2118" : "#ECFDF5" }, general: { icon: "bell", color: T.gold, bg: dark ? "#1C1A0E" : "#FFFBEB" } };
                    const tc = typeConfig[n.notifType] || typeConfig.general;
                    return (
                      <div key={n.id} style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 16, padding: 16, marginBottom: 10, borderLeft: `3px solid ${tc.color}` }}>
                        <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
                          <div style={{ width: 38, height: 38, borderRadius: 10, background: tc.bg, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, marginTop: 2 }}>
                            <I n={tc.icon} s={16} c={tc.color} />
                          </div>
                          <div style={{ flex: 1 }}>
                            {n.title && <h4 style={{ margin: "0 0 4px", fontSize: ".88rem", fontWeight: 800 }}>{n.title}</h4>}
                            <p style={{ margin: 0, fontSize: ".8rem", color: T.text2, lineHeight: 1.5 }}>{n.message}</p>
                            <div style={{ display: "flex", gap: 8, marginTop: 8, alignItems: "center" }}>
                              <span style={{ padding: "2px 8px", borderRadius: 6, fontSize: ".6rem", fontWeight: 700, background: tc.bg, color: tc.color, textTransform: "capitalize" }}>{n.notifType || "General"}</span>
                              <span style={{ fontSize: ".6rem", color: T.text3 }}>{n.date || ""}</span>
                              {n.time && <span style={{ fontSize: ".6rem", color: T.text3 }}>{n.time}</span>}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Empty state */}
              {notifications.length === 0 && tests.length === 0 && (
                <div style={{ textAlign: "center", padding: 50, color: T.text3 }}>
                  <I n="bell-slash" s={40} style={{ marginBottom: 12, opacity: 0.4 }} />
                  <p style={{ fontSize: ".85rem" }}>Koi notification nahi hai abhi</p>
                </div>
              )}
            </div>
          )}

          {/* ═══ 8. STUDENT PROFILE TAB ═══ */}
          {activeTab === "profile" && (
            <div style={{ padding: 20 }}>
              {/* Profile Header */}
              <div style={{ background: `linear-gradient(135deg, ${T.gradStart}, ${T.gradEnd})`, borderRadius: 22, padding: 28, textAlign: "center", marginBottom: 16, position: "relative", overflow: "hidden" }}>
                <div style={{ position: "absolute", right: -20, top: -20, width: 100, height: 100, borderRadius: "50%", background: "rgba(255,255,255,.06)" }} />
                <div style={{ width: 80, height: 80, borderRadius: 22, background: "rgba(255,255,255,.15)", border: "3px solid rgba(255,255,255,.25)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 14px", overflow: "hidden" }}>
                  {student.photo && student.photo.startsWith("http") ? <img src={student.photo} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : <span style={{ color: "#fff", fontSize: "2rem", fontWeight: 800 }}>{(student.studentName || "S").charAt(0)}</span>}
                </div>
                <h3 style={{ margin: "0 0 4px", fontSize: "1.2rem", fontWeight: 900, color: "#fff" }}>{student.studentName}</h3>
                <p style={{ margin: 0, fontSize: ".82rem", color: "rgba(255,255,255,.7)" }}>Class {student.class || student.presentClass || "—"} · {student.board || "CG Board"}</p>
                {student.status && <span style={{ display: "inline-block", marginTop: 8, padding: "3px 12px", borderRadius: 20, fontSize: ".65rem", fontWeight: 700, background: student.status === "active" ? "rgba(16,185,129,.2)" : "rgba(239,68,68,.2)", color: student.status === "active" ? "#10B981" : "#EF4444" }}>{student.status === "active" ? "● Active" : "● Inactive"}</span>}
              </div>

              {/* Performance Summary */}
              <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 18, padding: 16, marginBottom: 16 }}>
                <h4 style={{ margin: "0 0 12px", fontSize: ".82rem", fontWeight: 800, color: T.accent }}><I n="chart-bar" s={12} c={T.accent} /> Performance</h4>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
                  {[["Attendance", attPct + "%", T.success], ["Quiz Avg", avgQuiz + "%", T.purple], ["Tests", String(quizHistory.length), T.orange]].map(([l, v, c]) => (
                    <div key={l} style={{ textAlign: "center", padding: "10px 0", background: dark ? "#162544" : "#F5F8FF", borderRadius: 12 }}>
                      <div style={{ fontSize: "1.1rem", fontWeight: 800, color: c }}>{v}</div>
                      <div style={{ fontSize: ".6rem", color: T.text3, marginTop: 2 }}>{l}</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Personal Info */}
              <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 18, overflow: "hidden", marginBottom: 16 }}>
                <div style={{ padding: "12px 16px", borderBottom: `1px solid ${T.border}`, background: dark ? "#162544" : "#F5F8FF" }}><h4 style={{ margin: 0, fontSize: ".82rem", fontWeight: 800, color: T.accent }}><I n="user" s={12} c={T.accent} /> Personal Info</h4></div>
                {[["Name", student.studentName], ["Class", student.class || student.presentClass], ["Board", student.board], ["Medium", student.medium], ["Date of Birth", student.dob], ["Gender", student.gender], ["Category", student.category], ["Aadhar No.", student.aadharNumber || student.aadhar], ["Blood Group", student.bloodGroup]].filter(([, v]) => v).map(([l, v], i, a) => (
                  <div key={l} style={{ display: "flex", justifyContent: "space-between", padding: "12px 16px", borderBottom: i < a.length - 1 ? `1px solid ${T.border}` : "none" }}>
                    <span style={{ fontSize: ".78rem", color: T.text3, fontWeight: 600 }}>{l}</span>
                    <span style={{ fontSize: ".78rem", fontWeight: 700, textAlign: "right", maxWidth: "55%", wordBreak: "break-word" }}>{v}</span>
                  </div>
                ))}
              </div>

              {/* Contact Details */}
              <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 18, overflow: "hidden", marginBottom: 16 }}>
                <div style={{ padding: "12px 16px", borderBottom: `1px solid ${T.border}`, background: dark ? "#162544" : "#F5F8FF" }}><h4 style={{ margin: 0, fontSize: ".82rem", fontWeight: 800, color: T.success }}><I n="phone" s={12} c={T.success} /> Contact Details</h4></div>
                {[["Email", student.studentEmail], ["Phone", student.studentPhone || student.phone], ["Father's Name", student.fatherName], ["Father's Phone", student.fatherPhone], ["Mother's Name", student.motherName], ["Mother's Phone", student.motherPhone], ["Address", student.address]].filter(([, v]) => v).map(([l, v], i, a) => (
                  <div key={l} style={{ display: "flex", justifyContent: "space-between", padding: "12px 16px", borderBottom: i < a.length - 1 ? `1px solid ${T.border}` : "none" }}>
                    <span style={{ fontSize: ".78rem", color: T.text3, fontWeight: 600 }}>{l}</span>
                    <span style={{ fontSize: ".78rem", fontWeight: 700, textAlign: "right", maxWidth: "55%", wordBreak: "break-word" }}>{v}</span>
                  </div>
                ))}
              </div>

              {/* Academic Info */}
              <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 18, overflow: "hidden", marginBottom: 16 }}>
                <div style={{ padding: "12px 16px", borderBottom: `1px solid ${T.border}`, background: dark ? "#162544" : "#F5F8FF" }}><h4 style={{ margin: 0, fontSize: ".82rem", fontWeight: 800, color: T.gold }}><I n="graduation-cap" s={12} c={T.gold} /> Academic Info</h4></div>
                {[["Admission Date", student.admissionDate], ["Enrollment No.", student.enrollmentNumber || student.enrollmentNo], ["Roll Number", student.rollNumber || student.rollNo], ["RFID Code", student.rfidCode], ["Batch/Course", student.course || student.batch], ["Previous School", student.previousSchool]].filter(([, v]) => v).map(([l, v], i, a) => (
                  <div key={l} style={{ display: "flex", justifyContent: "space-between", padding: "12px 16px", borderBottom: i < a.length - 1 ? `1px solid ${T.border}` : "none" }}>
                    <span style={{ fontSize: ".78rem", color: T.text3, fontWeight: 600 }}>{l}</span>
                    <span style={{ fontSize: ".78rem", fontWeight: 700, textAlign: "right", maxWidth: "55%", wordBreak: "break-word" }}>{v}</span>
                  </div>
                ))}
              </div>

              {/* Fee Status */}
              <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 18, padding: 16, marginBottom: 16 }}>
                <h4 style={{ margin: "0 0 12px", fontSize: ".82rem", fontWeight: 800, color: T.orange }}><I n="rupee-sign" s={12} c={T.orange} /> Fee Status</h4>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                  {[["Total Fee", student.totalFee ? `₹${Number(student.totalFee).toLocaleString("en-IN")}` : "—", T.accent], ["Fee Paid", student.enrollmentFeePaid ? `₹${Number(student.enrollmentFeePaid).toLocaleString("en-IN")}` : "—", T.success], ["Due Amount", (Number(student.totalFee || 0) - Number(student.enrollmentFeePaid || 0)) > 0 ? `₹${(Number(student.totalFee || 0) - Number(student.enrollmentFeePaid || 0)).toLocaleString("en-IN")}` : "Paid ✓", (Number(student.totalFee || 0) - Number(student.enrollmentFeePaid || 0)) > 0 ? T.danger : T.success], ["Payment Mode", student.paymentMode || "—", T.text2]].map(([l, v, c]) => (
                    <div key={l} style={{ textAlign: "center", padding: "10px 0", background: dark ? "#162544" : "#F5F8FF", borderRadius: 12 }}>
                      <div style={{ fontSize: ".95rem", fontWeight: 800, color: c }}>{v}</div>
                      <div style={{ fontSize: ".6rem", color: T.text3, marginTop: 2 }}>{l}</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Logout */}
              <button onClick={() => signOut(auth)} style={{ width: "100%", padding: "14px", borderRadius: 14, border: `1px solid ${T.danger}`, background: dark ? "rgba(239,68,68,.08)" : "rgba(220,38,38,.06)", color: T.danger, fontSize: ".88rem", fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}><I n="sign-out-alt" s={14} /> Logout</button>
            </div>
          )}

        </div>

        {/* ═══ FLOATING BOTTOM NAVIGATION ═══ */}
        <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, background: dark ? "#0B1120" : "#FFFFFF", borderTop: `1px solid ${T.border}`, display: "flex", justifyContent: "space-around", padding: "10px 8px 18px", zIndex: 100, boxShadow: `0 -2px 20px rgba(0,0,0,${dark ? 0.3 : 0.06})` }}>
          {[
            { id: "dashboard", i: "chart-simple", l: "Home" },
            { id: "myBatches", i: "chalkboard-user", l: "Batches" },
            { id: "ai", i: "robot", l: "AI" },
            { id: "notifications", i: "bell", l: "Alerts" },
            { id: "profile", i: "user-circle", l: "Profile" }
          ].map(tab => {
            const isActive = activeTab === tab.id;
            const unseen = tab.id==="notifications" ? Math.max(0, notifications.length+tests.length-seenNotifCount) : 0;
            return (
              <button key={tab.id} onClick={()=>{
                setActiveTab(tab.id);
                if(tab.id==="notifications"){
                  const t=notifications.length+tests.length;
                  setSeenNotifCount(t);
                  try{ localStorage.setItem("pid_seen_notif",String(t)); }catch(e){}
                }
              }} style={{ background:"none", border:"none", display:"flex", flexDirection:"column", alignItems:"center", gap:3, color:isActive?T.accent:T.text3, cursor:"pointer", flex:1, transition:"color 0.2s" }}>
                <div style={{ position:"relative", width:34, height:34, borderRadius:10, background:isActive?(dark?`${T.accent}20`:"#EFF6FF"):"transparent", display:"flex", alignItems:"center", justifyContent:"center", transition:"all 0.2s", boxShadow:isActive?`0 2px 8px ${T.accent}30`:"none" }}>
                  <I n={tab.i} s={16} />
                  {unseen>0&&<span style={{ position:"absolute", top:-4, right:-4, background:"#DC2626", color:"#fff", borderRadius:99, fontSize:".52rem", fontWeight:800, minWidth:16, height:16, display:"flex", alignItems:"center", justifyContent:"center", padding:"0 3px", border:`2px solid ${dark?"#0B1120":"#fff"}` }}>{unseen>9?"9+":unseen}</span>}
                </div>
                <span style={{ fontSize:".62rem", fontWeight:isActive?800:600, letterSpacing:"0.3px" }}>{tab.l}</span>
              </button>
            );
          })}
        </div>

        {/* ═══ UPI Payment Modal ═══ */}
        {showUpiModal && (
          <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.65)", backdropFilter: "blur(6px)", zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
            <div className="slideIn" style={{ background: T.card, borderRadius: 24, padding: 32, width: "100%", textAlign: "center", border: `1px solid ${T.border}` }}>
              <div style={{ width: 60, height: 60, borderRadius: "50%", background: dark ? "#0D2118" : "#ECFDF5", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px" }}>
                <I n="qrcode" s={24} c={T.success} />
              </div>
              <h2 style={{ margin: "0 0 10px", fontSize: "1.3rem", fontWeight: 800 }}>Complete Payment</h2>
              <p style={{ margin: "0 0 24px", fontSize: ".82rem", color: T.text3 }}>Pay via PhonePe, GPay or Paytm to unlock batch access immediately.</p>
              <button style={{ width: "100%", padding: "14px", borderRadius: 14, background: `linear-gradient(135deg, ${T.success}, #10B981)`, color: "#fff", border: "none", fontSize: "1rem", fontWeight: 800, marginBottom: 12, cursor: "pointer" }}>Pay with UPI Apps</button>
              <button onClick={() => setShowUpiModal(false)} style={{ width: "100%", padding: "14px", borderRadius: 14, background: dark ? "#1C2D45" : "#F0F4FA", color: T.text, border: "none", fontSize: ".88rem", fontWeight: 700, cursor: "pointer" }}>Cancel</button>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}