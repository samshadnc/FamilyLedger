import { useState } from 'react';
import { ChevronLeft, X, Plus, Check, LogOut, Moon, Sun } from 'lucide-react';
import { AVATARS, CATEGORIES, DEFAULT_PRESETS, getCategoryById } from '../constants';

function AvatarImg({ name, size = 14 }) {
  const src = AVATARS[name];
  if (src) return <img src={src} alt={name} className={`w-${size} h-${size} rounded-full object-cover`} />;
  const initials = (name ?? 'U').split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
  return (
    <div className={`w-${size} h-${size} rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700 font-bold text-lg`}>
      {initials}
    </div>
  );
}

export default function Settings({ settings, onSave, onBack, dark, onToggleDark, profile, onLogout, isDemo }) {
  const [newTag, setNewTag] = useState('');
  const [showAddTag, setShowAddTag] = useState(false);
  const [showAddAccount, setShowAddAccount] = useState(null); // person name or null
  const [newAccountLabel, setNewAccountLabel] = useState('');
  const [editingCategory, setEditingCategory] = useState(null); // { id, label, icon }
  const [showAddPreset, setShowAddPreset] = useState(false);
  const [newPreset, setNewPreset] = useState({ name: '', amount: '', category: 'transport' });
  const [localBudget, setLocalBudget] = useState(settings.monthlyBudget ?? 5000);

  const members = Object.keys(settings.accounts ?? {});

  // ── Tags ──────────────────────────────────────────────
  const deleteTag = (tag) => {
    onSave({ ...settings, tags: settings.tags.filter(t => t !== tag) });
  };

  const addTag = () => {
    const t = newTag.trim();
    if (!t) { setNewTag(''); setShowAddTag(false); return; }
    if (settings.tags.includes(t)) { setNewTag(''); setShowAddTag(false); return; }
    onSave({ ...settings, tags: [...settings.tags, t] });
    setNewTag('');
    setShowAddTag(false);
  };

  // ── Accounts ──────────────────────────────────────────
  const deleteAccount = (person, accId) => {
    const updated = { ...settings.accounts };
    updated[person] = updated[person].filter(a => a.id !== accId);
    onSave({ ...settings, accounts: updated });
  };

  const addAccount = (person) => {
    const label = newAccountLabel.trim();
    if (!label) { setNewAccountLabel(''); setShowAddAccount(null); return; }
    const isCard = /scapia|credit|card/i.test(label);
    const icon = isCard ? '💳' : '🏦';
    const id = `${person.toLowerCase()}_${label.toLowerCase().replace(/\s+/g, '_')}_${Date.now()}`;
    const updated = { ...settings.accounts };
    updated[person] = [...(updated[person] ?? []), { id, label, icon }];
    onSave({ ...settings, accounts: updated });
    setNewAccountLabel('');
    setShowAddAccount(null);
  };

  // ── Presets ───────────────────────────────────────────
  const userName = profile?.displayName ?? '';
  const userPresets = (settings.presets ?? DEFAULT_PRESETS)[userName] ?? [];
  const userAccounts = (settings.accounts ?? {})[userName] ?? [];

  const deletePreset = (id) => {
    const updated = { ...settings.presets };
    updated[userName] = (updated[userName] ?? []).filter(p => p.id !== id);
    onSave({ ...settings, presets: updated });
  };

  const addPreset = () => {
    const name = newPreset.name.trim();
    const amount = parseFloat(newPreset.amount);
    if (!name || !amount || amount <= 0) return;
    const account = userAccounts[0]?.id ?? '';
    const preset = {
      id: `preset_${Date.now()}`,
      name,
      amount,
      currency: 'SGD',
      category: newPreset.category,
      account,
      payee: name,
      note: '',
    };
    const updated = { ...settings.presets };
    updated[userName] = [...(updated[userName] ?? []), preset];
    onSave({ ...settings, presets: updated });
    setNewPreset({ name: '', amount: '', category: 'transport' });
    setShowAddPreset(false);
  };

  // ── Categories ────────────────────────────────────────
  const startEditCategory = (cat) => {
    setEditingCategory({ ...cat });
  };

  const saveCategoryEdit = () => {
    if (!editingCategory) return;
    const updated = settings.categories.map(c =>
      c.id === editingCategory.id
        ? {
            ...c,
            label: editingCategory.label.trim() || c.label,
            icon: editingCategory.icon || c.icon,
            budget: parseFloat(editingCategory.budget) || 0,
          }
        : c
    );
    onSave({ ...settings, categories: updated });
    setEditingCategory(null);
  };

  return (
    <div className="min-h-screen bg-[#ECEDF0] pb-24 overflow-x-hidden">
      {/* Header */}
      <div className="px-4 pt-4 pb-3 flex items-center gap-3">
        <button
          onClick={onBack}
          className="w-9 h-9 rounded-full bg-white shadow-sm flex items-center justify-center text-gray-600 flex-shrink-0"
        >
          <ChevronLeft size={20} />
        </button>
        <h1 className="text-lg font-bold text-gray-900">Settings</h1>
        <button
          onClick={onToggleDark}
          className="ml-auto w-9 h-9 rounded-full bg-white shadow-sm flex items-center justify-center text-gray-600 flex-shrink-0"
          aria-label={dark ? 'Switch to light mode' : 'Switch to dark mode'}
        >
          {dark ? <Sun size={18} /> : <Moon size={18} />}
        </button>
      </div>

      {/* ── Profile card ─────────────────────────────── */}
      {profile && (
        <div className="mx-4 mb-4 bg-white rounded-2xl shadow-sm px-5 py-4 flex items-center gap-4">
          <AvatarImg name={profile.displayName} size={14} />
          <div>
            <p className="text-base font-bold text-gray-900">{profile.displayName}</p>
            <p className="text-xs text-gray-400 mt-0.5">{profile.email ?? ''}</p>
          </div>
        </div>
      )}

      {/* ── Appearance ───────────────────────────────── */}
      <div className="mx-4 mb-4 bg-white rounded-2xl shadow-sm overflow-hidden divide-y divide-gray-50">
        <div className="px-5 py-4 flex items-center justify-between">
          <div>
            <p className="text-sm font-bold text-gray-900">Edit Others' Transactions</p>
            <p className="text-xs text-gray-400 mt-0.5">Allow editing transactions added by other members</p>
          </div>
          <button
            onClick={() => onSave({ ...settings, allowEditOthers: !settings.allowEditOthers })}
            className={`relative w-12 h-6 rounded-full transition-colors duration-200 focus:outline-none ${settings.allowEditOthers ? 'bg-indigo-600' : 'bg-gray-200'}`}
            aria-label="Toggle edit others"
          >
            <div className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform duration-200 ${settings.allowEditOthers ? 'translate-x-6' : 'translate-x-0.5'}`} />
          </button>
        </div>
      </div>

      {/* ── Quick Presets ────────────────────────────── */}
      <div className="mx-4 mb-4 bg-white rounded-2xl shadow-sm overflow-hidden">
        <div className="px-5 pt-4 pb-2 flex items-center justify-between">
          <div>
            <p className="text-sm font-bold text-gray-900">Quick Presets</p>
            <p className="text-xs text-gray-400 mt-0.5">One-tap entries for {userName || 'you'}</p>
          </div>
          {!showAddPreset && (
            <button
              onClick={() => setShowAddPreset(true)}
              className="w-7 h-7 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center"
            >
              <Plus size={14} />
            </button>
          )}
        </div>

        {userPresets.length === 0 && !showAddPreset && (
          <p className="px-5 pb-4 text-xs text-gray-400">No presets yet. Tap + to add one.</p>
        )}

        {userPresets.map(preset => {
          const cat = getCategoryById(preset.category);
          return (
            <div key={preset.id} className="px-5 py-3 flex items-center justify-between border-t border-gray-50">
              <div className="flex items-center gap-3">
                <span className="text-xl">{cat.icon}</span>
                <div>
                  <p className="text-sm font-semibold text-gray-900">{preset.name}</p>
                  <p className="text-xs text-gray-400">S${preset.amount.toFixed(2)} · {cat.label}</p>
                </div>
              </div>
              <button onClick={() => deletePreset(preset.id)} className="text-red-400 hover:text-red-600 p-1">
                <X size={16} />
              </button>
            </div>
          );
        })}

        {showAddPreset && (
          <div className="px-5 py-3 border-t border-gray-50 space-y-2">
            <input
              type="text"
              placeholder="Name (e.g. NUS Bus)"
              value={newPreset.name}
              onChange={e => setNewPreset(p => ({ ...p, name: e.target.value }))}
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
            />
            <input
              type="number"
              placeholder="Amount (SGD)"
              value={newPreset.amount}
              onChange={e => setNewPreset(p => ({ ...p, amount: e.target.value }))}
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
            />
            <select
              value={newPreset.category}
              onChange={e => setNewPreset(p => ({ ...p, category: e.target.value }))}
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 bg-white"
            >
              {CATEGORIES.map(c => (
                <option key={c.id} value={c.id}>{c.icon} {c.label}</option>
              ))}
            </select>
            <div className="flex gap-2">
              <button
                onClick={addPreset}
                className="flex-1 bg-indigo-600 text-white text-sm font-semibold py-2 rounded-xl"
              >
                Add Preset
              </button>
              <button
                onClick={() => { setShowAddPreset(false); setNewPreset({ name: '', amount: '', category: 'transport' }); }}
                className="flex-1 bg-gray-100 text-gray-600 text-sm font-semibold py-2 rounded-xl"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ── Tags ─────────────────────────────────────── */}
      <div className="mx-4 mb-4 bg-white rounded-2xl shadow-sm overflow-hidden">
        <div className="px-5 pt-4 pb-2 flex items-center justify-between">
          <p className="text-sm font-bold text-gray-900">Tags</p>
          <span className="text-xs text-gray-400">{settings.tags.length} tags</span>
        </div>
        <div className="px-5 pb-4">
          <div className="flex flex-wrap gap-2 mb-3">
            {settings.tags.map(tag => (
              <div
                key={tag}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-indigo-50 border border-indigo-100"
              >
                <span className="text-xs font-semibold text-indigo-700">{tag}</span>
                <button
                  onClick={() => deleteTag(tag)}
                  className="text-indigo-300 hover:text-red-400 transition-colors"
                >
                  <X size={12} />
                </button>
              </div>
            ))}
          </div>

          {showAddTag ? (
            <div className="flex gap-2">
              <input
                type="text"
                value={newTag}
                onChange={e => setNewTag(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && addTag()}
                placeholder="New tag name…"
                maxLength={20}
                autoFocus
                className="flex-1 border border-gray-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-400"
              />
              <button
                onClick={addTag}
                disabled={!newTag.trim()}
                className="px-3 py-2 bg-indigo-600 text-white rounded-xl text-xs font-semibold disabled:opacity-40"
              >
                Add
              </button>
              <button
                onClick={() => { setShowAddTag(false); setNewTag(''); }}
                className="p-2 text-gray-400 hover:text-gray-600"
              >
                <X size={15} />
              </button>
            </div>
          ) : (
            <button
              onClick={() => setShowAddTag(true)}
              className="flex items-center gap-1.5 text-xs font-semibold text-indigo-500 hover:text-indigo-700"
            >
              <Plus size={14} /> Add tag
            </button>
          )}
        </div>
      </div>

      {/* ── Payment Accounts ─────────────────────────── */}
      <div className="mx-4 mb-4 bg-white rounded-2xl shadow-sm overflow-hidden">
        <div className="px-5 pt-4 pb-2">
          <p className="text-sm font-bold text-gray-900">Payment Accounts</p>
        </div>

        {members.map((person, idx) => (
          <div key={person} className={`px-5 pb-4 ${idx > 0 ? 'border-t border-gray-50 pt-3' : ''}`}>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">{person}</p>
            <div className="flex flex-wrap gap-2 mb-2">
              {(settings.accounts[person] ?? []).map(acc => (
                <div
                  key={acc.id}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gray-50 border border-gray-200"
                >
                  <span className="text-sm">{acc.icon}</span>
                  <span className="text-xs font-semibold text-gray-700">{acc.label}</span>
                  <button
                    onClick={() => deleteAccount(person, acc.id)}
                    className="text-gray-300 hover:text-red-400 transition-colors ml-1"
                  >
                    <X size={12} />
                  </button>
                </div>
              ))}
            </div>

            {showAddAccount === person ? (
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newAccountLabel}
                  onChange={e => setNewAccountLabel(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && addAccount(person)}
                  placeholder="Account name (e.g. OCBC)"
                  maxLength={20}
                  autoFocus
                  className="flex-1 border border-gray-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-400"
                />
                <button
                  onClick={() => addAccount(person)}
                  disabled={!newAccountLabel.trim()}
                  className="px-3 py-2 bg-indigo-600 text-white rounded-xl text-xs font-semibold disabled:opacity-40"
                >
                  Add
                </button>
                <button
                  onClick={() => { setShowAddAccount(null); setNewAccountLabel(''); }}
                  className="p-2 text-gray-400 hover:text-gray-600"
                >
                  <X size={15} />
                </button>
              </div>
            ) : (
              <button
                onClick={() => setShowAddAccount(person)}
                className="flex items-center gap-1.5 text-xs font-semibold text-indigo-500 hover:text-indigo-700"
              >
                <Plus size={14} /> Add account
              </button>
            )}
          </div>
        ))}
      </div>

      {/* ── Categories ───────────────────────────────── */}
      <div className="mx-4 mb-4 bg-white rounded-2xl shadow-sm overflow-hidden">
        <div className="px-5 pt-4 pb-2 flex items-center justify-between">
          <p className="text-sm font-bold text-gray-900">Categories</p>
          <span className="text-xs text-gray-400">tap to edit</span>
        </div>
        <div className="px-4 py-3 flex items-center justify-between border-b border-gray-100 bg-gray-50">
          <p className="text-sm font-semibold text-gray-700">Total Monthly Budget</p>
          <div className="flex items-center gap-1">
            <span className="text-sm text-gray-500">S$</span>
            <input
              type="number"
              min="0"
              value={localBudget}
              onChange={e => setLocalBudget(e.target.value)}
              onBlur={() => onSave({ ...settings, monthlyBudget: parseFloat(localBudget) || 0 })}
              onKeyDown={e => e.key === 'Enter' && onSave({ ...settings, monthlyBudget: parseFloat(localBudget) || 0 })}
              className="w-24 border border-gray-200 rounded-lg px-2 py-1 text-sm text-right focus:outline-none focus:ring-2 focus:ring-indigo-400"
            />
          </div>
        </div>

        <div className="divide-y divide-gray-50">
          {(settings.categories ?? []).map(cat => (
            <div key={cat.id} className="px-4 py-3 flex items-center gap-3">
              {editingCategory?.id === cat.id ? (
                <div className="flex-1 flex flex-col gap-2">
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={editingCategory.icon}
                      onChange={e => setEditingCategory(prev => ({ ...prev, icon: e.target.value }))}
                      maxLength={2}
                      className="w-12 text-center text-xl border border-gray-200 rounded-lg py-1 focus:outline-none focus:ring-2 focus:ring-indigo-400"
                    />
                    <input
                      type="text"
                      value={editingCategory.label}
                      onChange={e => setEditingCategory(prev => ({ ...prev, label: e.target.value }))}
                      maxLength={30}
                      autoFocus
                      className="flex-1 min-w-0 border border-gray-200 rounded-xl px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-400 flex-shrink-0">Budget S$</span>
                    <input
                      type="number"
                      min="0"
                      step="10"
                      value={editingCategory.budget ?? 0}
                      onChange={e => setEditingCategory(prev => ({ ...prev, budget: e.target.value }))}
                      onKeyDown={e => e.key === 'Enter' && saveCategoryEdit()}
                      placeholder="0"
                      className="flex-1 min-w-0 border border-gray-200 rounded-xl px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
                    />
                    <button
                      onClick={saveCategoryEdit}
                      className="w-8 h-8 rounded-full bg-indigo-600 flex items-center justify-center text-white flex-shrink-0"
                    >
                      <Check size={14} />
                    </button>
                    <button
                      onClick={() => setEditingCategory(null)}
                      className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-gray-400 flex-shrink-0"
                    >
                      <X size={14} />
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  className="flex items-center gap-3 w-full text-left active:bg-gray-50"
                  onClick={() => startEditCategory(cat)}
                >
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center text-xl flex-shrink-0"
                    style={{ background: cat.bg }}
                  >
                    {cat.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <span className="text-sm font-medium text-gray-800">{cat.label}</span>
                    {(cat.budget ?? 0) > 0 && (
                      <p className="text-xs text-gray-400 mt-0.5">Budget: S${cat.budget}</p>
                    )}
                  </div>
                  <svg className="text-gray-300 flex-shrink-0" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                  </svg>
                </button>
              )}
            </div>
          ))}
        </div>
        <div className="h-3" />
      </div>

      {/* ── Logout ───────────────────────────────────── */}
      {!isDemo && (
        <div className="mx-4 mb-6">
          <button
            onClick={onLogout}
            className="w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl bg-red-50 text-red-500 font-semibold text-sm active:opacity-70 transition-opacity"
          >
            <LogOut size={17} />
            Sign Out
          </button>
        </div>
      )}
    </div>
  );
}
