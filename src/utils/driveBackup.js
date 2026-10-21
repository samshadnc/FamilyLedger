import { collection, getDocs, orderBy, query } from 'firebase/firestore';
import { db } from '../firebase';

export async function uploadToDrive(token, settings) {
  const snap = await getDocs(query(collection(db, 'expenses'), orderBy('date', 'desc')));
  const expenses = snap.docs.map(d => ({ ...d.data(), id: d.id }));
  const content = JSON.stringify({ exportedAt: new Date().toISOString(), version: 1, expenses, settings }, null, 2);
  const filename = 'FamilyLedger_backup.json';

  const searchRes = await fetch(
    `https://www.googleapis.com/drive/v3/files?q=name%3D'${filename}'%20and%20trashed%3Dfalse&fields=files(id)`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  const { files } = await searchRes.json();
  const boundary = 'fl_backup_boundary';
  const body = [
    `--${boundary}`,
    'Content-Type: application/json; charset=UTF-8',
    '',
    JSON.stringify({ name: filename, mimeType: 'application/json' }),
    `--${boundary}`,
    'Content-Type: application/json',
    '',
    content,
    `--${boundary}--`,
  ].join('\r\n');
  const isUpdate = files?.length > 0;
  const res = await fetch(
    isUpdate
      ? `https://www.googleapis.com/upload/drive/v3/files/${files[0].id}?uploadType=multipart`
      : 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart',
    {
      method: isUpdate ? 'PATCH' : 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': `multipart/related; boundary=${boundary}` },
      body,
    }
  );
  if (!res.ok) throw new Error('Upload failed');
  const now = new Date().toISOString();
  try { localStorage.setItem('fl_last_drive_backup', now); } catch {}
  return now;
}

export function initSilentBackup(settings, onSuccess) {
  if (!window.google?.accounts?.oauth2) return;
  const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
  if (!clientId) return;
  const tokenClient = window.google.accounts.oauth2.initTokenClient({
    client_id: clientId,
    scope: 'https://www.googleapis.com/auth/drive.file',
    callback: async (response) => {
      if (response.error) return;
      try {
        const ts = await uploadToDrive(response.access_token, settings);
        onSuccess?.(ts);
      } catch {}
    },
  });
  tokenClient.requestAccessToken({ prompt: 'none' });
}
