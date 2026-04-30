"use client";
import { useState, useEffect } from "react";
import { db } from "../firebase";
import { collection, onSnapshot } from "firebase/firestore";
import Link from "next/link";

export default function AppsPage() {
  const [apps, setApps] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = onSnapshot(collection(db, "pid_apps"), (snap) => {
      const arr = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      arr.sort((a, b) => (a.order || 99) - (b.order || 99));
      setApps(arr);
      setLoading(false);
    });
    return () => unsub();
  }, []);

  const studentApps = apps.filter(a => a.type === "student" || !a.type);
  const parentApps = apps.filter(a => a.type === "parent");
  const otherApps = apps.filter(a => a.type === "other");

  const AppCard = ({ app }) => (
    <div style={{
      background: "#fff", borderRadius: 20, padding: 28,
      boxShadow: "0 4px 24px rgba(0,0,0,.07)", border: "1px solid #E8EFF8",
      display: "flex", flexDirection: "column", gap: 16,
      transition: "transform .2s, box-shadow .2s",
    }}
      onMouseEnter={e => { e.currentTarget.style.transform = "translateY(-4px)"; e.currentTarget.style.boxShadow = "0 12px 40px rgba(0,0,0,.12)"; }}
      onMouseLeave={e => { e.currentTarget.style.transform = ""; e.currentTarget.style.boxShadow = "0 4px 24px rgba(0,0,0,.07)"; }}
    >
      {/* App Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
        {app.logo ? (
          <img src={app.logo} alt={app.name} style={{ width: 72, height: 72, borderRadius: 18, objectFit: "cover", border: "1px solid #E8EFF8" }} />
        ) : (
          <div style={{
            width: 72, height: 72, borderRadius: 18,
            background: app.type === "parent"
              ? "linear-gradient(135deg,#FEF3C7,#FDE68A)"
              : "linear-gradient(135deg,#EFF6FF,#DBEAFE)",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <i className="fas fa-mobile-alt" style={{ fontSize: "1.8rem", color: app.type === "parent" ? "#D97706" : "#1349A8" }} />
          </div>
        )}
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: "1.1rem", fontWeight: 800, color: "#0F172A" }}>{app.name}</div>
          <div style={{ display: "flex", gap: 6, marginTop: 6, flexWrap: "wrap" }}>
            <span style={{
              fontSize: ".72rem", fontWeight: 700, padding: "3px 10px", borderRadius: 99,
              background: app.type === "parent" ? "#FEF3C7" : "#EFF6FF",
              color: app.type === "parent" ? "#B45309" : "#1349A8",
            }}>
              {app.type === "parent" ? "👨‍👩‍👧 Parent App" : app.type === "student" ? "🎒 Student App" : "📱 App"}
            </span>
            {app.version && (
              <span style={{ fontSize: ".72rem", color: "#64748B", padding: "3px 10px", borderRadius: 99, background: "#F1F5F9" }}>
                v{app.version}
              </span>
            )}
            {app.fileSize && (
              <span style={{ fontSize: ".72rem", color: "#64748B", padding: "3px 10px", borderRadius: 99, background: "#F1F5F9" }}>
                <i className="fas fa-download" style={{ marginRight: 4 }} />{app.fileSize}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Description */}
      {app.description && (
        <p style={{ fontSize: ".88rem", color: "#475569", margin: 0, lineHeight: 1.6 }}>
          {app.description}
        </p>
      )}

      {/* Download Button */}
      <a
        href={app.downloadUrl}
        target="_blank"
        rel="noopener noreferrer"
        style={{
          display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
          background: "linear-gradient(135deg,#1349A8,#2563EB)",
          color: "#fff", padding: "14px 24px", borderRadius: 12,
          fontWeight: 700, fontSize: ".92rem", textDecoration: "none",
          boxShadow: "0 4px 14px rgba(19,73,168,.3)",
          transition: "opacity .2s",
        }}
        onMouseEnter={e => e.currentTarget.style.opacity = ".9"}
        onMouseLeave={e => e.currentTarget.style.opacity = "1"}
      >
        <i className="fas fa-download" style={{ fontSize: "1rem" }} />
        Download {app.name}
        {app.fileSize && <span style={{ opacity: .8, fontSize: ".78rem" }}>({app.fileSize})</span>}
      </a>

      {/* Security Note */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: ".74rem", color: "#64748B" }}>
        <i className="fas fa-shield-alt" style={{ color: "#16A34A" }} />
        <span>Official PID app — safe to install. Enable "Unknown Sources" if needed.</span>
      </div>
    </div>
  );

  const Section = ({ title, icon, items }) => {
    if (items.length === 0) return null;
    return (
      <div style={{ marginBottom: 48 }}>
        <h2 style={{ fontSize: "1.3rem", fontWeight: 800, color: "#0F172A", marginBottom: 20, display: "flex", alignItems: "center", gap: 10 }}>
          <span>{icon}</span> {title}
        </h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(300px,1fr))", gap: 20 }}>
          {items.map(app => <AppCard key={app.id} app={app} />)}
        </div>
      </div>
    );
  };

  return (
    <>
      {/* Navbar */}
      <nav id="nav" className="sd">
        <div className="ni">
          <Link href="/" className="nlogo">
            <img src="/pid_logo.png" alt="PID" />
            <div className="nlt"><strong>PID</strong><span>Excellence in Education</span></div>
          </Link>
          <ul className="nlinks">
            <li><Link href="/#about">About</Link></li>
            <li><Link href="/courses">Courses</Link></li>
            <li><Link href="/toppers">Results</Link></li>
            <li><Link href="/student-portal">Student Portal</Link></li>
            <li><Link href="/events">Events</Link></li>
            <li><Link href="/apps" style={{ color: "#F5AC10", fontWeight: 700 }}>App</Link></li>
            <li><Link href="/#contact">Contact</Link></li>
          </ul>
          <Link href="/#enquiry" className="btn ba bsm nenq">Enquire Now</Link>
        </div>
      </nav>

      {/* Hero Header */}
      <div style={{ background: "linear-gradient(135deg,#062560,#1548B0)", paddingTop: 80, paddingBottom: 48 }}>
        <div className="wrap">
          <Link href="/" style={{ color: "rgba(255,255,255,.7)", fontSize: ".82rem", display: "inline-flex", alignItems: "center", gap: 6, marginBottom: 20 }}>
            <i className="fas fa-arrow-left" /> Back to Home
          </Link>
          <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 12 }}>
            <div style={{ width: 56, height: 56, borderRadius: 16, background: "rgba(255,255,255,.15)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <i className="fas fa-mobile-alt" style={{ fontSize: "1.6rem", color: "#F5AC10" }} />
            </div>
            <div>
              <h1 style={{ fontFamily: "'Plus Jakarta Sans',sans-serif", fontSize: "clamp(1.6rem,3vw,2.2rem)", fontWeight: 800, color: "#fff", margin: 0 }}>
                PID Apps
              </h1>
              <p style={{ color: "rgba(255,255,255,.7)", fontSize: ".88rem", margin: "4px 0 0" }}>
                Patel Institute Dongargaon ke official mobile apps
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* How to Install Banner */}
      <div style={{ background: "#FFF7ED", borderBottom: "1px solid #FDE68A" }}>
        <div className="wrap" style={{ padding: "14px 0", display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <i className="fas fa-info-circle" style={{ color: "#D97706", fontSize: "1rem", flexShrink: 0 }} />
          <span style={{ fontSize: ".84rem", color: "#92400E" }}>
            <strong>APK Install kaise karein?</strong> Download ke baad Settings → Security → Unknown Sources ON karo, phir APK file install karo.
          </span>
        </div>
      </div>

      {/* Apps Section */}
      <div className="wrap" style={{ paddingTop: 48, paddingBottom: 64 }}>
        {loading ? (
          <div style={{ textAlign: "center", padding: "80px 0", color: "#64748B" }}>
            <i className="fas fa-spinner fa-spin" style={{ fontSize: "2rem", marginBottom: 16, display: "block", color: "#1349A8" }} />
            <p style={{ fontWeight: 600 }}>Loading apps...</p>
          </div>
        ) : apps.length === 0 ? (
          <div style={{ textAlign: "center", padding: "80px 0", color: "#64748B" }}>
            <i className="fas fa-mobile-alt" style={{ fontSize: "3rem", marginBottom: 16, display: "block", color: "#BAC8D8" }} />
            <h3 style={{ fontWeight: 700, marginBottom: 8 }}>Abhi koi app available nahi hai</h3>
            <p style={{ fontSize: ".88rem" }}>Jald hi PID Student App aur Parent App yahan milegi.</p>
          </div>
        ) : (
          <>
            <Section title="Student App" icon="🎒" items={studentApps} />
            <Section title="Parent App" icon="👨‍👩‍👧" items={parentApps} />
            <Section title="Other Apps" icon="📱" items={otherApps} />
          </>
        )}

        {/* Features Grid */}
        <div style={{ marginTop: 32, display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(220px,1fr))", gap: 16 }}>
          {[
            { icon: "fa-id-card-alt", c: "#1349A8", t: "RFID Attendance", d: "Real-time check-in/out notification" },
            { icon: "fa-bell", c: "#7C3AED", t: "Push Notifications", d: "Exam alerts, fee reminders, notices" },
            { icon: "fa-chart-line", c: "#059669", t: "Performance Tracking", d: "Test results aur progress dekhein" },
            { icon: "fa-book", c: "#D97706", t: "Study Materials", d: "Notes, PDFs aur videos offline bhi" },
          ].map((f, i) => (
            <div key={i} style={{ background: "#fff", borderRadius: 14, padding: 20, border: "1px solid #E8EFF8", display: "flex", gap: 14, alignItems: "flex-start" }}>
              <div style={{ width: 40, height: 40, borderRadius: 10, background: `${f.c}14`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <i className={`fas ${f.icon}`} style={{ color: f.c, fontSize: ".9rem" }} />
              </div>
              <div>
                <div style={{ fontWeight: 700, fontSize: ".85rem", color: "#0F172A" }}>{f.t}</div>
                <div style={{ fontSize: ".78rem", color: "#64748B", marginTop: 3 }}>{f.d}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Footer */}
      <footer style={{ background: "#0C1F36", color: "#9FB8CF", padding: "24px 0", textAlign: "center" }}>
        <div className="wrap">
          <p style={{ fontSize: ".82rem", margin: 0 }}>
            © {new Date().getFullYear()} Patel Institute Dongargaon — All Rights Reserved
          </p>
          <div style={{ display: "flex", justifyContent: "center", gap: 16, marginTop: 8 }}>
            <Link href="/" style={{ color: "#9FB8CF", fontSize: ".78rem" }}>Home</Link>
            <Link href="/student-app-privacy-policy" style={{ color: "#9FB8CF", fontSize: ".78rem" }}>Privacy Policy</Link>
            <Link href="/terms" style={{ color: "#9FB8CF", fontSize: ".78rem" }}>Terms</Link>
          </div>
        </div>
      </footer>
    </>
  );
}
