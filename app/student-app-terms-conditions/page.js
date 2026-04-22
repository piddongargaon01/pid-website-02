import React from 'react';
import Link from 'next/link';

export const metadata = {
  title: 'Student App Terms & Conditions | Patel Institute Dongargaon',
  description: 'Terms and Conditions for the Patel Institute Dongargaon Student App',
};

export default function StudentAppTerms() {
  return (
    <>
      <div style={{ background: "linear-gradient(135deg,#062560,#1548B0)", paddingTop: 80, paddingBottom: 60 }}>
        <div className="wrap" style={{ maxWidth: 1180, margin: "0 auto", padding: "0 24px" }}>
          <Link href="/" style={{ color: "rgba(255,255,255,.8)", fontSize: ".95rem", display: "inline-flex", alignItems: "center", gap: 8, marginBottom: 20, fontFamily: "'Inter', sans-serif" }}>
            <i className="fas fa-arrow-left" /> Back to Home
          </Link>
          <h1 style={{ fontFamily: "'Nunito',sans-serif", fontSize: "clamp(1.8rem,4vw,2.5rem)", fontWeight: 800, color: "#fff", marginBottom: 10 }}>Student App Terms & Conditions</h1>
          <p style={{ color: "rgba(255,255,255,.85)", fontSize: "1.05rem", fontFamily: "'Inter', sans-serif" }}>Effective Date: March 2026</p>
        </div>
      </div>

      <div style={{ background: "#E8EDF5", minHeight: "70vh", padding: "50px 0" }}>
        <div className="wrap" style={{ maxWidth: 900, margin: "0 auto", padding: "0 24px" }}>
          <div style={{ background: "#fff", borderRadius: 16, padding: "40px", border: "1px solid #B8C8E0", boxShadow: "0 4px 15px rgba(0,0,0,0.03)", color: "#14243A", fontFamily: "'Inter', sans-serif", fontSize: "1rem", lineHeight: 1.8 }}>
            
            <p style={{ marginBottom: 24, fontSize: "1.05rem" }}>
              These Terms and Conditions govern your use of the <strong>PID Student App</strong> provided by Patel Institute Dongargaon. By logging into this application, you agree to comply with these terms.
            </p>

            <h2 style={{ fontFamily: "'Nunito', sans-serif", fontSize: "1.3rem", fontWeight: 800, color: "#060D18", marginTop: 32, marginBottom: 12 }}>1. Authorized Access</h2>
            <p style={{ marginBottom: 16 }}>
              The Student App is designed exclusively for currently verified students of Patel Institute Dongargaon. 
              Only registered students who have had their email approved by the administrators are permitted to sign in. Unauthorized sharing of Google accounts to grant third-party access is strictly prohibited and can lead to suspension.
            </p>

            <h2 style={{ fontFamily: "'Nunito', sans-serif", fontSize: "1.3rem", fontWeight: 800, color: "#060D18", marginTop: 32, marginBottom: 12 }}>2. Intellectual Property</h2>
            <p style={{ marginBottom: 16 }}>
              All study materials, video links, PDF documents, and AI interactions provided inside the app are the exclusive intellectual property of Patel Institute.
            </p>
            <ul style={{ paddingLeft: 24, marginBottom: 24, display: "flex", flexDirection: "column", gap: 8 }}>
              <li><strong>Offline Downloads:</strong> Files saved for offline viewing are intended solely for personal study.</li>
              <li><strong>Prohibited Actions:</strong> You may not distribute, reproduce, or resell any digital content provided within this app.</li>
            </ul>

            <h2 style={{ fontFamily: "'Nunito', sans-serif", fontSize: "1.3rem", fontWeight: 800, color: "#060D18", marginTop: 32, marginBottom: 12 }}>3. AI Doubt Resolver Usage</h2>
            <p style={{ marginBottom: 16 }}>
              The AI features provided in this application are meant to assist with academic queries. We ask that users maintain appropriate language. Any usage of the AI utility for malicious activities, circumventing restrictions, or engaging in inappropriate conversations is forbidden and monitored.
            </p>

            <h2 style={{ fontFamily: "'Nunito', sans-serif", fontSize: "1.3rem", fontWeight: 800, color: "#060D18", marginTop: 32, marginBottom: 12 }}>4. Modifications to the Service</h2>
            <p style={{ marginBottom: 16 }}>
              Patel Institute reserves the right to modify or discontinue features within the app with or without prior notice. We regularly release updates to ensure compliance with Google Play Store rules, and users are expected to run the latest versions to access all features.
            </p>

            <h2 style={{ fontFamily: "'Nunito', sans-serif", fontSize: "1.3rem", fontWeight: 800, color: "#060D18", marginTop: 32, marginBottom: 12 }}>5. Limitation of Liability</h2>
            <p style={{ marginBottom: 24 }}>
              While we strive to ensure a smooth technical experience, the institute is not permanently liable for occasional network outages, third-party server (Google/Firebase) downtimes, or app caching errors on your specific device.
            </p>

            <h2 style={{ fontFamily: "'Nunito', sans-serif", fontSize: "1.3rem", fontWeight: 800, color: "#060D18", marginTop: 32, marginBottom: 12 }}>6. Contact Us</h2>
            <p style={{ marginBottom: 12 }}>Questions or concerns?</p>
            <div style={{ background: "#F0F4FA", padding: 20, borderRadius: 12, border: "1px solid #D4DEF0" }}>
              <p style={{ marginBottom: 8 }}><strong>Patel Institute Dongargaon</strong></p>
              <p style={{ marginBottom: 8 }}><i className="fas fa-envelope" style={{ color: "#1349A8", width: 24 }}/> patelinstitutedongargaon1234@gmail.com</p>
              <p><i className="fas fa-phone" style={{ color: "#1349A8", width: 24 }}/> +91 8319002877</p>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
