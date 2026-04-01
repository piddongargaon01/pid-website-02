import React from 'react';
import Link from 'next/link';

export const metadata = {
  title: 'Terms & Conditions | Patel Institute Dongargaon',
  description: 'Rules, regulations, and fee policies for students and parents at Patel Institute Dongargaon.',
};

export default function TermsAndConditions() {
  return (
    <>
      <div style={{ background: "linear-gradient(135deg,#062560,#1548B0)", paddingTop: 80, paddingBottom: 60 }}>
        <div className="wrap" style={{ maxWidth: 1180, margin: "0 auto", padding: "0 24px" }}>
          <Link href="/" style={{ color: "rgba(255,255,255,.8)", fontSize: ".95rem", display: "inline-flex", alignItems: "center", gap: 8, marginBottom: 20, fontFamily: "'Inter', sans-serif" }}>
            <i className="fas fa-arrow-left" /> Back to Home
          </Link>
          <h1 style={{ fontFamily: "'Nunito',sans-serif", fontSize: "clamp(2rem,4vw,3rem)", fontWeight: 800, color: "#fff", marginBottom: 10 }}>Terms & Conditions</h1>
          <p style={{ color: "rgba(255,255,255,.85)", fontSize: "1.05rem", fontFamily: "'Inter', sans-serif" }}>Rules and regulations for students and parents</p>
        </div>
      </div>

      <div style={{ background: "#E8EDF5", minHeight: "70vh", padding: "50px 0" }}>
        <div className="wrap" style={{ maxWidth: 900, margin: "0 auto", padding: "0 24px" }}>
          <div style={{ background: "#fff", borderRadius: 16, padding: "40px", border: "1px solid #B8C8E0", boxShadow: "0 4px 15px rgba(0,0,0,0.03)", color: "#14243A", fontFamily: "'Inter', sans-serif", fontSize: "1rem", lineHeight: 1.8 }}>
            
            <div style={{ background: "#FFFBEB", borderLeft: "4px solid #F5AC10", padding: 16, borderRadius: "0 12px 12px 0", marginBottom: 32, fontSize: ".95rem", color: "#92400E" }}>
              By taking admission in Patel Institute Dongargaon, students and parents agree to strictly abide by the following rules and regulations.
            </div>

            <h2 style={{ fontFamily: "'Nunito', sans-serif", fontSize: "1.3rem", fontWeight: 800, color: "#1349A8", marginTop: 32, marginBottom: 12, display: "flex", alignItems: "center", gap: 10 }}>
              <i className="fas fa-user-shield" /> 1. General Discipline & Attendance
            </h2>
            <ul style={{ paddingLeft: 24, marginBottom: 24, display: "flex", flexDirection: "column", gap: 8 }}>
              <li>Student must arrive on time as per the scheduled coaching batch.</li>
              <li><strong>Mobile phones are strictly prohibited</strong> inside the coaching premises. However, students traveling from a distance of 10km+ can bring their phones but must keep them submitted in the office during class hours.</li>
              <li>Students are fully responsible for their own safety and belongings outside the coaching premises.</li>
              <li>Lunch/dinner, if required, must be brought from home.</li>
            </ul>

            <h2 style={{ fontFamily: "'Nunito', sans-serif", fontSize: "1.3rem", fontWeight: 800, color: "#1349A8", marginTop: 32, marginBottom: 12, display: "flex", alignItems: "center", gap: 10 }}>
              <i className="fas fa-book-open" /> 2. Academics & Progress
            </h2>
            <ul style={{ paddingLeft: 24, marginBottom: 24, display: "flex", flexDirection: "column", gap: 8 }}>
              <li>Weekly and monthly assessments are mandatory for all students.</li>
              <li>Homework and daily practice papers (DPPs) must be completed on time.</li>
              <li>Parents must check their child's academic progress regularly and attend PTMs.</li>
              <li>The institute provides quality education and guidance, but <strong>does not guarantee passing or a specific percentage</strong>. Success ultimately depends on the student's personal hard work and dedication.</li>
              <li>Our teachers focus on mental growth and discipline. Teachers will not use any form of physical punishment.</li>
            </ul>

            <h2 style={{ fontFamily: "'Nunito', sans-serif", fontSize: "1.3rem", fontWeight: 800, color: "#1349A8", marginTop: 32, marginBottom: 12, display: "flex", alignItems: "center", gap: 10 }}>
              <i className="fas fa-rupee-sign" /> 3. Fee Structure & Policies
            </h2>
            <ul style={{ paddingLeft: 24, marginBottom: 24, display: "flex", flexDirection: "column", gap: 8 }}>
              <li>Admission fee is <strong>₹500</strong> (Strictly non-refundable).</li>
              <li><strong>For Class 9 to 12:</strong> 50% of the total course fee must be paid upfront within 7 days of admission.</li>
              <li><strong>For Class 10 & 12:</strong> The minimum due fee amount must be paid in the first week of every month.</li>
              <li><strong>For Class 9 & 11:</strong> The minimum due fee amount must be completely cleared by January.</li>
              <li>If a student decides to stop attending classes mid-course for any reason, <strong>full fee payment is still required</strong>.</li>
              <li><strong style={{ color: "#DC2626" }}>There is strictly no refund of fees under any installments or circumstances.</strong></li>
            </ul>

            <div style={{ marginTop: 48, paddingTop: 24, borderTop: "2px dashed #D4DEF0", textAlign: "center", fontSize: ".9rem", color: "#5A7088" }}>
              <p style={{ fontWeight: 800, color: "#060D18", fontSize: "1.1rem", fontFamily: "'Nunito', sans-serif", marginBottom: 4 }}>Patel Institute Dongargaon</p>
              <p>Registration: Patel Sikshan Avam Sewa Samiti — C.G. Reg. No. 122201880553</p>
              <p>Matiya Road, Near Saket Dham Parisar, Dongargaon, Dist. Rajnandgaon, CG - 491445</p>
            </div>

          </div>
        </div>
      </div>
    </>
  );
}