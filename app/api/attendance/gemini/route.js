import { NextResponse } from "next/server";

const GEMINI_API_KEY = AIzaSyDNaslgQ3OUpjHZb5qkeEAO38G8gdgu4ug || "AIzaSyCqy0iboM1-q0LSARp1NMvHnG_EvmL0ItA";

export async function POST(request) {
  try {
    const body = await request.json();
    const { prompt, image } = body;

    if (!prompt) {
      return NextResponse.json({ error: "Prompt required" }, { status: 400 });
    }

    // Message parts banao — text + optional image
    const parts = [];
    if (image) {
      // Base64 image support (doubt solver ke liye)
      parts.push({
        inline_data: {
          mime_type: image.mimeType || "image/jpeg",
          data: image.data,
        },
      });
    }
    parts.push({ text: prompt });

    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts }],
          generationConfig: {
            temperature: 0.7,
            maxOutputTokens: 8192,
          },
        }),
      }
    );

    if (!res.ok) {
      const err = await res.text();
      return NextResponse.json(
        { error: "Gemini API error: " + err },
        { status: res.status }
      );
    }

    const data = await res.json();
    const text =
      data?.candidates?.[0]?.content?.parts?.[0]?.text || "";

    return NextResponse.json({ response: text });

  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}