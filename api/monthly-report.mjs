import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { Resend } from 'resend';

const REPORT_EMAILS = ['samshadnc@gmail.com', 'msahla99@gmail.com'];

function getAdminApp() {
  if (getApps().length) return getApps()[0];
  return initializeApp({
    credential: cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)),
  });
}

function lastMonthRange() {
  const now = new Date();
  const y = now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear();
  const m = now.getMonth() === 0 ? 12 : now.getMonth();
  const lastDay = new Date(y, m, 0).getDate();
  const pad = (n) => String(n).padStart(2, '0');
  return {
    start: `${y}-${pad(m)}-01`,
    end:   `${y}-${pad(m)}-${lastDay}`,
    label: new Date(y, m - 1).toLocaleString('en-SG', { month: 'long', year: 'numeric' }),
    ym:    `${y}-${pad(m)}`,
  };
}

function buildCSV(expenses) {
  const headers = ['Date','Payee','Note','Amount SGD','Currency','Original Amount','Category','Tags','Account','Added By','Type'];
  const rows = expenses.map(e => [
    e.date, e.payee ?? '', e.note ?? '',
    (e.currency === 'SGD' ? e.amount : (e.sgdAmount ?? 0)).toFixed(2),
    e.currency ?? 'SGD', e.amount.toFixed(2),
    e.category ?? '', (e.tags ?? []).join('; '),
    e.account ?? '', e.addedByName ?? '', e.type ?? 'expense',
  ].map(v => `"${String(v).replace(/"/g, '""')}"`).join(','));
  return [headers.join(','), ...rows].join('\n');
}

async function getAIInsights(lastMonthData, prevMonthsData, monthLabel) {
  const apiKey = process.env.VITE_GEMINI_API_KEY;
  if (!apiKey) return '';

  const summarize = (exps) => {
    const byCategory = {};
    const byPayee = {};
    let total = 0;
    for (const e of exps) {
      const sgd = e.currency === 'SGD' ? e.amount : (e.sgdAmount ?? 0);
      byCategory[e.category] = (byCategory[e.category] ?? 0) + sgd;
      if (e.payee) byPayee[e.payee] = (byPayee[e.payee] ?? 0) + sgd;
      total += sgd;
    }
    const topPayees = Object.entries(byPayee).sort((a,b) => b[1]-a[1]).slice(0,5);
    return { total: total.toFixed(2), byCategory, topPayees };
  };

  const lastSummary = summarize(lastMonthData);
  const prevSummaries = prevMonthsData.map(({ label, exps }) => ({ label, ...summarize(exps) }));
  const avg3month = prevSummaries.length
    ? (prevSummaries.reduce((s, p) => s + parseFloat(p.total), 0) / prevSummaries.length).toFixed(2)
    : null;

  const prompt = `You are a friendly personal finance advisor for a family of two (Samshad and Sahla) living in Singapore. Write a warm, personal 4-5 sentence analysis of their spending.

${monthLabel} — Total: S$${lastSummary.total}${avg3month ? ` (3-month avg: S$${avg3month})` : ''}
By category: ${JSON.stringify(lastSummary.byCategory)}
Top payees: ${lastSummary.topPayees.map(([p,a]) => `${p} S$${a.toFixed(2)}`).join(', ')}

Previous months:
${prevSummaries.map(p => `${p.label}: S$${p.total}, categories: ${JSON.stringify(p.byCategory)}, top payees: ${p.topPayees.map(([n,a]) => `${n} S$${a.toFixed(2)}`).join(', ')}`).join('\n')}

Write 4-5 sentences that:
1. Compare this month's total to the 3-month average with a friendly observation
2. Call out 1-2 specific payees or categories that stand out (higher or lower than usual)
3. Note any positive spending habits worth acknowledging
4. Give one specific, actionable suggestion for next month

Be warm and personal, use "you" not "the family". Mention actual payee names and SGD amounts. No bullet points — just flowing sentences.`;

  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
      }
    );
    const data = await res.json();
    return data?.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
  } catch {
    return '';
  }
}

export default async function handler(req, res) {
  // Verify cron secret to prevent unauthorized calls
  if (req.headers.authorization !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const app = getAdminApp();
    const db = getFirestore(app);
    const { start, end, label, ym } = lastMonthRange();

    // Fetch last month expenses
    const snap = await db.collection('expenses')
      .where('date', '>=', start)
      .where('date', '<=', end)
      .orderBy('date', 'desc')
      .get();
    const lastMonthExps = snap.docs.map(d => ({ ...d.data(), id: d.id }));

    // Fetch previous 3 months for AI comparison
    const prevMonthsData = [];
    for (let i = 1; i <= 3; i++) {
      const d = new Date(start);
      d.setMonth(d.getMonth() - i);
      const py = d.getFullYear();
      const pm = d.getMonth() + 1;
      const pad = (n) => String(n).padStart(2, '0');
      const pStart = `${py}-${pad(pm)}-01`;
      const pEnd   = `${py}-${pad(pm)}-${new Date(py, pm, 0).getDate()}`;
      const pLabel = d.toLocaleString('en-SG', { month: 'long', year: 'numeric' });
      const pSnap  = await db.collection('expenses')
        .where('date', '>=', pStart)
        .where('date', '<=', pEnd)
        .get();
      prevMonthsData.push({ label: pLabel, exps: pSnap.docs.map(d => d.data()) });
    }

    // Fetch settings for budget
    const settingsSnap = await db.collection('household').doc('settings').get();
    const settings = settingsSnap.exists ? settingsSnap.data() : {};
    const budget = settings.monthlyBudget ?? 0;

    // Calculate summary stats
    const total = lastMonthExps.reduce((s, e) => s + (e.currency === 'SGD' ? e.amount : (e.sgdAmount ?? 0)), 0);
    const byCategory = {};
    for (const e of lastMonthExps) {
      const sgd = e.currency === 'SGD' ? e.amount : (e.sgdAmount ?? 0);
      byCategory[e.category] = (byCategory[e.category] ?? 0) + sgd;
    }
    const topCategories = Object.entries(byCategory)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);

    const csv = buildCSV(lastMonthExps);
    const aiInsights = await getAIInsights(lastMonthExps, prevMonthsData, label);
    const budgetLine = budget > 0
      ? `<p style="color:${total <= budget ? '#16a34a' : '#dc2626'};font-weight:600;">
           ${total <= budget ? '✓' : '⚠'} S$${total.toFixed(2)} / S$${budget.toFixed(2)} budget
           (${total <= budget ? 'under' : 'over'} by S$${Math.abs(budget - total).toFixed(2)})
         </p>`
      : `<p style="font-size:20px;font-weight:700;">Total: S$${total.toFixed(2)}</p>`;

    const categoryRows = topCategories.map(([cat, amt]) =>
      `<tr><td style="padding:6px 12px;text-transform:capitalize;">${cat}</td>
           <td style="padding:6px 12px;text-align:right;font-weight:600;">S$${amt.toFixed(2)}</td>
           <td style="padding:6px 12px;color:#6b7280;font-size:12px;">${budget > 0 ? `${((amt/budget)*100).toFixed(0)}% of budget` : ''}</td></tr>`
    ).join('');

    const html = `
<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#f3f4f6;margin:0;padding:20px;">
  <div style="max-width:560px;margin:0 auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">
    <div style="background:linear-gradient(135deg,#4f46e5,#7c3aed);padding:28px 32px;color:#fff;">
      <p style="margin:0;font-size:13px;opacity:0.8;letter-spacing:0.5px;">FAMILYLEDGER</p>
      <h1 style="margin:8px 0 4px;font-size:22px;">${label} Summary</h1>
      <p style="margin:0;opacity:0.8;font-size:13px;">${lastMonthExps.length} transactions</p>
    </div>
    <div style="padding:24px 32px;">
      ${budgetLine}
      <h3 style="font-size:13px;font-weight:600;color:#6b7280;text-transform:uppercase;letter-spacing:0.5px;margin:20px 0 8px;">Top Categories</h3>
      <table style="width:100%;border-collapse:collapse;font-size:14px;">
        ${categoryRows}
      </table>
      ${aiInsights ? `
      <div style="background:#f8f7ff;border-left:3px solid #4f46e5;border-radius:4px;padding:14px 16px;margin-top:20px;">
        <p style="font-size:12px;font-weight:600;color:#4f46e5;margin:0 0 6px;">AI INSIGHTS</p>
        <p style="font-size:14px;color:#374151;margin:0;line-height:1.6;">${aiInsights}</p>
      </div>` : ''}
      <p style="font-size:12px;color:#9ca3af;margin-top:24px;border-top:1px solid #f3f4f6;padding-top:16px;">
        CSV of all ${lastMonthExps.length} transactions attached · FamilyLedger auto-report
      </p>
    </div>
  </div>
</body>
</html>`;

    const resend = new Resend(process.env.RESEND_API_KEY);
    await resend.emails.send({
      from: 'FamilyLedger <onboarding@resend.dev>',
      to: REPORT_EMAILS,
      subject: `FamilyLedger — ${label} · S$${total.toFixed(2)}`,
      html,
      attachments: [{
        filename: `FamilyLedger_${ym}.csv`,
        content: Buffer.from(csv).toString('base64'),
      }],
    });

    return res.status(200).json({ ok: true, month: label, total, transactions: lastMonthExps.length });
  } catch (err) {
    console.error('monthly-report error:', err);
    return res.status(500).json({ error: err.message });
  }
}
