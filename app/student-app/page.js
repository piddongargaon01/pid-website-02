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

  // ── App Navigation ──
  const [activeTab, setActiveTab] = useState("dashboard");
  const [aiSubTab, setAiSubTab] = useState("doubt");
  const [dark, setDark] = useState(false);

  // ── Global Data ──
  const [courses, setCourses] = useState([]);
  const [materials, setMaterials] = useState([]);
  const [attendance, setAttendance] = useState([]);
  const [quizHistory, setQuizHistory] = useState([]);
  const [tests, setTests] = useState([]);

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
  const [answerLang, setAnswerLang] = useState("hinglish");
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
    if (!user?.email) { setStudent(null); return; }
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
  }, [user]);

  // Fetch Global Data
  useEffect(() => {
    if (!student) return;
    const unsubs = [];
    unsubs.push(onSnapshot(collection(db, "courses"), s => setCourses(s.docs.map(d => ({ id: d.id, ...d.data() })))));
    unsubs.push(onSnapshot(collection(db, "study_materials"), s => {
      const mats = s.docs.map(d => ({ id: d.id, ...d.data() }));
      setMaterials(mats);
      setTests(mats.filter(m => m.materialType === "test"));
    }));
    if (student?.id) {
      const monthStart = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, "0")}-01`;
      unsubs.push(onSnapshot(query(collection(db, "attendance"), where("studentId", "==", student.id)), s => {
        const allAtt = s.docs.map(d => ({ id: d.id, ...d.data() }));
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
  const attPct = attendance.length > 0 ? Math.round((attendance.filter(a => a.type === "in").length / (attendance.length / 2 || 1)) * 100) : 0;
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

      const prompt = `You are a smart AI tutor for Class ${ci} Indian students. ${si}. Board: ${student?.board || "CG Board"}.

LANGUAGE: ${langLabel}.

RESPONSE RULES (VERY IMPORTANT):
- Simple factual questions → 1-3 lines max, direct answer
- Definition questions → 2-4 lines, crisp definition + one example
- Solve/calculate questions → step-by-step solution, numbered steps
- Explain/concept questions → 4-8 lines with key points as bullet points (•)
- NEVER over-explain. Be concise and clear like a smart tutor, not a textbook
- Use **bold** for key terms/formulas only
- If image attached, analyze and solve based on image
- End with a quick tip or memory trick if relevant (1 line max)

Student Profile: ${student?.studentName}, Attendance: ${attPct}%, Avg Score: ${avgQuiz}%, Weak Areas: ${weakSubjects.join(", ") || "None"}.

${hist ? `Context:\n${hist}\n\n` : ""}Student: ${msgText || "Analyze this image and solve/explain it."}`;

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

  if (!user) return (
    <div style={{ background: "linear-gradient(150deg, #070D1A 0%, #0C1F36 50%, #162544 100%)", minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'Nunito', 'Inter', sans-serif" }}>
      <style>{`@keyframes float{0%,100%{transform:translateY(0)}50%{transform:translateY(-8px)}}@keyframes glow{0%,100%{box-shadow:0 0 20px rgba(212,168,67,0.15)}50%{box-shadow:0 0 40px rgba(212,168,67,0.3)}}`}</style>
      <div style={{ background: "linear-gradient(145deg, #111B2E, #0C1F36)", padding: "48px 36px", borderRadius: 28, maxWidth: 400, width: "92%", textAlign: "center", border: "1px solid #1C2D45", boxShadow: "0 25px 60px rgba(0,0,0,0.5)", animation: "glow 3s ease-in-out infinite" }}>
        <div style={{ width: 80, height: 80, borderRadius: 20, background: "linear-gradient(135deg, #D4A843, #B8912E)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 24px", boxShadow: "0 8px 30px rgba(212,168,67,0.3)", animation: "float 3s ease-in-out infinite" }}>
          <img src="/pid_logo.png" alt="PID" style={{ width: 52, height: 52, borderRadius: 12 }} onError={e => { e.target.style.display = 'none'; e.target.nextSibling && (e.target.nextSibling.style.display = 'flex'); }} />
          <span style={{ display: "none", color: "#0C1F36", fontWeight: 900, fontSize: "1.4rem" }}>PID</span>
        </div>
        <h1 style={{ color: "#E8EDF5", fontSize: "1.7rem", fontWeight: 800, margin: "0 0 6px", fontFamily: "'Nunito', sans-serif", letterSpacing: "-0.5px" }}>Student App</h1>
        <p style={{ color: "#D4A843", fontSize: ".85rem", fontWeight: 700, margin: "0 0 8px", textTransform: "uppercase", letterSpacing: "2px" }}>Patel Institute Dongargaon</p>
        <p style={{ color: "#6B7F99", fontSize: ".85rem", marginBottom: 32, lineHeight: 1.6 }}>Admission wali Gmail ID se login karo to access batches, AI tools & more.</p>
        <button
          onClick={() => signInWithPopup(auth, googleProvider).catch((err) => console.log("Popup closed", err))}
          style={{ width: "100%", padding: "16px", borderRadius: 16, background: "#E8EDF5", color: "#0C1F36", border: "none", fontSize: "1rem", fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 12, transition: "transform 0.2s, box-shadow 0.2s" }}
          onMouseEnter={e => { e.currentTarget.style.transform = "translateY(-2px)"; e.currentTarget.style.boxShadow = "0 8px 24px rgba(0,0,0,0.3)"; }}
          onMouseLeave={e => { e.currentTarget.style.transform = "translateY(0)"; e.currentTarget.style.boxShadow = "none"; }}
        >
          <I n="google" cls="fab" c="#EA4335" s={20} /> Continue with Google
        </button>
      </div>
    </div>
  );

  if (studentLoading || !student) return (
    <div style={{ height: "100vh", background: dark ? "#0B1120" : "#F0F4FA", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", fontFamily: "'Inter', sans-serif" }}>
      <I n="spinner" cls="fa-spin" s={40} c={dark ? "#D4A843" : "#1349A8"} />
      <p style={{ color: dark ? "#E8EDF5" : "#0B1826", fontWeight: 600, marginTop: 16 }}>Loading your profile...</p>
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
        <div style={{ flex: 1, overflowY: "auto", paddingBottom: 80 }} className="fade-in">

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
                <div style={{ display: "flex", gap: 24, marginTop: 20 }}>
                  <div><p style={{ margin: 0, fontSize: ".68rem", opacity: 0.7, textTransform: "uppercase", letterSpacing: "1px" }}>Attendance</p><p style={{ margin: 0, fontSize: "1.15rem", fontWeight: 800 }}>{attPct}%</p></div>
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
              <h2 style={{ fontSize: "1.3rem", fontWeight: 800, margin: "0 0 6px" }}>Explore Batches</h2>
              <p style={{ fontSize: ".82rem", color: T.text3, margin: "0 0 20px" }}>Enroll directly from the app.</p>
              <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                {courses.map(c => (
                  <div key={c.id} style={{ background: T.card, borderRadius: 20, overflow: "hidden", border: `1px solid ${T.border}` }}>
                    <div style={{ height: 120, background: c.posterUrl ? `url(${c.posterUrl}) center/cover` : `linear-gradient(135deg, ${T.gradStart}, ${T.gradEnd})`, position: "relative" }}>
                      <div style={{ position: "absolute", bottom: 10, left: 14, background: "rgba(0,0,0,0.65)", color: "#D4A843", padding: "4px 10px", borderRadius: 8, fontSize: ".72rem", backdropFilter: "blur(4px)", fontWeight: 700 }}>{c.duration || "1 Year"}</div>
                    </div>
                    <div style={{ padding: 16 }}>
                      <h3 style={{ margin: "0 0 8px", fontSize: "1.1rem", fontWeight: 800 }}>{c.title}</h3>
                      <p style={{ margin: "0 0 12px", fontSize: ".78rem", color: T.text3, lineHeight: 1.5 }}>{c.desc}</p>
                      <div style={{ display: "flex", overflowX: "auto", gap: 8, marginBottom: 16, paddingBottom: 4 }}>
                        {c.teachers?.map((t, i) => (
                          <div key={i} style={{ display: "flex", alignItems: "center", gap: 6, background: dark ? T.card : "#F0F4FA", padding: "4px 8px", borderRadius: 8, flexShrink: 0 }}>
                            <I n="user-tie" c={T.accent} s={11} />
                            <span style={{ fontSize: ".68rem", fontWeight: 600 }}>{t.name} ({t.exp})</span>
                          </div>
                        ))}
                      </div>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <div><p style={{ margin: 0, fontSize: ".68rem", color: T.text3 }}>Batch Fee</p><p style={{ margin: 0, fontSize: "1.1rem", fontWeight: 800, color: T.success }}>₹{c.price || "Contact Us"}</p></div>
                        <button onClick={() => setShowUpiModal(true)} style={{ background: `linear-gradient(135deg, ${T.accent}, #2563EB)`, color: "#fff", border: "none", padding: "10px 22px", borderRadius: 12, fontWeight: 700, cursor: "pointer", fontSize: ".85rem" }}>Enroll & Pay</button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ═══ 3. MY BATCHES TAB ═══ */}
          {activeTab === "myBatches" && (
            <div style={{ padding: 20 }}>
              {!selectedCourse ? (
                <>
                  <h2 style={{ fontSize: "1.3rem", fontWeight: 800, margin: "0 0 16px" }}>My Batches</h2>
                  {courses.map(c => (
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
            <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
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
                <div style={{ flex: 1, display: "flex", flexDirection: "column", background: T.bg }}>
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
                          <div key={ses.id} onClick={() => loadSession(ses)} style={{
                            padding: "8px 12px", borderRadius: 10,
                            border: `1px solid ${activeSessionId === ses.id ? T.success : T.border}`,
                            background: activeSessionId === ses.id ? (dark ? "#0D2118" : "#ECFDF5") : T.card,
                            marginBottom: 6, cursor: "pointer", fontSize: ".78rem"
                          }}>
                            <div style={{ display: "flex", justifyContent: "space-between" }}>
                              <span style={{ padding: "2px 8px", borderRadius: 6, fontSize: ".65rem", fontWeight: 700, background: dark ? "#0D2118" : "#ECFDF5", color: T.success }}>{ses.subject || "General"}</span>
                              <span style={{ fontSize: ".62rem", color: T.text3 }}>{ses.createdAt?.toDate?.()?.toLocaleDateString?.("en-IN", { day: "numeric", month: "short" }) || ""}</span>
                            </div>
                            <p style={{ margin: "4px 0 0", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontSize: ".76rem", color: T.text2 }}>{ses.messages?.[0]?.text || "..."}</p>
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
                  <div style={{ padding: "10px 16px 14px", background: T.bg }}>
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
                        disabled={dLoading || isTyping}
                        rows={1}
                      />
                      <button onClick={askDoubt} disabled={dLoading || isTyping || (!dInput.trim() && !dImgB64)} style={{
                        width: 36, height: 36, borderRadius: 10, border: "none",
                        background: (dLoading || isTyping || (!dInput.trim() && !dImgB64)) ? T.border : `linear-gradient(135deg, ${T.success}, #10B981)`,
                        color: "#fff", cursor: (dLoading || isTyping || (!dInput.trim() && !dImgB64)) ? "default" : "pointer",
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
                <div style={{ flex: 1, display: "flex", flexDirection: "column", padding: 16 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
                    <div style={{ width: 34, height: 34, borderRadius: 10, background: dark ? "#2D1010" : "#FEF2F2", display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <I n="chart-line" s={16} c={T.danger} />
                    </div>
                    <div>
                      <h3 style={{ fontSize: "1rem", fontWeight: 800, margin: 0 }}>Desmos Graph Calculator</h3>
                      <p style={{ fontSize: ".7rem", color: T.text3, margin: 0 }}>Full-featured graphing tool</p>
                    </div>
                  </div>
                  <div style={{ flex: 1, borderRadius: 16, overflow: "hidden", border: `2px solid ${T.border}`, minHeight: 400, background: "#fff" }}>
                    <iframe
                      src="https://www.desmos.com/calculator"
                      style={{ width: "100%", height: "100%", border: "none", minHeight: 500 }}
                      title="Desmos Graphing Calculator"
                      allow="clipboard-write"
                    />
                  </div>
                  <p style={{ fontSize: ".7rem", color: T.text3, textAlign: "center", marginTop: 8 }}>
                    Powered by Desmos — Type equations, plot graphs, explore math!
                  </p>
                </div>
              )}

              {/* ══ 4d. PERSONALIZED PROMPT ══ */}
              {aiSubTab === "prompt" && (
                <div style={{ padding: 16 }}>
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
                      onClick={() => navigator.clipboard.writeText(`Act as an expert Indian private tutor. Student Profile: Name: ${student?.studentName}, Class: ${student?.class || student?.presentClass}, Board: ${student?.board || "CG Board"}, Avg Test Score: ${avgQuiz}%, Weak Areas: ${weakSubjects.join(", ")}. Language: ${langLabel}. Now teach me: `)}
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
            <div style={{ padding: 20 }}>
              <h2 style={{ fontSize: "1.3rem", fontWeight: 800, margin: "0 0 6px" }}>Online Tests</h2>
              <p style={{ fontSize: ".82rem", color: T.text3, margin: "0 0 20px" }}>Give live MCQ tests from home.</p>
              {tests.length === 0 ? (
                <div style={{ textAlign: "center", padding: 40, color: T.text3 }}>
                  <I n="clipboard-list" s={40} style={{ marginBottom: 12, opacity: 0.4 }} />
                  <p>No active tests right now.</p>
                </div>
              ) : (
                tests.map(t => (
                  <div key={t.id} style={{ background: T.card, borderRadius: 18, border: `1px solid ${T.border}`, padding: 18, marginBottom: 14, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div>
                      <h3 style={{ margin: "0 0 4px", fontSize: "1.05rem", fontWeight: 800 }}>{t.title}</h3>
                      <p style={{ margin: 0, fontSize: ".78rem", color: T.text3 }}>{t.subject} • {t.duration || 60} mins</p>
                    </div>
                    <button style={{ background: `linear-gradient(135deg, ${T.orange}, #F59E0B)`, color: "#fff", border: "none", padding: "10px 22px", borderRadius: 12, fontWeight: 700, cursor: "pointer" }}>Start</button>
                  </div>
                ))
              )}
            </div>
          )}

        </div>

        {/* ═══ FLOATING BOTTOM NAVIGATION ═══ */}
        <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, background: dark ? "#0B1120" : "#FFFFFF", borderTop: `1px solid ${T.border}`, display: "flex", justifyContent: "space-around", padding: "10px 8px 18px", zIndex: 100, boxShadow: `0 -2px 20px rgba(0,0,0,${dark ? 0.3 : 0.06})` }}>
          {[
            { id: "dashboard", i: "chart-simple", l: "Home" },
            { id: "myBatches", i: "chalkboard-user", l: "Batches" },
            { id: "explore", i: "compass", l: "Explore" },
            { id: "library", i: "book", l: "Books" },
            { id: "ai", i: "robot", l: "AI Portal" }
          ].map(tab => {
            const isActive = activeTab === tab.id;
            return (
              <button key={tab.id} onClick={() => setActiveTab(tab.id)} style={{ background: "none", border: "none", display: "flex", flexDirection: "column", alignItems: "center", gap: 3, color: isActive ? T.accent : T.text3, cursor: "pointer", flex: 1, transition: "color 0.2s" }}>
                <div style={{
                  width: 34, height: 34, borderRadius: 10,
                  background: isActive ? (dark ? `${T.accent}20` : "#EFF6FF") : "transparent",
                  display: "flex", alignItems: "center", justifyContent: "center", transition: "all 0.2s",
                  boxShadow: isActive ? `0 2px 8px ${T.accent}30` : "none"
                }}>
                  <I n={tab.i} s={16} />
                </div>
                <span style={{ fontSize: ".62rem", fontWeight: isActive ? 800 : 600, letterSpacing: "0.3px" }}>{tab.l}</span>
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
