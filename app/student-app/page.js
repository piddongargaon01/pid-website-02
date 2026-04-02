"use client";
import { useState, useEffect, useRef } from "react";
import { db, auth, googleProvider } from "../firebase";
import { collection, query, where, onSnapshot, addDoc, updateDoc, doc, serverTimestamp } from "firebase/firestore";
import { signInWithPopup, onAuthStateChanged, signOut } from "firebase/auth";
import { GoogleGenerativeAI } from "@google/generative-ai";

// ═══ HELPER COMPONENTS ═══
const I = ({ n, s = 16, c = "currentColor", cls = "" }) => <i className={`fas fa-${n} ${cls}`} style={{ fontSize: s, color: c }} />;

const Ring = ({ val, sz = 72, sw = 6, c = "#6366F1", bg = "rgba(0,0,0,0.05)" }) => {
  const r = (sz - sw) / 2, ci = 2 * Math.PI * r, off = ci - (val / 100) * ci;
  return (
    <svg width={sz} height={sz} style={{ transform: "rotate(-90deg)" }}>
      <circle cx={sz/2} cy={sz/2} r={r} fill="none" stroke={bg} strokeWidth={sw} />
      <circle cx={sz/2} cy={sz/2} r={r} fill="none" stroke={c} strokeWidth={sw} strokeDasharray={ci} strokeDashoffset={off} strokeLinecap="round" style={{ transition: "stroke-dashoffset 1s ease-out" }}/>
    </svg>
  );
};

// ═══════════════════════════════════════════
// MAIN APP COMPONENT
// ═══════════════════════════════════════════
export default function StudentApp() {
  // Auth & User State
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [student, setStudent] = useState(null);
  const [studentLoading, setStudentLoading] = useState(false);
  
  // App Navigation
  const [activeTab, setActiveTab] = useState("dashboard"); 
  const [aiSubTab, setAiSubTab] = useState("doubt"); 
  const [dark, setDark] = useState(false);

  // Global Data
  const [courses, setCourses] = useState([]);
  const [materials, setMaterials] = useState([]);
  const [attendance, setAttendance] = useState([]);
  const [quizHistory, setQuizHistory] = useState([]);
  const [tests, setTests] = useState([]);
  
  // Explore & My Batches State
  const [selectedCourse, setSelectedCourse] = useState(null);
  const [selectedSubject, setSelectedSubject] = useState(null);
  const [showUpiModal, setShowUpiModal] = useState(false);

  // AI Doubt Solver State
  const [dInput, setDInput] = useState("");
  const [dChat, setDChat] = useState([]);
  const [dLoading, setDLoading] = useState(false);
  const [dImgPreview, setDImgPreview] = useState("");
  const [dImgB64, setDImgB64] = useState(null);
  const [isTyping, setIsTyping] = useState(false);
  const [thinkingText, setThinkingText] = useState("");
  const [showAttach, setShowAttach] = useState(false);
  const chatEndRef = useRef(null);
  const typingRef = useRef(null);
  const fileInputRef = useRef(null);

  // AI Quiz State
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

  // Graph State
  const [equations, setEquations] = useState([{ expr: "sin(x)", color: "#10B981" }]);
  const canvasRef = useRef(null);
  const [graphZoom, setGraphZoom] = useState(40);

  // ═══ FIREBASE SETUP & LISTENER ═══
  useEffect(() => { 
    const u = onAuthStateChanged(auth, u => { setUser(u); setLoading(false); }); 
    return () => u(); 
  }, []);

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

  // Fetch Global Data (INDEX ERROR FIXED HERE)
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
        // Attendance - JS Filtering applied to prevent Index Error
        const monthStart = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, "0")}-01`;
        unsubs.push(onSnapshot(query(collection(db, "attendance"), where("studentId", "==", student.id)), s => {
            const allAtt = s.docs.map(d => ({ id: d.id, ...d.data() }));
            setAttendance(allAtt.filter(a => a.date >= monthStart)); 
        }));
        
        unsubs.push(onSnapshot(query(collection(db, "quiz_history"), where("studentId", "==", student.id)), s => setQuizHistory(s.docs.map(d => ({ id: d.id, ...d.data() })))));
    }
    return () => unsubs.forEach(u => u());
  }, [student]);

  // ═══ CALCULATED STATS ═══
  const attPct = attendance.length > 0 ? Math.round((attendance.filter(a => a.type === "in").length / (attendance.length/2 || 1)) * 100) : 0;
  const avgQuiz = quizHistory.length > 0 ? Math.round(quizHistory.reduce((s, q) => s + (q.percentage || 0), 0) / quizHistory.length) : 0;
  const weakSubjects = [...new Set(quizHistory.filter(q => q.percentage < 60).map(q => q.subject))];
  const subjects = [...new Set(materials.map(m => m.subject).filter(Boolean))];

  // ═══ THEME ENGINE ═══
  const T = dark ? {
    bg: "#0F172A", card: "#1E293B", text: "#F8FAFC", text2: "#CBD5E1", text3: "#94A3B8",
    border: "#334155", accent: "#6366F1", userChat: "#6366F1", aiChat: "#1E293B", inputBg: "#334155"
  } : {
    bg: "#F4F7FE", card: "#FFFFFF", text: "#0F172A", text2: "#334155", text3: "#64748B",
    border: "#E2E8F0", accent: "#4F46E5", userChat: "#EEF2FF", aiChat: "#F8FAFC", inputBg: "#FFFFFF"
  };

  // ═══ RENDER MARKDOWN ═══
  function renderMd(text) {
    if (!text) return "";
    let h = text
      .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
      .replace(/\*(.*?)\*/g, "<em>$1</em>")
      .replace(/`([^`]+)`/g, '<code style="background:var(--bg3);padding:2px 6px;border-radius:6px;font-size:.85rem;color:#ec4899">$1</code>')
      .replace(/\n/g, "<br/>");
    return <span dangerouslySetInnerHTML={{ __html: h }} />;
  }

  function getGemini() { 
    const k = process.env.NEXT_PUBLIC_GEMINI_API_KEY; 
    if(!k) throw new Error("API Key Missing");
    return new GoogleGenerativeAI(k).getGenerativeModel({ model: "gemini-2.5-flash" }); 
  }

  // ═══ AI DOUBT SOLVER ═══
  function handleImageUpload(e) {
    const file = e.target.files?.[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => { setDImgPreview(ev.target.result); setDImgB64(ev.target.result.split(",")[1]); setShowAttach(false); };
    reader.readAsDataURL(file);
    e.target.value = "";
  }

  async function askDoubt() {
    if (!dInput.trim() && !dImgB64) return;
    const msgText = dInput.trim(); const imgPrev = dImgPreview; const imgData = dImgB64;
    setDInput(""); setDImgPreview(""); setDImgB64(null);
    setDChat(p => [...p, { role: "user", text: msgText, image: imgPrev }]);
    setDLoading(true); setThinkingText("Analyzing question...");

    setTimeout(() => setThinkingText("Generating personalized solution..."), 2000);

    try {
      const contextPrompt = `You are a personalized AI Tutor for ${student?.studentName || 'Student'}. 
      Student Context: Attendance is ${attPct}%, Average Quiz Score is ${avgQuiz}%. 
      Weak Subjects: ${weakSubjects.join(", ") || "None specific"}.
      Rule 1: Always explain step-by-step.
      Rule 2: If the topic relates to a weak subject, break it down extremely simply.
      Rule 3: Use formatting (bolding, bullet points). Do not output raw JSON or code blocks unless requested.
      Question: ${msgText || "Solve the attached image."}`;

      let result;
      if (imgData) {
        result = await getGemini().generateContent([{ text: contextPrompt }, { inlineData: { mimeType: "image/jpeg", data: imgData } }]);
      } else {
        result = await getGemini().generateContent(contextPrompt);
      }
      
      const answer = result.response.text();
      setDLoading(false);
      setDChat(p => [...p, { role: "ai", text: "" }]); 
      setIsTyping(true);

      const words = answer.split(/(\s+)/);
      let wi = 0;
      typingRef.current = setInterval(() => {
        wi += 4; 
        if (wi >= words.length) {
          clearInterval(typingRef.current); setIsTyping(false);
          setDChat(p => { const u = [...p]; u[u.length-1].text = answer; return u; });
        } else {
          setDChat(p => { const u = [...p]; u[u.length-1].text = words.slice(0, wi).join(""); return u; });
        }
      }, 30);
    } catch (e) {
      setDLoading(false); setDChat(p => [...p, { role: "ai", text: "Oops! Network error or API Key issue. Try again." }]);
    }
  }

  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [dChat, isTyping, dLoading]);

  // ═══ AI QUIZ LOGIC ═══
  async function genQuiz() {
    if (!quizSubject) { setQuizErr("Please select a subject!"); return; }
    setQuizErr(""); setQuizState("loading"); setQuizQs([]); setQuizAns({}); setQuizIdx(0); setQuizExpl(false); setQuizScore(0);
    try {
      const r = await getGemini().generateContent(`Expert Indian education quiz. Generate ${quizCount} MCQs: Subject: ${quizSubject}, Chapter: ${quizChapter || "Any"}, Difficulty: ${quizDifficulty}. Respond ONLY JSON array: [{"question":"text","options":["A","B","C","D"],"correct":0,"explanation":"text"}]`);
      let t = r.response.text().replace(/```json\s*/gi, "").replace(/```\s*/gi, "").trim();
      const si = t.indexOf("["), ei = t.lastIndexOf("]"); if (si !== -1 && ei !== -1) t = t.substring(si, ei + 1);
      const v = JSON.parse(t).filter(q => q.question && q.options?.length === 4 && typeof q.correct === "number");
      if (!v.length) throw new Error("No valid questions");
      setQuizQs(v); setQuizState("active");
    } catch (e) { setQuizErr("Failed to generate. Try again."); setQuizState("setup"); }
  }
  function selAns(qi, oi) { if (quizAns[qi] !== undefined) return; setQuizAns(p => ({ ...p, [qi]: oi })); setQuizExpl(true); }
  function nextQ() { setQuizExpl(false); if (quizIdx < quizQs.length - 1) setQuizIdx(quizIdx + 1); else { let s = 0; quizQs.forEach((q, i) => { if (quizAns[i] === q.correct) s++; }); setQuizScore(s); setQuizState("results"); } }
  function resetQuiz() { setQuizState("setup"); setQuizQs([]); setQuizAns({}); setQuizIdx(0); setQuizExpl(false); setQuizScore(0); setQuizErr(""); }

  // ═══ MATH GRAPH LOGIC ═══
  useEffect(() => {
    if (activeTab === "ai" && aiSubTab === "graph" && canvasRef.current) {
      const ctx = canvasRef.current.getContext("2d");
      const W = canvasRef.current.width; const H = canvasRef.current.height;
      ctx.clearRect(0, 0, W, H);
      ctx.fillStyle = dark ? "#1E293B" : "#F8FAFC"; ctx.fillRect(0, 0, W, H);
      
      ctx.strokeStyle = dark ? "#475569" : "#CBD5E1"; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(0, H/2); ctx.lineTo(W, H/2); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(W/2, 0); ctx.lineTo(W/2, H); ctx.stroke();

      equations.forEach(eq => {
        if(!eq.expr) return;
        ctx.strokeStyle = eq.color; ctx.lineWidth = 2; ctx.beginPath();
        let started = false;
        for (let px = 0; px < W; px++) {
          const x = (px - W/2) / graphZoom;
          try {
            let cleanExpr = eq.expr.replace(/sin/g, 'Math.sin').replace(/cos/g, 'Math.cos').replace(/tan/g, 'Math.tan').replace(/x/g, `(${x})`);
            const y = new Function('return ' + cleanExpr)();
            if(isNaN(y) || !isFinite(y)) continue;
            const py = H/2 - y * graphZoom;
            if(!started) { ctx.moveTo(px, py); started = true; } else { ctx.lineTo(px, py); }
          } catch(e) {}
        }
        ctx.stroke();
      });
    }
  }, [equations, graphZoom, activeTab, aiSubTab, dark]);

  // ═══ PRE-LOGIN UI ═══
  if (loading) return (
    <div style={{height:"100vh", background:"#4F46E5", display:"flex", alignItems:"center", justifyContent:"center", color:"#fff", fontSize:"2rem"}}>
      <I n="spinner" cls="fa-spin"/>
    </div>
  );

  // AUTH POPUP ERROR FIXED HERE (.catch added)
  if (!user) return (
    <div style={{ background: "#0F172A", minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'Inter', sans-serif" }}>
      <div style={{ background: "#1E293B", padding: "40px 30px", borderRadius: 24, maxWidth: 400, width: "90%", textAlign: "center", border: "1px solid #334155", boxShadow: "0 20px 40px rgba(0,0,0,0.5)" }}>
        <img src="/pid_logo.png" alt="PID" style={{ width: 70, height: 70, borderRadius: 16, marginBottom: 20 }} onError={e=>e.target.style.display='none'}/>
        <h1 style={{ color: "#F8FAFC", fontSize: "1.6rem", fontWeight: 800, margin: "0 0 10px" }}>Student Portal</h1>
        <p style={{ color: "#94A3B8", fontSize: ".9rem", marginBottom: 30, lineHeight: 1.5 }}>Login with your registered admission Gmail ID to access your batches & AI tools.</p>
        
        <button 
          onClick={() => signInWithPopup(auth, googleProvider).catch((err) => console.log("User closed the popup", err))} 
          style={{ width: "100%", padding: "14px", borderRadius: 16, background: "#F8FAFC", color: "#0F172A", border: "none", fontSize: "1rem", fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 10 }}>
          <I n="google" cls="fab" c="#EA4335" s={18}/> Continue with Google
        </button>
      </div>
    </div>
  );

  // NULL ERROR FIXED HERE (Waiting for student data before rendering main UI)
  if (studentLoading || !student) return (
    <div style={{height:"100vh", background: dark ? "#0F172A" : "#F4F7FE", display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", color:"#4F46E5", fontFamily:"'Inter', sans-serif"}}>
      <I n="spinner" cls="fa-spin" s={40} style={{marginBottom: 16}}/>
      <p style={{color: dark ? "#F8FAFC" : "#0F172A", fontWeight: 600}}>Loading your profile...</p>
    </div>
  );

  // ═══ APP WRAPPER ═══
  return (
    <div style={{ background: dark ? "#000" : "#E2E8F0", minHeight: "100vh", display: "flex", justifyContent: "center", fontFamily: "'Inter', 'DM Sans', sans-serif" }}>
      <style>{`
        * { box-sizing: border-box; -webkit-tap-highlight-color: transparent; }
        ::-webkit-scrollbar { display: none; }
        .fade-in { animation: fadeIn 0.3s ease; }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(5px); } to { opacity: 1; transform: translateY(0); } }
      `}</style>
      
      {/* Mobile Frame Constraint */}
      <div style={{ width: "100%", maxWidth: 450, height: "100vh", background: T.bg, color: T.text, display: "flex", flexDirection: "column", position: "relative", overflow: "hidden", boxShadow: "0 0 50px rgba(0,0,0,0.2)" }}>
        
        {/* ═══ TOP HEADER ═══ */}
        <div style={{ padding: "20px 20px 10px", display: "flex", justifyContent: "space-between", alignItems: "center", background: T.bg, zIndex: 10 }}>
          <div>
            <h2 style={{ margin: 0, fontSize: "1.2rem", fontWeight: 800 }}>
              {student.isEnrolled ? `Hi, ${student.studentName.split(" ")[0]} 👋` : "Welcome, Guest"}
            </h2>
            <p style={{ margin: 0, fontSize: ".8rem", color: T.text3 }}>{student.isEnrolled ? `Class ${student.class} Student` : "Explore our batches"}</p>
          </div>
          <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
            <button onClick={() => setDark(!dark)} style={{ background: "none", border: "none", color: T.text3, cursor: "pointer", fontSize: "1.2rem" }}><I n={dark ? "sun" : "moon"} /></button>
            <div onClick={() => signOut(auth)} style={{ width: 36, height: 36, borderRadius: "50%", background: T.accent, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, cursor: "pointer", fontSize: "1rem" }}>
              {student.studentName.charAt(0).toUpperCase()}
            </div>
          </div>
        </div>

        {/* ═══ MAIN CONTENT AREA ═══ */}
        <div style={{ flex: 1, overflowY: "auto", paddingBottom: 80 }} className="fade-in">
          
          {/* 1. DASHBOARD TAB */}
          {activeTab === "dashboard" && student.isEnrolled && (
            <div style={{ padding: 20 }}>
              <div style={{ background: `linear-gradient(135deg, ${T.accent}, #8B5CF6)`, borderRadius: 24, padding: 24, color: "#fff", marginBottom: 20, position: "relative", overflow: "hidden" }}>
                <I n="chart-simple" s={100} c="rgba(255,255,255,0.1)" style={{ position: "absolute", right: -20, bottom: -20 }}/>
                <p style={{ margin: "0 0 4px", fontSize: ".85rem", opacity: 0.9 }}>Overall Performance</p>
                <div style={{ display: "flex", alignItems: "flex-end", gap: 10 }}>
                  <h1 style={{ margin: 0, fontSize: "2.5rem", fontWeight: 900 }}>{avgQuiz}%</h1>
                  <span style={{ padding: "4px 8px", background: "rgba(255,255,255,0.2)", borderRadius: 8, fontSize: ".75rem", fontWeight: 700, marginBottom: 6 }}>Rank: #12</span>
                </div>
                <div style={{ display: "flex", gap: 20, marginTop: 20 }}>
                  <div><p style={{ margin: 0, fontSize: ".7rem", opacity: 0.8 }}>Attendance</p><p style={{ margin: 0, fontSize: "1.1rem", fontWeight: 800 }}>{attPct}%</p></div>
                  <div><p style={{ margin: 0, fontSize: ".7rem", opacity: 0.8 }}>Tests Taken</p><p style={{ margin: 0, fontSize: "1.1rem", fontWeight: 800 }}>{quizHistory.length}</p></div>
                </div>
              </div>

              <h3 style={{ fontSize: "1.1rem", fontWeight: 800, margin: "0 0 12px" }}>Quick Access</h3>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div onClick={() => setActiveTab("myBatches")} style={{ background: T.card, padding: 16, borderRadius: 20, border: `1px solid ${T.border}`, cursor: "pointer" }}>
                  <div style={{ width: 40, height: 40, borderRadius: 12, background: "rgba(99, 102, 241, 0.1)", color: "#6366F1", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 12 }}><I n="chalkboard-user" s={18}/></div>
                  <h4 style={{ margin: 0, fontSize: ".9rem", fontWeight: 700 }}>My Batches</h4>
                  <p style={{ margin: "4px 0 0", fontSize: ".75rem", color: T.text3 }}>Lectures & DPPs</p>
                </div>
                <div onClick={() => setActiveTab("ai")} style={{ background: T.card, padding: 16, borderRadius: 20, border: `1px solid ${T.border}`, cursor: "pointer" }}>
                  <div style={{ width: 40, height: 40, borderRadius: 12, background: "rgba(16, 185, 129, 0.1)", color: "#10B981", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 12 }}><I n="robot" s={18}/></div>
                  <h4 style={{ margin: 0, fontSize: ".9rem", fontWeight: 700 }}>AI Tutor</h4>
                  <p style={{ margin: "4px 0 0", fontSize: ".75rem", color: T.text3 }}>24/7 Doubt Solver</p>
                </div>
                <div onClick={() => setActiveTab("tests")} style={{ background: T.card, padding: 16, borderRadius: 20, border: `1px solid ${T.border}`, cursor: "pointer" }}>
                  <div style={{ width: 40, height: 40, borderRadius: 12, background: "rgba(245, 158, 11, 0.1)", color: "#F59E0B", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 12 }}><I n="laptop-code" s={18}/></div>
                  <h4 style={{ margin: 0, fontSize: ".9rem", fontWeight: 700 }}>Online Tests</h4>
                  <p style={{ margin: "4px 0 0", fontSize: ".75rem", color: T.text3 }}>Live MCQ Tests</p>
                </div>
                <div onClick={() => setActiveTab("library")} style={{ background: T.card, padding: 16, borderRadius: 20, border: `1px solid ${T.border}`, cursor: "pointer" }}>
                  <div style={{ width: 40, height: 40, borderRadius: 12, background: "rgba(236, 72, 153, 0.1)", color: "#EC4899", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 12 }}><I n="book" s={18}/></div>
                  <h4 style={{ margin: 0, fontSize: ".9rem", fontWeight: 700 }}>E-Books</h4>
                  <p style={{ margin: "4px 0 0", fontSize: ".75rem", color: T.text3 }}>Free NCERTs</p>
                </div>
              </div>
            </div>
          )}

          {/* 2. EXPLORE BATCHES TAB */}
          {activeTab === "explore" && (
            <div style={{ padding: 20 }}>
              <h2 style={{ fontSize: "1.4rem", fontWeight: 800, margin: "0 0 6px" }}>Explore Batches</h2>
              <p style={{ fontSize: ".85rem", color: T.text3, margin: "0 0 20px" }}>Enroll directly from the app.</p>
              
              <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                {courses.map(c => (
                  <div key={c.id} style={{ background: T.card, borderRadius: 20, overflow: "hidden", border: `1px solid ${T.border}` }}>
                    <div style={{ height: 120, background: c.posterUrl ? `url(${c.posterUrl}) center/cover` : "linear-gradient(135deg, #1E293B, #0F172A)", position: "relative" }}>
                      <div style={{ position: "absolute", bottom: 10, left: 14, background: "rgba(0,0,0,0.6)", color: "#fff", padding: "4px 10px", borderRadius: 8, fontSize: ".75rem", backdropFilter: "blur(4px)" }}>{c.duration || "1 Year"}</div>
                    </div>
                    <div style={{ padding: 16 }}>
                      <h3 style={{ margin: "0 0 8px", fontSize: "1.1rem", fontWeight: 800 }}>{c.title}</h3>
                      <p style={{ margin: "0 0 12px", fontSize: ".8rem", color: T.text3, lineHeight: 1.4 }}>{c.desc}</p>
                      
                      <div style={{ display: "flex", overflowX: "auto", gap: 8, marginBottom: 16, paddingBottom: 4 }}>
                        {c.teachers?.map((t, i) => (
                          <div key={i} style={{ display: "flex", alignItems: "center", gap: 6, background: T.bg, padding: "4px 8px", borderRadius: 8, flexShrink: 0 }}>
                            <I n="user-tie" c={T.accent} s={12}/>
                            <span style={{ fontSize: ".7rem", fontWeight: 600 }}>{t.name} ({t.exp})</span>
                          </div>
                        ))}
                      </div>
                      
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <div><p style={{ margin: 0, fontSize: ".7rem", color: T.text3 }}>Batch Fee</p><p style={{ margin: 0, fontSize: "1.1rem", fontWeight: 800, color: "#10B981" }}>₹{c.price || "Contact Us"}</p></div>
                        <button onClick={() => setShowUpiModal(true)} style={{ background: T.accent, color: "#fff", border: "none", padding: "10px 20px", borderRadius: 12, fontWeight: 700, cursor: "pointer" }}>Enroll & Pay</button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 3. MY BATCHES TAB */}
          {activeTab === "myBatches" && (
            <div style={{ padding: 20 }}>
              {!selectedCourse ? (
                <>
                  <h2 style={{ fontSize: "1.4rem", fontWeight: 800, margin: "0 0 16px" }}>My Batches</h2>
                  {courses.map(c => (
                    <div key={c.id} onClick={() => setSelectedCourse(c)} style={{ background: T.card, borderRadius: 20, overflow: "hidden", border: `1px solid ${T.border}`, cursor: "pointer", marginBottom: 16 }}>
                      <div style={{ height: 100, background: "linear-gradient(135deg, #10B981, #059669)", display: "flex", alignItems: "center", padding: 20 }}>
                        <h3 style={{ color: "#fff", margin: 0, fontSize: "1.2rem", fontWeight: 800 }}>{c.title}</h3>
                      </div>
                      <div style={{ padding: 16, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <span style={{ fontSize: ".85rem", color: T.text2, fontWeight: 600 }}>Includes: {c.subjects?.join(", ") || "All Subjects"}</span>
                        <I n="arrow-right" c={T.accent}/>
                      </div>
                    </div>
                  ))}
                </>
              ) : !selectedSubject ? (
                <>
                  <button onClick={() => setSelectedCourse(null)} style={{ background: "none", border: "none", color: T.text3, marginBottom: 16, display: "flex", alignItems: "center", gap: 6, fontWeight: 600, cursor: "pointer" }}><I n="arrow-left"/> Back</button>
                  <h2 style={{ fontSize: "1.4rem", fontWeight: 800, margin: "0 0 16px" }}>Subjects</h2>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                    {(selectedCourse.subjects || ["Physics", "Chemistry", "Maths"]).map(sub => (
                      <div key={sub} onClick={() => setSelectedSubject(sub)} style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 16, padding: 20, textAlign: "center", cursor: "pointer" }}>
                        <I n="book" s={24} c={T.accent} style={{ marginBottom: 10 }}/>
                        <h4 style={{ margin: 0, fontWeight: 700, fontSize: ".95rem" }}>{sub}</h4>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <>
                  <button onClick={() => setSelectedSubject(null)} style={{ background: "none", border: "none", color: T.text3, marginBottom: 16, display: "flex", alignItems: "center", gap: 6, fontWeight: 600, cursor: "pointer" }}><I n="arrow-left"/> Back</button>
                  <h2 style={{ fontSize: "1.4rem", fontWeight: 800, margin: "0 0 16px" }}>{selectedSubject} Materials</h2>
                  {materials.filter(m => m.subject === selectedSubject).map(m => (
                    <div key={m.id} style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 16, padding: 16, marginBottom: 12, display: "flex", alignItems: "center", gap: 12 }}>
                      <div style={{ width: 40, height: 40, borderRadius: 10, background: T.bg, display: "flex", alignItems: "center", justifyContent: "center" }}><I n={m.materialType==="video"?"play":"file-pdf"} c={T.accent}/></div>
                      <div style={{ flex: 1 }}>
                        <h4 style={{ margin: 0, fontSize: ".9rem", fontWeight: 700 }}>{m.title}</h4>
                        <p style={{ margin: "2px 0 0", fontSize: ".7rem", color: T.text3 }}>{m.chapter} • {m.materialType.toUpperCase()}</p>
                      </div>
                      <a href={m.fileUrl || m.videoUrl} target="_blank" rel="noopener noreferrer" style={{ background: T.accent, color: "#fff", padding: "6px 12px", borderRadius: 8, fontSize: ".75rem", fontWeight: 700, textDecoration: "none" }}>View</a>
                    </div>
                  ))}
                  {materials.filter(m => m.subject === selectedSubject).length === 0 && <p style={{ fontSize: ".85rem", color: T.text3, textAlign: "center", marginTop: 40 }}>No materials uploaded yet.</p>}
                </>
              )}
            </div>
          )}

          {/* 4. AI PORTAL TAB */}
          {activeTab === "ai" && (
            <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
              <div style={{ display: "flex", overflowX: "auto", gap: 8, padding: "20px 20px 10px", background: T.bg }}>
                {[
                  { id: "doubt", l: "Doubt Solver", i: "robot" },
                  { id: "quiz", l: "AI Quiz", i: "brain" },
                  { id: "prompt", l: "My AI Prompt", i: "wand-magic-sparkles" },
                  { id: "graph", l: "Math Graph", i: "chart-line" }
                ].map(t => (
                  <button key={t.id} onClick={() => setAiSubTab(t.id)} style={{ padding: "8px 16px", borderRadius: 20, border: `1px solid ${aiSubTab === t.id ? T.accent : T.border}`, background: aiSubTab === t.id ? T.accent : T.card, color: aiSubTab === t.id ? "#fff" : T.text, fontSize: ".8rem", fontWeight: 700, display: "flex", alignItems: "center", gap: 6, whiteSpace: "nowrap", cursor: "pointer" }}>
                    <I n={t.i}/> {t.l}
                  </button>
                ))}
              </div>

              {/* 4a. DOUBT SOLVER */}
              {aiSubTab === "doubt" && (
                <div style={{ flex: 1, display: "flex", flexDirection: "column", background: T.bg }}>
                  <div style={{ flex: 1, overflowY: "auto", padding: 20 }}>
                    {dChat.length === 0 && (
                      <div style={{ textAlign: "center", padding: "40px 20px", opacity: 0.7 }}>
                        <div style={{ width: 60, height: 60, borderRadius: "50%", background: T.card, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px", border: `1px solid ${T.border}` }}><I n="bolt" s={24} c={T.accent}/></div>
                        <h2 style={{ fontSize: "1.2rem", fontWeight: 800, margin: "0 0 8px" }}>How can I help you?</h2>
                        <p style={{ fontSize: ".85rem", margin: 0 }}>Upload a photo or type a question. I know your weak subjects and will adapt to you.</p>
                      </div>
                    )}
                    
                    {dChat.map((msg, i) => (
                      <div key={i} style={{ display: "flex", gap: 12, marginBottom: 24, flexDirection: msg.role === "user" ? "row-reverse" : "row" }}>
                        <div style={{ width: 32, height: 32, borderRadius: 10, background: msg.role === "user" ? T.accent : T.card, color: msg.role === "user" ? "#fff" : T.text, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, border: msg.role === "ai" ? `1px solid ${T.border}` : "none" }}>
                          <I n={msg.role === "user" ? "user" : "robot"} s={14}/>
                        </div>
                        <div style={{ maxWidth: "80%" }}>
                          {msg.image && <img src={msg.image} style={{ width: "100%", borderRadius: 12, marginBottom: 8, border: `1px solid ${T.border}` }} alt="uploaded" />}
                          <div style={{ padding: "12px 16px", borderRadius: 16, background: msg.role === "user" ? T.userChat : T.aiChat, color: msg.role === "user" ? (dark ? "#fff" : "#1E293B") : T.text, fontSize: ".9rem", lineHeight: 1.6, border: msg.role === "ai" ? `1px solid ${T.border}` : "none" }}>
                            {renderMd(msg.text)}
                            {isTyping && i === dChat.length - 1 && <span style={{ display: "inline-block", width: 8, height: 16, background: T.accent, marginLeft: 4, animation: "pulse 1s infinite" }}/>}
                          </div>
                        </div>
                      </div>
                    ))}
                    
                    {dLoading && (
                      <div style={{ display: "flex", gap: 12, marginBottom: 24 }}>
                        <div style={{ width: 32, height: 32, borderRadius: 10, background: T.card, border: `1px solid ${T.border}`, display: "flex", alignItems: "center", justifyContent: "center" }}><I n="robot" s={14}/></div>
                        <div style={{ padding: "12px 16px", borderRadius: 16, background: T.aiChat, border: `1px solid ${T.border}`, fontSize: ".85rem", color: T.text3, display: "flex", alignItems: "center", gap: 8 }}>
                          <I n="circle-notch" cls="fa-spin"/> {thinkingText}
                        </div>
                      </div>
                    )}
                    <div ref={chatEndRef} />
                  </div>

                  <div style={{ padding: "12px 20px", background: T.bg, position: "relative" }}>
                    {dImgPreview && (
                      <div style={{ position: "absolute", top: -60, left: 20, background: T.card, padding: 6, borderRadius: 12, border: `1px solid ${T.border}`, display: "flex", alignItems: "center", gap: 10, boxShadow: "0 4px 12px rgba(0,0,0,0.1)" }}>
                        <img src={dImgPreview} style={{ width: 40, height: 40, borderRadius: 8, objectFit: "cover" }} alt=""/>
                        <button onClick={() => {setDImgPreview(""); setDImgB64(null);}} style={{ background: "none", border: "none", color: "#EF4444", cursor: "pointer" }}><I n="times"/></button>
                      </div>
                    )}
                    
                    <div style={{ background: T.inputBg, border: `1px solid ${T.border}`, borderRadius: 24, padding: "8px 12px", display: "flex", alignItems: "center", gap: 8 }}>
                      <div style={{ position: "relative" }}>
                        <button onClick={() => setShowAttach(!showAttach)} style={{ width: 36, height: 36, borderRadius: "50%", background: "none", border: "none", color: T.text3, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}><I n="plus" s={18}/></button>
                        {showAttach && (
                          <div style={{ position: "absolute", bottom: 45, left: 0, background: T.card, border: `1px solid ${T.border}`, borderRadius: 16, padding: 8, display: "flex", flexDirection: "column", gap: 4, boxShadow: "0 4px 20px rgba(0,0,0,0.15)", zIndex: 10 }}>
                            <button onClick={() => fileInputRef.current?.click()} style={{ padding: "10px 16px", background: "none", border: "none", color: T.text, display: "flex", alignItems: "center", gap: 10, textAlign: "left", borderRadius: 8, cursor: "pointer", whiteSpace: "nowrap" }}><I n="image" c={T.accent}/> Upload Photo</button>
                          </div>
                        )}
                      </div>
                      <input type="file" ref={fileInputRef} onChange={handleImageUpload} accept="image/*" style={{ display: "none" }} />
                      <input value={dInput} onChange={e => setDInput(e.target.value)} onKeyDown={e => { if(e.key === "Enter") askDoubt(); }} placeholder="Message AI Tutor..." style={{ flex: 1, border: "none", background: "none", outline: "none", color: T.text, fontSize: ".95rem", padding: "8px 0" }} />
                      <button onClick={askDoubt} disabled={dLoading || isTyping || (!dInput && !dImgB64)} style={{ width: 36, height: 36, borderRadius: "50%", background: (!dInput && !dImgB64) ? T.border : T.accent, border: "none", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", transition: "background 0.2s" }}><I n="arrow-up"/></button>
                    </div>
                  </div>
                </div>
              )}

              {/* 4b. AI QUIZ */}
              {aiSubTab === "quiz" && (
                <div style={{ padding: 20 }}>
                  {quizState === "setup" && (
                    <div style={{ background: T.card, borderRadius: 24, padding: 24, border: `1px solid ${T.border}` }}>
                      <h3 style={{ margin: "0 0 20px", fontSize: "1.1rem", fontWeight: 800 }}>Create an AI Challenge</h3>
                      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                        <div>
                          <label style={{ fontSize: ".75rem", fontWeight: 700, color: T.text3, textTransform: "uppercase", marginBottom: 6, display: "block" }}>Subject</label>
                          <select value={quizSubject} onChange={e => setQuizSubject(e.target.value)} style={{ width: "100%", padding: "12px 16px", borderRadius: 14, border: `1px solid ${T.border}`, background: T.bg3, color: T.text, fontSize: ".9rem", outline: "none", fontWeight: 600 }}>
                            <option value="">Pick a subject...</option>
                            {(subjects.length ? subjects : ["Physics", "Chemistry", "Mathematics", "Biology"]).map(s => <option key={s} value={s}>{s}</option>)}
                          </select>
                        </div>
                        <div style={{ display: "flex", gap: 12 }}>
                          <div style={{ flex: 1 }}>
                            <label style={{ fontSize: ".75rem", fontWeight: 700, color: T.text3, textTransform: "uppercase", marginBottom: 6, display: "block" }}>Questions</label>
                            <select value={quizCount} onChange={e => setQuizCount(Number(e.target.value))} style={{ width: "100%", padding: "12px", borderRadius: 14, border: `1px solid ${T.border}`, background: T.bg3, color: T.text, fontSize: ".9rem", fontWeight: 600 }}>
                              {[5, 10, 15].map(n => <option key={n} value={n}>{n}</option>)}
                            </select>
                          </div>
                          <div style={{ flex: 1 }}>
                            <label style={{ fontSize: ".75rem", fontWeight: 700, color: T.text3, textTransform: "uppercase", marginBottom: 6, display: "block" }}>Level</label>
                            <select value={quizDifficulty} onChange={e => setQuizDifficulty(e.target.value)} style={{ width: "100%", padding: "12px", borderRadius: 14, border: `1px solid ${T.border}`, background: T.bg3, color: T.text, fontSize: ".9rem", fontWeight: 600 }}>
                              <option value="easy">Easy</option><option value="medium">Medium</option><option value="hard">Hard</option>
                            </select>
                          </div>
                        </div>
                      </div>
                      {quizErr && <p style={{ color: "#DC2626", fontSize: ".8rem", marginTop: 12, fontWeight: 600 }}>{quizErr}</p>}
                      <button onClick={genQuiz} style={{ width: "100%", marginTop: 24, padding: "16px", borderRadius: 16, border: "none", background: T.accent, color: "#fff", fontSize: "1rem", fontWeight: 800, cursor: "pointer" }}>Start Game</button>
                    </div>
                  )}

                  {quizState === "loading" && (
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: 60, color: T.accent }}>
                      <I n="cog" s={40} cls="fa-spin" style={{ marginBottom: 20 }} />
                      <h3 style={{ margin: 0, fontWeight: 700, color: T.text }}>Generating Questions...</h3>
                    </div>
                  )}

                  {quizState === "active" && quizQs[quizIdx] && (() => {
                    const q = quizQs[quizIdx]; const sel = quizAns[quizIdx];
                    return (
                      <div style={{ background: T.card, borderRadius: 24, padding: 20, border: `1px solid ${T.border}` }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
                          <span style={{ fontSize: ".8rem", fontWeight: 800, color: T.text3, background: T.bg3, padding: "4px 10px", borderRadius: 12 }}>{quizSubject.toUpperCase()}</span>
                          <span style={{ fontSize: ".8rem", fontWeight: 800, color: T.accent }}>{quizIdx + 1} / {quizQs.length}</span>
                        </div>
                        <h3 style={{ fontSize: "1.1rem", fontWeight: 700, lineHeight: 1.5, margin: "0 0 24px" }}>{q.question}</h3>
                        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                          {q.options.map((o, oi) => {
                            const isSel = sel === oi; const isCorr = q.correct === oi;
                            let bg = T.bg3, bdr = T.bg3, clr = T.text;
                            if (sel !== undefined) { if (isCorr) { bg = "#ECFDF5"; bdr = "#10B981"; } else if (isSel && !isCorr) { bg = "#FEF2F2"; bdr = "#EF4444"; } }
                            return (
                              <button key={oi} onClick={() => selAns(quizIdx, oi)} style={{ width: "100%", padding: "14px 16px", borderRadius: 16, border: `2px solid ${bdr}`, background: bg, color: clr, fontSize: ".95rem", fontWeight: 600, textAlign: "left", cursor: sel !== undefined ? "default" : "pointer", transition: "all .2s" }}>{o}</button>
                            );
                          })}
                        </div>
                        {quizExpl && q.explanation && <div style={{ background: T.bg3, borderRadius: 16, padding: 16, marginTop: 16, fontSize: ".85rem", lineHeight: 1.5 }}><span style={{ color: sel === q.correct ? "#10B981" : "#EF4444", fontWeight: 800 }}>{sel === q.correct ? "Correct! " : "Oops! "}</span>{q.explanation}</div>}
                        {sel !== undefined && <button onClick={nextQ} style={{ width: "100%", marginTop: 20, padding: "16px", borderRadius: 16, border: "none", background: T.accent, color: "#fff", fontSize: "1rem", fontWeight: 800, cursor: "pointer" }}>{quizIdx < quizQs.length - 1 ? "Next Question" : "View Results"}</button>}
                      </div>
                    );
                  })()}

                  {quizState === "results" && (
                    <div style={{ background: T.card, borderRadius: 24, padding: 30, border: `1px solid ${T.border}`, textAlign: "center" }}>
                      <div style={{ position: "relative", width: 120, height: 120, margin: "0 auto 20px" }}>
                        <Ring val={Math.round((quizScore / quizQs.length) * 100)} sz={120} sw={10} c={quizScore / quizQs.length >= 0.7 ? "#10B981" : "#F59E0B"} bg={T.bg3} />
                        <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
                          <span style={{ fontSize: "2rem", fontWeight: 900, lineHeight: 1 }}>{quizScore}</span>
                          <span style={{ fontSize: ".8rem", color: T.text3, fontWeight: 700 }}>out of {quizQs.length}</span>
                        </div>
                      </div>
                      <h2 style={{ margin: "0 0 8px", fontSize: "1.4rem", fontWeight: 800 }}>{quizScore / quizQs.length >= 0.8 ? "Amazing Job! 🌟" : "Good Effort! 👍"}</h2>
                      <button onClick={resetQuiz} style={{ padding: "14px 30px", borderRadius: 16, border: "none", background: T.bg3, color: T.text, fontSize: ".9rem", fontWeight: 800, cursor: "pointer", marginTop: 10 }}>Play Again</button>
                    </div>
                  )}
                </div>
              )}

              {/* 4c. PERSONALIZED PROMPT */}
              {aiSubTab === "prompt" && (
                <div style={{ padding: 20 }}>
                  <div style={{ background: "linear-gradient(135deg, #10B981, #059669)", borderRadius: 20, padding: 20, color: "#fff", marginBottom: 20 }}>
                    <h2 style={{ margin: "0 0 8px", fontSize: "1.2rem", fontWeight: 800 }}>Magic Prompt Engine</h2>
                    <p style={{ margin: 0, fontSize: ".85rem", opacity: 0.9 }}>Based on your daily app usage, we generated a personalized context block. Paste this into any AI to get custom tutoring.</p>
                  </div>

                  <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 20, padding: 20 }}>
                    <div style={{ fontSize: ".85rem", color: T.text, lineHeight: 1.6, fontFamily: "monospace", whiteSpace: "pre-wrap" }}>
{`Act as an expert Indian private tutor.
Student Profile:
- Name: ${student?.studentName || "Student"}
- Class: ${student?.class || "N/A"}
- Current App Attendance: ${attPct}%
- Avg Test Score: ${avgQuiz}%
- Areas of Struggle: ${weakSubjects.length ? weakSubjects.join(", ") : "Advanced Problem Solving"}

Instructions:
1. Explain concepts simply, relating them to real-world Indian examples.
2. If teaching a struggle area, use the Feynman technique.
3. Keep answers concise. Provide step-by-step math/science solutions.

Now, teach me: [TYPE YOUR TOPIC HERE]`}
                    </div>
                    <button onClick={() => navigator.clipboard.writeText(`Act as an expert Indian private tutor. Student Profile: Name: ${student?.studentName}, Class: ${student?.class}, Avg Test Score: ${avgQuiz}%, Weak Areas: ${weakSubjects.join(", ")}. Now teach me: `)} style={{ marginTop: 20, width: "100%", padding: "12px", background: T.bg, border: `1px solid ${T.border}`, borderRadius: 12, color: T.text, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
                      <I n="copy"/> Copy Base Prompt
                    </button>
                  </div>
                </div>
              )}

              {/* 4d. MATH GRAPH */}
              {aiSubTab === "graph" && (
                <div style={{ padding: 20, display: "flex", flexDirection: "column", height: "100%" }}>
                  <div style={{ background: T.card, borderRadius: 20, border: `1px solid ${T.border}`, padding: 16, marginBottom: 16 }}>
                    {equations.map((eq, i) => (
                      <div key={i} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <span style={{ fontWeight: 700, color: T.text }}>y =</span>
                        <input value={eq.expr} onChange={(e) => { const ne = [...equations]; ne[i].expr = e.target.value; setEquations(ne); }} style={{ flex: 1, background: T.bg, border: `1px solid ${T.border}`, padding: "8px 12px", borderRadius: 8, color: T.text, fontSize: ".9rem", outline: "none", fontFamily: "monospace" }} placeholder="sin(x)" />
                        <div style={{ width: 20, height: 20, borderRadius: "50%", background: eq.color }}/>
                      </div>
                    ))}
                  </div>
                  <div style={{ flex: 1, background: T.card, borderRadius: 20, border: `1px solid ${T.border}`, overflow: "hidden", position: "relative", minHeight: 300 }}>
                    <canvas ref={canvasRef} width={400} height={400} style={{ width: "100%", height: "100%", display: "block" }} />
                    <div style={{ position: "absolute", bottom: 10, right: 10, display: "flex", gap: 8 }}>
                      <button onClick={() => setGraphZoom(z => z + 10)} style={{ width: 36, height: 36, borderRadius: "50%", background: T.card, border: `1px solid ${T.border}`, color: T.text, display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 2px 10px rgba(0,0,0,0.1)", cursor: "pointer" }}><I n="plus"/></button>
                      <button onClick={() => setGraphZoom(z => Math.max(10, z - 10))} style={{ width: 36, height: 36, borderRadius: "50%", background: T.card, border: `1px solid ${T.border}`, color: T.text, display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 2px 10px rgba(0,0,0,0.1)", cursor: "pointer" }}><I n="minus"/></button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* 5. E-BOOKS / LIBRARY TAB */}
          {activeTab === "library" && (
            <div style={{ padding: 20 }}>
              <h2 style={{ fontSize: "1.4rem", fontWeight: 800, margin: "0 0 6px" }}>Digital Library</h2>
              <p style={{ fontSize: ".85rem", color: T.text3, margin: "0 0 20px" }}>Free NCERTs & Modules</p>
              
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                {materials.filter(m => m.materialType === "pdf").map(m => (
                  <div key={m.id} style={{ background: T.card, borderRadius: 16, border: `1px solid ${T.border}`, padding: 16, textAlign: "center" }}>
                    <I n="file-pdf" s={32} c="#EC4899" style={{ marginBottom: 12 }}/>
                    <h4 style={{ margin: "0 0 4px", fontSize: ".9rem", fontWeight: 700 }}>{m.title}</h4>
                    <p style={{ margin: "0 0 12px", fontSize: ".7rem", color: T.text3 }}>{m.subject}</p>
                    <a href={m.fileUrl} target="_blank" rel="noopener noreferrer" style={{ display: "block", background: T.bg, padding: "8px", borderRadius: 8, fontSize: ".75rem", fontWeight: 700, color: T.text, textDecoration: "none" }}>Read Book</a>
                  </div>
                ))}
                {materials.filter(m => m.materialType === "pdf").length === 0 && <p style={{ fontSize: ".85rem", color: T.text3, gridColumn: "span 2", textAlign: "center", marginTop: 20 }}>No PDFs uploaded yet.</p>}
              </div>
            </div>
          )}

          {/* 6. ONLINE TESTS TAB */}
          {activeTab === "tests" && (
            <div style={{ padding: 20 }}>
              <h2 style={{ fontSize: "1.4rem", fontWeight: 800, margin: "0 0 6px" }}>Online Tests</h2>
              <p style={{ fontSize: ".85rem", color: T.text3, margin: "0 0 20px" }}>Give live MCQ tests from home.</p>
              
              {tests.length === 0 ? (
                <div style={{ textAlign: "center", padding: 40, color: T.text3 }}>
                  <I n="clipboard-list" s={40} style={{ marginBottom: 12, opacity: 0.5 }}/>
                  <p>No active tests right now.</p>
                </div>
              ) : (
                tests.map(t => (
                  <div key={t.id} style={{ background: T.card, borderRadius: 20, border: `1px solid ${T.border}`, padding: 20, marginBottom: 16, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div>
                      <h3 style={{ margin: "0 0 4px", fontSize: "1.1rem", fontWeight: 800 }}>{t.title}</h3>
                      <p style={{ margin: 0, fontSize: ".8rem", color: T.text3 }}>{t.subject} • {t.duration || 60} mins</p>
                    </div>
                    <button style={{ background: "#F59E0B", color: "#fff", border: "none", padding: "10px 20px", borderRadius: 12, fontWeight: 700, cursor: "pointer" }}>Start</button>
                  </div>
                ))
              )}
            </div>
          )}

        </div>

        {/* ═══ FLOATING BOTTOM NAVIGATION ═══ */}
        <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, background: T.card, borderTop: `1px solid ${T.border}`, display: "flex", justifyContent: "space-around", padding: "12px 10px 20px", zIndex: 100 }}>
          {[
            { id: "dashboard", i: "chart-simple", l: "Home" },
            { id: "myBatches", i: "chalkboard-user", l: "Batches" },
            { id: "explore", i: "compass", l: "Explore" },
            { id: "library", i: "book", l: "Books" },
            { id: "ai", i: "robot", l: "AI Portal" }
          ].map(tab => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)} style={{ background: "none", border: "none", display: "flex", flexDirection: "column", alignItems: "center", gap: 4, color: activeTab === tab.id ? T.accent : T.text3, cursor: "pointer", flex: 1 }}>
              <div style={{ width: 32, height: 32, borderRadius: "50%", background: activeTab === tab.id ? (dark ? "#334155" : "#EEF2FF") : "transparent", display: "flex", alignItems: "center", justifyContent: "center", transition: "background 0.2s" }}>
                <I n={tab.i} s={16}/>
              </div>
              <span style={{ fontSize: ".65rem", fontWeight: activeTab === tab.id ? 800 : 600 }}>{tab.l}</span>
            </button>
          ))}
        </div>

        {/* UPI Payment Modal Placeholder */}
        {showUpiModal && (
          <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)", zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
            <div style={{ background: T.card, borderRadius: 24, padding: 30, width: "100%", textAlign: "center", border: `1px solid ${T.border}`, animation: "fadeIn 0.2s" }}>
              <div style={{ width: 60, height: 60, borderRadius: "50%", background: "#ECFDF5", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px" }}><I n="qrcode" s={24} c="#10B981"/></div>
              <h2 style={{ margin: "0 0 10px", fontSize: "1.4rem", fontWeight: 800 }}>Complete Payment</h2>
              <p style={{ margin: "0 0 24px", fontSize: ".85rem", color: T.text3 }}>Pay via PhonePe, GPay or Paytm to unlock batch access immediately.</p>
              <button style={{ width: "100%", padding: "14px", borderRadius: 16, background: "#10B981", color: "#fff", border: "none", fontSize: "1rem", fontWeight: 800, marginBottom: 12, cursor: "pointer" }}>Pay with UPI Apps</button>
              <button onClick={() => setShowUpiModal(false)} style={{ width: "100%", padding: "14px", borderRadius: 16, background: T.bg, color: T.text, border: "none", fontSize: ".9rem", fontWeight: 700, cursor: "pointer" }}>Cancel</button>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}