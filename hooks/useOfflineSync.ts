import { useEffect } from 'react';
import { getQueuedEvidence, removeQueuedEvidence } from '../utils/offlineSync';
import { uploadEvidence } from '../api/fieldManagerApi';

export function useOfflineSync(onSyncSuccess?: () => void) {
    useEffect(() => {
        const sync = async () => {
            if (!navigator.onLine) return;

            const queue = await getQueuedEvidence();
            if (queue.length === 0) return;

            console.log(`[Sync] Encontrados ${queue.length} itens para sincronizar...`);

            for (const item of queue) {
                try {
                    await uploadEvidence(item.taskId, item.stage, item.file, item.location);
                    await removeQueuedEvidence(item.id);
                    console.log(`[Sync] Item ${item.id} sincronizado com sucesso.`);
                } catch (error) {
                    console.error(`[Sync] Erro ao sincronizar item ${item.id}:`, error);
                    // If it's a permanent error (like 404/403), we might want to remove it,
                    // but for now we'll just keep it in queue.
                }
            }

            if (onSyncSuccess) onSyncSuccess();
        };

        // Run on mount and when coming back online
        sync();
        window.addEventListener('online', sync);

        // Also run periodically
        const interval = setInterval(sync, 30000); // 30 seconds

        return () => {
            window.removeEventListener('online', sync);
            clearInterval(interval);
        };
    }, [onSyncSuccess]);
}
