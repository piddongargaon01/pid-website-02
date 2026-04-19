export async function POST(request) {
  try {
    const { tokens, title, body, data } = await request.json();
    if (!tokens || tokens.length === 0) {
      return Response.json({ error: "No tokens" }, { status: 400 });
    }

    const messages = tokens.map(token => ({
      to: token,
      sound: "default",
      title,
      body,
      data: data || {},
      priority: "high",
      channelId: "default",
    }));

    const response = await fetch("https://exp.host/--/api/v2/push/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(messages),
    });

    const result = await response.json();
    return Response.json({ success: true, sent: messages.length, result });
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}