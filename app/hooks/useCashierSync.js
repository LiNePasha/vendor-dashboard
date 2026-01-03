/**
 * Cashier Sync Hook
 * 
 * Auto-syncs products every 30 seconds using delta sync
 */

import { useEffect, useRef } from 'react';
import usePOSStore from '@/app/stores/pos-store';

export function useCashierSync() {
  const syncChanges = usePOSStore(state => state.syncChanges);
  const syncAllProducts = usePOSStore(state => state.syncAllProducts);
  const autoSyncEnabled = usePOSStore(state => state.autoSyncEnabled);
  const lastSync = usePOSStore(state => state.lastSync);
  
  const intervalRef = useRef(null);

  useEffect(() => {
    // Initial full sync if never synced before
    if (!lastSync) {
      console.log('🚀 Initial full sync...');
      syncAllProducts();
    }

    // Auto-sync every 2 minutes (reduced frequency to avoid excessive requests)
    if (autoSyncEnabled) {
      intervalRef.current = setInterval(() => {
        console.log('🔄 Auto-sync triggered (every 2 min)...');
        syncChanges();
      }, 120000); // 2 minutes (120 seconds)

      return () => {
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
        }
      };
    }
  }, [autoSyncEnabled, lastSync, syncAllProducts, syncChanges]);

  return {
    syncNow: syncAllProducts,
    syncChanges
  };
}
