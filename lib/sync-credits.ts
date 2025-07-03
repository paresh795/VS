// Credit Synchronization Service
// Professional real-time credit balance management for production use

import { useCreditsStore } from './store/credits-store';

interface CreditSyncOptions {
  force?: boolean;
  timeout?: number;
}

class CreditSyncService {
  private static instance: CreditSyncService;
  private syncInterval: NodeJS.Timeout | null = null;
  private isSyncing = false;
  private lastSyncTime = 0;
  private readonly SYNC_COOLDOWN = 5000; // 5 seconds cooldown between syncs

  private constructor() {}

  static getInstance(): CreditSyncService {
    if (!CreditSyncService.instance) {
      CreditSyncService.instance = new CreditSyncService();
    }
    return CreditSyncService.instance;
  }

  /**
   * Perform credit balance sync with server
   */
  static async performFetch(endpoint: string, options: RequestInit = {}) {
    const response = await fetch(endpoint, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache',
        ...options.headers
      },
      credentials: 'include',
      ...options
    });

    if (!response.ok) {
      throw new Error(`API returned ${response.status}: ${response.statusText}`);
    }

    return response.json();
  }

  /**
   * Sync credits with optional force override
   * 🔥 SMART SYNC: Respects recent client-side deductions to prevent overwrites
   */
  async syncCredits(options: CreditSyncOptions = {}) {
    const { force = false, timeout = 10000 } = options;
    const now = Date.now();

    // Check cooldown unless forced
    if (!force && (now - this.lastSyncTime) < this.SYNC_COOLDOWN) {
      console.log('[CreditSync] Skipping sync due to cooldown');
      return;
    }

    // Prevent concurrent syncs
    if (this.isSyncing) {
      console.log('[CreditSync] Sync already in progress');
      return;
    }
    
    this.isSyncing = true;

    try {
      console.log('[CreditSync] Starting credit sync...');
      
      // Get current client state
      const { balance: clientBalance, lastUpdated, pendingDeductions } = useCreditsStore.getState();
      const timeSinceLastUpdate = lastUpdated ? (now - new Date(lastUpdated).getTime()) : Infinity;
      
      // Create timeout promise
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Credit sync timeout')), timeout);
      });

      // Create fetch promise
      const fetchPromise = CreditSyncService.performFetch('/api/credits/balance');

      // Race between fetch and timeout
      const data = await Promise.race([fetchPromise, timeoutPromise]);

      if (typeof data.balance === 'number') {
        const serverBalance = data.balance;
        const { setBalance } = useCreditsStore.getState();
        
        // 🧠 SMART SYNC LOGIC: Only update if server balance makes sense
        const shouldUpdateBalance = force || this.shouldAcceptServerBalance(
          clientBalance,
          serverBalance,
          timeSinceLastUpdate,
          pendingDeductions
        );
        
        if (shouldUpdateBalance) {
          if (clientBalance !== serverBalance) {
            setBalance(serverBalance);
            console.log('[CreditSync] ✅ Credits updated:', { 
              old: clientBalance, 
              new: serverBalance,
              difference: serverBalance - clientBalance,
              reason: force ? 'forced' : 'smart sync approved'
            });
          } else {
            console.log('[CreditSync] Credits unchanged:', serverBalance);
          }
        } else {
          console.log('[CreditSync] 🔒 Server sync blocked - protecting recent client changes:', {
            client: clientBalance,
            server: serverBalance,
            timeSinceUpdate: timeSinceLastUpdate,
            pendingDeductions
          });
        }

        this.lastSyncTime = now;
      } else {
        console.warn('[CreditSync] Invalid balance response:', data);
      }
    } catch (error) {
      console.error('[CreditSync] Failed to sync credits:', error);
      throw error;
    } finally {
      this.isSyncing = false;
    }
  }

  /**
   * 🧠 SMART SYNC: Decide whether to accept server balance based on recent client activity
   */
  private shouldAcceptServerBalance(
    clientBalance: number,
    serverBalance: number,
    timeSinceLastUpdate: number,
    pendingDeductions: number
  ): boolean {
    // Always accept if client hasn't been updated recently (> 2 minutes)
    if (timeSinceLastUpdate > 120000) {
      return true;
    }
    
    // Always accept if server balance is higher (credits added)
    if (serverBalance > clientBalance) {
      return true;
    }
    
    // If recent client activity (< 30 seconds), be very careful
    if (timeSinceLastUpdate < 30000) {
      // Only accept server balance if the difference matches pending deductions
      const difference = clientBalance - serverBalance;
      const expectedDifference = pendingDeductions;
      
      // Allow some tolerance for timing issues
      return Math.abs(difference - expectedDifference) <= 1;
    }
    
    // For medium-term updates (30s - 2min), allow if difference is reasonable
    const difference = Math.abs(clientBalance - serverBalance);
    return difference <= 50; // Don't accept huge discrepancies
  }

  /**
   * Sync after a known operation that changed credits on server
   */
  async syncAfterOperation(expectedNewBalance?: number): Promise<void> {
    console.log('[CreditSync] Syncing after operation with expected balance:', expectedNewBalance);
    
    if (expectedNewBalance !== undefined) {
      // If we know the expected balance, set it immediately
      const { setBalance } = useCreditsStore.getState();
      setBalance(expectedNewBalance);
    }
    
    // Then do a normal sync to confirm
    await this.syncCredits({ force: true });
  }

  /**
   * Force immediate sync (ignores cooldown)
   */
  async forceSyncCredits() {
    return this.syncCredits({ force: true });
  }

  /**
   * Periodic sync (respects cooldown)
   */
  async periodicSyncCredits() {
    return this.syncCredits({ force: false });
  }

  /**
   * Check if sync is needed (based on cooldown)
   */
  isSyncNeeded(): boolean {
    const now = Date.now();
    return (now - this.lastSyncTime) >= this.SYNC_COOLDOWN;
  }

  /**
   * Get time until next sync is allowed
   */
  getTimeUntilNextSync(): number {
    const now = Date.now();
    const timeSinceLastSync = now - this.lastSyncTime;
    return Math.max(0, this.SYNC_COOLDOWN - timeSinceLastSync);
  }

  /**
   * Start periodic credit synchronization
   * Useful for keeping credits in sync during long sessions
   */
  startPeriodicSync(intervalMs: number = 30000): void {
    if (this.syncInterval) {
      console.log('🔄 [CREDIT SYNC] Periodic sync already running');
      return;
    }

    console.log('🚀 [CREDIT SYNC] Starting periodic sync every', intervalMs, 'ms');

    this.syncInterval = setInterval(async () => {
      try {
        await this.syncCredits();
      } catch (error) {
        console.error('❌ [CREDIT SYNC] Periodic sync failed:', error);
      }
    }, intervalMs);
  }

  /**
   * Stop periodic synchronization
   */
  stopPeriodicSync(): void {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
      console.log('⏹️ [CREDIT SYNC] Periodic sync stopped');
    }
  }

  /**
   * Force an immediate sync (bypasses cooldown)
   * Use sparingly - only for critical situations
   */
  async forceSyncNow(): Promise<number | null> {
    const previousSyncing = this.isSyncing;
    this.isSyncing = true;
    
    try {
      console.log('⚡ [CREDIT SYNC] Force syncing credits...');
      
      const response = await fetch('/api/credits/balance', {
        headers: { 
          'Cache-Control': 'no-cache',
          'x-sync-trigger': 'force-sync'
        },
        credentials: 'include'
      });
      
      if (response.ok) {
        const data = await response.json();
        const balance = data.balance || 0;
        
        const { setBalance } = useCreditsStore.getState();
        setBalance(balance);
        
        console.log('✅ [CREDIT SYNC] Force sync completed:', balance);
        return balance;
      } else {
        console.error('❌ [CREDIT SYNC] Force sync failed:', response.status);
        return null;
      }
    } catch (error) {
      console.error('❌ [CREDIT SYNC] Force sync error:', error);
      return null;
    } finally {
      this.isSyncing = previousSyncing;
    }
  }

  /**
   * Get current sync status
   */
  getSyncStatus(): { isSyncing: boolean; lastSyncTime: number; hasPeriodicSync: boolean } {
    return {
      isSyncing: this.isSyncing,
      lastSyncTime: this.lastSyncTime,
      hasPeriodicSync: this.syncInterval !== null
    };
  }
}

// Export singleton instance
export const creditSync = CreditSyncService.getInstance();

// Simple wrapper function for backward compatibility
export async function syncCredits(force = false): Promise<number> {
  const service = CreditSyncService.getInstance();
  await service.syncCredits({ force });
  
  // Return current balance from store
  const { balance } = useCreditsStore.getState();
  return balance;
}

// React hook for easy use in components
export function useCreditSync() {
  const service = CreditSyncService.getInstance();
  
  return {
    sync: (options?: CreditSyncOptions) => service.syncCredits(options),
    forceSync: () => service.forceSyncCredits(),
    periodicSync: () => service.periodicSyncCredits(),
    isSyncNeeded: () => service.isSyncNeeded(),
    timeUntilNextSync: () => service.getTimeUntilNextSync(),
    startPeriodicSync: (intervalMs?: number) => service.startPeriodicSync(intervalMs),
    stopPeriodicSync: () => service.stopPeriodicSync(),
    forceSyncNow: () => service.forceSyncNow(),
    getSyncStatus: () => service.getSyncStatus(),
    syncAfterOperation: (expectedNewBalance?: number) => service.syncAfterOperation(expectedNewBalance),
  };
} 