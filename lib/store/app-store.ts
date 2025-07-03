// App Store - Main Application State
import { create } from 'zustand'
import { devtools, persist } from 'zustand/middleware'
import { immer } from 'zustand/middleware/immer'
import { AppState } from './types'

// App store actions
interface AppActions {
  // Initialization
  initialize: () => void
  setInitialized: (initialized: boolean) => void
  
  // Network status
  setOnline: (online: boolean) => void
  updateSyncTime: () => void
  
  // Theme management
  setTheme: (theme: 'light' | 'dark' | 'system') => void
  
  // Preferences
  setPreference: (key: string, value: any) => void
  getPreference: (key: string, defaultValue?: any) => any
  clearPreferences: () => void
  
  // Reset
  reset: () => void
}

export interface AppStore extends AppState, AppActions {}

// Initial state
const initialState: AppState = {
  isInitialized: false,
  isOnline: true,
  lastSyncTime: null,
  theme: 'system',
  preferences: {}
}

// App store implementation
export const useAppStore = create<AppStore>()(
  devtools(
    persist(
      immer((set, get) => ({
        ...initialState,

        // Initialization
        initialize: () => {
          set((state) => {
            state.isInitialized = true
            state.lastSyncTime = new Date()
            state.isOnline = navigator.onLine
          })

          // Set up online/offline listeners
          if (typeof window !== 'undefined') {
            const handleOnline = () => get().setOnline(true)
            const handleOffline = () => get().setOnline(false)
            
            window.addEventListener('online', handleOnline)
            window.addEventListener('offline', handleOffline)
            
            // Cleanup on unmount (Note: In a real app, this would be handled by a component)
            // return () => {
            //   window.removeEventListener('online', handleOnline)
            //   window.removeEventListener('offline', handleOffline)
            // }
          }
        },

        setInitialized: (initialized) => {
          set((state) => {
            state.isInitialized = initialized
          })
        },

        // Network status
        setOnline: (online) => {
          set((state) => {
            state.isOnline = online
            if (online) {
              state.lastSyncTime = new Date()
            }
          })
        },

        updateSyncTime: () => {
          set((state) => {
            state.lastSyncTime = new Date()
          })
        },

        // Theme management
        setTheme: (theme) => {
          set((state) => {
            state.theme = theme
          })

          // Apply theme to document if in browser
          if (typeof window !== 'undefined') {
            const root = window.document.documentElement
            
            if (theme === 'system') {
              const systemTheme = window.matchMedia('(prefers-color-scheme: dark)').matches 
                ? 'dark' 
                : 'light'
              root.classList.toggle('dark', systemTheme === 'dark')
            } else {
              root.classList.toggle('dark', theme === 'dark')
            }
          }
        },

        // Preferences
        setPreference: (key, value) => {
          set((state) => {
            state.preferences[key] = value
          })
        },

        getPreference: (key, defaultValue) => {
          const preferences = get().preferences
          return preferences.hasOwnProperty(key) ? preferences[key] : defaultValue
        },

        clearPreferences: () => {
          set((state) => {
            state.preferences = {}
          })
        },

        // Reset
        reset: () => {
          set((state) => {
            Object.assign(state, initialState)
          })
        }
      })),
      {
        name: 'app-store',
        partialize: (state) => ({
          theme: state.theme,
          preferences: state.preferences
        })
      }
    ),
    {
      name: 'app-store'
    }
  )
)

// Selector hooks for optimized re-renders
export const useIsInitialized = () => useAppStore((state) => state.isInitialized)
export const useIsOnline = () => useAppStore((state) => state.isOnline)
export const useTheme = () => useAppStore((state) => state.theme)
export const useLastSyncTime = () => useAppStore((state) => state.lastSyncTime)

export const usePreferences = () => useAppStore((state) => state.preferences)
export const usePreference = (key: string, defaultValue?: any) => 
  useAppStore((state) => state.preferences[key] ?? defaultValue)

// App status selector
export const useAppStatus = () => useAppStore((state) => ({
  isInitialized: state.isInitialized,
  isOnline: state.isOnline,
  lastSyncTime: state.lastSyncTime,
  theme: state.theme
})) 