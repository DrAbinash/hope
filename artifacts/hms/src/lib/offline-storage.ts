import { DocumentMetadata } from "./document-utils";

const DB_NAME = "HMS_Documents";
const DB_VERSION = 1;
const STORE_DOCS = "documents";
const STORE_QUEUE = "uploadQueue";

interface QueuedUpload {
  id: string;
  patientId: string;
  file: Blob;
  fileName: string;
  category: string;
  timestamp: number;
  retries: number;
}

let db: IDBDatabase | null = null;

export async function initOfflineStorage(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (db) {
      resolve(db);
      return;
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => reject(new Error("Failed to open offline storage"));
    request.onsuccess = () => {
      db = request.result;
      resolve(db);
    };

    request.onupgradeneeded = (event) => {
      const database = (event.target as IDBOpenDBRequest).result;

      if (!database.objectStoreNames.contains(STORE_DOCS)) {
        database.createObjectStore(STORE_DOCS, { keyPath: "id" });
      }

      if (!database.objectStoreNames.contains(STORE_QUEUE)) {
        const queueStore = database.createObjectStore(STORE_QUEUE, { keyPath: "id" });
        queueStore.createIndex("patientId", "patientId", { unique: false });
        queueStore.createIndex("timestamp", "timestamp", { unique: false });
      }
    };
  });
}

export async function cacheDocument(doc: DocumentMetadata): Promise<void> {
  const database = await initOfflineStorage();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction([STORE_DOCS], "readwrite");
    const store = transaction.objectStore(STORE_DOCS);
    const request = store.put(doc);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve();
  });
}

export async function getCachedDocuments(patientId: string): Promise<DocumentMetadata[]> {
  const database = await initOfflineStorage();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction([STORE_DOCS], "readonly");
    const store = transaction.objectStore(STORE_DOCS);
    const request = store.getAll();

    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const docs = (request.result as DocumentMetadata[]).filter((d) => d.patientId === patientId);
      resolve(docs);
    };
  });
}

export async function queueUpload(
  patientId: string,
  file: File,
  category: string
): Promise<string> {
  const database = await initOfflineStorage();
  const blob = new Blob([file], { type: file.type });
  const id = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

  const queuedUpload: QueuedUpload = {
    id,
    patientId,
    file: blob,
    fileName: file.name,
    category,
    timestamp: Date.now(),
    retries: 0,
  };

  return new Promise((resolve, reject) => {
    const transaction = database.transaction([STORE_QUEUE], "readwrite");
    const store = transaction.objectStore(STORE_QUEUE);
    const request = store.add(queuedUpload);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(id);
  });
}

export async function getQueuedUploads(patientId: string): Promise<QueuedUpload[]> {
  const database = await initOfflineStorage();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction([STORE_QUEUE], "readonly");
    const store = transaction.objectStore(STORE_QUEUE);
    const index = store.index("patientId");
    const request = index.getAll(patientId);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
  });
}

export async function removeQueuedUpload(id: string): Promise<void> {
  const database = await initOfflineStorage();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction([STORE_QUEUE], "readwrite");
    const store = transaction.objectStore(STORE_QUEUE);
    const request = store.delete(id);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve();
  });
}

export async function syncQueuedUploads(patientId: string): Promise<{ uploaded: number; failed: number }> {
  const queued = await getQueuedUploads(patientId);
  let uploaded = 0;
  let failed = 0;

  for (const item of queued) {
    try {
      const formData = new FormData();
      formData.append("files", item.file, item.fileName);
      formData.append("category", item.category);

      const response = await fetch(`/api/patients/${patientId}/documents`, {
        method: "POST",
        credentials: "include",
        body: formData,
      });

      if (response.ok) {
        await removeQueuedUpload(item.id);
        uploaded++;
      } else {
        item.retries++;
        if (item.retries > 3) {
          await removeQueuedUpload(item.id);
          failed++;
        }
      }
    } catch (e) {
      item.retries++;
      if (item.retries > 3) {
        await removeQueuedUpload(item.id);
        failed++;
      }
    }
  }

  return { uploaded, failed };
}

export function isOnline(): boolean {
  return navigator.onLine;
}

export function onOnlineStatusChange(callback: (isOnline: boolean) => void): () => void {
  const handleOnline = () => callback(true);
  const handleOffline = () => callback(false);

  window.addEventListener("online", handleOnline);
  window.addEventListener("offline", handleOffline);

  return () => {
    window.removeEventListener("online", handleOnline);
    window.removeEventListener("offline", handleOffline);
  };
}
