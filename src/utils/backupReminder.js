const FLAG_KEY   = 'fl_backup_reminder';
const BACKUP_KEY = 'fl_last_drive_backup';
const SEVEN_DAYS = 7 * 24 * 60 * 60 * 1000;

export async function registerBackupReminder() {
  try { localStorage.setItem(FLAG_KEY, '1'); } catch {}
  return { ok: true };
}

export async function unregisterBackupReminder() {
  try { localStorage.removeItem(FLAG_KEY); } catch {}
}

export async function isBackupReminderEnabled() {
  try { return !!localStorage.getItem(FLAG_KEY); } catch { return false; }
}

/** Returns true if reminder is on and last backup was 7+ days ago (or never). */
export function shouldShowBackupReminder() {
  try {
    if (!localStorage.getItem(FLAG_KEY)) return false;
    const last = localStorage.getItem(BACKUP_KEY);
    if (!last) return true;
    return Date.now() - new Date(last).getTime() >= SEVEN_DAYS;
  } catch {
    return false;
  }
}
