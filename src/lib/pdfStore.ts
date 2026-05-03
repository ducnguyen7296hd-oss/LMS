export const initDB = (): Promise<IDBDatabase> => {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open('EduTestDB', 1);
        request.onupgradeneeded = (e) => {
            const db = (e.target as IDBOpenDBRequest).result;
            if (!db.objectStoreNames.contains('pdfs')) {
                db.createObjectStore('pdfs');
            }
        };
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
};

export const savePdf = async (id: string, file: File | Blob): Promise<void> => {
    const db = await initDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction('pdfs', 'readwrite');
        const store = tx.objectStore('pdfs');
        const request = store.put(file, id);
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
    });
};

export const getPdf = async (id: string): Promise<File | Blob | null> => {
    const db = await initDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction('pdfs', 'readonly');
        const store = tx.objectStore('pdfs');
        const request = store.get(id);
        request.onsuccess = () => resolve(request.result || null);
        request.onerror = () => reject(request.error);
    });
};
