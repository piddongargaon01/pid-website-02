"use client";
import { useState, useEffect } from "react";
import { db, auth, googleProvider } from "../firebase";
import { collection, query, where, onSnapshot, getDocs, orderBy, addDoc, serverTimestamp } from "firebase/firestore";
import { signInWithPopup, onAuthStateChanged, signOut } from "firebase/auth";

// ─── ICONS (SVG inline) ──────────────────────────────────────────────────────
const Icon = ({ name, size = 20, color = "currentColor" }) => {
  const icons = {
    home: <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/>,
    attendance: <><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></>,
    chart: <><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></>,
    bell: <><path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 01-3.46 0"/></>,
    user: <><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></>,
    check: <polyline points="20 6 9 17 4 12"/>,
    x: <><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></>,
    trending_up: <><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></>,
    trending_down: <><polyline points="23 18 13.5 8.5 8.5 13.5 1 6"/><polyline points="17 18 23 18 23 12"/></>,
    clock: <><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></>,
    trophy: <><path d="M6 9H4.5a2.5 2.5 0 010-5H6"/><path d="M18 9h1.5a2.5 2.5 0 000-5H18"/><path d="M4 22h16"/><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20 7 22"/><path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20 17 22"/><path d="M18 2H6v7a6 6 0 0012 0V2z"/></>,
    star: <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>,
    rfid: <><rect x="2" y="5" width="20" height="14" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/></>,
    star: <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>,
    arrow_right: <><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></>,
    shield: <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>,
    rupee: <><line x1="6" y1="4" x2="18" y2="4"/><line x1="6" y1="9" x2="18" y2="9"/><path d="M9 4v1a4 4 0 004 4h1"/><path d="M13 9l-4 11"/></>,
    google: <><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></>,
  };
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      {icons[name]}
    </svg>
  );
};

// ─── CIRCULAR PROGRESS ───────────────────────────────────────────────────────
const CircularProgress = ({ value, size = 100, stroke = 8, color = "#3b82f6" }) => {
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ - (value / 100) * circ;
  return (
    <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="#e8f0fe" strokeWidth={stroke}/>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth={stroke}
        strokeDasharray={circ} strokeDashoffset={offset} strokeLinecap="round"
        style={{ transition: "stroke-dashoffset 1s ease" }}/>
    </svg>
  );
};

// ─── NOTIFICATION BADGE ──────────────────────────────────────────────────────
const Badge = ({ count }) => count > 0 ? (
  <span style={{ position: "absolute", top: -4, right: -4, background: "#ef4444", color: "#fff", borderRadius: "50%", width: 16, height: 16, fontSize: 10, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700 }}>{count}</span>
) : null;

// ─── HELPER: Format time ─────────────────────────────────────────────────────
function fmtTime(ts) {
  if (!ts) return "—";
  const d = new Date(ts);
  return d.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true });
}
function fmtDate(ts) {
  if (!ts) return "";
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}
function getDayName(dateStr) {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("en-IN", { weekday: "short" });
}
function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good Morning";
  if (h < 17) return "Good Afternoon";
  return "Good Evening";
}

// ─── SCREEN: LOGIN (Gmail) ───────────────────────────────────────────────────
const LoginScreen = ({ onLogin, loading: authLoading }) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleGmailLogin = async () => {
    setLoading(true);
    setError("");
    try {
      await signInWithPopup(auth, googleProvider);
      // onAuthStateChanged will handle the rest
    } catch (e) {
      if (e.code === "auth/popup-closed-by-user") {
        setError("Login cancelled. Try again.");
      } else {
        setError("Login failed: " + e.message);
      }
      setLoading(false);
    }
  };

  return (
    <div style={{ minHeight: "100%", background: "linear-gradient(145deg, #0f172a 0%, #1e3a5f 50%, #1e40af 100%)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 24 }}>
      {/* Logo */}
      <div style={{ textAlign: "center", marginBottom: 40 }}>
        <div style={{ width: 80, height: 80, borderRadius: 24, background: "linear-gradient(135deg, #3b82f6, #1d4ed8)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px", boxShadow: "0 8px 32px rgba(59,130,246,0.4)" }}>
          <span style={{ fontSize: 32, fontWeight: 900, color: "#fff", fontFamily: "Georgia, serif" }}>PID</span>
        </div>
        <h1 style={{ color: "#fff", fontSize: 24, fontWeight: 800, margin: 0, letterSpacing: -0.5 }}>PID Parent App</h1>
        <p style={{ color: "#93c5fd", fontSize: 13, margin: "6px 0 0", letterSpacing: 0.5 }}>Track Your Child&apos;s Learning Journey</p>
      </div>

      {/* Login Card */}
      <div style={{ background: "#fff", borderRadius: 24, padding: 28, width: "100%", maxWidth: 360, boxShadow: "0 24px 60px rgba(0,0,0,0.3)" }}>
        <h2 style={{ fontSize: 18, fontWeight: 700, color: "#1e293b", margin: "0 0 6px" }}>Parent Login</h2>
        <p style={{ fontSize: 13, color: "#64748b", margin: "0 0 24px" }}>
          Sign in with the Gmail registered during admission
        </p>

        {error && (
          <div style={{ background: "#FEF2F2", border: "1px solid #FCA5A5", borderRadius: 10, padding: "10px 14px", marginBottom: 16, fontSize: 12, color: "#DC2626" }}>
            {error}
          </div>
        )}

        <button onClick={handleGmailLogin} disabled={loading || authLoading}
          style={{ width: "100%", padding: "14px", background: loading ? "#e2e8f0" : "#fff", color: "#1e293b", border: "2px solid #e2e8f0", borderRadius: 12, fontSize: 15, fontWeight: 700, cursor: loading ? "not-allowed" : "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 10, transition: "all .2s" }}>
          {loading ? (
            <span>Signing in...</span>
          ) : (
            <>
              <svg width="20" height="20" viewBox="0 0 24 24">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
              </svg>
              Sign in with Google
            </>
          )}
        </button>

        <div style={{ marginTop: 24, padding: "12px", background: "#eff6ff", borderRadius: 10, display: "flex", gap: 8, alignItems: "center" }}>
          <Icon name="shield" size={16} color="#3b82f6"/>
          <p style={{ fontSize: 12, color: "#1d4ed8", margin: 0, fontWeight: 500 }}>Patel Institute Dongargaon – Secure Parent Portal</p>
        </div>
      </div>

      <p style={{ color: "#64748b", fontSize: 11, marginTop: 20 }}>Use parent Gmail given at admission time</p>
    </div>
  );
};

// ─── SCREEN: NOT FOUND ───────────────────────────────────────────────────────
const NotFoundScreen = ({ email, onLogout }) => (
  <div style={{ minHeight: "100%", background: "linear-gradient(145deg, #0f172a 0%, #1e3a5f 50%, #1e40af 100%)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 24 }}>
    <div style={{ background: "#fff", borderRadius: 24, padding: 28, width: "100%", maxWidth: 360, boxShadow: "0 24px 60px rgba(0,0,0,0.3)", textAlign: "center" }}>
      <div style={{ width: 64, height: 64, borderRadius: 20, background: "#FEF2F2", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px" }}>
        <Icon name="x" size={28} color="#DC2626"/>
      </div>
      <h2 style={{ fontSize: 18, fontWeight: 700, color: "#1e293b", margin: "0 0 8px" }}>Student Not Found</h2>
      <p style={{ fontSize: 13, color: "#64748b", margin: "0 0 8px" }}>No student is linked to:</p>
      <p style={{ fontSize: 14, fontWeight: 700, color: "#1349A8", margin: "0 0 20px" }}>{email}</p>
      <p style={{ fontSize: 12, color: "#94a3b8", margin: "0 0 24px", lineHeight: 1.6 }}>
        Please ask the institute to add your Gmail as Parent Email in the admission form.
      </p>
      <button onClick={onLogout} style={{ width: "100%", padding: "14px", background: "linear-gradient(135deg,#DC2626,#B91C1C)", color: "#fff", border: "none", borderRadius: 12, fontSize: 15, fontWeight: 700, cursor: "pointer" }}>
        Logout & Try Different Account
      </button>
    </div>
  </div>
);

// ─── SCREEN: DASHBOARD ───────────────────────────────────────────────────────
const DashboardScreen = ({ navigate, student, attendance, notices, holidays }) => {
  const today = new Date().toISOString().split("T")[0];
  const todayAtt = attendance.filter(a => a.date === today && a.studentId === student.id);
  const checkIn = todayAtt.find(a => a.type === "in");
  const checkOut = todayAtt.find(a => a.type === "out");
  const isPresent = !!checkIn;

  // Monthly stats
  const now = new Date();
  const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
  const monthAtt = attendance.filter(a => a.date >= monthStart && a.studentId === student.id);
  const holidayDates = new Set(holidays.map(h => h.date));
  
  // Count working days this month
  let workingDays = 0;
  for (let d = 1; d <= now.getDate(); d++) {
    const dateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    const dayOfWeek = new Date(dateStr + "T00:00:00").getDay();
    if (dayOfWeek !== 0 && !holidayDates.has(dateStr)) workingDays++;
  }
  const presentDays = new Set(monthAtt.filter(a => a.type === "in").map(a => a.date)).size;
  const absentDays = Math.max(0, workingDays - presentDays);
  const attPercentage = workingDays > 0 ? Math.round((presentDays / workingDays) * 100) : 0;
  const urgentNotices = notices.filter(n => n.notifType === "fee" || n.notifType === "test").length;

  // Fee info
  const totalFee = Number(student.totalFee || 0);
  const feePaid = Number(student.enrollmentFeePaid || 0);
  const feeDue = Math.max(0, totalFee - feePaid);

  return (
    <div style={{ padding: "0 16px 20px" }}>
      {/* Header */}
      <div style={{ background: "linear-gradient(135deg, #1e3a5f 0%, #1d4ed8 100%)", margin: "0 -16px", padding: "20px 20px 60px", borderRadius: "0 0 28px 28px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div>
            <p style={{ color: "#93c5fd", fontSize: 12, margin: 0, fontWeight: 500 }}>{getGreeting()} 👋</p>
            <h2 style={{ color: "#fff", fontSize: 20, fontWeight: 800, margin: "4px 0 0" }}>{student.fatherName || student.parentName || "Parent"}</h2>
          </div>
          <div style={{ position: "relative" }}>
            <div onClick={() => navigate("notices")} style={{ width: 40, height: 40, borderRadius: 12, background: "rgba(255,255,255,0.15)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
              <Icon name="bell" size={20} color="#fff"/>
              <Badge count={urgentNotices}/>
            </div>
          </div>
        </div>
      </div>

      {/* Student Card */}
      <div onClick={() => navigate("profile")} style={{ background: "#fff", borderRadius: 20, padding: "16px 20px", boxShadow: "0 8px 30px rgba(30,58,95,0.15)", marginTop: -40, cursor: "pointer", display: "flex", alignItems: "center", gap: 14 }}>
        <div style={{ width: 52, height: 52, borderRadius: 16, overflow: "hidden", background: "linear-gradient(135deg, #3b82f6, #1d4ed8)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
          {student.photo && student.photo.startsWith("http") ? (
            <img src={student.photo} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }}/>
          ) : (
            <span style={{ color: "#fff", fontWeight: 800, fontSize: 20 }}>{student.studentName?.charAt(0)}</span>
          )}
        </div>
        <div style={{ flex: 1 }}>
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: "#1e293b" }}>{student.studentName}</h3>
          <p style={{ margin: "3px 0 0", fontSize: 12, color: "#64748b" }}>Class {student.class} • {student.board} • {student.formNo || ""}</p>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
          <div style={{ width: 8, height: 8, borderRadius: "50%", background: student.rfidCode ? "#10b981" : "#ef4444" }}/>
          <span style={{ fontSize: 11, color: student.rfidCode ? "#10b981" : "#ef4444", fontWeight: 600 }}>{student.rfidCode ? "RFID" : "No RFID"}</span>
        </div>
      </div>

      {/* Today Status + Fee */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 16 }}>
        <div style={{ background: isPresent ? "#f0fdf4" : "#fff1f2", borderRadius: 16, padding: "14px 16px", border: `1.5px solid ${isPresent ? "#bbf7d0" : "#fecdd3"}` }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
            <Icon name={isPresent ? "check" : "x"} size={16} color={isPresent ? "#16a34a" : "#dc2626"}/>
            <span style={{ fontSize: 11, fontWeight: 600, color: isPresent ? "#16a34a" : "#dc2626" }}>TODAY</span>
          </div>
          <p style={{ margin: 0, fontSize: 17, fontWeight: 800, color: "#1e293b" }}>{isPresent ? "Present" : "Absent"}</p>
          <p style={{ margin: "4px 0 0", fontSize: 11, color: "#64748b" }}>{checkIn ? `${fmtTime(checkIn.timestamp)}${checkOut ? " – " + fmtTime(checkOut.timestamp) : ""}` : "Not checked in"}</p>
        </div>
        <div style={{ background: feeDue > 0 ? "#fffbeb" : "#f0fdf4", borderRadius: 16, padding: "14px 16px", border: `1.5px solid ${feeDue > 0 ? "#fde68a" : "#bbf7d0"}` }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
            <Icon name="rupee" size={16} color={feeDue > 0 ? "#d97706" : "#16a34a"}/>
            <span style={{ fontSize: 11, fontWeight: 600, color: feeDue > 0 ? "#d97706" : "#16a34a" }}>FEE STATUS</span>
          </div>
          <p style={{ margin: 0, fontSize: 17, fontWeight: 800, color: "#1e293b" }}>{feeDue > 0 ? `₹${feeDue.toLocaleString("en-IN")}` : "All Paid"}</p>
          <p style={{ margin: "4px 0 0", fontSize: 11, color: "#64748b" }}>{feeDue > 0 ? "Due amount" : "No pending dues"}</p>
        </div>
      </div>

      {/* Monthly Attendance */}
      <div style={{ background: "#fff", borderRadius: 20, padding: 18, marginTop: 12, boxShadow: "0 2px 12px rgba(0,0,0,0.06)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
          <h4 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: "#1e293b" }}>Monthly Attendance</h4>
          <button onClick={() => navigate("attendance")} style={{ background: "none", border: "none", color: "#3b82f6", fontSize: 12, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", gap: 4 }}>
            View All <Icon name="arrow_right" size={12} color="#3b82f6"/>
          </button>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
          <div style={{ position: "relative", width: 80, height: 80, flexShrink: 0 }}>
            <CircularProgress value={attPercentage} size={80} stroke={7} color={attPercentage >= 75 ? "#10b981" : "#ef4444"}/>
            <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <span style={{ fontSize: 16, fontWeight: 800, color: "#1e293b", lineHeight: 1 }}>{attPercentage}%</span>
            </div>
          </div>
          <div style={{ flex: 1 }}>
            {[["Present", presentDays, "#10b981"], ["Absent", absentDays, "#ef4444"], ["Working Days", workingDays, "#3b82f6"]].map(([label, val, color]) => (
              <div key={label} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <div style={{ width: 8, height: 8, borderRadius: "50%", background: color }}/>
                  <span style={{ fontSize: 12, color: "#64748b" }}>{label}</span>
                </div>
                <span style={{ fontSize: 12, fontWeight: 700, color: "#1e293b" }}>{val}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Performance Quick Card */}
      <div onClick={() => navigate("performance")} style={{ background: "linear-gradient(135deg, #4c1d95, #7c3aed)", borderRadius: 20, padding: 18, marginTop: 12, cursor: "pointer", display: "flex", alignItems: "center", gap: 14 }}>
        <div style={{ width: 44, height: 44, borderRadius: 14, background: "rgba(255,255,255,.15)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
          <Icon name="trophy" size={22} color="#fbbf24"/>
        </div>
        <div style={{ flex: 1 }}>
          <h4 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: "#fff" }}>Academic Performance</h4>
          <p style={{ margin: "2px 0 0", fontSize: 11, color: "#c4b5fd" }}>Test results, marks, class ranking dekho →</p>
        </div>
        <Icon name="arrow_right" size={18} color="#c4b5fd"/>
      </div>

      {/* Latest Notices */}
      <div style={{ background: "#fff", borderRadius: 20, padding: 18, marginTop: 12, boxShadow: "0 2px 12px rgba(0,0,0,0.06)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
          <h4 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: "#1e293b" }}>Latest Notices</h4>
          <button onClick={() => navigate("notices")} style={{ background: "none", border: "none", color: "#3b82f6", fontSize: 12, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", gap: 4 }}>
            View All <Icon name="arrow_right" size={12} color="#3b82f6"/>
          </button>
        </div>
        {notices.length > 0 ? notices.slice(0, 3).map(n => (
          <div key={n.id} style={{ padding: "10px 12px", background: n.notifType === "fee" ? "#fff7ed" : "#f8fafc", borderRadius: 12, marginBottom: 8, borderLeft: `3px solid ${n.notifType === "fee" ? "#f97316" : n.notifType === "test" ? "#8b5cf6" : "#cbd5e1"}` }}>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: "#1e293b" }}>{n.message?.substring(0, 50)}{n.message?.length > 50 ? "..." : ""}</p>
            </div>
            <p style={{ margin: "4px 0 0", fontSize: 11, color: "#94a3b8" }}>{n.notifType || "General"} • {n.date}</p>
          </div>
        )) : (
          <p style={{ fontSize: 13, color: "#94a3b8", textAlign: "center", padding: 20 }}>No notices yet</p>
        )}
      </div>

      {/* Batch Validity */}
      {student.batchStartDate && student.batchEndDate && (
        <div style={{ background: "linear-gradient(135deg, #7c3aed, #4f46e5)", borderRadius: 20, padding: 18, marginTop: 12 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ width: 44, height: 44, borderRadius: 12, background: "rgba(255,255,255,0.2)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Icon name="star" size={22} color="#fff"/>
            </div>
            <div>
              <p style={{ margin: 0, fontSize: 11, color: "#c4b5fd", fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.5 }}>Batch Validity</p>
              <p style={{ margin: "3px 0 0", fontSize: 16, fontWeight: 800, color: "#fff" }}>{student.batchStartDate} → {student.batchEndDate}</p>
              <p style={{ margin: "2px 0 0", fontSize: 12, color: "#ddd6fe" }}>
                {new Date().toISOString().split("T")[0] <= student.batchEndDate ? "Active Batch" : "Batch Expired"}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// ─── SCREEN: ATTENDANCE ──────────────────────────────────────────────────────
const AttendanceScreen = ({ student, attendance, holidays, leaveApplications = [] }) => {
  const [weekOffset, setWeekOffset] = useState(0);
  const [viewMode, setViewMode] = useState("weekly"); // weekly | monthly | leave
  const [calMonth, setCalMonth] = useState(new Date().getMonth());
  const [calYear, setCalYear] = useState(new Date().getFullYear());
  const [showLeaveForm, setShowLeaveForm] = useState(false);
  const [leaveForm, setLeaveForm] = useState({ date: new Date().toISOString().split("T")[0], reason: "", leaveType: "full_day" });
  const [leaveSaving, setLeaveSaving] = useState(false);
  const [leaveMsg, setLeaveMsg] = useState("");
  const [calSelectedDate, setCalSelectedDate] = useState(null); // for calendar date click

  const now = new Date();
  const holidayDates = new Set(holidays.map(h => h.date));

  // Weekly dates helper
  const getWeekDates = (offset) => {
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
  };

  const weekDates = getWeekDates(weekOffset);
  const weekLabel = `${new Date(weekDates[0]).toLocaleDateString("en-IN", { day: "2-digit", month: "short" })} — ${new Date(weekDates[6]).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}`;

  // Monthly stats (current month for summary)
  const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
  const monthAtt = attendance.filter(a => a.date >= monthStart && a.studentId === student.id);
  let workingDays = 0;
  for (let d = 1; d <= now.getDate(); d++) {
    const dateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    const dayOfWeek = new Date(dateStr + "T00:00:00").getDay();
    if (dayOfWeek !== 0 && !holidayDates.has(dateStr)) workingDays++;
  }
  const presentDays = new Set(monthAtt.filter(a => a.type === "in").map(a => a.date)).size;
  const absentDays = Math.max(0, workingDays - presentDays);
  const attPercentage = workingDays > 0 ? Math.round((presentDays / workingDays) * 100) : 0;

  return (
    <div style={{ padding: "0 16px 20px" }}>
      {/* Summary */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10, marginTop: 8 }}>
        {[["Present", presentDays, "#10b981", "#f0fdf4"], ["Absent", absentDays, "#ef4444", "#fff1f2"], ["%", `${attPercentage}%`, "#3b82f6", "#eff6ff"]].map(([label, val, color, bg]) => (
          <div key={label} style={{ background: bg, borderRadius: 14, padding: "12px 10px", textAlign: "center", border: `1.5px solid ${color}22` }}>
            <p style={{ margin: 0, fontSize: 20, fontWeight: 800, color }}>{val}</p>
            <p style={{ margin: "4px 0 0", fontSize: 11, color: "#64748b", fontWeight: 600 }}>{label}</p>
          </div>
        ))}
      </div>

      {/* View Mode Toggle */}
      <div style={{ display: "flex", gap: 4, marginTop: 14, background: "#f1f5f9", borderRadius: 12, padding: 4 }}>
        <button onClick={() => setViewMode("weekly")} style={{ flex: 1, padding: "10px 0", borderRadius: 10, border: "none", background: viewMode === "weekly" ? "#fff" : "transparent", color: viewMode === "weekly" ? "#2563eb" : "#94a3b8", fontSize: 12, fontWeight: 700, cursor: "pointer", boxShadow: viewMode === "weekly" ? "0 2px 8px rgba(0,0,0,.06)" : "none" }}>📅 Weekly</button>
        <button onClick={() => setViewMode("monthly")} style={{ flex: 1, padding: "10px 0", borderRadius: 10, border: "none", background: viewMode === "monthly" ? "#fff" : "transparent", color: viewMode === "monthly" ? "#2563eb" : "#94a3b8", fontSize: 12, fontWeight: 700, cursor: "pointer", boxShadow: viewMode === "monthly" ? "0 2px 8px rgba(0,0,0,.06)" : "none" }}>📆 Monthly</button>
        <button onClick={() => setViewMode("leave")} style={{ flex: 1, padding: "10px 0", borderRadius: 10, border: "none", background: viewMode === "leave" ? "#fff" : "transparent", color: viewMode === "leave" ? "#f59e0b" : "#94a3b8", fontSize: 12, fontWeight: 700, cursor: "pointer", boxShadow: viewMode === "leave" ? "0 2px 8px rgba(0,0,0,.06)" : "none" }}>📝 Leave</button>
      </div>

      {/* ═══ WEEKLY VIEW ═══ */}
      {viewMode === "weekly" && (
        <div style={{ background: "#fff", borderRadius: 20, padding: 18, marginTop: 14, boxShadow: "0 2px 12px rgba(0,0,0,0.06)" }}>
          {/* Week Navigation */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
            <button onClick={() => setWeekOffset(weekOffset - 1)} style={{ width: 34, height: 34, borderRadius: 10, border: "1px solid #e2e8f0", background: "#f8fafc", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, color: "#475569" }}>◀</button>
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: "#1e293b" }}>{weekLabel}</div>
              <div style={{ fontSize: 10, color: "#94a3b8" }}>{weekOffset === 0 ? "This Week" : weekOffset === -1 ? "Last Week" : `${Math.abs(weekOffset)} weeks ${weekOffset < 0 ? "ago" : "ahead"}`}</div>
            </div>
            <button onClick={() => setWeekOffset(weekOffset + 1)} style={{ width: 34, height: 34, borderRadius: 10, border: "1px solid #e2e8f0", background: "#f8fafc", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, color: "#475569" }}>▶</button>
          </div>
          {weekOffset !== 0 && <div style={{ textAlign: "center", marginBottom: 10 }}><button onClick={() => setWeekOffset(0)} style={{ fontSize: 11, color: "#2563eb", background: "#eff6ff", border: "1px solid #bfdbfe", borderRadius: 8, padding: "4px 12px", cursor: "pointer", fontWeight: 600 }}>Today</button></div>}

          {/* Weekly Table */}
          <div style={{ display: "grid", gridTemplateColumns: "60px 50px 1fr 1fr 60px", gap: 6, padding: "6px 8px", background: "#f8fafc", borderRadius: 8, marginBottom: 4 }}>
            {["Date", "Day", "In", "Out", "Status"].map(h => <span key={h} style={{ fontSize: 9, fontWeight: 700, color: "#94a3b8", textTransform: "uppercase" }}>{h}</span>)}
          </div>
          {weekDates.map((dateStr, i) => {
            const dt = new Date(dateStr + "T00:00:00");
            const isSun = dt.getDay() === 0;
            const isHol = holidayDates.has(dateStr);
            const isFuture = dateStr > now.toISOString().split("T")[0];
            const dayAtt = attendance.filter(a => a.date === dateStr && a.studentId === student.id);
            const checkIn = dayAtt.find(a => a.type === "in");
            const checkOut = dayAtt.find(a => a.type === "out");
            const status = isSun ? "Sun" : isHol ? "Holiday" : isFuture ? "—" : checkIn ? "Present" : "Absent";
            const statusColor = status === "Present" ? "#16a34a" : status === "Absent" ? "#dc2626" : status === "Holiday" ? "#d97706" : "#94a3b8";
            const statusBg = status === "Present" ? "#f0fdf4" : status === "Absent" ? "#fff1f2" : status === "Holiday" ? "#fffbeb" : status === "Sun" ? "#faf5ff" : "#f8fafc";
            return (
              <div key={dateStr} style={{ display: "grid", gridTemplateColumns: "60px 50px 1fr 1fr 60px", gap: 6, padding: "10px 8px", borderBottom: i < 6 ? "1px solid #f1f5f9" : "none", alignItems: "center", background: dateStr === now.toISOString().split("T")[0] ? "#eff6ff" : "transparent", borderRadius: dateStr === now.toISOString().split("T")[0] ? 8 : 0 }}>
                <div>
                  <p style={{ margin: 0, fontSize: 12, fontWeight: 700, color: "#1e293b" }}>{dt.getDate()} {dt.toLocaleDateString("en-IN", { month: "short" })}</p>
                </div>
                <span style={{ fontSize: 10, color: isSun ? "#7c3aed" : "#94a3b8", fontWeight: 600 }}>{["Sun","Mon","Tue","Wed","Thu","Fri","Sat"][dt.getDay()]}</span>
                <span style={{ fontSize: 11, color: "#475569" }}>{checkIn ? fmtTime(checkIn.timestamp) : "—"}</span>
                <span style={{ fontSize: 11, color: "#475569" }}>{checkOut ? fmtTime(checkOut.timestamp) : "—"}</span>
                <span style={{ fontSize: 10, fontWeight: 700, color: statusColor, background: statusBg, padding: "3px 6px", borderRadius: 6, textAlign: "center" }}>{status === "Present" ? "P" : status === "Absent" ? "A" : status === "Holiday" ? "H" : status === "Sun" ? "S" : "—"}</span>
              </div>
            );
          })}
        </div>
      )}

      {/* ═══ MONTHLY CALENDAR VIEW ═══ */}
      {viewMode === "monthly" && (
        <div style={{ background: "#fff", borderRadius: 20, padding: 18, marginTop: 14, boxShadow: "0 2px 12px rgba(0,0,0,0.06)" }}>
          {/* Month Navigation */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
            <button onClick={() => { if (calMonth === 0) { setCalMonth(11); setCalYear(calYear - 1); } else setCalMonth(calMonth - 1); }} style={{ width: 34, height: 34, borderRadius: 10, border: "1px solid #e2e8f0", background: "#f8fafc", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, color: "#475569" }}>◀</button>
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: 14, fontWeight: 800, color: "#1e293b" }}>{new Date(calYear, calMonth).toLocaleDateString("en-IN", { month: "long", year: "numeric" })}</div>
            </div>
            <button onClick={() => { if (calMonth === 11) { setCalMonth(0); setCalYear(calYear + 1); } else setCalMonth(calMonth + 1); }} style={{ width: 34, height: 34, borderRadius: 10, border: "1px solid #e2e8f0", background: "#f8fafc", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, color: "#475569" }}>▶</button>
          </div>

          {/* Month Stats */}
          {(() => {
            const daysInMonth = new Date(calYear, calMonth + 1, 0).getDate();
            const todayStr = now.toISOString().split("T")[0];
            let mP = 0, mA = 0, mH = 0, mW = 0;
            for (let d = 1; d <= daysInMonth; d++) {
              const ds = `${calYear}-${String(calMonth + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
              if (ds > todayStr) continue;
              const isSun = new Date(ds + "T00:00:00").getDay() === 0;
              const isHol = holidayDates.has(ds);
              if (isSun || isHol) { mH++; continue; }
              mW++;
              const hasIn = attendance.some(a => a.date === ds && a.studentId === student.id && a.type === "in");
              if (hasIn) mP++; else mA++;
            }
            const mPct = mW > 0 ? Math.round((mP / mW) * 100) : 0;
            return (
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 6, marginBottom: 12 }}>
                <div style={{ textAlign: "center", padding: 6, borderRadius: 8, background: "#f0fdf4" }}><div style={{ fontSize: 16, fontWeight: 800, color: "#16a34a" }}>{mP}</div><div style={{ fontSize: 9, color: "#64748b" }}>Present</div></div>
                <div style={{ textAlign: "center", padding: 6, borderRadius: 8, background: "#fff1f2" }}><div style={{ fontSize: 16, fontWeight: 800, color: "#dc2626" }}>{mA}</div><div style={{ fontSize: 9, color: "#64748b" }}>Absent</div></div>
                <div style={{ textAlign: "center", padding: 6, borderRadius: 8, background: "#fffbeb" }}><div style={{ fontSize: 16, fontWeight: 800, color: "#d97706" }}>{mH}</div><div style={{ fontSize: 9, color: "#64748b" }}>Holiday</div></div>
                <div style={{ textAlign: "center", padding: 6, borderRadius: 8, background: "#eff6ff" }}><div style={{ fontSize: 16, fontWeight: 800, color: "#2563eb" }}>{mPct}%</div><div style={{ fontSize: 9, color: "#64748b" }}>Score</div></div>
              </div>
            );
          })()}

          {/* Legend */}
          <div style={{ display: "flex", gap: 10, marginBottom: 8, fontSize: 9, justifyContent: "center", flexWrap: "wrap" }}>
            {[["P", "#dcfce7", "#16a34a"], ["A", "#fee2e2", "#dc2626"], ["H", "#fef3c7", "#d97706"], ["S", "#f3e8ff", "#7c3aed"], ["—", "#f1f5f9", "#94a3b8"]].map(([l, bg, c]) => (
              <span key={l} style={{ display: "flex", alignItems: "center", gap: 3 }}><span style={{ width: 12, height: 12, borderRadius: 3, background: bg, border: `1px solid ${c}33`, display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 7, fontWeight: 700, color: c }}>{l}</span>{l === "P" ? "Present" : l === "A" ? "Absent" : l === "H" ? "Holiday" : l === "S" ? "Sunday" : "Future"}</span>
            ))}
          </div>

          {/* Calendar Grid */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 3 }}>
            {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map(d => (
              <div key={d} style={{ textAlign: "center", fontSize: 9, fontWeight: 700, color: d === "Sun" ? "#dc2626" : "#94a3b8", padding: "4px 0" }}>{d}</div>
            ))}
            {(() => {
              const daysInMonth = new Date(calYear, calMonth + 1, 0).getDate();
              const firstDay = new Date(calYear, calMonth, 1).getDay();
              const startOffset = firstDay === 0 ? 6 : firstDay - 1;
              const todayStr = now.toISOString().split("T")[0];
              const cells = [];
              for (let i = 0; i < startOffset; i++) cells.push(<div key={`e-${i}`} />);
              for (let d = 1; d <= daysInMonth; d++) {
                const ds = `${calYear}-${String(calMonth + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
                const isSun = new Date(ds + "T00:00:00").getDay() === 0;
                const isHol = holidayDates.has(ds);
                const isFuture = ds > todayStr;
                const isToday = ds === todayStr;
                const dayAtt = attendance.filter(a => a.date === ds && a.studentId === student.id);
                const hasIn = dayAtt.some(a => a.type === "in");
                const checkIn = dayAtt.find(a => a.type === "in");
                const checkOut = dayAtt.find(a => a.type === "out");
                let bg = "#f8fafc", border = "1px solid #e8eff8", color = "#94a3b8", label = "—";
                if (isHol) { bg = "#fef3c7"; border = "1px solid #fde68a"; color = "#d97706"; label = "H"; }
                else if (isSun) { bg = "#f3e8ff"; border = "1px solid #d8b4fe"; color = "#7c3aed"; label = "S"; }
                else if (isFuture) { bg = "#f1f5f9"; color = "#cbd5e1"; label = "—"; }
                else if (hasIn) { bg = "#dcfce7"; border = "1px solid #86efac"; color = "#16a34a"; label = "P"; }
                else { bg = "#fee2e2"; border = "1px solid #fca5a5"; color = "#dc2626"; label = "A"; }
                if (isToday) border = "2px solid #2563eb";
                cells.push(
                  <div key={ds} onClick={() => !isFuture && setCalSelectedDate(ds)} style={{ background: bg, border, borderRadius: 8, padding: "5px 2px", textAlign: "center", minHeight: 44, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", cursor: isFuture ? "default" : "pointer", position: "relative" }}
                    title={checkIn ? `IN: ${fmtTime(checkIn.timestamp)}${checkOut ? " · OUT: " + fmtTime(checkOut.timestamp) : ""}` : isHol ? "Holiday" : isSun ? "Sunday" : isFuture ? "" : "Absent"}>
                    <div style={{ fontSize: 11, fontWeight: 700, color }}>{d}</div>
                    <div style={{ fontSize: 8, fontWeight: 700, color }}>{label}</div>
                    {hasIn && !isSun && !isHol && <div style={{ fontSize: 6, color: "#16a34a", marginTop: 1 }}>{checkIn ? fmtTime(checkIn.timestamp) : ""}</div>}
                    {leaveApplications.some(la => la.date === ds) && <div style={{ position: "absolute", top: 2, right: 2, width: 6, height: 6, borderRadius: "50%", background: "#f59e0b" }} />}
                  </div>
                );
              }
              return cells;
            })()}
          </div>
        </div>
      )}

      {/* ═══ LEAVE APPLICATION VIEW ═══ */}
      {viewMode === "leave" && (
        <div style={{ background: "#fff", borderRadius: 20, padding: 18, marginTop: 14, boxShadow: "0 2px 12px rgba(0,0,0,0.06)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
            <h4 style={{ margin: 0, fontSize: 15, fontWeight: 800, color: "#1e293b" }}>Leave Application</h4>
            {!showLeaveForm && <button onClick={() => setShowLeaveForm(true)} style={{ padding: "8px 16px", borderRadius: 10, border: "none", background: "linear-gradient(135deg,#f59e0b,#d97706)", color: "#fff", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>+ Apply Leave</button>}
          </div>
          {leaveMsg && <div style={{ padding: "10px 14px", borderRadius: 10, background: "#f0fdf4", border: "1px solid #86efac", marginBottom: 12, fontSize: 12, color: "#16a34a", fontWeight: 600 }}>{leaveMsg}</div>}
          {showLeaveForm && (
            <div style={{ background: "#fffbeb", borderRadius: 14, padding: 16, marginBottom: 16, border: "1.5px solid #fde68a" }}>
              <div style={{ marginBottom: 10 }}>
                <label style={{ fontSize: 11, fontWeight: 700, color: "#78350f", display: "block", marginBottom: 4 }}>Leave Date *</label>
                <input type="date" value={leaveForm.date} onChange={e => setLeaveForm({ ...leaveForm, date: e.target.value })} style={{ width: "100%", padding: "10px 12px", borderRadius: 10, border: "1.5px solid #fde68a", fontSize: 13, outline: "none", background: "#fff", boxSizing: "border-box" }} />
              </div>
              <div style={{ marginBottom: 10 }}>
                <label style={{ fontSize: 11, fontWeight: 700, color: "#78350f", display: "block", marginBottom: 4 }}>Leave Type *</label>
                <div style={{ display: "flex", gap: 8 }}>
                  {[["full_day", "Full Day"], ["half_day", "Half Day"], ["emergency", "Emergency"]].map(([val, label]) => (
                    <button key={val} onClick={() => setLeaveForm({ ...leaveForm, leaveType: val })} style={{ flex: 1, padding: "8px 0", borderRadius: 8, border: leaveForm.leaveType === val ? "2px solid #f59e0b" : "1px solid #e2e8f0", background: leaveForm.leaveType === val ? "#fef3c7" : "#fff", color: leaveForm.leaveType === val ? "#92400e" : "#64748b", fontSize: 11, fontWeight: 700, cursor: "pointer" }}>{label}</button>
                  ))}
                </div>
              </div>
              <div style={{ marginBottom: 12 }}>
                <label style={{ fontSize: 11, fontWeight: 700, color: "#78350f", display: "block", marginBottom: 4 }}>Reason *</label>
                <textarea value={leaveForm.reason} onChange={e => setLeaveForm({ ...leaveForm, reason: e.target.value })} placeholder="Leave ka reason likho (e.g. Family function, Doctor visit...)" rows={3} style={{ width: "100%", padding: "10px 12px", borderRadius: 10, border: "1.5px solid #fde68a", fontSize: 12, outline: "none", resize: "none", fontFamily: "inherit", background: "#fff", boxSizing: "border-box" }} />
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <button disabled={leaveSaving} onClick={async () => {
                  if (!leaveForm.date) { setLeaveMsg("Date select karo!"); return; }
                  if (!leaveForm.reason?.trim()) { setLeaveMsg("Reason likho!"); return; }
                  setLeaveSaving(true);
                  try {
                    await addDoc(collection(db, "leave_applications"), {
                      studentId: student.id, studentName: student.studentName || "", studentClass: student.class || "",
                      parentEmail: student.parentEmail || "", parentName: student.fatherName || student.motherName || "",
                      date: leaveForm.date, leaveType: leaveForm.leaveType || "full_day", reason: leaveForm.reason.trim(),
                      status: "approved", createdAt: serverTimestamp(),
                    });
                    setLeaveMsg("✅ Chutti mil gayi! Leave approved ho gayi hai.");
                    setLeaveForm({ date: new Date().toISOString().split("T")[0], reason: "", leaveType: "full_day" });
                    setShowLeaveForm(false);
                    setTimeout(() => setLeaveMsg(""), 4000);
                  } catch (e) { setLeaveMsg("Error: " + e.message); }
                  setLeaveSaving(false);
                }} style={{ flex: 1, padding: "10px 0", borderRadius: 10, border: "none", background: "linear-gradient(135deg,#f59e0b,#d97706)", color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>{leaveSaving ? "Submitting..." : "Submit Application"}</button>
                <button onClick={() => { setShowLeaveForm(false); setLeaveMsg(""); }} style={{ padding: "10px 16px", borderRadius: 10, border: "1px solid #e2e8f0", background: "#f8fafc", color: "#64748b", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>Cancel</button>
              </div>
            </div>
          )}
          <div style={{ marginTop: 4 }}>
            <h5 style={{ margin: "0 0 10px", fontSize: 13, fontWeight: 700, color: "#475569" }}>Previous Applications</h5>
            {leaveApplications.length === 0 ? (
              <div style={{ textAlign: "center", padding: 24, color: "#94a3b8", fontSize: 12 }}>No leave applications yet</div>
            ) : leaveApplications.map(la => {
              const typeLabels = { full_day: "Full Day", half_day: "Half Day", emergency: "Emergency" };
              const typeColors = { full_day: "#2563eb", half_day: "#7c3aed", emergency: "#dc2626" };
              const typeColor = typeColors[la.leaveType] || "#2563eb";
              return (
                <div key={la.id} style={{ padding: "12px 14px", borderRadius: 12, border: "1px solid #bbf7d0", marginBottom: 8, background: "#f0fdf4", borderLeft: "3px solid #16a34a" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                    <span style={{ fontSize: 13, fontWeight: 700, color: "#1e293b" }}>{la.date ? new Date(la.date + "T00:00:00").toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "—"}</span>
                    <span style={{ fontSize: 10, fontWeight: 700, color: "#16a34a", background: "#dcfce7", padding: "3px 10px", borderRadius: 99, border: "1px solid #86efac" }}>✓ Approved</span>
                  </div>
                  <div style={{ display: "flex", gap: 6, marginBottom: 4 }}>
                    <span style={{ fontSize: 10, fontWeight: 600, color: typeColor, background: "#f8fafc", padding: "2px 8px", borderRadius: 6, border: `1px solid ${typeColor}22` }}>{typeLabels[la.leaveType] || la.leaveType}</span>
                  </div>
                  <p style={{ margin: 0, fontSize: 12, color: "#475569", lineHeight: 1.4 }}>{la.reason}</p>
                  {la.adminNote && <p style={{ margin: "6px 0 0", fontSize: 11, color: "#2563eb", background: "#eff6ff", padding: "6px 10px", borderRadius: 8 }}>Admin: {la.adminNote}</p>}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Calendar Date Detail Popup */}
      {calSelectedDate && (() => {
        const dayAtt = attendance.filter(a => a.date === calSelectedDate && a.studentId === student.id);
        const dayLeave = leaveApplications.find(la => la.date === calSelectedDate);
        const checkIn = dayAtt.find(a => a.type === "in");
        const checkOut = dayAtt.find(a => a.type === "out");
        const isHol = holidayDates.has(calSelectedDate);
        const isSun = new Date(calSelectedDate + "T00:00:00").getDay() === 0;
        return (
          <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.4)", zIndex: 999, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }} onClick={() => setCalSelectedDate(null)}>
            <div style={{ background: "#fff", borderRadius: 20, padding: 20, maxWidth: 340, width: "100%", boxShadow: "0 10px 40px rgba(0,0,0,.15)" }} onClick={e => e.stopPropagation()}>
              <h4 style={{ margin: "0 0 12px", fontSize: 15, fontWeight: 800, color: "#1e293b" }}>{new Date(calSelectedDate + "T00:00:00").toLocaleDateString("en-IN", { weekday: "long", day: "2-digit", month: "long", year: "numeric" })}</h4>
              {isHol ? <p style={{ fontSize: 13, color: "#d97706", fontWeight: 600 }}>Holiday</p>
              : isSun ? <p style={{ fontSize: 13, color: "#7c3aed", fontWeight: 600 }}>Sunday</p>
              : checkIn ? (
                <div>
                  <p style={{ fontSize: 13, color: "#16a34a", fontWeight: 700, margin: "0 0 6px" }}>Present</p>
                  <p style={{ fontSize: 12, color: "#475569", margin: "0 0 3px" }}>Check-in: <strong>{fmtTime(checkIn.timestamp)}</strong></p>
                  {checkOut && <p style={{ fontSize: 12, color: "#475569", margin: 0 }}>Check-out: <strong>{fmtTime(checkOut.timestamp)}</strong></p>}
                </div>
              ) : <p style={{ fontSize: 13, color: "#dc2626", fontWeight: 700, margin: "0 0 6px" }}>Absent</p>}
              {dayLeave && (
                <div style={{ marginTop: 10, padding: "10px 12px", borderRadius: 10, background: "#fffbeb", border: "1px solid #fde68a" }}>
                  <p style={{ margin: "0 0 4px", fontSize: 12, fontWeight: 700, color: "#92400e" }}>Leave Application</p>
                  <p style={{ margin: "0 0 3px", fontSize: 11, color: "#78350f" }}>Type: {dayLeave.leaveType === "full_day" ? "Full Day" : dayLeave.leaveType === "half_day" ? "Half Day" : "Emergency"}</p>
                  <p style={{ margin: "0 0 3px", fontSize: 11, color: "#78350f" }}>Reason: {dayLeave.reason}</p>
                  <p style={{ margin: 0, fontSize: 11, fontWeight: 700, color: dayLeave.status === "rejected" ? "#dc2626" : "#16a34a" }}>Status: {dayLeave.status === "rejected" ? "Rejected" : "✓ Approved"}</p>
                </div>
              )}
              <button onClick={() => setCalSelectedDate(null)} style={{ marginTop: 12, width: "100%", padding: "10px 0", borderRadius: 10, border: "none", background: "#f1f5f9", color: "#475569", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>Close</button>
            </div>
          </div>
        );
      })()}

      {/* RFID Card Info */}
      {student.rfidCode && (
        <div style={{ background: "#f0f9ff", borderRadius: 14, padding: "12px 14px", marginTop: 14, display: "flex", alignItems: "center", gap: 10, border: "1px solid #bae6fd" }}>
          <Icon name="rfid" size={18} color="#0369a1"/>
          <div>
            <p style={{ margin: 0, fontSize: 12, fontWeight: 700, color: "#0369a1" }}>RFID Card: {student.rfidCode}</p>
            <p style={{ margin: "2px 0 0", fontSize: 11, color: "#64748b" }}>Auto check-in/check-out on tap</p>
          </div>
        </div>
      )}
    </div>
  );
};

// ─── SCREEN: NOTICES ─────────────────────────────────────────────────────────
const NoticesScreen = ({ notices, holidays }) => {
  const typeConfig = {
    test:    { label: "Exam",    color: "#8b5cf6", bg: "#f5f3ff" },
    fee:     { label: "Fee",     color: "#f59e0b", bg: "#fffbeb" },
    holiday: { label: "Holiday", color: "#10b981", bg: "#f0fdf4" },
    event:   { label: "Event",   color: "#ec4899", bg: "#fdf2f8" },
    general: { label: "General", color: "#3b82f6", bg: "#eff6ff" },
  };
  // Combine notices + holidays
  const allItems = [
    ...notices.map(n => ({ ...n, source: "notice" })),
    ...holidays.map(h => ({ id: h.id, date: h.date, message: h.title + (h.description ? " – " + h.description : ""), notifType: "holiday", source: "holiday" })),
  ].sort((a, b) => (b.date || "").localeCompare(a.date || ""));

  return (
    <div style={{ padding: "0 16px 20px" }}>
      <div style={{ background: "linear-gradient(135deg, #1e3a5f, #1d4ed8)", margin: "0 -16px", padding: "16px 20px 24px", borderRadius: "0 0 24px 24px", marginBottom: 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 40, height: 40, borderRadius: 12, background: "rgba(255,255,255,0.15)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Icon name="bell" size={20} color="#fff"/>
          </div>
          <div>
            <h3 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: "#fff" }}>Notice Board</h3>
            <p style={{ margin: "2px 0 0", fontSize: 12, color: "#93c5fd" }}>{allItems.length} announcements</p>
          </div>
        </div>
      </div>

      {allItems.length > 0 ? allItems.map(n => {
        const cfg = typeConfig[n.notifType] || typeConfig.general;
        return (
          <div key={n.id} style={{ background: "#fff", borderRadius: 18, padding: 16, marginBottom: 12, boxShadow: "0 2px 10px rgba(0,0,0,0.06)", borderLeft: `4px solid ${cfg.color}` }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
              <div style={{ flex: 1 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                  <span style={{ fontSize: 10, fontWeight: 700, background: cfg.bg, color: cfg.color, padding: "3px 8px", borderRadius: 20 }}>{cfg.label.toUpperCase()}</span>
                  {n.time && <span style={{ fontSize: 10, color: "#94a3b8" }}>{n.time}</span>}
                </div>
                <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: "#1e293b" }}>{n.message}</p>
              </div>
              <span style={{ fontSize: 11, color: "#94a3b8", flexShrink: 0, marginLeft: 10 }}>{n.date}</span>
            </div>
          </div>
        );
      }) : (
        <div style={{ textAlign: "center", padding: 40, color: "#94a3b8" }}>
          <Icon name="bell" size={40} color="#cbd5e1"/>
          <p style={{ marginTop: 12, fontSize: 14, fontWeight: 600 }}>No notices yet</p>
        </div>
      )}
    </div>
  );
};

// ─── SCREEN: PROFILE ─────────────────────────────────────────────────────────
const ProfileScreen = ({ student, user, onLogout }) => {
  const totalFee = Number(student.totalFee || 0);
  const feePaid = Number(student.enrollmentFeePaid || 0);
  const feeDue = Math.max(0, totalFee - feePaid);

  return (
    <div style={{ padding: "0 16px 20px" }}>
      {/* Header */}
      <div style={{ background: "linear-gradient(135deg, #1e3a5f, #1d4ed8)", margin: "0 -16px", padding: "24px 20px 60px", borderRadius: "0 0 28px 28px" }}>
        <div style={{ textAlign: "center" }}>
          <div style={{ width: 80, height: 80, borderRadius: 24, overflow: "hidden", background: "linear-gradient(135deg, #60a5fa, #3b82f6)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 12px", boxShadow: "0 8px 24px rgba(59,130,246,0.4)" }}>
            {student.photo && student.photo.startsWith("http") ? (
              <img src={student.photo} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }}/>
            ) : (
              <span style={{ color: "#fff", fontSize: 32, fontWeight: 900 }}>{student.studentName?.charAt(0)}</span>
            )}
          </div>
          <h2 style={{ margin: 0, color: "#fff", fontSize: 22, fontWeight: 800 }}>{student.studentName}</h2>
          <p style={{ margin: "4px 0 0", color: "#93c5fd", fontSize: 13 }}>Class {student.class} • {student.board} • {student.medium}</p>
        </div>
      </div>

      {/* Info Cards */}
      <div style={{ background: "#fff", borderRadius: 20, padding: 4, marginTop: -40, boxShadow: "0 8px 30px rgba(30,58,95,0.15)", overflow: "hidden" }}>
        {[
          ["Form Number", student.formNo || "—", "star"],
          ["Father Name", student.fatherName || "—", "user"],
          ["Mother Name", student.motherName || "—", "user"],
          ["Student Phone", student.studentPhone || "—", "bell"],
          ["Parent Phone", student.parentPhone || "—", "bell"],
          ["RFID Card", student.rfidCode || "Not Assigned", "rfid"],
          ["School", student.schoolName || "—", "chart"],
        ].map(([label, value, icon], i, arr) => (
          <div key={label} style={{ display: "flex", alignItems: "center", gap: 14, padding: "14px 16px", borderBottom: i < arr.length - 1 ? "1px solid #f1f5f9" : "none" }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: "#eff6ff", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <Icon name={icon} size={16} color="#3b82f6"/>
            </div>
            <div>
              <p style={{ margin: 0, fontSize: 11, color: "#94a3b8", fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.5 }}>{label}</p>
              <p style={{ margin: "2px 0 0", fontSize: 14, fontWeight: 600, color: "#1e293b" }}>{value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Fee Summary */}
      {totalFee > 0 && (
        <div style={{ background: "#fff", borderRadius: 20, padding: 18, marginTop: 14, boxShadow: "0 2px 12px rgba(0,0,0,0.06)" }}>
          <h4 style={{ margin: "0 0 14px", fontSize: 14, fontWeight: 700, color: "#1e293b" }}>Fee Summary</h4>
          {[["Total Fee", `₹${totalFee.toLocaleString("en-IN")}`, "#1e293b"],
            ["Paid", `₹${feePaid.toLocaleString("en-IN")}`, "#16a34a"],
            ["Remaining", `₹${feeDue.toLocaleString("en-IN")}`, feeDue > 0 ? "#dc2626" : "#16a34a"],
          ].map(([label, val, color]) => (
            <div key={label} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 0", borderBottom: "1px solid #f1f5f9" }}>
              <span style={{ fontSize: 13, color: "#64748b" }}>{label}</span>
              <span style={{ fontSize: 14, fontWeight: 700, color }}>{val}</span>
            </div>
          ))}
        </div>
      )}

      {/* Batch Info */}
      {student.batchStartDate && (
        <div style={{ background: "#f0fdf4", border: "1.5px solid #bbf7d0", borderRadius: 18, padding: 16, marginTop: 14, display: "flex", alignItems: "center", gap: 14 }}>
          <div style={{ width: 44, height: 44, borderRadius: 14, background: "#dcfce7", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Icon name="shield" size={22} color="#16a34a"/>
          </div>
          <div>
            <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: "#15803d" }}>Batch: {student.batchStartDate} → {student.batchEndDate}</p>
            <p style={{ margin: "3px 0 0", fontSize: 12, color: "#16a34a" }}>
              {new Date().toISOString().split("T")[0] <= student.batchEndDate ? "Active" : "Expired"}
            </p>
          </div>
        </div>
      )}

      {/* Institute Info */}
      <div style={{ background: "#fff", borderRadius: 18, padding: 16, marginTop: 14, boxShadow: "0 2px 10px rgba(0,0,0,0.06)" }}>
        <h4 style={{ margin: "0 0 12px", fontSize: 13, fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", letterSpacing: 0.5 }}>Institute</h4>
        <p style={{ margin: 0, fontSize: 15, fontWeight: 700, color: "#1e293b" }}>Patel Institute Dongargaon</p>
        <p style={{ margin: "4px 0 0", fontSize: 13, color: "#64748b" }}>Matiya Road, Dongargaon, Rajnandgaon, C.G. – 491445</p>
        <p style={{ margin: "4px 0 0", fontSize: 12, color: "#3b82f6" }}>8319002877 • 7470412110</p>
      </div>

      {/* Logged in as */}
      <div style={{ background: "#f8fafc", borderRadius: 12, padding: 12, marginTop: 14, textAlign: "center" }}>
        <p style={{ margin: 0, fontSize: 11, color: "#94a3b8" }}>Logged in as</p>
        <p style={{ margin: "4px 0 0", fontSize: 13, fontWeight: 600, color: "#1e293b" }}>{user?.email}</p>
      </div>

      {/* Logout */}
      <button onClick={onLogout} style={{ width: "100%", marginTop: 16, padding: "14px", background: "#fff1f2", color: "#dc2626", border: "1.5px solid #fecdd3", borderRadius: 16, fontSize: 15, fontWeight: 700, cursor: "pointer" }}>
        Logout
      </button>
    </div>
  );
};

// ─── PERFORMANCE SCREEN ──────────────────────────────────────────────────────
const PerformanceScreen = ({ student }) => {
  const [examMarks, setExamMarks] = useState([]);
  const [exams, setExams] = useState([]);
  const [classmates, setClassmates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedExam, setSelectedExam] = useState(null);

  useEffect(() => {
    if (!student?.id) return;
    setLoading(true);
    Promise.all([
      getDocs(query(collection(db, "exam_marks"), where("studentId", "==", student.id))),
      getDocs(collection(db, "exams")),
      // Saare classmates ke marks bhi laao ranking ke liye
      getDocs(query(collection(db, "exam_marks"), where("studentClass", "==", student.class))),
    ]).then(([marksSnap, examsSnap, classmatesSnap]) => {
      const marks = marksSnap.docs.map(d => ({ id: d.id, ...d.data() }));
      const examsList = examsSnap.docs.map(d => ({ id: d.id, ...d.data() }));
      examsList.sort((a, b) => (b.examDate || "").localeCompare(a.examDate || ""));
      const allClassMarks = classmatesSnap.docs.map(d => ({ id: d.id, ...d.data() }));
      setExamMarks(marks);
      setExams(examsList);
      setClassmates(allClassMarks);
      setLoading(false);
    }).catch(e => { console.error(e); setLoading(false); });
  }, [student?.id]);

  if (loading) return <div style={{ padding: 40, textAlign: "center", color: "#64748b" }}><div style={{ fontSize: 24, marginBottom: 8 }}>⏳</div>Loading performance data...</div>;

  // Calculate overall stats
  const totalExams = examMarks.length;
  const avgPct = totalExams > 0 ? Math.round(examMarks.reduce((s, m) => {
    const exam = exams.find(e => e.id === m.examId);
    const subjects = exam?.subjects || [];
    const maxTotal = subjects.length * (exam?.totalMarksPerSubject || 100);
    return s + (maxTotal > 0 ? (m.totalMarks / maxTotal) * 100 : 0);
  }, 0) / totalExams) : 0;

  // Overall class rank — sabhi exams me average percentage ke basis pe
  const studentAvgMap = {};
  classmates.forEach(m => {
    const exam = exams.find(e => e.id === m.examId);
    const subjects = exam?.subjects || [];
    const maxTotal = subjects.length * (exam?.totalMarksPerSubject || 100);
    const pct = maxTotal > 0 ? (m.totalMarks / maxTotal) * 100 : 0;
    if (!studentAvgMap[m.studentId]) studentAvgMap[m.studentId] = { total: 0, count: 0, name: m.studentName };
    studentAvgMap[m.studentId].total += pct;
    studentAvgMap[m.studentId].count++;
  });
  const rankings = Object.entries(studentAvgMap).map(([id, d]) => ({
    id, name: d.name, avgPct: Math.round(d.total / d.count)
  })).sort((a, b) => b.avgPct - a.avgPct);
  const myRank = rankings.findIndex(r => r.id === student.id) + 1;
  const totalStudents = rankings.length;

  return (
    <div style={{ padding: "0 16px 20px" }}>
      {/* Header */}
      <div style={{ background: "linear-gradient(135deg, #4c1d95, #7c3aed)", margin: "0 -16px", padding: "20px 20px 24px", borderRadius: "0 0 24px 24px", marginBottom: 16 }}>
        <p style={{ color: "#c4b5fd", fontSize: 12, margin: "0 0 4px", fontWeight: 500 }}>Academic Performance</p>
        <h2 style={{ color: "#fff", fontSize: 20, fontWeight: 800, margin: 0 }}>{student.studentName}</h2>
        <p style={{ color: "#c4b5fd", fontSize: 12, margin: "4px 0 0" }}>Class {student.class} · {student.board} · {student.medium}</p>
      </div>

      {/* Stats Cards */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginBottom: 16 }}>
        <div style={{ background: "#fff", borderRadius: 16, padding: 14, textAlign: "center", boxShadow: "0 2px 12px rgba(0,0,0,.06)", border: "1px solid #f1f5f9" }}>
          <div style={{ fontSize: 24, fontWeight: 800, color: "#2563eb" }}>{totalExams}</div>
          <div style={{ fontSize: 10, color: "#64748b", fontWeight: 600 }}>Tests Given</div>
        </div>
        <div style={{ background: "#fff", borderRadius: 16, padding: 14, textAlign: "center", boxShadow: "0 2px 12px rgba(0,0,0,.06)", border: "1px solid #f1f5f9" }}>
          <div style={{ fontSize: 24, fontWeight: 800, color: avgPct >= 75 ? "#16a34a" : avgPct >= 50 ? "#d97706" : "#dc2626" }}>{avgPct}%</div>
          <div style={{ fontSize: 10, color: "#64748b", fontWeight: 600 }}>Average Score</div>
        </div>
        <div style={{ background: "#fff", borderRadius: 16, padding: 14, textAlign: "center", boxShadow: "0 2px 12px rgba(0,0,0,.06)", border: "1px solid #f1f5f9" }}>
          <div style={{ fontSize: 24, fontWeight: 800, color: "#7c3aed" }}>{myRank > 0 ? `#${myRank}` : "—"}</div>
          <div style={{ fontSize: 10, color: "#64748b", fontWeight: 600 }}>Class Rank</div>
        </div>
      </div>

      {/* Performance Graph */}
      {examMarks.length > 0 && (
        <div style={{ background: "#fff", borderRadius: 16, padding: 16, boxShadow: "0 2px 12px rgba(0,0,0,.06)", border: "1px solid #f1f5f9", marginBottom: 16 }}>
          <h3 style={{ fontSize: 14, fontWeight: 700, margin: "0 0 14px", color: "#1e293b" }}>📊 Performance Trend</h3>
          <div style={{ display: "flex", alignItems: "flex-end", gap: 6, height: 120, padding: "0 4px", borderBottom: "1.5px solid #f1f5f9" }}>
            {examMarks.slice(-10).map((m, i) => {
              const exam = exams.find(e => e.id === m.examId);
              const subjects = exam?.subjects || [];
              const maxTotal = subjects.length * (exam?.totalMarksPerSubject || 100);
              const pct = maxTotal > 0 ? Math.round((m.totalMarks / maxTotal) * 100) : 0;
              const barColor = pct >= 75 ? "#16a34a" : pct >= 50 ? "#d97706" : "#dc2626";
              return (
                <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 3 }}>
                  <div style={{ fontSize: 9, fontWeight: 700, color: barColor }}>{pct}%</div>
                  <div style={{ width: "100%", maxWidth: 28, height: `${Math.max(pct, 5)}px`, background: barColor, borderRadius: "4px 4px 0 0", transition: "height .3s" }} />
                  <div style={{ fontSize: 7, color: "#94a3b8", textAlign: "center", lineHeight: 1.1 }}>{exam?.title?.slice(0, 6) || ""}</div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Exam-wise Results */}
      <div style={{ background: "#fff", borderRadius: 16, padding: 16, boxShadow: "0 2px 12px rgba(0,0,0,.06)", border: "1px solid #f1f5f9", marginBottom: 16 }}>
        <h3 style={{ fontSize: 14, fontWeight: 700, margin: "0 0 12px", color: "#1e293b" }}>📝 Exam Results</h3>
        {examMarks.length === 0 ? (
          <div style={{ textAlign: "center", padding: 20, color: "#94a3b8", fontSize: 13 }}>Abhi tak koi test result nahi aaya.</div>
        ) : examMarks.map((m, idx) => {
          const exam = exams.find(e => e.id === m.examId);
          const subjects = exam?.subjects || [];
          const maxTotal = subjects.length * (exam?.totalMarksPerSubject || 100);
          const pct = maxTotal > 0 ? Math.round((m.totalMarks / maxTotal) * 100) : 0;
          // Exam-specific rank
          const examClassMarks = classmates.filter(c => c.examId === m.examId).sort((a, b) => b.totalMarks - a.totalMarks);
          const examRank = examClassMarks.findIndex(c => c.studentId === student.id) + 1;
          const isExpanded = selectedExam === m.id;
          return (
            <div key={m.id} style={{ borderBottom: idx < examMarks.length - 1 ? "1px solid #f1f5f9" : "none" }}>
              <div onClick={() => setSelectedExam(isExpanded ? null : m.id)} style={{ padding: "12px 0", display: "flex", alignItems: "center", gap: 10, cursor: "pointer" }}>
                <div style={{ width: 36, height: 36, borderRadius: 10, background: pct >= 75 ? "#f0fdf4" : pct >= 50 ? "#fffbeb" : "#fef2f2", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <span style={{ fontSize: 14, fontWeight: 800, color: pct >= 75 ? "#16a34a" : pct >= 50 ? "#d97706" : "#dc2626" }}>{pct}%</span>
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 700, fontSize: 13, color: "#1e293b" }}>{exam?.title || m.examTitle || "Test"}</div>
                  <div style={{ fontSize: 11, color: "#94a3b8", display: "flex", gap: 8 }}>
                    <span>{exam?.examDate || ""}</span>
                    <span>{m.totalMarks}/{maxTotal}</span>
                    {examRank > 0 && <span style={{ color: "#7c3aed", fontWeight: 600 }}>Rank #{examRank}/{examClassMarks.length}</span>}
                  </div>
                </div>
                <span style={{ fontSize: 12, color: "#94a3b8" }}>{isExpanded ? "▲" : "▼"}</span>
              </div>
              {/* Subject-wise marks (expanded) */}
              {isExpanded && m.marks && (
                <div style={{ padding: "0 0 12px 46px" }}>
                  {Object.entries(m.marks).map(([sub, marks]) => {
                    const subMax = exam?.totalMarksPerSubject || 100;
                    const subPct = subMax > 0 ? Math.round((Number(marks) / subMax) * 100) : 0;
                    return (
                      <div key={sub} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                        <span style={{ fontSize: 12, fontWeight: 600, color: "#475569", minWidth: 80 }}>{sub}</span>
                        <div style={{ flex: 1, height: 6, background: "#f1f5f9", borderRadius: 99, overflow: "hidden" }}>
                          <div style={{ width: `${subPct}%`, height: "100%", background: subPct >= 75 ? "#16a34a" : subPct >= 50 ? "#d97706" : "#dc2626", borderRadius: 99 }} />
                        </div>
                        <span style={{ fontSize: 11, fontWeight: 700, color: "#475569", minWidth: 45, textAlign: "right" }}>{marks}/{subMax}</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Class Ranking — sirf rank dikhega, marks/% nahi */}
      {rankings.length > 0 && (
        <div style={{ background: "#fff", borderRadius: 16, padding: 16, boxShadow: "0 2px 12px rgba(0,0,0,.06)", border: "1px solid #f1f5f9" }}>
          <h3 style={{ fontSize: 14, fontWeight: 700, margin: "0 0 12px", color: "#1e293b" }}>🏆 Class Ranking — {student.class}</h3>
          <p style={{ fontSize: 11, color: "#94a3b8", margin: "-8px 0 12px" }}>Based on overall average across all tests</p>
          {rankings.slice(0, 10).map((r, idx) => {
            const isMe = r.id === student.id;
            const medalColors = ["#fbbf24", "#94a3b8", "#cd7f32"];
            return (
              <div key={r.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 0", borderBottom: idx < Math.min(rankings.length, 10) - 1 ? "1px solid #f8fafc" : "none", background: isMe ? "#eff6ff" : "transparent", borderRadius: isMe ? 10 : 0, padding: isMe ? "8px 10px" : "8px 0" }}>
                <div style={{ width: 28, height: 28, borderRadius: 8, background: idx < 3 ? `${medalColors[idx]}22` : "#f8fafc", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <span style={{ fontSize: 12, fontWeight: 800, color: idx < 3 ? medalColors[idx] : "#94a3b8" }}>{idx + 1}</span>
                </div>
                <div style={{ flex: 1 }}>
                  <span style={{ fontSize: 13, fontWeight: isMe ? 800 : 600, color: isMe ? "#2563eb" : "#1e293b" }}>
                    {isMe ? `${r.name} (You)` : r.name}
                  </span>
                </div>
                {isMe && <span style={{ fontSize: 11, fontWeight: 700, color: "#2563eb", background: "#dbeafe", padding: "2px 8px", borderRadius: 6 }}>Rank #{idx + 1}</span>}
              </div>
            );
          })}
          {myRank > 10 && (
            <div style={{ textAlign: "center", padding: "10px 0", fontSize: 12, color: "#7c3aed", fontWeight: 600, borderTop: "1px solid #f1f5f9", marginTop: 8 }}>
              ... Your rank: #{myRank} out of {totalStudents}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// ─── BOTTOM NAV ──────────────────────────────────────────────────────────────
const BottomNav = ({ active, navigate, noticeCount }) => {
  const tabs = [
    { id: "home",        icon: "home",        label: "Home" },
    { id: "performance", icon: "trophy",      label: "Performance" },
    { id: "attendance",  icon: "attendance",   label: "Attendance" },
    { id: "notices",     icon: "bell",         label: "Notices" },
    { id: "profile",     icon: "user",         label: "Profile" },
  ];

  return (
    <div style={{ position: "sticky", bottom: 0, background: "#fff", borderTop: "1px solid #f1f5f9", display: "flex", padding: "8px 0 12px", boxShadow: "0 -4px 20px rgba(0,0,0,0.08)", zIndex: 10 }}>
      {tabs.map(tab => (
        <button key={tab.id} onClick={() => navigate(tab.id)}
          style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 4, background: "none", border: "none", cursor: "pointer", position: "relative", padding: "4px 0" }}>
          {tab.id === "notices" && <Badge count={noticeCount}/>}
          <div style={{ width: 36, height: 36, borderRadius: 12, background: active === tab.id ? "#eff6ff" : "transparent", display: "flex", alignItems: "center", justifyContent: "center", transition: "background 0.2s" }}>
            <Icon name={tab.icon} size={20} color={active === tab.id ? "#2563eb" : "#94a3b8"}/>
          </div>
          <span style={{ fontSize: 10, fontWeight: active === tab.id ? 700 : 500, color: active === tab.id ? "#2563eb" : "#94a3b8" }}>{tab.label}</span>
        </button>
      ))}
    </div>
  );
};

// ─── MAIN APP ────────────────────────────────────────────────────────────────
const screenTitles = { home: "PID Parent App", performance: "Performance", attendance: "Attendance", notices: "Notice Board", profile: "Student Profile" };

export default function ParentApp() {
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [student, setStudent] = useState(null);
  const [studentLoading, setStudentLoading] = useState(false);
  const [notFound, setNotFound] = useState(false);
  const [screen, setScreen] = useState("home");
  const [attendance, setAttendance] = useState([]);
  const [notices, setNotices] = useState([]);
  const [holidays, setHolidays] = useState([]);
  const [notification, setNotification] = useState(null);
  const [leaveApplications, setLeaveApplications] = useState([]);

  // ═══ AUTH LISTENER ═══
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setAuthLoading(false);
    });
    return () => unsub();
  }, []);

  // ═══ FIND STUDENT BY PARENT EMAIL ═══
  useEffect(() => {
    if (!user) { setStudent(null); setNotFound(false); return; }
    setStudentLoading(true);
    setNotFound(false);

    // Search: parentEmail OR studentEmail matches logged-in user
    const tryFind = async () => {
      const email = user.email.toLowerCase();
      
      // Try parentEmail first
      let snap = await getDocs(query(collection(db, "students"), where("parentEmail", "==", email)));
      if (snap.empty) {
        // Try studentEmail
        snap = await getDocs(query(collection(db, "students"), where("studentEmail", "==", email)));
      }
      if (snap.empty) {
        // Try case-insensitive (some emails might have different case)
        const allSnap = await getDocs(collection(db, "students"));
        const found = allSnap.docs.find(d => {
          const data = d.data();
          return data.parentEmail?.toLowerCase() === email || data.studentEmail?.toLowerCase() === email;
        });
        if (found) {
          setStudent({ id: found.id, ...found.data() });
        } else {
          setNotFound(true);
        }
      } else {
        const doc = snap.docs[0];
        setStudent({ id: doc.id, ...doc.data() });
      }
      setStudentLoading(false);
    };
    tryFind().catch(e => { console.error(e); setStudentLoading(false); setNotFound(true); });
  }, [user]);

  // ═══ REALTIME: ATTENDANCE (this month) ═══
  useEffect(() => {
    if (!student) return;
    const now = new Date();
    const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
    const q = query(collection(db, "attendance"), where("date", ">=", monthStart));
    const unsub = onSnapshot(q, (snap) => {
      const arr = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setAttendance(arr);
    });
    return () => unsub();
  }, [student]);

  // ═══ REALTIME: LEAVE APPLICATIONS ═══
  useEffect(() => {
    if (!student) return;
    const q = query(collection(db, "leave_applications"), where("studentId", "==", student.id));
    const unsub = onSnapshot(q, (snap) => {
      const arr = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      arr.sort((a, b) => (b.date || "").localeCompare(a.date || ""));
      setLeaveApplications(arr);
    });
    return () => unsub();
  }, [student]);

  // ═══ REALTIME: NOTIFICATIONS ═══
  useEffect(() => {
    const unsub = onSnapshot(collection(db, "scheduled_notifications"), (snap) => {
      const arr = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      arr.sort((a, b) => (b.date || "").localeCompare(a.date || ""));
      setNotices(arr);
    });
    return () => unsub();
  }, []);

  // ═══ REALTIME: HOLIDAYS ═══
  useEffect(() => {
    const unsub = onSnapshot(collection(db, "holidays"), (snap) => {
      const arr = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setHolidays(arr);
    });
    return () => unsub();
  }, []);

  // ═══ PUSH NOTIFICATION on login ═══
  useEffect(() => {
    if (student) {
      const today = new Date().toISOString().split("T")[0];
      const todayIn = attendance.find(a => a.date === today && a.studentId === student.id && a.type === "in");
      if (todayIn) {
        setNotification(`🔔 ${student.studentName} marked Present at ${fmtTime(todayIn.timestamp)} today`);
      } else {
        setNotification(`📱 Welcome! Viewing ${student.studentName}'s dashboard`);
      }
      const t = setTimeout(() => setNotification(null), 4000);
      return () => clearTimeout(t);
    }
  }, [student, attendance.length]);

  const handleLogout = async () => {
    await signOut(auth);
    setStudent(null);
    setNotFound(false);
    setScreen("home");
  };

  // ═══ LOADING STATE ═══
  if (authLoading || studentLoading) return (
    <div style={{ maxWidth: 420, margin: "0 auto", height: "100vh", fontFamily: "'Segoe UI', system-ui, sans-serif", background: "linear-gradient(145deg, #0f172a, #1e40af)", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ textAlign: "center" }}>
        <div style={{ width: 60, height: 60, borderRadius: 20, background: "linear-gradient(135deg, #3b82f6, #1d4ed8)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px" }}>
          <span style={{ fontSize: 24, fontWeight: 900, color: "#fff" }}>PID</span>
        </div>
        <p style={{ color: "#93c5fd", fontSize: 14, fontWeight: 600 }}>Loading...</p>
      </div>
    </div>
  );

  // ═══ NOT LOGGED IN ═══
  if (!user) return (
    <div style={{ maxWidth: 420, margin: "0 auto", height: "100vh", fontFamily: "'Segoe UI', system-ui, sans-serif", overflow: "auto", background: "#0f172a" }}>
      <LoginScreen onLogin={() => {}} loading={authLoading}/>
    </div>
  );

  // ═══ STUDENT NOT FOUND ═══
  if (notFound) return (
    <div style={{ maxWidth: 420, margin: "0 auto", height: "100vh", fontFamily: "'Segoe UI', system-ui, sans-serif", overflow: "auto", background: "#0f172a" }}>
      <NotFoundScreen email={user.email} onLogout={handleLogout}/>
    </div>
  );

  // ═══ STUDENT NOT LOADED YET ═══
  if (!student) return null;

  // ═══ MAIN APP ═══
  return (
    <div style={{ maxWidth: 420, margin: "0 auto", height: "100vh", fontFamily: "'Segoe UI', system-ui, sans-serif", overflow: "hidden", display: "flex", flexDirection: "column", background: "#f8fafc" }}>
      {/* Toast */}
      {notification && (
        <div style={{ position: "absolute", top: 16, left: "50%", transform: "translateX(-50%)", background: "#1e293b", color: "#fff", padding: "10px 18px", borderRadius: 14, fontSize: 12, fontWeight: 600, zIndex: 999, whiteSpace: "nowrap", boxShadow: "0 8px 24px rgba(0,0,0,0.3)", maxWidth: "90%", textOverflow: "ellipsis", overflow: "hidden", animation: "slideDown 0.3s ease" }}>
          {notification}
        </div>
      )}

      {/* Top Bar */}
      <div style={{ background: "#fff", borderBottom: "1px solid #f1f5f9", padding: "16px 20px 12px", display: "flex", justifyContent: "space-between", alignItems: "center", flexShrink: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ width: 28, height: 28, borderRadius: 8, background: "linear-gradient(135deg, #3b82f6, #1d4ed8)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <span style={{ color: "#fff", fontSize: 9, fontWeight: 900 }}>PID</span>
          </div>
          <h1 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: "#1e293b" }}>{screenTitles[screen]}</h1>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#10b981" }}/>
          <span style={{ fontSize: 11, color: "#10b981", fontWeight: 600 }}>Live</span>
        </div>
      </div>

      {/* Screen Content */}
      <div style={{ flex: 1, overflowY: "auto" }}>
        {screen === "home" && <DashboardScreen navigate={setScreen} student={student} attendance={attendance} notices={notices} holidays={holidays}/>}
        {screen === "performance" && <PerformanceScreen student={student}/>}
        {screen === "attendance" && <AttendanceScreen student={student} attendance={attendance} holidays={holidays} leaveApplications={leaveApplications}/>}
        {screen === "notices" && <NoticesScreen notices={notices} holidays={holidays}/>}
        {screen === "profile" && <ProfileScreen student={student} user={user} onLogout={handleLogout}/>}
      </div>

      {/* Bottom Nav */}
      <BottomNav active={screen} navigate={setScreen} noticeCount={notices.length}/>

      <style>{`
        @keyframes slideDown { from { opacity: 0; transform: translateX(-50%) translateY(-10px); } to { opacity: 1; transform: translateX(-50%) translateY(0); } }
        @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }
        * { -webkit-tap-highlight-color: transparent; }
        ::-webkit-scrollbar { display: none; }
      `}</style>
    </div>
  );
}
