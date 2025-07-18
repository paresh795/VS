'use client'

// State Management Providers - Professional Integration with Auth Cleanup
import React, { useEffect, useState } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ReactQueryDevtools } from '@tanstack/react-query-devtools'
import { getQueryClient, preloadUtils, cleanupUtils } from '@/lib/query/client'
import { useAppStore } from '@/lib/store/app-store'
import { useCreditsStore } from '@/lib/store/credits-store'
import { useJobsStore } from '@/lib/store/jobs-store'
import { useErrorStore } from '@/lib/store/error-store'
import { useSessionStore } from '@/lib/store/session-store'
import { persistenceUtils } from '@/lib/store/middleware/persistence'
import { clearAllUserData } from '@/lib/store/middleware/auth-aware-persistence'
import { ErrorSeverity } from '@/lib/store/types'
import { useRealTimeSync } from '@/lib/realtime/sync'
import { useAuth } from '@clerk/nextjs'

interface StateProvidersProps {
  children: React.ReactNode
}

// Global auth state cleanup component
const AuthStateManager: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isSignedIn, userId } = useAuth()
  const [previousUserId, setPreviousUserId] = useState<string | null>(null)
  
  // Store reset functions
  const resetSession = useSessionStore((state) => state.resetAll)
  const resetCredits = useCreditsStore((state) => state.reset)
  const resetJobs = useJobsStore((state) => state.reset)
  const resetApp = useAppStore((state) => state.reset)
  const resetErrors = useErrorStore((state) => state.reset)

  useEffect(() => {
    // Handle user changes
    if (previousUserId && userId && previousUserId !== userId) {
      console.log('🔄 [Auth Manager] User switch detected - clearing state')
      
      // Clear all stores
      resetSession()
      resetCredits()
      resetJobs()
      resetApp()
      resetErrors()
      
      // Clear localStorage
      clearAllUserData()
    }
    
    // Handle sign out
    if (previousUserId && !isSignedIn) {
      console.log('🛑 [Auth Manager] User signed out - clearing all data')
      
      resetSession()
      resetCredits()
      resetJobs()
      resetApp()
      resetErrors()
      clearAllUserData()
    }
    
    setPreviousUserId(userId || null)
  }, [isSignedIn, userId, previousUserId, resetSession, resetCredits, resetJobs, resetApp, resetErrors])

  return <>{children}</>
}

// App initialization component
const AppInitializer: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isInitialized, setIsInitialized] = useState(false)
  const initializeApp = useAppStore((state) => state.initialize)
  const setAppInitialized = useAppStore((state) => state.setInitialized)

  useEffect(() => {
    let mounted = true

    const initializeApplication = async () => {
      try {
        // Initialize app store
        initializeApp()
        
        // Preload critical data
        await Promise.allSettled([
          preloadUtils.preloadCredits(),
          preloadUtils.preloadActiveJobs(),
          preloadUtils.preloadSystemHealth(),
        ])
        
        // Set up periodic cleanup
        const cleanupInterval = setInterval(() => {
          cleanupUtils.cleanupOldCache()
          cleanupUtils.cleanupFailedQueries()
        }, 10 * 60 * 1000) // Clean up every 10 minutes

        if (mounted) {
          setAppInitialized(true)
          setIsInitialized(true)
        }

        // Cleanup function
        return () => {
          clearInterval(cleanupInterval)
        }
      } catch (error) {
        console.error('Failed to initialize app:', error)
        
        // Add error to store
        const errorStore = useErrorStore.getState()
        errorStore.addSimpleError(
          'Failed to initialize application. Some features may not work correctly.',
          ErrorSeverity.ERROR
        )
        
        if (mounted) {
          setIsInitialized(true) // Still allow app to continue
        }
      }
    }

    initializeApplication()

    return () => {
      mounted = false
    }
  }, [initializeApp, setAppInitialized])

  // Show loading state during initialization
  if (!isInitialized) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    )
  }

  return <>{children}</>
}

// Store synchronization component
const StoreSynchronizer: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const setOnline = useAppStore((state) => state.setOnline)
  const updateSyncTime = useAppStore((state) => state.updateSyncTime)
  
  // Initialize sync hook (but don't auto-start - will be started by authenticated components)
  useRealTimeSync(false)

  useEffect(() => {
    // Set up online/offline detection
    const handleOnline = () => {
      setOnline(true)
      updateSyncTime()
    }
    
    const handleOffline = () => {
      setOnline(false)
    }

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    // Set up visibility change handling
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        updateSyncTime()
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)

    // Set up periodic sync
    const syncInterval = setInterval(() => {
      if (navigator.onLine) {
        updateSyncTime()
      }
    }, 5 * 60 * 1000) // Sync every 5 minutes

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      clearInterval(syncInterval)
    }
  }, [setOnline, updateSyncTime])

  return <>{children}</>
}

// Error boundary for state management
class StateErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; error?: Error }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('State management error:', error, errorInfo)
    
    // Try to add error to store if possible
    try {
      const errorStore = useErrorStore.getState()
      errorStore.addError({
        message: `Critical application error: ${error.message}`,
        severity: ErrorSeverity.CRITICAL,
        code: 'STATE_ERROR',
        context: {
          error: error.toString(),
          stack: error.stack,
          componentStack: errorInfo.componentStack
        }
      })
    } catch (storeError) {
      console.error('Failed to report error to store:', storeError)
    }
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center min-h-screen p-8">
          <div className="max-w-md text-center">
            <h2 className="text-2xl font-bold text-red-600 mb-4">
              Application Error
            </h2>
            <p className="text-gray-600 mb-4">
              Something went wrong with the application state. Please refresh the page to continue.
            </p>
            <button
              onClick={() => window.location.reload()}
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
            >
              Refresh Page
            </button>
            <details className="mt-4 text-left">
              <summary className="cursor-pointer text-sm text-gray-500">
                Error Details
              </summary>
              <pre className="mt-2 text-xs text-gray-400 overflow-auto">
                {this.state.error?.stack}
              </pre>
            </details>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}

// Main state providers component
export const StateProviders: React.FC<StateProvidersProps> = ({ children }) => {
  const [queryClient] = useState(() => getQueryClient())

  return (
    <StateErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <AuthStateManager>
        <StoreSynchronizer>
          <AppInitializer>
            {children}
          </AppInitializer>
        </StoreSynchronizer>
        </AuthStateManager>
        {/* React Query DevTools - only in development */}
        {process.env.NODE_ENV === 'development' && (
          <ReactQueryDevtools 
            initialIsOpen={false}
          />
        )}
      </QueryClientProvider>
    </StateErrorBoundary>
  )
}

// Utility hook to check if state management is ready
export const useStateReady = () => {
  const isInitialized = useAppStore((state) => state.isInitialized)
  const hasErrors = useErrorStore((state) => 
    state.errors.some(error => 
      !error.dismissed && error.severity === 'critical'
    )
  )
  
  return {
    isReady: isInitialized && !hasErrors,
    isInitialized,
    hasErrors
  }
}

// Hook for manual store rehydration
export const useStoreRehydration = () => {
  const resetCredits = useCreditsStore((state) => state.reset)
  const resetJobs = useJobsStore((state) => state.reset)
  const resetApp = useAppStore((state) => state.reset)
  const resetErrors = useErrorStore((state) => state.reset)

  const rehydrateStores = () => {
    try {
      // Clear all stores
      resetCredits()
      resetJobs() 
      resetApp()
      resetErrors()
      
      // Clear persistence
      persistenceUtils.clearAllState()
      
      // Reinitialize app
      window.location.reload()
    } catch (error) {
      console.error('Failed to rehydrate stores:', error)
    }
  }

  return { rehydrateStores }
} 