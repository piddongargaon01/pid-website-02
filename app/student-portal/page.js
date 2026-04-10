"use client";
import { useState, useEffect, useRef } from "react";
import { db, auth, googleProvider } from "../firebase";
import { collection, query, where, onSnapshot, addDoc, updateDoc, doc, serverTimestamp, getDocs, deleteDoc } from "firebase/firestore";
import { signInWithPopup, onAuthStateChanged, signOut } from "firebase/auth";
import { GoogleGenerativeAI } from "@google/generative-ai";

const I = ({ n, s = 16, c = "currentColor" }) => <i className={`fas fa-${n}`} style={{ fontSize: s, color: c }} />;

export default function StudentApp() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [student, setStudent] = useState(null);
  const [studentLoading, setStudentLoading] = useState(false);
  const [activeTab, setActiveTab] = useState("home");
  const [courses, setCourses] = useState([]);
  const [materials, setMaterials] = useState([]);
  const [attendance, setAttendance] = useState([]);
  const [quizHistory, setQuizHistory] = useState([]);
  const [examMarks, setExamMarks] = useState([]);
  const [examList, setExamList] = useState([]);
  const [onlineTests, setOnlineTests] = useState([]);
  const [classStudents, setClassStudents] = useState([]);
  const [holidays, setHolidays] = useState([]);
  const [notices, setNotices] = useState([]);
  const [selectedCourse, setSelectedCourse] = useState(null);
  const [selectedSubject, setSelectedSubject] = useState(null);
  const [materialFilter, setMaterialFilter] = useState("all");
  const [aiSubTab, setAiSubTab] = useState("doubt");
  const [dInput, setDInput] = useState("");
  const [dChat, setDChat] = useState([]);
  const [dLoading, setDLoading] = useState(false);
  const [dImgPreview, setDImgPreview] = useState("");
  const [dImgB64, setDImgB64] = useState(null);
  const chatEndRef = useRef(null);
  const fileInputRef = useRef(null);
  const [quizSubject, setQuizSubject] = useState("");
  const [quizChapter, setQuizChapter] = useState("");
  const [quizCount, setQuizCount] = useState(10);
  const [quizDifficulty, setQuizDifficulty] = useState("medium");
  const [quizState, setQuizState] = useState("setup");
  const [quizErr, setQuizErr] = useState("");
  const [quizQs, setQuizQs] = useState([]);
  const [quizIdx, setQuizIdx] = useState(0);
  const [quizAns, setQuizAns] = useState({});
  const [quizScore, setQuizScore] = useState(0);

  // ═══ NEW STATES ═══
  const [attWeekOffset, setAttWeekOffset] = useState(0);
  const [attViewMode, setAttViewMode] = useState("weekly");
  const [attCalMonth, setAttCalMonth] = useState(new Date().getMonth());
  const [attCalYear, setAttCalYear] = useState(new Date().getFullYear());
  const [activeTest, setActiveTest] = useState(null); // test being taken
  const [testAnswers, setTestAnswers] = useState({});
  const [testQIdx, setTestQIdx] = useState(0);
  const [testTimer, setTestTimer] = useState(0);
  const [testSubmitted, setTestSubmitted] = useState(false);
  const [testScore, setTestScore] = useState(0);
  const [doubtHistory, setDoubtHistory] = useState([]);
  const [allAttendance, setAllAttendance] = useState([]); // full attendance (not just current month)
  const timerRef = useRef(null);
  const [dark, setDark] = useState(false);
  const [answerLang, setAnswerLang] = useState("hinglish");
  const [equations, setEquations] = useState([{ expr: "sin(x)", color: "#635bff" }]);
  const [graphZoom, setGraphZoom] = useState(40);
  const canvasRef = useRef(null);

  function renderMd(text) {
    if (!text) return "";
    let h = text.replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>").replace(/\*(.*?)\*/g, "<em>$1</em>")
      .replace(/`([^`]+)`/g, '<code style="background:#1a1a2e;padding:2px 6px;border-radius:4px;font-size:.82rem;color:#ff6b9d">$1</code>')
      .replace(/\n/g, "<br/>");
    return <span dangerouslySetInnerHTML={{ __html: h }} />;
  }
  function getGemini() {
    const k = process.env.NEXT_PUBLIC_GEMINI_API_KEY;
    if (!k) throw new Error("API Key Missing");
    return new GoogleGenerativeAI(k).getGenerativeModel({ model: "gemini-2.5-flash" });
  }

  useEffect(() => { const u = onAuthStateChanged(auth, u => { setUser(u); setLoading(false); }); return () => u(); }, []);
  useEffect(() => {
    if (!user?.email) { setStudent(null); return; }
    setStudentLoading(true);
    const email = user.email.toLowerCase();
    const unsub = onSnapshot(collection(db, "students"), snap => {
      const found = snap.docs.find(d => d.data().studentEmail?.toLowerCase() === email);
      if (found) setStudent({ id: found.id, ...found.data(), isEnrolled: true });
      else { setStudent({ studentName: user.displayName || "Guest", studentEmail: email, isEnrolled: false, class: "N/A" }); setActiveTab("explore"); }
      setStudentLoading(false);
    });
    return () => unsub();
  }, [user]);

  useEffect(() => {
    if (!student) return;
    const unsubs = [];
    unsubs.push(onSnapshot(collection(db, "courses"), s => { const arr = s.docs.map(d => ({ id: d.id, ...d.data() })); arr.sort((a, b) => (a.order || 99) - (b.order || 99)); setCourses(arr); }));
    unsubs.push(onSnapshot(collection(db, "study_materials"), s => setMaterials(s.docs.map(d => ({ id: d.id, ...d.data() })))));
    unsubs.push(onSnapshot(collection(db, "holidays"), s => setHolidays(s.docs.map(d => ({ id: d.id, ...d.data() })))));
    unsubs.push(onSnapshot(collection(db, "exams"), s => { const arr = s.docs.map(d => ({ id: d.id, ...d.data() })); arr.sort((a, b) => (b.examDate || "").localeCompare(a.examDate || "")); setExamList(arr); }));
    unsubs.push(onSnapshot(collection(db, "online_tests"), s => setOnlineTests(s.docs.map(d => ({ id: d.id, ...d.data() })))));
    unsubs.push(onSnapshot(collection(db, "scheduled_notifications"), s => { const arr = s.docs.map(d => ({ id: d.id, ...d.data() })); arr.sort((a, b) => (b.date || "").localeCompare(a.date || "")); setNotices(arr); }));
    if (student?.id) {
      unsubs.push(onSnapshot(query(collection(db, "attendance"), where("studentId", "==", student.id)), s => {
        const arr = s.docs.map(d => ({ id: d.id, ...d.data() }));
        setAllAttendance(arr);
        const ms = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, "0")}-01`;
        setAttendance(arr.filter(a => a.date >= ms));
      }));
      unsubs.push(onSnapshot(query(collection(db, "quiz_history"), where("studentId", "==", student.id)), s => setQuizHistory(s.docs.map(d => ({ id: d.id, ...d.data() })))));
      unsubs.push(onSnapshot(query(collection(db, "exam_marks"), where("studentId", "==", student.id)), s => setExamMarks(s.docs.map(d => ({ id: d.id, ...d.data() })))));
      unsubs.push(onSnapshot(query(collection(db, "doubt_history"), where("studentId", "==", student.id)), s => { const arr = s.docs.map(d => ({ id: d.id, ...d.data() })); arr.sort((a, b) => (b.createdAt?.toDate?.() || new Date(0)) - (a.createdAt?.toDate?.() || new Date(0))); setDoubtHistory(arr); }));
      if (student.class) unsubs.push(onSnapshot(collection(db, "students"), s => setClassStudents(s.docs.map(d => ({ id: d.id, ...d.data() })).filter(x => x.class === student.class && x.status === "active"))));
    }
    return () => unsubs.forEach(u => u());
  }, [student]);

  const holidayDates = new Set(holidays.map(h => h.date));
  const attPct = (() => { const inD = new Set(attendance.filter(a => a.type === "in").map(a => a.date)).size; const n = new Date(); let w = 0; for (let d = 1; d <= n.getDate(); d++) { const ds = `${n.getFullYear()}-${String(n.getMonth()+1).padStart(2,"0")}-${String(d).padStart(2,"0")}`; if (new Date(ds+"T00:00:00").getDay() !== 0 && !holidayDates.has(ds)) w++; } return w > 0 ? Math.round((inD/w)*100) : 0; })();
  const avgQuiz = quizHistory.filter(q => q.percentage !== undefined).length > 0 ? Math.round(quizHistory.filter(q => q.percentage !== undefined).reduce((s, q) => s + (q.percentage || 0), 0) / quizHistory.filter(q => q.percentage !== undefined).length) : 0;
  const avgExam = examMarks.length > 0 ? Math.round(examMarks.reduce((s, m) => { const ex = examList.find(e => e.id === m.examId); const sb = ex?.subjects || []; const mx = sb.length * (ex?.totalMarksPerSubject || 100); return s + (mx > 0 ? (m.totalMarks / mx) * 100 : 0); }, 0) / examMarks.length) : 0;
  const overallScore = Math.round((attPct * 0.3 + avgQuiz * 0.3 + avgExam * 0.4) || 0);
  const myCourses = courses.filter(c => { const cls = (student?.class || "").toLowerCase(); const t = (c.title || "").toLowerCase(); return t.includes(cls.replace("th", "")) || (c.classId || "").includes(cls); });
  const myMaterials = materials.filter(m => (m.forClass || "").includes(student?.class || "") || !m.forClass);
  const getRank = () => { if (!student?.id || classStudents.length === 0) return "—"; const ranks = classStudents.map(st => { const mk = examMarks.filter(m => m.studentId === st.id); return { id: st.id, name: st.studentName, avg: mk.length > 0 ? mk.reduce((s, m) => s + (m.totalMarks || 0), 0) / mk.length : 0 }; }).sort((a, b) => b.avg - a.avg); const i = ranks.findIndex(r => r.id === student.id); return i >= 0 ? i + 1 : "—"; };
  const today = new Date().toISOString().split("T")[0];
  const todayAtt = allAttendance.filter(a => a.date === today);
  const isPresent = todayAtt.some(a => a.type === "in");
  const totalFee = Number(student?.totalFee || 0);
  const feePaid = Number(student?.enrollmentFeePaid || 0);
  const feeDue = Math.max(0, totalFee - feePaid);
  const upcomingHolidays = holidays.filter(h => h.date >= today).sort((a, b) => a.date.localeCompare(b.date)).slice(0, 3);
  const recentNotices = notices.filter(n => n.date >= today || !n.date).slice(0, 5);

  // AI functions
  function handleImageUpload(e) { const f = e.target.files?.[0]; if (!f) return; const r = new FileReader(); r.onload = (ev) => { setDImgPreview(ev.target.result); setDImgB64(ev.target.result.split(",")[1]); }; r.readAsDataURL(f); e.target.value = ""; }
  async function askDoubt() {
    const q = dInput.trim(); if (!q && !dImgB64) return;
    setDChat(p => [...p, { role: "user", text: q || "Image doubt", img: dImgPreview }]); setDInput(""); setDImgPreview(""); setDLoading(true);
    try {
      const parts = []; if (dImgB64) parts.push({ inlineData: { data: dImgB64, mimeType: "image/jpeg" } });
      parts.push({ text: `You are PID Institute's AI tutor. Student: ${student.studentName}, Class: ${student.class}. ${langPrompt} Be detailed, give step-by-step solution.\n\nQuestion: ${q || "Explain this image"}` });
      const res = await getGemini().generateContent(parts);
      const aiText = res.response.text();
      setDChat(p => [...p, { role: "ai", text: aiText }]); setDImgB64(null);
      if (student?.id) try { await addDoc(collection(db, "doubt_history"), { studentId: student.id, studentName: student.studentName, studentClass: student.class, question: q || "Image doubt", answer: aiText, subject: "General", hasImage: !!dImgB64, messages: [{ role: "user", content: q || "Image doubt" }, { role: "assistant", content: aiText }], createdAt: serverTimestamp() }); } catch(e) {}
    } catch (e) { setDChat(p => [...p, { role: "ai", text: "Error: " + e.message }]); }
    setDLoading(false); setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
  }
  async function generateQuiz() {
    if (!quizSubject) { setQuizErr("Subject select karo!"); return; }
    setQuizState("loading"); setQuizErr("");
    try {
      const res = await getGemini().generateContent(`Generate ${quizCount} MCQ for Class ${student.class}. Subject: ${quizSubject}${quizChapter ? ", Chapter: " + quizChapter : ""}. Difficulty: ${quizDifficulty}. Return ONLY JSON array: [{"q":"question","options":["A","B","C","D"],"correct":0,"explanation":"why"}]`);
      setQuizQs(JSON.parse(res.response.text().replace(/```json|```/g, "").trim())); setQuizIdx(0); setQuizAns({}); setQuizScore(0); setQuizState("playing");
    } catch (e) { setQuizErr("Error: " + e.message); setQuizState("setup"); }
  }
  async function submitQuiz() {
    let sc = 0; quizQs.forEach((q, i) => { if (quizAns[i] === q.correct) sc++; }); setQuizScore(sc); setQuizState("result");
    if (student?.id) {
      const pct = Math.round((sc / quizQs.length) * 100);
      try { await addDoc(collection(db, "quiz_history"), { studentId: student.id, studentName: student.studentName, subject: quizSubject, chapter: quizChapter, score: sc, total: quizQs.length, percentage: pct, difficulty: quizDifficulty, createdAt: serverTimestamp() }); } catch(e) {}
    }
  }

  // ═══ ONLINE TEST FUNCTIONS ═══
  function startTest(test) {
    setActiveTest(test); setTestAnswers({}); setTestQIdx(0); setTestSubmitted(false); setTestScore(0);
    setTestTimer(test.duration * 60 || 1800);
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setTestTimer(prev => {
        if (prev <= 1) { clearInterval(timerRef.current); return 0; }
        return prev - 1;
      });
    }, 1000);
  }
  async function submitTest() {
    if (timerRef.current) clearInterval(timerRef.current);
    const test = activeTest; if (!test) return;
    let sc = 0;
    (test.questions || []).forEach((q, i) => { if (testAnswers[i] === q.correctAnswer) sc++; });
    setTestScore(sc); setTestSubmitted(true);
    if (student?.id) {
      try {
        await addDoc(collection(db, "test_submissions"), {
          testId: test.id, studentId: student.id, studentName: student.studentName, studentClass: student.class,
          answers: testAnswers, score: sc, total: test.questions?.length || 0,
          percentage: Math.round((sc / (test.questions?.length || 1)) * 100),
          subject: test.subject, testTitle: test.title, createdAt: serverTimestamp(),
        });
      } catch (e) { console.error(e); }
    }
  }
  useEffect(() => { if (testTimer === 0 && activeTest && !testSubmitted) submitTest(); }, [testTimer]);
  useEffect(() => { return () => { if (timerRef.current) clearInterval(timerRef.current); }; }, []);

  // Week dates helper
  const getWeekDates = (offset) => {
    const d = new Date(); d.setDate(d.getDate() + offset * 7);
    const day = d.getDay(); const mon = new Date(d); mon.setDate(d.getDate() - (day === 0 ? 6 : day - 1));
    return Array.from({ length: 7 }, (_, i) => { const nd = new Date(mon); nd.setDate(mon.getDate() + i); return nd.toISOString().split("T")[0]; });
  };
  const fmtTime = (ts) => { if (!ts) return "—"; try { return new Date(ts).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" }); } catch { return "—"; } };

  const nav = (tab) => { setActiveTab(tab); setSelectedCourse(null); setSelectedSubject(null); setActiveTest(null); };
  const langLabel = answerLang === "hindi" ? "हिंदी" : answerLang === "english" ? "English" : "Hinglish";
  const langPrompt = answerLang === "hindi" ? "Answer in pure Hindi (Devanagari script)." : answerLang === "english" ? "Answer in English only." : "Answer in Hindi+English mix (Hinglish).";

  // Auto-set language from student medium
  useEffect(() => { if (student?.medium) { const m = student.medium.toLowerCase(); if (m.includes("hindi")) setAnswerLang("hindi"); else if (m.includes("english")) setAnswerLang("english"); } }, [student]);

  // Graph drawing
  useEffect(() => {
    if (!canvasRef.current || activeTab !== "ai" || aiSubTab !== "graph") return;
    const canvas = canvasRef.current; const ctx = canvas.getContext("2d");
    const W = canvas.width = canvas.offsetWidth * 2; const H = canvas.height = canvas.offsetHeight * 2;
    ctx.scale(2, 2); const w = W / 2, h = H / 2;
    ctx.fillStyle = dark ? "#12122a" : "#F8FAFC"; ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = dark ? "#252550" : "#E2E8F0"; ctx.lineWidth = 0.5;
    for (let x = 0; x < w; x += graphZoom) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke(); }
    for (let y = 0; y < h; y += graphZoom) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke(); }
    ctx.strokeStyle = dark ? "#5c6490" : "#94A3B8"; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(0, h / 2); ctx.lineTo(w, h / 2); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(w / 2, 0); ctx.lineTo(w / 2, h); ctx.stroke();
    equations.forEach(eq => {
      if (!eq.expr.trim()) return;
      ctx.strokeStyle = eq.color; ctx.lineWidth = 2; ctx.beginPath();
      let started = false;
      for (let px = 0; px < w; px++) {
        const x = (px - w / 2) / graphZoom;
        try {
          const expr = eq.expr.replace(/sin/g, "Math.sin").replace(/cos/g, "Math.cos").replace(/tan/g, "Math.tan").replace(/sqrt/g, "Math.sqrt").replace(/abs/g, "Math.abs").replace(/log/g, "Math.log").replace(/exp/g, "Math.exp").replace(/pi/g, "Math.PI").replace(/\^/g, "**");
          const y = new Function("x", "return " + expr)(x);
          if (isNaN(y) || !isFinite(y)) { started = false; continue; }
          const py = h / 2 - y * graphZoom;
          if (!started) { ctx.moveTo(px, py); started = true; } else ctx.lineTo(px, py);
        } catch { started = false; }
      }
      ctx.stroke();
    });
  }, [equations, graphZoom, activeTab, aiSubTab, dark]);

  // Delete doubt/quiz history
  async function deleteDoubt(id) { try { await deleteDoc(doc(db, "doubt_history", id)); } catch(e) { console.error(e); } }
  async function deleteQuizItem(id) { try { await deleteDoc(doc(db, "quiz_history", id)); } catch(e) { console.error(e); } }

  // Theme
  const C = dark ? {
    bg: "#0a0a1a", card: "#12122a", card2: "#1a1a36", text: "#eef0ff", text2: "#9ba3c7", text3: "#5c6490",
    border: "#252550", accent: "#635bff", accent2: "#8b83ff", green: "#00d4aa", red: "#ff6b6b", yellow: "#ffc53d",
    pink: "#ff6b9d", orange: "#ff9f43", cyan: "#00d2ff",
    gradMain: "linear-gradient(135deg, #635bff, #ff6b9d)", gradGreen: "linear-gradient(135deg, #00d4aa, #00b4d8)",
    gradOrange: "linear-gradient(135deg, #ff9f43, #ff6b6b)", gradCyan: "linear-gradient(135deg, #00d2ff, #635bff)"
  } : {
    bg: "#F0F4FA", card: "#FFFFFF", card2: "#F8FAFD", text: "#0B1826", text2: "#4A5E78", text3: "#6B7F99",
    border: "#D4DEF0", accent: "#1349A8", accent2: "#2A6FE0", green: "#16A34A", red: "#DC2626", yellow: "#D98D04",
    pink: "#EC4899", orange: "#F59E0B", cyan: "#0891B2",
    gradMain: "linear-gradient(135deg, #1349A8, #2A6FE0)", gradGreen: "linear-gradient(135deg, #16A34A, #059669)",
    gradOrange: "linear-gradient(135deg, #F59E0B, #DC2626)", gradCyan: "linear-gradient(135deg, #0891B2, #1349A8)"
  };

  if (loading || studentLoading) return (
    <div style={{ minHeight: "100vh", background: C.bg, display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column" }}>
      <div style={{ width: 60, height: 60, borderRadius: 18, background: C.gradMain, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 16, animation: "pulse 1.5s infinite" }}><I n="graduation-cap" s={26} c="#fff" /></div>
      <p style={{ color: C.text3, fontSize: ".85rem" }}>Loading...</p>
      <style>{`@keyframes pulse { 0%,100% { opacity:1; } 50% { opacity:.5; } }`}</style>
    </div>
  );

  if (!user) return (
    <div style={{ minHeight: "100vh", background: C.bg, display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
      <div style={{ textAlign: "center", maxWidth: 340, width: "100%" }}>
        <div style={{ width: 80, height: 80, borderRadius: 24, background: C.gradMain, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 24px", boxShadow: "0 12px 40px rgba(99,91,255,.35)" }}><I n="graduation-cap" s={36} c="#fff" /></div>
        <h1 style={{ color: "#fff", fontSize: "1.5rem", fontWeight: 900, margin: "0 0 6px" }}>PID Student App</h1>
        <p style={{ color: C.text3, fontSize: ".82rem", margin: "0 0 28px" }}>Patel Institute Dongargaon</p>
        <button onClick={() => signInWithPopup(auth, googleProvider)} style={{ width: "100%", padding: "14px 24px", borderRadius: 16, background: C.gradMain, color: "#fff", border: "none", fontSize: ".95rem", fontWeight: 800, cursor: "pointer", boxShadow: "0 8px 30px rgba(99,91,255,.4)", display: "flex", alignItems: "center", justifyContent: "center", gap: 10 }}>
          <I n="google" s={18} c="#fff" /> Login with Gmail
        </button>
      </div>
    </div>
  );

  if (!student) return null;

  return (
    <div style={{ minHeight: "100vh", background: C.bg, color: C.text, fontFamily: "'DM Sans', sans-serif", maxWidth: 480, margin: "0 auto", position: "relative" }}>
      <div style={{ paddingBottom: 80 }}>
        {/* ═══ TOP BAR ═══ */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 20px 8px", position: "sticky", top: 0, background: dark ? "rgba(10,10,26,.92)" : "rgba(240,244,250,.92)", backdropFilter: "blur(20px)", zIndex: 50, borderBottom: `1px solid ${C.border}` }}>
          <div><p style={{ margin: 0, fontSize: ".65rem", color: C.text3 }}>Welcome back</p><h2 style={{ margin: 0, fontSize: "1rem", fontWeight: 800 }}>{student.studentName}</h2></div>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <button onClick={() => setDark(!dark)} style={{ width: 34, height: 34, borderRadius: 10, border: `1px solid ${C.border}`, background: C.card, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}><I n={dark ? "sun" : "moon"} s={13} c={C.text3} /></button>
            {student.isEnrolled && <div style={{ padding: "5px 10px", borderRadius: 20, background: C.card2, border: `1px solid ${C.border}`, fontSize: ".65rem", fontWeight: 700, color: C.accent2 }}><I n="trophy" s={10} c={C.yellow} /> #{getRank()}</div>}
            <div onClick={() => nav("profile")} style={{ width: 38, height: 38, borderRadius: 12, background: C.gradMain, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", boxShadow: `0 4px 15px ${dark ? "rgba(99,91,255,.3)" : "rgba(19,73,168,.3)"}`, overflow: "hidden" }}>
              {student.photo && student.photo.startsWith("http") ? <img src={student.photo} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : <span style={{ color: "#fff", fontWeight: 800 }}>{(student.studentName || "S").charAt(0)}</span>}
            </div>
          </div>
        </div>

        {/* ═══════════ HOME ═══════════ */}
        {activeTab === "home" && student.isEnrolled && (
          <div style={{ padding: "6px 20px 20px" }}>
            {/* Hero Stats */}
            <div style={{ background: C.gradMain, borderRadius: 24, padding: "22px 20px", marginBottom: 18, position: "relative", overflow: "hidden" }}>
              <div style={{ position: "absolute", right: -20, top: -30, width: 120, height: 120, borderRadius: "50%", background: "rgba(255,255,255,.07)" }} />
              <p style={{ margin: "0 0 2px", fontSize: ".72rem", color: "rgba(255,255,255,.7)", fontWeight: 600 }}>Overall Score</p>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <h1 style={{ margin: 0, fontSize: "2.8rem", fontWeight: 900, color: "#fff", letterSpacing: "-2px" }}>{overallScore}<span style={{ fontSize: "1.2rem" }}>%</span></h1>
                <div style={{ display: "flex", gap: 12 }}>
                  {[["Attend", attPct, C.green], ["Exam", avgExam, C.yellow], ["Quiz", avgQuiz, C.cyan]].map(([l, v, c]) => (
                    <div key={l} style={{ textAlign: "center" }}>
                      <div style={{ width: 40, height: 40, borderRadius: 12, background: "rgba(255,255,255,.12)", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 4 }}><span style={{ fontSize: ".82rem", fontWeight: 800, color: "#fff" }}>{v}</span></div>
                      <span style={{ fontSize: ".55rem", color: "rgba(255,255,255,.6)" }}>{l}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Today Status */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 16 }}>
              <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 16, padding: "12px 14px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
                  <I n={isPresent ? "check-circle" : "times-circle"} s={14} c={isPresent ? C.green : C.red} />
                  <span style={{ fontSize: ".68rem", fontWeight: 700, color: isPresent ? C.green : C.red }}>TODAY</span>
                </div>
                <p style={{ margin: 0, fontSize: "1rem", fontWeight: 800 }}>{isPresent ? "Present" : "—"}</p>
                <p style={{ margin: "2px 0 0", fontSize: ".62rem", color: C.text3 }}>{todayAtt.find(a => a.type === "in") ? fmtTime(todayAtt.find(a => a.type === "in").timestamp) : "Not checked in"}</p>
              </div>
              <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 16, padding: "12px 14px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
                  <I n="rupee-sign" s={14} c={feeDue > 0 ? C.orange : C.green} />
                  <span style={{ fontSize: ".68rem", fontWeight: 700, color: feeDue > 0 ? C.orange : C.green }}>FEE</span>
                </div>
                <p style={{ margin: 0, fontSize: "1rem", fontWeight: 800, color: feeDue > 0 ? C.orange : C.green }}>{feeDue > 0 ? `₹${feeDue.toLocaleString("en-IN")}` : "Paid ✓"}</p>
                <p style={{ margin: "2px 0 0", fontSize: ".62rem", color: C.text3 }}>{feeDue > 0 ? "Due" : "All clear"}</p>
              </div>
            </div>

            {/* Quick Actions */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 10, marginBottom: 18 }}>
              {[
                { tab: "batches", icon: "book-open", label: "Batches", grad: C.gradMain },
                { tab: "ai", icon: "robot", label: "AI Tutor", grad: C.gradGreen },
                { tab: "tests", icon: "laptop-code", label: "Tests", grad: C.gradOrange },
                { tab: "attendance", icon: "calendar-check", label: "Attend", grad: C.gradCyan },
              ].map(x => (
                <div key={x.tab} onClick={() => nav(x.tab)} style={{ textAlign: "center", cursor: "pointer" }}>
                  <div style={{ width: 48, height: 48, borderRadius: 14, background: x.grad, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 6px", boxShadow: "0 4px 15px rgba(0,0,0,.3)" }}><I n={x.icon} s={18} c="#fff" /></div>
                  <span style={{ fontSize: ".65rem", fontWeight: 700, color: C.text2 }}>{x.label}</span>
                </div>
              ))}
            </div>

            {/* Upcoming Holidays */}
            {upcomingHolidays.length > 0 && (
              <div style={{ marginBottom: 16 }}>
                <h3 style={{ margin: "0 0 10px", fontSize: ".88rem", fontWeight: 800 }}><I n="calendar-alt" s={13} c={C.yellow} /> Upcoming Holidays</h3>
                <div style={{ display: "flex", gap: 8, overflowX: "auto" }}>
                  {upcomingHolidays.map(h => (
                    <div key={h.id} style={{ minWidth: 120, background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, padding: "10px 12px", flexShrink: 0 }}>
                      <p style={{ margin: 0, fontSize: ".72rem", fontWeight: 800, color: C.yellow }}>{h.title}</p>
                      <p style={{ margin: "3px 0 0", fontSize: ".62rem", color: C.text3 }}>{h.date}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Recent Notices */}
            {recentNotices.length > 0 && (
              <div style={{ marginBottom: 16 }}>
                <h3 style={{ margin: "0 0 10px", fontSize: ".88rem", fontWeight: 800 }}><I n="bell" s={13} c={C.pink} /> Notices</h3>
                {recentNotices.slice(0, 3).map(n => (
                  <div key={n.id} style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: "10px 14px", marginBottom: 6, borderLeft: `3px solid ${n.notifType === "fee" ? C.orange : n.notifType === "test" ? C.accent : C.text3}` }}>
                    <p style={{ margin: 0, fontSize: ".8rem", fontWeight: 700 }}>{(n.message || "").slice(0, 60)}</p>
                    <p style={{ margin: "2px 0 0", fontSize: ".62rem", color: C.text3 }}>{n.notifType || "General"} · {n.date || ""}</p>
                  </div>
                ))}
              </div>
            )}

            {/* Recent Results */}
            {examMarks.length > 0 && (
              <div style={{ marginBottom: 16 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                  <h3 style={{ margin: 0, fontSize: ".88rem", fontWeight: 800 }}>Recent Results</h3>
                  <span onClick={() => nav("performance")} style={{ fontSize: ".72rem", color: C.accent2, fontWeight: 600, cursor: "pointer" }}>See all</span>
                </div>
                <div style={{ display: "flex", gap: 10, overflowX: "auto", paddingBottom: 4 }}>
                  {examMarks.slice(0, 5).map(m => {
                    const ex = examList.find(e => e.id === m.examId); const sb = ex?.subjects || []; const mx = sb.length * (ex?.totalMarksPerSubject || 100);
                    const pct = mx > 0 ? Math.round((m.totalMarks / mx) * 100) : 0;
                    return (
                      <div key={m.id} style={{ minWidth: 120, background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, padding: 12, flexShrink: 0 }}>
                        <div style={{ fontSize: "1.4rem", fontWeight: 900, color: pct >= 75 ? C.green : pct >= 50 ? C.yellow : C.red, marginBottom: 4 }}>{pct}%</div>
                        <p style={{ margin: 0, fontSize: ".7rem", fontWeight: 700 }}>{(m.examTitle || ex?.title || "").slice(0, 14)}</p>
                        <p style={{ margin: "2px 0 0", fontSize: ".58rem", color: C.text3 }}>{m.totalMarks}/{mx}</p>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ═══════════ EXPLORE ═══════════ */}
        {(activeTab === "explore" || (activeTab === "home" && !student.isEnrolled)) && (
          <div style={{ padding: "6px 20px 20px" }}>
            <h2 style={{ fontSize: "1.3rem", fontWeight: 900, margin: "0 0 4px" }}>Explore Courses</h2>
            <p style={{ fontSize: ".78rem", color: C.text3, margin: "0 0 16px" }}>PID Institute ke courses</p>
            {courses.map(c => (
              <div key={c.id} style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 18, padding: 16, marginBottom: 10 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 8 }}>
                  <div style={{ width: 44, height: 44, borderRadius: 14, background: C.gradMain, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><I n="book" s={18} c="#fff" /></div>
                  <div style={{ flex: 1 }}>
                    <h3 style={{ margin: 0, fontSize: ".95rem", fontWeight: 800 }}>{c.title}</h3>
                    {c.tag && <span style={{ fontSize: ".6rem", fontWeight: 700, color: C.accent2 }}>{c.tag}</span>}
                  </div>
                </div>
                <p style={{ fontSize: ".76rem", color: C.text3, margin: "0 0 8px", lineHeight: 1.5 }}>{(c.desc || "").slice(0, 100)}</p>
                <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                  {(c.subjects || []).map(sub => <span key={sub} style={{ padding: "3px 8px", borderRadius: 6, background: C.card2, border: `1px solid ${C.border}`, fontSize: ".62rem", fontWeight: 600, color: C.text2 }}>{sub}</span>)}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ═══════════ BATCHES ═══════════ */}
        {activeTab === "batches" && (
          <div style={{ padding: "6px 20px 20px" }}>
            {!selectedCourse ? (
              <div>
                <h2 style={{ fontSize: "1.3rem", fontWeight: 900, margin: "0 0 14px" }}>My Batches</h2>
                {myCourses.length === 0 ? <div style={{ textAlign: "center", padding: 40, color: C.text3 }}><I n="book-open" s={32} c={C.border} /><p>No batches assigned</p></div> : myCourses.map(c => (
                  <div key={c.id} onClick={() => setSelectedCourse(c)} style={{ background: C.card, borderRadius: 18, border: `1px solid ${C.border}`, padding: 16, marginBottom: 10, cursor: "pointer", display: "flex", alignItems: "center", gap: 14 }}>
                    <div style={{ width: 50, height: 50, borderRadius: 16, background: C.gradMain, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><I n="book-open" s={20} c="#fff" /></div>
                    <div style={{ flex: 1 }}><h3 style={{ margin: 0, fontSize: ".95rem", fontWeight: 800 }}>{c.title}</h3><p style={{ margin: "3px 0 0", fontSize: ".7rem", color: C.text3 }}>{(c.subjects || []).join(" · ")}</p></div>
                    <I n="chevron-right" s={14} c={C.text3} />
                  </div>
                ))}
              </div>
            ) : !selectedSubject ? (
              <div>
                <button onClick={() => setSelectedCourse(null)} style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 10, padding: "8px 14px", marginBottom: 14, display: "flex", alignItems: "center", gap: 6, fontWeight: 600, cursor: "pointer", color: C.text3, fontSize: ".8rem" }}><I n="arrow-left" s={12} /> Back</button>
                <h2 style={{ fontSize: "1.15rem", fontWeight: 900, margin: "0 0 14px" }}>{selectedCourse.title}</h2>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                  {(selectedCourse.subjects || ["Physics", "Chemistry", "Maths"]).map((sub, i) => {
                    const grads = [C.gradMain, C.gradGreen, C.gradOrange, C.gradCyan];
                    return (
                      <div key={sub} onClick={() => { setSelectedSubject(sub); setMaterialFilter("all"); }} style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 18, padding: 18, textAlign: "center", cursor: "pointer" }}>
                        <div style={{ width: 44, height: 44, borderRadius: 14, background: grads[i % grads.length], display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 10px" }}><I n="book" s={18} c="#fff" /></div>
                        <h4 style={{ margin: 0, fontWeight: 700, fontSize: ".88rem" }}>{sub}</h4>
                        <p style={{ margin: "4px 0 0", fontSize: ".62rem", color: C.text3 }}>{myMaterials.filter(m => m.subject === sub).length} materials</p>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div>
                <button onClick={() => setSelectedSubject(null)} style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 10, padding: "8px 14px", marginBottom: 14, display: "flex", alignItems: "center", gap: 6, fontWeight: 600, cursor: "pointer", color: C.text3, fontSize: ".8rem" }}><I n="arrow-left" s={12} /> Back</button>
                <h2 style={{ fontSize: "1.15rem", fontWeight: 900, margin: "0 0 12px" }}>{selectedSubject}</h2>
                <div style={{ display: "flex", gap: 6, marginBottom: 14, overflowX: "auto" }}>
                  {[["all", "All", "border"], ["video", "Lectures", "play-circle"], ["pdf", "Notes", "file-alt"], ["dpp", "DPP", "tasks"]].map(([v, l, ic]) => (
                    <button key={v} onClick={() => setMaterialFilter(v)} style={{ padding: "7px 14px", borderRadius: 20, border: `1px solid ${materialFilter === v ? C.accent : C.border}`, background: materialFilter === v ? C.accent : C.card, color: materialFilter === v ? "#fff" : C.text2, fontSize: ".72rem", fontWeight: 700, whiteSpace: "nowrap", cursor: "pointer", display: "flex", alignItems: "center", gap: 5 }}><I n={ic} s={11} /> {l}</button>
                  ))}
                </div>
                {myMaterials.filter(m => m.subject === selectedSubject && (materialFilter === "all" || m.materialType === materialFilter)).map(m => (
                  <div key={m.id} style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, padding: "12px 14px", marginBottom: 8, display: "flex", alignItems: "center", gap: 12 }}>
                    <div style={{ width: 40, height: 40, borderRadius: 12, background: m.materialType === "video" ? "rgba(0,210,255,.12)" : "rgba(255,107,157,.12)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                      <I n={m.materialType === "video" ? "play" : "file-pdf"} s={16} c={m.materialType === "video" ? C.cyan : C.pink} />
                    </div>
                    <div style={{ flex: 1 }}><h4 style={{ margin: 0, fontSize: ".82rem", fontWeight: 700 }}>{m.title}</h4><p style={{ margin: "2px 0 0", fontSize: ".65rem", color: C.text3 }}>{m.chapter || ""}</p></div>
                    <a href={m.fileUrl || m.videoUrl} target="_blank" rel="noopener noreferrer" style={{ background: C.accent, color: "#fff", padding: "7px 14px", borderRadius: 10, fontSize: ".72rem", fontWeight: 700, textDecoration: "none" }}>Open</a>
                  </div>
                ))}
                {myMaterials.filter(m => m.subject === selectedSubject && (materialFilter === "all" || m.materialType === materialFilter)).length === 0 && <div style={{ textAlign: "center", padding: 30, color: C.text3 }}>No materials yet</div>}
              </div>
            )}
          </div>
        )}

        {/* ═══════════ ATTENDANCE ═══════════ */}
        {activeTab === "attendance" && (
          <div style={{ padding: "6px 20px 20px" }}>
            <h2 style={{ fontSize: "1.3rem", fontWeight: 900, margin: "0 0 4px" }}>Attendance</h2>
            <p style={{ fontSize: ".72rem", color: C.text3, margin: "0 0 14px" }}>This month: {attPct}% · {new Set(attendance.filter(a => a.type === "in").map(a => a.date)).size}P / {Math.max(0, (() => { const n = new Date(); let w = 0; for (let d = 1; d <= n.getDate(); d++) { const ds = `${n.getFullYear()}-${String(n.getMonth()+1).padStart(2,"0")}-${String(d).padStart(2,"0")}`; if (new Date(ds+"T00:00:00").getDay() !== 0 && !holidayDates.has(ds)) w++; } return w; })() - new Set(attendance.filter(a => a.type === "in").map(a => a.date)).size)}A</p>

            {/* Toggle */}
            <div style={{ display: "flex", gap: 4, marginBottom: 14, background: C.card2, borderRadius: 12, padding: 3 }}>
              <button onClick={() => setAttViewMode("weekly")} style={{ flex: 1, padding: "9px 0", borderRadius: 10, border: "none", background: attViewMode === "weekly" ? C.accent : "transparent", color: attViewMode === "weekly" ? "#fff" : C.text3, fontSize: ".76rem", fontWeight: 700, cursor: "pointer" }}>Weekly</button>
              <button onClick={() => setAttViewMode("monthly")} style={{ flex: 1, padding: "9px 0", borderRadius: 10, border: "none", background: attViewMode === "monthly" ? C.accent : "transparent", color: attViewMode === "monthly" ? "#fff" : C.text3, fontSize: ".76rem", fontWeight: 700, cursor: "pointer" }}>Monthly</button>
            </div>

            {/* WEEKLY VIEW */}
            {attViewMode === "weekly" && (() => {
              const weekDates = getWeekDates(attWeekOffset);
              return (
                <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 18, padding: 16 }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
                    <button onClick={() => setAttWeekOffset(attWeekOffset - 1)} style={{ width: 32, height: 32, borderRadius: 10, border: `1px solid ${C.border}`, background: C.card2, cursor: "pointer", color: C.text2, fontSize: 12, display: "flex", alignItems: "center", justifyContent: "center" }}>◀</button>
                    <div style={{ textAlign: "center" }}>
                      <div style={{ fontSize: ".8rem", fontWeight: 700 }}>{new Date(weekDates[0]).toLocaleDateString("en-IN", { day: "2-digit", month: "short" })} — {new Date(weekDates[6]).toLocaleDateString("en-IN", { day: "2-digit", month: "short" })}</div>
                      <div style={{ fontSize: ".6rem", color: C.text3 }}>{attWeekOffset === 0 ? "This Week" : `${Math.abs(attWeekOffset)}w ${attWeekOffset < 0 ? "ago" : "ahead"}`}</div>
                    </div>
                    <button onClick={() => setAttWeekOffset(attWeekOffset + 1)} style={{ width: 32, height: 32, borderRadius: 10, border: `1px solid ${C.border}`, background: C.card2, cursor: "pointer", color: C.text2, fontSize: 12, display: "flex", alignItems: "center", justifyContent: "center" }}>▶</button>
                  </div>
                  {attWeekOffset !== 0 && <div style={{ textAlign: "center", marginBottom: 8 }}><button onClick={() => setAttWeekOffset(0)} style={{ fontSize: ".65rem", color: C.accent2, background: C.card2, border: `1px solid ${C.border}`, borderRadius: 8, padding: "3px 10px", cursor: "pointer" }}>Today</button></div>}
                  {weekDates.map((ds, i) => {
                    const dt = new Date(ds + "T00:00:00");
                    const isSun = dt.getDay() === 0; const isHol = holidayDates.has(ds);
                    const isFuture = ds > today;
                    const dayAtt = allAttendance.filter(a => a.date === ds);
                    const hasIn = dayAtt.some(a => a.type === "in");
                    const checkIn = dayAtt.find(a => a.type === "in");
                    const checkOut = dayAtt.find(a => a.type === "out");
                    const status = isSun ? "S" : isHol ? "H" : isFuture ? "—" : hasIn ? "P" : "A";
                    const clr = status === "P" ? C.green : status === "A" ? C.red : status === "H" ? C.yellow : status === "S" ? "#a78bfa" : C.text3;
                    return (
                      <div key={ds} style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 0", borderBottom: i < 6 ? `1px solid ${C.border}` : "none", background: ds === today ? "rgba(99,91,255,.06)" : "transparent", borderRadius: ds === today ? 8 : 0, padding: ds === today ? "9px 8px" : "9px 0" }}>
                        <div style={{ width: 36, textAlign: "center" }}><div style={{ fontSize: ".82rem", fontWeight: 700 }}>{dt.getDate()}</div><div style={{ fontSize: ".55rem", color: C.text3 }}>{["Sun","Mon","Tue","Wed","Thu","Fri","Sat"][dt.getDay()]}</div></div>
                        <div style={{ flex: 1, fontSize: ".72rem", color: C.text2 }}>{hasIn ? fmtTime(checkIn?.timestamp) : "—"}</div>
                        <div style={{ fontSize: ".72rem", color: C.text2 }}>{checkOut ? fmtTime(checkOut?.timestamp) : "—"}</div>
                        <div style={{ width: 28, height: 28, borderRadius: 8, background: `${clr}15`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                          <span style={{ fontSize: ".7rem", fontWeight: 800, color: clr }}>{status}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })()}

            {/* MONTHLY CALENDAR */}
            {attViewMode === "monthly" && (
              <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 18, padding: 16 }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
                  <button onClick={() => { if (attCalMonth === 0) { setAttCalMonth(11); setAttCalYear(attCalYear - 1); } else setAttCalMonth(attCalMonth - 1); }} style={{ width: 32, height: 32, borderRadius: 10, border: `1px solid ${C.border}`, background: C.card2, cursor: "pointer", color: C.text2, fontSize: 12, display: "flex", alignItems: "center", justifyContent: "center" }}>◀</button>
                  <span style={{ fontSize: ".88rem", fontWeight: 800 }}>{new Date(attCalYear, attCalMonth).toLocaleDateString("en-IN", { month: "long", year: "numeric" })}</span>
                  <button onClick={() => { if (attCalMonth === 11) { setAttCalMonth(0); setAttCalYear(attCalYear + 1); } else setAttCalMonth(attCalMonth + 1); }} style={{ width: 32, height: 32, borderRadius: 10, border: `1px solid ${C.border}`, background: C.card2, cursor: "pointer", color: C.text2, fontSize: 12, display: "flex", alignItems: "center", justifyContent: "center" }}>▶</button>
                </div>
                {/* Stats */}
                {(() => {
                  const dim = new Date(attCalYear, attCalMonth + 1, 0).getDate();
                  let mP = 0, mA = 0, mH = 0, mW = 0;
                  for (let d = 1; d <= dim; d++) {
                    const ds = `${attCalYear}-${String(attCalMonth + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
                    if (ds > today) continue;
                    if (new Date(ds + "T00:00:00").getDay() === 0 || holidayDates.has(ds)) { mH++; continue; }
                    mW++;
                    if (allAttendance.some(a => a.date === ds && a.type === "in")) mP++; else mA++;
                  }
                  return (
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 6, marginBottom: 10 }}>
                      {[["P", mP, C.green], ["A", mA, C.red], ["H", mH, C.yellow], ["%", mW > 0 ? Math.round((mP/mW)*100) : 0, C.accent2]].map(([l, v, c]) => (
                        <div key={l} style={{ textAlign: "center", padding: 6, borderRadius: 8, background: `${c}10`, border: `1px solid ${c}22` }}>
                          <div style={{ fontSize: ".9rem", fontWeight: 800, color: c }}>{v}{l === "%" ? "%" : ""}</div>
                          <div style={{ fontSize: ".55rem", color: C.text3 }}>{l === "%" ? "Score" : l === "P" ? "Present" : l === "A" ? "Absent" : "Holiday"}</div>
                        </div>
                      ))}
                    </div>
                  );
                })()}
                {/* Calendar Grid */}
                <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 3 }}>
                  {["M", "T", "W", "T", "F", "S", "S"].map((d, i) => <div key={i} style={{ textAlign: "center", fontSize: ".6rem", fontWeight: 700, color: i === 6 ? C.red : C.text3, padding: "4px 0" }}>{d}</div>)}
                  {(() => {
                    const dim = new Date(attCalYear, attCalMonth + 1, 0).getDate();
                    const fd = new Date(attCalYear, attCalMonth, 1).getDay();
                    const so = fd === 0 ? 6 : fd - 1;
                    const cells = [];
                    for (let i = 0; i < so; i++) cells.push(<div key={`e${i}`} />);
                    for (let d = 1; d <= dim; d++) {
                      const ds = `${attCalYear}-${String(attCalMonth + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
                      const isSun = new Date(ds + "T00:00:00").getDay() === 0;
                      const isHol = holidayDates.has(ds); const isFuture = ds > today; const isToday = ds === today;
                      const hasIn = allAttendance.some(a => a.date === ds && a.type === "in");
                      let bg = C.card2, clr = C.text3, label = "—";
                      if (isHol) { bg = `${C.yellow}18`; clr = C.yellow; label = "H"; }
                      else if (isSun) { bg = "rgba(167,139,250,.1)"; clr = "#a78bfa"; label = "S"; }
                      else if (isFuture) { bg = C.card2; clr = C.text3; label = "—"; }
                      else if (hasIn) { bg = `${C.green}18`; clr = C.green; label = "P"; }
                      else { bg = `${C.red}18`; clr = C.red; label = "A"; }
                      cells.push(
                        <div key={ds} style={{ background: bg, borderRadius: 8, padding: "4px 2px", textAlign: "center", minHeight: 38, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", border: isToday ? `2px solid ${C.accent}` : `1px solid ${C.border}` }}>
                          <div style={{ fontSize: ".68rem", fontWeight: 700, color: clr }}>{d}</div>
                          <div style={{ fontSize: ".5rem", fontWeight: 700, color: clr }}>{label}</div>
                        </div>
                      );
                    }
                    return cells;
                  })()}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ═══════════ TESTS (with actual test-taking flow) ═══════════ */}
        {activeTab === "tests" && (
          <div style={{ padding: "6px 20px 20px" }}>
            {!activeTest ? (
              <div>
                <h2 style={{ fontSize: "1.3rem", fontWeight: 900, margin: "0 0 14px" }}>Online Tests</h2>
                {onlineTests.filter(t => t.isActive).length === 0 ? <div style={{ textAlign: "center", padding: 40, color: C.text3 }}><I n="clipboard-list" s={32} c={C.border} /><p>No active tests right now</p></div>
                : onlineTests.filter(t => t.isActive).map(t => (
                  <div key={t.id} style={{ background: C.card, borderRadius: 18, border: `1px solid ${C.border}`, padding: 16, marginBottom: 10 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                      <div>
                        <h3 style={{ margin: "0 0 3px", fontSize: ".92rem", fontWeight: 800 }}>{t.title}</h3>
                        <p style={{ margin: 0, fontSize: ".72rem", color: C.text3 }}>{t.subject} · {t.questions?.length || 0} Qs · {t.duration || 30} min</p>
                        {t.chapter && <p style={{ margin: "2px 0 0", fontSize: ".65rem", color: C.text3 }}>{t.chapter}</p>}
                      </div>
                      <button onClick={() => startTest(t)} style={{ background: C.gradOrange, color: "#fff", border: "none", padding: "9px 18px", borderRadius: 12, fontWeight: 700, cursor: "pointer", fontSize: ".8rem", flexShrink: 0 }}><I n="play" s={12} c="#fff" /> Start</button>
                    </div>
                  </div>
                ))}
              </div>
            ) : testSubmitted ? (
              /* TEST RESULT */
              <div style={{ textAlign: "center" }}>
                <div style={{ width: 90, height: 90, borderRadius: "50%", background: testScore / (activeTest.questions?.length || 1) >= .7 ? `${C.green}18` : `${C.yellow}18`, border: `4px solid ${testScore / (activeTest.questions?.length || 1) >= .7 ? C.green : C.yellow}`, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px" }}>
                  <span style={{ fontSize: "1.6rem", fontWeight: 900 }}>{testScore}/{activeTest.questions?.length || 0}</span>
                </div>
                <h3 style={{ margin: "0 0 4px", fontSize: "1.2rem", fontWeight: 900 }}>{testScore / (activeTest.questions?.length || 1) >= .8 ? "Excellent!" : testScore / (activeTest.questions?.length || 1) >= .5 ? "Good!" : "Keep Trying!"}</h3>
                <p style={{ color: C.text3, fontSize: ".85rem", margin: "0 0 20px" }}>{Math.round((testScore / (activeTest.questions?.length || 1)) * 100)}% accuracy</p>
                {(activeTest.questions || []).map((q, i) => (
                  <div key={i} style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, padding: 14, marginBottom: 8, textAlign: "left" }}>
                    <p style={{ margin: "0 0 6px", fontSize: ".82rem", fontWeight: 700 }}>{i + 1}. {q.question}</p>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 4 }}>
                      {(q.options || []).map((opt, oi) => (
                        <div key={oi} style={{ padding: "4px 8px", borderRadius: 6, fontSize: ".72rem", background: q.correctAnswer === oi ? `${C.green}15` : testAnswers[i] === oi ? `${C.red}15` : C.card2, color: q.correctAnswer === oi ? C.green : testAnswers[i] === oi ? C.red : C.text3, border: `1px solid ${q.correctAnswer === oi ? C.green : testAnswers[i] === oi ? C.red : C.border}33` }}>
                          {String.fromCharCode(65 + oi)}. {opt} {q.correctAnswer === oi && "✓"}{testAnswers[i] === oi && q.correctAnswer !== oi && "✗"}
                        </div>
                      ))}
                    </div>
                    {q.explanation && <p style={{ margin: "4px 0 0", fontSize: ".65rem", color: C.text3 }}><I n="lightbulb" s={9} c={C.yellow} /> {q.explanation}</p>}
                  </div>
                ))}
                <button onClick={() => { setActiveTest(null); setTestSubmitted(false); }} style={{ width: "100%", padding: "13px", borderRadius: 14, background: C.gradMain, color: "#fff", border: "none", fontWeight: 700, cursor: "pointer", marginTop: 10 }}>Back to Tests</button>
              </div>
            ) : (
              /* TEST TAKING */
              <div>
                {/* Timer + Progress */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                  <span style={{ fontSize: ".78rem", fontWeight: 700, color: C.text3 }}>Q{testQIdx + 1}/{activeTest.questions?.length || 0}</span>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <I n="clock" s={12} c={testTimer < 60 ? C.red : C.text3} />
                    <span style={{ fontSize: ".82rem", fontWeight: 800, color: testTimer < 60 ? C.red : C.text2, fontFamily: "monospace" }}>{Math.floor(testTimer / 60)}:{String(testTimer % 60).padStart(2, "0")}</span>
                  </div>
                </div>
                <div style={{ width: "100%", height: 4, background: C.card2, borderRadius: 99, marginBottom: 14, overflow: "hidden" }}>
                  <div style={{ width: `${((testQIdx + 1) / (activeTest.questions?.length || 1)) * 100}%`, height: "100%", background: C.accent, borderRadius: 99, transition: "width .3s" }} />
                </div>

                {/* Question */}
                {activeTest.questions?.[testQIdx] && (
                  <>
                    <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 18, padding: 18, marginBottom: 14 }}>
                      <p style={{ margin: 0, fontSize: ".9rem", fontWeight: 700, lineHeight: 1.6 }}>{activeTest.questions[testQIdx].question}</p>
                    </div>
                    {(activeTest.questions[testQIdx].options || []).map((opt, oi) => (
                      <button key={oi} onClick={() => setTestAnswers({ ...testAnswers, [testQIdx]: oi })} style={{ width: "100%", padding: "13px 16px", borderRadius: 14, border: `1.5px solid ${testAnswers[testQIdx] === oi ? C.accent : C.border}`, background: testAnswers[testQIdx] === oi ? "rgba(99,91,255,.1)" : C.card, color: C.text, fontSize: ".84rem", fontWeight: 600, textAlign: "left", marginBottom: 8, cursor: "pointer", display: "flex", alignItems: "center", gap: 10 }}>
                        <div style={{ width: 24, height: 24, borderRadius: 8, border: `2px solid ${testAnswers[testQIdx] === oi ? C.accent : C.border}`, background: testAnswers[testQIdx] === oi ? C.accent : "transparent", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>{testAnswers[testQIdx] === oi && <I n="check" s={11} c="#fff" />}</div>
                        {opt}
                      </button>
                    ))}
                    <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
                      {testQIdx > 0 && <button onClick={() => setTestQIdx(testQIdx - 1)} style={{ flex: 1, padding: "11px", borderRadius: 12, border: `1px solid ${C.border}`, background: C.card, color: C.text, fontWeight: 700, cursor: "pointer" }}>Prev</button>}
                      {testQIdx < (activeTest.questions?.length || 1) - 1 ? <button onClick={() => setTestQIdx(testQIdx + 1)} style={{ flex: 1, padding: "11px", borderRadius: 12, background: C.accent, color: "#fff", border: "none", fontWeight: 700, cursor: "pointer" }}>Next</button>
                      : <button onClick={submitTest} style={{ flex: 1, padding: "11px", borderRadius: 12, background: C.gradGreen, color: "#fff", border: "none", fontWeight: 700, cursor: "pointer" }}>Submit Test</button>}
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        )}

        {/* ═══════════ PERFORMANCE ═══════════ */}
        {activeTab === "performance" && (
          <div style={{ padding: "6px 20px 20px" }}>
            <h2 style={{ fontSize: "1.3rem", fontWeight: 900, margin: "0 0 14px" }}>Performance</h2>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 16 }}>
              {[["Exam", avgExam + "%", C.accent], ["Attend", attPct + "%", C.green], ["Rank", "#" + getRank(), C.yellow]].map(([l, v, c]) => (
                <div key={l} style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 16, padding: 14, textAlign: "center" }}>
                  <div style={{ fontSize: "1.4rem", fontWeight: 900, color: c }}>{v}</div>
                  <div style={{ fontSize: ".65rem", color: C.text3, fontWeight: 600 }}>{l}</div>
                </div>
              ))}
            </div>
            {/* Exam Graph */}
            {examMarks.length > 0 && (
              <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 18, padding: 16, marginBottom: 14 }}>
                <h3 style={{ fontSize: ".88rem", fontWeight: 800, margin: "0 0 12px" }}><I n="chart-bar" s={13} c={C.accent2} /> Exam Trend</h3>
                <div style={{ display: "flex", alignItems: "flex-end", gap: 5, height: 110, borderBottom: `1px solid ${C.border}` }}>
                  {examMarks.slice(0, 10).reverse().map((m, i) => {
                    const ex = examList.find(e => e.id === m.examId); const sb = ex?.subjects || []; const mx = sb.length * (ex?.totalMarksPerSubject || 100);
                    const pct = mx > 0 ? Math.round((m.totalMarks / mx) * 100) : 0;
                    return (
                      <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 3 }}>
                        <span style={{ fontSize: ".5rem", fontWeight: 700, color: pct >= 75 ? C.green : pct >= 50 ? C.yellow : C.red }}>{pct}</span>
                        <div style={{ width: "100%", maxWidth: 24, height: Math.max(pct * .9, 4) + "px", background: pct >= 75 ? C.green : pct >= 50 ? C.yellow : C.red, borderRadius: "4px 4px 0 0", opacity: .85 }} />
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
            {/* Leaderboard */}
            <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 18, padding: 16 }}>
              <h3 style={{ fontSize: ".88rem", fontWeight: 800, margin: "0 0 12px" }}><I n="trophy" s={13} c={C.yellow} /> Class Leaderboard</h3>
              {(() => {
                const ranks = classStudents.map(st => { const mk = examMarks.filter(m => m.studentId === st.id); return { id: st.id, name: st.studentName, avg: mk.length > 0 ? Math.round(mk.reduce((s, m) => s + (m.totalMarks || 0), 0) / mk.length) : 0 }; }).sort((a, b) => b.avg - a.avg).slice(0, 10);
                return ranks.length === 0 ? <p style={{ fontSize: ".8rem", color: C.text3, textAlign: "center" }}>No data yet</p> : ranks.map((r, i) => (
                  <div key={r.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 0", borderBottom: i < ranks.length - 1 ? `1px solid ${C.border}` : "none" }}>
                    <div style={{ width: 28, height: 28, borderRadius: 10, background: i === 0 ? "rgba(255,197,61,.15)" : i === 1 ? "rgba(192,192,192,.12)" : i === 2 ? "rgba(205,127,50,.12)" : C.card2, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, fontSize: ".75rem", color: i === 0 ? C.yellow : i === 1 ? "#C0C0C0" : i === 2 ? "#CD7F32" : C.text3 }}>{i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : i + 1}</div>
                    <span style={{ flex: 1, fontSize: ".82rem", fontWeight: r.id === student.id ? 800 : 600, color: r.id === student.id ? C.accent2 : C.text }}>{r.name}{r.id === student.id ? " (You)" : ""}</span>
                  </div>
                ));
              })()}
            </div>
          </div>
        )}

        {/* ═══════════ PROFILE ═══════════ */}
        {activeTab === "profile" && (
          <div style={{ padding: "6px 20px 20px" }}>
            <h2 style={{ fontSize: "1.3rem", fontWeight: 900, margin: "0 0 14px" }}>My Profile</h2>
            <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 22, padding: 24, textAlign: "center", marginBottom: 14, position: "relative", overflow: "hidden" }}>
              <div style={{ width: 72, height: 72, borderRadius: 20, background: C.gradMain, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 12px", overflow: "hidden" }}>
                {student.photo && student.photo.startsWith("http") ? <img src={student.photo} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : <span style={{ color: "#fff", fontSize: "1.8rem", fontWeight: 800 }}>{(student.studentName || "S").charAt(0)}</span>}
              </div>
              <h3 style={{ margin: "0 0 4px", fontSize: "1.15rem", fontWeight: 900 }}>{student.studentName}</h3>
              <p style={{ margin: 0, fontSize: ".82rem", color: C.text3 }}>Class {student.class}</p>
            </div>
            {/* Fee Status */}
            <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 18, padding: 16, marginBottom: 14 }}>
              <h4 style={{ margin: "0 0 10px", fontSize: ".88rem", fontWeight: 800 }}><I n="rupee-sign" s={13} c={C.orange} /> Fee Status</h4>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
                <div style={{ textAlign: "center" }}><div style={{ fontSize: "1rem", fontWeight: 800, color: C.accent2 }}>₹{totalFee.toLocaleString("en-IN")}</div><div style={{ fontSize: ".6rem", color: C.text3 }}>Total</div></div>
                <div style={{ textAlign: "center" }}><div style={{ fontSize: "1rem", fontWeight: 800, color: C.green }}>₹{feePaid.toLocaleString("en-IN")}</div><div style={{ fontSize: ".6rem", color: C.text3 }}>Paid</div></div>
                <div style={{ textAlign: "center" }}><div style={{ fontSize: "1rem", fontWeight: 800, color: feeDue > 0 ? C.red : C.green }}>₹{feeDue.toLocaleString("en-IN")}</div><div style={{ fontSize: ".6rem", color: C.text3 }}>Due</div></div>
              </div>
            </div>
            <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 18, overflow: "hidden" }}>
              {[["Board", student.board], ["Medium", student.medium], ["Email", student.studentEmail], ["Father", student.fatherName], ["Mother", student.motherName], ["Phone", student.studentPhone], ["RFID", student.rfidCode || "N/A"]].map(([l, v], i, a) => (
                <div key={l} style={{ display: "flex", justifyContent: "space-between", padding: "13px 16px", borderBottom: i < a.length - 1 ? `1px solid ${C.border}` : "none" }}>
                  <span style={{ fontSize: ".8rem", color: C.text3, fontWeight: 600 }}>{l}</span>
                  <span style={{ fontSize: ".8rem", fontWeight: 700, textAlign: "right", maxWidth: "55%", wordBreak: "break-word" }}>{v || "—"}</span>
                </div>
              ))}
            </div>
            <button onClick={() => signOut(auth)} style={{ marginTop: 16, width: "100%", padding: "13px", borderRadius: 14, border: `1px solid ${C.red}`, background: "rgba(255,107,107,.08)", color: C.red, fontSize: ".88rem", fontWeight: 700, cursor: "pointer" }}><I n="sign-out-alt" s={14} /> Logout</button>
          </div>
        )}

        {/* ═══════════ AI PORTAL ═══════════ */}
        {activeTab === "ai" && (
          <div style={{ display: "flex", flexDirection: "column", height: "calc(100vh - 140px)" }}>
            <div style={{ display: "flex", gap: 6, padding: "8px 20px" }}>
              {[{ id: "doubt", l: "Doubt", i: "robot" }, { id: "quiz", l: "Quiz", i: "brain" }, { id: "graph", l: "Graph", i: "chart-line" }, { id: "history", l: "History", i: "history" }].map(t => (
                <button key={t.id} onClick={() => setAiSubTab(t.id)} style={{ padding: "9px 14px", borderRadius: 20, border: `1px solid ${aiSubTab === t.id ? C.accent : C.border}`, background: aiSubTab === t.id ? C.accent : C.card, color: aiSubTab === t.id ? "#fff" : C.text2, fontSize: ".72rem", fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", gap: 5 }}><I n={t.i} s={11} /> {t.l}</button>
              ))}
            </div>
            {aiSubTab === "doubt" && (
              <div style={{ flex: 1, display: "flex", flexDirection: "column", padding: "0 20px" }}>
                {/* Language selector */}
                <div style={{ display: "flex", gap: 6, padding: "8px 0", alignItems: "center" }}>
                  <span style={{ fontSize: ".68rem", color: C.text3, fontWeight: 600 }}>Language:</span>
                  {[{ v: "hinglish", l: "HI+EN" }, { v: "hindi", l: "हिंदी" }, { v: "english", l: "EN" }].map(la => (
                    <button key={la.v} onClick={() => setAnswerLang(la.v)} style={{ padding: "4px 10px", borderRadius: 8, border: `1.5px solid ${answerLang === la.v ? C.accent : C.border}`, background: answerLang === la.v ? C.accent + "20" : "transparent", color: answerLang === la.v ? C.accent : C.text3, fontSize: ".68rem", fontWeight: 700, cursor: "pointer" }}>{la.l}</button>
                  ))}
                </div>
                <div style={{ flex: 1, overflowY: "auto", padding: "6px 0" }}>
                  {dChat.length === 0 && <div style={{ textAlign: "center", padding: 40, color: C.text3 }}><div style={{ width: 60, height: 60, borderRadius: 20, background: C.card2, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 12px" }}><I n="robot" s={26} c={C.accent} /></div><p style={{ fontSize: ".88rem", fontWeight: 600 }}>Ask any doubt!</p><p style={{ fontSize: ".72rem", color: C.text3 }}>Photo ya file bhi bhej sakte ho</p></div>}
                  {dChat.map((msg, i) => (
                    <div key={i} style={{ display: "flex", justifyContent: msg.role === "user" ? "flex-end" : "flex-start", marginBottom: 10 }}>
                      {msg.role === "ai" && <div style={{ width: 28, height: 28, borderRadius: 10, background: C.gradMain, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, marginRight: 8, marginTop: 4 }}><I n="robot" s={12} c="#fff" /></div>}
                      <div style={{ maxWidth: "80%", padding: "12px 16px", borderRadius: msg.role === "user" ? "18px 18px 4px 18px" : "18px 18px 18px 4px", background: msg.role === "user" ? C.accent : C.card, color: msg.role === "user" ? "#fff" : C.text, fontSize: ".84rem", lineHeight: 1.7, border: msg.role === "ai" ? `1px solid ${C.border}` : "none" }}>
                        {msg.img && <img src={msg.img} alt="" style={{ maxWidth: "100%", borderRadius: 12, marginBottom: 8 }} />}
                        {msg.role === "ai" ? renderMd(msg.text) : msg.text}
                      </div>
                    </div>
                  ))}
                  {dLoading && <div style={{ display: "flex", alignItems: "center", gap: 8, padding: 10 }}><div style={{ width: 28, height: 28, borderRadius: 10, background: C.gradMain, display: "flex", alignItems: "center", justifyContent: "center" }}><I n="robot" s={12} c="#fff" /></div><div style={{ padding: "10px 16px", background: C.card, borderRadius: 18, border: `1px solid ${C.border}` }}><I n="spinner" s={14} c={C.accent} cls="fa-spin" /> <span style={{ fontSize: ".78rem", color: C.text3, marginLeft: 6 }}>Thinking...</span></div></div>}
                  <div ref={chatEndRef} />
                </div>
                {dImgPreview && <div style={{ padding: "8px 0", display: "flex", gap: 8, alignItems: "center" }}><img src={dImgPreview} alt="" style={{ width: 48, height: 48, borderRadius: 10, objectFit: "cover" }} /><button onClick={() => { setDImgPreview(""); setDImgB64(null); }} style={{ background: "none", border: "none", color: C.red, cursor: "pointer" }}><I n="times" /></button></div>}
                <div style={{ display: "flex", gap: 8, padding: "10px 0 16px" }}>
                  <input type="file" ref={fileInputRef} accept="image/*,.pdf,.doc,.docx" onChange={handleImageUpload} style={{ display: "none" }} />
                  <button onClick={() => fileInputRef.current?.click()} style={{ width: 42, height: 42, borderRadius: 14, border: `1px solid ${C.border}`, background: C.card, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }} title="Attach image or file"><I n="paperclip" s={15} c={C.text3} /></button>
                  <input value={dInput} onChange={e => setDInput(e.target.value)} onKeyDown={e => e.key === "Enter" && askDoubt()} placeholder={`Doubt puchho (${langLabel})...`} style={{ flex: 1, padding: "10px 16px", borderRadius: 14, border: `1px solid ${C.border}`, background: C.card, color: C.text, fontSize: ".85rem", outline: "none" }} />
                  <button onClick={askDoubt} disabled={dLoading} style={{ width: 42, height: 42, borderRadius: 14, background: C.gradMain, border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, boxShadow: `0 4px 12px ${dark ? "rgba(99,91,255,.3)" : "rgba(19,73,168,.25)"}` }}><I n="paper-plane" s={15} c="#fff" /></button>
                </div>
              </div>
            )}
            {aiSubTab === "quiz" && (
              <div style={{ padding: "10px 20px", flex: 1, overflowY: "auto" }}>
                {quizState === "setup" && (
                  <div>
                    <h3 style={{ fontSize: "1.1rem", fontWeight: 900, margin: "0 0 14px" }}>AI Quiz Generator</h3>
                    {quizErr && <div style={{ padding: "10px 14px", borderRadius: 12, background: `${C.red}15`, border: `1px solid ${C.red}33`, color: C.red, marginBottom: 12, fontSize: ".82rem", fontWeight: 600 }}>{quizErr}</div>}
                    <div style={{ marginBottom: 10 }}><label style={{ fontSize: ".76rem", fontWeight: 700, color: C.text2, display: "block", marginBottom: 4 }}>Subject *</label><input value={quizSubject} onChange={e => setQuizSubject(e.target.value)} placeholder="e.g. Physics" style={{ width: "100%", padding: "11px 14px", borderRadius: 12, border: `1px solid ${C.border}`, background: C.card, color: C.text, fontSize: ".85rem", outline: "none", boxSizing: "border-box" }} /></div>
                    <div style={{ marginBottom: 10 }}><label style={{ fontSize: ".76rem", fontWeight: 700, color: C.text2, display: "block", marginBottom: 4 }}>Chapter</label><input value={quizChapter} onChange={e => setQuizChapter(e.target.value)} placeholder="e.g. Motion" style={{ width: "100%", padding: "11px 14px", borderRadius: 12, border: `1px solid ${C.border}`, background: C.card, color: C.text, fontSize: ".85rem", outline: "none", boxSizing: "border-box" }} /></div>
                    <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
                      <div style={{ flex: 1 }}><label style={{ fontSize: ".76rem", fontWeight: 700, color: C.text2, display: "block", marginBottom: 4 }}>Questions</label><select value={quizCount} onChange={e => setQuizCount(Number(e.target.value))} style={{ width: "100%", padding: "10px", borderRadius: 12, border: `1px solid ${C.border}`, background: C.card, color: C.text }}><option value={5}>5</option><option value={10}>10</option><option value={15}>15</option><option value={20}>20</option></select></div>
                      <div style={{ flex: 1 }}><label style={{ fontSize: ".76rem", fontWeight: 700, color: C.text2, display: "block", marginBottom: 4 }}>Difficulty</label><select value={quizDifficulty} onChange={e => setQuizDifficulty(e.target.value)} style={{ width: "100%", padding: "10px", borderRadius: 12, border: `1px solid ${C.border}`, background: C.card, color: C.text }}><option value="easy">Easy</option><option value="medium">Medium</option><option value="hard">Hard</option></select></div>
                    </div>
                    <button onClick={generateQuiz} style={{ width: "100%", padding: "13px", borderRadius: 14, background: C.gradMain, color: "#fff", border: "none", fontSize: ".92rem", fontWeight: 800, cursor: "pointer" }}><I n="brain" s={14} /> Generate Quiz</button>
                  </div>
                )}
                {quizState === "loading" && <div style={{ textAlign: "center", padding: 50 }}><I n="spinner" s={32} c={C.accent} /><p style={{ marginTop: 12, color: C.text3 }}>Generating...</p></div>}
                {quizState === "playing" && quizQs[quizIdx] && (
                  <div>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 12 }}>
                      <span style={{ fontSize: ".8rem", fontWeight: 700, color: C.text3 }}>Q{quizIdx + 1}/{quizQs.length}</span>
                      <div style={{ width: 100, height: 5, background: C.card2, borderRadius: 99, overflow: "hidden" }}><div style={{ width: ((quizIdx + 1) / quizQs.length * 100) + "%", height: "100%", background: C.accent, borderRadius: 99 }} /></div>
                    </div>
                    <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 18, padding: 18, marginBottom: 14 }}><p style={{ margin: 0, fontSize: ".9rem", fontWeight: 700, lineHeight: 1.5 }}>{quizQs[quizIdx].q}</p></div>
                    {quizQs[quizIdx].options.map((opt, oi) => (
                      <button key={oi} onClick={() => setQuizAns({ ...quizAns, [quizIdx]: oi })} style={{ width: "100%", padding: "13px 16px", borderRadius: 14, border: `1.5px solid ${quizAns[quizIdx] === oi ? C.accent : C.border}`, background: quizAns[quizIdx] === oi ? "rgba(99,91,255,.1)" : C.card, color: C.text, fontSize: ".84rem", fontWeight: 600, textAlign: "left", marginBottom: 8, cursor: "pointer", display: "flex", alignItems: "center", gap: 10 }}>
                        <div style={{ width: 24, height: 24, borderRadius: 8, border: `2px solid ${quizAns[quizIdx] === oi ? C.accent : C.border}`, background: quizAns[quizIdx] === oi ? C.accent : "transparent", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>{quizAns[quizIdx] === oi && <I n="check" s={11} c="#fff" />}</div>
                        {opt}
                      </button>
                    ))}
                    <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
                      {quizIdx > 0 && <button onClick={() => setQuizIdx(quizIdx - 1)} style={{ flex: 1, padding: "11px", borderRadius: 12, border: `1px solid ${C.border}`, background: C.card, color: C.text, fontWeight: 700, cursor: "pointer" }}>Prev</button>}
                      {quizIdx < quizQs.length - 1 ? <button onClick={() => setQuizIdx(quizIdx + 1)} style={{ flex: 1, padding: "11px", borderRadius: 12, background: C.accent, color: "#fff", border: "none", fontWeight: 700, cursor: "pointer" }}>Next</button>
                      : <button onClick={submitQuiz} style={{ flex: 1, padding: "11px", borderRadius: 12, background: C.gradGreen, color: "#fff", border: "none", fontWeight: 700, cursor: "pointer" }}>Submit</button>}
                    </div>
                  </div>
                )}
                {quizState === "result" && (
                  <div style={{ textAlign: "center" }}>
                    <div style={{ width: 90, height: 90, borderRadius: "50%", background: quizScore / quizQs.length >= .7 ? `${C.green}18` : `${C.yellow}18`, border: `4px solid ${quizScore / quizQs.length >= .7 ? C.green : C.yellow}`, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px" }}>
                      <span style={{ fontSize: "1.6rem", fontWeight: 900 }}>{quizScore}/{quizQs.length}</span>
                    </div>
                    <h3 style={{ margin: "0 0 4px", fontSize: "1.2rem", fontWeight: 900 }}>{quizScore / quizQs.length >= .8 ? "Excellent!" : quizScore / quizQs.length >= .5 ? "Good!" : "Keep Trying!"}</h3>
                    <p style={{ color: C.text3, fontSize: ".85rem", margin: "0 0 20px" }}>{Math.round((quizScore / quizQs.length) * 100)}%</p>
                    {quizQs.map((q, i) => (
                      <div key={i} style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, padding: 14, marginBottom: 8, textAlign: "left" }}>
                        <p style={{ margin: "0 0 6px", fontSize: ".82rem", fontWeight: 700 }}>{i + 1}. {q.q}</p>
                        <p style={{ margin: 0, fontSize: ".76rem", color: quizAns[i] === q.correct ? C.green : C.red, fontWeight: 600 }}>
                          Your: {q.options[quizAns[i]] || "Skip"} {quizAns[i] === q.correct ? "✓" : "✗ → " + q.options[q.correct]}
                        </p>
                        {q.explanation && <p style={{ margin: "4px 0 0", fontSize: ".7rem", color: C.text3 }}>{q.explanation}</p>}
                      </div>
                    ))}
                    <button onClick={() => { setQuizState("setup"); setQuizSubject(""); setQuizChapter(""); }} style={{ width: "100%", padding: "12px", borderRadius: 14, background: C.gradMain, color: "#fff", border: "none", fontWeight: 700, cursor: "pointer", marginTop: 10 }}>Another Quiz</button>
                  </div>
                )}
              </div>
            )}
            {/* ═══ HISTORY TAB ═══ */}
            {aiSubTab === "history" && (
              <div style={{ padding: "10px 20px", flex: 1, overflowY: "auto" }}>
                <h3 style={{ fontSize: "1rem", fontWeight: 900, margin: "0 0 6px" }}>AI History</h3>
                {/* Quiz History */}
                <h4 style={{ fontSize: ".82rem", fontWeight: 700, margin: "14px 0 8px", color: C.accent2 }}><I n="brain" s={12} c={C.accent2} /> Quiz History ({quizHistory.filter(q => q.percentage !== undefined).length})</h4>
                {quizHistory.filter(q => q.percentage !== undefined).length === 0 ? <p style={{ fontSize: ".78rem", color: C.text3 }}>No quizzes yet</p>
                : quizHistory.filter(q => q.percentage !== undefined).slice(0, 15).map((q, i) => (
                  <div key={q.id || i} style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: "10px 14px", marginBottom: 6, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div style={{ flex: 1 }}><p style={{ margin: 0, fontSize: ".8rem", fontWeight: 700 }}>{q.subject} {q.chapter ? `· ${q.chapter}` : ""}</p><p style={{ margin: "2px 0 0", fontSize: ".62rem", color: C.text3 }}>{q.score}/{q.total} · {q.difficulty} {q.createdAt?.toDate ? " · " + q.createdAt.toDate().toLocaleDateString("en-IN") : ""}</p></div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ fontSize: "1rem", fontWeight: 900, color: (q.percentage || 0) >= 70 ? C.green : C.yellow }}>{q.percentage}%</span>
                      <button onClick={() => { if (confirm("Delete this quiz record?")) deleteQuizItem(q.id); }} style={{ width: 28, height: 28, borderRadius: 8, border: `1px solid ${C.red}33`, background: `${C.red}10`, color: C.red, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><I n="trash" s={10} /></button>
                    </div>
                  </div>
                ))}
                {/* Doubt History */}
                <h4 style={{ fontSize: ".82rem", fontWeight: 700, margin: "14px 0 8px", color: C.pink }}><I n="question-circle" s={12} c={C.pink} /> Doubt History ({doubtHistory.length})</h4>
                {doubtHistory.length === 0 ? <p style={{ fontSize: ".78rem", color: C.text3 }}>No doubts yet</p>
                : doubtHistory.slice(0, 20).map((d, i) => (
                  <div key={d.id || i} style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: "10px 14px", marginBottom: 6 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
                      <div style={{ flex: 1 }}>
                        <p style={{ margin: 0, fontSize: ".8rem", fontWeight: 600 }}>{d.messages?.[0]?.content || d.question || "Doubt"}</p>
                        <div style={{ display: "flex", gap: 6, marginTop: 4, flexWrap: "wrap", alignItems: "center" }}>
                          <span style={{ fontSize: ".6rem", padding: "2px 6px", borderRadius: 4, background: C.card2, color: C.accent2, fontWeight: 600 }}>{d.subject || "General"}</span>
                          {d.hasImage && <span style={{ fontSize: ".6rem", padding: "2px 6px", borderRadius: 4, background: C.card2, color: C.orange, fontWeight: 600 }}><I n="image" s={8} /> Image</span>}
                          {d.createdAt?.toDate && <span style={{ fontSize: ".58rem", color: C.text3 }}>{d.createdAt.toDate().toLocaleDateString("en-IN")}</span>}
                        </div>
                      </div>
                      <button onClick={() => { if (confirm("Delete this doubt?")) deleteDoubt(d.id); }} style={{ width: 28, height: 28, borderRadius: 8, border: `1px solid ${C.red}33`, background: `${C.red}10`, color: C.red, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><I n="trash" s={10} /></button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* ═══ MATH GRAPH TAB ═══ */}
            {aiSubTab === "graph" && (
              <div style={{ padding: "10px 20px", flex: 1, overflowY: "auto" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                  <h3 style={{ fontSize: "1rem", fontWeight: 900, margin: 0 }}><I n="chart-line" s={14} c={C.red} /> Math Graph</h3>
                  <div style={{ display: "flex", gap: 4 }}>
                    <button onClick={() => setGraphZoom(z => Math.max(10, z - 10))} style={{ width: 30, height: 30, borderRadius: 8, border: `1px solid ${C.border}`, background: C.card, cursor: "pointer", color: C.text, fontSize: ".8rem" }}>−</button>
                    <button onClick={() => setGraphZoom(40)} style={{ width: 30, height: 30, borderRadius: 8, border: `1px solid ${C.border}`, background: C.card, cursor: "pointer", color: C.text3, fontSize: ".65rem", fontWeight: 700 }}><I n="crosshairs" s={11} /></button>
                    <button onClick={() => setGraphZoom(z => Math.min(150, z + 10))} style={{ width: 30, height: 30, borderRadius: 8, border: `1px solid ${C.border}`, background: C.card, cursor: "pointer", color: C.text, fontSize: ".8rem" }}>+</button>
                  </div>
                </div>

                {/* Canvas */}
                <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 16, overflow: "hidden", marginBottom: 12 }}>
                  <canvas ref={canvasRef} style={{ width: "100%", height: 220, display: "block" }} />
                </div>

                {/* Equations */}
                {equations.map((eq, i) => (
                  <div key={i} style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
                    <div style={{ width: 14, height: 14, borderRadius: 4, background: eq.color, flexShrink: 0 }} />
                    <span style={{ fontSize: ".78rem", fontWeight: 700, color: C.text3, width: 20 }}>y=</span>
                    <input value={eq.expr} onChange={e => { const n = [...equations]; n[i].expr = e.target.value; setEquations(n); }} placeholder="sin(x), x**2..." style={{ flex: 1, padding: "9px 12px", borderRadius: 10, border: `1px solid ${C.border}`, background: C.card, color: C.text, fontSize: ".84rem", outline: "none", fontFamily: "monospace" }} />
                    {equations.length > 1 && <button onClick={() => setEquations(equations.filter((_, j) => j !== i))} style={{ background: "none", border: "none", color: C.red, cursor: "pointer", fontSize: ".8rem" }}>✕</button>}
                  </div>
                ))}
                <button onClick={() => { if (equations.length < 6) { const colors = ["#635bff", "#00d4aa", "#ff6b6b", "#ffc53d", "#00d2ff", "#ff6b9d"]; setEquations([...equations, { expr: "", color: colors[equations.length % colors.length] }]); } }} style={{ width: "100%", padding: "10px", borderRadius: 10, border: `1px dashed ${C.border}`, background: "transparent", color: C.text3, fontSize: ".78rem", fontWeight: 600, cursor: "pointer", marginBottom: 12 }}>+ Add Equation</button>

                {/* Math Keyboard */}
                <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, padding: 12 }}>
                  <p style={{ margin: "0 0 8px", fontSize: ".72rem", fontWeight: 700, color: C.text3 }}>Quick Insert</p>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                    {["sin(x)", "cos(x)", "tan(x)", "x**2", "x**3", "sqrt(x)", "abs(x)", "log(x)", "exp(x)", "1/x", "pi*x", "2*x+1"].map(fn => (
                      <button key={fn} onClick={() => { const last = equations.length - 1; const n = [...equations]; n[last].expr = fn; setEquations(n); }} style={{ padding: "6px 10px", borderRadius: 8, border: `1px solid ${C.border}`, background: C.card2, color: C.text2, fontSize: ".72rem", fontWeight: 600, cursor: "pointer", fontFamily: "monospace" }}>{fn}</button>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ═══ BOTTOM NAV ═══ */}
      <div style={{ position: "fixed", bottom: 0, left: "50%", transform: "translateX(-50%)", width: "100%", maxWidth: 480, background: dark ? "rgba(10,10,26,.95)" : "rgba(255,255,255,.95)", backdropFilter: "blur(20px)", borderTop: `1px solid ${C.border}`, display: "flex", justifyContent: "space-around", padding: "8px 6px 20px", zIndex: 100 }}>
        {[{ id: "home", i: "home", l: "Home" }, { id: "batches", i: "book-open", l: "Study" }, { id: "ai", i: "robot", l: "AI" }, { id: "tests", i: "laptop-code", l: "Tests" }, { id: "attendance", i: "calendar-check", l: "Attend" }, { id: "performance", i: "chart-line", l: "Rank" }].map(t => (
          <button key={t.id} onClick={() => nav(t.id)} style={{ background: "none", border: "none", display: "flex", flexDirection: "column", alignItems: "center", gap: 3, color: activeTab === t.id ? C.accent2 : C.text3, cursor: "pointer", flex: 1, position: "relative" }}>
            {activeTab === t.id && <div style={{ position: "absolute", top: -8, width: 20, height: 3, borderRadius: 99, background: C.accent }} />}
            <div style={{ width: 30, height: 30, borderRadius: 10, background: activeTab === t.id ? (dark ? "rgba(99,91,255,.12)" : "rgba(19,73,168,.1)") : "transparent", display: "flex", alignItems: "center", justifyContent: "center" }}><I n={t.i} s={14} /></div>
            <span style={{ fontSize: ".52rem", fontWeight: activeTab === t.id ? 800 : 600 }}>{t.l}</span>
          </button>
        ))}
      </div>

      <style>{`@keyframes pulse { 0%,100% { opacity:1; } 50% { opacity:.5; } } * { -webkit-tap-highlight-color: transparent; } ::-webkit-scrollbar { display: none; }`}</style>
    </div>
  );
}
