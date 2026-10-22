import { useMemo, useState, useRef, useEffect } from 'react';
import { Search, Plus, ChevronRight, X, TrendingUp } from 'lucide-react';
import { BarChart, Bar, XAxis, ResponsiveContainer, Tooltip, Cell, PieChart, Pie } from 'recharts';
import { getCategoryById, CURRENCIES, AVATARS, getBankBrand, presetButtonText } from '../constants';

export default function Dashboard({ expenses, allExpenses, month, onAdd, onEdit, profile, budget, categorySettings, memberNames, onCategorySelect, onOpenSettings, onTagSelect, onPayeeSelect, allowEditOthers, presets, onPresetSave, accountMap }) {
  const [activeTab, setActiveTab] = useState('transactions'); // 'transactions' | 'trends' | 'categories'
  const [trendsMonth, setTrendsMonth] = useState(month);
  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const searchRef = useRef(null);

  const {
    totalExpense, totalIncome, investmentTotal, byCategoryByCur,
    byPerson, recentExpenses, dailyData, categoryTotals,
  } = useMemo(() => {
    let expense = 0, income = 0;
    const catMap = {};
    const bp = {};
    const dailyMap = {};

    expenses.forEach(exp => {
      const sgdAmt = exp.currency === 'SGD' ? exp.amount : (exp.sgdAmount ?? 0);
      if (exp.type === 'income') {
        income += sgdAmt;
      } else if (exp.type === 'investment') {
        // investments tracked separately — don't count as spending
      } else {
        expense += sgdAmt;
        catMap[exp.category] = (catMap[exp.category] ?? 0) + sgdAmt;
        const day = exp.date.split('-')[2];
        dailyMap[day] = (dailyMap[day] ?? 0) + sgdAmt;
      }
      const n = exp.addedByName ?? 'Unknown';
      if (!bp[n]) bp[n] = { SGD: 0 };
      if (exp.type !== 'income' && exp.type !== 'investment') {
        bp[n].SGD = (bp[n].SGD ?? 0) + sgdAmt;
      }
    });

    const investmentTotal = expenses
      .filter(e => e.type === 'investment')
      .reduce((s, e) => s + (e.currency === 'SGD' ? e.amount : (e.sgdAmount ?? 0)), 0);

    // Build daily bar data (all days of month)
    const [y, m] = month.split('-');
    const daysInMonth = new Date(+y, +m, 0).getDate();
    const dailyData = Array.from({ length: daysInMonth }, (_, i) => {
      const d = String(i + 1).padStart(2, '0');
      return { day: i + 1, label: String(i + 1), amount: dailyMap[d] ?? 0 };
    });

    // Category totals sorted
    const categoryTotals = Object.entries(catMap)
      .sort((a, b) => b[1] - a[1])
      .map(([id, amount]) => ({ id, amount }));

    const recent = [...expenses]
      .filter(e => e.type !== 'income' && e.type !== 'investment')
      .sort((a, b) => {
        if (b.date !== a.date) return b.date.localeCompare(a.date);
        return (b.createdAt?.seconds ?? 0) - (a.createdAt?.seconds ?? 0);
      });

    // Always include all known members even if they have no expenses this month
    (memberNames ?? []).forEach(name => { if (!bp[name]) bp[name] = { SGD: 0 }; });

    return { totalExpense: expense, totalIncome: income, investmentTotal, byCategoryByCur: catMap, byPerson: bp, recentExpenses: recent, dailyData, categoryTotals };
  }, [expenses, month, memberNames]);

  // Last-month review banner (shown first 5 days of a new month)
  const lastMonthYM = useMemo(() => {
    const d = new Date();
    d.setDate(1);
    d.setMonth(d.getMonth() - 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  }, []);

  const showLastMonthBanner = (() => {
    const now = new Date();
    const [cy, cm] = month.split('-').map(Number);
    return now.getDate() <= 5 && now.getFullYear() === cy && now.getMonth() + 1 === cm;
  })();

  const lastMonthSummary = useMemo(() => {
    if (!showLastMonthBanner) return null;
    const exps = (allExpenses ?? []).filter(e => e.date.startsWith(lastMonthYM) && e.type !== 'income');
    const total = exps.reduce((s, e) => s + (e.currency === 'SGD' ? e.amount : (e.sgdAmount ?? 0)), 0);
    const catMap = {};
    exps.forEach(e => {
      const v = e.currency === 'SGD' ? e.amount : (e.sgdAmount ?? 0);
      catMap[e.category] = (catMap[e.category] ?? 0) + v;
    });
    const topCats = Object.entries(catMap)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 2)
      .map(([id, amount]) => ({ cat: getCategoryById(id), amount }));
    return { total, topCats };
  }, [showLastMonthBanner, allExpenses, lastMonthYM]);

  // Category totals for the trends-selected month
  const trendsCategoryTotals = useMemo(() => {
    const map = {};
    (allExpenses ?? [])
      .filter(e => e.date.startsWith(trendsMonth) && e.type !== 'income')
      .forEach(e => {
        const v = e.currency === 'SGD' ? e.amount : (e.sgdAmount ?? 0);
        map[e.category] = (map[e.category] ?? 0) + v;
      });
    return Object.entries(map).sort((a, b) => b[1] - a[1]).map(([id, amount]) => ({ id, amount }));
  }, [allExpenses, trendsMonth]);

  const trendsTotalExpense = trendsCategoryTotals.reduce((s, c) => s + c.amount, 0);

  // Search across all expenses (all months)
  const searchResults = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return [];
    return (allExpenses ?? [])
      .filter(e => e.type !== 'income')
      .filter(e => {
        const cat = getCategoryById(e.category);
        return (
          e.payee?.toLowerCase().includes(q) ||
          e.note?.toLowerCase().includes(q) ||
          cat.label.toLowerCase().includes(q) ||
          e.addedByName?.toLowerCase().includes(q) ||
          e.tags?.some(t => t.toLowerCase().includes(q)) ||
          String(e.amount).includes(q)
        );
      })
      .sort((a, b) => b.date.localeCompare(a.date))
      .slice(0, 30);
  }, [allExpenses, searchQuery]);

  useEffect(() => {
    if (showSearch) setTimeout(() => searchRef.current?.focus(), 50);
  }, [showSearch]);

  const safeBudget = budget ?? 5000;
  const pct = Math.min((totalExpense / safeBudget) * 100, 100);
  const remaining = Math.max(safeBudget - totalExpense, 0);

  // Days remaining in month
  const today = new Date();
  const [y, m] = month.split('-').map(Number);
  const daysInMonth = new Date(y, m, 0).getDate();
  const isCurrentMonth = today.getFullYear() === y && today.getMonth() + 1 === m;
  const daysRemaining = isCurrentMonth ? daysInMonth - today.getDate() + 1 : daysInMonth;
  const safePerDay = daysRemaining > 0 ? remaining / daysRemaining : 0;

  // SVG ring
  const r = 108;
  const circ = 2 * Math.PI * r;
  const offset = circ * (1 - pct / 100);
  const monthLabel = formatMonthFull(month);

  const TABS = ['transactions', 'trends', 'categories'];
  const touchStart = useRef(null);
  const [swipeDir, setSwipeDir] = useState(null);
  const [prevTab, setPrevTab] = useState(null);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const transitionTimer = useRef(null);

  const switchTabAnimated = (newTab, dir) => {
    if (newTab === activeTab || isTransitioning) return;
    if (transitionTimer.current) clearTimeout(transitionTimer.current);
    setPrevTab(activeTab);
    setSwipeDir(dir);
    setActiveTab(newTab);
    setIsTransitioning(true);
    transitionTimer.current = setTimeout(() => {
      setIsTransitioning(false);
      setPrevTab(null);
    }, 300);
  };

  const handleTouchStart = (e) => {
    touchStart.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
  };

  const handleTouchEnd = (e) => {
    if (!touchStart.current) return;
    const dx = e.changedTouches[0].clientX - touchStart.current.x;
    const dy = e.changedTouches[0].clientY - touchStart.current.y;
    touchStart.current = null;
    if (Math.abs(dx) < 50 || Math.abs(dx) < Math.abs(dy)) return;
    const idx = TABS.indexOf(activeTab);
    if (dx < 0 && idx < TABS.length - 1) switchTabAnimated(TABS[idx + 1], 'left');
    if (dx > 0 && idx > 0)               switchTabAnimated(TABS[idx - 1], 'right');
  };

  const handleTabTap = (id) => {
    if (transitionTimer.current) clearTimeout(transitionTimer.current);
    setIsTransitioning(false);
    setPrevTab(null);
    setSwipeDir(null);
    setActiveTab(id);
  };

  return (
    <div
      className="pb-24 bg-[#ECEDF0] min-h-screen"
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      {/* Header */}
      <div className="px-5 pt-4 pb-3 flex items-center justify-between">
        <button
          className="flex items-center gap-3 active:opacity-70 transition-opacity"
          onClick={onOpenSettings}
        >
          <AvatarImg name={profile?.displayName} size={11} />
          <div className="text-left">
            <p className="text-xs text-gray-400 leading-none">Hi</p>
            <p className="text-lg font-bold text-gray-900 leading-tight">{profile?.displayName ?? 'User'}</p>
          </div>
        </button>
        <button
          onClick={() => { setShowSearch(s => !s); setSearchQuery(''); }}
          className={`w-10 h-10 flex items-center justify-center rounded-full transition-colors ${showSearch ? 'bg-indigo-100 text-indigo-600' : 'text-gray-600'}`}
        >
          {showSearch ? <X size={20} /> : <Search size={22} />}
        </button>
      </div>

      {/* Search bar */}
      {showSearch && (
        <div className="px-4 pb-3">
          <div className="flex items-center gap-2 bg-white rounded-2xl px-4 py-2.5 shadow-sm">
            <Search size={15} className="text-gray-400 flex-shrink-0" />
            <input
              ref={searchRef}
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search payee, items, category…"
              className="flex-1 text-sm bg-transparent outline-none text-gray-800 placeholder-gray-400"
            />
            {searchQuery && (
              <button onClick={() => setSearchQuery('')} className="text-gray-300 hover:text-gray-500">
                <X size={14} />
              </button>
            )}
          </div>

          {searchQuery.trim() && (
            <div className="mt-2 space-y-2">
              {searchResults.length === 0 ? (
                <div className="bg-white rounded-2xl shadow-sm px-4 py-6 text-center text-sm text-gray-400">No results for "{searchQuery}"</div>
              ) : (() => {
                // Group by month
                const groups = {};
                searchResults.forEach(exp => {
                  const ym = exp.date.slice(0, 7);
                  if (!groups[ym]) groups[ym] = [];
                  groups[ym].push(exp);
                });
                return Object.entries(groups)
                  .sort(([a], [b]) => b.localeCompare(a))
                  .map(([ym, items]) => {
                    const [yr, mo] = ym.split('-');
                    const label = new Date(+yr, +mo - 1, 1).toLocaleDateString('en-SG', { month: 'long', year: 'numeric' });
                    return (
                      <div key={ym}>
                        <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide px-1 mb-1">{label}</p>
                        <div className="bg-white rounded-2xl shadow-sm overflow-hidden divide-y divide-gray-50 max-h-[40vh] overflow-y-auto">
                          {items.map(exp => {
                            const cat = getCategoryById(exp.category);
                            const sym = exp.currency === 'INR' ? '₹' : 'S$';
                            const day = new Date(exp.date + 'T00:00:00').toLocaleDateString('en-SG', { day: 'numeric', month: 'short' });
                            return (
                              <button
                                key={exp.id}
                                onClick={() => { onEdit?.(exp); setShowSearch(false); setSearchQuery(''); }}
                                className="w-full px-4 py-3 flex items-center gap-3 text-left active:bg-gray-50"
                              >
                                <div className="relative w-9 h-9 rounded-xl flex items-center justify-center text-base flex-shrink-0" style={{ background: cat.bg }}>
                                  {cat.icon}
                                  {exp.account && accountMap?.[exp.account] && (() => {
                                    const brand = getBankBrand(accountMap[exp.account]);
                                    return brand.logo ? (
                                      <img src={brand.logo} alt={accountMap[exp.account]}
                                        className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-white object-contain p-0.5 shadow-sm" />
                                    ) : null;
                                  })()}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm font-semibold text-gray-900 truncate">{exp.payee || exp.note || cat.label}</p>
                                  <p className="text-[11px] text-gray-400">{exp.note && exp.payee ? exp.note + ' · ' : ''}{day} · {exp.addedByName}</p>
                                </div>
                                <p className="text-sm font-bold text-gray-900 flex-shrink-0">{sym}{exp.amount.toFixed(2)}</p>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    );
                  });
              })()}
            </div>
          )}
        </div>
      )}

      {/* Ring / Category chart */}
      <div className="px-5 pt-1 pb-2">
        <p className="text-center text-gray-500 text-sm mb-3">
          Spent in <span className="font-bold text-gray-800">
            {activeTab === 'trends' ? formatMonthFull(trendsMonth) : monthLabel}
          </span>
        </p>

        {(activeTab === 'categories' || activeTab === 'trends') && (activeTab !== 'trends' ? categoryTotals.length > 0 : true) ? (
          /* ── Category donut ───────────────────────────────── */
          (() => {
            const pieData = activeTab === 'trends' ? trendsCategoryTotals : categoryTotals;
            const pieTotal = activeTab === 'trends' ? trendsTotalExpense : totalExpense;
            return (
              <div className="flex items-center gap-4">
                <div className="flex-shrink-0">
                  {pieData.length > 0 ? (
                    <PieChart width={160} height={160}>
                      <Pie data={pieData} cx={75} cy={75} innerRadius={42} outerRadius={72}
                        dataKey="amount" strokeWidth={2} stroke="#ECEDF0">
                        {pieData.map(({ id }) => {
                          const cat = getCategoryById(id);
                          return <Cell key={id} fill={cat.color} />;
                        })}
                      </Pie>
                      <Tooltip
                        formatter={(v) => [`S$${fmt(v)}`, '']}
                        contentStyle={{ fontSize: 11, borderRadius: 8, border: 'none', boxShadow: '0 2px 8px rgba(0,0,0,0.12)' }}
                      />
                    </PieChart>
                  ) : (
                    <div className="w-40 h-40 flex items-center justify-center">
                      <div className="w-28 h-28 rounded-full border-[14px] border-gray-200 flex items-center justify-center">
                        <p className="text-[10px] text-gray-400 text-center leading-tight">No<br/>expenses</p>
                      </div>
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0 space-y-1.5">
                  {pieData.length === 0 ? (
                    <p className="text-xs text-gray-400">No expenses for {formatMonthFull(activeTab === 'trends' ? trendsMonth : month)}</p>
                  ) : pieData.slice(0, 6).map(({ id, amount }) => {
                    const cat = getCategoryById(id);
                    const pctCat = pieTotal > 0 ? ((amount / pieTotal) * 100).toFixed(0) : 0;
                    return (
                      <div key={id} className="flex items-center gap-2">
                        <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: cat.color }} />
                        <span className="text-xs text-gray-700 truncate flex-1">{cat.label}</span>
                        <span className="text-xs font-bold text-gray-600 flex-shrink-0">{pctCat}%</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })()
        ) : (
          /* ── Budget ring ──────────────────────────────────── */
          <div className="flex items-center justify-center">
            <div className="relative w-60 h-60">
              <svg className="w-full h-full -rotate-90" viewBox="0 0 256 256">
                <circle cx="128" cy="128" r={r} fill="none" stroke="#D8D9DE" strokeWidth="22" strokeLinecap="round" />
                <circle
                  cx="128" cy="128" r={r}
                  fill="none"
                  stroke={pct > 90 ? '#ef4444' : '#4F46E5'}
                  strokeWidth="22"
                  strokeLinecap="round"
                  strokeDasharray={circ}
                  strokeDashoffset={offset}
                  style={{ transition: 'stroke-dashoffset 0.7s ease, stroke 0.3s' }}
                />
              </svg>
              <div className="absolute top-[14px] left-1/2 -translate-x-1/2 w-3 h-3 rounded-full bg-green-500 shadow" />
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <TrendingUp size={15} className="text-indigo-500 mb-1" />
                <p className="text-[28px] font-bold text-gray-900 leading-none">S${fmt(totalExpense)}</p>
                <div className="flex items-center gap-1 mt-1.5">
                  <div className="w-2 h-2 rounded-full bg-green-500" />
                  <p className="text-xs font-semibold text-gray-500">{pct.toFixed(0)}% of budget</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Stats row */}
        <div className="flex mt-3 bg-white rounded-2xl overflow-hidden shadow-sm divide-x divide-gray-100">
          <div className="flex-1 py-3 px-2 text-center">
            <p className="text-[11px] text-gray-400 mb-0.5">Budget</p>
            <p className="text-sm font-bold text-gray-900">S${fmtCompact(safeBudget)}</p>
          </div>
          <div className="flex-1 py-3 px-2 text-center">
            <p className="text-[11px] text-gray-400 mb-0.5">Safe/day</p>
            <p className={`text-sm font-bold ${safePerDay < 20 ? 'text-red-500' : 'text-indigo-600'}`}>
              S${fmtCompact(safePerDay)}
            </p>
          </div>
          {investmentTotal > 0 && (
            <div className="flex-1 py-3 px-2 text-center">
              <p className="text-[11px] text-gray-400 mb-0.5">Invested</p>
              <p className="text-sm font-bold text-violet-600">S${fmtCompact(investmentTotal)}</p>
            </div>
          )}
        </div>
      </div>

      {/* Divider */}
      <div className="h-px bg-gray-200 mx-5 my-3" />

      {/* Last-month review banner */}
      {showLastMonthBanner && lastMonthSummary && lastMonthSummary.total > 0 && (
        <button
          onClick={() => { setTrendsMonth(lastMonthYM); handleTabTap('trends'); }}
          className="mx-4 mb-3 w-[calc(100%-2rem)] bg-white rounded-2xl shadow-sm overflow-hidden text-left active:opacity-80 transition-opacity"
        >
          <div className="flex items-stretch">
            <div className="w-1 bg-indigo-500 flex-shrink-0 rounded-l-2xl" />
            <div className="flex-1 px-4 py-3">
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-bold text-indigo-600 uppercase tracking-wide">
                  {formatMonthFull(lastMonthYM)} Review
                </p>
                <ChevronRight size={14} className="text-indigo-400" />
              </div>
              <div className="flex items-end justify-between">
                <div>
                  <p className="text-lg font-bold text-gray-900 leading-none">S${fmt(lastMonthSummary.total)}</p>
                  <p className={`text-[11px] mt-0.5 font-medium ${lastMonthSummary.total > safeBudget ? 'text-red-500' : 'text-green-600'}`}>
                    {lastMonthSummary.total > safeBudget
                      ? `S${fmt(lastMonthSummary.total - safeBudget)} over budget`
                      : `S${fmt(safeBudget - lastMonthSummary.total)} under budget`}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {lastMonthSummary.topCats.map(({ cat, amount }) => (
                    <div key={cat.id} className="flex items-center gap-1 px-2 py-1 rounded-xl" style={{ background: cat.bg + '33' }}>
                      <span className="text-sm">{cat.icon}</span>
                      <span className="text-[11px] font-semibold text-gray-700">S${fmtCompact(amount)}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </button>
      )}

      {/* Tabs */}
      <div className="px-4 flex gap-2 mb-3">
        {[
          { id: 'transactions', icon: '🧾', label: 'Transactions' },
          { id: 'trends',       icon: '📊', label: 'Trends' },
          { id: 'categories',   icon: '🥧', label: 'Categories' },
        ].map(t => (
          <button
            key={t.id}
            onClick={() => handleTabTap(t.id)}
            className={`flex-1 flex items-center justify-center gap-1 rounded-full px-2 py-2 text-xs font-semibold border transition-all shadow-sm ${
              activeTab === t.id
                ? 'bg-indigo-600 text-white border-indigo-600'
                : 'bg-white text-gray-700 border-gray-100'
            }`}
          >
            <span>{t.icon}</span>{t.label}
          </button>
        ))}
      </div>

      {/* Tab content — old tab slides out while new tab slides in simultaneously */}
      <div style={{ position: 'relative', overflowX: 'hidden' }}>
        {isTransitioning && prevTab && (
          <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', zIndex: 1 }}
               className={swipeDir === 'left' ? 'tab-exit-left' : 'tab-exit-right'}>
            {prevTab === 'transactions' && <TransactionsTab expenses={recentExpenses} byPerson={byPerson} myName={profile?.displayName} myUid={profile?.uid} allowEditOthers={allowEditOthers} onAdd={onAdd} onEdit={onEdit} onTagSelect={onTagSelect} onPayeeSelect={onPayeeSelect} presets={presets} onPresetSave={onPresetSave} accountMap={accountMap} />}
            {prevTab === 'trends' && <TrendsTab allExpenses={allExpenses ?? []} currentMonth={month} selectedMonth={trendsMonth} onMonthSelect={setTrendsMonth} />}
            {prevTab === 'categories' && <CategoriesTab categoryTotals={categoryTotals} budget={safeBudget} categorySettings={categorySettings} onSelect={onCategorySelect} />}
          </div>
        )}
        <div className={isTransitioning ? (swipeDir === 'left' ? 'tab-enter-right' : 'tab-enter-left') : ''}>
          {activeTab === 'transactions' && <TransactionsTab expenses={recentExpenses} byPerson={byPerson} myName={profile?.displayName} myUid={profile?.uid} allowEditOthers={allowEditOthers} onAdd={onAdd} onEdit={onEdit} onTagSelect={onTagSelect} onPayeeSelect={onPayeeSelect} presets={presets} onPresetSave={onPresetSave} accountMap={accountMap} />}
          {activeTab === 'trends' && <TrendsTab allExpenses={allExpenses ?? []} currentMonth={month} selectedMonth={trendsMonth} onMonthSelect={setTrendsMonth} />}
          {activeTab === 'categories' && <CategoriesTab categoryTotals={categoryTotals} budget={safeBudget} categorySettings={categorySettings} onSelect={onCategorySelect} />}
        </div>
      </div>
    </div>
  );
}

/* ── Transactions tab ─────────────────────────────────── */
function TransactionsTab({ expenses, byPerson, myName, myUid, allowEditOthers, onAdd, onEdit, onTagSelect, onPayeeSelect, presets, onPresetSave, accountMap }) {
  const [selectedMember, setSelectedMember] = useState(null);

  // Click-outside to deselect
  useEffect(() => {
    if (!selectedMember) return;
    const handler = () => setSelectedMember(null);
    const timer = setTimeout(() => document.addEventListener('click', handler), 50);
    return () => { clearTimeout(timer); document.removeEventListener('click', handler); };
  }, [selectedMember]);

  const sortedMembers = Object.entries(byPerson).sort(([a], [b]) => {
    if (a === myName) return -1;
    if (b === myName) return 1;
    return a.localeCompare(b);
  });

  const visibleExpenses = selectedMember
    ? expenses.filter(e => e.addedByName === selectedMember)
    : expenses;

  const myPresets = presets?.[myName] ?? [];

  return (
    <div className="px-4 space-y-3">
      {/* Per-member + quick preset */}
      {sortedMembers.length > 0 && (
        <div className="bg-white rounded-2xl shadow-sm px-4 py-2.5">
          <div className="flex gap-2">
            {sortedMembers.map(([name, amounts]) => {
              const isSelected = selectedMember === name;
              return (
                <button
                  key={name}
                  type="button"
                  onClick={e => { e.stopPropagation(); setSelectedMember(isSelected ? null : name); }}
                  className={`flex-1 rounded-xl px-2.5 py-1.5 flex items-center gap-2 min-w-0 transition-all ${
                    isSelected
                      ? 'bg-indigo-600 shadow-sm'
                      : selectedMember
                      ? 'bg-gray-50 opacity-40'
                      : 'bg-gray-50'
                  }`}
                >
                  <AvatarImg name={name} size={7} />
                  <div className="min-w-0">
                    <p className={`text-[11px] truncate leading-none ${isSelected ? 'text-indigo-200' : 'text-gray-400'}`}>{name}</p>
                    <p className={`text-sm font-bold leading-snug ${isSelected ? 'text-white' : 'text-gray-900'}`}>S${fmt(amounts.SGD ?? 0)}</p>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Recent transactions card */}
      <div className="bg-white rounded-3xl shadow-sm overflow-hidden">
        <div className="px-5 pt-4 pb-3 flex items-center justify-between dark:bg-gray-950">
          <div className="flex items-center gap-2 min-w-0">
            <p className="text-base font-bold text-gray-900 truncate">
              {selectedMember ? `${selectedMember}'s entries` : 'Recent transactions'}
            </p>
            {selectedMember && (
              <button
                onClick={e => { e.stopPropagation(); setSelectedMember(null); }}
                className="w-5 h-5 rounded-full bg-gray-200 flex items-center justify-center text-gray-500 flex-shrink-0"
              >
                <X size={11} />
              </button>
            )}
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            {myPresets.map(preset => {
              const cat = getCategoryById(preset.category);
              return (
                <button
                  key={preset.id}
                  onClick={() => onPresetSave?.(preset)}
                  className="flex items-center gap-1 px-2 py-1 bg-indigo-50 border border-indigo-100 rounded-full text-indigo-700 active:bg-indigo-100 transition-colors"
                >
                  <span className="text-xs">{cat.icon}</span>
                  <span className="text-[11px] font-semibold">{presetButtonText(preset)}</span>
                </button>
              );
            })}
            <button
              onClick={onAdd}
              className="flex items-center gap-1.5 bg-green-900 text-white text-xs font-semibold px-3.5 py-2 rounded-full"
            >
              <Plus size={13} /> Add
            </button>
          </div>
        </div>

        {visibleExpenses.length === 0 ? (
          <div className="px-5 py-10 text-center text-gray-400">
            <p className="text-4xl mb-2">🧾</p>
            <p className="text-sm">{selectedMember ? `No entries by ${selectedMember} this month` : 'No expenses yet this month'}</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-50">
            {visibleExpenses.map(exp => {
              const cat = getCategoryById(exp.category);
              const isINR = exp.currency === 'INR';
              return (
                <button key={exp.id} onClick={() => onEdit?.(exp)} className="w-full px-4 py-3 flex items-center gap-3 text-left active:bg-gray-50 hover:bg-gray-50 transition-colors">
                  <div className="relative w-10 h-10 rounded-xl flex items-center justify-center text-lg flex-shrink-0" style={{ background: cat.bg }}>
                    {cat.icon}
                    {exp.account && accountMap?.[exp.account] && (() => {
                      const brand = getBankBrand(accountMap[exp.account]);
                      return brand.logo ? (
                        <img src={brand.logo} alt={accountMap[exp.account]}
                          className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-white object-contain p-0.5 shadow-sm" />
                      ) : null;
                    })()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-900 truncate">{exp.payee || exp.note || cat.label}</p>
                    <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                      {exp.payee && exp.note ? <span className="text-[11px] text-gray-400 truncate max-w-[120px]">{exp.note}</span> : null}
                      {exp.tags?.length > 0
                        ? exp.tags.slice(0, 2).map(t => (
                            <span key={t} className="text-[11px] px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-600 font-medium">{t}</span>
                          ))
                        : null}
                      <span className="text-[11px] text-gray-400">· {exp.addedByName}</span>
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-sm font-bold text-gray-900">
                      {isINR ? `₹${exp.amount.toFixed(2)}` : `S$${exp.amount.toFixed(2)}`}
                    </p>
                    {isINR && exp.sgdAmount != null && (
                      <p className="text-[10px] text-gray-400">≈ S${exp.sgdAmount.toFixed(2)}</p>
                    )}
                    <p className="text-[11px] text-gray-400">{friendlyDate(exp.date)}</p>
                    {exp.attachment?.url && <p className="text-[10px] text-blue-400 mt-0.5">📎 receipt</p>}
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

/* ── Trends tab ───────────────────────────────────────── */
function TrendsTab({ allExpenses, currentMonth, selectedMonth, onMonthSelect }) {
  // Last 12 months oldest → newest
  const months = useMemo(() => {
    const result = [];
    const [y, m] = currentMonth.split('-').map(Number);
    for (let i = 23; i >= 0; i--) {
      const d = new Date(y, m - 1 - i);
      result.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
    }
    return result;
  }, [currentMonth]);


  const sgdVal = (e) => e.currency === 'SGD' ? e.amount : (e.sgdAmount ?? 0);

  // Monthly totals (all currencies, using sgdAmount for INR)
  const monthlyTotals = useMemo(() => {
    return months.reduce((acc, ym) => {
      acc[ym] = allExpenses
        .filter(e => e.date.startsWith(ym) && e.type !== 'income')
        .reduce((s, e) => s + sgdVal(e), 0);
      return acc;
    }, {});
  }, [allExpenses, months]);

  // Category breakdown for selected month
  const categoryBreakdown = useMemo(() => {
    const map = {};
    allExpenses
      .filter(e => e.date.startsWith(selectedMonth) && e.type !== 'income')
      .forEach(e => { map[e.category] = (map[e.category] ?? 0) + sgdVal(e); });
    return Object.entries(map).sort((a, b) => b[1] - a[1]).map(([id, amount]) => ({ id, amount }));
  }, [allExpenses, selectedMonth]);

  const monthTotal = monthlyTotals[selectedMonth] ?? 0;
  const maxTotal = Math.max(...Object.values(monthlyTotals), 1);
  const barScrollRef = useRef(null);
  const BAR_SLOT = 33;

  // Scroll so the current month bar is visible at the right edge on mount.
  // scrollIntoView is more reliable than setting scrollLeft on Android Chrome.
  useEffect(() => {
    const scroll = () => {
      if (!barScrollRef.current) return;
      const currentBar = barScrollRef.current.querySelector('[data-current="true"]');
      if (currentBar) {
        currentBar.scrollIntoView({ behavior: 'instant', inline: 'end', block: 'nearest' });
      }
    };
    let raf1, raf2;
    raf1 = requestAnimationFrame(() => { raf2 = requestAnimationFrame(scroll); });
    const fallback = setTimeout(scroll, 800);
    return () => {
      cancelAnimationFrame(raf1);
      cancelAnimationFrame(raf2);
      clearTimeout(fallback);
    };
  }, []);

  return (
    <div className="px-4 space-y-3">
      {/* Monthly bar chart */}
      <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
        <div className="px-5 pt-4 pb-2">
          <p className="text-xs text-gray-400 font-medium">Total · {formatMonthFull(selectedMonth)}</p>
          <p className="text-2xl font-bold text-gray-900">S${fmt(monthTotal)}</p>
        </div>

        <div
          ref={barScrollRef}
          className="overflow-x-auto px-3 pb-3"
          style={{ scrollbarWidth: 'none', WebkitOverflowScrolling: 'touch' }}
        >
          <div className="flex items-end gap-1" style={{ minWidth: months.length * BAR_SLOT, height: 150 }}>
            {months.map(ym => {
              const total = monthlyTotals[ym] ?? 0;
              const barH = total > 0 ? Math.max((total / maxTotal) * 100, 10) : 5;
              const isSelected = ym === selectedMonth;
              return (
                <button
                  key={ym}
                  data-current={ym === currentMonth ? 'true' : undefined}
                  onClick={() => onMonthSelect(ym)}
                  className="flex flex-col items-center justify-end flex-shrink-0 rounded-lg transition-colors"
                  style={{ width: 29, height: 140, paddingBottom: 4, background: isSelected ? '#e5e7eb' : 'transparent' }}
                >
                  <p className="text-[8px] font-semibold mb-1" style={{ color: total > 0 ? '#374151' : '#d1d5db' }}>
                    {total > 0 ? fmtK(total) : '—'}
                  </p>
                  <div
                    className="w-3.5 rounded-t-md transition-all"
                    style={{ height: barH, background: isSelected ? '#4F46E5' : total > 0 ? '#a5b4fc' : '#e5e7eb' }}
                  />
                  <p className="text-[10px] mt-1 font-medium" style={{ color: isSelected ? '#374151' : '#9ca3af' }}>
                    {shortMonth(ym)}
                  </p>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Category breakdown */}
      {categoryBreakdown.length > 0 ? (
        <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
          <div className="px-5 pt-4 pb-2">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">
              {formatMonthFull(selectedMonth)} · by category
            </p>
          </div>
          <div className="divide-y divide-gray-50">
            {categoryBreakdown.map(({ id, amount }) => {
              const cat = getCategoryById(id);
              const pct = monthTotal > 0 ? (amount / monthTotal) * 100 : 0;
              return (
                <div key={id} className="px-4 py-3 flex items-center gap-3">
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center text-xl flex-shrink-0"
                    style={{ background: cat.bg }}
                  >
                    {cat.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-800">{cat.label}</p>
                    <div className="h-1.5 bg-gray-100 rounded-full mt-1.5 overflow-hidden">
                      <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: cat.color }} />
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-sm font-bold text-gray-900">S${fmt(amount)}</p>
                    <p className="text-xs text-gray-400">{pct.toFixed(0)}%</p>
                  </div>
                </div>
              );
            })}
          </div>
          <div className="h-3" />
        </div>
      ) : (
        <div className="bg-white rounded-2xl shadow-sm p-10 text-center text-gray-400">
          <p className="text-3xl mb-2">📊</p>
          <p className="text-sm">No data for {formatMonthFull(selectedMonth)}</p>
        </div>
      )}
    </div>
  );
}

/* ── Categories tab ───────────────────────────────────── */
function CategoriesTab({ categoryTotals, budget, categorySettings, onSelect }) {
  if (categoryTotals.length === 0) {
    return (
      <div className="px-4">
        <div className="bg-white rounded-2xl shadow-sm p-10 text-center text-gray-400">
          <p className="text-4xl mb-2">🥧</p>
          <p className="text-sm">No expenses yet</p>
        </div>
      </div>
    );
  }

  const total = categoryTotals.reduce((s, c) => s + c.amount, 0);
  // Build budget map from categorySettings
  const budgetMap = {};
  (categorySettings ?? []).forEach(c => { if (c.budget > 0) budgetMap[c.id] = c.budget; });

  return (
    <div className="px-4">
      <div className="bg-white rounded-2xl shadow-sm overflow-hidden divide-y divide-gray-50">
        {categoryTotals.map(({ id, amount }) => {
          const cat = getCategoryById(id);
          const catBudget = budgetMap[id] ?? 0;
          const hasBudget = catBudget > 0;
          // Ring shows budget usage if budget set, else share of total
          const ringPct = hasBudget ? Math.min((amount / catBudget) * 100, 100) : (total > 0 ? (amount / total) * 100 : 0);
          const overBudget = hasBudget && amount > catBudget;
          const r = 18;
          const circ = 2 * Math.PI * r;
          const ringOffset = circ * (1 - ringPct / 100);

          return (
            <button key={id} onClick={() => onSelect?.(id)} className="w-full px-4 py-3.5 flex items-center gap-3 text-left active:bg-gray-50 hover:bg-gray-50 transition-colors">
              {/* Mini ring */}
              <div className="relative w-12 h-12 flex-shrink-0">
                <svg className="w-full h-full -rotate-90" viewBox="0 0 48 48">
                  <circle cx="24" cy="24" r={r} fill="none" stroke="#e5e7eb" strokeWidth="5" />
                  <circle
                    cx="24" cy="24" r={r}
                    fill="none"
                    stroke={overBudget ? '#ef4444' : cat.color}
                    strokeWidth="5"
                    strokeLinecap="round"
                    strokeDasharray={circ}
                    strokeDashoffset={ringOffset}
                  />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center text-lg">{cat.icon}</div>
              </div>

              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-gray-800">{cat.label}</p>
                {hasBudget ? (
                  <div>
                    <div className="flex items-center justify-between mt-1">
                      <p className="text-[10px] text-gray-400">Budget: <span className="font-semibold text-gray-600">S${fmt(catBudget)}</span></p>
                      <p className="text-[10px]" style={{ color: overBudget ? '#ef4444' : '#9ca3af' }}>
                        {overBudget ? `Over S${fmt(amount - catBudget)}` : `S${fmt(catBudget - amount)} left`}
                      </p>
                    </div>
                    <div className="h-1.5 bg-gray-100 rounded-full mt-1 overflow-hidden">
                      <div className="h-full rounded-full transition-all" style={{ width: `${ringPct}%`, background: overBudget ? '#ef4444' : cat.color }} />
                    </div>
                  </div>
                ) : (
                  <div className="h-1.5 bg-gray-100 rounded-full mt-1.5 overflow-hidden">
                    <div className="h-full rounded-full" style={{ width: `${ringPct}%`, background: cat.color }} />
                  </div>
                )}
              </div>

              <div className="text-right flex-shrink-0 flex items-center gap-1">
                <div>
                  <p className={`text-sm font-bold ${overBudget ? 'text-red-500' : 'text-gray-900'}`}>S${fmt(amount)}</p>
                  {hasBudget
                    ? <p className="text-[10px] text-gray-400">{ringPct.toFixed(0)}% used</p>
                    : <p className="text-xs text-gray-400">{(total > 0 ? (amount / total) * 100 : 0).toFixed(0)}%</p>
                  }
                </div>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2"><path d="m9 18 6-6-6-6"/></svg>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* ── Avatar image with initials fallback ─────────────── */
function AvatarImg({ name, size = 11 }) {
  const src = AVATARS[name];
  const initial = (name ?? 'U')[0].toUpperCase();
  const cls = `w-${size} h-${size} rounded-full flex-shrink-0 object-cover`;
  if (src) {
    return <img src={src} alt={name} className={cls} />;
  }
  return (
    <div className={`w-${size} h-${size} rounded-full bg-green-800 flex items-center justify-center text-white font-bold flex-shrink-0`} style={{ fontSize: size <= 8 ? 12 : 16 }}>
      {initial}
    </div>
  );
}

/* ── Helpers ──────────────────────────────────────────── */
function fmt(n) {
  return Number(n).toLocaleString('en-SG', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function fmtCompact(n) {
  if (n >= 1000) return (n / 1000).toFixed(1) + 'k';
  return Number(n).toFixed(0);
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
  return new Date(y, m - 1).toLocaleString('en-SG', { month: 'long' });
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
