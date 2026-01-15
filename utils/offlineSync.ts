import { openDB } from 'idb'; // I'll need to install idb
import { TaskEvidence, EvidenceStage } from '../types';

const DB_NAME = 'field-manager-offline';
const STORE_NAME = 'evidence-queue';

export async function getDB() {
    return openDB(DB_NAME, 1, {
        upgrade(db) {
            db.createObjectStore(STORE_NAME, { keyPath: 'id', autoIncrement: true });
        },
    });
}

export async function queueOfflineEvidence(taskId: string, stage: EvidenceStage, file: File, location: { lat: number, lng: number }) {
    const db = await getDB();
    // We need to store the file as a Blob
    await db.add(STORE_NAME, {
        taskId,
        stage,
        file,
        location,
        timestamp: Date.now()
    });

    // Register sync if supported
    if ('serviceWorker' in navigator && 'SyncManager' in window) {
        const registration = await navigator.serviceWorker.ready;
        try {
            await (registration as any).sync.register('sync-evidence');
        } catch {
            console.log('Background sync failed to register, will fallback to interval check');
        }
    }
}

export async function getQueuedEvidence() {
    const db = await getDB();
    return db.getAll(STORE_NAME);
}

export async function removeQueuedEvidence(id: number) {
    const db = await getDB();
    await db.delete(STORE_NAME, id);
}
