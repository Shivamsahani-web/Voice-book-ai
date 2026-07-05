export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const { fileBase64, mimeType } = req.body || {};
  if (!fileBase64 || !mimeType) {
    res.status(400).json({ error: "File is required" });
    return;
  }

  const prompt = `You are an expert OCR system. Carefully read every word of text visible in the uploaded image or PDF page.

RULES:
- Extract ALL text exactly as it appears, preserving the original language and script (do not translate — if it's Hindi/Devanagari, keep it in Hindi; if English, keep it in English).
- Fix obvious OCR line-break issues so that sentences and paragraphs read naturally and continuously (join words that were broken across lines, but do not change or paraphrase any actual words).
- Preserve paragraph breaks where they clearly exist in the source.
- Do NOT add any commentary, headers, labels, or notes of your own — output ONLY the extracted text itself.
- If the image contains no readable text, output exactly: NO_TEXT_FOUND`;

  try {
    const model = "gemini-2.5-flash";
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${process.env.GEMINI_API_KEY}`;

    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              { text: prompt },
              { inline_data: { mime_type: mimeType, data: fileBase64 } },
            ],
          },
        ],
        generationConfig: {
          maxOutputTokens: 4000,
          temperature: 0.2,
          thinking_config: { thinking_budget: 0 },
        },
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("Gemini API error:", errText);
      res.status(502).json({ error: "Upstream API error" });
      return;
    }

    const data = await response.json();
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || "";
    const clean = text.trim();

    if (!clean || clean === "NO_TEXT_FOUND") {
      res.status(200).json({ text: "", warning: "Is image mein koi readable text nahi mila." });
      return;
    }

    res.status(200).json({ text: clean });
  } catch (err) {
    console.error("Extract text function error:", err);
    res.status(500).json({ error: "Text extraction failed" });
  }
}
