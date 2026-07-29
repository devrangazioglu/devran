export type HistoryEntry = {
  id: string;
  name: string;
  from: string;
  to: string;
  date: number;
  mime: string;
  blob: Blob;
};

const DB_NAME = "transivo";
const STORE = "history";

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(STORE)) {
        req.result.createObjectStore(STORE, { keyPath: "id" });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function tx<T>(
  mode: IDBTransactionMode,
  run: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  return openDb().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const t = db.transaction(STORE, mode);
        const req = run(t.objectStore(STORE));
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      }),
  );
}

export function addEntry(entry: HistoryEntry): Promise<IDBValidKey> {
  return tx("readwrite", (s) => s.add(entry));
}

export async function listEntries(): Promise<HistoryEntry[]> {
  const all = await tx<HistoryEntry[]>("readonly", (s) => s.getAll());
  return all.sort((a, b) => b.date - a.date);
}

export function deleteEntry(id: string): Promise<undefined> {
  return tx("readwrite", (s) => s.delete(id));
}

export function clearEntries(): Promise<undefined> {
  return tx("readwrite", (s) => s.clear());
}
