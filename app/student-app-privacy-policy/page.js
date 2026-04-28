import React from 'react';
import Link from 'next/link';

export const metadata = {
  title: 'Student App Privacy Policy | Patel Institute Dongargaon',
  description: 'Privacy Policy for the Patel Institute Dongargaon Student App',
};

export default function StudentAppPrivacyPolicy() {
  return (
    <>
      <div style={{ background: "linear-gradient(135deg,#062560,#1548B0)", paddingTop: 80, paddingBottom: 60 }}>
        <div className="wrap" style={{ maxWidth: 1180, margin: "0 auto", padding: "0 24px" }}>
          <Link href="/" style={{ color: "rgba(255,255,255,.8)", fontSize: ".95rem", display: "inline-flex", alignItems: "center", gap: 8, marginBottom: 20, fontFamily: "'Inter', sans-serif" }}>
            <i className="fas fa-arrow-left" /> Back to Home
          </Link>
          <h1 style={{ fontFamily: "'Nunito',sans-serif", fontSize: "clamp(1.8rem,4vw,2.5rem)", fontWeight: 800, color: "#fff", marginBottom: 10 }}>Student App Privacy Policy</h1>
          <p style={{ color: "rgba(255,255,255,.85)", fontSize: "1.05rem", fontFamily: "'Inter', sans-serif" }}>Effective Date: March 2026</p>
        </div>
      </div>

      <div style={{ background: "#E8EDF5", minHeight: "70vh", padding: "50px 0" }}>
        <div className="wrap" style={{ maxWidth: 900, margin: "0 auto", padding: "0 24px" }}>
          <div style={{ background: "#fff", borderRadius: 16, padding: "40px", border: "1px solid #B8C8E0", boxShadow: "0 4px 15px rgba(0,0,0,0.03)", color: "#14243A", fontFamily: "'Inter', sans-serif", fontSize: "1rem", lineHeight: 1.8 }}>
            
            <p style={{ marginBottom: 24, fontSize: "1.05rem" }}>
              Welcome to the <strong>PID Student App</strong>, operated by <strong>Patel Institute Dongargaon</strong>. We are committed to protecting your personal information and providing a secure learning environment. This policy explicitly outlines how we collect, use, and protect data through our mobile application.
            </p>

            <h2 style={{ fontFamily: "'Nunito', sans-serif", fontSize: "1.3rem", fontWeight: 800, color: "#060D18", marginTop: 32, marginBottom: 12 }}>1. Device Permissions & App Integrations</h2>
            <p style={{ marginBottom: 16 }}>To provide core app functionalities, we request the following device permissions:</p>
            <ul style={{ paddingLeft: 24, marginBottom: 24, display: "flex", flexDirection: "column", gap: 8 }}>
              <li><strong>Camera & Photo Library:</strong> We may request access to your camera and gallery strictly for updating your profile picture within the app. Images are securely uploaded to our servers via Cloudinary/Firebase and are not accessible to external third parties.</li>
              <li><strong>Local Storage:</strong> We use local device storage to cache images and securely save study materials locally so you can view content offline.</li>
              <li><strong>Push Notifications:</strong> With your permission, we send push notifications to alert you regarding scheduled classes, fees, exam updates, and important announcements.</li>
              <li><strong>Device Info:</strong> We may collect non-identifiable device data (like OS version) solely for optimizing app performance and fixing crashes.</li>
            </ul>

            <h2 style={{ fontFamily: "'Nunito', sans-serif", fontSize: "1.3rem", fontWeight: 800, color: "#060D18", marginTop: 32, marginBottom: 12 }}>2. Personal Information Collected</h2>
            <p style={{ marginBottom: 16 }}>The app syncs with our central database to verify your student status. We collect and process:</p>
            <ul style={{ paddingLeft: 24, marginBottom: 24, display: "flex", flexDirection: "column", gap: 8 }}>
              <li><strong>Google Account Data:</strong> We use Google Authentication to verify your identity. We collect your Google Email Address and Name strictly for secure login.</li>
              <li><strong>Profile Information:</strong> Educational details (Class, Medium, Board, RFID Tag Data).</li>
              <li><strong>Activity Data:</strong> Attendance logs, exam marks, and doubt queries you interact with in the AI assistant.</li>
            </ul>

            <h2 style={{ fontFamily: "'Nunito', sans-serif", fontSize: "1.3rem", fontWeight: 800, color: "#060D18", marginTop: 32, marginBottom: 12 }}>3. How We Use and Protect Your Information</h2>
            <p style={{ marginBottom: 16 }}>Your data is meant to keep you engaged with our curriculum. We use it to:</p>
            <ul style={{ paddingLeft: 24, marginBottom: 24, display: "flex", flexDirection: "column", gap: 8 }}>
              <li>Provide personalized study statistics, attendance charts, and AI-driven doubt solving.</li>
              <li>Securely authenticate you via Firebase Authentication.</li>
              <li>We <strong>do not</strong> sell your data to any third-party marketing companies. Data is exclusively stored using Google Firebase infrastructure, ensuring enterprise-grade security.</li>
            </ul>

            <h2 style={{ fontFamily: "'Nunito', sans-serif", fontSize: "1.3rem", fontWeight: 800, color: "#060D18", marginTop: 32, marginBottom: 12 }}>4. Third-Party Services</h2>
            <p style={{ marginBottom: 16 }}>Our app uses trusted dependencies required for stable operations:</p>
            <ul style={{ paddingLeft: 24, marginBottom: 24, display: "flex", flexDirection: "column", gap: 8 }}>
              <li><strong>Expo Services (Push Notifications, WebBrowser):</strong> For rendering the UI and delivery of real-time alerts.</li>
              <li><strong>Firebase (Auth & Firestore):</strong> For secure authentication and real-time data sync.</li>
            </ul>

            <h2 style={{ fontFamily: "'Nunito', sans-serif", fontSize: "1.3rem", fontWeight: 800, color: "#060D18", marginTop: 32, marginBottom: 12 }}>5. Contact Us</h2>
            <p style={{ marginBottom: 12 }}>For any privacy-related queries regarding the Student App, contact us at:</p>
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
