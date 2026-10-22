import { useState, useRef, useEffect } from 'react';
import { X, ChevronDown, Camera, Image, Tag, Loader2, RefreshCw } from 'lucide-react';
import { CATEGORIES, CURRENCIES, ACCOUNTS, DEFAULT_TAGS, CLOUDINARY_CLOUD, CLOUDINARY_PRESET, AVATARS } from '../constants';
import { useExchangeRate } from '../hooks/useExchangeRate';
import BankBadge from './BankBadge';
import { saveReceiptBlob, getReceiptBlob, deleteReceiptBlob } from '../utils/receiptDb';
import { runOCR } from '../hooks/useOCR';

export default function ExpenseModal({ expense, onSave, onAutoSave, onClose, onDelete, profile, availableTags, availableAccounts, readOnly, allowAddForOthers, otherMembers }) {
  const editing = !!expense;
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [saveStatus, setSaveStatus] = useState(null); // null | 'saving' | 'saved'
  const didMountRef = useRef(false);
  // proxyUser: null = adding for self, { uid, displayName } = adding for another member
  const [proxyUser, setProxyUser] = useState(null);

  const [type,       setType]       = useState(expense?.type     ?? 'expense');
  const [borrowing,  setBorrowing]  = useState(expense?.type === 'investment' && (expense?.amount ?? 0) < 0);
  const [platform,   setPlatform]   = useState(expense?.platform  ?? '');
  const [amount,     setAmount]     = useState(expense?.amount !== undefined ? Math.abs(expense.amount) : '');
  const [currency,   setCurrency]   = useState(expense?.currency ?? 'SGD');
  const [category,   setCategory]   = useState(expense?.category ?? 'transport');
  const [account,    setAccount]    = useState(() => {
    if (expense?.account) return expense.account;
    const src = availableAccounts ?? ACCOUNTS;
    const name = profile?.displayName ?? '';
    const list = src[name] ?? Object.values(src).flat();
    return list.find(a => a.label.toLowerCase().includes('dbs'))?.id ?? list[0]?.id ?? '';
  });
  const [payee,      setPayee]      = useState(expense?.payee    ?? '');
  const [tags,       setTags]       = useState(expense?.tags     ?? []);
  const [note,       setNote]       = useState(expense?.note     ?? '');
  const [date,       setDate]       = useState(expense?.date     ?? today());
  const [attachment,   setAttachment]   = useState(expense?.attachment ?? null); // { url, name } or { url, name, receiptId, pending }
  const [uploading,    setUploading]    = useState(false);
  const [localBlobUrl, setLocalBlobUrl] = useState(null);
  const [errors,       setErrors]       = useState({});
  const [ocrState,  setOcrState]  = useState(null);   // null | 'scanning' | 'done'
  const [ocrResult, setOcrResult] = useState(null);   // { shopName, amount, currency, accountId, items, category }

  const cameraRef = useRef();
  const galleryRef = useRef();
  const { inrToSgd, rateLabel, offline } = useExchangeRate();

  // Intercept Android/browser back button — close modal instead of navigating away
  useEffect(() => {
    history.pushState({ flModal: true }, '');
    const handlePop = () => onClose();
    window.addEventListener('popstate', handlePop);
    return () => {
      window.removeEventListener('popstate', handlePop);
      // If modal was closed via button (not back), clean up the pushed history entry
      if (history.state?.flModal) history.back();
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Load blob from IndexedDB when viewing a pending attachment from a previous session
  useEffect(() => {
    if (!expense?.attachment?.pending || !expense.attachment.receiptId) return;
    let blobUrl = null;
    getReceiptBlob(expense.attachment.receiptId).then(blob => {
      if (blob) { blobUrl = URL.createObjectURL(blob); setLocalBlobUrl(blobUrl); }
    }).catch(() => {});
    return () => { if (blobUrl) URL.revokeObjectURL(blobUrl); };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-save debounce when editing
  useEffect(() => {
    if (!didMountRef.current) { didMountRef.current = true; return; }
    if (!editing || readOnly || !onAutoSave) return;

    setSaveStatus('saving');
    const timer = setTimeout(() => {
      if (!amount || isNaN(Number(amount)) || Math.abs(Number(amount)) <= 0) { setSaveStatus(null); return; }
      if (type === 'expense' && !category) { setSaveStatus(null); return; }
      if (!account || !date) { setSaveStatus(null); return; }

      const parsedAmount = parseFloat(Number(amount).toFixed(2));
      const signedAmount = type === 'investment' && borrowing ? -parsedAmount : parsedAmount;
      onAutoSave({
        type,
        amount:    signedAmount,
        currency,
        sgdAmount: currency === 'SGD' ? signedAmount : (inrToSgd(signedAmount) ?? null),
        category:  type === 'income' || type === 'investment' ? 'other' : category,
        platform:  type === 'investment' ? platform.trim() : undefined,
        account:   account || null,
        payee:     payee.trim(),
        tags,
        note:      note.trim(),
        date,
        attachment: attachment ?? null,
      });
      setSaveStatus('saved');
      setTimeout(() => setSaveStatus(null), 3000);
    }, 700);
    return () => clearTimeout(timer);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [type, borrowing, amount, currency, category, account, payee, tags, note, date, attachment]);

  // Accounts filtered to the active user (self or proxy)
  const accountsSource = availableAccounts ?? ACCOUNTS;
  const userName = proxyUser ? proxyUser.displayName : (profile?.displayName ?? '');
  const userAccounts = accountsSource[userName] ?? Object.values(accountsSource).flat();

  // Tags list (use passed-in tags or fall back to defaults)
  const tagList = availableTags ?? DEFAULT_TAGS;

  function validate() {
    const e = {};
    if (!amount || isNaN(Number(amount)) || Math.abs(Number(amount)) <= 0) e.amount = 'Enter a valid amount';
    if (type === 'expense' && !category) e.category = 'Select a category';
    if (type === 'investment' && !platform.trim()) e.platform = borrowing ? 'Enter source / person name' : 'Enter platform / fund name';
    if (!account) e.account = 'Select a payment account';
    if (!date) e.date = 'Select a date';
    return e;
  }

  const submit = (e) => {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length) { setErrors(errs); return; }
    const parsedAmount = parseFloat(Number(amount).toFixed(2));
    const signedAmount = type === 'investment' && borrowing ? -parsedAmount : parsedAmount;
    const payload = {
      type,
      amount:      signedAmount,
      currency,
      sgdAmount:   currency === 'SGD' ? signedAmount : (inrToSgd(signedAmount) ?? null),
      category:    type === 'income' || type === 'investment' ? 'other' : category,
      platform:    type === 'investment' ? platform.trim() : undefined,
      account:     account || null,
      payee:       payee.trim(),
      tags,
      note:        note.trim(),
      date,
      attachment:  attachment ?? null,
    };
    // Proxy entry: attribute to the selected other member
    if (proxyUser) {
      payload.addedBy = proxyUser.uid;
      payload.addedByName = proxyUser.displayName;
    }
    onSave(payload);
  };

  const handleFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    // Save to IndexedDB first so the photo is never lost offline
    const receiptId = `r_${Date.now()}`;
    await saveReceiptBlob(receiptId, file);
    const blobUrl = URL.createObjectURL(file);
    setAttachment({ url: blobUrl, name: file.name, receiptId, pending: true });
    // Kick off OCR in parallel — result fills the multi-field suggestion card
    setOcrState('scanning');
    setOcrResult(null);
    runOCR(file, accountsSource)
      .then(result => {
        const hasAny = result.shopName || result.amount || result.accountId || result.items || result.category || result.date;
        setOcrResult(hasAny ? result : null);
        setOcrState(hasAny ? 'done' : null);
      })
      .catch(() => setOcrState(null));
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('upload_preset', CLOUDINARY_PRESET);
      const res = await fetch(`https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD}/image/upload`, { method: 'POST', body: fd });
      const data = await res.json();
      if (data.secure_url) {
        // Upload succeeded — swap in Cloudinary URL and clean up local blob
        await deleteReceiptBlob(receiptId);
        URL.revokeObjectURL(blobUrl);
        setAttachment({ url: data.secure_url, name: file.name });
      }
      // If no secure_url (server error), keep the pending local copy
    } catch {
      // Network offline — the pending local copy stays until next online retry
    } finally {
      setUploading(false);
    }
  };

  const toggleTag = (t) => {
    setTags(prev => prev.includes(t) ? prev.filter(x => x !== t) : [...prev, t]);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />

      <div className="relative bg-white w-full sm:max-w-md rounded-t-3xl sm:rounded-2xl shadow-2xl z-10 max-h-[92vh] overflow-y-auto">
        {/* Handle bar */}
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 rounded-full bg-gray-200" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-2 pb-3 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <h2 className="font-bold text-gray-900 text-base">
              {editing ? (readOnly ? 'View Entry' : 'Edit Entry') : 'Add Entry'}
            </h2>
            {readOnly && (
              <span className="text-[10px] font-semibold bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">View only</span>
            )}
            {saveStatus === 'saving' && <span className="text-[11px] text-gray-400">Saving…</span>}
            {saveStatus === 'saved'  && <span className="text-[11px] text-green-600 font-semibold">✓ Saved</span>}
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={submit} className="px-5 py-4 space-y-4">

          {/* Proxy user picker */}
          {allowAddForOthers && !editing && otherMembers.length > 0 && (
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Adding for</label>
              <div className="flex gap-3">
                <button type="button" onClick={() => { setProxyUser(null); setAccount(''); }}
                  className={`flex flex-col items-center gap-1 ${!proxyUser ? 'opacity-100' : 'opacity-50'}`}>
                  <img src={AVATARS[profile?.displayName] || ''} alt={profile?.displayName}
                    className={`w-12 h-12 rounded-full object-cover border-2 ${!proxyUser ? 'border-indigo-500' : 'border-gray-200'}`} />
                  <span className="text-[10px] text-gray-600 font-medium">{profile?.displayName}</span>
                </button>
                {otherMembers.map(m => (
                  <button key={m.uid} type="button" onClick={() => { setProxyUser(m); setAccount(''); }}
                    className={`flex flex-col items-center gap-1 ${proxyUser?.uid === m.uid ? 'opacity-100' : 'opacity-50'}`}>
                    <img src={AVATARS[m.displayName] || ''} alt={m.displayName}
                      className={`w-12 h-12 rounded-full object-cover border-2 ${proxyUser?.uid === m.uid ? 'border-indigo-500' : 'border-gray-200'}`} />
                    <span className="text-[10px] text-gray-600 font-medium">{m.displayName}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Type toggle */}
          <div className="flex bg-gray-100 rounded-xl p-1 gap-1">
            {[
              { value: 'expense',    label: '↑ Expense',    active: 'bg-red-500 text-white' },
              { value: 'income',     label: '↓ Income',     active: 'bg-green-600 text-white' },
              { value: 'investment', label: '📈 Invest',    active: 'bg-violet-600 text-white' },
            ].map(t => (
              <button
                key={t.value}
                type="button"
                onClick={() => { if (!readOnly) { setType(t.value); if (t.value !== 'investment') setBorrowing(false); } }}
                disabled={readOnly}
                className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-all ${
                  type === t.value ? t.active : 'text-gray-500'
                } ${readOnly ? 'cursor-default' : ''}`}
              >
                {t.label}
              </button>
            ))}
          </div>

          {/* Invested / Borrowed sub-toggle — only when investment type selected */}
          {type === 'investment' && (
            <div className="flex bg-violet-50 rounded-xl p-1 gap-1">
              <button
                type="button"
                onClick={() => !readOnly && setBorrowing(false)}
                disabled={readOnly}
                className={`flex-1 py-1.5 rounded-lg text-xs font-semibold transition-all ${!borrowing ? 'bg-violet-600 text-white shadow-sm' : 'text-violet-400'}`}
              >
                📈 Invested
              </button>
              <button
                type="button"
                onClick={() => !readOnly && setBorrowing(true)}
                disabled={readOnly}
                className={`flex-1 py-1.5 rounded-lg text-xs font-semibold transition-all ${borrowing ? 'bg-orange-500 text-white shadow-sm' : 'text-violet-400'}`}
              >
                💸 Borrowed
              </button>
            </div>
          )}

          {/* Amount + Currency + Account (bank logos on the right) */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Amount <span className="text-red-400">*</span></label>
            <div className="flex gap-2 items-start">
              {/* Currency + amount */}
              <div className="flex gap-2 flex-1 min-w-0">
                <div className="relative flex-shrink-0">
                  <select
                    value={currency}
                    onChange={e => !readOnly && setCurrency(e.target.value)}
                    disabled={readOnly}
                    className="appearance-none bg-gray-100 border-0 rounded-xl pl-3 pr-7 py-3 text-sm font-semibold text-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-400"
                  >
                    {CURRENCIES.map(c => (
                      <option key={c.code} value={c.code}>{c.code}</option>
                    ))}
                  </select>
                  <ChevronDown size={13} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                </div>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  value={amount}
                  onChange={e => !readOnly && setAmount(e.target.value)}
                  readOnly={readOnly}
                  placeholder="0.00"
                  className={`flex-1 min-w-0 border rounded-xl px-3 py-3 text-2xl font-bold focus:outline-none focus:ring-2 focus:ring-indigo-400 ${errors.amount ? 'border-red-400' : 'border-gray-200'} ${readOnly ? 'bg-gray-50 text-gray-600' : ''}`}
                />
              </div>

              {/* Bank logo tiles — 1 col for ≤2, 2-col grid for 3+ */}
              <div className={`grid gap-1 flex-shrink-0 content-start ${userAccounts.length > 2 ? 'grid-cols-2' : 'grid-cols-1'} ${errors.account ? 'ring-2 ring-red-300 rounded-xl p-1' : ''}`}>
                {userAccounts.map(acc => (
                  <button
                    key={acc.id}
                    type="button"
                    onClick={() => { if (!readOnly) { setAccount(acc.id); setErrors(e => ({ ...e, account: undefined })); } }}
                    disabled={readOnly}
                    className={`flex items-center justify-center w-14 h-7 rounded-lg border-2 transition-all overflow-hidden ${
                      account === acc.id
                        ? 'border-indigo-500 bg-indigo-50'
                        : 'border-gray-200 bg-gray-50 opacity-50 hover:opacity-80'
                    }`}
                  >
                    <BankBadge label={acc.label} size="sm" />
                  </button>
                ))}
              </div>
            </div>
            {errors.amount && <p className="text-xs text-red-500 mt-1">{errors.amount}</p>}
            {errors.account && <p className="text-xs text-red-500 mt-1">{errors.account}</p>}

            {/* Live INR → SGD conversion */}
            {currency === 'INR' && (
              <div className={`mt-2 px-3 py-2 rounded-xl text-xs flex items-center gap-2 ${offline ? 'bg-amber-50 text-amber-700' : 'bg-indigo-50 text-indigo-700'}`}>
                {offline && <RefreshCw size={11} className="flex-shrink-0" />}
                {amount && !isNaN(Number(amount)) && Number(amount) > 0 && inrToSgd(Number(amount)) ? (
                  <span>≈ <strong>S${inrToSgd(Number(amount)).toFixed(2)}</strong> SGD</span>
                ) : (
                  <span>Enter amount to see SGD equivalent</span>
                )}
                {rateLabel && <span className="ml-auto text-[10px] opacity-60 flex-shrink-0">{rateLabel}</span>}
                {!rateLabel && <span className="ml-auto text-[10px] opacity-60">fetching rate…</span>}
              </div>
            )}
          </div>

          {/* Category — only for expenses */}
          {type === 'expense' && (
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                Category <span className="text-red-400">*</span>
              </label>
              <div
                className={`flex gap-2 overflow-x-auto pb-1 ${errors.category ? 'ring-2 ring-red-300 rounded-xl p-1' : ''}`}
                style={{ scrollbarWidth: 'none' }}
              >
                {CATEGORIES.map(cat => (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => !readOnly && (setCategory(cat.id), setErrors(e => ({ ...e, category: undefined })))}
                    className={`flex-shrink-0 flex flex-col items-center gap-1 w-14 py-2 rounded-xl border-2 transition-all ${
                      category === cat.id
                        ? 'border-indigo-500 bg-indigo-50'
                        : 'border-gray-100 bg-gray-50 hover:border-gray-200'
                    }`}
                  >
                    <span className="text-lg">{cat.icon}</span>
                    <span className="leading-tight text-center text-gray-600 font-medium" style={{ fontSize: '9px' }}>
                      {cat.label.split(' ')[0]}
                    </span>
                  </button>
                ))}
              </div>
              {errors.category && <p className="text-xs text-red-500 mt-1">{errors.category}</p>}
            </div>
          )}

          {/* Platform / Source — only for investments */}
          {type === 'investment' && (
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
                {borrowing ? 'Source / Person' : 'Platform / Fund'} <span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                value={platform}
                onChange={e => !readOnly && (setPlatform(e.target.value), setErrors(er => ({ ...er, platform: undefined })))}
                readOnly={readOnly}
                placeholder={borrowing ? 'e.g. Friend Ali, Bank loan, Family' : 'e.g. Groww SIP, Zerodha, SBI FD, PPF'}
                maxLength={60}
                className={`w-full border rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 ${borrowing ? 'focus:ring-orange-400' : 'focus:ring-violet-400'} ${errors.platform ? 'border-red-300' : 'border-gray-200'} ${readOnly ? 'bg-gray-50 text-gray-600' : ''}`}
              />
              {errors.platform && <p className="text-xs text-red-500 mt-1">{errors.platform}</p>}
            </div>
          )}

          {/* Payee */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
              Shop / Payee <span className="text-gray-300 normal-case font-normal">(optional)</span>
            </label>
            <input
              type="text"
              value={payee}
              onChange={e => !readOnly && setPayee(e.target.value)}
              readOnly={readOnly}
              placeholder="e.g. Sheng Siong, Canteen, Singtel"
              maxLength={60}
              className={`w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 ${readOnly ? 'bg-gray-50 text-gray-600' : ''}`}
            />
          </div>

          {/* Note */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
              Items / Notes <span className="text-gray-300 normal-case font-normal">(optional)</span>
            </label>
            <input
              type="text"
              value={note}
              onChange={e => !readOnly && setNote(e.target.value)}
              readOnly={readOnly}
              placeholder="e.g. rice, ckn, banana, oats…"
              maxLength={120}
              className={`w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 ${readOnly ? 'bg-gray-50 text-gray-600' : ''}`}
            />

            {/* OCR scanning indicator */}
            {ocrState === 'scanning' && (
              <div className="mt-2 flex items-center gap-2 px-3 py-2 bg-indigo-50 rounded-xl text-xs text-indigo-600">
                <Loader2 size={12} className="animate-spin flex-shrink-0" />
                <span>Scanning receipt…</span>
              </div>
            )}

            {/* OCR multi-field suggestion card */}
            {ocrState === 'done' && ocrResult && (
              <div className="mt-2 px-3 py-2.5 bg-indigo-50 border border-indigo-100 rounded-xl">
                <p className="text-[11px] text-indigo-500 font-semibold uppercase tracking-wide mb-2">Detected from receipt</p>
                <div className="space-y-1.5">
                  {ocrResult.shopName && (
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] text-gray-400 w-12 flex-shrink-0">Shop</span>
                      <span className="text-xs text-gray-800 flex-1 truncate font-medium">{ocrResult.shopName}</span>
                      <button type="button" onClick={() => setPayee(ocrResult.shopName)}
                        className="text-[10px] px-2 py-0.5 bg-indigo-600 text-white rounded-full flex-shrink-0">Use</button>
                    </div>
                  )}
                  {ocrResult.date && (
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] text-gray-400 w-12 flex-shrink-0">Date</span>
                      <span className="text-xs text-gray-800 flex-1 font-medium">{ocrResult.date}</span>
                      <button type="button" onClick={() => setDate(ocrResult.date)}
                        className="text-[10px] px-2 py-0.5 bg-indigo-600 text-white rounded-full flex-shrink-0">Use</button>
                    </div>
                  )}
                  {ocrResult.amount && (
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] text-gray-400 w-12 flex-shrink-0">Amount</span>
                      <span className="text-xs text-gray-800 flex-1 font-medium">
                        {ocrResult.currency === 'INR' ? '₹' : 'S$'}{ocrResult.amount.toFixed(2)}
                      </span>
                      <button type="button" onClick={() => { setAmount(String(ocrResult.amount)); if (ocrResult.currency) setCurrency(ocrResult.currency); }}
                        className="text-[10px] px-2 py-0.5 bg-indigo-600 text-white rounded-full flex-shrink-0">Use</button>
                    </div>
                  )}
                  {ocrResult.category && type === 'expense' && (() => {
                    const cat = CATEGORIES.find(c => c.id === ocrResult.category);
                    return (
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] text-gray-400 w-12 flex-shrink-0">Category</span>
                        <span className="text-xs text-gray-800 flex-1 truncate font-medium">{cat.icon} {cat.label}</span>
                        <button type="button" onClick={() => { setCategory(cat.id); setErrors(e => ({ ...e, category: undefined })); }}
                          className="text-[10px] px-2 py-0.5 bg-indigo-600 text-white rounded-full flex-shrink-0">Use</button>
                      </div>
                    );
                  })()}
                  {ocrResult.accountId && (
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] text-gray-400 w-12 flex-shrink-0">Card</span>
                      <span className="text-xs text-gray-800 flex-1 font-medium">
                        {userAccounts.find(a => a.id === ocrResult.accountId)?.label ?? ocrResult.accountId}
                      </span>
                      <button type="button" onClick={() => setAccount(ocrResult.accountId)}
                        className="text-[10px] px-2 py-0.5 bg-indigo-600 text-white rounded-full flex-shrink-0">Use</button>
                    </div>
                  )}
                  {ocrResult.items && (
                    <div className="flex items-start gap-2">
                      <span className="text-[11px] text-gray-400 w-12 flex-shrink-0 pt-0.5">Items</span>
                      <span className="text-xs text-gray-700 flex-1 leading-relaxed">{ocrResult.items}</span>
                      <button type="button" onClick={() => setNote(ocrResult.items)}
                        className="text-[10px] px-2 py-0.5 bg-indigo-600 text-white rounded-full flex-shrink-0 mt-0.5">Use</button>
                    </div>
                  )}
                </div>
                <div className="flex gap-2 mt-3">
                  <button
                    type="button"
                    onClick={() => {
                      if (ocrResult.shopName)  setPayee(ocrResult.shopName);
                      if (ocrResult.amount)    { setAmount(String(ocrResult.amount)); if (ocrResult.currency) setCurrency(ocrResult.currency); }
                      if (ocrResult.date)      setDate(ocrResult.date);
                      if (ocrResult.accountId) setAccount(ocrResult.accountId);
                      if (ocrResult.items)     setNote(ocrResult.items);
                      if (ocrResult.category && type === 'expense') { setCategory(ocrResult.category); setErrors(e => ({ ...e, category: undefined })); }
                      setOcrState(null);
                    }}
                    className="flex-1 py-1.5 rounded-lg bg-indigo-600 text-white text-xs font-semibold"
                  >
                    Apply all
                  </button>
                  <button type="button" onClick={() => setOcrState(null)}
                    className="px-3 py-1.5 rounded-lg border border-gray-200 text-gray-500 text-xs">
                    Dismiss
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Tags */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
              <Tag size={12} className="inline mr-1" />Tags
            </label>
            <div className="flex flex-wrap gap-2">
              {tagList.map(t => (
                <button
                  key={t}
                  type="button"
                  onClick={() => toggleTag(t)}
                  className={`px-3 py-1 rounded-full text-xs font-semibold border transition-all ${
                    tags.includes(t)
                      ? 'bg-indigo-600 text-white border-indigo-600'
                      : 'bg-white text-gray-500 border-gray-200 hover:border-gray-300'
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>

          {/* Date */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Date</label>
            <input
              type="date"
              value={date}
              onChange={e => !readOnly && setDate(e.target.value)}
              readOnly={readOnly}
              max={today()}
              className={`w-full border rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 ${errors.date ? 'border-red-400' : 'border-gray-200'} ${readOnly ? 'bg-gray-50 text-gray-600' : ''}`}
            />
          </div>

          {/* Bill Attachment */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
              Bill Attachment <span className="text-gray-300 normal-case font-normal">(optional)</span>
            </label>

            {attachment ? (
              <div className="flex items-center gap-3 p-3 bg-green-50 border border-green-200 rounded-xl">
                <img
                  src={localBlobUrl || attachment.url}
                  alt="Bill"
                  className="w-14 h-14 rounded-lg object-cover border border-green-100 flex-shrink-0"
                />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-green-800 truncate">{attachment.name || 'Bill photo'}</p>
                  {uploading ? (
                    <span className="flex items-center gap-1 text-xs text-indigo-500">
                      <Loader2 size={11} className="animate-spin" /> Uploading…
                    </span>
                  ) : attachment.pending ? (
                    <span className="text-xs text-amber-600">📶 Saved offline</span>
                  ) : (
                    <a href={attachment.url} target="_blank" rel="noreferrer" className="text-xs text-indigo-500 underline">View full</a>
                  )}
                </div>
                {!uploading && (
                  <button type="button" onClick={() => setAttachment(null)} className="text-red-400 hover:text-red-600">
                    <X size={16} />
                  </button>
                )}
              </div>
            ) : uploading ? (
              <div className="flex items-center justify-center gap-2 p-4 bg-gray-50 border-2 border-dashed border-gray-200 rounded-xl">
                <Loader2 size={18} className="animate-spin text-indigo-500" />
                <span className="text-sm text-gray-500">Uploading…</span>
              </div>
            ) : (
              <div className="flex gap-2">
                {/* Camera — capture from device camera */}
                <button
                  type="button"
                  onClick={() => cameraRef.current?.click()}
                  className="flex-1 flex flex-col items-center gap-1.5 py-3 bg-gray-50 border-2 border-dashed border-gray-200 rounded-xl hover:border-indigo-300 hover:bg-indigo-50 transition-all text-gray-500 hover:text-indigo-600"
                >
                  <Camera size={20} />
                  <span className="text-xs font-medium">Camera</span>
                </button>

                {/* Gallery — pick from file system */}
                <button
                  type="button"
                  onClick={() => galleryRef.current?.click()}
                  className="flex-1 flex flex-col items-center gap-1.5 py-3 bg-gray-50 border-2 border-dashed border-gray-200 rounded-xl hover:border-indigo-300 hover:bg-indigo-50 transition-all text-gray-500 hover:text-indigo-600"
                >
                  <Image size={20} />
                  <span className="text-xs font-medium">Gallery</span>
                </button>
              </div>
            )}

            {/* Hidden file inputs */}
            <input ref={cameraRef}  type="file" accept="image/*" capture="environment" className="hidden" onChange={handleFile} />
            <input ref={galleryRef} type="file" accept="image/*"                        className="hidden" onChange={handleFile} />
          </div>

          {readOnly ? (
            <button
              type="button"
              onClick={onClose}
              className="w-full bg-gray-100 text-gray-700 font-bold rounded-xl py-3.5 text-sm"
            >
              Close
            </button>
          ) : (
            <>
              {editing && onAutoSave ? (
                <button
                  type="button"
                  onClick={onClose}
                  className="w-full bg-gray-100 text-gray-700 font-bold rounded-xl py-3.5 text-sm hover:bg-gray-200 transition-colors"
                >
                  Done
                </button>
              ) : (
                <button
                  type="submit"
                  className={`w-full text-white font-bold rounded-xl py-3.5 text-sm transition-colors ${
                    type === 'income' ? 'bg-green-600 hover:bg-green-700'
                    : type === 'investment' && borrowing ? 'bg-orange-500 hover:bg-orange-600'
                    : type === 'investment' ? 'bg-violet-600 hover:bg-violet-700'
                    : 'bg-indigo-600 hover:bg-indigo-700'
                  }`}
                >
                  {editing ? 'Save Changes' : type === 'income' ? '+ Add Income' : type === 'investment' && borrowing ? '💸 Log Borrowing' : type === 'investment' ? '📈 Log Investment' : '+ Add Expense'}
                </button>
              )}

              {/* Delete — only in edit mode */}
              {editing && onDelete && (
                confirmDelete ? (
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setConfirmDelete(false)}
                      className="flex-1 py-3 rounded-xl border border-gray-200 text-sm font-semibold text-gray-600"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={() => { onDelete(expense.id); onClose(); }}
                      className="flex-1 py-3 rounded-xl bg-red-500 text-white text-sm font-bold"
                    >
                      Yes, Delete
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setConfirmDelete(true)}
                    className="w-full py-3 rounded-xl text-red-500 text-sm font-semibold border border-red-100 hover:bg-red-50 transition-colors"
                  >
                    Delete this entry
                  </button>
                )
              )}
            </>
          )}
        </form>
      </div>
    </div>
  );
}

function today() {
  return new Date().toISOString().split('T')[0];
}
