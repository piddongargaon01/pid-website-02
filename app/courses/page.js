"use client";
import { useSearchParams } from "next/navigation";
import { useState, useEffect, Suspense } from "react";
import { db } from "../firebase";
import { collection, onSnapshot } from "firebase/firestore";
import Link from "next/link";

// ═══════════════════════════════════════════
// FALLBACK COURSE DATA (used if Firebase is empty)
// ═══════════════════════════════════════════
const fallbackCourseData = {
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
};

const teacherColors = ["#1349A8", "#D98D04", "#16A34A", "#7C3AED", "#DC2626", "#059669"];
const teacherGrads = ["#2A6FE0", "#F5AC10", "#4ADE80", "#A78BFA", "#F87171", "#34D399"];

function CoursesContent() {
  const searchParams = useSearchParams();
  const classParam = searchParams.get("class") || "12";
  const [activeClass, setActiveClass] = useState(classParam);
  const [coursesFromFB, setCoursesFromFB] = useState([]);
  const [loadingFB, setLoadingFB] = useState(true);

  // Realtime Firebase listener for courses
  useEffect(() => {
    const unsub = onSnapshot(collection(db, "courses"), (snap) => {
      const arr = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      arr.sort((a, b) => (a.order || 99) - (b.order || 99));
      setCoursesFromFB(arr);
      setLoadingFB(false);
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    setActiveClass(classParam);
    window.scrollTo(0, 0);
  }, [classParam]);

  // Build course data: Firebase first, fallback to hardcoded
  const fbCourseMap = {};
  coursesFromFB.forEach(c => { if (c.classId) fbCourseMap[c.classId] = c; });

  const courseMap = coursesFromFB.length > 0 ? fbCourseMap : fallbackCourseData;
  const classIds = coursesFromFB.length > 0
    ? coursesFromFB.map(c => c.classId).filter(Boolean)
    : ["12", "11", "10", "9"];

  const course = courseMap[activeClass] || courseMap[classIds[0]] || Object.values(courseMap)[0];

  if (!course) return <div style={{ padding: "120px 20px", textAlign: "center" }}>No courses available.</div>;

  return (
    <>
      {/* Top Bar */}
      <div style={{ background: "linear-gradient(135deg,#062560,#1548B0)", paddingTop: 60, paddingBottom: 40 }}>
        <div className="wrap">
          <Link href="/" style={{ color: "rgba(255,255,255,.7)", fontSize: ".82rem", display: "inline-flex", alignItems: "center", gap: 6, marginBottom: 16 }}>
            <i className="fas fa-arrow-left" /> Back to Home
          </Link>
          <h1 style={{ fontFamily: "'Plus Jakarta Sans',sans-serif", fontSize: "clamp(1.6rem,3vw,2.2rem)", fontWeight: 800, color: "#fff", marginBottom: 6 }}>
            {course.title} — {course.tag}
          </h1>
          <p style={{ color: "rgba(255,255,255,.7)", fontSize: ".88rem", maxWidth: 560 }}>{course.desc}</p>
        </div>
      </div>

      {/* Class Tabs */}
      <div style={{ background: "#fff", borderBottom: "1px solid #E2EAF4", position: "sticky", top: 60, zIndex: 50 }}>
        <div className="wrap" style={{ display: "flex", gap: 0, overflowX: "auto" }}>
          {classIds.map((c) => (
            <button key={c} onClick={() => setActiveClass(c)} style={{
              padding: "14px 24px", border: "none", background: activeClass === c ? "#fff" : "transparent",
              borderBottom: activeClass === c ? "3px solid #1349A8" : "3px solid transparent",
              fontFamily: "'Plus Jakarta Sans',sans-serif", fontWeight: activeClass === c ? 700 : 500,
              fontSize: ".88rem", color: activeClass === c ? "#1349A8" : "#4A5E78",
              cursor: "pointer", whiteSpace: "nowrap", transition: "all .2s"
            }}>
              {courseMap[c]?.title || `Class ${c}`}
            </button>
          ))}
        </div>
      </div>

      <div style={{ background: "#F0F4FA", minHeight: "60vh" }}>
        <div className="wrap" style={{ padding: "32px 20px" }}>

          {/* Duration */}
          {course.duration && (
            <div style={{ background: "#fff", borderRadius: 14, padding: 20, marginBottom: 20, border: "1px solid #D4DEF0" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
                <div style={{ width: 36, height: 36, borderRadius: 8, background: "#EFF6FF", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <i className="fas fa-calendar-alt" style={{ color: "#1349A8", fontSize: ".85rem" }} />
                </div>
                <h3 style={{ fontSize: ".92rem", fontWeight: 700 }}>Course Duration</h3>
              </div>
              <p style={{ fontSize: ".84rem", color: "#4A5E78", lineHeight: 1.6 }}>{course.duration}</p>
            </div>
          )}

          {/* Batches Table */}
          {course.batches && course.batches.length > 0 && (
            <div style={{ background: "#fff", borderRadius: 14, padding: 20, marginBottom: 20, border: "1px solid #D4DEF0" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
                <div style={{ width: 36, height: 36, borderRadius: 8, background: "#FFFBEB", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <i className="fas fa-layer-group" style={{ color: "#D98D04", fontSize: ".85rem" }} />
                </div>
                <h3 style={{ fontSize: ".92rem", fontWeight: 700 }}>Available Batches</h3>
              </div>
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: ".82rem" }}>
                  <thead>
                    <tr style={{ background: "#F0F4FA" }}>
                      <th style={{ padding: "10px 14px", textAlign: "left", fontWeight: 700, color: "#0B1826", borderBottom: "2px solid #D4DEF0" }}>Medium</th>
                      <th style={{ padding: "10px 14px", textAlign: "left", fontWeight: 700, color: "#0B1826", borderBottom: "2px solid #D4DEF0" }}>Board</th>
                      <th style={{ padding: "10px 14px", textAlign: "left", fontWeight: 700, color: "#0B1826", borderBottom: "2px solid #D4DEF0" }}>Batch Type</th>
                      <th style={{ padding: "10px 14px", textAlign: "left", fontWeight: 700, color: "#0B1826", borderBottom: "2px solid #D4DEF0" }}>Regular</th>
                      <th style={{ padding: "10px 14px", textAlign: "left", fontWeight: 700, color: "#0B1826", borderBottom: "2px solid #D4DEF0" }}>Crash</th>
                    </tr>
                  </thead>
                  <tbody>
                    {course.batches.map((b, i) => (
                      <tr key={i} style={{ borderBottom: "1px solid #E8EFF8" }}>
                        <td style={{ padding: "10px 14px", color: "#1C2E44" }}>{b.medium}</td>
                        <td style={{ padding: "10px 14px", color: "#1C2E44" }}>{b.board}</td>
                        <td style={{ padding: "10px 14px" }}>
                          <span style={{ background: "#EFF6FF", color: "#1349A8", padding: "3px 10px", borderRadius: 99, fontSize: ".72rem", fontWeight: 700 }}>{b.type}</span>
                        </td>
                        <td style={{ padding: "10px 14px", color: "#1C2E44" }}>{b.regular}</td>
                        <td style={{ padding: "10px 14px", color: "#1C2E44" }}>{b.crash}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Subjects & Features - 2 column */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, marginBottom: 20 }}>
            {/* Subjects */}
            {course.subjects && course.subjects.length > 0 && (
              <div style={{ background: "#fff", borderRadius: 14, padding: 20, border: "1px solid #D4DEF0" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
                  <div style={{ width: 36, height: 36, borderRadius: 8, background: "#F0FDF4", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <i className="fas fa-book" style={{ color: "#16A34A", fontSize: ".85rem" }} />
                  </div>
                  <h3 style={{ fontSize: ".92rem", fontWeight: 700 }}>Subjects Covered</h3>
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                  {course.subjects.map((sub, i) => (
                    <span key={i} style={{ background: "#F0FDF4", color: "#166534", padding: "6px 14px", borderRadius: 99, fontSize: ".78rem", fontWeight: 600 }}>{sub}</span>
                  ))}
                </div>
              </div>
            )}

            {/* Features */}
            {course.features && course.features.length > 0 && (
              <div style={{ background: "#fff", borderRadius: 14, padding: 20, border: "1px solid #D4DEF0" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
                  <div style={{ width: 36, height: 36, borderRadius: 8, background: "#FAF5FF", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <i className="fas fa-star" style={{ color: "#7C3AED", fontSize: ".85rem" }} />
                  </div>
                  <h3 style={{ fontSize: ".92rem", fontWeight: 700 }}>What You Get</h3>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {course.features.map((f, i) => (
                    <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: ".8rem", color: "#1C2E44" }}>
                      <i className="fas fa-check-circle" style={{ color: "#22C55E", fontSize: ".72rem" }} /> {f}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* ═══ TEACHERS WITH PHOTOS ═══ */}
          {course.teachers && course.teachers.length > 0 && (
            <div style={{ background: "#fff", borderRadius: 14, padding: 20, marginBottom: 20, border: "1px solid #D4DEF0" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
                <div style={{ width: 36, height: 36, borderRadius: 8, background: "#EFF6FF", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <i className="fas fa-chalkboard-teacher" style={{ color: "#1349A8", fontSize: ".85rem" }} />
                </div>
                <h3 style={{ fontSize: ".92rem", fontWeight: 700 }}>Faculty for {course.title}</h3>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 16 }}>
                {course.teachers.map((t, i) => (
                  <div key={i} style={{ background: "#F8FAFD", borderRadius: 14, overflow: "hidden", border: "1px solid #E8EFF8", textAlign: "center", transition: "all .25s" }}
                    onMouseEnter={e => { e.currentTarget.style.transform = "translateY(-4px)"; e.currentTarget.style.boxShadow = "0 8px 24px rgba(7,41,107,.1)"; }}
                    onMouseLeave={e => { e.currentTarget.style.transform = "none"; e.currentTarget.style.boxShadow = "none"; }}>
                    {/* Teacher Photo */}
                    <div style={{
                      width: "100%", height: 180,
                      background: `linear-gradient(135deg, ${teacherColors[i % 6]}, ${teacherGrads[i % 6]})`,
                      display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden",
                      position: "relative"
                    }}>
                      {t.photo && t.photo.startsWith("http") ? (
                        <img src={t.photo} alt={t.name} style={{ width: "100%", height: "100%", objectFit: "cover" }}
                          onError={(e) => { e.currentTarget.style.display = "none"; e.currentTarget.nextSibling.style.display = "flex"; }} />
                      ) : null}
                      <div style={{
                        width: "100%", height: "100%", display: (t.photo && t.photo.startsWith("http")) ? "none" : "flex",
                        alignItems: "center", justifyContent: "center", position: "absolute", inset: 0
                      }}>
                        <i className="fas fa-user-tie" style={{ fontSize: "3rem", color: "rgba(255,255,255,.25)" }} />
                      </div>
                    </div>
                    {/* Teacher Info */}
                    <div style={{ padding: 14 }}>
                      <div style={{ fontWeight: 700, fontSize: ".9rem", color: "#0B1826", marginBottom: 2 }}>{t.name}</div>
                      <div style={{ fontSize: ".78rem", color: "#1349A8", fontWeight: 600, marginBottom: 8 }}>{t.subject}</div>
                      <div style={{ fontSize: ".74rem", color: "#4A5E78", lineHeight: 1.6 }}>
                        <div><i className="fas fa-graduation-cap" style={{ marginRight: 6, fontSize: ".65rem", color: "#6B7F99" }} />{t.qual}</div>
                        <div><i className="fas fa-briefcase" style={{ marginRight: 6, fontSize: ".65rem", color: "#6B7F99" }} />{t.exp} experience</div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Fees */}
          {course.fees && course.fees.length > 0 && (
            <div style={{ background: "#fff", borderRadius: 14, padding: 20, marginBottom: 20, border: "1px solid #D4DEF0" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
                <div style={{ width: 36, height: 36, borderRadius: 8, background: "#FEF3C7", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <i className="fas fa-rupee-sign" style={{ color: "#D98D04", fontSize: ".85rem" }} />
                </div>
                <h3 style={{ fontSize: ".92rem", fontWeight: 700 }}>Fee Structure</h3>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 12 }}>
                {course.fees.map((f, i) => (
                  <div key={i} style={{ background: "#FFFBEB", borderRadius: 12, padding: 16, textAlign: "center", border: "1px solid #FDE68A" }}>
                    <div style={{ fontSize: "1.2rem", fontWeight: 800, color: "#92400E", fontFamily: "'Plus Jakarta Sans',sans-serif" }}>{f.amount}</div>
                    <div style={{ fontSize: ".76rem", color: "#78350F", marginTop: 4 }}>{f.label}</div>
                  </div>
                ))}
              </div>
              <p style={{ fontSize: ".75rem", color: "#6B7F99", marginTop: 12, fontStyle: "italic" }}>
                * Admission Fee: ₹500 (Non-refundable). Installment options available. Contact us for scholarship details.
              </p>
            </div>
          )}

          {/* CTA */}
          <div style={{ background: "linear-gradient(135deg,#062560,#1548B0)", borderRadius: 14, padding: 28, textAlign: "center" }}>
            <h3 style={{ color: "#fff", fontSize: "1.1rem", fontWeight: 700, marginBottom: 6 }}>Ready to Join {course.title}?</h3>
            <p style={{ color: "rgba(255,255,255,.7)", fontSize: ".84rem", marginBottom: 18 }}>Enroll now or enquire for more details. Limited seats available!</p>
            <div style={{ display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap" }}>
              <Link href="/#enquiry" className="btn ba">Enquire Now <i className="fas fa-arrow-right" /></Link>
              <a href="https://wa.me/918319002877" target="_blank" rel="noopener noreferrer" className="btn bo">
                <i className="fab fa-whatsapp" /> WhatsApp Us
              </a>
            </div>
          </div>

        </div>
      </div>
    </>
  );
}

export default function CoursesPage() {
  return (
    <>
      {/* Navbar */}
      <nav id="nav" className="sd">
        <div className="ni">
          <Link href="/" className="nlogo"><img src="/pid_logo.png" alt="PID" /><div className="nlt"><strong>PID</strong><span>Excellence in Education</span></div></Link>
          <ul className="nlinks"><li><Link href="/#about">About</Link></li><li><Link href="/#courses">Courses</Link></li><li><Link href="/#results">Results</Link></li><li><Link href="/#portal">Student Portal</Link></li><li><Link href="/#events">Events</Link></li><li><Link href="/#contact">Contact</Link></li></ul>
          <Link href="/#enquiry" className="btn ba bsm nenq">Enquire Now</Link>
        </div>
      </nav>

      <Suspense fallback={<div style={{ padding: "120px 20px", textAlign: "center" }}>Loading courses...</div>}>
        <CoursesContent />
      </Suspense>

      {/* WhatsApp Float */}
      <a href="https://wa.me/918319002877" target="_blank" rel="noopener noreferrer" className="wa-float"><i className="fab fa-whatsapp" /></a>
    </>
  );
}
