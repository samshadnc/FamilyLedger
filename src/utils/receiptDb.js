const DB_NAME = 'fl_receipts';
const STORE = 'receipts';

function openDb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = (e) => e.target.result.createObjectStore(STORE, { keyPath: 'id' });
    req.onsuccess = (e) => resolve(e.target.result);
    req.onerror = (e) => reject(e.target.error);
  });
}

export async function saveReceiptBlob(id, blob) {
  try {
    const db = await openDb();
    await new Promise((res, rej) => {
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).put({ id, blob, ts: Date.now() });
      tx.oncomplete = res;
      tx.onerror = (e) => rej(e.target.error);
    });
  } catch {}
}

export async function getReceiptBlob(id) {
  try {
    const db = await openDb();
    return await new Promise((res, rej) => {
      const tx = db.transaction(STORE, 'readonly');
      const req = tx.objectStore(STORE).get(id);
      req.onsuccess = (e) => res(e.target.result?.blob ?? null);
      req.onerror = (e) => rej(e.target.error);
    });
  } catch {
    return null;
  }
}

export async function deleteReceiptBlob(id) {
  try {
    const db = await openDb();
    await new Promise((res, rej) => {
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).delete(id);
      tx.oncomplete = res;
      tx.onerror = (e) => rej(e.target.error);
    });
  } catch {}
}
