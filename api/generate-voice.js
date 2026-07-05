const VALID_VOICES = [
  "Puck", "Charon", "Fenrir", "Kore", "Aoede", "Leda",
  "Zephyr", "Orus", "Callirrhoe", "Autonoe", "Enceladus", "Iapetus",
  "Umbriel", "Algieba", "Despina", "Erinome", "Algenib", "Rasalgethi",
  "Laomedeia", "Achernar", "Alnilam", "Schedar", "Gacrux", "Pulcherrima",
  "Achird", "Zubenelgenubi", "Vindemiatrix", "Sadachbia", "Sadaltager", "Sulafat",
];

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const { text, voice } = req.body || {};
  if (!text || !text.trim()) {
    res.status(400).json({ error: "Text is required" });
    return;
  }

  const selectedVoice = VALID_VOICES.includes(voice) ? voice : "Puck";

  const narrationPrompt = `Read the following passage aloud in a warm, clear, professional audiobook-narrator voice, with natural pacing, expression, and appropriate pauses — like a high-quality audiobook narration for students studying this material. Match the language of the text itself (do not switch languages).

Text to read:
${text}`;

  try {
    const model = "gemini-2.5-flash-preview-tts";
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${process.env.GEMINI_API_KEY}`;

    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: narrationPrompt }] }],
        generationConfig: {
          responseModalities: ["AUDIO"],
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName: selectedVoice } },
          },
        },
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("Gemini TTS API error:", errText);
      res.status(502).json({ error: "Upstream TTS API error" });
      return;
    }

    const data = await response.json();
    const audioBase64 = data?.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data
      || data?.candidates?.[0]?.content?.parts?.[0]?.inline_data?.data;

    if (!audioBase64) {
      console.error("No audio returned:", JSON.stringify(data).slice(0, 500));
      res.status(502).json({ error: "No audio generated" });
      return;
    }

    res.status(200).json({ audioBase64 });
  } catch (err) {
    console.error("Generate voice function error:", err);
    res.status(500).json({ error: "Voice generation failed" });
  }
}
