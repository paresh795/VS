// Persistence Middleware - Advanced State Persistence
import { StateCreator, StoreMutatorIdentifier } from 'zustand'

// Custom persistence interface extending Zustand's built-in
export interface PersistOptions<T> {
  name: string
  partialize?: (state: T) => Partial<T>
  merge?: (persistedState: unknown, currentState: T) => T
  skipHydration?: boolean
  version?: number
  migrate?: (persistedState: any, version: number) => T
  getStorage?: () => Storage
  serialize?: (state: Partial<T>) => string
  deserialize?: (str: string) => Partial<T>
  onRehydrateStorage?: (state: T) => ((state?: T, error?: Error) => void) | void
}

// Enhanced persistence hook with validation and error handling
export const useStoreWithPersistence = <T>(
  storeName: string,
  fallbackState: T
): T => {
  try {
    if (typeof window === 'undefined') {
      return fallbackState
    }

    const stored = localStorage.getItem(storeName)
    if (!stored) {
      return fallbackState
    }

    const parsed = JSON.parse(stored)
    
    // Validate the parsed state structure
    if (typeof parsed !== 'object' || parsed === null) {
      console.warn(`Invalid persisted state for ${storeName}, using fallback`)
      return fallbackState
    }

    // Merge with fallback to ensure all required properties exist
    return { ...fallbackState, ...parsed.state }
    
  } catch (error) {
    console.error(`Error loading persisted state for ${storeName}:`, error)
    return fallbackState
  }
}

// Storage utilities for manual state management
export const persistenceUtils = {
  // Save state to localStorage with error handling
  saveState: <T>(key: string, state: T): boolean => {
    try {
      if (typeof window === 'undefined') return false
      
      const serialized = JSON.stringify({
        state,
        timestamp: Date.now(),
        version: 1
      })
      
      localStorage.setItem(key, serialized)
      return true
    } catch (error) {
      console.error(`Error saving state to ${key}:`, error)
      return false
    }
  },

  // Load state from localStorage with validation
  loadState: <T>(key: string, fallback: T): T => {
    try {
      if (typeof window === 'undefined') return fallback
      
      const stored = localStorage.getItem(key)
      if (!stored) return fallback
      
      const parsed = JSON.parse(stored)
      
      // Check if state is too old (7 days)
      const maxAge = 7 * 24 * 60 * 60 * 1000 // 7 days
      if (parsed.timestamp && Date.now() - parsed.timestamp > maxAge) {
        console.info(`Cached state for ${key} expired, using fallback`)
        return fallback
      }
      
      return { ...fallback, ...parsed.state }
    } catch (error) {
      console.error(`Error loading state from ${key}:`, error)
      return fallback
    }
  },

  // Clear specific stored state
  clearState: (key: string): boolean => {
    try {
      if (typeof window === 'undefined') return false
      localStorage.removeItem(key)
      return true
    } catch (error) {
      console.error(`Error clearing state ${key}:`, error)
      return false
    }
  },

  // Clear all app-related stored state
  clearAllState: (): boolean => {
    try {
      if (typeof window === 'undefined') return false
      
      const keysToRemove = []
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i)
        if (key && (key.includes('-store') || key.includes('vs-app'))) {
          keysToRemove.push(key)
        }
      }
      
      keysToRemove.forEach(key => localStorage.removeItem(key))
      return true
    } catch (error) {
      console.error('Error clearing all app state:', error)
      return false
    }
  },

  // Get storage usage info
  getStorageInfo: () => {
    try {
      if (typeof window === 'undefined') return null
      
      let totalSize = 0
      const items: Record<string, number> = {}
      
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i)
        if (key) {
          const value = localStorage.getItem(key)
          if (value) {
            const size = new Blob([value]).size
            items[key] = size
            totalSize += size
          }
        }
      }
      
      return {
        totalSize,
        totalSizeKB: Math.round(totalSize / 1024),
        items,
        quota: 5 * 1024 * 1024, // Typical localStorage quota (5MB)
        usagePercent: Math.round((totalSize / (5 * 1024 * 1024)) * 100)
      }
    } catch (error) {
      console.error('Error getting storage info:', error)
      return null
    }
  }
}

// Storage event listener for cross-tab synchronization
export const createStorageListener = (
  storeName: string, 
  onStorageChange: (newState: any) => void
) => {
  if (typeof window === 'undefined') return () => {}

  const handleStorageChange = (e: StorageEvent) => {
    if (e.key === storeName && e.newValue) {
      try {
        const parsed = JSON.parse(e.newValue)
        onStorageChange(parsed.state)
      } catch (error) {
        console.error('Error parsing storage change:', error)
      }
    }
  }

  window.addEventListener('storage', handleStorageChange)
  
  return () => {
    window.removeEventListener('storage', handleStorageChange)
  }
}

// Migration utilities for state version updates
export const migrationUtils = {
  // Create a migration function
  createMigration: <TFrom, TTo>(
    fromVersion: number,
    toVersion: number,
    migrateFn: (state: TFrom) => TTo
  ) => ({
    fromVersion,
    toVersion,
    migrate: migrateFn
  }),

  // Apply migrations in sequence
  applyMigrations: <T>(
    persistedState: any,
    currentVersion: number,
    migrations: Array<{
      fromVersion: number
      toVersion: number
      migrate: (state: any) => any
    }>
  ): T => {
    let state = persistedState
    const stateVersion = persistedState?.version || 0

    if (stateVersion < currentVersion) {
      const applicableMigrations = migrations
        .filter(m => m.fromVersion >= stateVersion && m.toVersion <= currentVersion)
        .sort((a, b) => a.fromVersion - b.fromVersion)

      for (const migration of applicableMigrations) {
        try {
          state = migration.migrate(state)
          state.version = migration.toVersion
        } catch (error) {
          console.error(`Migration from v${migration.fromVersion} to v${migration.toVersion} failed:`, error)
          throw error
        }
      }
    }

    return state
  }
}

// Backup and restore utilities
export const backupUtils = {
  // Create a full app state backup
  createBackup: (): string | null => {
    try {
      if (typeof window === 'undefined') return null
      
      const backup: Record<string, any> = {}
      
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i)
        if (key && (key.includes('-store') || key.includes('vs-app'))) {
          const value = localStorage.getItem(key)
          if (value) {
            backup[key] = JSON.parse(value)
          }
        }
      }
      
      return JSON.stringify({
        backup,
        timestamp: Date.now(),
        version: 1
      })
    } catch (error) {
      console.error('Error creating backup:', error)
      return null
    }
  },

  // Restore from backup
  restoreBackup: (backupData: string): boolean => {
    try {
      if (typeof window === 'undefined') return false
      
      const parsed = JSON.parse(backupData)
      
      if (!parsed.backup || typeof parsed.backup !== 'object') {
        throw new Error('Invalid backup format')
      }
      
      // Clear existing state
      persistenceUtils.clearAllState()
      
      // Restore backup
      Object.entries(parsed.backup).forEach(([key, value]) => {
        localStorage.setItem(key, JSON.stringify(value))
      })
      
      return true
    } catch (error) {
      console.error('Error restoring backup:', error)
      return false
    }
  }
} 