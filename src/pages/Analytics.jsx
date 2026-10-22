import { useMemo, useState } from 'react';
import { getCategoryById, getBankBrand } from '../constants';
import BankBadge from '../components/BankBadge';

export default function Analytics({ allExpenses, currentMonth, accountMap, members, onPayeeSelect }) {
  const [selectedMonth, setSelectedMonth] = useState(currentMonth);

  const data = useMemo(() => {
    // Last 12 months oldest → newest
    const [y, m] = currentMonth.split('-').map(Number);
    const months = [];
    for (let i = 11; i >= 0; i--) {
      const d = new Date(y, m - 1 - i);
      months.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
    }

    const allExp = (allExpenses ?? []).filter(e => e.type !== 'income' && e.type !== 'investment');
    const allInv = (allExpenses ?? []).filter(e => e.type === 'investment');
    const sgdVal = (e) => e.currency === 'SGD' ? e.amount : (e.sgdAmount ?? 0);

    // Monthly totals
    const monthTotals = months.map(ym => ({
      ym,
      total: allExp.filter(e => e.date.startsWith(ym)).reduce((s, e) => s + sgdVal(e), 0),
    }));

    const thisMonth = monthTotals[monthTotals.length - 1];
    const lastMonth = monthTotals[monthTotals.length - 2];
    const momChange = lastMonth?.total > 0
      ? ((thisMonth.total - lastMonth.total) / lastMonth.total) * 100
      : null;

    // Per-person 6-month totals — use settings members so all family appear even with zero data
    const expPersons = [...new Set(allExp.map(e => e.addedByName).filter(Boolean))];
    const knownMembers = members && members.length > 0 ? members : expPersons;
    const persons = [...new Set([...knownMembers, ...expPersons])].sort();
    const personMonthly = persons.map(name => ({
      name,
      monthly: months.map(ym =>
        allExp.filter(e => e.date.startsWith(ym) && e.addedByName === name).reduce((s, e) => s + sgdVal(e), 0)
      ),
    }));

    // Account breakdown grouped by person
    const personAccMap = {};
    allExp.filter(e => months.some(ym => e.date.startsWith(ym))).forEach(e => {
      if (!e.account || !e.addedByName) return;
      if (!personAccMap[e.addedByName]) personAccMap[e.addedByName] = {};
      personAccMap[e.addedByName][e.account] = (personAccMap[e.addedByName][e.account] ?? 0) + sgdVal(e);
    });
    const accountsByPerson = Object.entries(personAccMap).sort(([a], [b]) => a.localeCompare(b)).map(([person, accMap]) => ({
      person,
      accounts: Object.entries(accMap)
        .sort((a, b) => b[1] - a[1])
        .map(([id, total]) => ({ id, label: accountMap?.[id] ?? id, total })),
      personTotal: Object.values(accMap).reduce((s, v) => s + v, 0),
    }));
    const maxAcc = Math.max(...accountsByPerson.flatMap(p => p.accounts.map(a => a.total)), 1);

    // Per-tag 6-month totals
    const allTags = [...new Set(
      allExp.flatMap(e => Array.isArray(e.tags) ? e.tags : []).filter(Boolean)
    )].sort();
    const tagMonthly = allTags.map(tag => {
      const monthly = months.map(ym =>
        allExp
          .filter(e => e.date.startsWith(ym) && Array.isArray(e.tags) && e.tags.includes(tag))
          .reduce((s, e) => s + sgdVal(e), 0)
      );
      const total6m = monthly.reduce((s, v) => s + v, 0);
      return { tag, monthly, total6m };
    }).filter(t => t.total6m > 0).sort((a, b) => b.total6m - a.total6m);

    // Top categories for selected month
    const catMap = {};
    allExp.filter(e => e.date.startsWith(selectedMonth)).forEach(e => {
      catMap[e.category] = (catMap[e.category] ?? 0) + sgdVal(e);
    });
    const topCats = Object.entries(catMap)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([id, amt]) => ({ id, amt }));

    const thisMonthTotal = thisMonth.total;

    // Investment analytics — split into invested (+) and borrowed (-)
    const allInvested = allInv.filter(e => sgdVal(e) >= 0);
    const allBorrowed = allInv.filter(e => sgdVal(e) < 0);

    const invLifetimeTotal = allInvested.reduce((s, e) => s + sgdVal(e), 0);
    const invPlatformMap = {};
    allInvested.forEach(e => {
      const p = e.platform || e.payee || 'Other';
      invPlatformMap[p] = (invPlatformMap[p] ?? 0) + sgdVal(e);
    });
    const invByPlatform = Object.entries(invPlatformMap)
      .sort((a, b) => b[1] - a[1])
      .map(([platform, total]) => ({ platform, total }));

    const invMonthly = months.map(ym => ({
      ym,
      label: new Date(ym + '-01').toLocaleString('en-SG', { month: 'short' }),
      total: allInvested.filter(e => e.date.startsWith(ym)).reduce((s, e) => s + sgdVal(e), 0),
      isCurrent: ym === currentMonth,
    }));

    const borrowLifetimeTotal = allBorrowed.reduce((s, e) => s + Math.abs(sgdVal(e)), 0);
    const borrowByPersonMap = {};
    allBorrowed.forEach(e => {
      const p = e.platform || e.payee || 'Other';
      borrowByPersonMap[p] = (borrowByPersonMap[p] ?? 0) + Math.abs(sgdVal(e));
    });
    const borrowByPerson = Object.entries(borrowByPersonMap)
      .sort((a, b) => b[1] - a[1])
      .map(([person, total]) => ({ person, total }));

    return { months, monthTotals, thisMonth, lastMonth, momChange, personMonthly, tagMonthly, accountsByPerson, topCats, thisMonthTotal, maxAcc, invLifetimeTotal, invByPlatform, invMonthly, borrowLifetimeTotal, borrowByPerson };
  }, [allExpenses, currentMonth, selectedMonth, accountMap, members]);

  return (
    <div className="pb-24 bg-[#ECEDF0] min-h-screen">
      {/* Header */}
      <div className="px-5 pt-5 pb-3">
        <h1 className="text-xl font-bold text-gray-900">Analytics</h1>
        <p className="text-xs text-gray-400 mt-0.5">{formatMonthFull(selectedMonth)} · last 12 months</p>
      </div>

      {/* ── Month-over-Month ─────────────────────────────── */}
      <div className="mx-4 mb-4 bg-white rounded-2xl shadow-sm p-4">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Month over Month</p>
        <div className="flex items-center gap-4">
          <div className="flex-1 p-3 bg-gray-50 rounded-xl text-center">
            <p className="text-[11px] text-gray-400 mb-1">{shortMonth(data.lastMonth?.ym)}</p>
            <p className="text-lg font-bold text-gray-900">S${fmt(data.lastMonth?.total ?? 0)}</p>
          </div>
          <div className="flex flex-col items-center gap-1">
            {data.momChange !== null ? (
              <>
                <span className={`text-xl font-bold ${data.momChange <= 0 ? 'text-green-600' : 'text-red-500'}`}>
                  {data.momChange <= 0 ? '↓' : '↑'}
                </span>
                <span className={`text-xs font-semibold ${data.momChange <= 0 ? 'text-green-600' : 'text-red-500'}`}>
                  {Math.abs(data.momChange).toFixed(1)}%
                </span>
              </>
            ) : <span className="text-gray-300 text-lg">→</span>}
          </div>
          <div className="flex-1 p-3 bg-indigo-50 rounded-xl text-center border-2 border-indigo-100">
            <p className="text-[11px] text-indigo-400 mb-1">{shortMonth(data.thisMonth?.ym)} (now)</p>
            <p className="text-lg font-bold text-indigo-700">S${fmt(data.thisMonth?.total ?? 0)}</p>
          </div>
        </div>

        {/* 12-month mini bars — tappable */}
        <div className="flex items-end gap-1.5 mt-4 h-20">
          {data.monthTotals.map(({ ym, total }) => {
            const maxT = Math.max(...data.monthTotals.map(m => m.total), 1);
            const h = total > 0 ? Math.max((total / maxT) * 44, 4) : 3;
            const isSelected = ym === selectedMonth;
            return (
              <button
                key={ym}
                onClick={() => setSelectedMonth(ym)}
                className="flex-1 flex flex-col items-center gap-0.5 rounded-lg pb-0.5 active:opacity-60 transition-opacity"
                style={{ background: isSelected ? '#eef2ff' : 'transparent' }}
              >
                {total > 0 && <p className="text-[7px] font-semibold leading-none" style={{ color: isSelected ? '#4F46E5' : '#9ca3af' }}>{fmtBar(total)}</p>}
                <div
                  className="w-full rounded-t-md"
                  style={{ height: h, background: isSelected ? '#4F46E5' : '#c7d2fe' }}
                />
                <p className="text-[9px] font-medium" style={{ color: isSelected ? '#4F46E5' : '#9ca3af' }}>
                  {shortMonth(ym)}
                </p>
              </button>
            );
          })}
        </div>
        <p className="text-[10px] text-center text-gray-300 mt-1">Tap a bar to view that month's breakdown</p>
      </div>

      {/* ── Per-Person Trend — grouped bars ─────────────── */}
      {data.personMonthly.length > 0 && (() => {
        const PERSON_COLORS = {
          Samshad: { active: '#4F46E5', light: '#c7d2fe' },
          Sahla:   { active: '#16a34a', light: '#bbf7d0' },
        };
        const FALLBACK_COLORS = [
          { active: '#d97706', light: '#fde68a' },
          { active: '#db2777', light: '#fbcfe8' },
        ];
        const getColor = (name, i) => PERSON_COLORS[name] ?? FALLBACK_COLORS[i % FALLBACK_COLORS.length];
        const maxAll = Math.max(...data.personMonthly.flatMap(p => p.monthly), 1);
        return (
          <div className="mx-4 mb-4 bg-white rounded-2xl shadow-sm p-4">
            {/* Header + legend */}
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Per Person · 12 months</p>
              <div className="flex gap-3">
                {data.personMonthly.map(({ name }, i) => (
                  <div key={name} className="flex items-center gap-1">
                    <div className="w-2 h-2 rounded-full" style={{ background: getColor(name, i).active }} />
                    <span className="text-[10px] text-gray-500">{name}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Per-person totals */}
            <div className="flex gap-4 mb-3">
              {data.personMonthly.map(({ name, monthly }, i) => (
                <div key={name}>
                  <p className="text-[10px] text-gray-400">{name}</p>
                  <p className="text-sm font-bold" style={{ color: getColor(name, i).active }}>
                    S${fmt(monthly.reduce((s, v) => s + v, 0))}
                  </p>
                </div>
              ))}
            </div>

            {/* Grouped bar chart */}
            <div className="flex items-end gap-2 h-28">
              {data.months.map((ym, mi) => {
                const isSelected = ym === selectedMonth;
                return (
                  <button
                    key={ym}
                    onClick={() => setSelectedMonth(ym)}
                    className="flex-1 flex flex-col items-center gap-0.5 active:opacity-60 transition-opacity rounded-sm"
                    style={{ background: isSelected ? '#eef2ff' : 'transparent' }}
                  >
                    {/* Value labels above bars, pushed to bottom of label area */}
                    <div className="flex-1 flex flex-col items-center justify-end gap-px mb-0.5">
                      {data.personMonthly.map(({ name, monthly }, pi) => {
                        const amt = monthly[mi];
                        if (!amt) return null;
                        const col = getColor(name, pi);
                        return (
                          <p key={name} className="text-[8px] font-semibold leading-none"
                            style={{ color: isSelected ? col.active : col.light }}>
                            {fmtBar(amt)}
                          </p>
                        );
                      })}
                    </div>
                    {/* Bars */}
                    <div className="flex items-end gap-0.5 justify-center">
                      {data.personMonthly.map(({ name, monthly }, pi) => {
                        const amt = monthly[mi];
                        const h = amt > 0 ? Math.max((amt / maxAll) * 44, 3) : 2;
                        const col = getColor(name, pi);
                        return (
                          <div
                            key={name}
                            className="rounded-t-sm"
                            style={{ height: h, width: 8, background: isSelected ? col.active : col.light }}
                          />
                        );
                      })}
                    </div>
                    <p className="text-[8px] w-full text-center" style={{ color: isSelected ? '#4F46E5' : '#d1d5db' }}>
                      {shortMonth(ym)}
                    </p>
                  </button>
                );
              })}
            </div>
          </div>
        );
      })()}

      {/* ── Per-Tag Trend ────────────────────────────────── */}
      {data.tagMonthly.length > 0 && (
        <div className="mx-4 mb-4 bg-white rounded-2xl shadow-sm p-4">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Per Tag · 12 months</p>
          {data.tagMonthly.map(({ tag, monthly, total6m }) => {
            const maxT = Math.max(...monthly, 1);
            return (
              <div key={tag} className="mb-4 last:mb-0">
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-indigo-400 flex-shrink-0" />
                    <p className="text-sm font-semibold text-gray-800">{tag}</p>
                  </div>
                  <p className="text-xs font-semibold text-gray-500">S${fmt(total6m)} total</p>
                </div>
                <div className="flex items-end gap-1 h-14">
                  {monthly.map((amt, i) => {
                    const h = amt > 0 ? Math.max((amt / maxT) * 32, 3) : 3;
                    const ym = data.months[i];
                    const isSelected = ym === selectedMonth;
                    return (
                      <button
                        key={i}
                        onClick={() => setSelectedMonth(ym)}
                        className="flex-1 flex flex-col items-center gap-0.5 rounded active:opacity-60 transition-opacity"
                        style={{ background: isSelected ? '#eef2ff' : 'transparent' }}
                      >
                        {amt > 0 && <p className="text-[7px] font-semibold leading-none" style={{ color: isSelected ? '#4F46E5' : '#9ca3af' }}>{fmtBar(amt)}</p>}
                        <div
                          className="w-full rounded-t-sm"
                          style={{ height: h, background: isSelected ? '#4F46E5' : '#c7d2fe' }}
                        />
                        <p className="text-[8px]" style={{ color: isSelected ? '#4F46E5' : '#d1d5db' }}>
                          {shortMonth(ym)}
                        </p>
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Account Breakdown ─────────────────────────────── */}
      {data.accountsByPerson.length > 0 && (
        <div className="mx-4 mb-4 bg-white rounded-2xl shadow-sm overflow-hidden">
          <div className="px-4 pt-4 pb-2">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Account Breakdown · 12 months</p>
          </div>
          {data.accountsByPerson.map(({ person, accounts, personTotal }, pi) => (
            <div key={person} className={pi > 0 ? 'border-t border-gray-100' : ''}>
              <div className="px-4 pt-3 pb-1 flex items-center justify-between">
                <p className="text-xs font-bold text-gray-500 uppercase tracking-wide">{person}</p>
                <p className="text-xs font-semibold text-gray-400">S${fmt(personTotal)}</p>
              </div>
              {accounts.map(({ id, label, total }) => {
                const pct = data.maxAcc > 0 ? (total / data.maxAcc) * 100 : 0;
                const brand = getBankBrand(label);
                return (
                  <div key={id} className="px-4 py-2.5 flex items-center gap-3">
                    <BankBadge label={label} size="md" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-800">{label}</p>
                      <div className="h-1.5 bg-gray-100 rounded-full mt-1 overflow-hidden">
                        <div className="h-full rounded-full" style={{ width: `${pct}%`, background: brand.bg }} />
                      </div>
                    </div>
                    <p className="text-sm font-bold text-gray-900 flex-shrink-0">S${fmt(total)}</p>
                  </div>
                );
              })}
            </div>
          ))}
          <div className="h-3" />
        </div>
      )}

      {/* ── Top Categories this month ────────────────────── */}
      {data.topCats.length > 0 && (
        <div className="mx-4 mb-4 bg-white rounded-2xl shadow-sm overflow-hidden">
          <div className="px-4 pt-4 pb-2">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">
              Top Categories · {shortMonth(selectedMonth)}
            </p>
          </div>
          <div className="divide-y divide-gray-50">
            {data.topCats.map(({ id, amt }, i) => {
              const cat = getCategoryById(id);
              const pct = data.thisMonthTotal > 0 ? (amt / data.thisMonthTotal) * 100 : 0;
              return (
                <div key={id} className="px-4 py-3 flex items-center gap-3">
                  <span className="text-gray-300 text-xs font-bold w-4 flex-shrink-0">#{i + 1}</span>
                  <div
                    className="w-9 h-9 rounded-xl flex items-center justify-center text-lg flex-shrink-0"
                    style={{ background: cat.bg }}
                  >
                    {cat.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-800">{cat.label}</p>
                    <div className="h-1.5 bg-gray-100 rounded-full mt-1 overflow-hidden">
                      <div className="h-full rounded-full" style={{ width: `${pct}%`, background: cat.color }} />
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-sm font-bold text-gray-900">S${fmt(amt)}</p>
                    <p className="text-[10px] text-gray-400">{pct.toFixed(0)}%</p>
                  </div>
                </div>
              );
            })}
          </div>
          <div className="h-3" />
        </div>
      )}

      {/* ── Investments ───────────────────────────────────── */}
      {data.invLifetimeTotal > 0 && (
        <div className="mx-4 mb-4 bg-white rounded-2xl shadow-sm p-4">
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Investments</p>
            <div className="text-right">
              <p className="text-[10px] text-gray-400">Lifetime total</p>
              <p className="text-base font-bold text-violet-600">S${fmt(data.invLifetimeTotal)}</p>
            </div>
          </div>

          {/* Monthly bar chart */}
          {data.invMonthly.some(m => m.total > 0) && (
            <div className="mb-4">
              <p className="text-[10px] text-gray-400 uppercase tracking-wide mb-2">Monthly contributions</p>
              <div className="flex items-end gap-1 h-20">
                {data.invMonthly.map(({ ym, label, total, isCurrent }) => {
                  const maxT = Math.max(...data.invMonthly.map(m => m.total), 1);
                  const h = total > 0 ? Math.max((total / maxT) * 44, 3) : 2;
                  const amtStr = total > 0 ? (total < 10 ? total.toFixed(2) : total.toFixed(1)) : '';
                  return (
                    <div key={ym} className="flex-1 flex flex-col items-center justify-end gap-0.5">
                      {total > 0 && <p className="text-[7px] font-semibold leading-none mb-0.5" style={{ color: isCurrent ? '#7c3aed' : '#9ca3af' }}>{amtStr}</p>}
                      <div className="w-full rounded-t-sm" style={{ height: h, background: isCurrent ? '#7c3aed' : '#ddd6fe' }} />
                      <p className="text-[8px]" style={{ color: isCurrent ? '#7c3aed' : '#9ca3af' }}>{label}</p>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Platform breakdown */}
          {data.invByPlatform.length > 0 && (
            <div className="space-y-2">
              <p className="text-[10px] text-gray-400 uppercase tracking-wide">By platform</p>
              {data.invByPlatform.map(({ platform, total }) => {
                const pct = data.invLifetimeTotal > 0 ? (total / data.invLifetimeTotal) * 100 : 0;
                return (
                  <button key={platform} className="w-full text-left active:opacity-60 transition-opacity" onClick={() => onPayeeSelect?.(platform)}>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="font-medium text-gray-700 truncate max-w-[60%]">{platform}</span>
                      <span className="text-gray-500 flex items-center gap-1">S${fmt(total)} <span className="text-gray-400">({pct.toFixed(0)}%)</span> <span className="text-gray-300">›</span></span>
                    </div>
                    <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                      <div className="h-full rounded-full bg-violet-500" style={{ width: `${pct}%` }} />
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── Borrowings ────────────────────────────────────── */}
      {data.borrowLifetimeTotal > 0 && (
        <div className="mx-4 mb-4 bg-white rounded-2xl shadow-sm p-4">
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Borrowings</p>
            <div className="text-right">
              <p className="text-[10px] text-gray-400">Total borrowed</p>
              <p className="text-base font-bold text-orange-500">S${fmt(data.borrowLifetimeTotal)}</p>
            </div>
          </div>

          {/* By person breakdown */}
          {data.borrowByPerson.length > 0 && (
            <div className="space-y-2">
              <p className="text-[10px] text-gray-400 uppercase tracking-wide">By source</p>
              {data.borrowByPerson.map(({ person, total }) => {
                const pct = data.borrowLifetimeTotal > 0 ? (total / data.borrowLifetimeTotal) * 100 : 0;
                return (
                  <button key={person} className="w-full text-left active:opacity-60 transition-opacity" onClick={() => onPayeeSelect?.(person)}>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="font-medium text-gray-700 truncate max-w-[60%]">{person}</span>
                      <span className="text-gray-500 flex items-center gap-1">S${fmt(total)} <span className="text-gray-400">({pct.toFixed(0)}%)</span> <span className="text-gray-300">›</span></span>
                    </div>
                    <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                      <div className="h-full rounded-full bg-orange-400" style={{ width: `${pct}%` }} />
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function fmt(n) {
  return Number(n).toLocaleString('en-SG', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function fmtBar(n) {
  if (!n) return '';
  if (n >= 1000) return (n / 1000).toFixed(n >= 10000 ? 0 : 1) + 'k';
  return n.toFixed(0);
}
function shortMonth(ym) {
  if (!ym) return '';
  const [y, m] = ym.split('-');
  return new Date(y, m - 1).toLocaleString('en-SG', { month: 'short' });
}
function formatMonthFull(ym) {
  if (!ym) return '';
  const [y, m] = ym.split('-');
  return new Date(y, m - 1).toLocaleString('en-SG', { month: 'long', year: 'numeric' });
}
