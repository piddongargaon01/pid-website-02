"use client";
import { useState, useEffect, useRef } from "react";
import { db, auth, googleProvider } from "../firebase";
import { collection, query, where, onSnapshot, addDoc, updateDoc, doc, serverTimestamp, getDocs } from "firebase/firestore";
import { signInWithPopup, onAuthStateChanged, signOut } from "firebase/auth";
import { GoogleGenerativeAI } from "@google/generative-ai";

// ═══ ICON HELPER ═══
const I = ({ n, s = 16, c = "currentColor" }) => <i className={`fas fa-${n}`} style={{ fontSize: s, color: c }} />;

// ═══ RING CHART ═══
const Ring = ({ val, sz = 72, sw = 6, c = "#6366F1", bg = "rgba(0,0,0,0.08)" }) => {
  const r = (sz - sw) / 2, ci = 2 * Math.PI * r, off = ci - (Math.min(val, 100) / 100) * ci;
  return (
    <svg width={sz} height={sz} style={{ transform: "rotate(-90deg)" }}>
      <circle cx={sz/2} cy={sz/2} r={r} fill="none" stroke={bg} strokeWidth={sw} />
      <circle cx={sz/2} cy={sz/2} r={r} fill="none" stroke={c} strokeWidth={sw} strokeDasharray={ci} strokeDashoffset={off} strokeLinecap="round" style={{ transition: "stroke-dashoffset 1s ease-out" }}/>
    </svg>
  );
};

// ═══════════════════════════════════════════
// MAIN APP
// ═══════════════════════════════════════════
export default function StudentApp() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [student, setStudent] = useState(null);
  const [studentLoading, setStudentLoading] = useState(false);
  const [activeTab, setActiveTab] = useState("home");
  const [dark, setDark] = useState(false);

  // Data states
  const [courses, setCourses] = useState([]);
  const [materials, setMaterials] = useState([]);
  const [attendance, setAttendance] = useState([]);
  const [quizHistory, setQuizHistory] = useState([]);
  const [examMarks, setExamMarks] = useState([]);
  const [examList, setExamList] = useState([]);
  const [onlineTests, setOnlineTests] = useState([]);
  const [classStudents, setClassStudents] = useState([]);
  const [holidays, setHolidays] = useState([]);

  // Navigation drill-down
  const [selectedCourse, setSelectedCourse] = useState(null);
  const [selectedSubject, setSelectedSubject] = useState(null);
  const [materialFilter, setMaterialFilter] = useState("all"); // all | lecture | notes | dpp

  // AI States
  const [aiSubTab, setAiSubTab] = useState("doubt");
  const [dInput, setDInput] = useState("");
  const [dChat, setDChat] = useState([]);
  const [dLoading, setDLoading] = useState(false);
  const [dImgPreview, setDImgPreview] = useState("");
  const [dImgB64, setDImgB64] = useState(null);
  const [showAttach, setShowAttach] = useState(false);
  const chatEndRef = useRef(null);
  const fileInputRef = useRef(null);

  // Quiz States
  const [quizState, setQuizState] = useState("setup");
  const [quizSubject, setQuizSubject] = useState("");
  const [quizChapter, setQuizChapter] = useState("");
  const [quizCount, setQuizCount] = useState(5);
  const [quizDifficulty, setQuizDifficulty] = useState("medium");
  const [quizQs, setQuizQs] = useState([]);
  const [quizIdx, setQuizIdx] = useState(0);
  const [quizAns, setQuizAns] = useState({});
  const [quizScore, setQuizScore] = useState(0);
  const [quizErr, setQuizErr] = useState("");

  // ═══ THEME ═══
  const T = dark ? {
    bg: "#0F172A", card: "#1E293B", text: "#F1F5F9", text2: "#CBD5E1", text3: "#64748B",
    border: "#334155", accent: "#818CF8", accent2: "#6366F1", grad1: "#312E81", grad2: "#1E1B4B",
    inputBg: "#334155", userChat: "#6366F1", aiChat: "#1E293B", green: "#34D399", red: "#F87171", yellow: "#FBBF24"
  } : {
    bg: "#F8FAFC", card: "#FFFFFF", text: "#0F172A", text2: "#334155", text3: "#64748B",
    border: "#E2E8F0", accent: "#4F46E5", accent2: "#6366F1", grad1: "#EEF2FF", grad2: "#E0E7FF",
    inputBg: "#F1F5F9", userChat: "#EEF2FF", aiChat: "#F8FAFC", green: "#10B981", red: "#EF4444", yellow: "#F59E0B"
  };

  // ═══ MARKDOWN RENDERER ═══
  function renderMd(text) {
    if (!text) return "";
    let h = text.replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>").replace(/\*(.*?)\*/g, "<em>$1</em>")
      .replace(/`([^`]+)`/g, '<code style="background:#1E293B;padding:2px 6px;border-radius:4px;font-size:.82rem;color:#F472B6">$1</code>')
      .replace(/\n/g, "<br/>");
    return <span dangerouslySetInnerHTML={{ __html: h }} />;
  }

  function getGemini() {
    const k = process.env.NEXT_PUBLIC_GEMINI_API_KEY;
    if (!k) throw new Error("API Key Missing");
    return new GoogleGenerativeAI(k).getGenerativeModel({ model: "gemini-2.5-flash" });
  }

  // ═══ AUTH ═══
  useEffect(() => { const u = onAuthStateChanged(auth, u => { setUser(u); setLoading(false); }); return () => u(); }, []);

  useEffect(() => {
    if (!user?.email) { setStudent(null); return; }
    setStudentLoading(true);
    const email = user.email.toLowerCase();
    const unsub = onSnapshot(collection(db, "students"), snap => {
      const found = snap.docs.find(d => d.data().studentEmail?.toLowerCase() === email);
      if (found) {
        setStudent({ id: found.id, ...found.data(), isEnrolled: true });
      } else {
        setStudent({ studentName: user.displayName || "Guest", studentEmail: email, isEnrolled: false, class: "N/A" });
        setActiveTab("explore");
      }
      setStudentLoading(false);
    });
    return () => unsub();
  }, [user]);

  // ═══ DATA LISTENERS ═══
  useEffect(() => {
    if (!student) return;
    const unsubs = [];
    unsubs.push(onSnapshot(collection(db, "courses"), s => { const arr = s.docs.map(d => ({ id: d.id, ...d.data() })); arr.sort((a, b) => (a.order || 99) - (b.order || 99)); setCourses(arr); }));
    unsubs.push(onSnapshot(collection(db, "study_materials"), s => setMaterials(s.docs.map(d => ({ id: d.id, ...d.data() })))));
    unsubs.push(onSnapshot(collection(db, "holidays"), s => setHolidays(s.docs.map(d => ({ id: d.id, ...d.data() })))));
    unsubs.push(onSnapshot(collection(db, "exams"), s => { const arr = s.docs.map(d => ({ id: d.id, ...d.data() })); arr.sort((a, b) => (b.examDate || "").localeCompare(a.examDate || "")); setExamList(arr); }));
    unsubs.push(onSnapshot(collection(db, "online_tests"), s => { const arr = s.docs.map(d => ({ id: d.id, ...d.data() })); setOnlineTests(arr); }));

    if (student?.id) {
      const monthStart = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, "0")}-01`;
      unsubs.push(onSnapshot(query(collection(db, "attendance"), where("studentId", "==", student.id)), s => {
        setAttendance(s.docs.map(d => ({ id: d.id, ...d.data() })).filter(a => a.date >= monthStart));
      }));
      unsubs.push(onSnapshot(query(collection(db, "quiz_history"), where("studentId", "==", student.id)), s => setQuizHistory(s.docs.map(d => ({ id: d.id, ...d.data() })))));
      unsubs.push(onSnapshot(query(collection(db, "exam_marks"), where("studentId", "==", student.id)), s => setExamMarks(s.docs.map(d => ({ id: d.id, ...d.data() })))));

      // Class rank ke liye same class ke students
      if (student.class) {
        unsubs.push(onSnapshot(collection(db, "students"), s => {
          setClassStudents(s.docs.map(d => ({ id: d.id, ...d.data() })).filter(x => x.class === student.class && x.status === "active"));
        }));
      }
    }
    return () => unsubs.forEach(u => u());
  }, [student]);

  // ═══ COMPUTED STATS ═══
  const attPct = (() => {
    const inDays = new Set(attendance.filter(a => a.type === "in").map(a => a.date)).size;
    const now = new Date();
    const holidayDates = new Set(holidays.map(h => h.date));
    let workDays = 0;
    for (let d = 1; d <= now.getDate(); d++) {
      const ds = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
      const day = new Date(ds + "T00:00:00").getDay();
      if (day !== 0 && !holidayDates.has(ds)) workDays++;
    }
    return workDays > 0 ? Math.round((inDays / workDays) * 100) : 0;
  })();
  const avgQuiz = quizHistory.length > 0 ? Math.round(quizHistory.reduce((s, q) => s + (q.percentage || 0), 0) / quizHistory.length) : 0;
  const avgExam = examMarks.length > 0 ? Math.round(examMarks.reduce((s, m) => {
    const exam = examList.find(e => e.id === m.examId);
    const subs = exam?.subjects || [];
    const max = subs.length * (exam?.totalMarksPerSubject || 100);
    return s + (max > 0 ? (m.totalMarks / max) * 100 : 0);
  }, 0) / examMarks.length) : 0;
  const overallScore = Math.round((attPct * 0.3 + avgQuiz * 0.3 + avgExam * 0.4) || 0);

  // ═══ AI DOUBT SOLVER ═══
  function handleImageUpload(e) {
    const file = e.target.files?.[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => { setDImgPreview(ev.target.result); setDImgB64(ev.target.result.split(",")[1]); setShowAttach(false); };
    reader.readAsDataURL(file);
    e.target.value = "";
  }

  async function askDoubt() {
    const q = dInput.trim(); if (!q && !dImgB64) return;
    const userMsg = { role: "user", text: q || "Image doubt", img: dImgPreview };
    setDChat(p => [...p, userMsg]); setDInput(""); setDImgPreview(""); setDLoading(true);
    try {
      const model = getGemini();
      const parts = [];
      if (dImgB64) parts.push({ inlineData: { data: dImgB64, mimeType: "image/jpeg" } });
      parts.push({ text: `You are PID Institute's AI tutor. Student: ${student.studentName}, Class: ${student.class}. Answer in Hindi+English mix. Be detailed, give step-by-step solution.\n\nQuestion: ${q || "Explain this image"}` });
      const res = await model.generateContent(parts);
      const aiText = res.response.text();
      setDChat(p => [...p, { role: "ai", text: aiText }]);
      setDImgB64(null);
      // Save to Firebase
      if (student?.id) {
        try { await addDoc(collection(db, "doubt_history"), { studentId: student.id, studentName: student.studentName, question: q || "Image doubt", answer: aiText, subject: "General", hasImage: !!dImgB64, createdAt: serverTimestamp() }); } catch(e) {}
      }
    } catch (e) { setDChat(p => [...p, { role: "ai", text: "Error: " + e.message }]); }
    setDLoading(false);
    setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
  }

  // ═══ AI QUIZ ═══
  async function generateQuiz() {
    if (!quizSubject) { setQuizErr("Subject select karo!"); return; }
    setQuizState("loading"); setQuizErr("");
    try {
      const model = getGemini();
      const prompt = `Generate ${quizCount} MCQ questions for Class ${student.class} student.
Subject: ${quizSubject}${quizChapter ? ", Chapter: " + quizChapter : ""}
Difficulty: ${quizDifficulty}
Return ONLY valid JSON array: [{"q":"question","options":["A","B","C","D"],"correct":0,"explanation":"why"}]
No extra text. Hindi+English mix allowed.`;
      const res = await model.generateContent(prompt);
      let text = res.response.text().replace(/```json|```/g, "").trim();
      const qs = JSON.parse(text);
      setQuizQs(qs); setQuizIdx(0); setQuizAns({}); setQuizScore(0); setQuizState("playing");
    } catch (e) { setQuizErr("Error generating quiz: " + e.message); setQuizState("setup"); }
  }

  async function submitQuiz() {
    let sc = 0;
    quizQs.forEach((q, i) => { if (quizAns[i] === q.correct) sc++; });
    setQuizScore(sc); setQuizState("result");
    const pct = Math.round((sc / quizQs.length) * 100);
    if (student?.id) {
      try {
        await addDoc(collection(db, "quiz_history"), { studentId: student.id, studentName: student.studentName, subject: quizSubject, chapter: quizChapter, score: sc, total: quizQs.length, percentage: pct, difficulty: quizDifficulty, createdAt: serverTimestamp() });
        // Save individual answers for admin tracking
        for (let i = 0; i < quizQs.length; i++) {
          try { await addDoc(collection(db, "quiz_history"), { studentId: student.id, studentName: student.studentName, question: quizQs[i].q, userAnswer: quizQs[i].options[quizAns[i]] || "", correctAnswer: quizQs[i].options[quizQs[i].correct], isCorrect: quizAns[i] === quizQs[i].correct, subject: quizSubject, createdAt: serverTimestamp() }); } catch(e) {}
        }
      } catch (e) {}
    }
  }

  // ═══ LOADING / AUTH SCREENS ═══
  if (loading || studentLoading) return (
    <div style={{ height: "100vh", background: "#0F172A", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", fontFamily: "'DM Sans', sans-serif" }}>
      <div style={{ width: 56, height: 56, borderRadius: 16, background: "linear-gradient(135deg, #4F46E5, #7C3AED)", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 16, animation: "pulse 1.5s infinite" }}><I n="graduation-cap" s={24} c="#fff" /></div>
      <p style={{ color: "#94A3B8", fontWeight: 600 }}>Loading...</p>
      <style>{`@keyframes pulse { 0%,100% { opacity:1; transform:scale(1); } 50% { opacity:.7; transform:scale(.95); } }`}</style>
    </div>
  );

  if (!user) return (
    <div style={{ height: "100vh", background: "linear-gradient(135deg, #0F172A 0%, #1E1B4B 100%)", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'DM Sans', sans-serif" }}>
      <div style={{ textAlign: "center", padding: 40 }}>
        <div style={{ width: 72, height: 72, borderRadius: 20, background: "linear-gradient(135deg, #4F46E5, #7C3AED)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 20px", boxShadow: "0 8px 32px rgba(79,70,229,.4)" }}><I n="graduation-cap" s={32} c="#fff" /></div>
        <h1 style={{ color: "#F1F5F9", fontSize: "1.8rem", fontWeight: 800, margin: "0 0 8px" }}>PID Student App</h1>
        <p style={{ color: "#94A3B8", margin: "0 0 32px", fontSize: ".9rem" }}>Patel Institute Dongargaon</p>
        <button onClick={() => signInWithPopup(auth, googleProvider)} style={{ background: "#fff", color: "#0F172A", border: "none", padding: "14px 32px", borderRadius: 14, fontSize: "1rem", fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", gap: 10, margin: "0 auto", boxShadow: "0 4px 20px rgba(0,0,0,.2)" }}>
          <I n="google" s={18} c="#4285F4" /> Sign in with Google
        </button>
      </div>
    </div>
  );

  if (!student) return null;

  // ═══ STUDENT ENROLLED COURSES (matching class)
  const myCourses = courses.filter(c => {
    const cls = student.class?.toLowerCase() || "";
    const title = (c.title || "").toLowerCase();
    return title.includes(cls.replace("th", "")) || c.classId?.includes(cls);
  });
  const myMaterials = materials.filter(m => {
    const cls = student.class || "";
    return (m.forClass || "").includes(cls) || !m.forClass;
  });

  // ═══ CLASS RANK CALCULATION
  const getRank = () => {
    if (!student?.id || classStudents.length === 0) return "—";
    // Simple rank by exam average
    const ranks = classStudents.map(st => {
      const marks = examMarks.filter(m => m.studentId === st.id);
      const avg = marks.length > 0 ? marks.reduce((s, m) => s + (m.totalMarks || 0), 0) / marks.length : 0;
      return { id: st.id, name: st.studentName, avg };
    }).sort((a, b) => b.avg - a.avg);
    const myIdx = ranks.findIndex(r => r.id === student.id);
    return myIdx >= 0 ? myIdx + 1 : "—";
  };

  // ═══ MAIN RENDER ═══
  return (
    <div style={{ background: dark ? "#000" : "#E2E8F0", minHeight: "100vh", display: "flex", justifyContent: "center", fontFamily: "'DM Sans', 'Inter', sans-serif" }}>
      <style>{`
        * { box-sizing: border-box; -webkit-tap-highlight-color: transparent; }
        ::-webkit-scrollbar { display: none; }
        .fade-in { animation: fadeIn 0.3s ease; }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes slideUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes pulse2 { 0%,100% { transform: scale(1); } 50% { transform: scale(1.05); } }
      `}</style>

      <div style={{ width: "100%", maxWidth: 450, height: "100vh", background: T.bg, color: T.text, display: "flex", flexDirection: "column", position: "relative", overflow: "hidden", boxShadow: "0 0 50px rgba(0,0,0,.15)" }}>

        {/* ═══ HEADER ═══ */}
        <div style={{ padding: "18px 20px 12px", display: "flex", justifyContent: "space-between", alignItems: "center", background: T.bg, zIndex: 10 }}>
          <div>
            <h2 style={{ margin: 0, fontSize: "1.15rem", fontWeight: 800 }}>
              {student.isEnrolled ? `Hi, ${(student.studentName || "").split(" ")[0]}` : "Welcome, Guest"}
            </h2>
            <p style={{ margin: 0, fontSize: ".78rem", color: T.text3 }}>{student.isEnrolled ? `Class ${student.class} · PID Student` : "Explore our courses"}</p>
          </div>
          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <button onClick={() => setDark(!dark)} style={{ background: T.card, border: `1px solid ${T.border}`, width: 36, height: 36, borderRadius: 10, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}><I n={dark ? "sun" : "moon"} s={14} c={T.text3} /></button>
            <div onClick={() => setActiveTab("profile")} style={{ width: 36, height: 36, borderRadius: 10, background: `linear-gradient(135deg, ${T.accent}, #7C3AED)`, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, cursor: "pointer", fontSize: ".9rem" }}>
              {(student.studentName || "S").charAt(0).toUpperCase()}
            </div>
          </div>
        </div>

        {/* ═══ CONTENT ═══ */}
        <div style={{ flex: 1, overflowY: "auto", paddingBottom: 80 }} className="fade-in">

          {/* ══════ HOME / DASHBOARD ══════ */}
          {activeTab === "home" && student.isEnrolled && (
            <div style={{ padding: "8px 20px 20px" }}>
              {/* Performance Card */}
              <div style={{ background: `linear-gradient(135deg, ${T.accent}, #7C3AED)`, borderRadius: 20, padding: 20, color: "#fff", marginBottom: 16, position: "relative", overflow: "hidden" }}>
                <div style={{ position: "absolute", right: -15, top: -15, width: 100, height: 100, borderRadius: "50%", background: "rgba(255,255,255,.08)" }} />
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                  <div>
                    <p style={{ margin: "0 0 2px", fontSize: ".78rem", opacity: .85 }}>Overall Performance</p>
                    <h1 style={{ margin: 0, fontSize: "2.2rem", fontWeight: 900, letterSpacing: "-1px" }}>{overallScore}%</h1>
                  </div>
                  <div style={{ textAlign: "center" }}>
                    <Ring val={overallScore} sz={56} sw={5} c="#fff" bg="rgba(255,255,255,.2)" />
                  </div>
                </div>
                <div style={{ display: "flex", gap: 16, marginTop: 14 }}>
                  <div><p style={{ margin: 0, fontSize: ".65rem", opacity: .75 }}>Attendance</p><p style={{ margin: 0, fontSize: "1rem", fontWeight: 800 }}>{attPct}%</p></div>
                  <div><p style={{ margin: 0, fontSize: ".65rem", opacity: .75 }}>Exam Avg</p><p style={{ margin: 0, fontSize: "1rem", fontWeight: 800 }}>{avgExam}%</p></div>
                  <div><p style={{ margin: 0, fontSize: ".65rem", opacity: .75 }}>Quiz Avg</p><p style={{ margin: 0, fontSize: "1rem", fontWeight: 800 }}>{avgQuiz}%</p></div>
                  <div><p style={{ margin: 0, fontSize: ".65rem", opacity: .75 }}>Rank</p><p style={{ margin: 0, fontSize: "1rem", fontWeight: 800 }}>#{getRank()}</p></div>
                </div>
              </div>

              {/* Quick Actions */}
              <h3 style={{ fontSize: ".95rem", fontWeight: 800, margin: "0 0 10px" }}>Quick Access</h3>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 18 }}>
                {[
                  { tab: "batches", icon: "book-open", label: "My Batches", desc: "Lectures · Notes · DPP", color: "#4F46E5", bg: "#EEF2FF" },
                  { tab: "ai", icon: "robot", label: "AI Tutor", desc: "Doubt Solver · Quiz", color: "#10B981", bg: "#ECFDF5" },
                  { tab: "tests", icon: "laptop-code", label: "Online Tests", desc: "Live MCQ Tests", color: "#F59E0B", bg: "#FFFBEB" },
                  { tab: "performance", icon: "chart-line", label: "Performance", desc: "Marks · Graph · Rank", color: "#EC4899", bg: "#FDF2F8" },
                ].map(x => (
                  <div key={x.tab} onClick={() => setActiveTab(x.tab)} style={{ background: T.card, padding: 14, borderRadius: 16, border: `1px solid ${T.border}`, cursor: "pointer" }}>
                    <div style={{ width: 36, height: 36, borderRadius: 10, background: dark ? T.grad1 : x.bg, color: x.color, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 10 }}><I n={x.icon} s={16} /></div>
                    <h4 style={{ margin: 0, fontSize: ".85rem", fontWeight: 700 }}>{x.label}</h4>
                    <p style={{ margin: "3px 0 0", fontSize: ".68rem", color: T.text3 }}>{x.desc}</p>
                  </div>
                ))}
              </div>

              {/* Recent Exam Results */}
              {examMarks.length > 0 && (
                <div>
                  <h3 style={{ fontSize: ".95rem", fontWeight: 800, margin: "0 0 10px" }}>Recent Exam Results</h3>
                  {examMarks.slice(0, 3).map(m => {
                    const exam = examList.find(e => e.id === m.examId);
                    const subs = exam?.subjects || [];
                    const max = subs.length * (exam?.totalMarksPerSubject || 100);
                    const pct = max > 0 ? Math.round((m.totalMarks / max) * 100) : 0;
                    return (
                      <div key={m.id} style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 14, padding: "12px 14px", marginBottom: 8, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <div>
                          <p style={{ margin: 0, fontSize: ".85rem", fontWeight: 700 }}>{m.examTitle || exam?.title || "Exam"}</p>
                          <p style={{ margin: "2px 0 0", fontSize: ".7rem", color: T.text3 }}>{exam?.examDate || ""} · {m.totalMarks}/{max}</p>
                        </div>
                        <div style={{ width: 42, height: 42, borderRadius: 10, background: pct >= 75 ? "#ECFDF5" : pct >= 50 ? "#FFFBEB" : "#FEF2F2", display: "flex", alignItems: "center", justifyContent: "center" }}>
                          <span style={{ fontSize: ".82rem", fontWeight: 800, color: pct >= 75 ? "#10B981" : pct >= 50 ? "#F59E0B" : "#EF4444" }}>{pct}%</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* ══════ EXPLORE COURSES ══════ */}
          {(activeTab === "explore" || (activeTab === "home" && !student.isEnrolled)) && (
            <div style={{ padding: "8px 20px 20px" }}>
              <h2 style={{ fontSize: "1.3rem", fontWeight: 800, margin: "0 0 4px" }}>Explore Courses</h2>
              <p style={{ fontSize: ".82rem", color: T.text3, margin: "0 0 16px" }}>PID Institute ke courses dekho</p>
              {courses.map(c => (
                <div key={c.id} style={{ background: T.card, borderRadius: 16, border: `1px solid ${T.border}`, marginBottom: 14, overflow: "hidden" }}>
                  <div style={{ padding: "16px 16px 12px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
                      <div style={{ flex: 1 }}>
                        <h3 style={{ margin: "0 0 4px", fontSize: "1rem", fontWeight: 800, color: T.text }}>{c.title}</h3>
                        {c.tag && <span style={{ fontSize: ".65rem", fontWeight: 700, color: T.accent, background: T.grad1, padding: "2px 8px", borderRadius: 6 }}>{c.tag}</span>}
                      </div>
                      {c.price && <span style={{ fontSize: "1rem", fontWeight: 800, color: T.green }}>₹{c.price}</span>}
                    </div>
                    {c.desc && <p style={{ margin: "0 0 10px", fontSize: ".78rem", color: T.text3, lineHeight: 1.4 }}>{c.desc}</p>}
                    {c.teachers?.length > 0 && (
                      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 10 }}>
                        {c.teachers.map((t, i) => (
                          <span key={i} style={{ fontSize: ".65rem", fontWeight: 600, color: T.text2, background: T.inputBg, padding: "3px 8px", borderRadius: 6 }}><I n="user-tie" s={9} c={T.text3} /> {t.name}</span>
                        ))}
                      </div>
                    )}
                    <button onClick={() => alert("Contact for Enrollment\n\nPhone: 8319002877 / 7470412110\nAddress: Matiya Road, Dongargaon")} style={{ width: "100%", padding: "10px", borderRadius: 10, border: `1.5px solid ${T.accent}`, background: "transparent", color: T.accent, fontSize: ".82rem", fontWeight: 700, cursor: "pointer" }}>
                      <I n="phone" s={12} /> Contact for Enrollment
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* ══════ MY BATCHES ══════ */}
          {activeTab === "batches" && (
            <div style={{ padding: "8px 20px 20px" }}>
              {!selectedCourse ? (
                <div>
                  <h2 style={{ fontSize: "1.3rem", fontWeight: 800, margin: "0 0 14px" }}>My Batches</h2>
                  {myCourses.length === 0 ? (
                    <div style={{ textAlign: "center", padding: 40, color: T.text3 }}><I n="book-open" s={36} c={T.border} /><p style={{ marginTop: 12 }}>No batches assigned yet</p></div>
                  ) : myCourses.map(c => (
                    <div key={c.id} onClick={() => setSelectedCourse(c)} style={{ background: T.card, borderRadius: 16, border: `1px solid ${T.border}`, padding: 16, marginBottom: 10, cursor: "pointer", display: "flex", alignItems: "center", gap: 14 }}>
                      <div style={{ width: 48, height: 48, borderRadius: 14, background: `linear-gradient(135deg, ${T.accent}, #7C3AED)`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><I n="book-open" s={20} c="#fff" /></div>
                      <div style={{ flex: 1 }}>
                        <h3 style={{ margin: 0, fontSize: ".95rem", fontWeight: 800 }}>{c.title}</h3>
                        <p style={{ margin: "3px 0 0", fontSize: ".72rem", color: T.text3 }}>{(c.subjects || []).join(" · ") || "All Subjects"}</p>
                      </div>
                      <I n="chevron-right" s={14} c={T.text3} />
                    </div>
                  ))}
                </div>
              ) : !selectedSubject ? (
                <div>
                  <button onClick={() => setSelectedCourse(null)} style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 10, padding: "8px 14px", marginBottom: 14, display: "flex", alignItems: "center", gap: 6, fontWeight: 600, cursor: "pointer", color: T.text3, fontSize: ".82rem" }}><I n="arrow-left" s={12} /> Back</button>
                  <h2 style={{ fontSize: "1.2rem", fontWeight: 800, margin: "0 0 14px" }}>{selectedCourse.title}</h2>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                    {(selectedCourse.subjects || ["Physics", "Chemistry", "Maths"]).map(sub => (
                      <div key={sub} onClick={() => { setSelectedSubject(sub); setMaterialFilter("all"); }} style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 16, padding: 18, textAlign: "center", cursor: "pointer" }}>
                        <div style={{ width: 40, height: 40, borderRadius: 12, background: T.grad1, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 10px" }}><I n="book" s={18} c={T.accent} /></div>
                        <h4 style={{ margin: 0, fontWeight: 700, fontSize: ".88rem" }}>{sub}</h4>
                        <p style={{ margin: "4px 0 0", fontSize: ".65rem", color: T.text3 }}>{myMaterials.filter(m => m.subject === sub).length} materials</p>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div>
                  <button onClick={() => setSelectedSubject(null)} style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 10, padding: "8px 14px", marginBottom: 14, display: "flex", alignItems: "center", gap: 6, fontWeight: 600, cursor: "pointer", color: T.text3, fontSize: ".82rem" }}><I n="arrow-left" s={12} /> Back</button>
                  <h2 style={{ fontSize: "1.2rem", fontWeight: 800, margin: "0 0 12px" }}>{selectedSubject}</h2>
                  {/* Material Type Filter */}
                  <div style={{ display: "flex", gap: 6, marginBottom: 14, overflowX: "auto" }}>
                    {[["all", "All"], ["video", "Lectures"], ["pdf", "Notes"], ["dpp", "DPP"]].map(([v, l]) => (
                      <button key={v} onClick={() => setMaterialFilter(v)} style={{ padding: "7px 14px", borderRadius: 20, border: `1px solid ${materialFilter === v ? T.accent : T.border}`, background: materialFilter === v ? T.accent : T.card, color: materialFilter === v ? "#fff" : T.text2, fontSize: ".75rem", fontWeight: 700, whiteSpace: "nowrap", cursor: "pointer" }}>{l}</button>
                    ))}
                  </div>
                  {myMaterials.filter(m => m.subject === selectedSubject && (materialFilter === "all" || m.materialType === materialFilter)).map(m => (
                    <div key={m.id} style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 14, padding: "12px 14px", marginBottom: 10, display: "flex", alignItems: "center", gap: 12 }}>
                      <div style={{ width: 38, height: 38, borderRadius: 10, background: m.materialType === "video" ? "#EFF6FF" : m.materialType === "pdf" ? "#FDF2F8" : "#F0FDF4", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                        <I n={m.materialType === "video" ? "play" : m.materialType === "pdf" ? "file-pdf" : "tasks"} s={16} c={m.materialType === "video" ? "#3B82F6" : m.materialType === "pdf" ? "#EC4899" : "#10B981"} />
                      </div>
                      <div style={{ flex: 1 }}>
                        <h4 style={{ margin: 0, fontSize: ".85rem", fontWeight: 700 }}>{m.title}</h4>
                        <p style={{ margin: "2px 0 0", fontSize: ".68rem", color: T.text3 }}>{m.chapter || ""} · {(m.materialType || "").toUpperCase()}</p>
                      </div>
                      <a href={m.fileUrl || m.videoUrl} target="_blank" rel="noopener noreferrer" style={{ background: T.accent, color: "#fff", padding: "6px 14px", borderRadius: 8, fontSize: ".72rem", fontWeight: 700, textDecoration: "none" }}>Open</a>
                    </div>
                  ))}
                  {myMaterials.filter(m => m.subject === selectedSubject && (materialFilter === "all" || m.materialType === materialFilter)).length === 0 && (
                    <div style={{ textAlign: "center", padding: 30, color: T.text3, fontSize: ".82rem" }}>No {materialFilter === "all" ? "" : materialFilter} materials yet</div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* ══════ PERFORMANCE TAB ══════ */}
          {activeTab === "performance" && (
            <div style={{ padding: "8px 20px 20px" }}>
              <h2 style={{ fontSize: "1.3rem", fontWeight: 800, margin: "0 0 14px" }}>My Performance</h2>
              {/* Stats */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 16 }}>
                <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 14, padding: 12, textAlign: "center" }}><div style={{ fontSize: "1.3rem", fontWeight: 800, color: T.accent }}>{avgExam}%</div><div style={{ fontSize: ".65rem", color: T.text3 }}>Exam Avg</div></div>
                <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 14, padding: 12, textAlign: "center" }}><div style={{ fontSize: "1.3rem", fontWeight: 800, color: T.green }}>{attPct}%</div><div style={{ fontSize: ".65rem", color: T.text3 }}>Attendance</div></div>
                <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 14, padding: 12, textAlign: "center" }}><div style={{ fontSize: "1.3rem", fontWeight: 800, color: "#7C3AED" }}>#{getRank()}</div><div style={{ fontSize: ".65rem", color: T.text3 }}>Class Rank</div></div>
              </div>

              {/* Exam Graph */}
              {examMarks.length > 0 && (
                <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 16, padding: 16, marginBottom: 14 }}>
                  <h3 style={{ fontSize: ".9rem", fontWeight: 700, margin: "0 0 12px" }}><I n="chart-bar" s={14} c={T.accent} /> Exam Trend</h3>
                  <div style={{ display: "flex", alignItems: "flex-end", gap: 6, height: 120, borderBottom: `2px solid ${T.border}` }}>
                    {examMarks.slice(0, 10).reverse().map((m, i) => {
                      const exam = examList.find(e => e.id === m.examId);
                      const subs = exam?.subjects || [];
                      const max = subs.length * (exam?.totalMarksPerSubject || 100);
                      const pct = max > 0 ? Math.round((m.totalMarks / max) * 100) : 0;
                      const bc = pct >= 75 ? T.green : pct >= 50 ? T.yellow : T.red;
                      return (
                        <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 3 }}>
                          <span style={{ fontSize: ".55rem", fontWeight: 700, color: bc }}>{pct}%</span>
                          <div style={{ width: "100%", maxWidth: 28, height: Math.max(pct * 1, 6) + "px", background: bc, borderRadius: "4px 4px 0 0", transition: "height .5s" }} />
                          <span style={{ fontSize: ".45rem", color: T.text3, maxWidth: 30, overflow: "hidden", textAlign: "center" }}>{(exam?.title || "").slice(0, 6)}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Class Leaderboard */}
              <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 16, padding: 16 }}>
                <h3 style={{ fontSize: ".9rem", fontWeight: 700, margin: "0 0 12px" }}><I n="trophy" s={14} c="#F59E0B" /> Class Leaderboard</h3>
                {(() => {
                  const ranks = classStudents.map(st => {
                    const marks = examMarks.filter(m => m.studentId === st.id);
                    const avg = marks.length > 0 ? Math.round(marks.reduce((s, m) => s + (m.totalMarks || 0), 0) / marks.length) : 0;
                    return { id: st.id, name: st.studentName, avg };
                  }).sort((a, b) => b.avg - a.avg).slice(0, 10);
                  return ranks.length === 0 ? <p style={{ fontSize: ".82rem", color: T.text3, textAlign: "center" }}>No data yet</p> : ranks.map((r, i) => (
                    <div key={r.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 0", borderBottom: i < ranks.length - 1 ? `1px solid ${T.border}` : "none" }}>
                      <div style={{ width: 26, height: 26, borderRadius: 8, background: i === 0 ? "#FFFBEB" : i === 1 ? "#F0F4FA" : i === 2 ? "#FFF7ED" : T.inputBg, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, fontSize: ".72rem", color: i === 0 ? "#F59E0B" : i === 1 ? "#64748B" : i === 2 ? "#D97706" : T.text3 }}>{i + 1}</div>
                      <span style={{ flex: 1, fontSize: ".82rem", fontWeight: r.id === student.id ? 800 : 600, color: r.id === student.id ? T.accent : T.text }}>{r.name}{r.id === student.id ? " (You)" : ""}</span>
                      <span style={{ fontSize: ".78rem", fontWeight: 700, color: T.text2 }}>{r.avg}</span>
                    </div>
                  ));
                })()}
              </div>
            </div>
          )}

          {/* ══════ ONLINE TESTS ══════ */}
          {activeTab === "tests" && (
            <div style={{ padding: "8px 20px 20px" }}>
              <h2 style={{ fontSize: "1.3rem", fontWeight: 800, margin: "0 0 14px" }}>Online Tests</h2>
              {onlineTests.length === 0 ? (
                <div style={{ textAlign: "center", padding: 40, color: T.text3 }}><I n="clipboard-list" s={36} c={T.border} /><p style={{ marginTop: 12 }}>No active tests right now</p></div>
              ) : onlineTests.map(t => (
                <div key={t.id} style={{ background: T.card, borderRadius: 16, border: `1px solid ${T.border}`, padding: 16, marginBottom: 12, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div>
                    <h3 style={{ margin: "0 0 3px", fontSize: ".95rem", fontWeight: 800 }}>{t.title}</h3>
                    <p style={{ margin: 0, fontSize: ".75rem", color: T.text3 }}>{t.subject} · {t.questions?.length || 0} Qs · {t.duration || 60} min</p>
                  </div>
                  <button style={{ background: T.yellow, color: "#fff", border: "none", padding: "9px 18px", borderRadius: 10, fontWeight: 700, cursor: "pointer", fontSize: ".82rem" }}>Start</button>
                </div>
              ))}
            </div>
          )}

          {/* ══════ STUDENT PROFILE ══════ */}
          {activeTab === "profile" && (
            <div style={{ padding: "8px 20px 20px" }}>
              <h2 style={{ fontSize: "1.3rem", fontWeight: 800, margin: "0 0 14px" }}>My Profile</h2>
              <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 20, padding: 24, textAlign: "center", marginBottom: 14 }}>
                <div style={{ width: 72, height: 72, borderRadius: 20, background: `linear-gradient(135deg, ${T.accent}, #7C3AED)`, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 12px", overflow: "hidden" }}>
                  {student.photo && student.photo.startsWith("http") ? <img src={student.photo} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : <span style={{ color: "#fff", fontSize: "1.8rem", fontWeight: 800 }}>{(student.studentName || "S").charAt(0)}</span>}
                </div>
                <h3 style={{ margin: "0 0 4px", fontSize: "1.15rem", fontWeight: 800 }}>{student.studentName}</h3>
                <p style={{ margin: 0, fontSize: ".82rem", color: T.text3 }}>Class {student.class}</p>
              </div>
              <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 16, overflow: "hidden" }}>
                {[
                  ["Board", student.board || "—"],
                  ["Medium", student.medium || "—"],
                  ["Email", student.studentEmail || "—"],
                  ["Father", student.fatherName || "—"],
                  ["Mother", student.motherName || "—"],
                  ["Phone", student.studentPhone || "—"],
                  ["RFID", student.rfidCode || "N/A"],
                  ["Batch", (student.batchStartDate || "") + " to " + (student.batchEndDate || "")],
                ].map(([l, v], i) => (
                  <div key={l} style={{ display: "flex", justifyContent: "space-between", padding: "12px 16px", borderBottom: i < 7 ? `1px solid ${T.border}` : "none" }}>
                    <span style={{ fontSize: ".82rem", color: T.text3, fontWeight: 600 }}>{l}</span>
                    <span style={{ fontSize: ".82rem", fontWeight: 700, textAlign: "right", maxWidth: "60%" }}>{v}</span>
                  </div>
                ))}
              </div>
              <button onClick={() => signOut(auth)} style={{ marginTop: 16, width: "100%", padding: "12px", borderRadius: 12, border: `1px solid ${T.red}`, background: "transparent", color: T.red, fontSize: ".88rem", fontWeight: 700, cursor: "pointer" }}><I n="sign-out-alt" s={14} /> Logout</button>
            </div>
          )}

          {/* ══════ AI PORTAL ══════ */}
          {activeTab === "ai" && (
            <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
              <div style={{ display: "flex", overflowX: "auto", gap: 6, padding: "12px 20px 8px", background: T.bg }}>
                {[{ id: "doubt", l: "Doubt Solver", i: "robot" }, { id: "quiz", l: "AI Quiz", i: "brain" }].map(t => (
                  <button key={t.id} onClick={() => setAiSubTab(t.id)} style={{ padding: "8px 16px", borderRadius: 20, border: `1px solid ${aiSubTab === t.id ? T.accent : T.border}`, background: aiSubTab === t.id ? T.accent : T.card, color: aiSubTab === t.id ? "#fff" : T.text, fontSize: ".78rem", fontWeight: 700, display: "flex", alignItems: "center", gap: 6, whiteSpace: "nowrap", cursor: "pointer" }}>
                    <I n={t.i} s={13} /> {t.l}
                  </button>
                ))}
              </div>

              {/* Doubt Solver */}
              {aiSubTab === "doubt" && (
                <div style={{ flex: 1, display: "flex", flexDirection: "column", padding: "0 20px" }}>
                  <div style={{ flex: 1, overflowY: "auto", padding: "10px 0" }}>
                    {dChat.length === 0 && (
                      <div style={{ textAlign: "center", padding: 40, color: T.text3 }}>
                        <I n="robot" s={40} c={T.border} />
                        <p style={{ marginTop: 12, fontSize: ".88rem", fontWeight: 600 }}>Ask any doubt — photo bhi bhej sakte ho!</p>
                      </div>
                    )}
                    {dChat.map((msg, i) => (
                      <div key={i} style={{ display: "flex", justifyContent: msg.role === "user" ? "flex-end" : "flex-start", marginBottom: 10 }}>
                        <div style={{ maxWidth: "85%", padding: "12px 16px", borderRadius: 16, background: msg.role === "user" ? T.accent : T.card, color: msg.role === "user" ? "#fff" : T.text, fontSize: ".85rem", lineHeight: 1.6, border: msg.role === "ai" ? `1px solid ${T.border}` : "none" }}>
                          {msg.img && <img src={msg.img} alt="" style={{ maxWidth: "100%", borderRadius: 10, marginBottom: 8 }} />}
                          {msg.role === "ai" ? renderMd(msg.text) : msg.text}
                        </div>
                      </div>
                    ))}
                    {dLoading && <div style={{ textAlign: "center", padding: 10 }}><I n="spinner" c={T.accent} cls="fa-spin" /></div>}
                    <div ref={chatEndRef} />
                  </div>
                  {dImgPreview && (
                    <div style={{ padding: "8px 0", display: "flex", alignItems: "center", gap: 8 }}>
                      <img src={dImgPreview} alt="" style={{ width: 50, height: 50, borderRadius: 10, objectFit: "cover" }} />
                      <button onClick={() => { setDImgPreview(""); setDImgB64(null); }} style={{ background: "none", border: "none", color: T.red, cursor: "pointer" }}><I n="times" /></button>
                    </div>
                  )}
                  <div style={{ display: "flex", gap: 8, padding: "10px 0 16px", alignItems: "center" }}>
                    <input type="file" ref={fileInputRef} accept="image/*" onChange={handleImageUpload} style={{ display: "none" }} />
                    <button onClick={() => fileInputRef.current?.click()} style={{ width: 40, height: 40, borderRadius: 12, border: `1px solid ${T.border}`, background: T.card, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><I n="camera" s={14} c={T.text3} /></button>
                    <input value={dInput} onChange={e => setDInput(e.target.value)} onKeyDown={e => e.key === "Enter" && askDoubt()} placeholder="Type your doubt..." style={{ flex: 1, padding: "10px 14px", borderRadius: 12, border: `1px solid ${T.border}`, background: T.inputBg, color: T.text, fontSize: ".85rem", outline: "none" }} />
                    <button onClick={askDoubt} disabled={dLoading} style={{ width: 40, height: 40, borderRadius: 12, background: T.accent, border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><I n="paper-plane" s={14} c="#fff" /></button>
                  </div>
                </div>
              )}

              {/* AI Quiz */}
              {aiSubTab === "quiz" && (
                <div style={{ padding: "12px 20px", flex: 1, overflowY: "auto" }}>
                  {quizState === "setup" && (
                    <div>
                      <h3 style={{ fontSize: "1.1rem", fontWeight: 800, margin: "0 0 14px" }}>Generate AI Quiz</h3>
                      {quizErr && <div style={{ padding: "10px 14px", borderRadius: 10, background: "#FEF2F2", color: "#DC2626", marginBottom: 12, fontSize: ".82rem", fontWeight: 600 }}>{quizErr}</div>}
                      <div style={{ marginBottom: 10 }}><label style={{ fontSize: ".78rem", fontWeight: 700, color: T.text2, display: "block", marginBottom: 4 }}>Subject *</label><input value={quizSubject} onChange={e => setQuizSubject(e.target.value)} placeholder="e.g. Physics, Maths, Biology..." style={{ width: "100%", padding: "10px 14px", borderRadius: 10, border: `1px solid ${T.border}`, background: T.inputBg, color: T.text, fontSize: ".85rem", outline: "none", boxSizing: "border-box" }} /></div>
                      <div style={{ marginBottom: 10 }}><label style={{ fontSize: ".78rem", fontWeight: 700, color: T.text2, display: "block", marginBottom: 4 }}>Chapter (optional)</label><input value={quizChapter} onChange={e => setQuizChapter(e.target.value)} placeholder="e.g. Newton's Laws, Quadratic..." style={{ width: "100%", padding: "10px 14px", borderRadius: 10, border: `1px solid ${T.border}`, background: T.inputBg, color: T.text, fontSize: ".85rem", outline: "none", boxSizing: "border-box" }} /></div>
                      <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
                        <div style={{ flex: 1 }}><label style={{ fontSize: ".78rem", fontWeight: 700, color: T.text2, display: "block", marginBottom: 4 }}>Questions</label><select value={quizCount} onChange={e => setQuizCount(Number(e.target.value))} style={{ width: "100%", padding: "10px", borderRadius: 10, border: `1px solid ${T.border}`, background: T.inputBg, color: T.text, fontSize: ".85rem", outline: "none" }}><option value={5}>5</option><option value={10}>10</option><option value={15}>15</option><option value={20}>20</option></select></div>
                        <div style={{ flex: 1 }}><label style={{ fontSize: ".78rem", fontWeight: 700, color: T.text2, display: "block", marginBottom: 4 }}>Difficulty</label><select value={quizDifficulty} onChange={e => setQuizDifficulty(e.target.value)} style={{ width: "100%", padding: "10px", borderRadius: 10, border: `1px solid ${T.border}`, background: T.inputBg, color: T.text, fontSize: ".85rem", outline: "none" }}><option value="easy">Easy</option><option value="medium">Medium</option><option value="hard">Hard</option></select></div>
                      </div>
                      <button onClick={generateQuiz} style={{ width: "100%", padding: "12px", borderRadius: 12, background: T.accent, color: "#fff", border: "none", fontSize: ".9rem", fontWeight: 700, cursor: "pointer", marginTop: 6 }}><I n="brain" s={14} /> Generate Quiz</button>
                    </div>
                  )}
                  {quizState === "loading" && <div style={{ textAlign: "center", padding: 50 }}><I n="spinner" s={32} c={T.accent} cls="fa-spin" /><p style={{ marginTop: 12, color: T.text3 }}>AI generating questions...</p></div>}
                  {quizState === "playing" && quizQs[quizIdx] && (
                    <div>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                        <span style={{ fontSize: ".82rem", fontWeight: 700, color: T.text3 }}>Q {quizIdx + 1} / {quizQs.length}</span>
                        <div style={{ width: 100, height: 6, background: T.border, borderRadius: 99, overflow: "hidden" }}><div style={{ width: ((quizIdx + 1) / quizQs.length * 100) + "%", height: "100%", background: T.accent, borderRadius: 99, transition: "width .3s" }} /></div>
                      </div>
                      <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 16, padding: 18, marginBottom: 14 }}>
                        <p style={{ margin: 0, fontSize: ".92rem", fontWeight: 700, lineHeight: 1.5 }}>{quizQs[quizIdx].q}</p>
                      </div>
                      {quizQs[quizIdx].options.map((opt, oi) => (
                        <button key={oi} onClick={() => setQuizAns({ ...quizAns, [quizIdx]: oi })} style={{ width: "100%", padding: "12px 16px", borderRadius: 12, border: `1.5px solid ${quizAns[quizIdx] === oi ? T.accent : T.border}`, background: quizAns[quizIdx] === oi ? (dark ? "#312E81" : "#EEF2FF") : T.card, color: T.text, fontSize: ".85rem", fontWeight: 600, textAlign: "left", marginBottom: 8, cursor: "pointer", display: "flex", alignItems: "center", gap: 10 }}>
                          <div style={{ width: 24, height: 24, borderRadius: 8, border: `2px solid ${quizAns[quizIdx] === oi ? T.accent : T.border}`, background: quizAns[quizIdx] === oi ? T.accent : "transparent", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                            {quizAns[quizIdx] === oi && <I n="check" s={11} c="#fff" />}
                          </div>
                          {opt}
                        </button>
                      ))}
                      <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
                        {quizIdx > 0 && <button onClick={() => setQuizIdx(quizIdx - 1)} style={{ flex: 1, padding: "10px", borderRadius: 10, border: `1px solid ${T.border}`, background: T.card, color: T.text, fontSize: ".85rem", fontWeight: 700, cursor: "pointer" }}>Previous</button>}
                        {quizIdx < quizQs.length - 1 ? (
                          <button onClick={() => setQuizIdx(quizIdx + 1)} style={{ flex: 1, padding: "10px", borderRadius: 10, background: T.accent, color: "#fff", border: "none", fontSize: ".85rem", fontWeight: 700, cursor: "pointer" }}>Next</button>
                        ) : (
                          <button onClick={submitQuiz} style={{ flex: 1, padding: "10px", borderRadius: 10, background: T.green, color: "#fff", border: "none", fontSize: ".85rem", fontWeight: 700, cursor: "pointer" }}>Submit Quiz</button>
                        )}
                      </div>
                    </div>
                  )}
                  {quizState === "result" && (
                    <div style={{ textAlign: "center" }}>
                      <div style={{ position: "relative", display: "inline-block", marginBottom: 16 }}>
                        <Ring val={Math.round((quizScore / quizQs.length) * 100)} sz={100} sw={8} c={quizScore / quizQs.length >= 0.7 ? T.green : T.yellow} />
                        <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1.5rem", fontWeight: 900 }}>{quizScore}/{quizQs.length}</div>
                      </div>
                      <h3 style={{ margin: "0 0 4px", fontSize: "1.2rem", fontWeight: 800 }}>{quizScore / quizQs.length >= 0.8 ? "Excellent!" : quizScore / quizQs.length >= 0.5 ? "Good Job!" : "Keep Practicing!"}</h3>
                      <p style={{ color: T.text3, fontSize: ".85rem", margin: "0 0 20px" }}>{Math.round((quizScore / quizQs.length) * 100)}% accuracy</p>
                      {quizQs.map((q, i) => (
                        <div key={i} style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 14, padding: 14, marginBottom: 10, textAlign: "left" }}>
                          <p style={{ margin: "0 0 6px", fontSize: ".82rem", fontWeight: 700 }}>{i + 1}. {q.q}</p>
                          <p style={{ margin: 0, fontSize: ".78rem", color: quizAns[i] === q.correct ? T.green : T.red, fontWeight: 600 }}>
                            Your answer: {q.options[quizAns[i]] || "Skipped"} {quizAns[i] === q.correct ? "✓" : "✗ Correct: " + q.options[q.correct]}
                          </p>
                          {q.explanation && <p style={{ margin: "4px 0 0", fontSize: ".72rem", color: T.text3 }}>{q.explanation}</p>}
                        </div>
                      ))}
                      <button onClick={() => { setQuizState("setup"); setQuizSubject(""); setQuizChapter(""); }} style={{ width: "100%", padding: "12px", borderRadius: 12, background: T.accent, color: "#fff", border: "none", fontSize: ".88rem", fontWeight: 700, cursor: "pointer", marginTop: 10 }}>Take Another Quiz</button>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

        </div>

        {/* ═══ BOTTOM NAV ═══ */}
        <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, background: T.card, borderTop: `1px solid ${T.border}`, display: "flex", justifyContent: "space-around", padding: "10px 8px 18px", zIndex: 100 }}>
          {[
            { id: "home", i: "home", l: "Home" },
            { id: "batches", i: "book-open", l: "Batches" },
            { id: "explore", i: "compass", l: "Explore" },
            { id: "ai", i: "robot", l: "AI" },
            { id: "performance", i: "chart-line", l: "Rank" },
          ].map(tab => (
            <button key={tab.id} onClick={() => { setActiveTab(tab.id); setSelectedCourse(null); setSelectedSubject(null); }} style={{ background: "none", border: "none", display: "flex", flexDirection: "column", alignItems: "center", gap: 3, color: activeTab === tab.id ? T.accent : T.text3, cursor: "pointer", flex: 1 }}>
              <div style={{ width: 30, height: 30, borderRadius: 10, background: activeTab === tab.id ? (dark ? "#312E81" : "#EEF2FF") : "transparent", display: "flex", alignItems: "center", justifyContent: "center", transition: "background .2s" }}><I n={tab.i} s={15} /></div>
              <span style={{ fontSize: ".6rem", fontWeight: activeTab === tab.id ? 800 : 600 }}>{tab.l}</span>
            </button>
          ))}
        </div>

      </div>
    </div>
  );
}
