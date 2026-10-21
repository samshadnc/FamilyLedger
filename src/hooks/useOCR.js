import { CATEGORIES } from '../constants';

const GEMINI_KEY = import.meta.env.VITE_GEMINI_API_KEY;
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-lite-latest:generateContent?key=${GEMINI_KEY}`;

const PROMPT = `You are a receipt parser. Extract the following from this receipt image and return ONLY valid JSON, no markdown, no explanation:
{
  "shopName": "merchant/store name or null",
  "amount": total amount as a number or null,
  "currency": "SGD" or "INR" based on receipt, default "SGD",
  "cardBank": "bank or card name visible on receipt (e.g. DBS, VISA, Scapia, NETS) or null",
  "items": "comma-separated list of purchased items (not prices, not totals) or null",
  "category": "the single best-fitting category id for this purchase, one of: ${CATEGORIES.map(c => `${c.id} (${c.label})`).join(', ')}"
}`;

async function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result.split(',')[1]);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export async function runOCR(file, userAccounts = {}) {
  if (!GEMINI_KEY) throw new Error('VITE_GEMINI_API_KEY not set');

  const base64 = await fileToBase64(file);
  const mimeType = file.type || 'image/jpeg';

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);
  const res = await fetch(GEMINI_URL, {
    method: 'POST',
    signal: controller.signal,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{
        parts: [
          { text: PROMPT },
          { inline_data: { mime_type: mimeType, data: base64 } },
        ],
      }],
      generationConfig: { temperature: 0 },
    }),
  });

  clearTimeout(timeout);
  if (!res.ok) throw new Error(`Gemini error ${res.status}`);
  const data = await res.json();
  const raw = data.candidates?.[0]?.content?.parts?.[0]?.text ?? '';

  let parsed;
  try {
    // Strip any accidental markdown fences
    const clean = raw.replace(/```json|```/g, '').trim();
    parsed = JSON.parse(clean);
  } catch {
    return null;
  }

  // Resolve cardBank text → account id from user's accounts
  const allAccounts = Object.values(userAccounts).flat();
  let accountId = null;
  if (parsed.cardBank) {
    const needle = parsed.cardBank.toLowerCase();
    accountId = allAccounts.find(a =>
      a.label.toLowerCase().includes(needle) || needle.includes(a.label.toLowerCase())
    )?.id ?? null;
  }

  return {
    shopName:  parsed.shopName  || null,
    amount:    typeof parsed.amount === 'number' ? parsed.amount : null,
    currency:  parsed.currency  || 'SGD',
    accountId,
    items:     parsed.items     || null,
    category:  CATEGORIES.some(c => c.id === parsed.category) ? parsed.category : null,
  };
}
