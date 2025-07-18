// Real-Time Synchronization System
import { useJobsStore } from '../store/jobs-store'
import { useCreditsStore } from '../store/credits-store'
import { useErrorStore } from '../store/error-store'
import { ErrorSeverity } from '../store/types'

// Polling configuration
const POLLING_INTERVALS = {
  ACTIVE_JOBS: 3000,      // 3 seconds for active jobs
  CREDITS: 10000,         // 10 seconds for credits
  SYSTEM_HEALTH: 30000,   // 30 seconds for system health
  IDLE_JOBS: 30000,       // 30 seconds for completed/failed jobs
} as const

// Real-time sync manager
class RealTimeSyncManager {
  private intervals: Map<string, NodeJS.Timeout> = new Map()
  private isActive = false
  private visibilityState: 'visible' | 'hidden' = 'visible'
  
  constructor() {
    this.setupVisibilityHandling()
  }

  // Start all synchronization
  start() {
    if (this.isActive) return
    
    this.isActive = true
    console.log('[Sync] Starting real-time synchronization')
    
    // Start different sync processes
    this.startJobsSync()
    this.startCreditsSync()
    this.startSystemHealthSync()
  }

  // Stop all synchronization
  stop() {
    if (!this.isActive) return
    
    this.isActive = false
    console.log('[Sync] Stopping real-time synchronization')
    
    // Clear all intervals
    for (const [key, interval] of this.intervals) {
      clearInterval(interval)
      this.intervals.delete(key)
    }
  }

  // Handle visibility changes (optimize when tab is hidden)
  private setupVisibilityHandling() {
    if (typeof document === 'undefined') return

    document.addEventListener('visibilitychange', () => {
      this.visibilityState = document.hidden ? 'hidden' : 'visible'
      
      if (this.visibilityState === 'visible') {
        // Immediately sync when tab becomes visible
        this.syncActiveJobs()
        this.syncCredits()
      }
    })
  }

  // Jobs synchronization
  private startJobsSync() {
    // Sync active jobs frequently
    const activeJobsInterval = setInterval(() => {
      if (this.shouldSync()) {
        this.syncActiveJobs()
      }
    }, this.getPollingInterval('ACTIVE_JOBS'))
    
    this.intervals.set('activeJobs', activeJobsInterval)

    // Sync all jobs less frequently
    const allJobsInterval = setInterval(() => {
      if (this.shouldSync()) {
        this.syncAllJobs()
      }
    }, this.getPollingInterval('IDLE_JOBS'))
    
    this.intervals.set('allJobs', allJobsInterval)
  }

  // Credits synchronization
  private startCreditsSync() {
    const creditsInterval = setInterval(() => {
      if (this.shouldSync()) {
        this.syncCredits()
      }
    }, this.getPollingInterval('CREDITS'))
    
    this.intervals.set('credits', creditsInterval)
  }

  // System health synchronization
  private startSystemHealthSync() {
    const healthInterval = setInterval(() => {
      if (this.shouldSync()) {
        this.syncSystemHealth()
      }
    }, this.getPollingInterval('SYSTEM_HEALTH'))
    
    this.intervals.set('systemHealth', healthInterval)
  }

  // Check if we should sync (consider visibility, online status, etc.)
  private shouldSync(): boolean {
    if (!this.isActive) return false
    if (!navigator.onLine) return false
    
    // Reduce sync frequency when tab is hidden
    if (this.visibilityState === 'hidden') {
      // Only sync occasionally when hidden
      return Math.random() < 0.1 // 10% chance
    }
    
    return true
  }

  // Get polling interval based on visibility
  private getPollingInterval(key: keyof typeof POLLING_INTERVALS): number {
    const baseInterval = POLLING_INTERVALS[key]
    
    // Increase interval when tab is hidden
    if (this.visibilityState === 'hidden') {
      return baseInterval * 3
    }
    
    return baseInterval
  }

  // Sync active jobs
  private async syncActiveJobs() {
    try {
      // Fetch active jobs from the database via API
      const response = await fetch('/api/jobs/active', {
        method: 'GET',
        headers: { 
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache'
        },
        credentials: 'include'
      })

      if (!response.ok) {
        // Don't log 401 errors as they're expected during auth state transitions
        if (response.status === 401) {
          return
        }
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }
      
      const data = await response.json()
      const databaseJobs = data.jobs || []
      
      if (databaseJobs.length === 0) return

      console.log('[Sync] Found active database jobs:', databaseJobs.length)

      // Fetch latest status for each active database job
      const updates = await Promise.allSettled(
        databaseJobs.map((dbJob: { id: string }) => this.fetchJobStatus(dbJob.id))
      )

      const jobsStore = useJobsStore.getState()

      updates.forEach((result, index) => {
        if (result.status === 'fulfilled' && result.value?.job) {
          const dbJob = databaseJobs[index]
          const newJobData = result.value.job
          
          console.log('[Sync] Checking job update:', {
            jobId: dbJob.id,
            oldStatus: dbJob.status,
            newStatus: newJobData.status,
            oldProgress: dbJob.progress,
            newProgress: newJobData.progress,
            resultUrls: newJobData.resultUrls
          })
          
          // Find the corresponding client job by database ID in metadata or by matching imageUrl
          const clientJob = Object.values(jobsStore.jobs).find(job => {
            // First try to match by database job ID (most reliable)
            if (job.metadata?.databaseJobId === dbJob.id) {
              return true
            }
            
            // Fallback: match by imageUrl and type for jobs that haven't been linked yet
            if (job.imageUrl === dbJob.imageUrl && job.type === dbJob.type) {
              // Ensure this isn't already linked to another database job
              return !job.metadata?.databaseJobId
            }
            
            return false
          })
          
          if (clientJob) {
            // Update client job if status changed
            if (clientJob.status !== newJobData.status || clientJob.progress !== newJobData.progress) {
              const resultUrl = newJobData.resultUrls?.[0] || newJobData.resultUrl
              
              jobsStore.updateJob(clientJob.id, {
                status: newJobData.status,
                progress: newJobData.progress,
                resultUrl: resultUrl,
                maskUrl: newJobData.maskUrl,
                errorMessage: newJobData.errorMessage,
                metadata: {
                  ...clientJob.metadata,
                  databaseJobId: dbJob.id, // Ensure database job ID is always set
                  lastSyncTime: new Date().toISOString()
                }
              })
              
              console.log('[Sync] Updated client job:', clientJob.id, 'to status:', newJobData.status)
            } else {
              // Even if status didn't change, ensure database job ID is linked
              if (!clientJob.metadata?.databaseJobId) {
                jobsStore.updateJob(clientJob.id, {
                  metadata: {
                    ...clientJob.metadata,
                    databaseJobId: dbJob.id,
                    lastSyncTime: new Date().toISOString()
              }
                })
                console.log('[Sync] Linked client job:', clientJob.id, 'to database job:', dbJob.id)
              }
            }
          } else {
            // Only log as missing if this is a recent job (within last hour)
            const jobAge = Date.now() - new Date(dbJob.createdAt || 0).getTime()
            if (jobAge < 60 * 60 * 1000) { // 1 hour
              console.log('[Sync] No matching client job found for recent database job:', dbJob.id, 'type:', dbJob.type)
        }
          }
        }
      })
    } catch (error) {
      this.handleSyncError('Failed to sync active jobs', error)
    }
  }

  // Sync all jobs (less frequent)
  private async syncAllJobs() {
    try {
      const response = await fetch('/api/jobs/active?all=true', {
        method: 'GET',
        headers: { 
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache'
        },
        credentials: 'include'
      })
      
      if (!response.ok) return
      
      // Handle all jobs sync
      console.log('[Sync] All jobs sync completed')
    } catch (error) {
      console.warn('[Sync] All jobs sync failed:', error)
    }
  }

  // Sync credits
  private async syncCredits() {
    try {
      const response = await fetch('/api/credits/balance', {
        method: 'GET',
        headers: { 
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache'
        },
        credentials: 'include'
      })
      
      if (!response.ok) {
        // Don't log 401 errors as they're expected during auth state transitions
        if (response.status === 401) {
          return
        }
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }
      
      const data = await response.json()
      
      if (typeof data.balance === 'number') {
      const creditsStore = useCreditsStore.getState()
        const currentBalance = creditsStore.balance
        
        if (currentBalance !== data.balance) {
        creditsStore.setBalance(data.balance)
          console.log('[Sync] Credits updated:', data.balance)
        }
      }
    } catch (error) {
      this.handleSyncError('Failed to sync credits', error)
    }
  }

  // Sync system health
  private async syncSystemHealth() {
    try {
      const response = await fetch('/api/system/health', {
        method: 'GET',
        headers: { 
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache'
        },
        credentials: 'include'
      })
      
      if (!response.ok) return
      
      const data = await response.json()
      console.log('[Sync] System health:', data.status)
    } catch (error) {
      console.warn('[Sync] System health check failed:', error)
    }
  }

  // Fetch individual job status
  private async fetchJobStatus(jobId: string) {
    try {
    const response = await fetch(`/api/jobs/${jobId}`, {
      method: 'GET',
        headers: { 
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache'
        },
        credentials: 'include'
    })
    
      if (!response.ok) {
        // Don't log 401 errors as they're expected during auth state transitions
        if (response.status === 401) {
          return null
        }
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }
    
    return await response.json()
    } catch (error) {
      this.handleSyncError(`Failed to fetch job status for ${jobId}`, error)
      return null
    }
  }

  // Handle sync errors
  private handleSyncError(message: string, error: any) {
    console.error(`[Sync] ${message}:`, error)
    
    const errorStore = useErrorStore.getState()
    errorStore.addError({
      message: message,
      severity: ErrorSeverity.WARNING,
      context: {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        timestamp: new Date().toISOString()
      }
    })
  }
}

// Singleton instance
let syncManagerInstance: RealTimeSyncManager | null = null

export const getSyncManager = (): RealTimeSyncManager => {
  if (!syncManagerInstance) {
    syncManagerInstance = new RealTimeSyncManager()
  }
  return syncManagerInstance
}

// React hook for using real-time sync with authentication awareness
export const useRealTimeSync = (enabled = true) => {
  const syncManager = getSyncManager()
  
  // Only run in browser environment
  if (typeof window === 'undefined') {
    return {
      start: () => {},
      stop: () => {},
      syncNow: {
        jobs: () => {},
        credits: () => {},
        health: () => {}
      }
    }
  }

  // This hook should only start sync when explicitly called by authenticated components
  // We no longer auto-start here to prevent unauthorized API calls
  
  // Cleanup on unmount
  window.addEventListener('beforeunload', () => {
    syncManager.stop()
  })
  
  return {
    start: () => syncManager.start(),
    stop: () => syncManager.stop(),
    syncNow: {
      jobs: () => syncManager['syncActiveJobs'](),
      credits: () => syncManager['syncCredits'](),
      health: () => syncManager['syncSystemHealth']()
    }
  }
}

// Webhook handler for real-time updates
export const handleWebhookUpdate = (data: {
  type: 'job_update' | 'credits_update' | 'system_update'
  payload: any
}) => {
  const syncManager = getSyncManager()
  
  switch (data.type) {
    case 'job_update':
      syncManager['syncActiveJobs']()
      break
    case 'credits_update':
      syncManager['syncCredits']()
      break
    case 'system_update':
      syncManager['syncSystemHealth']()
      break
  }
}

// Export for manual triggering
export const triggerSync = {
  jobs: () => getSyncManager()['syncActiveJobs'](),
  credits: () => getSyncManager()['syncCredits'](),
  health: () => getSyncManager()['syncSystemHealth'](),
  all: () => {
    const manager = getSyncManager()
    manager['syncActiveJobs']()
    manager['syncCredits']()
    manager['syncSystemHealth']()
  }
} 