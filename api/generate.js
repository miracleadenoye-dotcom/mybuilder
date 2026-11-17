const SYSTEM = `You are an expert web app builder. Output ONE complete, self-contained HTML file (inline CSS and JS, no external build step) that does exactly what the user asks. Make it responsive, clean and bug-free. Handle empty and error states. Return ONLY the HTML code, no explanations, no markdown fences. If given existing code plus a change request, return the full updated file with the change applied and everything else unchanged.`;

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });
  const key = process.env.GEMINI_API_KEY;
  if (!key) return res.status(500).json({ error: 'GEMINI_API_KEY is not set in Vercel.' });
  const { prompt = '', code = '' } = req.body || {};
  if (!prompt.trim() || prompt.length > 4000) return res.status(400).json({ error: 'Bad prompt.' });
  const model = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
  const text = code
    ? `Existing code:\n${code.slice(0, 60000)}\n\nChange request: ${prompt}`
    : `Build this app: ${prompt}`;
  try {
    const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: SYSTEM }] },
        contents: [{ role: 'user', parts: [{ text }] }],
        generationConfig: { maxOutputTokens: 16000 }
      })
    });
    const data = await r.json();
    if (!r.ok) return res.status(502).json({ error: data?.error?.message || 'AI request failed' });
    let out = data.candidates?.[0]?.content?.parts?.map(p => p.text).join('') || '';
    out = out.replace(/^```html\s*/i, '').replace(/```\s*$/, '').trim();
    if (!out) return res.status(502).json({ error: 'Empty answer, try again.' });
    res.status(200).json({ html: out });
  } catch (e) {
    res.status(500).json({ error: 'Server error: ' + e.message });
  }
}
