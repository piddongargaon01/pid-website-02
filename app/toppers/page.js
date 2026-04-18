"use client";
import { useState, useEffect } from "react";
import { db } from "../firebase";
import { collection, onSnapshot } from "firebase/firestore";
import Link from "next/link";

const toppersData = {
  "12th_hindi_cg": {
    label: "Class 12th — Hindi Medium (CG Board)",
    toppers: [
      { name: "Roshan Lal Sinha", pct: "95%", year: "2024-25", rank: "11th Rank in District" },
      { name: "Tikesh Ahir", pct: "89.8%", year: "2023-24", rank: "Top 10 in Tahsil" },
      { name: "Krish Kumar", pct: "89.8%", year: "2023-24", rank: "Top 10 in Tahsil" },
      { name: "Himanshu Shandilya", pct: "94.40%", year: "2022-23", rank: "Top 10 in District" },
      { name: "Keshar Dewangan", pct: "89%", year: "2021-22", rank: "Top 10 in Tahsil" },
      { name: "Umesh Sinha", pct: "95%", year: "2020-21", rank: "Top 10 in District" },
      { name: "Leena Dewangan", pct: "93%", year: "2019-20", rank: "Top 10 in District" },
      { name: "Vidhi Sawai", pct: "92%", year: "2018-19", rank: "Top 10 in District" },
      { name: "Aastha Lata", pct: "96%", year: "2017-18", rank: "7th Rank in State" },
      { name: "Pragya Rajput", pct: "93%", year: "2016-17", rank: "Top 10 in District" },
      { name: "Pramod Sahu", pct: "86.60%", year: "2015-16", rank: "Top Rank in Tahsil" },
      { name: "Deepankar Koshma", pct: "95.20%", year: "2014-15", rank: "7th Rank in State" },
      { name: "Nidhi Dave", pct: "95.80%", year: "2014-15", rank: "4th Rank in State" },
      { name: "Deepak Mahala", pct: "85%", year: "2013-14", rank: "1st Rank in Tahsil" },
      { name: "Lokesh Patel", pct: "75%", year: "2012-13", rank: "1st Rank in Institute" },
    ],
  },
  "12th_eng_cg": {
    label: "Class 12th — English Medium (CG Board)",
    toppers: [
      { name: "Hanee Shende", pct: "89.6%", year: "2024-25", rank: "Top 10 in Tahsil" },
      { name: "Harsh Verma", pct: "82.8%", year: "2023-24", rank: "Top 10 in Tahsil" },
      { name: "Chitranshi Nishad", pct: "94%", year: "2022-23", rank: "Top 10 in District" },
      { name: "Kashish Sahu", pct: "94%", year: "2021-22", rank: "Top 10 in District" },
      { name: "Muskaan Bala Tandekar", pct: "96%", year: "2020-21", rank: "Top 10 in District" },
      { name: "Khagesh Borkar", pct: "76.6%", year: "2019-20", rank: "Top 10 in Tahsil" },
      { name: "Pushkar Dube", pct: "77%", year: "2018-19", rank: "Top 10 in Tahsil" },
      { name: "Aaryan Vaishnav", pct: "85.4%", year: "2017-18", rank: "Top 10 in Tahsil" },
    ],
  },
  "12th_eng_cbse": {
    label: "Class 12th — English Medium (CBSE Board)",
    toppers: [
      { name: "Gopanshu Sahu", pct: "85.20%", year: "2024-25", rank: "" },
      { name: "Apurva Titichha", pct: "75.4%", year: "2023-24", rank: "" },
    ],
  },
  "10th_eng_cg": {
    label: "Class 10th — English Medium (CG Board)",
    toppers: [
      { name: "Yukti Matekar", pct: "96.66%", year: "2024-25", rank: "" },
      { name: "Tejasvini Shivna", pct: "94%", year: "2022-23", rank: "Top 10 in Tahsil" },
      { name: "Hanee Shende", pct: "95.50%", year: "2022-23", rank: "Top 10 in Tahsil" },
      { name: "Swati Jain", pct: "91.14%", year: "2021-22", rank: "Top 10 in Tahsil" },
      { name: "Gunjan Sahade", pct: "96%", year: "2019-20", rank: "Top 10 in District" },
      { name: "Aanchal Tiwari", pct: "94%", year: "2019-20", rank: "Top 10 in District" },
      { name: "Muskaan Bala Tandekar", pct: "90%", year: "2018-19", rank: "Top 10 in Tahsil" },
    ],
  },
  "10th_hindi_cg": {
    label: "Class 10th — Hindi Medium (CG Board)",
    toppers: [
      { name: "Garima Sahu", pct: "90.66%", year: "2024-25", rank: "Top 10 in Tahsil" },
      { name: "Komlika Yadav", pct: "86.66%", year: "2023-24", rank: "Top 10 in Tahsil" },
      { name: "Pankaj Meshram", pct: "87.16%", year: "2022-23", rank: "Top 10 in Tahsil" },
      { name: "Tikesh Ahir", pct: "93%", year: "2021-22", rank: "Top 10 in Tahsil" },
      { name: "Leena Nayak", pct: "95.1%", year: "2019-20", rank: "Top 10 in Tahsil" },
      { name: "Umesh Sinha", pct: "87.1%", year: "2018-19", rank: "Top 10 in Tahsil" },
      { name: "Sathi Gayen", pct: "87%", year: "2014-15", rank: "Top 10 in Tahsil" },
      { name: "Neetu Mahilane", pct: "92%", year: "2013-14", rank: "Top 10 in Tahsil" },
      { name: "Pooja Dewangan", pct: "94%", year: "2013-14", rank: "Top 10 in Tahsil" },
    ],
  },
  "10th_eng_cbse": {
    label: "Class 10th — English Medium (CBSE Board)",
    toppers: [
      { name: "Rajashvi Maankar", pct: "", year: "2024-25", rank: "" },
      { name: "Avni Panday", pct: "", year: "2023-24", rank: "" },
      { name: "Nikita Sonkar", pct: "", year: "2022-23", rank: "" },
      { name: "Samarth Yadu", pct: "", year: "2021-22", rank: "" },
    ],
  },
};

const categories = Object.keys(toppersData);
const colors = ["#1349A8","#D98D04","#16A34A","#7C3AED","#DC2626","#059669"];

export default function ToppersPage() {
  const [activeTab, setActiveTab] = useState(categories[0]);
  const [featuredToppers, setFeaturedToppers] = useState([]);
  const data = toppersData[activeTab];

  // Fetch featured toppers with photos from Firebase (admin managed) - REALTIME
  useEffect(() => {
    const unsub = onSnapshot(collection(db, "featured_toppers"), (snap) => {
      const arr = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      arr.sort((a, b) => (b.year || "").localeCompare(a.year || ""));
      setFeaturedToppers(arr);
    });
    return () => unsub();
  }, []);

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
          <h1 style={{fontFamily:"'Plus Jakarta Sans',sans-serif",fontSize:"clamp(1.6rem,3vw,2.2rem)",fontWeight:800,color:"#fff",marginBottom:6}}>Our Toppers — Year Wise</h1>
          <p style={{color:"rgba(255,255,255,.7)",fontSize:".88rem",maxWidth:560}}>Celebrating the achievements of our brilliant students who made us proud year after year. 99% pass rate since 2012.</p>
        </div>
      </div>

      {/* Stats Bar */}
      <div style={{background:"#fff",borderBottom:"1px solid #E2EAF4",padding:"16px 0"}}>
        <div className="wrap" style={{display:"flex",justifyContent:"center",gap:32,flexWrap:"wrap"}}>
          {[{n:"99%",l:"Pass Rate"},{n:"50+",l:"Toppers"},{n:"5000+",l:"Students"},{n:"13+",l:"Years"}].map((s,i)=>(
            <div key={i} style={{textAlign:"center"}}>
              <div style={{fontFamily:"'Plus Jakarta Sans',sans-serif",fontSize:"1.3rem",fontWeight:800,color:colors[i]}}>{s.n}</div>
              <div style={{fontSize:".72rem",color:"#6B7F99"}}>{s.l}</div>
            </div>
          ))}
        </div>
      </div>

      <div style={{background:"#F0F4FA",minHeight:"60vh"}}>
        <div className="wrap" style={{padding:"32px 20px"}}>

          {/* ═══ FEATURED TOPPERS WITH PHOTOS (Admin Managed) ═══ */}
          <div style={{marginBottom:36}}>
            <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:16}}>
              <div style={{width:36,height:36,borderRadius:8,background:"#FEF3C7",display:"flex",alignItems:"center",justifyContent:"center"}}>
                <i className="fas fa-crown" style={{color:"#D98D04",fontSize:".9rem"}}/>
              </div>
              <div>
                <h2 style={{fontFamily:"'Plus Jakarta Sans',sans-serif",fontSize:"1.15rem",fontWeight:800,color:"#0B1826"}}>Featured Toppers</h2>
                <p style={{fontSize:".74rem",color:"#6B7F99"}}>Our star performers with their achievements</p>
              </div>
            </div>

            {featuredToppers.length > 0 ? (() => {
  // Year-wise group
  const yg = {};
  featuredToppers.forEach(t => {
    const yr = t.year || "Other";
    if (!yg[yr]) yg[yr] = [];
    yg[yr].push(t);
  });
  const sortedYrs = Object.keys(yg).sort((a, b) => b.localeCompare(a));
  return (
    <div>
      {sortedYrs.map((yr, yi) => (
        <div key={yr} style={{marginBottom: 32}}>
          {/* Year Header */}
          <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:16}}>
            <div style={{background:"linear-gradient(135deg,#062560,#1548B0)",color:"#fff",padding:"6px 20px",borderRadius:99,fontSize:".8rem",fontWeight:800,letterSpacing:.5,display:"flex",alignItems:"center",gap:7,boxShadow:"0 3px 10px rgba(6,37,96,.2)"}}>
              <i className="fas fa-trophy" style={{color:"#FCD34D",fontSize:".75rem"}}/>
              Batch {yr}
            </div>
            <div style={{flex:1,height:1,background:"linear-gradient(90deg,#C0D0E8,transparent)"}}/>
            <span style={{fontSize:".72rem",color:"#6B7F99",fontWeight:600,background:"#EFF6FF",padding:"3px 10px",borderRadius:99,border:"1px solid #BFDBFE"}}>{yg[yr].length} Topper{yg[yr].length>1?"s":""}</span>
          </div>
          {/* Cards Grid */}
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(180px,1fr))",gap:14}}>
            {yg[yr].map((t, i) => (
              <div key={t.id}
                style={{background:"#fff",borderRadius:14,overflow:"hidden",border:"1px solid #D4DEF0",transition:"all .25s",cursor:"default"}}
                onMouseEnter={e=>{e.currentTarget.style.transform="translateY(-5px)";e.currentTarget.style.boxShadow="0 14px 36px rgba(7,41,107,.12)";e.currentTarget.style.borderColor="#BFDBFE";}}
                onMouseLeave={e=>{e.currentTarget.style.transform="none";e.currentTarget.style.boxShadow="none";e.currentTarget.style.borderColor="#D4DEF0";}}>
                {/* Photo — Portrait friendly, taller */}
                <div style={{height:230,background:`linear-gradient(160deg,${colors[i%6]},${colors[(i+2)%6]})`,position:"relative",overflow:"hidden"}}>
                  {t.photo ? (
                    <img src={t.photo} alt={t.name}
                      style={{width:"100%",height:"100%",objectFit:"cover",objectPosition:"top center"}}/>
                  ) : (
                    <div style={{width:"100%",height:"100%",display:"flex",alignItems:"center",justifyContent:"center"}}>
                      <i className="fas fa-user-graduate" style={{fontSize:"3.5rem",color:"rgba(255,255,255,.15)"}}/>
                    </div>
                  )}
                  {/* Dark gradient overlay at bottom */}
                  <div style={{position:"absolute",bottom:0,left:0,right:0,height:70,background:"linear-gradient(transparent,rgba(0,0,0,.65))"}}/>
                  {/* Percentage Badge — top right */}
                  {t.percentage && (
                    <div style={{position:"absolute",top:10,right:10,background:"#F5AC10",color:"#fff",padding:"4px 11px",borderRadius:99,fontSize:".74rem",fontWeight:800,boxShadow:"0 2px 8px rgba(0,0,0,.25)",letterSpacing:.3}}>
                      {t.percentage}
                    </div>
                  )}
                  {/* Rank — bottom overlay */}
                  {t.rank && (
                    <div style={{position:"absolute",bottom:8,left:10,right:10,fontSize:".63rem",color:"rgba(255,255,255,.92)",fontWeight:600,textAlign:"center",lineHeight:1.4}}>
                      {t.rank}
                    </div>
                  )}
                </div>
                {/* Info */}
                <div style={{padding:"11px 13px 12px"}}>
                  <div style={{fontFamily:"'Plus Jakarta Sans',sans-serif",fontWeight:700,fontSize:".88rem",color:"#0B1826",marginBottom:3,lineHeight:1.3}}>{t.name}</div>
                  <div style={{fontSize:".72rem",color:"#4A5E78",display:"flex",alignItems:"center",gap:5,flexWrap:"wrap"}}>
                    {t.class && <span style={{background:"#EFF6FF",color:"#1349A8",padding:"1px 8px",borderRadius:99,fontWeight:600}}>{t.class}</span>}
                    {t.board && <span style={{color:"#6B7F99"}}>{t.board}</span>}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
})() : (
  <div style={{background:"#fff",borderRadius:14,border:"2px dashed #D4DEF0",padding:"32px 20px",textAlign:"center"}}>
    <i className="fas fa-camera" style={{fontSize:"2rem",color:"#B0C4DC",marginBottom:10}}/>
    <h4 style={{fontSize:".92rem",fontWeight:700,color:"#4A5E78",marginBottom:4}}>Topper Photos Coming Soon</h4>
    <p style={{fontSize:".78rem",color:"#6B7F99"}}>Featured toppers with photos will be added by admin from the Admin Panel.</p>
  </div>
)}
              <div style={{background:"#fff",borderRadius:14,border:"2px dashed #D4DEF0",padding:"32px 20px",textAlign:"center"}}>
                <i className="fas fa-camera" style={{fontSize:"2rem",color:"#B0C4DC",marginBottom:10}}/>
                <h4 style={{fontSize:".92rem",fontWeight:700,color:"#4A5E78",marginBottom:4}}>Topper Photos Coming Soon</h4>
                <p style={{fontSize:".78rem",color:"#6B7F99"}}>Featured toppers with photos will be added by admin from the Admin Panel.</p>
              </div>
            )}
          </div>

          {/* ═══ YEAR WISE TOPPERS LIST ═══ */}
          <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:16}}>
            <div style={{width:36,height:36,borderRadius:8,background:"#EFF6FF",display:"flex",alignItems:"center",justifyContent:"center"}}>
              <i className="fas fa-list-ol" style={{color:"#1349A8",fontSize:".9rem"}}/>
            </div>
            <div>
              <h2 style={{fontFamily:"'Plus Jakarta Sans',sans-serif",fontSize:"1.15rem",fontWeight:800,color:"#0B1826"}}>Complete Toppers List</h2>
              <p style={{fontSize:".74rem",color:"#6B7F99"}}>Year wise toppers across all categories</p>
            </div>
          </div>

          {/* Category Tabs */}
          <div style={{display:"flex",flexWrap:"wrap",gap:8,marginBottom:20}}>
            {categories.map((cat)=>(
              <button key={cat} onClick={()=>setActiveTab(cat)} style={{
                padding:"8px 16px",borderRadius:99,border:activeTab===cat?"2px solid #1349A8":"1px solid #D4DEF0",
                background:activeTab===cat?"#1349A8":"#fff",color:activeTab===cat?"#fff":"#4A5E78",
                fontSize:".74rem",fontWeight:600,cursor:"pointer",transition:"all .2s",fontFamily:"'DM Sans',sans-serif"
              }}>
                {toppersData[cat].label}
              </button>
            ))}
          </div>

          {/* Category Title */}
          <div style={{marginBottom:16}}>
            <h3 style={{fontFamily:"'Plus Jakarta Sans',sans-serif",fontSize:"1rem",fontWeight:700,color:"#0B1826"}}>{data.label}</h3>
            <p style={{fontSize:".78rem",color:"#6B7F99"}}>{data.toppers.length} toppers in this category</p>
          </div>

          {/* Toppers Table */}
          <div style={{background:"#fff",borderRadius:14,border:"1px solid #D4DEF0",overflow:"hidden",marginBottom:20}}>
            <table style={{width:"100%",borderCollapse:"collapse",fontSize:".82rem"}}>
              <thead>
                <tr style={{background:"#F0F4FA"}}>
                  <th style={{padding:"12px 16px",textAlign:"left",fontWeight:700,color:"#0B1826",borderBottom:"2px solid #D4DEF0",width:40}}>#</th>
                  <th style={{padding:"12px 16px",textAlign:"left",fontWeight:700,color:"#0B1826",borderBottom:"2px solid #D4DEF0"}}>Student Name</th>
                  <th style={{padding:"12px 16px",textAlign:"left",fontWeight:700,color:"#0B1826",borderBottom:"2px solid #D4DEF0"}}>Percentage</th>
                  <th style={{padding:"12px 16px",textAlign:"left",fontWeight:700,color:"#0B1826",borderBottom:"2px solid #D4DEF0"}}>Year</th>
                  <th style={{padding:"12px 16px",textAlign:"left",fontWeight:700,color:"#0B1826",borderBottom:"2px solid #D4DEF0"}}>Position / Rank</th>
                </tr>
              </thead>
              <tbody>
                {data.toppers.map((t,i)=>(
                  <tr key={i} style={{borderBottom:"1px solid #E8EFF8",transition:"background .15s"}} onMouseEnter={e=>e.currentTarget.style.background="#F8FAFD"} onMouseLeave={e=>e.currentTarget.style.background="transparent"}>
                    <td style={{padding:"12px 16px",color:"#6B7F99",fontWeight:600}}>{i+1}</td>
                    <td style={{padding:"12px 16px"}}>
                      <div style={{display:"flex",alignItems:"center",gap:10}}>
                        <div style={{width:32,height:32,borderRadius:"50%",background:`linear-gradient(135deg,${colors[i%6]},${colors[(i+1)%6]})`,display:"flex",alignItems:"center",justifyContent:"center",color:"#fff",fontSize:".7rem",fontWeight:700,flexShrink:0}}>
                          {t.name.charAt(0)}
                        </div>
                        <span style={{fontWeight:600,color:"#0B1826"}}>{t.name}</span>
                      </div>
                    </td>
                    <td style={{padding:"12px 16px"}}>
                      {t.pct?<span style={{background:"#FEF3C7",color:"#92400E",padding:"3px 10px",borderRadius:99,fontSize:".74rem",fontWeight:700}}>{t.pct}</span>:<span style={{color:"#B0C4DC"}}>—</span>}
                    </td>
                    <td style={{padding:"12px 16px",color:"#1C2E44"}}>{t.year}</td>
                    <td style={{padding:"12px 16px"}}>
                      {t.rank?<span style={{background:"#EFF6FF",color:"#1349A8",padding:"3px 10px",borderRadius:99,fontSize:".72rem",fontWeight:600}}>{t.rank}</span>:<span style={{color:"#B0C4DC"}}>—</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Note */}
          <div style={{background:"#FFFBEB",borderRadius:12,padding:16,border:"1px solid #FDE68A",fontSize:".8rem",color:"#78350F",display:"flex",alignItems:"flex-start",gap:10,marginBottom:24}}>
            <i className="fas fa-info-circle" style={{marginTop:2,flexShrink:0}}/>
            <div><strong>Note:</strong> Some years are marked as gap years due to COVID-19 pandemic. Topper photos and additional details can be managed by admin from the Admin Panel.</div>
          </div>

          {/* CTA */}
          <div style={{textAlign:"center"}}>
            <Link href="/#enquiry" className="btn ba">Join PID & Become a Topper <i className="fas fa-arrow-right"/></Link>
          </div>

        </div>
      </div>

      {/* WhatsApp */}
      <a href="https://wa.me/918319002877" target="_blank" rel="noopener noreferrer" className="wa-float"><i className="fab fa-whatsapp"/></a>
    </>
  );
}