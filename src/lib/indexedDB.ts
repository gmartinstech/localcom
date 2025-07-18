let db: IDBDatabase;
const DB_NAME = 'LocalComDB';
const STORE_NAME = 'messages';
const DB_VERSION = 1;

export const initDB = (): Promise<boolean> => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const dbInstance = request.result;
      if (!dbInstance.objectStoreNames.contains(STORE_NAME)) {
        dbInstance.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };

    request.onsuccess = () => {
      db = request.result;
      resolve(true);
    };

    request.onerror = () => {
      console.error('IndexedDB error:', request.error);
      reject(false);
    };
  });
};

type Message = {
    id: number;
    text: string;
    sender: 'me' | 'peer';
    timestamp: string;
};

export const addMessage = (message: Message): Promise<void> => {
  return new Promise((resolve, reject) => {
    if (!db) {
        console.error('DB not initialized');
        return reject();
    }
    const transaction = db.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.put(message);

    request.onsuccess = () => resolve();
    request.onerror = () => {
        console.error('Error adding message:', request.error);
        reject();
    };
  });
};

export const getMessages = (): Promise<Message[]> => {
  return new Promise((resolve, reject) => {
    if (!db) {
        console.error('DB not initialized');
        return resolve([]); // Return empty array if DB not ready
    }
    const transaction = db.transaction([STORE_NAME], 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.getAll();

    request.onsuccess = () => {
        resolve(request.result);
    };
    request.onerror = () => {
        console.error('Error getting messages:', request.error);
        reject([]);
    };
  });
};
