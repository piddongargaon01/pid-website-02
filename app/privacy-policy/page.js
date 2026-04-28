import React from 'react';
import Link from 'next/link';

export const metadata = {
  title: 'Privacy Policy | Patel Institute Dongargaon',
  description: 'Privacy Policy for patelinstitutedgn.in - Patel Institute Dongargaon',
};

export default function PrivacyPolicy() {
  return (
    <>
      <div style={{ background: "linear-gradient(135deg,#062560,#1548B0)", paddingTop: 80, paddingBottom: 60 }}>
        <div className="wrap" style={{ maxWidth: 1180, margin: "0 auto", padding: "0 24px" }}>
          <Link href="/" style={{ color: "rgba(255,255,255,.8)", fontSize: ".95rem", display: "inline-flex", alignItems: "center", gap: 8, marginBottom: 20, fontFamily: "'Inter', sans-serif" }}>
            <i className="fas fa-arrow-left" /> Back to Home
          </Link>
          <h1 style={{ fontFamily: "'Nunito',sans-serif", fontSize: "clamp(2rem,4vw,3rem)", fontWeight: 800, color: "#fff", marginBottom: 10 }}>Privacy Policy</h1>
          <p style={{ color: "rgba(255,255,255,.85)", fontSize: "1.05rem", fontFamily: "'Inter', sans-serif" }}>Last updated: March 2026</p>
        </div>
      </div>

      <div style={{ background: "#E8EDF5", minHeight: "70vh", padding: "50px 0" }}>
        <div className="wrap" style={{ maxWidth: 900, margin: "0 auto", padding: "0 24px" }}>
          <div style={{ background: "#fff", borderRadius: 16, padding: "40px", border: "1px solid #B8C8E0", boxShadow: "0 4px 15px rgba(0,0,0,0.03)", color: "#14243A", fontFamily: "'Inter', sans-serif", fontSize: "1rem", lineHeight: 1.8 }}>
            
            <p style={{ marginBottom: 24, fontSize: "1.05rem" }}>
              Welcome to <strong>patelinstitutedgn.in</strong>, the official website of <strong>Patel Institute Dongargaon</strong>. We are committed to protecting your personal information and your right to privacy.
            </p>

            <h2 style={{ fontFamily: "'Nunito', sans-serif", fontSize: "1.3rem", fontWeight: 800, color: "#060D18", marginTop: 32, marginBottom: 12 }}>1. Information We Collect</h2>
            <p style={{ marginBottom: 16 }}>We collect personal information that you voluntarily provide to us when you express an interest in obtaining information about us or our courses, or when you contact us (e.g., through our Enquiry Form). This may include:</p>
            <ul style={{ paddingLeft: 24, marginBottom: 24, display: "flex", flexDirection: "column", gap: 8 }}>
              <li>Name and Parent's Name</li>
              <li>Phone Numbers and Email Addresses</li>
              <li>Educational Details (Class, Board, Medium)</li>
              <li>Address details</li>
            </ul>

            <h2 style={{ fontFamily: "'Nunito', sans-serif", fontSize: "1.3rem", fontWeight: 800, color: "#060D18", marginTop: 32, marginBottom: 12 }}>2. How We Use Your Information</h2>
            <p style={{ marginBottom: 16 }}>We use the information we collect or receive to:</p>
            <ul style={{ paddingLeft: 24, marginBottom: 24, display: "flex", flexDirection: "column", gap: 8 }}>
              <li>Respond to your admission inquiries and provide counseling.</li>
              <li>Send administrative information to you regarding schedules and fee updates.</li>
              <li>Improve our website, services, and overall student experience.</li>
              <li><strong>We do not sell, rent, or trade your personal data with third parties.</strong></li>
            </ul>

            <h2 style={{ fontFamily: "'Nunito', sans-serif", fontSize: "1.3rem", fontWeight: 800, color: "#060D18", marginTop: 32, marginBottom: 12 }}>3. Third-Party Services</h2>
            <p style={{ marginBottom: 16 }}>Our website utilizes trusted third-party services that may collect information used to identify you and ensure secure website operations:</p>
            <ul style={{ paddingLeft: 24, marginBottom: 24, display: "flex", flexDirection: "column", gap: 8 }}>
              <li><strong>Google Authentication:</strong> Used for secure student portal login.</li>
              <li><strong>Firebase (Firestore & Auth):</strong> Used to securely store website data, enquiries, and student reviews.</li>
              <li><strong>Cloudinary:</strong> Used for secure image hosting and optimization for website media.</li>
            </ul>

            <h2 style={{ fontFamily: "'Nunito', sans-serif", fontSize: "1.3rem", fontWeight: 800, color: "#060D18", marginTop: 32, marginBottom: 12 }}>4. Cookies and Tracking</h2>
            <p style={{ marginBottom: 24 }}>We may use cookies and similar tracking technologies to access or store information to improve website performance, speed, and user experience.</p>

            <h2 style={{ fontFamily: "'Nunito', sans-serif", fontSize: "1.3rem", fontWeight: 800, color: "#060D18", marginTop: 32, marginBottom: 12 }}>5. Children's Privacy</h2>
            <p style={{ marginBottom: 24 }}>Our institute serves students starting from Class 2. While our coaching services involve minors, this website is intended to be used and interacted with by parents or guardians of younger students. Any data collected regarding a minor is used strictly for educational and administrative purposes.</p>

            <h2 style={{ fontFamily: "'Nunito', sans-serif", fontSize: "1.3rem", fontWeight: 800, color: "#060D18", marginTop: 32, marginBottom: 12 }}>6. Contact Us</h2>
            <p style={{ marginBottom: 12 }}>If you have questions or comments about this notice, you may contact us at:</p>
            <div style={{ background: "#F0F4FA", padding: 20, borderRadius: 12, border: "1px solid #D4DEF0" }}>
              <p style={{ marginBottom: 8 }}><strong>Patel Institute Dongargaon</strong></p>
              <p style={{ marginBottom: 8, wordBreak: 'break-all' }}><i className="fas fa-envelope" style={{ color: "#1349A8", width: 24 }}/> patelinstitutedongargaon1234@gmail.com</p>
              <p style={{ marginBottom: 8 }}><i className="fas fa-phone" style={{ color: "#1349A8", width: 24 }}/> +91 8319002877, +91 7470412110</p>
              <p><i className="fas fa-map-marker-alt" style={{ color: "#1349A8", width: 24 }}/> Matiya Road, Near Saket Dham Parisar, Dongargaon, Dist. Rajnandgaon, CG - 491445</p>
            </div>

          </div>
        </div>
      </div>
    </>
  );
}