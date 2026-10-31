import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { Resend } from 'resend';

const REPORT_EMAILS = ['samshadnc@gmail.com'];

const CAT_EMOJI = {
  groceries: '🛒', dining: '🍜', transport: '🚌', utilities: '⚡',
  shopping: '🛍️', health: '🏥', entertainment: '🎬', rent: '🏠',
  education: '📚', travel: '✈️', subscriptions: '📱', insurance: '🛡️',
  personal: '💇', kids: '👶', food: '🍔', others: '📦',
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

// Compute spend-by-category for an array of expenses (regular expenses only)
function spendByCategory(exps) {
  const byC = {};
  for (const e of exps) {
    if (e.type === 'invest') continue;
    const sgd = e.currency === 'SGD' ? e.amount : (e.sgdAmount ?? 0);
    if (sgd <= 0) continue;
    byC[e.category] = (byC[e.category] ?? 0) + sgd;
  }
  return byC;
}

function buildSVGChart(monthLabels, catData) {
  const svgW = 500, svgH = 230;
  const padL = 40, padR = 14, padT = 54, padB = 52;
  const chartW = svgW - padL - padR;
  const chartH = svgH - padT - padB;

  const monthColors = ['#c7d2fe', '#a5b4fc', '#818cf8', '#6366f1'];
  const nCats = catData.length;
  const nMonths = monthLabels.length;

  const maxVal = Math.max(...catData.flatMap(c => c.values), 1);
  const gridMax = Math.ceil(maxVal / 100) * 100 || 100;

  const barW = 11;
  const barGap = 2;
  const groupBarSpan = nMonths * barW + (nMonths - 1) * barGap;
  const groupW = chartW / nCats;
  const groupOffset = (groupW - groupBarSpan) / 2;

  const parts = [];

  // Grid lines + y-axis labels
  for (let i = 0; i <= 4; i++) {
    const val = (gridMax / 4) * i;
    const y = (padT + chartH - (val / gridMax) * chartH).toFixed(1);
    const isBase = i === 0;
    parts.push(`<line x1="${padL}" y1="${y}" x2="${svgW - padR}" y2="${y}" stroke="${isBase ? '#d1d5db' : '#f0f0f4'}" stroke-width="${isBase ? '1.5' : '1'}"/>`);
    if (i > 0) {
      const lbl = val >= 1000 ? (val / 1000).toFixed(1) + 'k' : val;
      parts.push(`<text x="${padL - 5}" y="${(parseFloat(y) + 3.5).toFixed(1)}" text-anchor="end" font-size="9" fill="#9ca3af">${lbl}</text>`);
    }
  }

  // Bars + value labels
  catData.forEach((cat, ci) => {
    cat.values.forEach((val, mi) => {
      const x = padL + ci * groupW + groupOffset + mi * (barW + barGap);
      const h = val > 0 ? (val / gridMax) * chartH : 0;
      const y = padT + chartH - h;

      if (h > 0) {
        parts.push(`<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${barW}" height="${h.toFixed(1)}" rx="3" fill="${monthColors[mi]}"/>`);
      }

      // Rotated value label above bar
      if (val > 0) {
        const lx = (x + barW / 2).toFixed(1);
        const ly = (y - 3).toFixed(1);
        const isCurrent = mi === nMonths - 1;
        parts.push(`<text transform="translate(${lx},${ly}) rotate(-90)" text-anchor="start" font-size="8" fill="${isCurrent ? '#4338ca' : '#9ca3af'}" font-weight="${isCurrent ? '700' : '500'}">$${val}</text>`);
      }
    });

    // Category label: emoji + name
    const cx = (padL + ci * groupW + groupW / 2).toFixed(1);
    const lblY = padT + chartH;
    parts.push(`<text x="${cx}" y="${lblY + 16}" text-anchor="middle" font-size="13">${cat.emoji}</text>`);
    parts.push(`<text x="${cx}" y="${lblY + 28}" text-anchor="middle" font-size="9" fill="#6b7280" font-weight="500">${cat.name}</text>`);
  });

  // Legend (centred)
  const legendItems = monthLabels.map((m, i) => ({ text: m + (i === nMonths - 1 ? ' (this month)' : ''), color: monthColors[i] }));
  const itemW = legendItems.map(it => 14 + it.text.length * 5.6 + 12);
  const totalLW = itemW.reduce((a, b) => a + b, 0);
  let lx = Math.max(padL, (svgW - totalLW) / 2);
  const legendY = padT + chartH + 44;
  legendItems.forEach((it, i) => {
    parts.push(`<rect x="${lx.toFixed(1)}" y="${(legendY - 8).toFixed(1)}" width="10" height="10" rx="2" fill="${it.color}"/>`);
    parts.push(`<text x="${(lx + 13).toFixed(1)}" y="${legendY}" font-size="9" fill="#6b7280">${it.text}</text>`);
    lx += itemW[i];
  });

  return `<svg viewBox="0 0 ${svgW} ${svgH}" xmlns="http://www.w3.org/2000/svg" style="width:100%;max-width:${svgW}px;display:block;" overflow="visible">${parts.join('')}</svg>`;
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
    const total = lastMonthExps.reduce((s, e) => s + (e.currency === 'SGD' ? e.amount : (e.sgdAmount ?? 0)), 0);

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

    // ── Generate chart SVG ───────────────────────────────────────────────
    const chartSVG = buildSVGChart(chartMonthLabels, catChartData);

    // ── AI insights ───────────────────────────────────────────────────────
    const aiInsights = await getAIInsights(lastMonthExps, prevMonthsData, label);

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
        <p style="margin:0;font-size:13px;opacity:0.75;">Samshad &amp; Sahla &middot; Singapore</p>
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
              : `<div style="font-size:20px;font-weight:800;color:#111827;">${lastMonthExps.length}</div>
                 <div style="font-size:11px;color:#6b7280;font-weight:500;margin-top:3px;">transactions</div>`
            }
          </td>
          <td style="padding:16px 14px;text-align:center;">
            <div style="font-size:20px;font-weight:800;color:#111827;">${lastMonthExps.length}</div>
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
        ${chartSVG}
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
          📎 CSV of all ${lastMonthExps.length} transactions attached &middot;
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

    return res.status(200).json({ ok: true, month: label, total, transactions: lastMonthExps.length });
  } catch (err) {
    console.error('monthly-report error:', err);
    return res.status(500).json({ error: err.message });
  }
}
