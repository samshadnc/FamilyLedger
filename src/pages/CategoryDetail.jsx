import { useState, useMemo, useEffect, useRef } from 'react';
import { ChevronLeft, TrendingUp } from 'lucide-react';
import { getCategoryById } from '../constants';

export default function CategoryDetail({ categoryId, currentMonth, isDemo, allExpenses, onBack, onEdit }) {
  const cat = getCategoryById(categoryId);
  const [selectedMonth, setSelectedMonth] = useState(currentMonth);

  // Build last 12 months in order (oldest → newest)
  const months = useMemo(() => {
    const result = [];
    const [y, m] = currentMonth.split('-').map(Number);
    for (let i = 11; i >= 0; i--) {
      const d = new Date(y, m - 1 - i);
      result.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
    }
    return result;
  }, [currentMonth]);

  // Monthly totals for bar chart
  const monthlyTotals = useMemo(() => {
    if (!allExpenses) return {};
    return months.reduce((acc, ym) => {
      const total = allExpenses
        .filter(e => e.category === categoryId && e.date.startsWith(ym) && e.currency === 'SGD' && e.type !== 'income')
        .reduce((s, e) => s + e.amount, 0);
      acc[ym] = total;
      return acc;
    }, {});
  }, [allExpenses, categoryId, months]);

  // Expenses for selected month
  const monthExpenses = useMemo(() => {
    if (!allExpenses) return [];
    return allExpenses
      .filter(e => e.category === categoryId && e.date.startsWith(selectedMonth) && e.type !== 'income')
      .sort((a, b) => b.date.localeCompare(a.date));
  }, [allExpenses, categoryId, selectedMonth]);

  const maxTotal = Math.max(...Object.values(monthlyTotals), 1);
  const monthTotal = monthlyTotals[selectedMonth] ?? 0;

  const barScrollRef = useRef(null);
  // Scroll to selected bar on mount
  useEffect(() => {
    const idx = months.indexOf(selectedMonth);
    if (barScrollRef.current && idx >= 0) {
      const barW = 44;
      barScrollRef.current.scrollLeft = Math.max(0, idx * barW - 100);
    }
  }, []);

  return (
    <div className="min-h-screen bg-[#ECEDF0] pb-24">
      {/* Header */}
      <div className="px-4 pt-4 pb-3 flex items-center gap-3">
        <button
          onClick={onBack}
          className="w-9 h-9 rounded-full bg-white shadow-sm flex items-center justify-center text-gray-600 flex-shrink-0"
        >
          <ChevronLeft size={20} />
        </button>
        <div>
          <h1 className="text-lg font-bold text-gray-900 leading-tight">{cat.label}</h1>
          <p className="text-xs text-gray-500">{formatMonthFull(selectedMonth)}</p>
        </div>
        <div className="ml-auto">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center text-2xl" style={{ background: cat.bg }}>
            {cat.icon}
          </div>
        </div>
      </div>

      {/* Bar chart card */}
      <div className="mx-4 bg-white rounded-2xl shadow-sm overflow-hidden mb-4">
        {/* Total header */}
        <div className="px-5 pt-4 pb-2">
          <p className="text-xs text-gray-400 font-medium">Total · {formatMonthFull(selectedMonth)}</p>
          <p className="text-2xl font-bold text-gray-900">S${fmt(monthTotal)}</p>
        </div>

        {/* Scrollable bars */}
        <div
          ref={barScrollRef}
          className="overflow-x-auto scrollbar-none px-3 pb-4"
          style={{ scrollbarWidth: 'none' }}
        >
          <div className="flex items-end gap-1.5" style={{ minWidth: months.length * 44, height: 180 }}>
            {months.map(ym => {
              const total = monthlyTotals[ym] ?? 0;
              const barH = total > 0 ? Math.max((total / maxTotal) * 130, 12) : 6;
              const isSelected = ym === selectedMonth;
              return (
                <button
                  key={ym}
                  onClick={() => setSelectedMonth(ym)}
                  className="flex flex-col items-center justify-end flex-shrink-0 rounded-xl transition-colors"
                  style={{ width: 40, height: 170, paddingBottom: 4, background: isSelected ? '#e5e7eb' : 'transparent' }}
                >
                  {/* Amount label */}
                  <p className="text-[9px] font-semibold mb-1" style={{ color: total > 0 ? '#374151' : '#d1d5db' }}>
                    {total > 0 ? fmtK(total) : '—'}
                  </p>
                  {/* Bar */}
                  <div
                    className="w-5 rounded-t-lg transition-all"
                    style={{
                      height: barH,
                      background: isSelected ? cat.color : total > 0 ? `${cat.color}88` : '#e5e7eb',
                    }}
                  />
                  {/* Month label */}
                  <p className="text-[10px] mt-1.5 font-medium" style={{ color: isSelected ? '#374151' : '#9ca3af' }}>
                    {shortMonth(ym)}
                  </p>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Expense list for selected month */}
      <div className="mx-4 bg-white rounded-2xl shadow-sm overflow-hidden">
        <div className="px-5 pt-4 pb-2">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">
            {formatMonthFull(selectedMonth)} · {monthExpenses.length} {monthExpenses.length === 1 ? 'expense' : 'expenses'}
          </p>
        </div>

        {monthExpenses.length === 0 ? (
          <div className="px-5 py-10 text-center text-gray-400">
            <p className="text-3xl mb-2">{cat.icon}</p>
            <p className="text-sm">No {cat.label} expenses in {formatMonthFull(selectedMonth)}</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-50">
            {monthExpenses.map(exp => {
              const sym = exp.currency === 'INR' ? '₹' : 'S$';
              return (
                <button key={exp.id} onClick={() => onEdit?.(exp)} className="w-full px-4 py-3.5 flex items-center gap-3 text-left active:bg-gray-50 hover:bg-gray-50 transition-colors">
                  {/* Icon circle */}
                  <div
                    className="w-11 h-11 rounded-full flex items-center justify-center text-xl flex-shrink-0 shadow-sm"
                    style={{ background: cat.bg }}
                  >
                    {cat.icon}
                  </div>

                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-gray-900 uppercase truncate">
                      {exp.payee || cat.label}
                    </p>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: cat.color }} />
                      <p className="text-xs text-gray-400">{exp.addedByName}</p>
                    </div>
                  </div>

                  <div className="text-right flex-shrink-0">
                    <div className="flex items-center justify-end gap-1">
                      <p className="text-sm font-bold text-gray-900">{sym}{exp.amount.toLocaleString('en-SG', { minimumFractionDigits: 2 })}</p>
                      <div className="w-6 h-6 rounded-full bg-gray-100 flex items-center justify-center">
                        <TrendingUp size={11} className="text-gray-500" />
                      </div>
                    </div>
                    <p className="text-[11px] text-gray-400">{friendlyDate(exp.date)}</p>
                  </div>
                </button>
              );
            })}
          </div>
        )}
        <div className="h-3" />
      </div>
    </div>
  );
}

/* ── Helpers ─────────────────────────────────────── */
function fmt(n) {
  return Number(n).toLocaleString('en-SG', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function fmtK(n) {
  if (n >= 1000) return (n / 1000).toFixed(1) + 'K';
  return String(Math.round(n));
}
function shortMonth(ym) {
  const [y, m] = ym.split('-');
  return new Date(y, m - 1).toLocaleString('en-SG', { month: 'short' });
}
function formatMonthFull(ym) {
  if (!ym) return '';
  const [y, m] = ym.split('-');
  return new Date(y, m - 1).toLocaleString('en-SG', { month: 'long', year: 'numeric' });
}
function friendlyDate(dateStr) {
  const d = new Date(dateStr + 'T00:00:00');
  const today = new Date();
  const yesterday = new Date(); yesterday.setDate(yesterday.getDate() - 1);
  if (sameDay(d, today)) return 'Today';
  if (sameDay(d, yesterday)) return 'Yesterday';
  return d.toLocaleDateString('en-SG', { day: 'numeric', month: 'short' });
}
function sameDay(a, b) {
  return a.getDate() === b.getDate() && a.getMonth() === b.getMonth() && a.getFullYear() === b.getFullYear();
}
