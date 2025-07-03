// React Query Client Configuration
import { QueryClient, DefaultOptions } from '@tanstack/react-query'
import { useErrorStore } from '../store/error-store'
import { ErrorSeverity } from '../store/types'

// Default query options with professional error handling
const defaultOptions: DefaultOptions = {
  queries: {
    // Cache for 5 minutes by default
    staleTime: 5 * 60 * 1000,
    // Keep in cache for 10 minutes
    gcTime: 10 * 60 * 1000,
    // Retry failed requests 3 times
    retry: (failureCount, error: any) => {
      // Don't retry on 4xx errors (client errors)
      if (error?.status >= 400 && error?.status < 500) {
        return false
      }
      // Retry up to 3 times for other errors
      return failureCount < 3
    },
    // Retry with exponential backoff
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
    // Refetch on window focus for critical data
    refetchOnWindowFocus: false,
    // Refetch on reconnect
    refetchOnReconnect: true,
    // Network mode
    networkMode: 'online',
    refetchOnMount: true,
  },
  mutations: {
    // Retry mutations once on network failure
    retry: (failureCount, error: any) => {
      if (error?.name === 'NetworkError' && failureCount < 2) {
        return true
      }
      return false
    },
    // Retry delay for mutations
    retryDelay: 1000,
    // Network mode for mutations
    networkMode: 'online',
  },
}

// Create query client with enhanced error handling
export const createQueryClient = () => {
  return new QueryClient({
    defaultOptions,
    // Global error handler
    mutationCache: undefined, // Will be set up with error handling
    queryCache: undefined,    // Will be set up with error handling
  })
}

// Enhanced query client with store integration
let queryClient: QueryClient | null = null

export const getQueryClient = () => {
  if (!queryClient) {
    queryClient = new QueryClient({
      defaultOptions,
    })

    // Set up global error handling
    queryClient.setMutationDefaults(['default'], {
      onError: (error: any, variables, context) => {
        console.error('Mutation error:', error)
        
        // Add error to store if available
        try {
          const errorStore = useErrorStore.getState?.()
          if (errorStore) {
            errorStore.addError({
              message: error?.message || 'An unexpected error occurred',
              severity: ErrorSeverity.ERROR,
              code: error?.code || 'MUTATION_ERROR',
              context: {
                variables,
                error: error?.toString(),
                stack: error?.stack
              }
            })
          }
        } catch (storeError) {
          console.error('Failed to add error to store:', storeError)
        }
      }
    })

    // Global query error handling will be handled by individual queries
    // React Query v5 doesn't support global query onError in setQueryDefaults
  }

  return queryClient
}

// Query key factories for consistent cache management
export const queryKeys = {
  // Credits queries
  credits: {
    balance: ['credits', 'balance'] as const,
    transactions: (limit?: number) => ['credits', 'transactions', { limit }] as const,
    all: ['credits'] as const,
  },
  
  // Jobs queries
  jobs: {
    all: ['jobs'] as const,
    byStatus: (status: string) => ['jobs', 'status', status] as const,
    byType: (type: string) => ['jobs', 'type', type] as const,
    byId: (id: string) => ['jobs', id] as const,
    active: ['jobs', 'active'] as const,
  },
  
  // AI operations
  ai: {
    maskGeneration: (imageUrl: string) => ['ai', 'mask', imageUrl] as const,
    emptyRoom: (imageUrl: string, maskUrl: string) => ['ai', 'empty-room', imageUrl, maskUrl] as const,
    roomStaging: (imageUrl: string, prompt: string) => ['ai', 'staging', imageUrl, prompt] as const,
  },
  
  // User data
  user: {
    profile: ['user', 'profile'] as const,
    preferences: ['user', 'preferences'] as const,
  },
  
  // System status
  system: {
    health: ['system', 'health'] as const,
    status: ['system', 'status'] as const,
  },
  
  // Staging
  staging: {
    presets: ['staging', 'presets'] as const,
    history: ['staging', 'history'] as const,
  }
} as const

// Cache invalidation utilities
export const cacheUtils = {
  // Invalidate all credits-related queries
  invalidateCredits: () => {
    const client = getQueryClient()
    return client.invalidateQueries({ queryKey: queryKeys.credits.all })
  },
  
  // Invalidate specific job queries
  invalidateJob: (jobId: string) => {
    const client = getQueryClient()
    return Promise.all([
      client.invalidateQueries({ queryKey: queryKeys.jobs.byId(jobId) }),
      client.invalidateQueries({ queryKey: queryKeys.jobs.all }),
      client.invalidateQueries({ queryKey: queryKeys.jobs.active }),
    ])
  },
  
  // Invalidate jobs by status
  invalidateJobsByStatus: (status: string) => {
    const client = getQueryClient()
    return client.invalidateQueries({ queryKey: queryKeys.jobs.byStatus(status) })
  },
  
  // Force refresh of active jobs
  refreshActiveJobs: () => {
    const client = getQueryClient()
    return client.invalidateQueries({ 
      queryKey: queryKeys.jobs.active,
      refetchType: 'active'
    })
  },
  
  // Clear all cached data
  clearAllCache: () => {
    const client = getQueryClient()
    return client.clear()
  },
  
  // Optimistic update for credits
  updateCreditsOptimistically: (newBalance: number) => {
    const client = getQueryClient()
    client.setQueryData(queryKeys.credits.balance, newBalance)
  },
  
  // Optimistic update for job status
  updateJobStatusOptimistically: (jobId: string, newStatus: string) => {
    const client = getQueryClient()
    client.setQueryData(queryKeys.jobs.byId(jobId), (oldData: any) => {
      if (oldData) {
        return { ...oldData, status: newStatus }
      }
      return oldData
    })
  }
}

// Pre-loading utilities for performance
export const preloadUtils = {
  // Preload user's credit balance
  preloadCredits: async () => {
    const client = getQueryClient()
    return client.prefetchQuery({
      queryKey: queryKeys.credits.balance,
      queryFn: () => fetch('/api/credits/balance', { credentials: 'include' }).then(res => res.json()),
      staleTime: 2 * 60 * 1000, // Consider fresh for 2 minutes
    })
  },
  
  // Preload active jobs
  preloadActiveJobs: async () => {
    const client = getQueryClient()
    return client.prefetchQuery({
      queryKey: queryKeys.jobs.active,
      queryFn: () => fetch('/api/jobs/active', { credentials: 'include' }).then(res => res.json()),
      staleTime: 30 * 1000, // Consider fresh for 30 seconds
    })
  },
  
  // Preload system health
  preloadSystemHealth: async () => {
    const client = getQueryClient()
    return client.prefetchQuery({
      queryKey: queryKeys.system.health,
      queryFn: () => fetch('/api/system/health', { credentials: 'include' }).then(res => res.json()),
      staleTime: 60 * 1000, // Consider fresh for 1 minute
    })
  }
}

// Cleanup utilities
export const cleanupUtils = {
  // Remove old cached data
  cleanupOldCache: () => {
    const client = getQueryClient()
    // Remove queries that haven't been used in 30 minutes
    client.removeQueries({
      predicate: (query) => {
        return Date.now() - query.state.dataUpdatedAt > 30 * 60 * 1000
      }
    })
  },
  
  // Remove failed queries
  cleanupFailedQueries: () => {
    const client = getQueryClient()
    client.removeQueries({
      predicate: (query) => query.state.status === 'error'
    })
  }
}

// Query functions with proper error handling
export const queryFunctions = {
  // Credits balance
  getCreditsBalance: async () => {
    const response = await fetch('/api/credits/balance', {
      credentials: 'include' // CRITICAL FIX: Include authentication cookies
    })
    if (!response.ok) {
      throw new Error(`Failed to fetch credits: ${response.status}`)
    }
    return response.json()
  },
  
  // Active jobs
  getActiveJobs: async () => {
    const response = await fetch('/api/jobs/active', {
      credentials: 'include' // CRITICAL FIX: Include authentication cookies
    })
    if (!response.ok) {
      throw new Error(`Failed to fetch jobs: ${response.status}`)
    }
    return response.json()
  },
  
  // System health
  getSystemHealth: async () => {
    const response = await fetch('/api/system/health', {
      credentials: 'include' // CRITICAL FIX: Include authentication cookies
    })
    if (!response.ok) {
      throw new Error(`Failed to fetch system health: ${response.status}`)
    }
    return response.json()
  },
  
  // Job by ID
  getJobById: async (jobId: string) => {
    const response = await fetch(`/api/jobs/${jobId}`, {
      credentials: 'include' // CRITICAL FIX: Include authentication cookies
    })
    if (!response.ok) {
      throw new Error(`Failed to fetch job ${jobId}: ${response.status}`)
    }
    return response.json()
  }
}

// Error handling utilities
export const errorUtils = {
  // Check if error is a network error
  isNetworkError: (error: any) => {
    return error?.name === 'TypeError' && error?.message?.includes('fetch')
  },
  
  // Check if error is authentication error
  isAuthError: (error: any) => {
    return error?.status === 401 || error?.status === 403
  },
  
  // Check if error is server error
  isServerError: (error: any) => {
    return error?.status >= 500
  },
  
  // Get user-friendly error message
  getErrorMessage: (error: any) => {
    if (errorUtils.isNetworkError(error)) {
      return 'Network connection error. Please check your internet connection.'
    }
    
    if (errorUtils.isAuthError(error)) {
      return 'Authentication error. Please refresh the page and try again.'
    }
    
    if (errorUtils.isServerError(error)) {
      return 'Server error. Please try again later.'
    }
    
    return error?.message || 'An unexpected error occurred.'
  }
}

// Performance monitoring
export const performanceUtils = {
  // Log slow queries
  logSlowQuery: (queryKey: readonly unknown[], duration: number) => {
    if (duration > 3000) { // Log queries slower than 3 seconds
      console.warn('[Query Performance] Slow query detected:', {
        queryKey,
        duration: `${duration}ms`
      })
    }
  },
  
  // Get cache statistics
  getCacheStats: () => {
    const cache = getQueryClient().getQueryCache()
    const queries = cache.getAll()
    
    return {
      totalQueries: queries.length,
      staleQueries: queries.filter(q => q.isStale()).length,
      activeQueries: queries.filter(q => q.getObserversCount() > 0).length,
      errorQueries: queries.filter(q => q.state.status === 'error').length
    }
  }
} 