"use client";
import { db, auth, googleProvider } from "./firebase";
import { collection, getDocs, addDoc, serverTimestamp, onSnapshot } from "firebase/firestore";
import { signInWithPopup, signOut, onAuthStateChanged } from "firebase/auth";
import { useEffect, useState, useRef } from "react";
import Link from "next/link";

export default function Home() {
  const [user, setUser] = useState(null);
  const [mm, setMm] = useState(false);
  const [sd, setSd] = useState(false);
  const [cs, setCs] = useState(0);
  const [sp, setSp] = useState(false);
  const [isFading, setIsFading] = useState(false);
  const [reviews, setReviews] = useState([]);
  const [toppers, setToppers] = useState([]);
  const [events, setEvents] = useState([]);
  const [teachers, setTeachers] = useState([]);
  const [rn, setRn] = useState("");
  const [rt, setRt] = useState("");
  const [rr, setRr] = useState("");
  const [rs, setRs] = useState(5);
  const [rSub, setRSub] = useState(false);
  const [rL, setRL] = useState(false);
  const [en, setEn] = useState("");
  const [ec, setEc] = useState("");
  const [ep, setEp] = useState("");
  const [epa, setEpa] = useState("");
  const [em, setEm] = useState("");
  const [eb, setEb] = useState("");
  const [emed, setEmed] = useState("");
  const [ea, setEa] = useState("");
  const [eSub, setESub] = useState(false);
  const [heroBanner, setHeroBanner] = useState("/hero_board.png");
  const slides = Array.from({length:12},(_,i)=>`/slide_${String(i+1).padStart(2,"0")}.jpeg`);

  useEffect(()=>{const u=onAuthStateChanged(auth,u=>setUser(u));return()=>u();},[]);
  useEffect(()=>{const h=()=>setSd(window.scrollY>40);window.addEventListener("scroll",h);return()=>window.removeEventListener("scroll",h);},[]);

  // ── ENHANCED SCROLL ANIMATIONS (AOS-style) ──
  useEffect(()=>{
    const els = document.querySelectorAll(".rv, .rv-left, .rv-right, .rv-zoom");
    if("IntersectionObserver" in window){
      const o = new IntersectionObserver(entries => {
        entries.forEach(e => {
          if(e.isIntersecting){ e.target.classList.add("on"); o.unobserve(e.target); }
        });
      }, { threshold: 0.08, rootMargin: "0px 0px -40px 0px" });
      els.forEach(el => o.observe(el));
      return () => { els.forEach(el => o.unobserve(el)); o.disconnect(); };
    } else { els.forEach(el => el.classList.add("on")); }
  });
  useEffect(()=>{const t=setTimeout(()=>{document.querySelectorAll(".rv, .rv-left, .rv-right, .rv-zoom").forEach(el=>el.classList.add("on"));},3500);return()=>clearTimeout(t);},[]);

  // Slider with crossfade
  const goSlide = (next) => { setIsFading(true); setTimeout(()=>{ setCs(next); setIsFading(false); }, 300); };
  useEffect(()=>{if(sp)return;const i=setInterval(()=>{ goSlide((cs+1)%slides.length); },3500);return()=>clearInterval(i);},[sp,cs,slides.length]);

  // ── REALTIME FIREBASE LISTENERS ──
  useEffect(()=>{const u=onSnapshot(collection(db,"reviews"),(s)=>{const a=[];s.forEach(d=>{const x=d.data();if(x.approved)a.push({id:d.id,...x});});setReviews(a);});return()=>u();},[]);
  useEffect(()=>{const u=onSnapshot(collection(db,"featured_toppers"),(s)=>{const a=[];s.forEach(d=>a.push({id:d.id,...d.data()}));setToppers(a);});return()=>u();},[]);
  useEffect(()=>{const u=onSnapshot(collection(db,"events"),(s)=>{const a=[];s.forEach(d=>a.push({id:d.id,...d.data()}));setEvents(a);});return()=>u();},[]);
  useEffect(()=>{const u=onSnapshot(collection(db,"public"),(s)=>{s.forEach(d=>{const data=d.data();if(data.heroBanner) setHeroBanner(data.heroBanner);});});return()=>u();},[]);
  // Teachers from Firebase
  useEffect(()=>{const u=onSnapshot(collection(db,"teachers"),(s)=>{const a=s.docs.map(d=>({id:d.id,...d.data()}));a.sort((a,b)=>(a.order||99)-(b.order||99));setTeachers(a);});return()=>u();},[]);

  const login=async()=>{try{await signInWithPopup(auth,googleProvider);}catch(e){}};
  const subReview=async()=>{if(!rn.trim()||!rt.trim()){alert("Please fill Name and Review");return;}setRL(true);try{await addDoc(collection(db,"reviews"),{name:rn,text:rt,role:rr||"Student/Parent",stars:rs,approved:false,createdAt:serverTimestamp()});setRSub(true);setRn("");setRt("");setRr("");setRs(5);setTimeout(()=>setRSub(false),5000);}catch(e){console.log("Review Error:",e);alert("Error submitting. Try again.");}setRL(false);};
  const subEnq=async()=>{if(!en.trim()||!ep.trim()){alert("Please fill Student Name and Phone Number");return;}try{await addDoc(collection(db,"enquiries"),{name:en,class:ec,phone:ep,parent:epa,message:em,board:eb,medium:emed,address:ea,createdAt:serverTimestamp()});setESub(true);setEn("");setEc("");setEp("");setEpa("");setEm("");setEb("");setEmed("");setEa("");setTimeout(()=>setESub(false),5000);}catch(e){console.log("Enquiry Error:",e);alert("Error submitting. Try again.");}};

  const colors=["#1349A8","#D98D04","#16A34A","#7C3AED"];
  const facColors=["#1349A8","#D98D04","#16A34A","#7C3AED","#DC2626","#059669","#2563EB","#9333EA","#CA8A04","#0891B2"];
  const facGrads=["#2A6FE0","#F5AC10","#4ADE80","#A78BFA","#F87171","#34D399","#60A5FA","#C084FC","#FACC15","#22D3EE"];

  return(<>
{/* NAV */}
<nav id="nav" className={sd?"sd":""}>s
<div className="ni">
<a href="#hero" className="nlogo"><img src="/pid_logo.png" alt="PID"/><div className="nlt"><strong>PID</strong><span>Patel Institute Dongargaon</span></div></a>
<ul className="nlinks"><li><a href="#about">About</a></li><li><Link href="/courses">Courses</Link></li><li><Link href="/toppers">Results</Link></li><li><Link href="/student-portal">Student Portal</Link></li><li><Link href="/events">Events</Link></li><li><a href="#contact">Contact</a></li></ul>
<a href="#enquiry" className="btn bp bsm nenq">Enquire Now</a>
<button className="hbg" onClick={()=>setMm(!mm)}><span/><span/><span/></button>
</div>
{mm&&<div className="mmenu op"><ul><li><a href="#about" onClick={()=>setMm(false)}>About</a></li><li><Link href="/courses" onClick={()=>setMm(false)}>Courses</Link></li><li><Link href="/toppers" onClick={()=>setMm(false)}>Results</Link></li><li><Link href="/student-portal" onClick={()=>setMm(false)}>Student Portal</Link></li><li><Link href="/events" onClick={()=>setMm(false)}>Events</Link></li><li><a href="#contact" onClick={()=>setMm(false)}>Contact</a></li></ul><a href="#enquiry" className="btn ba" onClick={()=>setMm(false)} style={{width:"100%",justifyContent:"center",marginTop:12}}>Enquire Now</a></div>}
</nav>

{/* HERO */}
<section className="hero" id="hero">
<div className="hi">
<div>
<div className="hbadge"><span className="dot"/>Admissions Open 2025–26</div>
<h1 className="htitle">PATEL INSTITUTE<br/><span className="hl" style={{fontSize:"clamp(2.8rem,6vw,4.2rem)"}}>DONGARGAON</span></h1>
<p className="htagline">Knowledge is Power</p>
<p className="hdesc">Premier coaching institute for Class 2-12 students, offering comprehensive preparation for CG Board, CBSE, ICSE, and competitive exams including JEE, NEET, and Navodaya. Powered by cutting-edge AI learning platform.</p>
<div className="hbtns"><a href="#courses" className="btn ba">View Courses <i className="fas fa-arrow-right"/></a><a href="#enquiry" className="btn bo">Enquire Now</a></div>
<div className="hstats"><div className="sc"><div className="sn">5000+</div><div className="sl">Students Taught</div></div><div className="sc"><div className="sn">99%</div><div className="sl">Pass Rate</div></div><div className="sc"><div className="sn">13+</div><div className="sl">Years</div></div></div>
</div>
<div className="hero-img"><img src={heroBanner} alt="Patel Institute Dongargaon"/></div>
</div>
</section>

{/* ABOUT */}
<section id="about" className="spad" style={{background:"#fff"}}>
<div className="wrap"><div className="g2">
<div className="rv-left">
<div className="slider-container" onMouseEnter={()=>setSp(true)} onMouseLeave={()=>setSp(false)} onTouchStart={()=>setSp(true)} onTouchEnd={()=>setSp(false)}>
<div className="slider-crossfade">{slides.map((s,i)=><img key={i} src={s} alt={`PID ${i+1}`} className={`slider-img ${i===cs?"active":""} ${isFading?"fading":""}`}/>)}</div>
<button className="slider-btn slider-prev" onClick={()=>goSlide((cs-1+slides.length)%slides.length)}><i className="fas fa-chevron-left"/></button>
<button className="slider-btn slider-next" onClick={()=>goSlide((cs+1)%slides.length)}><i className="fas fa-chevron-right"/></button>
<div className="slider-dots">{slides.map((_,i)=><span key={i} className={`slider-dot ${i===cs?"active":""}`} onClick={()=>goSlide(i)}/>)}</div>
</div>
<span className="abadge">13+ Years of Excellence</span>
</div>
<div className="rv-right">
<span className="stag">About PID</span>
<h2 className="stitle">Who We Are</h2>
<div className="sbar"/>
<p style={{color:"var(--t2)",lineHeight:"1.75",marginBottom:10,fontSize:".86rem"}}>Patel Institute Dongargaon (PID) is an educational organization that provides extra guidance and support to students outside regular school education. It helps students understand difficult subjects, improve their academic performance and prepare for various school exams and competitive exams.</p>
<p style={{color:"var(--t2)",lineHeight:"1.75",fontSize:".86rem"}}>Established in 2012-13, our institute uses experienced teachers, structural study materials, reference books, regular tests, DPP & PYQS to build strong foundations for future success.</p>
<div className="wg">
{[{icon:"fa-eye",bg:"#2563EB",bbg:"#EFF6FF",t:"Vision",d:"To develop knowledgeable, confident and responsible students who can achieve their goals."},{icon:"fa-bullseye",bg:"#D97706",bbg:"#FFFBEB",t:"Mission",d:"Quality education, creative thinking, discipline, and preparing students for higher education."},{icon:"fa-users",bg:"#16A34A",bbg:"#F0FDF4",t:"Expert Faculty",d:"10+ qualified teachers with 4-15 years of experience in Physics, Chemistry, Maths, Biology."},{icon:"fa-chart-line",bg:"#7C3AED",bbg:"#FAF5FF",t:"Proven Results",d:"99% pass rate. Students secured top 10 ranks in state, district & tahsil consistently."}].map((w,i)=><div className={`wi rv-zoom rv-d${i+1}`} key={i} style={{background:w.bbg}}><div className="wii" style={{background:w.bg}}><i className={`fas ${w.icon}`} style={{color:"#fff",fontSize:".78rem"}}/></div><div className="wit">{w.t}</div><div className="wid">{w.d}</div></div>)}
</div>
</div>
</div></div>
</section>

{/* ═══════════════════════════════════════════ */}
{/* DIRECTORS SECTION — COMPACT */}
{/* ═══════════════════════════════════════════ */}
<section id="directors" className="spad">
<div className="wrap">
<div className="tc rv" style={{marginBottom:32}}>
  <span className="stag">Our Leadership</span>
  <h2 className="stitle">Meet Our Directors</h2>
  <div className="sbar c"/>
  <p className="ssub">Dedicated leaders with a vision to transform education in Dongargaon since 2012</p>
</div>

<div className="dir-grid">
  {/* Director 1 — Mr. Temlal Patel */}
  <div className="dir-card rv-left">
    <div className="dir-left">
      <div className="dir-photo">
        <img src="/director_temlal.jpg" alt="Mr. Temlal Patel"
          onError={(e)=>{e.currentTarget.style.display='none';e.currentTarget.nextSibling.style.display='flex';}}/>
        <div className="dir-fallback"><i className="fas fa-user-tie"/></div>
      </div>
      <div className="dir-exp-tag"><i className="fas fa-award"/> 15 Yrs</div>
    </div>
    <div className="dir-right">
      <div className="dir-role-tag"><i className="fas fa-crown"/> Founder & Director</div>
      <h3 className="dir-name">Mr. Temlal Patel</h3>
      <div className="dir-details">
        <div className="dir-detail"><i className="fas fa-graduation-cap"/> BSc. Maths, MSc. Physics, B.Ed</div>
        <div className="dir-detail"><i className="fas fa-atom"/> Physics — Class 9, 11 & 12</div>
        <div className="dir-detail"><i className="fas fa-briefcase"/> 15 years teaching experience</div>
      </div>
      <div className="dir-quote">
        <i className="fas fa-quote-left"/>
        <span>"Education is the key to success. With hard work, dedication, and the right guidance, every student can achieve great success."</span>
      </div>
    </div>
  </div>

  {/* Director 2 — Mrs. Hemlata Patel */}
  <div className="dir-card rv-right">
    <div className="dir-left">
      <div className="dir-photo">
        <img src="/director_hemlata.jpg" alt="Mrs. Hemlata Patel"
          onError={(e)=>{e.currentTarget.style.display='none';e.currentTarget.nextSibling.style.display='flex';}}/>
        <div className="dir-fallback"><i className="fas fa-user-tie"/></div>
      </div>
      <div className="dir-exp-tag" style={{background:"#D98D04"}}><i className="fas fa-award"/> 10 Yrs</div>
    </div>
    <div className="dir-right">
      <div className="dir-role-tag" style={{background:"#FEF3C7",color:"#92400E"}}><i className="fas fa-star"/> Co-Director & Academic Head</div>
      <h3 className="dir-name">Mrs. Hemlata Patel</h3>
      <div className="dir-details">
        <div className="dir-detail"><i className="fas fa-graduation-cap"/> BCA, MSc. Maths, D.El.Ed</div>
        <div className="dir-detail"><i className="fas fa-calculator"/> Maths & All Subjects — Class 2-8, Navodaya, Prayas</div>
        <div className="dir-detail"><i className="fas fa-briefcase"/> 10 years teaching experience</div>
      </div>
      <div className="dir-quote">
        <i className="fas fa-quote-left"/>
        <span>"Strong foundation in early years is the key to success in higher education and competitive exams."</span>
      </div>
    </div>
  </div>
</div>

{/* Director Message */}
<div className="rv" style={{marginTop:20,background:"#fff",borderRadius:14,border:"1px solid var(--bord)",padding:"20px 24px"}}>
  <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:10}}>
    <i className="fas fa-envelope-open-text" style={{color:"var(--blue)",fontSize:".85rem"}}/>
    <h4 style={{fontSize:".9rem",fontWeight:700,color:"var(--t1)"}}>Director&apos;s Message</h4>
  </div>
  <p style={{fontSize:".82rem",color:"var(--t2)",lineHeight:1.75,fontStyle:"italic"}}>"It gives me great pleasure to welcome you to our institute. Our aim is to provide quality education and guide students towards achieving their goals. At our institute we focus not only on academic excellence but also on building confidence, discipline, and strong character. We believe that with hard work, dedication, and the right guidance, every student can achieve great success. I encourage all students to stay focused, work sincerely, and make the best use of the opportunities and resources provided."</p>
  <p style={{fontSize:".78rem",color:"var(--t3)",marginTop:8,fontWeight:600}}>— Mr. Temlal Patel, Founder & Director</p>
</div>

{/* Registration Info */}
<div className="rv" style={{marginTop:14,background:"#F8FAFD",borderRadius:12,border:"1px solid var(--bord)",padding:"14px 20px",display:"flex",alignItems:"center",justifyContent:"center",gap:10,flexWrap:"wrap",textAlign:"center"}}>
  <i className="fas fa-certificate" style={{color:"var(--gold)",fontSize:".9rem"}}/>
  <span style={{fontSize:".8rem",color:"var(--t3)"}}>Registered under <strong style={{color:"var(--t2)"}}>Patel Sikshan Avam Sewa Samiti</strong> — C.G. Reg. No. 122201880553</span>
</div>
</div>
</section>

{/* ═══════════════════════════════════════════ */}
{/* FACULTY / TEACHERS SECTION — NEW (Firebase) */}
{/* ═══════════════════════════════════════════ */}
<section id="faculty" className="spad" style={{background:"#fff"}}>
<div className="wrap">
<div className="tc rv" style={{marginBottom:36}}>
  <span className="stag">Expert Team</span>
  <h2 className="stitle">Our Faculty</h2>
  <div className="sbar c"/>
  <p className="ssub">Experienced and qualified teachers dedicated to student success</p>
</div>

{teachers.length > 0 ? (
  <div className="fac-grid">
    {teachers.map((t, i) => (
      <div className={`fac-card rv-zoom rv-d${(i % 4) + 1}`} key={t.id}>
        {/* Teacher Photo */}
        <div className="fac-photo" style={{background:`linear-gradient(135deg,${facColors[i%10]},${facGrads[i%10]})`}}>
          {t.photo && t.photo.startsWith("http") ? (
            <img src={t.photo} alt={t.name} style={{width:"100%",height:"100%",objectFit:"cover"}}
              onError={(e)=>{e.currentTarget.style.display='none';e.currentTarget.nextSibling.style.display='flex';}}/>
          ) : null}
          <div className="fac-avatar" style={{display:(t.photo && t.photo.startsWith("http"))?"none":"flex"}}>
            <i className="fas fa-user-tie"/>
          </div>
          {/* Subject Badge */}
          {t.subject && <div className="fac-subj-badge">{t.subject}</div>}
        </div>
        {/* Teacher Info */}
        <div className="fac-info">
          <h4 className="fac-name">{t.name}</h4>
          {t.qualification && <div className="fac-qual"><i className="fas fa-graduation-cap"/> {t.qualification}</div>}
          {t.experience && <div className="fac-exp"><i className="fas fa-briefcase"/> {t.experience} experience</div>}
          {t.classes && <div className="fac-classes"><i className="fas fa-chalkboard"/> {t.classes}</div>}
        </div>
      </div>
    ))}
  </div>
) : (
  /* Fallback: Show hardcoded teachers when Firebase collection is empty */
  <div className="fac-grid">
    {[
      {name:"Mr. Temlal Patel",subject:"Physics",qual:"BSc. Maths, MSc. Physics, B.Ed",exp:"15 years",cls:"Class 9, 11, 12"},
      {name:"Mrs. Hemlata Patel",subject:"Maths & All Subjects",qual:"BCA, MSc. Maths, D.El.Ed",exp:"10 years",cls:"Class 2-8, Navodaya, Prayas"},
      {name:"Mr. Aman Sharma",subject:"Chemistry",qual:"BSc. Maths, MSc. Chemistry, B.Ed",exp:"10 years",cls:"Class 11 & 12"},
      {name:"Mr. Kamta Prashad Sen",subject:"Mathematics",qual:"BSc. Maths, MSc. Maths, B.Ed",exp:"10 years",cls:"Class 10 & 12"},
      {name:"Mr. Naresh Sahu",subject:"Biology",qual:"BSc. Bio, MSc. Bio, B.Ed",exp:"8 years",cls:"Class 11 & 12"},
      {name:"Mr. Kamlesh Rajput",subject:"Mathematics",qual:"BSc. Maths, MSc. Maths",exp:"4 years",cls:"Class 9, 10, 11"},
      {name:"Mr. Yuvraj Patel",subject:"Science",qual:"BSc. Bio, MSc. Bio, B.Ed",exp:"2 years",cls:"Class 9 & 10"},
    ].map((t, i) => (
      <div className={`fac-card rv-zoom rv-d${(i % 4) + 1}`} key={i}>
        <div className="fac-photo" style={{background:`linear-gradient(135deg,${facColors[i%10]},${facGrads[i%10]})`}}>
          <div className="fac-avatar"><i className="fas fa-user-tie"/></div>
          <div className="fac-subj-badge">{t.subject}</div>
        </div>
        <div className="fac-info">
          <h4 className="fac-name">{t.name}</h4>
          <div className="fac-qual"><i className="fas fa-graduation-cap"/> {t.qual}</div>
          <div className="fac-exp"><i className="fas fa-briefcase"/> {t.exp} experience</div>
          <div className="fac-classes"><i className="fas fa-chalkboard"/> {t.cls}</div>
        </div>
      </div>
    ))}
  </div>
)}

{/* Admin Note */}
<div className="rv" style={{marginTop:24,background:"#FFFBEB",borderRadius:12,padding:14,border:"1px solid #FDE68A",fontSize:".78rem",color:"#78350F",display:"flex",alignItems:"flex-start",gap:8,textAlign:"left"}}>
  <i className="fas fa-info-circle" style={{marginTop:2,flexShrink:0}}/>
  <span><strong>For Admin:</strong> Teacher photos and details can be added and managed from the <Link href="/admin" style={{color:"#1349A8",fontWeight:700}}>Admin Panel</Link> → Teachers tab. Add photo URL, name, subject, qualification, experience, and teaching classes.</span>
</div>
</div>
</section>

{/* COURSES */}
<section id="courses" className="spad">
<div className="wrap">
<div className="tc rv" style={{marginBottom:36}}><span className="stag">Our Programs</span><h2 className="stitle">Courses & Batches</h2><div className="sbar c"/><p className="ssub">Comprehensive coaching programs designed for academic excellence</p></div>
<div className="cg">
{[{cls:"Class 12",tag:"Board + Entrance",desc:"Comprehensive preparation for board exams and competitive entrance tests",t1:"Regular & Crash Course",t2:"3-4 hours/day",icon:"fa-graduation-cap",ibg:"#1349A8",clr:"#EFF6FF",tclr:"#1D4ED8",q:"12"},{cls:"Class 11",tag:"Science Stream",desc:"Strong foundation building for higher secondary education",t1:"Regular Classes",t2:"3 hours/day",icon:"fa-flask",ibg:"#D97706",clr:"#FFFBEB",tclr:"#92400E",q:"11"},{cls:"Class 10",tag:"Board Preparation",desc:"Focused board exam preparation with regular mock tests",t1:"Regular & Crash Course",t2:"2 hours/day",icon:"fa-book-open",ibg:"#2563EB",clr:"#EFF6FF",tclr:"#1D4ED8",q:"10"}].map((c,i)=><div className={`card cc rv rv-d${i+1}`} key={i}><div className="ci" style={{background:c.clr}}><i className={`fas ${c.icon}`} style={{color:c.ibg}}/></div><span className="cbg" style={{background:c.clr,color:c.tclr}}>{c.tag}</span><div className="ct">{c.cls}</div><p className="cd">{c.desc}</p><div className="ctm"><i className="fas fa-clock" style={{color:c.ibg,fontSize:".7rem"}}/>{c.t1}</div><div className="ctm" style={{marginBottom:14}}><i className="fas fa-clock" style={{color:c.ibg,fontSize:".7rem"}}/>{c.t2}</div><Link href={`/courses?class=${c.q}`} className="btn bp bsm bblk">View Details <i className="fas fa-arrow-right"/></Link></div>)}
<div className="card cc rv rv-d4"><div className="ci" style={{background:"#F0FDF4"}}><i className="fas fa-seedling" style={{color:"#16A34A"}}/></div><span className="cbg" style={{background:"#F0FDF4",color:"#166534"}}>Foundation</span><div className="ct">Class 9</div><p className="cd">Build strong academic foundation across all subjects</p><div className="ctm"><i className="fas fa-clock" style={{color:"#16A34A",fontSize:".7rem"}}/>Regular Classes</div><div className="ctm" style={{marginBottom:14}}><i className="fas fa-clock" style={{color:"#16A34A",fontSize:".7rem"}}/>2 hours/day</div><Link href="/courses?class=9" className="btn bp bsm bblk">View Details <i className="fas fa-arrow-right"/></Link></div>
<div className="cc cwide cdark rv" style={{borderRadius:14,padding:22}}><div className="ci" style={{background:"rgba(255,255,255,.15)"}}><i className="fas fa-rocket" style={{color:"#fff"}}/></div><span className="cbg" style={{background:"rgba(255,255,255,.12)",color:"#FCD34D",border:"1px solid rgba(255,255,255,.2)"}}>Special Programs</span><div className="ct" style={{color:"#fff",fontSize:"1.05rem",marginTop:4}}>Class 2-8 + Competitive Exams</div><p className="cd" style={{color:"rgba(255,255,255,.8)"}}>Foundation classes for Class 2-8 (CG & CBSE). Plus IIT-JEE, NEET, Navodaya, Prayas, Sainik School, CGPET, PPHT, CGPVT and more.</p><div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:6,marginBottom:18}}>{["IIT-JEE · NEET","Navodaya · Prayas","Sainik School · CGPET","Class 2-8 (All Boards)"].map((t,i)=><div className="ctm" key={i} style={{color:"rgba(255,255,255,.8)"}}><i className="fas fa-check-circle" style={{color:"#4ADE80"}}/>{t}</div>)}</div><a href="#enquiry" className="btn ba">Enquire Now <i className="fas fa-arrow-right"/></a></div>
</div>
</div>
</section>

{/* TOPPERS */}
<section id="results" className="spad" style={{background:"#fff"}}>
<div className="wrap">
<div className="tc rv" style={{marginBottom:36}}><span className="stag">Our Pride</span><h2 className="stitle">Our Toppers & Results</h2><div className="sbar c"/><p className="ssub">Celebrating excellence and achievements of our brilliant students</p></div>
{toppers.length>0?<div className="g4 rv">{toppers.slice(0,4).map((t,i)=><div className="card tpc" key={t.id}><div className="tpi" style={{background:`linear-gradient(135deg,${colors[i%4]},${["#2A6FE0","#F5AC10","#4ADE80","#A78BFA"][i%4]})`}}>{t.photo?<img src={t.photo} alt={t.name}/>:<i className="fas fa-user-graduate" style={{fontSize:"2.5rem",color:"rgba(255,255,255,.25)"}}/>}<span className="tpct">{t.percentage}</span>{t.rank&&<span className="tptg">{t.rank}</span>}</div><div className="tpb"><div className="tpn">{t.name}</div><div className="tpcl">{t.class} · {t.board} {t.year}</div></div></div>)}</div>:<div className="empty-state rv"><i className="fas fa-trophy"/><h4>Toppers Coming Soon</h4><p>Featured toppers will be added by admin from the Admin Panel.</p></div>}
<div className="tc rv" style={{marginTop:24}}><Link href="/toppers" className="btn bp">View All Toppers — Year Wise <i className="fas fa-arrow-right"/></Link></div>
<div className="rstats rv">{[{n:"99%",l:"Pass Rate",bg:"linear-gradient(135deg,#DBEAFE,#BFDBFE)",c:"var(--navy)"},{n:"50+",l:"Toppers Overall",bg:"linear-gradient(135deg,#FEF3C7,#FDE68A)",c:"#92400E"},{n:"5000+",l:"Students Taught",bg:"linear-gradient(135deg,#DCFCE7,#BBF7D0)",c:"#166534"},{n:"10+",l:"Expert Faculty",bg:"linear-gradient(135deg,#EDE9FE,#DDD6FE)",c:"#4C1D95"}].map((s,i)=><div className="rs" key={i} style={{background:s.bg}}><div className="rn" style={{color:s.c}}>{s.n}</div><div className="rl">{s.l}</div></div>)}</div>
</div>
</section>

{/* EVENTS */}
<section id="events" className="spad">
<div className="wrap">
<div className="tc rv" style={{marginBottom:36}}><span className="stag">Stay Updated</span><h2 className="stitle">Events & Seminars</h2><div className="sbar c"/><p className="ssub">Stay updated with our latest events and educational seminars</p></div>
{events.length>0?<div className="g3 rv">{events.slice(0,3).map(ev=><div className="card" key={ev.id} style={{borderRadius:14,overflow:"hidden"}}>{ev.image&&<div style={{height:170,overflow:"hidden"}}><img src={ev.image} alt={ev.title} style={{width:"100%",height:"100%",objectFit:"cover"}}/></div>}<div style={{padding:16}}><div style={{fontWeight:700,fontSize:".9rem",marginBottom:4}}>{ev.title}</div><p style={{fontSize:".8rem",color:"var(--t3)",lineHeight:1.6}}>{ev.description}</p>{ev.date&&<div style={{fontSize:".72rem",color:"var(--t4)",marginTop:8}}><i className="fas fa-calendar-alt" style={{marginRight:4}}/>{ev.date}</div>}</div></div>)}</div>:<div className="empty-state rv"><i className="fas fa-calendar-alt"/><h4>Events Coming Soon</h4><p>Events will be added by admin. Check back soon for upcoming seminars, workshops, and educational programs.</p></div>}
<div className="tc rv" style={{marginTop:24}}><Link href="/events" className="btn bp bsm">View All Events & Seminars <i className="fas fa-arrow-right"/></Link></div>
</div>
</section>

{/* PORTAL */}
<section id="portal" className="spad">
<div className="wrap">
<div className="tc rv" style={{marginBottom:36,position:"relative",zIndex:2}}><div style={{display:"inline-flex",alignItems:"center",gap:8,background:"rgba(255,255,255,.1)",border:"1px solid rgba(255,255,255,.2)",borderRadius:99,padding:"5px 15px",marginBottom:12,fontSize:".72rem",fontWeight:600,color:"#fff"}}><i className="fas fa-robot" style={{color:"#FCD34D"}}/> AI-Powered Platform</div><h2 className="stitle" style={{color:"#fff"}}>Student Learning Portal</h2><div className="sbar c" style={{background:"linear-gradient(90deg,#FCD34D,#F59E0B)"}}/><p style={{color:"rgba(255,255,255,.75)",maxWidth:500,margin:"0 auto",fontSize:".86rem",lineHeight:1.7}}>Advanced AI-powered learning platform designed to accelerate your academic success</p></div>
<div className="g4 rv" style={{position:"relative",zIndex:2}}>
{[{icon:"fa-book-open",bg:"linear-gradient(135deg,#1D4ED8,#3B82F6)",t:"Study Material Vault",d:"Access comprehensive study resources",items:["Chapter-wise notes & PDFs","Video lectures by expert faculty","Daily Practice Papers (DPP)","Previous year question banks"]},{icon:"fa-wand-magic-sparkles",bg:"linear-gradient(135deg,#7C3AED,#A78BFA)",t:"AI Quiz Generator",d:"Personalized adaptive testing",items:["Weak area identification","Auto-generated practice tests","Instant feedback & solutions","Performance analytics"]},{icon:"fa-comments",bg:"linear-gradient(135deg,#059669,#34D399)",t:"AI Doubt Solver",d:"24/7 instant doubt resolution",items:["Upload photo of your doubt","AI-powered explanations","Step-by-step solutions","Available round the clock"]},{icon:"fa-chart-bar",bg:"linear-gradient(135deg,#DC2626,#F87171)",t:"Personalized Dashboard",d:"Track your academic journey",items:["Real-time progress tracking","Test scores & rankings","Attendance records","Performance insights"]}].map((f,i)=><div className="fc" key={i}><div className="fci" style={{background:f.bg}}><i className={`fas ${f.icon}`}/></div><div className="fct">{f.t}</div><p className="fcd">{f.d}</p><ul className="fcl">{f.items.map((item,j)=><li key={j}><i className="fas fa-check"/>{item}</li>)}</ul></div>)}
</div>
<div className="tc rv" style={{marginTop:24,position:"relative",zIndex:2}}>{user?<Link href="/student-portal" className="btn ba">Open Study Portal <i className="fas fa-arrow-right"/></Link>:<button onClick={login} className="btn ba"><i className="fab fa-google"/>Login with Gmail to Access Portal</button>}</div>
</div>
</section>

{/* ENQUIRY */}
<section id="enquiry" className="spad" style={{background:"#fff"}}>
<div className="wrap"><div className="g2">
<div className="rv-left">
<span className="stag">Get In Touch</span><h2 className="stitle">Admission Enquiry</h2><div className="sbar"/>
<p style={{color:"var(--t2)",lineHeight:1.75,fontSize:".86rem"}}>Interested in joining PID? Fill the form and our team will reach out with complete admission details within 24 hours.</p>
<div style={{display:"flex",flexDirection:"column",gap:14,marginTop:20}}>
{[{icon:"fa-phone",bg:"linear-gradient(135deg,var(--blue),var(--sky))",t:"Quick Response",d:"Our team responds within 24 hours"},{icon:"fa-gift",bg:"linear-gradient(135deg,#16A34A,#4ADE80)",t:"Free Counselling",d:"Get free academic counselling session"},{icon:"fa-percent",bg:"linear-gradient(135deg,var(--gold),var(--goldb))",t:"Scholarship Available",d:"Merit-based scholarships for deserving students"}].map((p,i)=><div key={i} style={{display:"flex",alignItems:"flex-start",gap:12}}><div style={{width:38,height:38,borderRadius:10,background:p.bg,display:"flex",alignItems:"center",justifyContent:"center",color:"#fff",fontSize:".85rem",flexShrink:0}}><i className={`fas ${p.icon}`}/></div><div><div style={{fontWeight:700,fontSize:".86rem",color:"var(--t1)"}}>{p.t}</div><div style={{fontSize:".78rem",color:"var(--t2)"}}>{p.d}</div></div></div>)}
</div>
</div>
<div className="fcard rv-right">
<h3 style={{fontSize:"1rem",fontWeight:800,color:"var(--t1)",marginBottom:18}}>Request Admission Details</h3>
<div className="frow"><div className="fgrp"><label className="lbl">Student Name *</label><input className="fi" placeholder="Full name" value={en} onChange={e=>setEn(e.target.value)}/></div><div className="fgrp"><label className="lbl">Class *</label><select className="fi" value={ec} onChange={e=>setEc(e.target.value)}><option value="" disabled>Select class</option><option>Class 2-4</option><option>Class 5-8</option><option>Class 9</option><option>Class 10</option><option>Class 11</option><option>Class 12</option><option>Navodaya</option><option>Prayas</option><option>Competitive (JEE/NEET)</option></select></div></div>
<div className="frow"><div className="fgrp"><label className="lbl">Phone Number *</label><input className="fi" type="tel" placeholder="Contact number" value={ep} onChange={e=>setEp(e.target.value)}/></div><div className="fgrp"><label className="lbl">Parent Name</label><input className="fi" placeholder="Parent / Guardian" value={epa} onChange={e=>setEpa(e.target.value)}/></div></div>
<div className="frow"><div className="fgrp"><label className="lbl">Board</label><select className="fi" value={eb} onChange={e=>setEb(e.target.value)}><option value="" disabled>Select board</option><option>CG Board</option><option>CBSE</option><option>ICSE</option></select></div><div className="fgrp"><label className="lbl">Medium</label><select className="fi" value={emed} onChange={e=>setEmed(e.target.value)}><option value="" disabled>Select medium</option><option>Hindi</option><option>English</option></select></div></div>
<div className="fgrp"><label className="lbl">Address</label><input className="fi" placeholder="Your address" value={ea} onChange={e=>setEa(e.target.value)}/></div>
<div className="fgrp"><label className="lbl">Message</label><textarea rows="3" className="fi" style={{resize:"none"}} placeholder="Any queries..." value={em} onChange={e=>setEm(e.target.value)}/></div>
<button onClick={subEnq} className="btn bp bblk" style={{padding:12}}><i className="fas fa-paper-plane"/>Request Admission Details</button>
{eSub&&<div style={{background:"#F0FDF4",border:"1px solid #86EFAC",borderRadius:8,padding:12,textAlign:"center",fontSize:".84rem",fontWeight:700,color:"#166534",marginTop:10}}><i className="fas fa-check-circle" style={{color:"#22C55E",marginRight:5}}/>Thank you! We will contact you within 24 hours.</div>}
</div>
</div></div>
</section>

{/* REVIEWS */}
<section id="testi" className="spad">
<div className="wrap">
<div className="tc rv" style={{marginBottom:36}}><span className="stag">What People Say</span><h2 className="stitle">Student & Parent Reviews</h2><div className="sbar c"/><p className="ssub">Hear from students and parents about their experience with PID</p></div>
<div className="g3 rv">
{reviews.map(r=><div className="card tcard" key={r.id} style={{maxHeight:280,overflow:"hidden"}}><div className="tstars">{"★".repeat(r.stars||5)}{"☆".repeat(5-(r.stars||5))}</div><p className="ttxt" style={{display:"-webkit-box",WebkitLineClamp:4,WebkitBoxOrient:"vertical",overflow:"hidden"}}>"{r.text}"</p><div className="tau"><div className="tav" style={{background:"#DBEAFE",color:"#1D4ED8"}}>{r.name?.charAt(0)?.toUpperCase()}</div><div><div className="tan">{r.name}</div><div className="tar">{r.role}</div></div></div></div>)}
<div className="review-form-card">
<div style={{width:40,height:40,borderRadius:10,background:"#FEF3C7",display:"flex",alignItems:"center",justifyContent:"center",marginBottom:10}}><i className="fas fa-comment" style={{color:"var(--gold)"}}/></div>
<h4>Share Your Review</h4>
<p style={{fontSize:".78rem",color:"var(--t3)",marginBottom:12}}>Your feedback helps us improve and guides future students</p>
{rSub?<div style={{background:"#F0FDF4",border:"1px solid #86EFAC",borderRadius:8,padding:14,color:"#166534",fontWeight:600,fontSize:".84rem"}}><i className="fas fa-check-circle" style={{color:"#22C55E",marginRight:5}}/>Thank you! Your review will appear after approval.</div>:<>
<div style={{fontSize:".8rem",fontWeight:600,color:"var(--t2)",marginBottom:4}}>Your Rating</div>
<div className="star-select">{[1,2,3,4,5].map(s=><span key={s} className={s<=rs?"active":""} onClick={()=>setRs(s)}>★</span>)}</div>
<div className="fgrp"><input className="fi" placeholder="Your Name" value={rn} onChange={e=>setRn(e.target.value)}/></div>
<div className="fgrp"><input className="fi" placeholder="Your Role (e.g., Parent, Student)" value={rr} onChange={e=>setRr(e.target.value)}/></div>
<div className="fgrp"><textarea rows="3" className="fi" style={{resize:"none"}} placeholder="Write your review..." value={rt} onChange={e=>setRt(e.target.value)}/></div>
<button onClick={subReview} className="btn ba bblk" disabled={rL}><i className="fas fa-paper-plane"/>{rL?"Submitting...":"Submit Review"}</button>
</>}
</div>
</div>
</div>
</section>

{/* CONTACT */}
<section id="contact" className="spad" style={{background:"#fff"}}>
<div className="wrap">
<div className="tc rv" style={{marginBottom:36}}><span className="stag">Get In Touch</span><h2 className="stitle">Contact Us</h2><div className="sbar c"/><p className="ssub">Visit us or reach out for any queries. We are here to help!</p></div>
<div className="g3 rv">
{[{icon:"fa-map-marker-alt",bg:"linear-gradient(135deg,var(--blue),var(--sky))",t:"Address",d:"Matiya Road, Near Saket Dham,\nDongargaon,\nChhattisgarh - 491445"},{icon:"fa-phone",bg:"linear-gradient(135deg,#D98D04,#F5AC10)",t:"Phone Numbers",d:"+91 8319002877\n+91 7470412110\n+91 7024695525"},{icon:"fa-envelope",bg:"linear-gradient(135deg,#7C3AED,#A78BFA)",t:"Email",d:"patelinstitutedongargaon1234\n@gmail.com"}].map((c,i)=><div className="card coc" key={i}><div className="coi" style={{background:c.bg}}><i className={`fas ${c.icon}`}/></div><div className="cot">{c.t}</div><div className="cod" style={{whiteSpace:"pre-line"}}>{c.d}</div></div>)}
</div>
<div className="map-wrap rv">
<div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}><h4>Find Us on Map</h4><a href="https://maps.app.goo.gl/GGJP8RHp7XogBmyH8" target="_blank" rel="noopener noreferrer" className="btn bp bsm">Open in Maps <i className="fas fa-external-link-alt"/></a></div>
<iframe src="https://maps.google.com/maps?q=XVC3%2BF3W+Ward+No.+06+Dongargaon+Chhattisgarh&t=&z=15&ie=UTF8&iwloc=&output=embed" allowFullScreen loading="lazy" title="PID Location"/>
</div>
</div>
</section>

{/* FOOTER */}
<footer>
<div className="wrap">
<div className="fg">
<div><div className="flogo"><img src="/pid_logo.png" alt="PID"/><div><strong style={{display:"block",color:"#fff",fontSize:".95rem",lineHeight:"1.1"}}>PID</strong><span style={{fontSize:".74rem",color:"#B0C4DC",fontWeight:600,lineHeight:"1.1",display:"block"}}>Patel Institute Dongargaon</span></div></div><p className="fdesc">Empowering students from Class 2-12 with quality education and comprehensive preparation for board exams and competitive tests.</p><div className="socrow"><a href="https://www.instagram.com/patel_institude_dgn?igsh=Z3F0N3lpcGJqbzZ1" target="_blank" rel="noopener noreferrer" className="sob"><i className="fab fa-instagram"/></a><a href="https://wa.me/918319002877" target="_blank" rel="noopener noreferrer" className="sob"><i className="fab fa-whatsapp"/></a><a href="https://youtube.com/@patelinstitutedongargaon?si=nD00OFKZPtqY5mml" target="_blank" rel="noopener noreferrer" className="sob"><i className="fab fa-youtube"/></a></div></div>
<div><div className="fh">Quick Links</div><ul className="fl"><li><a href="#about">About Us</a></li><li><a href="#directors">Our Directors</a></li><li><a href="#faculty">Our Faculty</a></li><li><Link href="/courses">Courses</Link></li><li><Link href="/toppers">Results</Link></li><li><Link href="/student-portal">Student Portal</Link></li><li><Link href="/events">Events</Link></li></ul></div>
<div><div className="fh">Courses</div><ul className="fl"><li><Link href="/courses?class=12">Class 12 (Board + Entrance)</Link></li><li><Link href="/courses?class=11">Class 11 (Science)</Link></li><li><Link href="/courses?class=10">Class 10 (Board Prep)</Link></li><li><Link href="/courses?class=9">Class 9 (Foundation)</Link></li><li><Link href="/courses?class=2-8">Class 2-8 (Foundation)</Link></li><li><Link href="/courses">JEE / NEET / Navodaya</Link></li></ul></div>
<div><div className="fh">Contact</div><div style={{fontSize:".8rem",lineHeight:1.8}}><p style={{marginBottom:8}}><strong style={{color:"#fff"}}>Address</strong><br/>Matiya Road, Near Saket Dham, Dongargaon, CG - 491445</p><p style={{marginBottom:8}}><strong style={{color:"#fff"}}>Phone</strong><br/>+91 8319002877<br/>+91 7470412110</p></div></div>
</div>
<div className="fbot">
<p>&copy; {new Date().getFullYear()} Patel Institute Dongargaon. All rights reserved.</p>
<p><strong>Directors:</strong> Mr. Temlal Patel & Mrs. Hemlata Patel</p>
<p>Registration: Patel Sikshan Avam Sewa Samiti — C.G. Reg. No. 122201880553</p>
<p style={{marginTop:8}}><Link href="/privacy-policy" style={{color:"#9FB8CF",marginRight:16}}>Privacy Policy</Link><Link href="/terms" style={{color:"#9FB8CF"}}>Terms & Conditions</Link></p>
</div>
</div>
</footer>

{/* WHATSAPP */}
<a href="https://wa.me/918319002877" target="_blank" rel="noopener noreferrer" className="wa-float"><i className="fab fa-whatsapp"/></a>
</>);
}