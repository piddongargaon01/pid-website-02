import React from 'react';
import Link from 'next/link';

export const metadata = {
  title: 'Parent App Terms & Conditions | Patel Institute Dongargaon',
  description: 'Terms and Conditions for the Patel Institute Dongargaon Parent App',
};

export default function ParentAppTerms() {
  return (
    <>
      <div style={{ background: "linear-gradient(135deg,#062560,#1548B0)", paddingTop: 80, paddingBottom: 60 }}>
        <div className="wrap" style={{ maxWidth: 1180, margin: "0 auto", padding: "0 24px" }}>
          <Link href="/" style={{ color: "rgba(255,255,255,.8)", fontSize: ".95rem", display: "inline-flex", alignItems: "center", gap: 8, marginBottom: 20, fontFamily: "'Inter', sans-serif" }}>
            <i className="fas fa-arrow-left" /> Back to Home
          </Link>
          <h1 style={{ fontFamily: "'Nunito',sans-serif", fontSize: "clamp(1.8rem,4vw,2.5rem)", fontWeight: 800, color: "#fff", marginBottom: 10 }}>Parent App Terms & Conditions</h1>
          <p style={{ color: "rgba(255,255,255,.85)", fontSize: "1.05rem", fontFamily: "'Inter', sans-serif" }}>Effective Date: March 2026</p>
        </div>
      </div>

      <div style={{ background: "#E8EDF5", minHeight: "70vh", padding: "50px 0" }}>
        <div className="wrap" style={{ maxWidth: 900, margin: "0 auto", padding: "0 24px" }}>
          <div style={{ background: "#fff", borderRadius: 16, padding: "40px", border: "1px solid #B8C8E0", boxShadow: "0 4px 15px rgba(0,0,0,0.03)", color: "#14243A", fontFamily: "'Inter', sans-serif", fontSize: "1rem", lineHeight: 1.8 }}>
            
            <p style={{ marginBottom: 24, fontSize: "1.05rem" }}>
              These rules define your use of the <strong>PID Parent App</strong>, operated by Patel Institute Dongargaon. By logging into the Parent portal on your mobile device, you signify your agreement to these terms.
            </p>

            <h2 style={{ fontFamily: "'Nunito', sans-serif", fontSize: "1.3rem", fontWeight: 800, color: "#060D18", marginTop: 32, marginBottom: 12 }}>1. Purpose of the Application</h2>
            <p style={{ marginBottom: 16 }}>
              The Parent App acts strictly as an informational dashboard to increase transparency between the institute and guardians regarding a student's performance, attendance, and fee ledgers.
            </p>

            <h2 style={{ fontFamily: "'Nunito', sans-serif", fontSize: "1.3rem", fontWeight: 800, color: "#060D18", marginTop: 32, marginBottom: 12 }}>2. Valid Registration Required</h2>
            <p style={{ marginBottom: 16 }}>
              Access is strictly provisioned for parents whose email addresses were registered during the student's formal enrollment at Patel Institute. 
              Accounts found to be manipulated, spoofed, or accessed by unassociated individuals will be blacklisted permanently without recourse.
            </p>

            <h2 style={{ fontFamily: "'Nunito', sans-serif", fontSize: "1.3rem", fontWeight: 800, color: "#060D18", marginTop: 32, marginBottom: 12 }}>3. Financial Data & Discrepancies</h2>
            <p style={{ marginBottom: 16 }}>
              The Fee Management section displays paid amounts and due balances based on office records. 
              If you identify a discrepancy in the app regarding an installment paid, please contact the institute front desk directly with your physical receipt. The digital app display is informational, while physical/bank records act as absolute proof of payment.
            </p>

            <h2 style={{ fontFamily: "'Nunito', sans-serif", fontSize: "1.3rem", fontWeight: 800, color: "#060D18", marginTop: 32, marginBottom: 12 }}>4. Push Notifications Agreement</h2>
            <p style={{ marginBottom: 16 }}>
              By utilizing the app, you agree to receive digital notifications regarding check-ins, check-outs, missing attendance, and exam scores. You may disable them at any time from your device's settings.
            </p>

            <h2 style={{ fontFamily: "'Nunito', sans-serif", fontSize: "1.3rem", fontWeight: 800, color: "#060D18", marginTop: 32, marginBottom: 12 }}>5. Contact Us</h2>
            <div style={{ background: "#F0F4FA", padding: 20, borderRadius: 12, border: "1px solid #D4DEF0" }}>
              <p style={{ marginBottom: 8 }}><strong>Patel Institute Dongargaon</strong></p>
              <p style={{ marginBottom: 8, wordBreak: 'break-all' }}><i className="fas fa-envelope" style={{ color: "#1349A8", width: 24 }}/> patelinstitutedongargaon1234@gmail.com</p>
              <p><i className="fas fa-phone" style={{ color: "#1349A8", width: 24 }}/> +91 8319002877, +91 7470412110</p>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
