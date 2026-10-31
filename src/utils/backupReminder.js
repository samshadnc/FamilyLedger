const SYNC_TAG = 'backup-reminder';
const SEVEN_DAYS = 7 * 24 * 60 * 60 * 1000;

export async function registerBackupReminder() {
  if (!('serviceWorker' in navigator)) return { ok: false, reason: 'no-sw' };
  if (!('periodicSync' in (await navigator.serviceWorker.ready))) return { ok: false, reason: 'no-periodic-sync' };

  const permission = await Notification.requestPermission();
  if (permission !== 'granted') return { ok: false, reason: 'no-permission' };

  const reg = await navigator.serviceWorker.ready;
  await reg.periodicSync.register(SYNC_TAG, { minInterval: SEVEN_DAYS });
  localStorage.setItem('fl_backup_reminder', '1');
  return { ok: true };
}

export async function unregisterBackupReminder() {
  localStorage.removeItem('fl_backup_reminder');
  if (!('serviceWorker' in navigator)) return;
  try {
    const reg = await navigator.serviceWorker.ready;
    if ('periodicSync' in reg) await reg.periodicSync.unregister(SYNC_TAG);
  } catch {}
}

export async function isBackupReminderEnabled() {
  if (!localStorage.getItem('fl_backup_reminder')) return false;
  if (!('serviceWorker' in navigator)) return false;
  try {
    const reg = await navigator.serviceWorker.ready;
    if (!('periodicSync' in reg)) return false;
    const tags = await reg.periodicSync.getTags();
    return tags.includes(SYNC_TAG);
  } catch {
    return false;
  }
}
