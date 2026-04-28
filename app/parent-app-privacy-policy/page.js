import React from 'react';
import Link from 'next/link';

export const metadata = {
  title: 'Parent App Privacy Policy | Patel Institute Dongargaon',
  description: 'Privacy Policy for the Patel Institute Dongargaon Parent App',
};

export default function ParentAppPrivacyPolicy() {
  return (
    <>
      <div style={{ background: "linear-gradient(135deg,#062560,#1548B0)", paddingTop: 80, paddingBottom: 60 }}>
        <div className="wrap" style={{ maxWidth: 1180, margin: "0 auto", padding: "0 24px" }}>
          <Link href="/" style={{ color: "rgba(255,255,255,.8)", fontSize: ".95rem", display: "inline-flex", alignItems: "center", gap: 8, marginBottom: 20, fontFamily: "'Inter', sans-serif" }}>
            <i className="fas fa-arrow-left" /> Back to Home
          </Link>
          <h1 style={{ fontFamily: "'Nunito',sans-serif", fontSize: "clamp(1.8rem,4vw,2.5rem)", fontWeight: 800, color: "#fff", marginBottom: 10 }}>Parent App Privacy Policy</h1>
          <p style={{ color: "rgba(255,255,255,.85)", fontSize: "1.05rem", fontFamily: "'Inter', sans-serif" }}>Effective Date: March 2026</p>
        </div>
      </div>

      <div style={{ background: "#E8EDF5", minHeight: "70vh", padding: "50px 0" }}>
        <div className="wrap" style={{ maxWidth: 900, margin: "0 auto", padding: "0 24px" }}>
          <div style={{ background: "#fff", borderRadius: 16, padding: "40px", border: "1px solid #B8C8E0", boxShadow: "0 4px 15px rgba(0,0,0,0.03)", color: "#14243A", fontFamily: "'Inter', sans-serif", fontSize: "1rem", lineHeight: 1.8 }}>
            
            <p style={{ marginBottom: 24, fontSize: "1.05rem" }}>
              Welcome to the <strong>PID Parent App</strong>. This privacy policy explains how Patel Institute Dongargaon collects, uses, and safeguards the data of parents and guardians who use this app to monitor their child's academic progress.
            </p>

            <h2 style={{ fontFamily: "'Nunito', sans-serif", fontSize: "1.3rem", fontWeight: 800, color: "#060D18", marginTop: 32, marginBottom: 12 }}>1. Device Permissions Requested</h2>
            <p style={{ marginBottom: 16 }}>To offer real-time tracking capabilities, the Parent App requests the following permissions:</p>
            <ul style={{ paddingLeft: 24, marginBottom: 24, display: "flex", flexDirection: "column", gap: 8 }}>
              <li><strong>Local Storage:</strong> Used to temporarily store images (like your ward's profile picture or institution notices) so the app works efficiently and offline.</li>
              <li><strong>Push Notifications (Critical):</strong> Crucial for the functionality of this app. We request notifications to instantly alert you when your child check-ins via RFID, when fees are due, or when performance reports are updated.</li>
              <li><strong>Camera & Photos (Optional):</strong> Only requested if updating parent/student profile details through internal portal systems, communicating directly with admins.</li>
            </ul>

            <h2 style={{ fontFamily: "'Nunito', sans-serif", fontSize: "1.3rem", fontWeight: 800, color: "#060D18", marginTop: 32, marginBottom: 12 }}>2. What Data We Collect and Show</h2>
            <p style={{ marginBottom: 16 }}>The app provides a direct line of sight into the central PID database. We handle:</p>
            <ul style={{ paddingLeft: 24, marginBottom: 24, display: "flex", flexDirection: "column", gap: 8 }}>
              <li><strong>Parent Login Credentials:</strong> We securely authenticate your email matching our database records.</li>
              <li><strong>Ward Data:</strong> We display sensitive student data to you, including overall attendance, specific check-in/out timestamps, exam marks, and course fee payment history.</li>
            </ul>

            <h2 style={{ fontFamily: "'Nunito', sans-serif", fontSize: "1.3rem", fontWeight: 800, color: "#060D18", marginTop: 32, marginBottom: 12 }}>3. Security & Limited Usage</h2>
            <p style={{ marginBottom: 16 }}>Your data and your child's data are strictly confidential.</p>
            <ul style={{ paddingLeft: 24, marginBottom: 24, display: "flex", flexDirection: "column", gap: 8 }}>
              <li>We will never sell or exploit contact information for external advertising.</li>
              <li>Authentication is secured using Google Auth protocols.</li>
              <li>Data is synced over secured HTTPS connections and rests safely within Google Firebase architecture.</li>
            </ul>

            <h2 style={{ fontFamily: "'Nunito', sans-serif", fontSize: "1.3rem", fontWeight: 800, color: "#060D18", marginTop: 32, marginBottom: 12 }}>4. Modifications to Policy</h2>
            <p style={{ marginBottom: 16 }}>We may update this privacy statement if Play Store guidelines or our systems evolve. Major updates will be broadcasted to parents via the app Notices section.</p>

            <h2 style={{ fontFamily: "'Nunito', sans-serif", fontSize: "1.3rem", fontWeight: 800, color: "#060D18", marginTop: 32, marginBottom: 12 }}>5. Contact Us</h2>
            <p style={{ marginBottom: 12 }}>For transparency regarding data practices, contact the administration:</p>
            <div style={{ background: "#F0F4FA", padding: 20, borderRadius: 12, border: "1px solid #D4DEF0" }}>
              <p style={{ marginBottom: 8 }}><strong>Patel Institute Dongargaon</strong></p>
              <p style={{ marginBottom: 8, wordBreak: 'break-all' }}><i className="fas fa-envelope" style={{ color: "#1349A8", width: 24 }}/> patelinstitutedongargaon1234@gmail.com</p>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
