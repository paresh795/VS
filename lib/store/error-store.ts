// Error Store - Professional Error Management
import { create } from 'zustand'
import { devtools } from 'zustand/middleware'
import { immer } from 'zustand/middleware/immer'
import { ErrorState, AppError, ErrorSeverity } from './types'

// Error store actions
interface ErrorActions {
  // Error creation
  addError: (error: Omit<AppError, 'id' | 'timestamp' | 'dismissed'>) => string
  addSimpleError: (message: string, severity?: ErrorSeverity, context?: Record<string, any>) => string
  
  // Error management
  dismissError: (errorId: string) => void
  dismissAllErrors: () => void
  dismissErrorsByType: (code: string) => void
  
  // Global error handling
  setGlobalError: (error: AppError | null) => void
  clearGlobalError: () => void
  
  // Recovery management
  setRecovering: (recovering: boolean) => void
  
  // Utilities
  getErrorsWithSeverity: (severity: ErrorSeverity) => AppError[]
  hasActiveErrors: () => boolean
  getLatestError: () => AppError | null
  
  // Cleanup
  clearOldErrors: (olderThanHours?: number) => void
  reset: () => void
}

export interface ErrorStore extends ErrorState, ErrorActions {}

// Initial state
const initialState: ErrorState = {
  errors: [],
  globalError: null,
  isRecovering: false
}

// Error store implementation
export const useErrorStore = create<ErrorStore>()(
  devtools(
    immer((set, get) => ({
      ...initialState,

      // Error creation
      addError: (errorData) => {
        const errorId = `err_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
        
        const error: AppError = {
          ...errorData,
          id: errorId,
          timestamp: new Date(),
          dismissed: false
        }

        set((state) => {
          state.errors.unshift(error)
          
          // Keep errors manageable - remove old errors after 100
          if (state.errors.length > 100) {
            state.errors = state.errors.slice(0, 100)
          }
          
          // Set as global error if critical
          if (error.severity === ErrorSeverity.CRITICAL && !state.globalError) {
            state.globalError = error
          }
        })

        return errorId
      },

      addSimpleError: (message, severity = ErrorSeverity.ERROR, context) => {
        return get().addError({
          message,
          severity,
          context
        })
      },

      // Error management
      dismissError: (errorId) => {
        set((state) => {
          const error = state.errors.find(e => e.id === errorId)
          if (error) {
            error.dismissed = true
          }
          
          // Clear global error if dismissed
          if (state.globalError?.id === errorId) {
            state.globalError = null
          }
        })
      },

      dismissAllErrors: () => {
        set((state) => {
          state.errors.forEach(error => {
            error.dismissed = true
          })
          state.globalError = null
        })
      },

      dismissErrorsByType: (code) => {
        set((state) => {
          state.errors.forEach(error => {
            if (error.code === code) {
              error.dismissed = true
            }
          })
          
          // Clear global error if it matches the type
          if (state.globalError?.code === code) {
            state.globalError = null
          }
        })
      },

      // Global error handling
      setGlobalError: (error) => {
        set((state) => {
          state.globalError = error
        })
      },

      clearGlobalError: () => {
        set((state) => {
          state.globalError = null
        })
      },

      // Recovery management
      setRecovering: (recovering) => {
        set((state) => {
          state.isRecovering = recovering
        })
      },

      // Utilities
      getErrorsWithSeverity: (severity) => {
        return get().errors.filter(error => 
          error.severity === severity && !error.dismissed
        )
      },

      hasActiveErrors: () => {
        return get().errors.some(error => !error.dismissed)
      },

      getLatestError: () => {
        const errors = get().errors
        return errors.find(error => !error.dismissed) || null
      },

      // Cleanup
      clearOldErrors: (olderThanHours = 24) => {
        const cutoffTime = new Date(Date.now() - olderThanHours * 60 * 60 * 1000)
        
        set((state) => {
          state.errors = state.errors.filter(error => 
            error.timestamp > cutoffTime || !error.dismissed
          )
        })
      },

      reset: () => {
        set((state) => {
          Object.assign(state, initialState)
        })
      }
    })),
    {
      name: 'error-store'
    }
  )
)

// Selector hooks for optimized re-renders
export const useActiveErrors = () => useErrorStore((state) => 
  state.errors.filter(error => !error.dismissed)
)

export const useErrorsBySeverity = (severity: ErrorSeverity) => useErrorStore((state) =>
  state.errors.filter(error => error.severity === severity && !error.dismissed)
)

export const useCriticalErrors = () => useErrorStore((state) =>
  state.errors.filter(error => 
    error.severity === ErrorSeverity.CRITICAL && !error.dismissed
  )
)

export const useGlobalError = () => useErrorStore((state) => state.globalError)
export const useIsRecovering = () => useErrorStore((state) => state.isRecovering)

export const useErrorCount = () => useErrorStore((state) => 
  state.errors.filter(error => !error.dismissed).length
)

export const useHasErrors = () => useErrorStore((state) => 
  state.errors.some(error => !error.dismissed)
)

// Error creation utilities
export const useErrorActions = () => {
  const addError = useErrorStore((state) => state.addError)
  const addSimpleError = useErrorStore((state) => state.addSimpleError)
  
  return {
    addError,
    addSimpleError,
    // Convenience methods
    addInfo: (message: string, context?: Record<string, any>) => 
      addSimpleError(message, ErrorSeverity.INFO, context),
    addWarning: (message: string, context?: Record<string, any>) => 
      addSimpleError(message, ErrorSeverity.WARNING, context),
    addCritical: (message: string, context?: Record<string, any>) => 
      addSimpleError(message, ErrorSeverity.CRITICAL, context)
  }
} 