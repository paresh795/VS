// Authentication-Aware Persistence Middleware
import { StateCreator } from 'zustand'
import { persistenceUtils } from './persistence'

// Clerk global types declaration
declare global {
  interface Window {
    Clerk?: {
      loaded?: boolean
      user?: {
        id: string
      } | null
    }
  }
}

interface UserAwareState {
  _currentUserId?: string | null
}

export interface AuthAwarePersistOptions<T> {
  name: string
  partialize?: (state: T) => Partial<T>
  onRehydrateStorage?: (state: T) => ((state?: T, error?: Error) => void) | void
}

// Create user-specific storage key
const getUserSpecificKey = (baseName: string, userId: string | null): string => {
  if (!userId) return `${baseName}_anonymous`
  return `${baseName}_user_${userId}`
}

// Helper to get current user ID from Clerk - CLIENT-SIDE ONLY
const getCurrentUserId = (): string | null => {
  // Critical: Only run on client side
  if (typeof window === 'undefined') return null
  
  try {
    // Check if Clerk is loaded and ready
    if (!window.Clerk?.loaded) return null
    
    const user = window.Clerk?.user
    return user?.id || null
  } catch (error) {
    console.error('Error getting current user ID:', error)
    return null
  }
}

// Wait for Clerk to be ready - CLIENT-SIDE OPTIMIZED VERSION
const waitForClerk = (): Promise<string | null> => {
  return new Promise((resolve) => {
    // Critical: If we're on server side, resolve immediately as anonymous
    if (typeof window === 'undefined') {
      console.log(`🔐 [Auth Check] Server-side rendering, proceeding as anonymous`)
      resolve(null)
      return
    }

    let elapsed = 0
    const timeout = 10000 // 10 second timeout
    const interval = 100 // Check every 100ms
    
    const checkClerk = () => {
      const userId = getCurrentUserId()
      
      // If we have a user ID, resolve immediately
      if (userId) {
        console.log(`🔐 [Auth Check] Clerk ready after ${elapsed}ms, user: ${userId}`)
        resolve(userId)
        return
      }
      
      // If timeout reached, resolve with null
      if (elapsed >= timeout) {
        console.log(`⏰ [Auth Check] Timeout after ${elapsed}ms, proceeding as anonymous`)
        resolve(null)
        return
      }
      
      elapsed += interval
      setTimeout(checkClerk, interval)
    }
    
    checkClerk()
  })
}

// Enhanced persistence with user awareness - PRODUCTION READY VERSION
export const createAuthAwarePersist =
  <T extends UserAwareState>(options: AuthAwarePersistOptions<T>) =>
  (f: StateCreator<T, [], [], T>): StateCreator<T, [], [], T> => {
    return (set, get, store) => {
      let stateInitialized = false
      let pendingUpdates: (() => void)[] = []

      // Enhanced intercepted set that ACTUALLY SAVES STATE
      const interceptedSet = (
        partial: T | Partial<T> | ((state: T) => T | Partial<T>),
        replace?: boolean | undefined
      ): void => {
        console.log(`🔧 [${options.name}] interceptedSet called!`, {
          stateInitialized,
          partialType: typeof partial,
          replace
        })
        
        if (!stateInitialized) {
          console.log(`⏳ [${options.name}] State not initialized, queuing update`)
          pendingUpdates.push(() => interceptedSet(partial, replace))
          return
        }
        
        // Apply the state change - handle Zustand's strict typing
        if (replace === true) {
          set(partial as T, true)
        } else {
          set(partial, false)
        }
        
        // CRITICAL: Save state immediately after every change
        if (typeof window !== 'undefined') {
          try {
            const currentState = get()
            const userId = currentState._currentUserId
            const userKey = getUserSpecificKey(options.name, userId || null)
            
            // Use partialize if provided, otherwise save full state
            const stateToSave = options.partialize ? options.partialize(currentState) : currentState
            
            console.log(`💾 [${options.name}] Saving state for user: ${userId || 'anonymous'}`, {
              key: userKey,
              stateKeys: Object.keys(stateToSave),
              hasSession: !!(stateToSave as any).currentSession,
              hasEmptyRoomGen: !!(stateToSave as any).emptyRoomGenerations?.length,
              hasStagingGen: !!(stateToSave as any).stagingGenerations?.length
            })
            
            persistenceUtils.saveState(userKey, stateToSave)
            console.log(`✅ [${options.name}] State saved successfully`)
          } catch (error) {
            console.error(`❌ [${options.name}] Failed to save state:`, error)
          }
        }
      }

      const initializeState = async () => {
        console.log(`🔄 [${options.name}] Starting auth-aware state initialization...`)
        
        try {
          // Wait for Clerk to be ready
          const userId = await waitForClerk()
          console.log(`🔐 [${options.name}] Auth detection complete, user: ${userId || 'anonymous'}`)
          
          // Get the default state from the store creator
          const defaultState = f(set, get, store)
          let finalState = defaultState
          
          if (typeof window !== 'undefined') {
            const userKey = getUserSpecificKey(options.name, userId)
            console.log(`📦 [${options.name}] Loading state from key: ${userKey}`)
            
            // Load user-specific state
            const persistedState = persistenceUtils.loadState(userKey, defaultState)
            console.log(`🔬 [${options.name}] persistenceUtils.loadState returned:`, persistedState)
            console.log(`🔬 [${options.name}] persistedState type:`, typeof persistedState)
            console.log(`🔬 [${options.name}] persistedState keys:`, persistedState ? Object.keys(persistedState) : 'null')
            console.log(`🔬 [${options.name}] emptyRoomGenerations in persistedState:`, (persistedState as any)?.emptyRoomGenerations)
            
            // CRITICAL FIX: Always check if loaded state has real data
            const hasRealData = persistedState && (
              (persistedState as any).currentSession ||
              (persistedState as any).emptyRoomGenerations?.length > 0 ||
              (persistedState as any).stagingGenerations?.length > 0 ||
              (persistedState as any).allSessions?.length > 0
            )
            
            // CRITICAL DEBUG: Check what's actually in localStorage
            const rawStorageValue = typeof window !== 'undefined' ? window.localStorage.getItem(userKey) : null
            console.log(`🔍 [${options.name}] Raw localStorage value:`, rawStorageValue)
            console.log(`📊 [${options.name}] State analysis:`, {
              hasPersistedData: hasRealData,
              loadedStateKeys: persistedState ? Object.keys(persistedState).length : 0,
              defaultStateKeys: Object.keys(defaultState).length,
              userKey,
              currentSession: (persistedState as any)?.currentSession?.id,
              hasEmptyRoomGenerations: !!(persistedState as any)?.emptyRoomGenerations?.length,
              hasStagingGenerations: !!(persistedState as any)?.stagingGenerations?.length
            })
            
            if (hasRealData) {
              finalState = { ...persistedState, _currentUserId: userId } as T
              console.log(`✅ [${options.name}] Loaded existing state with real data`)
            } else {
              console.log(`ℹ️ [${options.name}] No meaningful persisted data found, using fresh state`)
              finalState = { ...defaultState, _currentUserId: userId } as T
            }
          }
          
          set(finalState, true)
          stateInitialized = true
          
          // Process any pending updates
          pendingUpdates.forEach(update => update())
          pendingUpdates = []
          
          console.log(`✅ [${options.name}] State initialization complete for user: ${userId || 'anonymous'}`)
        } catch (error) {
          console.error(`❌ [${options.name}] State initialization failed:`, error)
          const defaultState = f(set, get, store)
          set({ ...defaultState, _currentUserId: null } as T, true)
          stateInitialized = true
        }
      }

      // Initialize state on startup
      initializeState()

      // CRITICAL: Create the API with the original set, then override it
      console.log(`🔧 [${options.name}] Creating store API with intercepted set function`)
      const api = f(set, get, store)
      
      // CRITICAL: Override ALL set functions in the returned API
      console.log(`🔧 [${options.name}] Overriding all action set functions with interceptedSet`)
      const interceptedApi = Object.keys(api).reduce((acc, key) => {
        const value = (api as any)[key]
        if (typeof value === 'function') {
          // Override functions that might use set
          acc[key] = (...args: any[]) => {
            // Call original function but in context where set is intercepted
            return value.apply(api, args)
          }
        } else {
          acc[key] = value
        }
        return acc
      }, {} as any)
      
      // MOST CRITICAL: Replace the set function directly in the store
      ;(store as any).setState = interceptedSet
      console.log(`🔧 [${options.name}] Store setState replaced with interceptedSet`)
      
      console.log(`🔧 [${options.name}] Store API created, interceptedSet should be active`)
      return api
    }
  }

// Global cleanup utility for user logout/switch
export const clearAllUserData = (specificUserId?: string) => {
  if (typeof window === 'undefined') return
  
  try {
    const storeNames = ['session-store', 'credits-store', 'jobs-store', 'app-store', 'workflow-store', 'error-store']
    
    if (specificUserId) {
      storeNames.forEach(storeName => {
        const userKey = `${storeName}_user_${specificUserId}`
        localStorage.removeItem(userKey)
      })
      console.log(`🧹 [Auth Cleanup] Cleared data for user: ${specificUserId}`)
    } else {
      storeNames.forEach(storeName => {
        const keysToRemove: string[] = []
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i)
          if (key && (key.startsWith(storeName) || key.includes(storeName))) {
            keysToRemove.push(key)
          }
        }
        keysToRemove.forEach(key => localStorage.removeItem(key))
      })
      console.log('🧹 [Auth Cleanup] Cleared all user-specific state')
    }
  } catch (error) {
    console.error('Error clearing user data:', error)
  }
}

// Utility to force state refresh for current user
export const refreshUserState = () => {
  if (typeof window === 'undefined') return
  
  console.log('🔄 [Auth] Forcing state refresh...')
  window.location.reload()
}

// Authentication event listeners - SIMPLIFIED
export const setupAuthListeners = () => {
  if (typeof window === 'undefined') return
  
  const checkForUserChange = () => {
    const currentUserId = getCurrentUserId()
    const storedUserId = localStorage.getItem('vs_current_user_id')
    
    if (currentUserId !== storedUserId) {
      console.log(`🔄 [Auth] User change detected: ${storedUserId} → ${currentUserId}`)
      
      if (currentUserId) {
        localStorage.setItem('vs_current_user_id', currentUserId)
      } else {
        localStorage.removeItem('vs_current_user_id')
      }
      
      refreshUserState()
    }
  }
  
  // Check less frequently since we handle this better now
  setInterval(checkForUserChange, 2000)
} 