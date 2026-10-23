export const CATEGORIES = [
  { id: 'transport',    label: 'Transport',          color: '#3b82f6', bg: '#eff6ff', icon: '🚌', budget: 150 },
  { id: 'food',         label: 'Food & Dining',      color: '#f97316', bg: '#fff7ed', icon: '🍽️', budget: 400 },
  { id: 'groceries',    label: 'Groceries',          color: '#22c55e', bg: '#f0fdf4', icon: '🛒', budget: 300 },
  { id: 'shopping',     label: 'Shopping',           color: '#a855f7', bg: '#faf5ff', icon: '🛍️', budget: 200 },
  { id: 'health',       label: 'Health',             color: '#ef4444', bg: '#fef2f2', icon: '🏥', budget: 100 },
  { id: 'utilities',    label: 'Utilities',          color: '#eab308', bg: '#fefce8', icon: '💡', budget: 150 },
  { id: 'rent',         label: 'Rent / Housing',     color: '#6366f1', bg: '#eef2ff', icon: '🏠', budget: 3000 },
  { id: 'education',    label: 'Education',          color: '#0ea5e9', bg: '#f0f9ff', icon: '📚', budget: 100 },
  { id: 'entertainment',label: 'Entertainment',      color: '#ec4899', bg: '#fdf2f8', icon: '🎬', budget: 80 },
  { id: 'travel',       label: 'Travel',             color: '#14b8a6', bg: '#f0fdfa', icon: '✈️', budget: 200 },
  { id: 'family',       label: 'Family Maintenance', color: '#f59e0b', bg: '#fffbeb', icon: '🏡', budget: 250 },
  { id: 'other',        label: 'Other',              color: '#6b7280', bg: '#f9fafb', icon: '💰', budget: 100 },
];

export const CURRENCIES = [
  { code: 'SGD', symbol: 'S$', label: 'Singapore Dollar' },
  { code: 'INR', symbol: '₹',  label: 'Indian Rupee' },
];

export const PRIMARY_CURRENCY = 'SGD';

export const getCategoryById = (id) =>
  CATEGORIES.find(c => c.id === id) ?? CATEGORIES[CATEGORIES.length - 1];

// Payment accounts keyed by displayName
export const ACCOUNTS = {
  Samshad: [
    { id: 'samshad_dbs',    label: 'DBS',    icon: '🏦' },
    { id: 'samshad_scapia', label: 'Scapia', icon: '💳' },
    { id: 'samshad_sbi',    label: 'SBI',    icon: '🏦' },
  ],
  Sahla: [
    { id: 'sahla_dbs', label: 'DBS', icon: '🏦' },
    { id: 'sahla_sbi', label: 'SBI', icon: '🏦' },
  ],
};

// Only this member can change budgets and the edit-others switch (matched by displayName)
export const SETTINGS_OWNER = 'Samshad';

// Expenses with this tag are left out of the home screen budget but still count in Trends/Analytics.
// The tag can't be deleted and is shown in amber.
export const UNBUDGETED_TAG = 'Unbudgeted';
export const isUnbudgeted = (e) => e.tags?.includes(UNBUDGETED_TAG) ?? false;

export const DEFAULT_TAGS = ['Samshad', 'Sahla', 'AdvancePurchase', 'Unbudgeted', 'India'];

export const DEFAULT_PRESETS = {
  Samshad: [
    { id: 'preset_nus',  name: 'NUS - BUS/MRT',  amount: 1.28, currency: 'SGD', category: 'transport', account: 'samshad_dbs', payee: 'NUS-BUS',  note: '' },
  ],
  Sahla: [
    { id: 'preset_sutd', name: 'SUTD - BUS/MRT', amount: 2.40, currency: 'SGD', category: 'transport', account: 'sahla_dbs',   payee: 'SUTD-MRT', note: '' },
  ],
};

// Text on a preset's home-screen button: its own buttonText, else the first word of its name
export const presetButtonText = (preset) =>
  preset.buttonText?.trim() || preset.name.split(' ')[0];

// Avatar photos keyed by displayName — falls back to initials if not set
export const AVATARS = {
  Samshad: '/samshad.png',
  Sahla:   '/sahla.png',
};

export const CLOUDINARY_CLOUD = 'poi0fcfz';
export const CLOUDINARY_PRESET = 'familyledger_bills';

// Bank brand styles — matched by checking if label contains the key (case-insensitive)
export const BANK_BRANDS = {
  sbi:    { bg: '#2563EB', text: '#ffffff', abbr: 'SBI',  ring: '#1d4ed8', logo: '/bank-sbi.png' },
  dbs:    { bg: '#DA0012', text: '#ffffff', abbr: 'DBS',  ring: '#a80010', logo: '/bank-dbs.jpg' },
  scapia: { bg: '#c0442a', text: '#ffffff', abbr: 'SC',   ring: '#9a3520', logo: '/bank-scapia.png' },
  ocbc:   { bg: '#EE2E24', text: '#ffffff', abbr: 'OCBC', ring: '#c0231b', logo: null },
  uob:    { bg: '#0032A0', text: '#ffffff', abbr: 'UOB',  ring: '#002280', logo: null },
  posb:   { bg: '#E30613', text: '#ffffff', abbr: 'POSB', ring: '#b3040f', logo: null },
  hdfc:   { bg: '#004C8F', text: '#ffffff', abbr: 'HDFC', ring: '#003a6e', logo: null },
  icici:  { bg: '#F47920', text: '#ffffff', abbr: 'ICICI',ring: '#c4611a', logo: null },
};

export function getBankBrand(label = '') {
  const lower = label.toLowerCase();
  for (const [key, brand] of Object.entries(BANK_BRANDS)) {
    if (lower.includes(key)) return brand;
  }
  // Generic fallback — derive color from label
  const colors = ['#6366f1','#0ea5e9','#22c55e','#f59e0b','#ec4899','#14b8a6'];
  const idx = label.charCodeAt(0) % colors.length;
  return { bg: colors[idx], text: '#ffffff', abbr: label.slice(0, 2).toUpperCase(), ring: colors[idx], logo: null };
}
