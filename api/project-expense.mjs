// Vercel serverless function: AI-powered expense projection using Gemini

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { currentSpend, daysElapsed, totalDays, pastMonths } = req.body ?? {};

  if (!daysElapsed || !totalDays) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  const apiKey = process.env.GEMINI_API_KEY ?? process.env.VITE_GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'GEMINI_API_KEY not configured' });
  }

  const historyLines = (pastMonths ?? [])
    .map(({ month, total }) => `  ${month}: S$${total.toFixed(2)}`)
    .join('\n');

  const prompt = `You are a personal finance assistant. Based on the spending data below, predict the total budgeted expense for the current month. Budgeted expenses exclude investments, income, and unbudgeted items.

Current month:
- Days elapsed: ${daysElapsed} of ${totalDays}
- Spent so far: S$${currentSpend.toFixed(2)}

Past months (budgeted spend totals):
${historyLines || '  No history available'}

Respond with ONLY a JSON object in this exact format, no markdown, no explanation:
{"projected": <number>, "note": "<one short sentence reason, max 60 chars>"}`;

  const models = ['gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-1.5-flash'];
  let lastError;

  for (const model of models) {
    try {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: { temperature: 0.2, maxOutputTokens: 128 },
          }),
        }
      );

      if (!response.ok) {
        lastError = `${model}: HTTP ${response.status}`;
        continue;
      }

      const data = await response.json();
      const text = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
      const clean = text.replace(/```[a-z]*\n?/g, '').trim();
      const parsed = JSON.parse(clean);

      if (typeof parsed.projected !== 'number') throw new Error('Invalid projected value');

      return res.status(200).json({ projected: parsed.projected, note: parsed.note ?? '', model });
    } catch (err) {
      lastError = err.message;
    }
  }

  return res.status(500).json({ error: lastError ?? 'All models failed' });
}
