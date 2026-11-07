import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { Resend } from 'resend';

const REPORT_EMAILS = ['samshadnc@gmail.com'];

const CAT_EMOJI = {
  groceries: '🛒', dining: '🍜', transport: '🚌', utilities: '⚡',
  shopping: '🛍️', health: '🏥', entertainment: '🎬', rent: '🏠',
  education: '📚', travel: '✈️', subscriptions: '📱', insurance: '🛡️',
  personal: '💇', kids: '👶', food: '🍔', others: '📦',
  other: '📦', family: '👨‍👩‍👧', savings: '🏦', misc: '🗂️',
};

function getAdminApp() {
  if (getApps().length) return getApps()[0];
  return initializeApp({ credential: cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)) });
}

function lastMonthRange() {
  const now = new Date();
  const y = now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear();
  const m = now.getMonth() === 0 ? 12 : now.getMonth();
  const lastDay = new Date(y, m, 0).getDate();
  const pad = n => String(n).padStart(2, '0');
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
  const apiKey = process.env.GEMINI_API_KEY ?? process.env.VITE_GEMINI_API_KEY;
  if (!apiKey) return '';

  const summarize = (exps) => {
    const byCategory = {};
    const byPayee = {};
    let total = 0;
    for (const e of exps) {
      if (e.type === 'invest' || e.type === 'income') continue;
      const sgd = e.currency === 'SGD' ? e.amount : (e.sgdAmount ?? 0);
      if (sgd <= 0) continue;
      byCategory[e.category] = (byCategory[e.category] ?? 0) + sgd;
      if (e.payee) byPayee[e.payee] = (byPayee[e.payee] ?? 0) + sgd;
      total += sgd;
    }
    const topPayees = Object.entries(byPayee).sort((a, b) => b[1] - a[1]).slice(0, 5);
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
Top payees: ${lastSummary.topPayees.map(([p, a]) => `${p} S$${a.toFixed(2)}`).join(', ')}

Previous months:
${prevSummaries.map(p => `${p.label}: S$${p.total}, categories: ${JSON.stringify(p.byCategory)}, top payees: ${p.topPayees.map(([n, a]) => `${n} S$${a.toFixed(2)}`).join(', ')}`).join('\n')}

Write 4-5 sentences that:
1. Compare this month's total to the 3-month average with a friendly observation
2. Call out 1-2 specific payees or categories that stand out (higher or lower than usual)
3. Note any positive spending habits worth acknowledging
4. Give one specific, actionable suggestion for next month

Be warm and personal, use "you" not "the family". Mention actual payee names and SGD amounts. No bullet points — just flowing sentences.`;

  // Try models in order until one works
  const models = ['gemini-3.8-flash', 'gemini-2.0-flash', 'gemini-1.5-flash'];
  for (const model of models) {
    try {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
        }
      );
      const data = await res.json();
      console.log(`[AI] model=${model} status=${res.status} error=${data?.error?.message ?? 'none'}`);
      const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (text) return text;
    } catch (err) {
      console.error(`[AI] model=${model} threw:`, err.message);
    }
  }
  return '';
}

// Compute spend-by-category for an array of expenses (regular expenses only)
function spendByCategory(exps) {
  const byC = {};
  for (const e of exps) {
    if (e.type === 'invest' || e.type === 'income') continue;
    const sgd = e.currency === 'SGD' ? e.amount : (e.sgdAmount ?? 0);
    if (sgd <= 0) continue;
    byC[e.category] = (byC[e.category] ?? 0) + sgd;
  }
  return byC;
}

function buildChartImageUrl(monthLabels, catData) {
  const monthColors  = ['#c7d2fe', '#a5b4fc', '#818cf8', '#6366f1'];
  const investColors = ['#bbf7d0', '#86efac', '#4ade80', '#16a34a'];

  // One dataset per month (grouped bars), one label per category
  const categoryLabels = catData.map(c => `${c.emoji} ${c.name}`);

  const datasets = monthLabels.map((m, mi) => {
    const isLast = mi === monthLabels.length - 1;
    return {
      label: isLast ? `${m} (this month)` : m,
      data: catData.map(c => c.values[mi] ?? 0),
      backgroundColor: catData.map(c => (c.isInvest ? investColors : monthColors)[mi]),
      borderRadius: 3,
    };
  });

  const config = {
    type: 'bar',
    data: { labels: categoryLabels, datasets },
    options: {
      plugins: {
        legend: { position: 'bottom', labels: { font: { size: 10 }, boxWidth: 12, padding: 10 } },
      },
      scales: {
        x: { grid: { display: false }, ticks: { font: { size: 10 } } },
        y: {
          grid: { color: '#f0f0f4' },
          ticks: { font: { size: 10 }, callback: 'function(v){return v>=1000?(v/1000).toFixed(1)+"k":v}' },
        },
      },
    },
  };

  const encoded = encodeURIComponent(JSON.stringify(config));
  return `https://quickchart.io/chart?w=520&h=240&bkg=white&c=${encoded}`;
}

export default async function handler(req, res) {
  if (req.headers.authorization !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const app = getAdminApp();
    const db = getFirestore(app);
    const { start, end, label, ym } = lastMonthRange();

    // Fetch last month's expenses
    const snap = await db.collection('expenses')
      .where('date', '>=', start)
      .where('date', '<=', end)
      .orderBy('date', 'desc')
      .get();
    const lastMonthExps = snap.docs.map(d => ({ ...d.data(), id: d.id }));

    // Fetch previous 3 months (for AI + chart)
    const prevMonthsData = [];
    for (let i = 1; i <= 3; i++) {
      const d = new Date(start);
      d.setMonth(d.getMonth() - i);
      const py = d.getFullYear();
      const pm = d.getMonth() + 1;
      const pad = n => String(n).padStart(2, '0');
      const pStart = `${py}-${pad(pm)}-01`;
      const pEnd   = `${py}-${pad(pm)}-${new Date(py, pm, 0).getDate()}`;
      const pLabel = d.toLocaleString('en-SG', { month: 'long', year: 'numeric' });
      const pSnap  = await db.collection('expenses')
        .where('date', '>=', pStart)
        .where('date', '<=', pEnd)
        .get();
      prevMonthsData.push({ label: pLabel, exps: pSnap.docs.map(d => d.data()) });
    }

    // Settings (budget)
    const settingsSnap = await db.collection('household').doc('settings').get();
    const settings = settingsSnap.exists ? settingsSnap.data() : {};
    const budget = settings.monthlyBudget ?? 0;

    // ── Compute stats ─────────────────────────────────────────────────────
    // Regular expenses only (exclude invest/income and negative entries) — matches the app summary
    const regularExps = lastMonthExps.filter(
      e => e.type !== 'invest' && e.type !== 'income' && (e.currency === 'SGD' ? e.amount : (e.sgdAmount ?? 0)) > 0
    );
    const total = regularExps.reduce((s, e) => s + (e.currency === 'SGD' ? e.amount : (e.sgdAmount ?? 0)), 0);

    // Category breakdown (regular expenses only, for "This Month" section)
    const lastByCategory = spendByCategory(lastMonthExps);
    const prevByCategory = spendByCategory(prevMonthsData[0]?.exps ?? []); // 1 month ago

    const topCategories = Object.entries(lastByCategory)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6);

    // ── Investments & borrowings ──────────────────────────────────────────
    const investExps = lastMonthExps.filter(e => e.type === 'invest');
    const investTotal = investExps.reduce((s, e) => s + (e.currency === 'SGD' ? e.amount : (e.sgdAmount ?? 0)), 0);

    const borrowExps = lastMonthExps.filter(e => e.amount < 0);
    const borrowTotal = borrowExps.reduce((s, e) => s + Math.abs(e.currency === 'SGD' ? e.amount : (e.sgdAmount ?? 0)), 0);

    // ── Build 4-month chart data ─────────────────────────────────────────
    // Order: oldest → newest (left → right)
    const allMonths = [
      ...prevMonthsData.slice(0, 3).reverse(), // [3m ago, 2m ago, 1m ago]
      { label, exps: lastMonthExps },
    ];

    const chartMonthLabels = allMonths.map(({ label: l }) => l.split(' ')[0].slice(0, 3));

    const allByCategory = allMonths.map(({ exps }) => spendByCategory(exps));

    const catChartData = topCategories.map(([cat]) => ({
      name: cat.charAt(0).toUpperCase() + cat.slice(1),
      emoji: CAT_EMOJI[cat] ?? '📌',
      values: allByCategory.map(byC => Math.round(byC[cat] ?? 0)),
    }));

    // Add invest totals as a distinct bar group if any invest entries exist
    const allInvestTotals = allMonths.map(({ exps }) =>
      Math.round(exps.filter(e => e.type === 'invest')
        .reduce((s, e) => s + (e.currency === 'SGD' ? e.amount : (e.sgdAmount ?? 0)), 0))
    );
    if (allInvestTotals.some(v => v > 0)) {
      catChartData.push({ name: 'Invest', emoji: '💹', values: allInvestTotals, isInvest: true });
    }

    // ── Generate chart image URL (QuickChart.io — renders correctly in Gmail) ──
    const chartImgUrl = buildChartImageUrl(chartMonthLabels, catChartData);

    // ── AI insights ───────────────────────────────────────────────────────
    const aiInsights = await getAIInsights(regularExps, prevMonthsData, label);

    // ── CSV attachment ────────────────────────────────────────────────────
    const csv = buildCSV(lastMonthExps);

    // ── Build HTML email ─────────────────────────────────────────────────
    const budgetPct = budget > 0 ? Math.round((total / budget) * 100) : null;
    const budgetColor = !budgetPct ? '#6b7280' : budgetPct <= 90 ? '#16a34a' : budgetPct <= 100 ? '#d97706' : '#dc2626';

    const investRows = investExps.map(e => {
      const sgd = e.currency === 'SGD' ? e.amount : (e.sgdAmount ?? 0);
      const desc = [e.payee, e.note].filter(Boolean).join(' · ') || 'Investment';
      return `<tr style="border-bottom:1px solid #f3f4f6;">
        <td style="padding:9px 0;font-size:13px;color:#374151;">${e.date}&nbsp;&middot;&nbsp;${desc}</td>
        <td style="padding:9px 0;text-align:right;font-size:14px;font-weight:700;color:#059669;">S$${sgd.toFixed(2)}</td>
      </tr>`;
    }).join('');

    const borrowRows = borrowExps.map(e => {
      const sgd = Math.abs(e.currency === 'SGD' ? e.amount : (e.sgdAmount ?? 0));
      const desc = [e.payee, e.note].filter(Boolean).join(' · ') || 'Borrowing';
      return `<tr style="border-bottom:1px solid #f3f4f6;">
        <td style="padding:9px 0;font-size:13px;color:#374151;">${e.date}&nbsp;&middot;&nbsp;${desc}</td>
        <td style="padding:9px 0;text-align:right;font-size:14px;font-weight:700;color:#6b7280;">S$${sgd.toFixed(2)}</td>
      </tr>`;
    }).join('');

    const thisMonthRows = topCategories.map(([cat, amt]) => {
      const prev = prevByCategory[cat] ?? 0;
      const pct = prev > 0 ? (amt - prev) / prev * 100 : null;
      const deltaText = pct === null ? '—' : (pct >= 0 ? `↑ ${Math.abs(pct).toFixed(0)}%` : `↓ ${Math.abs(pct).toFixed(0)}%`);
      const deltaColor = pct === null ? '#6b7280' : Math.abs(pct) < 5 ? '#6b7280' : pct > 0 ? '#dc2626' : '#16a34a';
      const catLabel = cat.charAt(0).toUpperCase() + cat.slice(1);
      const emoji = CAT_EMOJI[cat] ?? '📌';
      return `
        <tr style="border-bottom:1px solid #f3f4f6;">
          <td style="padding:9px 0;font-size:14px;color:#374151;">${emoji}&nbsp;${catLabel}</td>
          <td style="padding:9px 0;text-align:right;font-size:14px;font-weight:700;color:#111827;">S$${amt.toFixed(2)}</td>
          <td style="padding:9px 0 9px 14px;font-size:12px;font-weight:600;color:${deltaColor};white-space:nowrap;">${deltaText}</td>
        </tr>`;
    }).join('');

    const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <meta name="color-scheme" content="light">
</head>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,sans-serif;background:#e8e8e8;margin:0;padding:20px 10px;">
  <div style="max-width:560px;margin:0 auto;">

    <!-- Email meta hint -->
    <p style="font-size:11px;color:#9ca3af;text-align:center;margin:0 0 10px;">
      FamilyLedger &middot; Monthly spending overview &middot; ${label}
    </p>

    <div style="background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">

      <!-- Header -->
      <div style="background:linear-gradient(135deg,#6366f1,#7c3aed);padding:28px 30px 24px;color:#fff;">
        <p style="margin:0 0 4px;font-size:11px;opacity:0.75;letter-spacing:0.08em;text-transform:uppercase;font-weight:600;">FamilyLedger</p>
        <h1 style="margin:0 0 4px;font-size:24px;font-weight:800;letter-spacing:-0.02em;">${label} Overview</h1>
        <p style="margin:0;font-size:13px;opacity:0.75;">Samshad &middot; Singapore</p>
      </div>

      <!-- Stat strip -->
      <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;border-bottom:1px solid #f3f4f6;">
        <tr>
          <td style="padding:16px 14px;text-align:center;border-right:1px solid #f3f4f6;">
            <div style="font-size:20px;font-weight:800;color:#111827;letter-spacing:-0.02em;">S$${total.toFixed(2)}</div>
            <div style="font-size:11px;color:#6b7280;font-weight:500;margin-top:3px;">Total spent</div>
          </td>
          <td style="padding:16px 14px;text-align:center;border-right:1px solid #f3f4f6;">
            ${budget > 0
              ? `<div style="font-size:20px;font-weight:800;color:${budgetColor};">${budgetPct}%</div>
                 <div style="font-size:11px;color:#6b7280;font-weight:500;margin-top:3px;">of S$${budget.toFixed(0)} budget</div>`
              : `<div style="font-size:20px;font-weight:800;color:#111827;">${regularExps.length}</div>
                 <div style="font-size:11px;color:#6b7280;font-weight:500;margin-top:3px;">transactions</div>`
            }
          </td>
          <td style="padding:16px 14px;text-align:center;">
            <div style="font-size:20px;font-weight:800;color:#111827;">${regularExps.length}</div>
            <div style="font-size:11px;color:#6b7280;font-weight:500;margin-top:3px;">transactions</div>
          </td>
        </tr>
      </table>

      <!-- This Month breakdown -->
      <div style="padding:22px 28px 18px;">
        <p style="margin:0 0 12px;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.07em;color:#9ca3af;">This Month &middot; ${label}</p>
        <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;font-size:14px;">
          ${thisMonthRows}
        </table>
      </div>

      <!-- Divider -->
      <div style="height:1px;background:#f3f4f6;margin:0 28px;"></div>

      <!-- 4-month chart -->
      <div style="padding:22px 20px 18px;">
        <p style="margin:0 0 14px;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.07em;color:#9ca3af;">4-Month Trend</p>
        <img src="${chartImgUrl}" width="520" alt="4-month spending trend" style="width:100%;max-width:520px;display:block;border-radius:8px;" />
      </div>

      <!-- Investments & Savings -->
      ${investRows ? `
      <div style="height:1px;background:#f3f4f6;margin:0 28px;"></div>
      <div style="padding:22px 28px 18px;">
        <p style="margin:0 0 12px;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.07em;color:#9ca3af;">💹 Investments &amp; Savings</p>
        <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;font-size:14px;">
          ${investRows}
          <tr>
            <td style="padding:10px 0 4px;font-size:12px;font-weight:600;color:#6b7280;">Total invested this month</td>
            <td style="padding:10px 0 4px;text-align:right;font-size:15px;font-weight:800;color:#059669;">S$${investTotal.toFixed(2)}</td>
          </tr>
        </table>
      </div>` : ''}

      <!-- Borrowings -->
      ${borrowRows ? `
      <div style="height:1px;background:#f3f4f6;margin:0 28px;"></div>
      <div style="padding:22px 28px 18px;">
        <p style="margin:0 0 12px;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.07em;color:#9ca3af;">🔄 Borrowings</p>
        <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;font-size:14px;">
          ${borrowRows}
          <tr>
            <td style="padding:10px 0 4px;font-size:12px;font-weight:600;color:#6b7280;">Total this month</td>
            <td style="padding:10px 0 4px;text-align:right;font-size:15px;font-weight:800;color:#374151;">S$${borrowTotal.toFixed(2)}</td>
          </tr>
        </table>
      </div>` : ''}

      <!-- Divider -->
      <div style="height:1px;background:#f3f4f6;margin:0 28px;"></div>

      <!-- AI Insights -->
      ${aiInsights ? `
      <div style="padding:22px 28px;">
        <p style="margin:0 0 10px;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.07em;color:#9ca3af;">✨ AI Insights</p>
        <div style="background:#f8f7ff;border-left:3px solid #6366f1;border-radius:6px;padding:14px 16px;">
          <p style="font-size:14px;color:#374151;margin:0;line-height:1.65;">${aiInsights.replace(/\n/g, '<br>')}</p>
        </div>
      </div>` : ''}

      <!-- Footer -->
      <div style="padding:16px 28px 22px;border-top:1px solid #f3f4f6;">
        <p style="font-size:12px;color:#9ca3af;margin:0;line-height:1.6;">
          📎 CSV of all ${regularExps.length} transactions attached &middot;
          FamilyLedger auto-report &middot; sent on the 3rd of every month
        </p>
      </div>

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

    return res.status(200).json({ ok: true, month: label, total, transactions: regularExps.length });
  } catch (err) {
    console.error('monthly-report error:', err);
    // Try to send a debug email so we can see the error even if logs are unavailable
    try {
      const resend = new Resend(process.env.RESEND_API_KEY);
      await resend.emails.send({
        from: 'FamilyLedger <onboarding@resend.dev>',
        to: REPORT_EMAILS,
        subject: `FamilyLedger — ERROR: ${err.message?.slice(0, 60)}`,
        html: `<pre>${err.stack ?? err.message}</pre>`,
      });
    } catch (_) {}
    return res.status(500).json({ error: err.message });
  }
}
