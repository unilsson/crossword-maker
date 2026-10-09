const DB_NAME = "crossword-maker";
const DB_VERSION = 1;
const STORE_NAME = "images";

const openDb = (): Promise<IDBDatabase> =>
  new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });

export const saveImageAsset = async (assetId: string, file: File): Promise<void> => {
  const db = await openDb();

  await new Promise<void>((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, "readwrite");
    transaction.objectStore(STORE_NAME).put(file, assetId);

    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () => reject(transaction.error);
  });

  db.close();
  const response = await fetch("/api/assets/" + assetId, { method: "PUT", headers: { "Content-Type": file.type }, body: file });
  if (!response.ok) throw new Error("Kunde inte spara bilden på servern.");
};

export const loadImageAsset = async (assetId: string): Promise<Blob | null> => {
  const remote = await fetch("/api/assets/" + assetId).catch(() => null);
  if (remote?.ok) return remote.blob();
  const db = await openDb();

  const result = await new Promise<Blob | null>((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, "readonly");
    const request = transaction.objectStore(STORE_NAME).get(assetId);

    request.onsuccess = () => resolve((request.result as Blob | undefined) ?? null);
    request.onerror = () => reject(request.error);
  });

  db.close();
  return result;
};

export const deleteImageAsset = async (assetId: string): Promise<void> => {
  const db = await openDb();

  await new Promise<void>((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, "readwrite");
    transaction.objectStore(STORE_NAME).delete(assetId);

    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () => reject(transaction.error);
  });

  db.close();
  await fetch("/api/assets/" + assetId, { method: "DELETE" }).catch(() => null);
}; 

/** Copy existing browser-only images to server before creating a server project. */
export const syncImageAssets = async (ids: string[]): Promise<void> => {
  for (const id of ids) {
    const exists = await fetch("/api/assets/" + id);
    if (exists.ok) continue;
    const image = await loadImageAsset(id);
    if (!image) throw new Error("En bild saknas i webbläsaren: " + id);
    const saved = await fetch("/api/assets/" + id, {
      method: "PUT",
      headers: { "Content-Type": image.type },
      body: image,
    });
    if (!saved.ok) throw new Error("Kunde inte flytta bilden till servern.");
  }
};
