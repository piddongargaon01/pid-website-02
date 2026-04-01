"use client";
import { db, auth, googleProvider } from "../firebase";
import { collection, query, where, onSnapshot, addDoc, updateDoc, doc, serverTimestamp } from "firebase/firestore";
import { signInWithPopup, onAuthStateChanged, signOut } from "firebase/auth";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { useEffect, useState, useRef } from "react";
import Link from "next/link";

export default function StudentPortal() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [student, setStudent] = useState(null);
  const [studentLoading, setStudentLoading] = useState(false);
  const [notEnrolled, setNotEnrolled] = useState(false);
  const [activeTab, setActiveTab] = useState("dashboard");
  const [materials, setMaterials] = useState([]);
  const [matFilter, setMatFilter] = useState({ subject: "", type: "all", chapter: "" });
  const [answerLang, setAnswerLang] = useState("hinglish");

  // Quiz
  const [quizState, setQuizState] = useState("setup");
  const [quizSubject, setQuizSubject] = useState("");
  const [quizChapter, setQuizChapter] = useState("");
  const [quizCount, setQuizCount] = useState(5);
  const [quizDifficulty, setQuizDifficulty] = useState("medium");
  const [quizQuestions, setQuizQuestions] = useState([]);
  const [currentQ, setCurrentQ] = useState(0);
  const [selectedAnswers, setSelectedAnswers] = useState({});
  const [showExplanation, setShowExplanation] = useState(false);
  const [quizScore, setQuizScore] = useState(0);
  const [quizError, setQuizError] = useState("");
  const [quizHistory, setQuizHistory] = useState([]);
  const [showQuizHistory, setShowQuizHistory] = useState(false);

  // Doubt Solver
  const [doubtSubject, setDoubtSubject] = useState("");
  const [doubtInput, setDoubtInput] = useState("");
  const [doubtChat, setDoubtChat] = useState([]);
  const [doubtLoading, setDoubtLoading] = useState(false);
  const [doubtError, setDoubtError] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [thinkingText, setThinkingText] = useState("");
  const chatEndRef = useRef(null);
  const typingRef = useRef(null);
  const textareaRef = useRef(null);

  // Image + Crop
  const [doubtImage, setDoubtImage] = useState(null);
  const [doubtImagePreview, setDoubtImagePreview] = useState("");
  const [showCrop, setShowCrop] = useState(false);
  const [showAttachMenu, setShowAttachMenu] = useState(false);
  const imgInputRef = useRef(null);
  const camInputRef = useRef(null);
  const fileInputRef = useRef(null);
  const cropCanvasRef = useRef(null);
  const [cropStart, setCropStart] = useState(null);
  const [cropEnd, setCropEnd] = useState(null);
  const [isCropping, setIsCropping] = useState(false);

  // Doubt History
  const [doubtHistory, setDoubtHistory] = useState([]);
  const [showDoubtHistory, setShowDoubtHistory] = useState(false);
  const [activeSessionId, setActiveSessionId] = useState(null);

  // Math Graph Tool
  const [equations, setEquations] = useState([{ expr: "", color: "#1349A8" }]);
  const [graphZoom, setGraphZoom] = useState(50); // pixels per unit
  const [graphCenter, setGraphCenter] = useState({ x: 0, y: 0 });
  const [showGrid, setShowGrid] = useState(true);
  const [graphError, setGraphError] = useState("");
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState(null);
  const canvasRef = useRef(null);
  const graphColors = ["#1349A8", "#DC2626", "#059669", "#D98D04", "#7C3AED", "#0891B2", "#E11D48", "#4338CA"];

  // Auth + data listeners
  useEffect(() => { const u = onAuthStateChanged(auth, (u) => { setUser(u); setLoading(false); }); return () => u(); }, []);
  useEffect(() => { if (student?.medium) { const m = student.medium.toLowerCase(); if (m.includes("hindi")) setAnswerLang("hindi"); else if (m.includes("english")) setAnswerLang("english"); else setAnswerLang("hinglish"); } }, [student]);

  useEffect(() => {
    if (!user?.email) { setStudent(null); setNotEnrolled(false); return; }
    setStudentLoading(true); setNotEnrolled(false);
    const q = query(collection(db, "students"), where("studentEmail", "==", user.email.toLowerCase()));
    const unsub = onSnapshot(q, (snap) => {
      if (snap.empty) {
        const u2 = onSnapshot(collection(db, "students"), (s2) => {
          const f = s2.docs.find((d) => d.data().studentEmail?.toLowerCase() === user.email.toLowerCase());
          if (f) { setStudent({ id: f.id, ...f.data() }); setNotEnrolled(false); } else { setStudent(null); setNotEnrolled(true); }
          setStudentLoading(false);
        }); return () => u2();
      } else { setStudent({ id: snap.docs[0].id, ...snap.docs[0].data() }); setNotEnrolled(false); setStudentLoading(false); }
    }); return () => unsub();
  }, [user]);

  useEffect(() => {
    if (!student) return;
    const sc = student.class || student.presentClass || "";
    const unsub = onSnapshot(collection(db, "study_materials"), (snap) => {
      let arr = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      if (sc) { const cn = sc.replace(/[^0-9-]/g, "").trim(); arr = arr.filter((m) => (m.courseId || "").toLowerCase().includes(cn)); }
      arr.sort((a, b) => (b.createdAt?.toDate?.() || 0) - (a.createdAt?.toDate?.() || 0));
      setMaterials(arr);
    }); return () => unsub();
  }, [student]);

  useEffect(() => {
    if (!student?.id) return;
    const q = query(collection(db, "doubt_history"), where("studentId", "==", student.id));
    const unsub = onSnapshot(q, (snap) => {
      const arr = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      arr.sort((a, b) => (b.createdAt?.toDate?.() || 0) - (a.createdAt?.toDate?.() || 0));
      setDoubtHistory(arr);
    }); return () => unsub();
  }, [student]);

  // Quiz history listener
  useEffect(() => {
    if (!student?.id) return;
    const q = query(collection(db, "quiz_history"), where("studentId", "==", student.id));
    const unsub = onSnapshot(q, (snap) => {
      const arr = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      arr.sort((a, b) => (b.createdAt?.toDate?.() || 0) - (a.createdAt?.toDate?.() || 0));
      setQuizHistory(arr);
    }); return () => unsub();
  }, [student]);

  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [doubtChat, isTyping, doubtLoading]);
  useEffect(() => { return () => { if (typingRef.current) clearInterval(typingRef.current); }; }, []);

  // Close attach menu on outside click
  useEffect(() => {
    if (!showAttachMenu) return;
    const handler = () => setShowAttachMenu(false);
    setTimeout(() => document.addEventListener("click", handler), 10);
    return () => document.removeEventListener("click", handler);
  }, [showAttachMenu]);

  // Helpers
  function formatDate(ts) { if (!ts) return ""; const d = ts.toDate ? ts.toDate() : new Date(ts); return d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }); }
  function getInitials(n) { if (!n) return "?"; return n.split(" ").map(w => w[0]).join("").toUpperCase().slice(0, 2); }
  const matTypes = { notes: { icon: "fa-file-alt", color: "#1349A8", label: "Notes" }, dpp: { icon: "fa-tasks", color: "#D98D04", label: "DPP" }, lecture: { icon: "fa-video", color: "#DC2626", label: "Lecture" }, pyq: { icon: "fa-history", color: "#7C3AED", label: "PYQ" }, pdf: { icon: "fa-file-pdf", color: "#059669", label: "PDF" }, assignment: { icon: "fa-pen", color: "#0891B2", label: "Assignment" } };
  function getMt(t) { return matTypes[t] || { icon: "fa-file", color: "#6B7F99", label: t || "Other" }; }
  const subjects = [...new Set(materials.map(m => m.subject).filter(Boolean))];
  const quizChapters = [...new Set(materials.filter(m => m.subject === quizSubject).map(m => m.chapter).filter(Boolean))];
  const langLabel = answerLang === "hindi" ? "Hindi (Devanagari)" : answerLang === "english" ? "English only" : "Hinglish";
  const sampleQs = { "": ["Newton's 3rd Law kya hai?", "Solve: 2x + 5 = 15", "Photosynthesis explain karo", "Ohm's Law define karo"], Physics: ["Newton ke 3 laws batao", "Electromagnetic induction?", "Refraction kya hai?", "Work-energy theorem?"], Chemistry: ["pH scale kya hai?", "Ionic vs covalent bond?", "Mole concept samjhao", "Fe + O₂ → Fe₂O₃ balance karo"], Mathematics: ["2x² - 5x + 3 = 0 solve karo", "Pythagorean theorem?", "d/dx of x³ + 2x?", "sin, cos, tan ratios?"], Biology: ["Photosynthesis process?", "DNA replication?", "Osmosis vs diffusion?", "Mendel's law?"], Science: ["Light reflection?", "Chemical reaction types?", "Force ke types?", "Acid aur base?"] };
  const currentSamples = sampleQs[doubtSubject] || sampleQs[""];

  function getGemini() { const k = process.env.NEXT_PUBLIC_GEMINI_API_KEY; if (!k) throw new Error("API key missing!"); return new GoogleGenerativeAI(k).getGenerativeModel({ model: "gemini-2.5-flash" }); }

  // ═══ QUIZ ═══
  async function generateQuiz() {
    if (!quizSubject) { setQuizError("Subject select karo!"); return; }
    setQuizError(""); setQuizState("loading"); setQuizQuestions([]); setSelectedAnswers({}); setCurrentQ(0); setShowExplanation(false); setQuizScore(0);
    try {
      const ci = student?.class || student?.presentClass || "12"; const ch = quizChapter ? `Chapter: ${quizChapter}` : "Any chapter";
      const result = await getGemini().generateContent(`Expert Indian education quiz for Class ${ci}. Generate ${quizCount} MCQs: Subject: ${quizSubject}, ${ch}, Difficulty: ${quizDifficulty}, Board: ${student?.board || "CG Board"}. LANGUAGE: ${langLabel}. NCERT based. Respond ONLY JSON array: [{"question":"text","options":["A","B","C","D"],"correct":0,"explanation":"text"}]`);
      let t = result.response.text().replace(/```json\s*/gi, "").replace(/```\s*/gi, "").trim();
      const si = t.indexOf("["), ei = t.lastIndexOf("]"); if (si !== -1 && ei !== -1) t = t.substring(si, ei + 1);
      const v = JSON.parse(t).filter(q => q.question && q.options?.length === 4 && typeof q.correct === "number");
      if (!v.length) throw new Error("No valid Qs"); setQuizQuestions(v); setQuizState("active");
    } catch (e) { setQuizError(e.message); setQuizState("setup"); }
  }
  function selectAnswer(qi, oi) { if (selectedAnswers[qi] !== undefined) return; setSelectedAnswers(p => ({ ...p, [qi]: oi })); setShowExplanation(true); }
  function nextQuestion() { setShowExplanation(false); if (currentQ < quizQuestions.length - 1) setCurrentQ(currentQ + 1); else { let s = 0; quizQuestions.forEach((q, i) => { if (selectedAnswers[i] === q.correct) s++; }); setQuizScore(s); setQuizState("results"); saveQuizHistory(s); } }

  async function saveQuizHistory(score) {
    try {
      const total = quizQuestions.length;
      const pct = Math.round((score / total) * 100);
      await addDoc(collection(db, "quiz_history"), {
        studentId: student?.id,
        studentName: student?.studentName,
        studentClass: student?.class || student?.presentClass,
        subject: quizSubject,
        chapter: quizChapter || "All",
        difficulty: quizDifficulty,
        totalQuestions: total,
        correctAnswers: score,
        percentage: pct,
        grade: pct >= 90 ? "A+" : pct >= 80 ? "A" : pct >= 70 ? "B+" : pct >= 60 ? "B" : pct >= 50 ? "C" : "F",
        questions: quizQuestions.map((q, i) => ({ question: q.question, correct: q.correct, selected: selectedAnswers[i], isCorrect: selectedAnswers[i] === q.correct })),
        language: answerLang,
        createdAt: serverTimestamp(),
      });
    } catch (e) { console.error("Quiz save error:", e); }
  }
  function resetQuiz() { setQuizState("setup"); setQuizQuestions([]); setSelectedAnswers({}); setCurrentQ(0); setShowExplanation(false); setQuizScore(0); setQuizError(""); }

  // ═══ IMAGE ═══
  function processImage(file) {
    if (!file) return;
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) { alert("JPG/PNG/WebP only"); return; }
    if (file.size > 10 * 1024 * 1024) { alert("Max 10MB"); return; }
    const r = new FileReader();
    r.onload = (e) => { setDoubtImagePreview(e.target.result); setDoubtImage(e.target.result.split(",")[1]); setShowCrop(true); setShowAttachMenu(false); };
    r.readAsDataURL(file);
  }
  function handleImageUpload(e) { processImage(e.target.files?.[0]); if (e.target) e.target.value = ""; }
  function removeImage() { setDoubtImage(null); setDoubtImagePreview(""); setShowCrop(false); setCropStart(null); setCropEnd(null); }
  function applyCrop() {
    if (!cropStart || !cropEnd || !cropCanvasRef.current) { setShowCrop(false); return; }
    const img = new Image();
    img.onload = () => {
      const el = cropCanvasRef.current; const sx = img.naturalWidth / el.offsetWidth, sy = img.naturalHeight / el.offsetHeight;
      const x = Math.min(cropStart.x, cropEnd.x) * sx, y = Math.min(cropStart.y, cropEnd.y) * sy;
      const w = Math.abs(cropEnd.x - cropStart.x) * sx, h = Math.abs(cropEnd.y - cropStart.y) * sy;
      if (w < 20 || h < 20) { setShowCrop(false); return; }
      const c = document.createElement("canvas"); c.width = w; c.height = h;
      c.getContext("2d").drawImage(img, x, y, w, h, 0, 0, w, h);
      const url = c.toDataURL("image/jpeg", 0.9);
      setDoubtImagePreview(url); setDoubtImage(url.split(",")[1]); setShowCrop(false); setCropStart(null); setCropEnd(null);
    }; img.src = doubtImagePreview;
  }

  // ═══ DOUBT SOLVER ═══
  const thinkSteps = ["Samajh raha hoon...", "Concept analyze kar raha hoon...", "Solution prepare kar raha hoon...", "Answer likh raha hoon..."];

  async function askDoubt() {
    if (!doubtInput.trim() && !doubtImage) return;
    const userMsg = doubtInput.trim(); const userImg = doubtImagePreview; const imgB64 = doubtImage;
    setDoubtInput(""); removeImage();
    setDoubtChat(p => [...p, { role: "user", text: userMsg, image: userImg, time: new Date() }]);
    setDoubtLoading(true); setDoubtError("");
    // Auto-resize textarea back
    if (textareaRef.current) textareaRef.current.style.height = "44px";

    let ti = 0; setThinkingText(thinkSteps[0]);
    const thinkInt = setInterval(() => { ti = (ti + 1) % thinkSteps.length; setThinkingText(thinkSteps[ti]); }, 2500);

    try {
      const ci = student?.class || student?.presentClass || "12";
      const si = doubtSubject ? `Subject: ${doubtSubject}` : "Any subject";
      const hist = doubtChat.slice(-6).map(m => `${m.role === "user" ? "Student" : "Teacher"}: ${m.text}`).join("\n");

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

${hist ? `Context:\n${hist}\n\n` : ""}Student: ${userMsg || "Analyze this image and solve/explain it."}`;

      let result;
      if (imgB64) { result = await getGemini().generateContent([{ text: prompt }, { inlineData: { mimeType: "image/jpeg", data: imgB64 } }]); }
      else { result = await getGemini().generateContent(prompt); }

      clearInterval(thinkInt); setThinkingText("");
      const answer = result.response.text();

      // Save to Firebase
      try {
        const msgs = [...doubtChat, { role: "user", text: userMsg, image: userImg ? "img" : "", time: new Date().toISOString() }, { role: "ai", text: answer, time: new Date().toISOString() }];
        if (activeSessionId) { await updateDoc(doc(db, "doubt_history", activeSessionId), { messages: msgs, lastMessage: answer.substring(0, 100), subject: doubtSubject || "General", updatedAt: serverTimestamp() }); }
        else { const ref = await addDoc(collection(db, "doubt_history"), { studentId: student?.id, studentName: student?.studentName, studentClass: student?.class || student?.presentClass, subject: doubtSubject || "General", messages: [msgs[msgs.length - 2], msgs[msgs.length - 1]], lastMessage: answer.substring(0, 100), createdAt: serverTimestamp(), updatedAt: serverTimestamp() }); setActiveSessionId(ref.id); }
      } catch (se) { console.error("Save:", se); }

      // Typing animation — word by word
      setDoubtLoading(false);
      setDoubtChat(p => [...p, { role: "ai", text: "", time: new Date() }]);
      setIsTyping(true);
      const words = answer.split(/(\s+)/);
      let wi = 0;
      typingRef.current = setInterval(() => {
        wi += 3;
        if (wi >= words.length) {
          clearInterval(typingRef.current); typingRef.current = null;
          setDoubtChat(p => { const u = [...p]; u[u.length - 1] = { ...u[u.length - 1], text: answer }; return u; });
          setIsTyping(false);
        } else {
          setDoubtChat(p => { const u = [...p]; u[u.length - 1] = { ...u[u.length - 1], text: words.slice(0, wi).join("") }; return u; });
        }
      }, 25);
    } catch (err) {
      clearInterval(thinkInt); setThinkingText("");
      setDoubtError(err.message);
      setDoubtChat(p => [...p, { role: "ai", text: "Error aa gaya. Dobara try karo.", time: new Date() }]);
      setDoubtLoading(false);
    }
  }

  function clearDoubtChat() { setDoubtChat([]); setDoubtError(""); setActiveSessionId(null); if (typingRef.current) { clearInterval(typingRef.current); typingRef.current = null; } setIsTyping(false); }
  function loadSession(ses) { setDoubtChat(ses.messages.map(m => ({ ...m, time: m.time ? new Date(m.time) : new Date() }))); setActiveSessionId(ses.id); setDoubtSubject(ses.subject || ""); setShowDoubtHistory(false); }

  // ═══ MATH GRAPH FUNCTIONS ═══
  function safeEval(expr, x) {
    try {
      const cleaned = expr
        .replace(/\^/g, "**")
        .replace(/sin/g, "Math.sin").replace(/cos/g, "Math.cos").replace(/tan/g, "Math.tan")
        .replace(/sqrt/g, "Math.sqrt").replace(/abs/g, "Math.abs").replace(/log/g, "Math.log")
        .replace(/ln/g, "Math.log").replace(/pi/g, "Math.PI").replace(/e(?![a-z])/g, "Math.E")
        .replace(/asin/g, "Math.asin").replace(/acos/g, "Math.acos").replace(/atan/g, "Math.atan")
        .replace(/floor/g, "Math.floor").replace(/ceil/g, "Math.ceil").replace(/round/g, "Math.round");
      return new Function("x", `"use strict"; return (${cleaned})`)(x);
    } catch { return NaN; }
  }

  function drawGraph() {
    const canvas = canvasRef.current; if (!canvas) return;
    const ctx = canvas.getContext("2d");
    const W = canvas.width, H = canvas.height;
    const z = graphZoom, cx = graphCenter.x, cy = graphCenter.y;
    const ox = W / 2 - cx * z, oy = H / 2 + cy * z;

    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = "#FAFBFC"; ctx.fillRect(0, 0, W, H);

    if (showGrid) {
      // Grid lines
      const step = z >= 30 ? 1 : z >= 15 ? 2 : z >= 8 ? 5 : 10;
      ctx.strokeStyle = "#E8EFF8"; ctx.lineWidth = 0.5;
      for (let i = Math.floor((cx - W / (2 * z))); i <= Math.ceil((cx + W / (2 * z))); i += step) {
        const px = ox + i * z; ctx.beginPath(); ctx.moveTo(px, 0); ctx.lineTo(px, H); ctx.stroke();
      }
      for (let i = Math.floor((cy - H / (2 * z))); i <= Math.ceil((cy + H / (2 * z))); i += step) {
        const py = oy - i * z; ctx.beginPath(); ctx.moveTo(0, py); ctx.lineTo(W, py); ctx.stroke();
      }

      // Axis labels
      ctx.fillStyle = "#6B7F99"; ctx.font = "11px DM Sans, sans-serif"; ctx.textAlign = "center";
      for (let i = Math.floor((cx - W / (2 * z))); i <= Math.ceil((cx + W / (2 * z))); i += step) {
        if (i === 0) continue;
        const px = ox + i * z; if (px > 15 && px < W - 15) ctx.fillText(i, px, oy + 16);
      }
      ctx.textAlign = "right";
      for (let i = Math.floor((cy - H / (2 * z))); i <= Math.ceil((cy + H / (2 * z))); i += step) {
        if (i === 0) continue;
        const py = oy - i * z; if (py > 15 && py < H - 15) ctx.fillText(i, ox - 6, py + 4);
      }
    }

    // Axes
    ctx.strokeStyle = "#374151"; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(0, oy); ctx.lineTo(W, oy); ctx.stroke(); // X-axis
    ctx.beginPath(); ctx.moveTo(ox, 0); ctx.lineTo(ox, H); ctx.stroke(); // Y-axis
    // Origin label
    ctx.fillStyle = "#374151"; ctx.font = "bold 11px DM Sans"; ctx.textAlign = "right";
    ctx.fillText("0", ox - 5, oy + 14);
    // Axis arrows
    ctx.fillStyle = "#374151";
    ctx.beginPath(); ctx.moveTo(W - 2, oy - 4); ctx.lineTo(W - 2, oy + 4); ctx.lineTo(W + 4, oy); ctx.fill();
    ctx.beginPath(); ctx.moveTo(ox - 4, 2); ctx.lineTo(ox + 4, 2); ctx.lineTo(ox, -4); ctx.fill();
    ctx.font = "bold 12px DM Sans"; ctx.textAlign = "left";
    ctx.fillText("x", W - 14, oy - 8);
    ctx.fillText("y", ox + 8, 14);

    // Plot equations
    equations.forEach((eq) => {
      if (!eq.expr.trim()) return;
      ctx.strokeStyle = eq.color; ctx.lineWidth = 2.5; ctx.beginPath();
      let started = false;
      for (let px = 0; px < W; px++) {
        const x = (px - ox) / z;
        const y = safeEval(eq.expr, x);
        if (isNaN(y) || !isFinite(y) || Math.abs(y) > 1e6) { started = false; continue; }
        const py = oy - y * z;
        if (!started) { ctx.moveTo(px, py); started = true; } else { ctx.lineTo(px, py); }
      }
      ctx.stroke();
    });
  }

  useEffect(() => { drawGraph(); }, [equations, graphZoom, graphCenter, showGrid]);
  useEffect(() => {
    const canvas = canvasRef.current; if (!canvas) return;
    const resize = () => { const p = canvas.parentElement; canvas.width = p.offsetWidth; canvas.height = 420; drawGraph(); };
    resize(); window.addEventListener("resize", resize); return () => window.removeEventListener("resize", resize);
  }, [activeTab]);

  function handleGraphWheel(e) { e.preventDefault(); e.stopPropagation(); setGraphZoom((z) => Math.max(5, Math.min(200, z + (e.deltaY > 0 ? -5 : 5)))); }
  // Attach wheel listener with passive:false to prevent page scroll
  useEffect(() => {
    const c = canvasRef.current; if (!c) return;
    const handler = (e) => { e.preventDefault(); e.stopPropagation(); setGraphZoom((z) => Math.max(5, Math.min(200, z + (e.deltaY > 0 ? -5 : 5)))); };
    c.addEventListener("wheel", handler, { passive: false });
    return () => c.removeEventListener("wheel", handler);
  }, [activeTab]);
  function handleGraphMouseDown(e) { setIsDragging(true); setDragStart({ x: e.clientX, y: e.clientY, cx: graphCenter.x, cy: graphCenter.y }); }
  function handleGraphMouseMove(e) { if (!isDragging || !dragStart) return; const dx = (e.clientX - dragStart.x) / graphZoom; const dy = (e.clientY - dragStart.y) / graphZoom; setGraphCenter({ x: dragStart.cx - dx, y: dragStart.cy + dy }); }
  function handleGraphMouseUp() { setIsDragging(false); }
  function addEquation() { if (equations.length >= 8) return; setEquations([...equations, { expr: "", color: graphColors[equations.length % graphColors.length] }]); }
  function removeEquation(i) { if (equations.length <= 1) return; setEquations(equations.filter((_, idx) => idx !== i)); }
  function updateEquation(i, val) { const eq = [...equations]; eq[i] = { ...eq[i], expr: val }; setEquations(eq); }
  function resetGraph() { setGraphZoom(50); setGraphCenter({ x: 0, y: 0 }); }

  const [showMathKB, setShowMathKB] = useState(false);
  const [activeEqIdx, setActiveEqIdx] = useState(0);

  const mathKeys = [
    { label: "x²", insert: "x**2" }, { label: "x³", insert: "x**3" }, { label: "xⁿ", insert: "x**" }, { label: "√x", insert: "sqrt(x)" },
    { label: "sin", insert: "sin(" }, { label: "cos", insert: "cos(" }, { label: "tan", insert: "tan(" }, { label: "log", insert: "log(" },
    { label: "ln", insert: "ln(" }, { label: "π", insert: "pi" }, { label: "e", insert: "e" }, { label: "|x|", insert: "abs(" },
    { label: "1/x", insert: "1/x" }, { label: "(", insert: "(" }, { label: ")", insert: ")" }, { label: "+", insert: "+" },
    { label: "−", insert: "-" }, { label: "×", insert: "*" }, { label: "÷", insert: "/" }, { label: "^", insert: "**" },
    { label: "asin", insert: "asin(" }, { label: "acos", insert: "acos(" }, { label: "atan", insert: "atan(" }, { label: "2ˣ", insert: "2**x" },
    { label: "⌊x⌋", insert: "floor(x)" }, { label: "⌈x⌉", insert: "ceil(x)" }, { label: "0", insert: "0" }, { label: ".", insert: "." },
  ];

  function insertToEquation(text) {
    const eq = [...equations];
    eq[activeEqIdx] = { ...eq[activeEqIdx], expr: eq[activeEqIdx].expr + text };
    setEquations(eq);
  }

  const graphTemplates = [
    { label: "y = x²", expr: "x**2" },
    { label: "y = sin(x)", expr: "sin(x)" },
    { label: "y = cos(x)", expr: "cos(x)" },
    { label: "y = 1/x", expr: "1/x" },
    { label: "y = √x", expr: "sqrt(x)" },
    { label: "y = |x|", expr: "abs(x)" },
    { label: "y = x³", expr: "x**3" },
    { label: "y = tan(x)", expr: "tan(x)" },
    { label: "y = 2^x", expr: "2**x" },
    { label: "y = log(x)", expr: "log(x)" },
  ];

  function renderText(text) {
    if (!text) return "";
    let h = text.replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>").replace(/\*(.*?)\*/g, "<em>$1</em>").replace(/`(.*?)`/g, '<code style="background:#EFF6FF;padding:1px 5px;border-radius:4px;font-size:.83rem;color:#1349A8">$1</code>').replace(/^• /gm, "→ ").replace(/\n/g, "<br/>");
    return <span dangerouslySetInnerHTML={{ __html: h }} />;
  }

  // Auto-resize textarea
  function handleTextareaInput(e) {
    setDoubtInput(e.target.value);
    const el = e.target; el.style.height = "44px"; el.style.height = Math.min(el.scrollHeight, 120) + "px";
  }

  // ═══ STYLES ═══
  const s = {
    page: { fontFamily: "'DM Sans', sans-serif", background: "#F0F4FA", minHeight: "100vh" },
    nav: { background: "#0C1F36", padding: "14px 24px", display: "flex", alignItems: "center", justifyContent: "space-between", position: "sticky", top: 0, zIndex: 100, boxShadow: "0 2px 12px rgba(0,0,0,.15)" },
    navBrand: { display: "flex", alignItems: "center", gap: 10, textDecoration: "none", color: "#fff" },
    container: { maxWidth: 1100, margin: "0 auto", padding: "24px 20px" },
    card: { background: "#fff", borderRadius: 14, border: "1px solid #D4DEF0", padding: 20, marginBottom: 16, boxShadow: "0 1px 4px rgba(0,0,0,.04)" },
    btnP: { padding: "10px 20px", borderRadius: 10, border: "none", background: "linear-gradient(135deg,#1349A8,#2A6FE0)", color: "#fff", fontSize: ".85rem", fontWeight: 700, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 8 },
    btnO: { padding: "8px 16px", borderRadius: 8, border: "1px solid #FDE68A", background: "#FFFBEB", color: "#92400E", fontSize: ".78rem", fontWeight: 600, cursor: "pointer" },
    btnGray: { padding: "8px 16px", borderRadius: 8, border: "1px solid #D4DEF0", background: "#F8FAFD", color: "#4A5E78", fontSize: ".78rem", fontWeight: 600, cursor: "pointer" },
    btnG: { padding: "8px 16px", borderRadius: 8, border: "1px solid #86EFAC", background: "#F0FDF4", color: "#16A34A", fontSize: ".78rem", fontWeight: 600, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 6 },
    input: { width: "100%", border: "1.5px solid #C0D0E8", borderRadius: 8, padding: "9px 12px", fontSize: ".85rem", outline: "none", fontFamily: "'DM Sans',sans-serif", marginBottom: 10 },
    label: { display: "block", fontSize: ".78rem", fontWeight: 600, color: "#1C2E44", marginBottom: 3 },
    badge: (c, bg) => ({ display: "inline-block", padding: "3px 10px", borderRadius: 99, fontSize: ".7rem", fontWeight: 700, color: c, background: bg }),
    tabBar: { display: "flex", gap: 4, background: "#fff", borderRadius: 12, padding: 4, border: "1px solid #D4DEF0", marginBottom: 24, overflowX: "auto" },
    tabItem: (a) => ({ padding: "10px 18px", borderRadius: 10, border: "none", background: a ? "linear-gradient(135deg,#1349A8,#2A6FE0)" : "transparent", color: a ? "#fff" : "#4A5E78", fontSize: ".82rem", fontWeight: a ? 700 : 500, cursor: "pointer", display: "flex", alignItems: "center", gap: 7, whiteSpace: "nowrap" }),
    stat: { background: "#fff", borderRadius: 12, border: "1px solid #D4DEF0", padding: 18, textAlign: "center" },
  };

  // ═══ PRE-LOGIN SCREENS ═══
  if (loading) return <div style={{ ...s.page, display: "flex", alignItems: "center", justifyContent: "center", height: "100vh" }}><i className="fas fa-spinner fa-spin" style={{ fontSize: "2.5rem", color: "#1349A8" }} /></div>;

  if (!user) return (
    <div style={{ ...s.page, display: "flex", alignItems: "center", justifyContent: "center", height: "100vh", background: "linear-gradient(135deg,#0C1F36,#1a3a5c)" }}>
      <div style={{ background: "#fff", borderRadius: 20, padding: "48px 40px", textAlign: "center", maxWidth: 420, width: "90%" }}>
        <div style={{ width: 72, height: 72, borderRadius: 16, background: "linear-gradient(135deg,#1349A8,#2A6FE0)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 20px" }}><img src="/pid_logo.png" alt="" style={{ width: 48, height: 48, borderRadius: 8 }} onError={e => e.currentTarget.style.display = "none"} /></div>
        <h1 style={{ fontSize: "1.5rem", fontWeight: 800, marginBottom: 6 }}>Student Portal</h1>
        <p style={{ color: "#4A5E78", marginBottom: 32 }}>Patel Institute Dongargaon</p>
        <button onClick={() => signInWithPopup(auth, googleProvider).catch(console.error)} style={{ ...s.btnP, padding: "14px 32px", fontSize: ".92rem", width: "100%", justifyContent: "center", borderRadius: 12 }}><i className="fab fa-google" /> Login with Google</button>
        <div style={{ marginTop: 24, padding: 14, background: "#FFFBEB", borderRadius: 10, border: "1px solid #FDE68A" }}><p style={{ fontSize: ".76rem", color: "#78350F", margin: 0 }}>Admission wali Gmail use karo.</p></div>
        <Link href="/" style={{ display: "inline-flex", alignItems: "center", gap: 6, marginTop: 20, fontSize: ".82rem", color: "#1349A8", textDecoration: "none" }}><i className="fas fa-arrow-left" /> Back</Link>
      </div>
    </div>
  );

  if (studentLoading) return <div style={{ ...s.page, display: "flex", alignItems: "center", justifyContent: "center", height: "100vh" }}><div style={{ textAlign: "center" }}><i className="fas fa-search" style={{ fontSize: "2rem", color: "#1349A8", marginBottom: 16 }} /><p style={{ fontWeight: 600 }}>Profile dhundh raha...</p></div></div>;

  if (notEnrolled) return (
    <div style={{ ...s.page, display: "flex", alignItems: "center", justifyContent: "center", height: "100vh" }}>
      <div style={{ background: "#fff", borderRadius: 20, padding: "48px 40px", textAlign: "center", maxWidth: 460, border: "1px solid #D4DEF0" }}>
        <i className="fas fa-user-times" style={{ fontSize: "2rem", color: "#DC2626", marginBottom: 16 }} />
        <h2 style={{ fontWeight: 800, marginBottom: 8 }}>Not Enrolled</h2>
        <p style={{ color: "#4A5E78", marginBottom: 24 }}><strong>{user.email}</strong> linked nahi hai.</p>
        <div style={{ display: "flex", gap: 10, justifyContent: "center" }}><a href="tel:8319002877" style={{ ...s.btnP, textDecoration: "none" }}><i className="fas fa-phone" /> Call</a><button onClick={() => signOut(auth)} style={s.btnGray}>Try Another</button></div>
      </div>
    </div>
  );

  if (student?.status === "inactive") return <div style={{ ...s.page, display: "flex", alignItems: "center", justifyContent: "center", height: "100vh" }}><div style={{ background: "#fff", borderRadius: 20, padding: 48, textAlign: "center", maxWidth: 460, border: "1px solid #D4DEF0" }}><h2 style={{ fontWeight: 800 }}>Account Inactive</h2><p style={{ color: "#4A5E78" }}>Institute se contact karo.</p><a href="tel:8319002877" style={{ ...s.btnP, textDecoration: "none" }}><i className="fas fa-phone" /> 8319002877</a></div></div>;

  // ═══ MAIN ═══
  const tabs = [{ id: "dashboard", icon: "fa-th-large", label: "Dashboard" }, { id: "materials", icon: "fa-book-open", label: "Study Materials" }, { id: "quiz", icon: "fa-brain", label: "AI Quiz" }, { id: "doubts", icon: "fa-comments", label: "Doubt Solver" }, { id: "graph", icon: "fa-chart-line", label: "Math Graph" }];
  let fm = materials; if (matFilter.subject) fm = fm.filter(m => m.subject === matFilter.subject); if (matFilter.type !== "all") fm = fm.filter(m => m.materialType === matFilter.type); if (matFilter.chapter) fm = fm.filter(m => m.chapter?.toLowerCase().includes(matFilter.chapter.toLowerCase()));

  return (
    <div style={s.page}>
      <style>{`@keyframes blink{0%,100%{opacity:1}50%{opacity:0}}@keyframes fadeUp{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)}}@keyframes slideIn{from{opacity:0;transform:scale(.95)}to{opacity:1;transform:scale(1)}}.typCur::after{content:'▊';animation:blink .7s infinite;color:#059669;margin-left:1px}.fadeMsg{animation:fadeUp .35s ease}.slideIn{animation:slideIn .2s ease}`}</style>

      {/* CROP MODAL */}
      {showCrop && doubtImagePreview && <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.75)", zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
        <div style={{ background: "#fff", borderRadius: 16, padding: 20, maxWidth: 550, width: "100%", maxHeight: "85vh", overflow: "auto" }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 12 }}><h3 style={{ margin: 0, fontSize: ".95rem" }}><i className="fas fa-crop-alt" style={{ color: "#059669", marginRight: 8 }} />Crop Image</h3><button onClick={() => { setShowCrop(false); setCropStart(null); setCropEnd(null); }} style={{ background: "none", border: "none", cursor: "pointer", fontSize: "1.1rem", color: "#6B7F99" }}>✕</button></div>
          <p style={{ fontSize: ".75rem", color: "#6B7F99", marginBottom: 8 }}>Drag karke area select karo ya direct use karo</p>
          <div style={{ position: "relative", cursor: "crosshair", borderRadius: 8, overflow: "hidden", border: "2px solid #D4DEF0" }} onMouseDown={(e) => { const r = e.currentTarget.getBoundingClientRect(); setCropStart({ x: e.clientX - r.left, y: e.clientY - r.top }); setCropEnd(null); setIsCropping(true); }} onMouseMove={(e) => { if (!isCropping) return; const r = e.currentTarget.getBoundingClientRect(); setCropEnd({ x: e.clientX - r.left, y: e.clientY - r.top }); }} onMouseUp={() => setIsCropping(false)}>
            <img ref={cropCanvasRef} src={doubtImagePreview} alt="" style={{ width: "100%", display: "block" }} draggable={false} />
            {cropStart && cropEnd && <div style={{ position: "absolute", left: Math.min(cropStart.x, cropEnd.x), top: Math.min(cropStart.y, cropEnd.y), width: Math.abs(cropEnd.x - cropStart.x), height: Math.abs(cropEnd.y - cropStart.y), border: "2px dashed #059669", background: "rgba(5,150,105,.12)", pointerEvents: "none" }} />}
          </div>
          <div style={{ display: "flex", gap: 10, marginTop: 12 }}>
            {cropStart && cropEnd && <button onClick={applyCrop} style={{ ...s.btnP, background: "linear-gradient(135deg,#059669,#10B981)" }}><i className="fas fa-crop-alt" /> Crop</button>}
            <button onClick={() => { setShowCrop(false); setCropStart(null); setCropEnd(null); }} style={s.btnG}><i className="fas fa-check" /> Original</button>
            <button onClick={removeImage} style={s.btnGray}>Remove</button>
          </div>
        </div>
      </div>}

      {/* Hidden file inputs */}
      <input ref={imgInputRef} type="file" accept="image/*" onChange={handleImageUpload} style={{ display: "none" }} />
      <input ref={camInputRef} type="file" accept="image/*" capture="environment" onChange={handleImageUpload} style={{ display: "none" }} />
      <input ref={fileInputRef} type="file" accept="image/*,.pdf" onChange={handleImageUpload} style={{ display: "none" }} />

      {/* NAVBAR */}
      <nav style={s.nav}>
        <Link href="/" style={s.navBrand}><img src="/pid_logo.png" alt="" style={{ width: 32, height: 32, borderRadius: 6 }} onError={e => e.currentTarget.style.display = "none"} /><div><div style={{ fontSize: ".88rem", fontWeight: 800 }}>PID Student Portal</div><div style={{ fontSize: ".62rem", color: "#9FB8CF" }}>Patel Institute Dongargaon</div></div></Link>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <div style={{ textAlign: "right" }}><div style={{ fontSize: ".78rem", fontWeight: 600, color: "#fff" }}>{student?.studentName}</div><div style={{ fontSize: ".65rem", color: "#9FB8CF" }}>Class {student?.class || student?.presentClass}</div></div>
          <div style={{ width: 36, height: 36, borderRadius: "50%", overflow: "hidden", border: "2px solid rgba(255,255,255,.2)", background: "linear-gradient(135deg,#F5AC10,#D98D04)", display: "flex", alignItems: "center", justifyContent: "center" }}>{student?.photo?.startsWith("http") ? <img src={student.photo} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : <span style={{ color: "#fff", fontWeight: 700 }}>{getInitials(student?.studentName)}</span>}</div>
          <button onClick={() => signOut(auth)} style={{ background: "rgba(255,255,255,.08)", border: "1px solid rgba(255,255,255,.15)", color: "#9FB8CF", padding: "6px 12px", borderRadius: 8, fontSize: ".75rem", cursor: "pointer" }}><i className="fas fa-sign-out-alt" /> Logout</button>
        </div>
      </nav>

      <div style={s.container}>
        <div style={s.tabBar}>{tabs.map(t => <button key={t.id} onClick={() => setActiveTab(t.id)} style={s.tabItem(activeTab === t.id)}><i className={`fas ${t.icon}`} style={{ fontSize: ".78rem" }} /> {t.label}</button>)}</div>

        {/* ═══ DASHBOARD ═══ */}
        {activeTab === "dashboard" && <>
          <div style={{ ...s.card, background: "linear-gradient(135deg,#0C1F36,#1a3a5c)", color: "#fff", padding: 28, display: "flex", alignItems: "center", gap: 20, flexWrap: "wrap", border: "none" }}>
            <div style={{ width: 80, height: 80, borderRadius: 16, overflow: "hidden", border: "3px solid rgba(255,255,255,.2)", background: "linear-gradient(135deg,#F5AC10,#D98D04)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>{student?.photo?.startsWith("http") ? <img src={student.photo} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : <span style={{ color: "#fff", fontWeight: 800, fontSize: "1.8rem" }}>{getInitials(student?.studentName)}</span>}</div>
            <div><h2 style={{ fontSize: "1.4rem", fontWeight: 800, marginBottom: 4 }}>Welcome, {student?.studentName?.split(" ")[0]}! 👋</h2><div style={{ fontSize: ".82rem", opacity: .85 }}>Class {student?.class || student?.presentClass} · {student?.board || "CG Board"}</div></div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(150px,1fr))", gap: 14, marginBottom: 24 }}>
            {[{ n: materials.length, l: "Materials", c: "#1349A8", i: "fa-folder-open" },{ n: materials.filter(m=>m.materialType==="notes").length, l: "Notes", c: "#059669", i: "fa-file-alt" },{ n: materials.filter(m=>m.materialType==="dpp").length, l: "DPP", c: "#D98D04", i: "fa-tasks" },{ n: materials.filter(m=>m.materialType==="lecture").length, l: "Lectures", c: "#DC2626", i: "fa-video" },{ n: subjects.length, l: "Subjects", c: "#0891B2", i: "fa-book" },{ n: doubtHistory.length, l: "Doubts Solved", c: "#7C3AED", i: "fa-comments" }].map((x,i)=><div key={i} onClick={()=>setActiveTab("materials")} style={{...s.stat,cursor:"pointer"}}><i className={`fas ${x.i}`} style={{fontSize:"1.3rem",color:x.c,marginBottom:8}}/><div style={{fontSize:"1.6rem",fontWeight:800,color:x.c}}>{x.n}</div><div style={{fontSize:".76rem",color:"#6B7F99"}}>{x.l}</div></div>)}
          </div>
          <h3 style={{ fontWeight: 700, marginBottom: 14 }}><i className="fas fa-bolt" style={{ color: "#F5AC10", marginRight: 8 }} />Quick Access</h3>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(240px,1fr))", gap: 14 }}>
            {[{ tab:"materials",icon:"fa-book-open",color:"#1349A8",bg:"#EFF6FF",t:"Study Materials",d:"Notes, DPPs, Lectures" },{ tab:"quiz",icon:"fa-brain",color:"#7C3AED",bg:"#FAF5FF",t:"AI Quiz",d:"Practice MCQs" },{ tab:"doubts",icon:"fa-comments",color:"#059669",bg:"#ECFDF5",t:"Doubt Solver",d:"Text ya photo se pucho" },{ tab:"graph",icon:"fa-chart-line",color:"#DC2626",bg:"#FEF2F2",t:"Math Graph",d:"Plot equations" }].map((it,i)=><div key={i} onClick={()=>setActiveTab(it.tab)} style={{...s.card,cursor:"pointer",borderLeft:`4px solid ${it.color}`}}><div style={{display:"flex",alignItems:"center",gap:12}}><div style={{width:44,height:44,borderRadius:10,background:it.bg,display:"flex",alignItems:"center",justifyContent:"center"}}><i className={`fas ${it.icon}`} style={{color:it.color,fontSize:"1.1rem"}}/></div><div><h4 style={{fontSize:".9rem",fontWeight:700,marginBottom:2}}>{it.t}</h4><p style={{fontSize:".76rem",color:"#6B7F99",margin:0}}>{it.d}</p></div></div></div>)}
          </div>
        </>}

        {/* ═══ MATERIALS ═══ */}
        {activeTab === "materials" && <>
          <div style={{ marginBottom: 20 }}><h2 style={{ fontSize: "1.3rem", fontWeight: 800 }}>Study Materials</h2><p style={{ fontSize: ".78rem", color: "#6B7F99", margin: 0 }}>Class {student?.class || student?.presentClass} · {fm.length} materials</p></div>
          <div style={{ display: "flex", gap: 10, marginBottom: 20, flexWrap: "wrap" }}>
            <select style={{ ...s.input, width: 160, marginBottom: 0 }} value={matFilter.subject} onChange={e => setMatFilter({ ...matFilter, subject: e.target.value })}><option value="">All Subjects</option>{subjects.map(sub => <option key={sub}>{sub}</option>)}</select>
            <select style={{ ...s.input, width: 170, marginBottom: 0 }} value={matFilter.type} onChange={e => setMatFilter({ ...matFilter, type: e.target.value })}><option value="all">All Types</option>{Object.entries(matTypes).map(([v,i]) => <option key={v} value={v}>{i.label}</option>)}</select>
            <input style={{ ...s.input, flex: 1, minWidth: 150, marginBottom: 0 }} placeholder="Search..." value={matFilter.chapter} onChange={e => setMatFilter({ ...matFilter, chapter: e.target.value })} />
          </div>
          {fm.length > 0 ? (() => { const g = {}; fm.forEach(m => { const k = m.subject||"Other"; if(!g[k])g[k]=[]; g[k].push(m); }); return Object.entries(g).map(([subj,items]) => <div key={subj} style={{ marginBottom: 24 }}>
            <div style={{ padding: "10px 16px", background: "#fff", borderRadius: 10, border: "1px solid #D4DEF0", marginBottom: 12 }}><i className="fas fa-book" style={{ color: "#1349A8", marginRight: 8 }} /><strong>{subj}</strong> <span style={{ color: "#6B7F99", fontSize: ".75rem" }}>({items.length})</span></div>
            {items.map(m => { const mt = getMt(m.materialType); return <div key={m.id} style={{ ...s.card, display: "flex", alignItems: "center", gap: 14, padding: "14px 18px", marginBottom: 10, borderLeft: `3px solid ${mt.color}` }}>
              <div style={{ width: 44, height: 44, borderRadius: 10, background: `${mt.color}12`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><i className={`fas ${mt.icon}`} style={{ color: mt.color }} /></div>
              <div style={{ flex: 1 }}><div style={{ fontWeight: 700, fontSize: ".88rem" }}>{m.title} <span style={s.badge(mt.color, `${mt.color}15`)}>{mt.label}</span></div><div style={{ fontSize: ".76rem", color: "#6B7F99" }}>{m.chapter && `${m.chapter} · `}{m.uploadDate || formatDate(m.createdAt)}</div></div>
              {m.fileUrl && <a href={m.fileUrl} target="_blank" rel="noopener noreferrer" style={{ ...s.btnG, textDecoration: "none" }}><i className="fas fa-download" /> PDF</a>}
              {m.videoUrl && <a href={m.videoUrl} target="_blank" rel="noopener noreferrer" style={{ ...s.btnP, padding: "8px 14px", textDecoration: "none", fontSize: ".78rem" }}><i className="fas fa-play" /> Watch</a>}
            </div>; })}
          </div>); })() : <div style={{ ...s.card, textAlign: "center", padding: 48 }}><i className="fas fa-folder-open" style={{ fontSize: "2.5rem", color: "#B0C4DC", marginBottom: 12 }} /><h3 style={{ color: "#4A5E78" }}>No Materials</h3></div>}
        </>}

        {/* ═══ QUIZ ═══ */}
        {activeTab === "quiz" && <>
          {quizState === "setup" && <>
            {/* Quiz History Button */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
              <div><h2 style={{ fontSize: "1.1rem", fontWeight: 800, margin: 0 }}>AI Quiz Generator</h2><p style={{ fontSize: ".72rem", color: "#6B7F99", margin: 0 }}>Gemini AI se MCQs generate karo</p></div>
              <button onClick={() => setShowQuizHistory(!showQuizHistory)} style={{ ...s.btnO, display: "flex", alignItems: "center", gap: 5 }}><i className="fas fa-history" /> History ({quizHistory.length})</button>
            </div>

            {/* Quiz History Panel */}
            {showQuizHistory && <div style={{ ...s.card, marginBottom: 14, maxHeight: 300, overflowY: "auto", border: "1.5px solid #E9D5FF", background: "#FDFAFF", padding: 14 }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10 }}><span style={{ fontSize: ".85rem", fontWeight: 700 }}><i className="fas fa-history" style={{ color: "#7C3AED", marginRight: 6 }} />Past Quizzes</span><button onClick={() => setShowQuizHistory(false)} style={{ background: "none", border: "none", cursor: "pointer", color: "#6B7F99" }}>✕</button></div>
              {quizHistory.length === 0 ? <p style={{ fontSize: ".82rem", color: "#6B7F99", textAlign: "center", padding: 20 }}>Koi quiz history nahi hai.</p> : (
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {quizHistory.map(qh => {
                    const gc = qh.percentage >= 80 ? "#16A34A" : qh.percentage >= 60 ? "#D98D04" : "#DC2626";
                    return <div key={qh.id} style={{ padding: "10px 14px", borderRadius: 10, border: "1px solid #E8EFF8", background: "#fff", display: "flex", alignItems: "center", gap: 12 }}>
                      <div style={{ width: 44, height: 44, borderRadius: 10, border: `2.5px solid ${gc}`, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                        <div style={{ fontSize: ".9rem", fontWeight: 900, color: gc, lineHeight: 1 }}>{qh.percentage}%</div>
                        <div style={{ fontSize: ".55rem", fontWeight: 700, color: gc }}>{qh.grade}</div>
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 2, flexWrap: "wrap" }}>
                          <span style={{ fontWeight: 700, fontSize: ".82rem" }}>{qh.subject}</span>
                          <span style={s.badge(qh.difficulty === "easy" ? "#16A34A" : qh.difficulty === "medium" ? "#D98D04" : "#DC2626", qh.difficulty === "easy" ? "#F0FDF4" : qh.difficulty === "medium" ? "#FFFBEB" : "#FEF2F2")}>{qh.difficulty}</span>
                        </div>
                        <div style={{ fontSize: ".72rem", color: "#6B7F99" }}>{qh.chapter !== "All" ? qh.chapter + " · " : ""}{qh.correctAnswers}/{qh.totalQuestions} correct · {qh.createdAt?.toDate?.()?.toLocaleDateString?.("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) || ""}</div>
                      </div>
                      <div style={{ width: 40, height: 40, borderRadius: 8, background: `${gc}10`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                        <span style={{ fontSize: "1.1rem" }}>{qh.percentage >= 90 ? "🏆" : qh.percentage >= 70 ? "🌟" : "💪"}</span>
                      </div>
                    </div>;
                  })}
                </div>
              )}
            </div>}

          <div style={{ ...s.card, border: "2px solid #7C3AED", maxWidth: 600 }}>
            <h3 style={{ fontWeight: 800, marginBottom: 16 }}><i className="fas fa-brain" style={{ color: "#7C3AED", marginRight: 8 }} />AI Quiz Generator</h3>
            <div style={{ marginBottom: 14 }}><label style={s.label}>Language</label><div style={{ display: "flex", gap: 8 }}>{[{ v:"hinglish",l:"Hinglish",e:"🇮🇳🇬🇧" },{ v:"hindi",l:"हिंदी",e:"🇮🇳" },{ v:"english",l:"English",e:"🇬🇧" }].map(la => <button key={la.v} onClick={() => setAnswerLang(la.v)} style={{ flex:1, padding:8, borderRadius:8, border:`2px solid ${answerLang===la.v?"#7C3AED":"#D4DEF0"}`, background:answerLang===la.v?"#FAF5FF":"#fff", cursor:"pointer", textAlign:"center" }}><div>{la.e}</div><div style={{fontSize:".75rem",fontWeight:700,color:answerLang===la.v?"#7C3AED":"#6B7F99"}}>{la.l}</div></button>)}</div></div>
            <div style={{ marginBottom: 14 }}><label style={s.label}>Subject *</label><select style={s.input} value={quizSubject} onChange={e => { setQuizSubject(e.target.value); setQuizChapter(""); }}><option value="">Select</option>{subjects.length > 0 ? subjects.map(s => <option key={s}>{s}</option>) : <><option>Physics</option><option>Chemistry</option><option>Mathematics</option><option>Biology</option><option>Science</option></>}</select></div>
            <div style={{ marginBottom: 14 }}><label style={s.label}>Chapter</label>{quizChapters.length > 0 ? <select style={s.input} value={quizChapter} onChange={e => setQuizChapter(e.target.value)}><option value="">All</option>{quizChapters.map(c => <option key={c}>{c}</option>)}</select> : <input style={s.input} placeholder="e.g. Newton's Laws" value={quizChapter} onChange={e => setQuizChapter(e.target.value)} />}</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 14 }}><div><label style={s.label}>Questions</label><select style={s.input} value={quizCount} onChange={e => setQuizCount(+e.target.value)}><option value={5}>5</option><option value={10}>10</option><option value={15}>15</option></select></div><div><label style={s.label}>Difficulty</label><select style={s.input} value={quizDifficulty} onChange={e => setQuizDifficulty(e.target.value)}><option value="easy">Easy</option><option value="medium">Medium</option><option value="hard">Hard</option></select></div></div>
            {quizError && <div style={{ padding: 10, background: "#FEF2F2", borderRadius: 8, color: "#DC2626", fontSize: ".82rem", marginBottom: 14 }}>{quizError}</div>}
            <button onClick={generateQuiz} style={{ ...s.btnP, width: "100%", justifyContent: "center", borderRadius: 12, background: "linear-gradient(135deg,#7C3AED,#9333EA)" }}><i className="fas fa-magic" /> Generate Quiz</button>
          </div>
          </>}
          {quizState === "loading" && <div style={{ ...s.card, textAlign: "center", padding: 60 }}><i className="fas fa-brain" style={{ fontSize: "2.5rem", color: "#7C3AED", marginBottom: 16 }} /><h3>Generating...</h3></div>}
          {quizState === "active" && quizQuestions.length > 0 && (() => { const q = quizQuestions[currentQ]; const ans = selectedAnswers[currentQ] !== undefined; const ok = ans && selectedAnswers[currentQ] === q.correct; const pct = ((currentQ + (ans?1:0)) / quizQuestions.length) * 100; return <>
            <div style={{ marginBottom: 20 }}><div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}><span style={{ fontWeight: 700 }}>Q{currentQ+1}/{quizQuestions.length}</span><span style={s.badge("#7C3AED","#FAF5FF")}>{quizSubject}</span></div><div style={{ height: 6, background: "#E9D5FF", borderRadius: 99, overflow: "hidden" }}><div style={{ height: "100%", width: `${pct}%`, background: "#7C3AED", borderRadius: 99, transition: "width .5s" }} /></div></div>
            <div style={{ ...s.card, border: "2px solid #E9D5FF", padding: 28 }}>
              <h3 style={{ fontSize: "1.05rem", fontWeight: 700, marginBottom: 20, lineHeight: 1.5 }}>{q.question}</h3>
              {q.options.map((opt,i) => { const ol = ["A","B","C","D"][i]; let bg="#fff",bc="#D4DEF0",tc="#0B1826",op=1; if(ans){if(i===q.correct){bg="#F0FDF4";bc="#16A34A";tc="#16A34A";}else if(i===selectedAnswers[currentQ]){bg="#FEF2F2";bc="#DC2626";tc="#DC2626";}else op=.5;} return <div key={i} onClick={()=>selectAnswer(currentQ,i)} style={{padding:"14px 18px",borderRadius:12,border:`2px solid ${bc}`,background:bg,cursor:ans?"default":"pointer",display:"flex",alignItems:"center",gap:12,marginBottom:10,opacity:op}}><div style={{width:32,height:32,borderRadius:8,background:ans&&i===q.correct?"#16A34A":ans&&i===selectedAnswers[currentQ]?"#DC2626":"#E8EFF8",display:"flex",alignItems:"center",justifyContent:"center",color:ans?"#fff":"#4A5E78",fontWeight:800,fontSize:".8rem"}}>{ans&&i===q.correct?"✓":ans&&i===selectedAnswers[currentQ]?"✗":ol}</div><span style={{color:tc,fontWeight:ans&&i===q.correct?700:500}}>{opt}</span></div>;})}
              {ans && showExplanation && <div style={{padding:16,borderRadius:12,background:ok?"#F0FDF4":"#FEF2F2",border:`1px solid ${ok?"#86EFAC":"#FCA5A5"}`,marginBottom:16}}><strong style={{color:ok?"#16A34A":"#DC2626"}}>{ok?"Correct! 🎉":`Wrong → ${["A","B","C","D"][q.correct]}`}</strong><p style={{fontSize:".84rem",color:"#374151",margin:"8px 0 0",lineHeight:1.6}}>{q.explanation}</p></div>}
              {ans && <button onClick={nextQuestion} style={{...s.btnP,width:"100%",justifyContent:"center",borderRadius:12,background:"linear-gradient(135deg,#7C3AED,#9333EA)"}}>{currentQ<quizQuestions.length-1?"Next →":"Finish 🏁"}</button>}
            </div></>;})()}
          {quizState === "results" && (() => { const t=quizQuestions.length,p=Math.round((quizScore/t)*100),gc=p>=80?"#16A34A":p>=60?"#D98D04":"#DC2626"; return <>
            <div style={{...s.card,textAlign:"center",padding:36}}><div style={{fontSize:"3rem",marginBottom:8}}>{p>=90?"🏆":p>=70?"🌟":"💪"}</div><h2 style={{fontWeight:800}}>Quiz Complete!</h2><div style={{width:120,height:120,borderRadius:"50%",border:`6px solid ${gc}`,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",margin:"20px auto"}}><div style={{fontSize:"2rem",fontWeight:900,color:gc}}>{quizScore}/{t}</div><div style={{fontSize:".78rem",fontWeight:700,color:gc}}>{p}%</div></div><button onClick={resetQuiz} style={{...s.btnP,background:"linear-gradient(135deg,#7C3AED,#9333EA)"}}><i className="fas fa-redo"/> New Quiz</button></div>
            <h3 style={{fontWeight:700,margin:"24px 0 14px"}}>Review</h3>
            {quizQuestions.map((q,i)=>{const ir=selectedAnswers[i]===q.correct;return<div key={i} style={{...s.card,borderLeft:`4px solid ${ir?"#16A34A":"#DC2626"}`,marginBottom:12}}><p style={{fontWeight:600,marginBottom:6}}>Q{i+1}. {q.question}</p><div style={{fontSize:".8rem"}}><span style={{color:"#16A34A"}}>✓ {["A","B","C","D"][q.correct]}. {q.options[q.correct]}</span>{!ir&&<span style={{color:"#DC2626",marginLeft:12}}>✗ {["A","B","C","D"][selectedAnswers[i]]}. {q.options[selectedAnswers[i]]}</span>}</div><p style={{fontSize:".78rem",color:"#6B7F99",margin:"4px 0 0"}}>{q.explanation}</p></div>;})}
          </>;})()}
        </>}

        {/* ═══ DOUBT SOLVER — ChatGPT Style ═══ */}
        {activeTab === "doubts" && <>
          {/* Header */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12, flexWrap: "wrap", gap: 8 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ width: 36, height: 36, borderRadius: 10, background: "#ECFDF5", display: "flex", alignItems: "center", justifyContent: "center" }}><i className="fas fa-comments" style={{ color: "#059669" }} /></div>
              <div><h2 style={{ fontSize: "1.1rem", fontWeight: 800, margin: 0 }}>Doubt Solver</h2><p style={{ fontSize: ".7rem", color: "#6B7F99", margin: 0 }}>AI Teacher · {langLabel}</p></div>
            </div>
            <div style={{ display: "flex", gap: 6 }}>
              <button onClick={() => setShowDoubtHistory(!showDoubtHistory)} style={{ ...s.btnO, padding: "6px 12px", fontSize: ".74rem", display: "flex", alignItems: "center", gap: 4 }}><i className="fas fa-history" />{doubtHistory.length}</button>
              {doubtChat.length > 0 && <button onClick={clearDoubtChat} style={{ ...s.btnGray, padding: "6px 12px", fontSize: ".74rem" }}><i className="fas fa-plus" style={{ marginRight: 3 }} />New</button>}
            </div>
          </div>

          {/* Controls row */}
          <div style={{ display: "flex", gap: 6, marginBottom: 10, flexWrap: "wrap", alignItems: "center" }}>
            <select style={{ ...s.input, width: 140, marginBottom: 0, fontSize: ".8rem", padding: "7px 10px" }} value={doubtSubject} onChange={e => setDoubtSubject(e.target.value)}>
              <option value="">All Subjects</option>
              {subjects.length > 0 ? subjects.map(sub => <option key={sub}>{sub}</option>) : <><option>Physics</option><option>Chemistry</option><option>Mathematics</option><option>Biology</option><option>Science</option></>}
            </select>
            {[{ v:"hinglish",l:"HI+EN" },{ v:"hindi",l:"हिंदी" },{ v:"english",l:"EN" }].map(la => <button key={la.v} onClick={() => setAnswerLang(la.v)} style={{ padding: "5px 10px", borderRadius: 8, border: `1.5px solid ${answerLang===la.v?"#059669":"#D4DEF0"}`, background: answerLang===la.v?"#ECFDF5":"#fff", color: answerLang===la.v?"#059669":"#6B7F99", fontSize: ".72rem", fontWeight: 600, cursor: "pointer" }}>{la.l}</button>)}
          </div>

          {/* History */}
          {showDoubtHistory && <div className="slideIn" style={{ ...s.card, marginBottom: 12, maxHeight: 250, overflowY: "auto", border: "1.5px solid #FDE68A", background: "#FFFDF7", padding: 14 }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10 }}><span style={{ fontSize: ".85rem", fontWeight: 700 }}><i className="fas fa-history" style={{ color: "#D98D04", marginRight: 6 }} />History</span><button onClick={() => setShowDoubtHistory(false)} style={{ background: "none", border: "none", cursor: "pointer", color: "#6B7F99" }}>✕</button></div>
            {doubtHistory.length === 0 ? <p style={{ fontSize: ".8rem", color: "#6B7F99", textAlign: "center" }}>Empty</p> : doubtHistory.map(ses => <div key={ses.id} onClick={() => loadSession(ses)} style={{ padding: "8px 12px", borderRadius: 8, border: `1px solid ${activeSessionId===ses.id?"#059669":"#E8EFF8"}`, background: activeSessionId===ses.id?"#ECFDF5":"#fff", marginBottom: 6, cursor: "pointer", fontSize: ".8rem" }}>
              <div style={{ display: "flex", justifyContent: "space-between" }}><span style={s.badge("#059669","#ECFDF5")}>{ses.subject||"General"}</span><span style={{ fontSize: ".65rem", color: "#9CA3AF" }}>{ses.createdAt?.toDate?.()?.toLocaleDateString?.("en-IN",{day:"numeric",month:"short"})||""}</span></div>
              <p style={{ margin: "4px 0 0", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontSize: ".78rem" }}>{ses.messages?.[0]?.text||"..."}</p>
            </div>)}
          </div>}

          {/* ═══ CHAT BOX ═══ */}
          <div style={{ background: "#fff", borderRadius: 16, border: "1.5px solid #D4DEF0", overflow: "hidden", display: "flex", flexDirection: "column", boxShadow: "0 2px 8px rgba(0,0,0,.04)" }}>
            {/* Messages */}
            <div style={{ flex: 1, padding: "16px 16px 8px", overflowY: "auto", maxHeight: 400, minHeight: 240 }}>
              {doubtChat.length === 0 && <div style={{ textAlign: "center", padding: "32px 16px" }}>
                <div style={{ width: 50, height: 50, borderRadius: 12, background: "linear-gradient(135deg,#059669,#10B981)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 12px" }}><i className="fas fa-robot" style={{ color: "#fff", fontSize: "1.2rem" }} /></div>
                <h3 style={{ fontSize: ".95rem", fontWeight: 800, marginBottom: 4 }}>Kya doubt hai? Pucho!</h3>
                <p style={{ fontSize: ".78rem", color: "#6B7F99", maxWidth: 320, margin: "0 auto 14px" }}>Text likho, photo attach karo, ya neeche se question choose karo</p>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6, justifyContent: "center" }}>
                  {currentSamples.map((q, i) => <button key={i} onClick={() => setDoubtInput(q)} style={{ padding: "6px 12px", borderRadius: 20, border: "1px solid #E8EFF8", background: "#FAFCFE", color: "#374151", fontSize: ".76rem", cursor: "pointer", transition: "all .15s" }} onMouseEnter={e => { e.currentTarget.style.background = "#ECFDF5"; e.currentTarget.style.borderColor = "#059669"; e.currentTarget.style.color = "#059669"; }} onMouseLeave={e => { e.currentTarget.style.background = "#FAFCFE"; e.currentTarget.style.borderColor = "#E8EFF8"; e.currentTarget.style.color = "#374151"; }}>{q}</button>)}
                </div>
              </div>}

              {doubtChat.map((msg, i) => <div key={i} className="fadeMsg" style={{ marginBottom: 16 }}>
                {msg.role === "user" ? (
                  /* User message — right aligned, blue */
                  <div style={{ display: "flex", justifyContent: "flex-end" }}>
                    <div style={{ maxWidth: "78%", padding: "10px 16px", borderRadius: "18px 18px 4px 18px", background: "linear-gradient(135deg,#1349A8,#2A6FE0)", color: "#fff" }}>
                      {msg.image && <div style={{ marginBottom: 8, borderRadius: 10, overflow: "hidden", maxWidth: 180 }}><img src={msg.image} alt="" style={{ width: "100%", borderRadius: 10 }} /></div>}
                      {msg.text && <div style={{ fontSize: ".88rem", lineHeight: 1.5 }}>{msg.text}</div>}
                      <div style={{ fontSize: ".6rem", opacity: .5, textAlign: "right", marginTop: 4 }}>{msg.time?.toLocaleTimeString?.("en-IN",{hour:"2-digit",minute:"2-digit"})}</div>
                    </div>
                  </div>
                ) : (
                  /* AI message — left aligned, clean */
                  <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                    <div style={{ width: 28, height: 28, borderRadius: 8, background: "linear-gradient(135deg,#059669,#10B981)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, marginTop: 2 }}><i className="fas fa-robot" style={{ color: "#fff", fontSize: ".6rem" }} /></div>
                    <div style={{ flex: 1, maxWidth: "85%" }}>
                      <div style={{ fontSize: ".68rem", fontWeight: 700, color: "#059669", marginBottom: 4 }}>AI Teacher</div>
                      <div style={{ padding: "12px 16px", borderRadius: "4px 18px 18px 18px", background: "#F8FAF9", border: "1px solid #E8F0EB", fontSize: ".88rem", lineHeight: 1.8, color: "#1a1a1a" }} className={isTyping && i === doubtChat.length - 1 ? "typCur" : ""}>
                        {renderText(msg.text)}
                      </div>
                      <div style={{ fontSize: ".6rem", color: "#9CA3AF", marginTop: 3 }}>{msg.time?.toLocaleTimeString?.("en-IN",{hour:"2-digit",minute:"2-digit"})}</div>
                    </div>
                  </div>
                )}
              </div>)}

              {/* Thinking indicator */}
              {doubtLoading && <div className="fadeMsg" style={{ display: "flex", gap: 10, alignItems: "flex-start", marginBottom: 16 }}>
                <div style={{ width: 28, height: 28, borderRadius: 8, background: "linear-gradient(135deg,#059669,#10B981)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><i className="fas fa-robot" style={{ color: "#fff", fontSize: ".6rem" }} /></div>
                <div>
                  <div style={{ fontSize: ".68rem", fontWeight: 700, color: "#059669", marginBottom: 4 }}>AI Teacher</div>
                  <div style={{ padding: "10px 16px", borderRadius: "4px 18px 18px 18px", background: "#F8FAF9", border: "1px solid #E8F0EB" }}>
                    <div style={{ display: "flex", gap: 5, marginBottom: 6 }}>{[0,.15,.3].map((d,i) => <div key={i} style={{ width: 8, height: 8, borderRadius: "50%", background: "#059669", animation: `blink .8s infinite ${d}s` }} />)}</div>
                    <div style={{ fontSize: ".78rem", color: "#059669", fontWeight: 500 }}>{thinkingText}</div>
                  </div>
                </div>
              </div>}
              <div ref={chatEndRef} />
            </div>

            {/* Image preview bar */}
            {doubtImagePreview && !showCrop && <div style={{ padding: "8px 14px", borderTop: "1px solid #E8F0EB", background: "#F8FAF9", display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ width: 48, height: 48, borderRadius: 8, overflow: "hidden", border: "1.5px solid #D4DEF0", flexShrink: 0 }}><img src={doubtImagePreview} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /></div>
              <div style={{ flex: 1, fontSize: ".78rem" }}><strong>Photo ready</strong><div style={{ fontSize: ".7rem", color: "#6B7F99" }}>Send karo ya crop karo</div></div>
              <button onClick={() => setShowCrop(true)} style={{ padding: "4px 10px", borderRadius: 6, border: "1px solid #D4DEF0", background: "#fff", fontSize: ".72rem", cursor: "pointer" }}><i className="fas fa-crop-alt" /></button>
              <button onClick={removeImage} style={{ background: "none", border: "none", color: "#DC2626", cursor: "pointer", fontSize: ".9rem" }}>✕</button>
            </div>}

            {/* ═══ INPUT BAR — ChatGPT Style ═══ */}
            <div style={{ borderTop: "1px solid #E8F0EB", padding: "10px 12px", background: "#FAFCFE" }}>
              {doubtError && <div style={{ fontSize: ".72rem", color: "#DC2626", marginBottom: 6 }}>{doubtError}</div>}
              <div style={{ display: "flex", gap: 8, alignItems: "flex-end", background: "#fff", border: "1.5px solid #D4DEF0", borderRadius: 14, padding: "6px 8px 6px 4px", transition: "border .2s" }}>
                {/* Attach button with popup menu */}
                <div style={{ position: "relative" }}>
                  <button onClick={(e) => { e.stopPropagation(); setShowAttachMenu(!showAttachMenu); }} style={{ width: 36, height: 36, borderRadius: 10, border: "none", background: "transparent", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: "#6B7F99", fontSize: "1.05rem", transition: "color .15s" }} onMouseEnter={e => e.currentTarget.style.color = "#059669"} onMouseLeave={e => e.currentTarget.style.color = "#6B7F99"} title="Attach">
                    <i className="fas fa-paperclip" />
                  </button>
                  {/* Attach popup */}
                  {showAttachMenu && <div className="slideIn" style={{ position: "absolute", bottom: 44, left: 0, background: "#fff", borderRadius: 12, boxShadow: "0 4px 20px rgba(0,0,0,.12)", border: "1px solid #E8EFF8", padding: 6, minWidth: 160, zIndex: 10 }} onClick={e => e.stopPropagation()}>
                    <button onClick={() => { camInputRef.current?.click(); }} style={{ width: "100%", padding: "10px 14px", border: "none", background: "transparent", cursor: "pointer", display: "flex", alignItems: "center", gap: 10, borderRadius: 8, fontSize: ".84rem", color: "#374151", textAlign: "left" }} onMouseEnter={e => e.currentTarget.style.background = "#F0FDF4"} onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                      <i className="fas fa-camera" style={{ color: "#059669", width: 18 }} /> Camera
                    </button>
                    <button onClick={() => { imgInputRef.current?.click(); }} style={{ width: "100%", padding: "10px 14px", border: "none", background: "transparent", cursor: "pointer", display: "flex", alignItems: "center", gap: 10, borderRadius: 8, fontSize: ".84rem", color: "#374151", textAlign: "left" }} onMouseEnter={e => e.currentTarget.style.background = "#EFF6FF"} onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                      <i className="fas fa-image" style={{ color: "#1349A8", width: 18 }} /> Gallery
                    </button>
                    <button onClick={() => { fileInputRef.current?.click(); }} style={{ width: "100%", padding: "10px 14px", border: "none", background: "transparent", cursor: "pointer", display: "flex", alignItems: "center", gap: 10, borderRadius: 8, fontSize: ".84rem", color: "#374151", textAlign: "left" }} onMouseEnter={e => e.currentTarget.style.background = "#FAF5FF"} onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                      <i className="fas fa-file-upload" style={{ color: "#7C3AED", width: 18 }} /> File
                    </button>
                  </div>}
                </div>

                {/* Auto-expanding textarea */}
                <textarea
                  ref={textareaRef}
                  style={{ flex: 1, border: "none", outline: "none", resize: "none", fontSize: ".88rem", fontFamily: "'DM Sans',sans-serif", lineHeight: 1.5, padding: "8px 4px", height: 44, maxHeight: 120, background: "transparent", color: "#1a1a1a" }}
                  placeholder="Apna doubt yahan likho..."
                  value={doubtInput}
                  onChange={handleTextareaInput}
                  onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); askDoubt(); } }}
                  disabled={doubtLoading || isTyping}
                  rows={1}
                />

                {/* Send button */}
                <button onClick={askDoubt} disabled={doubtLoading || isTyping || (!doubtInput.trim() && !doubtImage)} style={{ width: 36, height: 36, borderRadius: 10, border: "none", background: (doubtLoading || isTyping || (!doubtInput.trim() && !doubtImage)) ? "#E8EFF8" : "linear-gradient(135deg,#059669,#10B981)", color: "#fff", cursor: (doubtLoading || isTyping || (!doubtInput.trim() && !doubtImage)) ? "default" : "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, transition: "all .2s" }}>
                  <i className={doubtLoading ? "fas fa-spinner fa-spin" : "fas fa-arrow-up"} style={{ fontSize: ".85rem" }} />
                </button>
              </div>
            </div>
          </div>
        </>}

        {/* ═══ MATH GRAPH TOOL ═══ */}
        {activeTab === "graph" && <>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14, flexWrap: "wrap", gap: 8 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ width: 36, height: 36, borderRadius: 10, background: "#FEF2F2", display: "flex", alignItems: "center", justifyContent: "center" }}><i className="fas fa-chart-line" style={{ color: "#DC2626" }} /></div>
              <div><h2 style={{ fontSize: "1.1rem", fontWeight: 800, margin: 0 }}>Math Graph Tool</h2><p style={{ fontSize: ".7rem", color: "#6B7F99", margin: 0 }}>Plot equations like Desmos</p></div>
            </div>
            <div style={{ display: "flex", gap: 6 }}>
              <button onClick={resetGraph} style={{ ...s.btnGray, padding: "6px 12px", fontSize: ".74rem" }}><i className="fas fa-crosshairs" style={{ marginRight: 4 }} />Reset</button>
              <button onClick={() => setShowGrid(!showGrid)} style={{ ...s.btnGray, padding: "6px 12px", fontSize: ".74rem", background: showGrid ? "#EFF6FF" : "#F8FAFD", borderColor: showGrid ? "#1349A8" : "#D4DEF0", color: showGrid ? "#1349A8" : "#4A5E78" }}><i className="fas fa-th" style={{ marginRight: 4 }} />Grid</button>
            </div>
          </div>

          <div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
            {/* Equations Panel */}
            <div style={{ width: 280, flexShrink: 0 }}>
              <div style={{ ...s.card, padding: 14 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                  <span style={{ fontSize: ".85rem", fontWeight: 700 }}>Equations</span>
                  <button onClick={addEquation} disabled={equations.length >= 8} style={{ ...s.btnG, padding: "4px 10px", fontSize: ".72rem", opacity: equations.length >= 8 ? 0.5 : 1 }}><i className="fas fa-plus" /> Add</button>
                </div>
                {equations.map((eq, i) => (
                  <div key={i} style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
                    <div style={{ width: 14, height: 14, borderRadius: 4, background: eq.color, flexShrink: 0 }} />
                    <span style={{ fontSize: ".78rem", fontWeight: 700, color: "#6B7F99", width: 20 }}>y=</span>
                    <input
                      style={{ flex: 1, border: "2px solid " + (eq.expr.trim() ? eq.color + "60" : "#D4DEF0"), borderRadius: 8, padding: "8px 12px", fontSize: ".88rem", outline: "none", fontFamily: "'DM Sans', monospace", background: eq.expr.trim() ? eq.color + "08" : "#fff", fontWeight: 600, transition: "all .2s" }}
                      placeholder="x**2, sin(x)..."
                      value={eq.expr}
                      onChange={(e) => updateEquation(i, e.target.value)}
                      onFocus={() => setActiveEqIdx(i)}
                    />
                    {equations.length > 1 && <button onClick={() => removeEquation(i)} style={{ background: "none", border: "none", color: "#DC2626", cursor: "pointer", fontSize: ".8rem", flexShrink: 0 }}>✕</button>}
                  </div>
                ))}

                {/* Zoom control */}
                <div style={{ marginTop: 12, padding: "8px 0", borderTop: "1px solid #E8EFF8" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                    <span style={{ fontSize: ".75rem", color: "#6B7F99" }}>Zoom</span>
                    <span style={{ fontSize: ".72rem", color: "#6B7F99" }}>{graphZoom}px/unit</span>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <button onClick={() => setGraphZoom(z => Math.max(5, z - 10))} style={{ width: 28, height: 28, borderRadius: 6, border: "1px solid #D4DEF0", background: "#fff", cursor: "pointer", fontSize: ".8rem" }}>−</button>
                    <input type="range" min={5} max={200} value={graphZoom} onChange={(e) => setGraphZoom(+e.target.value)} style={{ flex: 1 }} />
                    <button onClick={() => setGraphZoom(z => Math.min(200, z + 10))} style={{ width: 28, height: 28, borderRadius: 6, border: "1px solid #D4DEF0", background: "#fff", cursor: "pointer", fontSize: ".8rem" }}>+</button>
                  </div>
                </div>

                {/* Quick templates */}
                <div style={{ marginTop: 12, paddingTop: 10, borderTop: "1px solid #E8EFF8" }}>
                  <span style={{ fontSize: ".75rem", fontWeight: 600, color: "#6B7F99", marginBottom: 6, display: "block" }}>Quick Equations</span>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                    {graphTemplates.map((t, i) => (
                      <button key={i} onClick={() => { const emptyIdx = equations.findIndex(e => !e.expr.trim()); if (emptyIdx >= 0) updateEquation(emptyIdx, t.expr); else if (equations.length < 8) setEquations([...equations, { expr: t.expr, color: graphColors[equations.length % graphColors.length] }]); }}
                        style={{ padding: "4px 8px", borderRadius: 6, border: "1px solid #E8EFF8", background: "#FAFCFE", fontSize: ".72rem", cursor: "pointer", color: "#374151" }}
                        onMouseEnter={e => { e.currentTarget.style.background = "#FEF2F2"; e.currentTarget.style.borderColor = "#DC2626"; }}
                        onMouseLeave={e => { e.currentTarget.style.background = "#FAFCFE"; e.currentTarget.style.borderColor = "#E8EFF8"; }}>
                        {t.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Help */}
                <div style={{ marginTop: 12, padding: 10, background: "#FFFBEB", borderRadius: 8, border: "1px solid #FDE68A" }}>
                  <div style={{ fontSize: ".72rem", fontWeight: 700, color: "#78350F", marginBottom: 4 }}>Syntax Help</div>
                  <div style={{ fontSize: ".68rem", color: "#92400E", lineHeight: 1.6 }}>
                    <strong>Power:</strong> x**2, x**3<br/>
                    <strong>Functions:</strong> sin(x), cos(x), tan(x)<br/>
                    <strong>Others:</strong> sqrt(x), abs(x), log(x)<br/>
                    <strong>Constants:</strong> pi, e<br/>
                    <strong>Mouse:</strong> Drag=Pan, Scroll=Zoom
                  </div>
                </div>
              </div>
            </div>

            {/* Graph Canvas */}
            <div style={{ flex: 1, minWidth: 300 }}>
              <div style={{ ...s.card, padding: 0, overflow: "hidden", borderRadius: 14, position: "relative" }}>
                <canvas
                  ref={canvasRef}
                  style={{ display: "block", cursor: isDragging ? "grabbing" : "grab", width: "100%", height: 420 }}
                  onMouseDown={handleGraphMouseDown}
                  onMouseMove={handleGraphMouseMove}
                  onMouseUp={handleGraphMouseUp}
                  onMouseLeave={handleGraphMouseUp}
                />
                {/* Zoom buttons — top right corner */}
                <div style={{ position: "absolute", top: 12, right: 12, display: "flex", flexDirection: "column", gap: 4 }}>
                  <button onClick={() => setGraphZoom(z => Math.min(200, z + 15))} style={{ width: 34, height: 34, borderRadius: 8, border: "1.5px solid #D4DEF0", background: "rgba(255,255,255,.92)", cursor: "pointer", fontSize: "1.1rem", fontWeight: 800, color: "#374151", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 2px 6px rgba(0,0,0,.08)" }} title="Zoom In">+</button>
                  <button onClick={() => setGraphZoom(z => Math.max(5, z - 15))} style={{ width: 34, height: 34, borderRadius: 8, border: "1.5px solid #D4DEF0", background: "rgba(255,255,255,.92)", cursor: "pointer", fontSize: "1.1rem", fontWeight: 800, color: "#374151", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 2px 6px rgba(0,0,0,.08)" }} title="Zoom Out">−</button>
                  <button onClick={resetGraph} style={{ width: 34, height: 34, borderRadius: 8, border: "1.5px solid #D4DEF0", background: "rgba(255,255,255,.92)", cursor: "pointer", fontSize: ".75rem", color: "#374151", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 2px 6px rgba(0,0,0,.08)" }} title="Reset View"><i className="fas fa-crosshairs" /></button>
                </div>
                {/* Coordinates display — bottom left */}
                <div style={{ position: "absolute", bottom: 8, left: 10, background: "rgba(255,255,255,.88)", borderRadius: 6, padding: "3px 8px", fontSize: ".68rem", color: "#6B7F99", boxShadow: "0 1px 4px rgba(0,0,0,.06)" }}>
                  Zoom: {graphZoom}x · Center: ({graphCenter.x.toFixed(1)}, {graphCenter.y.toFixed(1)})
                </div>
              </div>

              {/* Legend */}
              {equations.some(e => e.expr.trim()) && <div style={{ display: "flex", gap: 12, marginTop: 8, flexWrap: "wrap" }}>
                {equations.filter(e => e.expr.trim()).map((eq, i) => (
                  <div key={i} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: ".78rem", color: "#374151" }}>
                    <div style={{ width: 16, height: 3, borderRadius: 2, background: eq.color }} />
                    <span>y = {eq.expr}</span>
                  </div>
                ))}
              </div>}
            </div>
          </div>

          {/* ═══ MATH KEYBOARD ═══ */}
          <div style={{ ...s.card, marginTop: 14, padding: 14 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <i className="fas fa-keyboard" style={{ color: "#7C3AED" }} />
                <span style={{ fontSize: ".85rem", fontWeight: 700 }}>Math Keyboard</span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: ".75rem", color: "#6B7F99" }}>
                <span>Typing in:</span>
                <select value={activeEqIdx} onChange={(e) => setActiveEqIdx(+e.target.value)} style={{ border: "1px solid #D4DEF0", borderRadius: 6, padding: "3px 8px", fontSize: ".75rem", outline: "none" }}>
                  {equations.map((eq, i) => <option key={i} value={i}>Equation {i + 1}</option>)}
                </select>
              </div>
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
              {mathKeys.map((key, i) => (
                <button key={i} onClick={() => insertToEquation(key.insert)}
                  style={{ minWidth: 44, height: 38, borderRadius: 8, border: "1.5px solid #D4DEF0", background: "#fff", cursor: "pointer", fontSize: ".82rem", fontWeight: 600, color: "#374151", display: "flex", alignItems: "center", justifyContent: "center", transition: "all .15s", fontFamily: "'DM Sans', monospace" }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = "#FAF5FF"; e.currentTarget.style.borderColor = "#7C3AED"; e.currentTarget.style.color = "#7C3AED"; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = "#fff"; e.currentTarget.style.borderColor = "#D4DEF0"; e.currentTarget.style.color = "#374151"; }}>
                  {key.label}
                </button>
              ))}
              {/* Backspace */}
              <button onClick={() => { const eq = [...equations]; eq[activeEqIdx] = { ...eq[activeEqIdx], expr: eq[activeEqIdx].expr.slice(0, -1) }; setEquations(eq); }}
                style={{ minWidth: 44, height: 38, borderRadius: 8, border: "1.5px solid #FCA5A5", background: "#FEF2F2", cursor: "pointer", fontSize: ".82rem", fontWeight: 600, color: "#DC2626", display: "flex", alignItems: "center", justifyContent: "center" }}
                title="Backspace">
                <i className="fas fa-backspace" />
              </button>
              {/* Clear */}
              <button onClick={() => updateEquation(activeEqIdx, "")}
                style={{ minWidth: 44, height: 38, borderRadius: 8, border: "1.5px solid #D4DEF0", background: "#F8FAFD", cursor: "pointer", fontSize: ".72rem", fontWeight: 600, color: "#6B7F99", display: "flex", alignItems: "center", justifyContent: "center" }}
                title="Clear">
                CLR
              </button>
            </div>
          </div>
        </>}
      </div>

      <div style={{ textAlign: "center", padding: "24px 20px", borderTop: "1px solid #D4DEF0", marginTop: 40 }}><p style={{ fontSize: ".76rem", color: "#6B7F99", margin: 0 }}>© {new Date().getFullYear()} Patel Institute Dongargaon</p></div>
    </div>
  );
}