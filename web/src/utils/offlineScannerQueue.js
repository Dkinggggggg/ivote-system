const DATABASE_NAME = 'ivote-scanner-offline';
const STORE_NAME = 'captures';

function openDatabase() {
  if (!('indexedDB' in window)) {
    return Promise.reject(new Error('Offline capture storage is not available in this browser.'));
  }

  return new Promise((resolve, reject) => {
    const request = window.indexedDB.open(DATABASE_NAME, 1);

    request.onupgradeneeded = () => {
      request.result.createObjectStore(STORE_NAME, { keyPath: 'id' });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('Unable to open offline capture storage.'));
  });
}

export async function listOfflineCaptures() {
  const database = await openDatabase();

  return new Promise((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, 'readonly');
    const request = transaction.objectStore(STORE_NAME).getAll();

    request.onsuccess = () => {
      resolve(request.result
        .map(({ image, ...capture }) => capture)
        .sort((first, second) => first.capturedAt - second.capturedAt));
    };
    request.onerror = () => reject(request.error || new Error('Unable to read offline captures.'));
    transaction.oncomplete = () => database.close();
    transaction.onerror = () => reject(transaction.error || new Error('Unable to read offline captures.'));
  });
}

export async function getOfflineCapture(id) {
  const database = await openDatabase();

  return new Promise((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, 'readonly');
    const request = transaction.objectStore(STORE_NAME).get(id);

    request.onsuccess = () => resolve(request.result || null);
    request.onerror = () => reject(request.error || new Error('Unable to read the offline capture.'));
    transaction.oncomplete = () => database.close();
    transaction.onerror = () => reject(transaction.error || new Error('Unable to read the offline capture.'));
  });
}

export async function saveOfflineCapture(image, electionId) {
  const database = await openDatabase();
  const capture = {
    id: globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    electionId: String(electionId),
    capturedAt: Date.now(),
    status: 'captured',
    image,
    result: null,
    error: '',
  };

  return new Promise((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, 'readwrite');
    transaction.objectStore(STORE_NAME).add(capture);
    transaction.oncomplete = () => {
      database.close();
      resolve(capture.id);
    };
    transaction.onerror = () => {
      database.close();
      reject(transaction.error || new Error('Unable to save the offline capture.'));
    };
  });
}

export async function updateOfflineCapture(id, updates) {
  const database = await openDatabase();

  return new Promise((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.get(id);

    request.onsuccess = () => {
      if (!request.result) {
        transaction.abort();
        return;
      }

      store.put({ ...request.result, ...updates, id });
    };
    request.onerror = () => transaction.abort();
    transaction.oncomplete = () => {
      database.close();
      resolve();
    };
    transaction.onerror = () => {
      database.close();
      reject(transaction.error || new Error('Unable to update the offline capture.'));
    };
    transaction.onabort = () => {
      database.close();
      reject(transaction.error || new Error('Offline capture no longer exists.'));
    };
  });
}

export async function deleteOfflineCapture(id) {
  const database = await openDatabase();

  return new Promise((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, 'readwrite');
    transaction.objectStore(STORE_NAME).delete(id);
    transaction.oncomplete = () => {
      database.close();
      resolve();
    };
    transaction.onerror = () => {
      database.close();
      reject(transaction.error || new Error('Unable to remove the offline capture.'));
    };
  });
}