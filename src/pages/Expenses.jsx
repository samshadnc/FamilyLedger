import { useMemo } from 'react';
import { PieChart, Pie, Cell, Tooltip } from 'recharts';
import { getCategoryById, CURRENCIES, getBankBrand, UNBUDGETED_TAG } from '../constants';
import BankBadge from '../components/BankBadge';

export default function Expenses({ expenses, allExpenses, onEdit, onDelete, profile, allowEditOthers, selectedTag, onClearTag, onTagSelect, selectedAccount, onClearAccount, onAccountSelect, accountMap, selectedPayee, onClearPayee, onPayeeSelect, selectedCategory, onClearCategory, onCategorySelect }) {
  const sgdVal = (e) => e.currency === 'SGD' ? e.amount : (e.sgdAmount ?? 0);

  const filtered = selectedTag
    ? expenses.filter(e => e.tags?.includes(selectedTag))
    : selectedAccount
    ? expenses.filter(e => e.account === selectedAccount)
    : selectedPayee
    ? (allExpenses ?? expenses).filter(e => (e.payee === selectedPayee || e.platform === selectedPayee) && e.type !== 'income')
    : selectedCategory
    ? expenses.filter(e => e.category === selectedCategory && e.type !== 'income')
    : expenses;

  const tagTotal = selectedTag
    ? filtered.filter(e => e.type !== 'income').reduce((s, e) => s + sgdVal(e), 0)
    : 0;

  const accountTotal = selectedAccount
    ? filtered.filter(e => e.type !== 'income').reduce((s, e) => s + sgdVal(e), 0)
    : 0;

  const payeeTotal = selectedPayee
    ? filtered.reduce((s, e) => s + sgdVal(e), 0)
    : 0;

  const categoryTotal = selectedCategory
    ? filtered.reduce((s, e) => s + sgdVal(e), 0)
    : 0;

  const categoryMonthlyData = useMemo(() => {
    if (!selectedCategory) return [];
    const now = new Date();
    return Array.from({ length: 12 }, (_, i) => {
      const d = new Date(now.getFullYear(), now.getMonth() - (11 - i));
      const ym = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const label = d.toLocaleString('en-SG', { month: 'short' });
      const total = (allExpenses ?? []).filter(e => e.category === selectedCategory && e.date.startsWith(ym) && e.type !== 'income').reduce((s, e) => s + sgdVal(e), 0);
      return { ym, label, total, isCurrent: i === 11 };
    });
  }, [selectedCategory, allExpenses]);

  const payeeMonthlyData = useMemo(() => {
    if (!selectedPayee) return [];
    const now = new Date();
    return Array.from({ length: 12 }, (_, i) => {
      const d = new Date(now.getFullYear(), now.getMonth() - (11 - i));
      const ym = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const label = d.toLocaleString('en-SG', { month: 'short' });
      const total = (allExpenses ?? []).filter(e => (e.payee === selectedPayee || e.platform === selectedPayee) && e.date.startsWith(ym) && e.type !== 'income').reduce((s, e) => s + sgdVal(e), 0);
      const isCurrent = i === 11;
      return { ym, label, total, isCurrent };
    });
  }, [selectedPayee, allExpenses]);

  const grouped = groupByDate(filtered);

  const catBreakdown = useMemo(() => {
    const source = (selectedTag || selectedAccount) ? filtered : expenses;
    if (selectedCategory) return [];
    const map = {};
    source.filter(e => e.type !== 'income' && e.type !== 'investment').forEach(e => {
      map[e.category] = (map[e.category] ?? 0) + sgdVal(e);
    });
    return Object.entries(map)
      .sort((a, b) => b[1] - a[1])
      .map(([id, amt]) => ({ ...getCategoryById(id), amt }));
  }, [filtered, expenses, selectedTag, selectedAccount]);

  const allTotal = useMemo(() =>
    expenses.filter(e => e.type !== 'income' && e.type !== 'investment').reduce((s, e) => s + sgdVal(e), 0),
  [expenses]);

  const tagMonthlyData = useMemo(() => {
    if (!selectedTag) return [];
    const now = new Date();
    return Array.from({ length: 12 }, (_, i) => {
      const d = new Date(now.getFullYear(), now.getMonth() - (11 - i));
      const ym = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const label = d.toLocaleString('en-SG', { month: 'short' });
      const total = (allExpenses ?? []).filter(e => e.tags?.includes(selectedTag) && e.date.startsWith(ym) && e.type !== 'income').reduce((s, e) => s + sgdVal(e), 0);
      return { ym, label, total, isCurrent: i === 11 };
    });
  }, [selectedTag, allExpenses]);

  const accountMonthlyData = useMemo(() => {
    if (!selectedAccount) return [];
    const now = new Date();
    return Array.from({ length: 12 }, (_, i) => {
      const d = new Date(now.getFullYear(), now.getMonth() - (11 - i));
      const ym = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const label = d.toLocaleString('en-SG', { month: 'short' });
      const total = (allExpenses ?? []).filter(e => e.account === selectedAccount && e.date.startsWith(ym) && e.type !== 'income').reduce((s, e) => s + sgdVal(e), 0);
      return { ym, label, total, isCurrent: i === 11 };
    });
  }, [selectedAccount, allExpenses]);

  if (expenses.length === 0 && !selectedTag && !selectedAccount && !selectedPayee && !selectedCategory) {
    return (
      <div className="pb-24 text-center py-20 text-gray-400 px-4">
        <p className="text-5xl mb-3">🧾</p>
        <p className="font-medium text-gray-600">No expenses this month</p>
        <p className="text-sm mt-1">Tap + to add one</p>
      </div>
    );
  }

  return (
    <div className="pb-24 px-4 pt-4 space-y-5">
      {/* Category breakdown — always visible at top when no filter active */}
      {!selectedTag && !selectedAccount && !selectedPayee && !selectedCategory && catBreakdown.length > 0 && (
        <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
          <div className="px-4 pt-3 pb-1 flex items-center justify-between">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Category Breakdown</p>
            <p className="text-xs font-bold text-gray-700">
              S${allTotal.toLocaleString('en-SG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
          </div>
          <FilterChart breakdown={catBreakdown} total={allTotal} />
        </div>
      )}

      {/* Tag filter banner */}
      {selectedTag && (
        <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
          {/* Top row */}
          <div className="px-4 pt-3 pb-2 flex items-center gap-3">
            <div className="flex-1 min-w-0">
              <span className="text-sm font-bold text-gray-900">🏷️ {selectedTag}</span>
              <p className="text-xs text-gray-400 mt-0.5">
                {filtered.length} {filtered.length === 1 ? 'transaction' : 'transactions'}
                {tagTotal > 0 && <span className="text-indigo-600 font-semibold"> · S${tagTotal.toLocaleString('en-SG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>}
              </p>
            </div>
            <button
              onClick={onClearTag}
              className="w-7 h-7 rounded-full bg-gray-100 flex items-center justify-center text-gray-500 flex-shrink-0"
            >✕</button>
          </div>
          {/* Donut chart */}
          {catBreakdown.length > 0 && (
            <FilterChart breakdown={catBreakdown} total={tagTotal} />
          )}
          {/* Monthly trend */}
          {tagMonthlyData.some(d => d.total > 0) && (
            <div className="px-4 pb-4">
              <p className="text-[10px] text-gray-400 uppercase tracking-wide mb-2">Monthly spend</p>
              <div className="flex items-end gap-1 h-20">
                {tagMonthlyData.map(({ ym, label, total, isCurrent }) => {
                  const maxT = Math.max(...tagMonthlyData.map(d => d.total), 1);
                  const h = total > 0 ? Math.max((total / maxT) * 44, 3) : 2;
                  const amtStr = total > 0 ? (total < 10 ? total.toFixed(2) : total.toFixed(1)) : '';
                  return (
                    <div key={ym} className="flex-1 flex flex-col items-center justify-end gap-0.5">
                      {total > 0 && (
                        <p className="text-[7px] font-semibold leading-none mb-0.5" style={{ color: isCurrent ? '#4F46E5' : '#9ca3af' }}>
                          {amtStr}
                        </p>
                      )}
                      <div className="w-full rounded-t-sm" style={{ height: h, background: isCurrent ? '#4F46E5' : '#c7d2fe' }} />
                      <p className="text-[8px]" style={{ color: isCurrent ? '#4F46E5' : '#9ca3af' }}>{label}</p>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
      {filtered.length === 0 && selectedTag && (
        <div className="text-center py-16 text-gray-400">
          <p className="text-4xl mb-2">🏷️</p>
          <p className="font-medium text-gray-600">No transactions tagged "{selectedTag}"</p>
        </div>
      )}

      {/* Account filter banner */}
      {selectedAccount && (
        <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
          <div className="px-4 pt-3 pb-2 flex items-center gap-3">
            <div className="flex-1 min-w-0">
              <span className="text-sm font-bold text-gray-900">🏦 {accountMap?.[selectedAccount] ?? selectedAccount}</span>
              <p className="text-xs text-gray-400 mt-0.5">
                {filtered.length} {filtered.length === 1 ? 'transaction' : 'transactions'}
                {accountTotal > 0 && <span className="text-green-700 font-semibold"> · S${accountTotal.toLocaleString('en-SG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>}
              </p>
            </div>
            <button
              onClick={onClearAccount}
              className="w-7 h-7 rounded-full bg-gray-100 flex items-center justify-center text-gray-500 flex-shrink-0"
            >✕</button>
          </div>
          {catBreakdown.length > 0 && (
            <FilterChart breakdown={catBreakdown} total={accountTotal} />
          )}
          {accountMonthlyData.some(d => d.total > 0) && (
            <div className="px-4 pb-4">
              <p className="text-[10px] text-gray-400 uppercase tracking-wide mb-2">Monthly spend</p>
              <div className="flex items-end gap-1 h-20">
                {accountMonthlyData.map(({ ym, label, total, isCurrent }) => {
                  const maxT = Math.max(...accountMonthlyData.map(d => d.total), 1);
                  const h = total > 0 ? Math.max((total / maxT) * 44, 3) : 2;
                  const amtStr = total > 0 ? (total < 10 ? total.toFixed(2) : total.toFixed(1)) : '';
                  return (
                    <div key={ym} className="flex-1 flex flex-col items-center justify-end gap-0.5">
                      {total > 0 && (
                        <p className="text-[7px] font-semibold leading-none mb-0.5" style={{ color: isCurrent ? '#4F46E5' : '#9ca3af' }}>
                          {amtStr}
                        </p>
                      )}
                      <div className="w-full rounded-t-sm" style={{ height: h, background: isCurrent ? '#4F46E5' : '#c7d2fe' }} />
                      <p className="text-[8px]" style={{ color: isCurrent ? '#4F46E5' : '#9ca3af' }}>{label}</p>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
      {filtered.length === 0 && selectedAccount && (
        <div className="text-center py-16 text-gray-400">
          <p className="text-4xl mb-2">🏦</p>
          <p className="font-medium text-gray-600">No transactions for {accountMap?.[selectedAccount] ?? selectedAccount}</p>
        </div>
      )}

      {/* Payee filter banner */}
      {selectedPayee && (
        <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
          <div className="px-4 pt-3 pb-2 flex items-center gap-3">
            <div className="flex-1 min-w-0">
              <span className="text-sm font-bold text-gray-900">🏪 {selectedPayee}</span>
              <p className="text-xs text-gray-400 mt-0.5">
                {filtered.length} {filtered.length === 1 ? 'transaction' : 'transactions'}
                {payeeTotal > 0 && <span className="text-indigo-600 font-semibold"> · S${payeeTotal.toLocaleString('en-SG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>}
              </p>
            </div>
            <button onClick={onClearPayee} className="w-7 h-7 rounded-full bg-gray-100 flex items-center justify-center text-gray-500 flex-shrink-0">✕</button>
          </div>
          {payeeMonthlyData.some(d => d.total > 0) && (
            <div className="px-4 pb-4">
              <p className="text-[10px] text-gray-400 uppercase tracking-wide mb-2">Monthly spend</p>
              <div className="flex items-end gap-1 h-20">
                {payeeMonthlyData.map(({ ym, label, total, isCurrent }) => {
                  const maxT = Math.max(...payeeMonthlyData.map(d => d.total), 1);
                  const h = total > 0 ? Math.max((total / maxT) * 44, 3) : 2;
                  const amtStr = total > 0 ? (total < 10 ? total.toFixed(2) : total.toFixed(1)) : '';
                  return (
                    <div key={ym} className="flex-1 flex flex-col items-center justify-end gap-0.5">
                      {total > 0 && (
                        <p className="text-[7px] font-semibold leading-none mb-0.5" style={{ color: isCurrent ? '#4F46E5' : '#9ca3af' }}>
                          {amtStr}
                        </p>
                      )}
                      <div className="w-full rounded-t-sm" style={{ height: h, background: isCurrent ? '#4F46E5' : '#c7d2fe' }} />
                      <p className="text-[8px]" style={{ color: isCurrent ? '#4F46E5' : '#9ca3af' }}>{label}</p>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
      {filtered.length === 0 && selectedPayee && (
        <div className="text-center py-16 text-gray-400">
          <p className="text-4xl mb-2">🏪</p>
          <p className="font-medium text-gray-600">No transactions for "{selectedPayee}"</p>
        </div>
      )}

      {/* Category filter banner */}
      {selectedCategory && (() => {
        const cat = getCategoryById(selectedCategory);
        return (
          <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
            <div className="px-4 pt-3 pb-2 flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl flex items-center justify-center text-lg flex-shrink-0" style={{ background: cat.bg }}>
                {cat.icon}
              </div>
              <div className="flex-1 min-w-0">
                <span className="text-sm font-bold text-gray-900">{cat.label}</span>
                <p className="text-xs text-gray-400 mt-0.5">
                  {filtered.length} {filtered.length === 1 ? 'transaction' : 'transactions'}
                  {categoryTotal > 0 && <span className="font-semibold" style={{ color: cat.color }}> · S${categoryTotal.toLocaleString('en-SG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>}
                </p>
              </div>
              <button onClick={onClearCategory} className="w-7 h-7 rounded-full bg-gray-100 flex items-center justify-center text-gray-500 flex-shrink-0">✕</button>
            </div>
            {categoryMonthlyData.some(d => d.total > 0) && (
              <div className="px-4 pb-4">
                <p className="text-[10px] text-gray-400 uppercase tracking-wide mb-2">Monthly spend</p>
                <div className="flex items-end gap-1 h-20">
                  {categoryMonthlyData.map(({ ym, label, total, isCurrent }) => {
                    const maxT = Math.max(...categoryMonthlyData.map(d => d.total), 1);
                    const h = total > 0 ? Math.max((total / maxT) * 44, 3) : 2;
                    const amtStr = total > 0 ? (total < 10 ? total.toFixed(2) : total.toFixed(1)) : '';
                    return (
                      <div key={ym} className="flex-1 flex flex-col items-center justify-end gap-0.5">
                        {total > 0 && <p className="text-[7px] font-semibold leading-none mb-0.5" style={{ color: isCurrent ? cat.color : '#9ca3af' }}>{amtStr}</p>}
                        <div className="w-full rounded-t-sm" style={{ height: h, background: isCurrent ? cat.color : `${cat.color}55` }} />
                        <p className="text-[8px]" style={{ color: isCurrent ? cat.color : '#9ca3af' }}>{label}</p>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        );
      })()}
      {filtered.length === 0 && selectedCategory && (
        <div className="text-center py-16 text-gray-400">
          <p className="text-4xl mb-2">{getCategoryById(selectedCategory).icon}</p>
          <p className="font-medium text-gray-600">No {getCategoryById(selectedCategory).label} expenses this month</p>
        </div>
      )}

      {grouped.map(({ dateLabel, items }) => (
        <div key={dateLabel}>
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">{dateLabel}</p>
          <div className="bg-white rounded-2xl shadow-sm overflow-hidden divide-y divide-gray-50">
            {items.map(exp => {
              const cat = getCategoryById(exp.category);
              const isINR = exp.currency === 'INR';
              const isMine = exp.addedBy === profile?.uid;
              const canEdit = isMine || allowEditOthers;

              return (
                <button
                  key={exp.id}
                  onClick={() => onEdit(exp)}
                  className="w-full px-4 py-3.5 flex items-center gap-3 text-left active:bg-gray-50 hover:bg-gray-50 transition-colors"
                >
                  {/* Icon — tappable to filter by category */}
                  <button
                    type="button"
                    onClick={e => { e.stopPropagation(); onCategorySelect?.(exp.category); }}
                    className={`w-11 h-11 rounded-xl flex items-center justify-center text-xl flex-shrink-0 transition-transform active:scale-90 ${selectedCategory === exp.category ? 'ring-2 ring-offset-1' : ''}`}
                    style={{ background: cat.bg, ...(selectedCategory === exp.category ? { ringColor: cat.color } : {}) }}
                  >
                    {cat.icon}
                  </button>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    {exp.payee ? (
                      <button
                        type="button"
                        onClick={e => { e.stopPropagation(); onPayeeSelect?.(exp.payee); }}
                        className={`text-sm font-semibold truncate text-left max-w-full ${selectedPayee === exp.payee ? 'text-indigo-600' : 'text-gray-900'}`}
                      >{exp.payee}</button>
                    ) : (
                      <p className="text-sm font-semibold text-gray-900 truncate">{exp.note || cat.label}</p>
                    )}
                    <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                      {exp.account && accountMap?.[exp.account] && (() => {
                        const brand = getBankBrand(accountMap[exp.account]);
                        const isActive = selectedAccount === exp.account;
                        return (
                          <button
                            type="button"
                            onClick={e => { e.stopPropagation(); onAccountSelect?.(exp.account); }}
                            className="flex items-center p-0.5 rounded-full transition-opacity active:opacity-70"
                            style={{
                              background: isActive ? brand.bg : `${brand.bg}18`,
                              border: `1px solid ${brand.bg}44`,
                            }}
                          >
                            <BankBadge label={accountMap[exp.account]} size="chip" />
                          </button>
                        );
                      })()}
                      {exp.payee && exp.note ? <span className="text-[11px] text-gray-400 truncate max-w-[130px]">{exp.note}</span> : null}
                      {exp.tags?.length > 0
                        ? exp.tags.slice(0, 2).map(t => (
                            <button
                              key={t}
                              type="button"
                              onClick={e => { e.stopPropagation(); onTagSelect?.(t); }}
                              className={`text-[11px] px-1.5 py-0.5 rounded-full font-medium transition-colors ${
                                t === UNBUDGETED_TAG
                                  ? (selectedTag === t ? 'bg-amber-500 text-white' : 'bg-amber-100 text-amber-700 active:bg-amber-200')
                                  : selectedTag === t
                                    ? 'bg-indigo-600 text-white'
                                    : 'bg-indigo-50 text-indigo-600 active:bg-indigo-200'
                              }`}
                            >{t}</button>
                          ))
                        : null}
                      <span className="text-[11px] text-gray-400">{exp.addedByName ?? 'Unknown'}</span>
                    </div>
                  </div>

                  {/* Amount + mine indicator */}
                  <div className="text-right flex-shrink-0">
                    <p className="text-sm font-bold text-gray-900">
                      {isINR ? `₹${exp.amount.toFixed(2)}` : `S$${exp.amount.toFixed(2)}`}
                    </p>
                    {isINR && exp.sgdAmount != null && (
                      <p className="text-[10px] text-gray-400">≈ S${exp.sgdAmount.toFixed(2)}</p>
                    )}
                    {exp.attachment?.url && <p className="text-[10px] text-blue-400 mt-0.5">📎 receipt</p>}
                    {!exp.attachment?.url && canEdit && isMine && <p className="text-[10px] text-indigo-400 mt-0.5">tap to edit</p>}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

function FilterChart({ breakdown, total }) {
  const fmt = (n) => n.toLocaleString('en-SG', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return (
    <div className="px-4 pb-4 flex items-center gap-4">
      {/* Donut */}
      <div className="flex-shrink-0">
        <PieChart width={110} height={110}>
          <Pie
            data={breakdown}
            cx={50}
            cy={50}
            innerRadius={32}
            outerRadius={50}
            dataKey="amt"
            strokeWidth={2}
            stroke="#ECEDF0"
          >
            {breakdown.map((cat) => (
              <Cell key={cat.id} fill={cat.color} />
            ))}
          </Pie>
          <Tooltip
            formatter={(v) => [`S$${fmt(v)}`, '']}
            contentStyle={{ fontSize: 11, borderRadius: 8, border: 'none', boxShadow: '0 2px 8px rgba(0,0,0,0.12)' }}
          />
        </PieChart>
      </div>
      {/* Legend */}
      <div className="flex-1 min-w-0 space-y-1.5">
        {breakdown.map((cat) => {
          const pct = total > 0 ? ((cat.amt / total) * 100).toFixed(0) : 0;
          return (
            <div key={cat.id} className="flex items-center gap-2">
              <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: cat.color }} />
              <span className="text-xs text-gray-700 truncate flex-1">{cat.label}</span>
              <span className="text-xs font-semibold text-gray-500 flex-shrink-0">{pct}%</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function groupByDate(expenses) {
  const map = {};
  const sorted = [...expenses].sort((a, b) => {
    if (b.date !== a.date) return b.date.localeCompare(a.date);
    return (b.createdAt?.seconds ?? 0) - (a.createdAt?.seconds ?? 0);
  });
  sorted.forEach(exp => {
    const label = formatDateLabel(exp.date);
    if (!map[label]) map[label] = [];
    map[label].push(exp);
  });
  return Object.entries(map).map(([dateLabel, items]) => ({ dateLabel, items }));
}

function formatDateLabel(dateStr) {
  const d = new Date(dateStr + 'T00:00:00');
  const today = new Date();
  const yesterday = new Date(); yesterday.setDate(yesterday.getDate() - 1);
  if (sameDay(d, today)) return 'Today';
  if (sameDay(d, yesterday)) return 'Yesterday';
  return d.toLocaleDateString('en-SG', { weekday: 'long', day: 'numeric', month: 'short' });
}

function sameDay(a, b) {
  return a.getDate() === b.getDate() && a.getMonth() === b.getMonth() && a.getFullYear() === b.getFullYear();
}
