"use client";
import { useState } from "react";

export default function TestPage() {
  const [count, setCount] = useState(0);
  
  return (
    <div style={{ padding: 40, fontFamily: 'sans-serif' }}>
      <h1 style={{ color: '#1349A8', fontSize: '2rem' }}>
        TEST PAGE - EXAM SECTION
      </h1>
      <p style={{ fontSize: '1.2rem', marginBottom: 20 }}>
        If you can see this, the page is working!
      </p>
      <p style={{ fontSize: '1.2rem', marginBottom: 20 }}>
        Counter: {count}
      </p>
      <button 
        onClick={() => setCount(c => c + 1)}
        style={{ padding: '12px 24px', background: '#1349A8', color: '#fff', border: 'none', borderRadius: 8, fontSize: '1rem', cursor: 'pointer' }}
      >
        Click Me (+1)
      </button>
    </div>
  );
}