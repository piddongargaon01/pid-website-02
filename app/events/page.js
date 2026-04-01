"use client";
import { useState, useEffect } from "react";
import { db } from "../firebase";
import { collection, onSnapshot } from "firebase/firestore";
import Link from "next/link";

export default function EventsPage() {
  const [events, setEvents] = useState([]);
  const [filter, setFilter] = useState("all");
  const [lightbox, setLightbox] = useState(null);

  useEffect(() => {
    const unsub = onSnapshot(collection(db, "events"), (snap) => {
      const arr = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      arr.sort((a, b) => (b.date || "").localeCompare(a.date || ""));
      setEvents(arr);
    });
    return () => unsub();
  }, []);

  const filtered = filter === "all" ? events : events.filter(e => e.type === filter);
  const types = ["all", ...new Set(events.map(e => e.type).filter(Boolean))];

  return (
    <>
      {/* Navbar */}
      <nav id="nav" className="sd">
        <div className="ni">
          <Link href="/" className="nlogo"><img src="/pid_logo.png" alt="PID"/><div className="nlt"><strong>PID</strong><span>Excellence in Education</span></div></Link>
          <ul className="nlinks"><li><Link href="/#about">About</Link></li><li><Link href="/#courses">Courses</Link></li><li><Link href="/#results">Results</Link></li><li><Link href="/#portal">Student Portal</Link></li><li><Link href="/#events">Events</Link></li><li><Link href="/#contact">Contact</Link></li></ul>
          <Link href="/#enquiry" className="btn ba bsm nenq">Enquire Now</Link>
        </div>
      </nav>

      {/* Header */}
      <div style={{background:"linear-gradient(135deg,#062560,#1548B0)",paddingTop:60,paddingBottom:40}}>
        <div className="wrap">
          <Link href="/" style={{color:"rgba(255,255,255,.7)",fontSize:".82rem",display:"inline-flex",alignItems:"center",gap:6,marginBottom:16}}><i className="fas fa-arrow-left"/> Back to Home</Link>
          <h1 style={{fontFamily:"'Plus Jakarta Sans',sans-serif",fontSize:"clamp(1.6rem,3vw,2.2rem)",fontWeight:800,color:"#fff",marginBottom:6}}>Events & Seminars</h1>
          <p style={{color:"rgba(255,255,255,.7)",fontSize:".88rem",maxWidth:560}}>Stay updated with our latest events, seminars, workshops, annual functions, and educational programs.</p>
        </div>
      </div>

      {/* Achievements Bar */}
      <div style={{background:"#fff",borderBottom:"1px solid #E2EAF4",padding:"16px 0"}}>
        <div className="wrap" style={{display:"flex",justifyContent:"center",gap:28,flexWrap:"wrap"}}>
          {[
            {icon:"fa-trophy",c:"#D98D04",t:"Top 10 State Ranks"},
            {icon:"fa-medal",c:"#1349A8",t:"Navodaya Selections"},
            {icon:"fa-award",c:"#16A34A",t:"Prayas / Sainik School"},
            {icon:"fa-star",c:"#7C3AED",t:"CGPET / PPHT / CGPVT"},
          ].map((a,i)=>(
            <div key={i} style={{display:"flex",alignItems:"center",gap:8}}>
              <div style={{width:32,height:32,borderRadius:8,background:`${a.c}15`,display:"flex",alignItems:"center",justifyContent:"center"}}>
                <i className={`fas ${a.icon}`} style={{color:a.c,fontSize:".78rem"}}/>
              </div>
              <span style={{fontSize:".8rem",fontWeight:600,color:"#1C2E44"}}>{a.t}</span>
            </div>
          ))}
        </div>
      </div>

      <div style={{background:"#F0F4FA",minHeight:"60vh"}}>
        <div className="wrap" style={{padding:"32px 20px"}}>

          {/* Filter Tabs */}
          {types.length > 1 && (
            <div style={{display:"flex",flexWrap:"wrap",gap:8,marginBottom:24}}>
              {types.map((t) => (
                <button key={t} onClick={() => setFilter(t)} style={{
                  padding:"8px 16px",borderRadius:99,
                  border: filter===t ? "2px solid #1349A8" : "1px solid #D4DEF0",
                  background: filter===t ? "#1349A8" : "#fff",
                  color: filter===t ? "#fff" : "#4A5E78",
                  fontSize:".76rem",fontWeight:600,cursor:"pointer",transition:"all .2s",
                  fontFamily:"'DM Sans',sans-serif",textTransform:"capitalize"
                }}>
                  {t === "all" ? "All Events" : t}
                </button>
              ))}
            </div>
          )}

          {/* Events Grid */}
          {filtered.length > 0 ? (
            <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill, minmax(320px, 1fr))",gap:20}}>
              {filtered.map((ev) => (
                <div key={ev.id} style={{background:"#fff",borderRadius:14,overflow:"hidden",border:"1px solid #D4DEF0",transition:"all .25s"}}
                  onMouseEnter={e=>{e.currentTarget.style.transform="translateY(-4px)";e.currentTarget.style.boxShadow="0 12px 32px rgba(7,41,107,.1)";}}
                  onMouseLeave={e=>{e.currentTarget.style.transform="none";e.currentTarget.style.boxShadow="none";}}>
                  
                  {/* Event Image */}
                  {ev.image && (
                    <div style={{height:200,overflow:"hidden",cursor:"pointer",position:"relative"}} onClick={()=>setLightbox(ev.image)}>
                      <img src={ev.image} alt={ev.title} style={{width:"100%",height:"100%",objectFit:"cover",transition:"transform .4s"}}
                        onMouseEnter={e=>e.currentTarget.style.transform="scale(1.05)"}
                        onMouseLeave={e=>e.currentTarget.style.transform="scale(1)"}/>
                      <div style={{position:"absolute",top:10,right:10,background:"rgba(0,0,0,.5)",color:"#fff",width:30,height:30,borderRadius:"50%",display:"flex",alignItems:"center",justifyContent:"center",fontSize:".7rem"}}>
                        <i className="fas fa-expand"/>
                      </div>
                    </div>
                  )}

                  {/* Event Video */}
                  {ev.videoUrl && !ev.image && (
                    <div style={{height:200,overflow:"hidden"}}>
                      <iframe src={ev.videoUrl} style={{width:"100%",height:"100%",border:0}} allowFullScreen loading="lazy" title={ev.title}/>
                    </div>
                  )}

                  {/* Event Info */}
                  <div style={{padding:18}}>
                    <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:10,flexWrap:"wrap"}}>
                      {ev.type && (
                        <span style={{background:"#EFF6FF",color:"#1349A8",padding:"3px 10px",borderRadius:99,fontSize:".68rem",fontWeight:700,textTransform:"capitalize"}}>{ev.type}</span>
                      )}
                      {ev.date && (
                        <span style={{fontSize:".72rem",color:"#6B7F99",display:"flex",alignItems:"center",gap:4}}>
                          <i className="fas fa-calendar-alt" style={{fontSize:".65rem"}}/>{ev.date}
                        </span>
                      )}
                    </div>
                    <h3 style={{fontFamily:"'Plus Jakarta Sans',sans-serif",fontSize:".95rem",fontWeight:700,color:"#0B1826",marginBottom:6}}>{ev.title}</h3>
                    {ev.description && <p style={{fontSize:".82rem",color:"#4A5E78",lineHeight:1.65}}>{ev.description}</p>}
                    
                    {/* Gallery Images */}
                    {ev.gallery && ev.gallery.length > 0 && (
                      <div style={{display:"flex",gap:6,marginTop:12,flexWrap:"wrap"}}>
                        {ev.gallery.map((img, i) => (
                          <div key={i} style={{width:60,height:60,borderRadius:8,overflow:"hidden",cursor:"pointer",border:"1px solid #E2EAF4"}} onClick={()=>setLightbox(img)}>
                            <img src={img} alt={`${ev.title} ${i+1}`} style={{width:"100%",height:"100%",objectFit:"cover"}}/>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Video Link */}
                    {ev.videoUrl && ev.image && (
                      <a href={ev.videoUrl} target="_blank" rel="noopener noreferrer" style={{display:"inline-flex",alignItems:"center",gap:6,marginTop:12,fontSize:".8rem",fontWeight:600,color:"#1349A8"}}>
                        <i className="fas fa-play-circle"/> Watch Video
                      </a>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div style={{background:"#fff",borderRadius:16,border:"2px dashed #D4DEF0",padding:"60px 20px",textAlign:"center"}}>
              <i className="fas fa-calendar-alt" style={{fontSize:"3rem",color:"#B0C4DC",marginBottom:14}}/>
              <h3 style={{fontFamily:"'Plus Jakarta Sans',sans-serif",fontSize:"1.1rem",fontWeight:700,color:"#4A5E78",marginBottom:6}}>Events Coming Soon</h3>
              <p style={{fontSize:".86rem",color:"#6B7F99",maxWidth:400,margin:"0 auto",lineHeight:1.65}}>Events, seminars, workshops, and annual function photos & videos will be added by admin. Check back soon!</p>
            </div>
          )}

          {/* Info Section */}
          <div style={{marginTop:32,background:"#fff",borderRadius:14,border:"1px solid #D4DEF0",padding:24}}>
            <h3 style={{fontFamily:"'Plus Jakarta Sans',sans-serif",fontSize:"1rem",fontWeight:700,color:"#0B1826",marginBottom:12}}>Our Achievements & Activities</h3>
            <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill, minmax(280px, 1fr))",gap:14}}>
              {[
                {icon:"fa-trophy",bg:"#FEF3C7",c:"#D98D04",t:"Competitive Exam Success",d:"Many students from our institute have secured top 10 rank in state. Several students successfully cleared Navodaya, Prayas, Sainik School, CGPET, PPHT, CGPVT exams."},
                {icon:"fa-chalkboard-teacher",bg:"#EFF6FF",c:"#1349A8",t:"Career Guidance Seminars",d:"Regular seminars conducted on importance of education and career guidance. Expert speakers explain different career opportunities to students and parents."},
                {icon:"fa-users",bg:"#F0FDF4",c:"#16A34A",t:"Annual Functions",d:"Institute organizes annual functions to celebrate student achievements, cultural activities, and to motivate students for better performance."},
                {icon:"fa-brain",bg:"#FAF5FF",c:"#7C3AED",t:"Educational Activities",d:"Students participate in various educational activities, quiz competitions, science exhibitions, and workshops to enhance their learning experience."},
              ].map((item, i) => (
                <div key={i} style={{display:"flex",alignItems:"flex-start",gap:12,padding:14,borderRadius:12,background:"#F8FAFD",border:"1px solid #E8EFF8"}}>
                  <div style={{width:36,height:36,borderRadius:8,background:item.bg,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
                    <i className={`fas ${item.icon}`} style={{color:item.c,fontSize:".82rem"}}/>
                  </div>
                  <div>
                    <div style={{fontWeight:700,fontSize:".86rem",color:"#0B1826",marginBottom:3}}>{item.t}</div>
                    <div style={{fontSize:".78rem",color:"#4A5E78",lineHeight:1.6}}>{item.d}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Admin Note */}
          <div style={{marginTop:20,background:"#FFFBEB",borderRadius:12,padding:16,border:"1px solid #FDE68A",fontSize:".8rem",color:"#78350F",display:"flex",alignItems:"flex-start",gap:10}}>
            <i className="fas fa-info-circle" style={{marginTop:2,flexShrink:0}}/>
            <div><strong>For Admin:</strong> Events, seminar photos, videos, and annual function media can be added and managed from the Admin Panel. Each event supports title, description, type, date, cover image, gallery images, and video URL.</div>
          </div>

          {/* CTA */}
          <div style={{marginTop:24,textAlign:"center"}}>
            <Link href="/#enquiry" className="btn ba">Join PID Today <i className="fas fa-arrow-right"/></Link>
          </div>

        </div>
      </div>

      {/* Lightbox */}
      {lightbox && (
        <div onClick={()=>setLightbox(null)} style={{position:"fixed",inset:0,background:"rgba(0,0,0,.85)",zIndex:9999,display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer",padding:20}}>
          <button onClick={()=>setLightbox(null)} style={{position:"absolute",top:20,right:20,background:"rgba(255,255,255,.15)",border:"none",color:"#fff",width:40,height:40,borderRadius:"50%",fontSize:"1.1rem",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center"}}>
            <i className="fas fa-times"/>
          </button>
          <img src={lightbox} alt="Event" style={{maxWidth:"90%",maxHeight:"85vh",borderRadius:12,boxShadow:"0 20px 60px rgba(0,0,0,.5)"}} onClick={e=>e.stopPropagation()}/>
        </div>
      )}

      {/* WhatsApp */}
      <a href="https://wa.me/918319002877" target="_blank" rel="noopener noreferrer" className="wa-float"><i className="fab fa-whatsapp"/></a>
    </>
  );
}