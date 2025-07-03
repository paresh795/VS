// Jobs Store - Professional Job Management
import { create } from 'zustand'
import { devtools, persist } from 'zustand/middleware'
import { immer } from 'zustand/middleware/immer'
import { JobsState, Job, JobStatus, JobType } from './types'

// Jobs store actions
interface JobsActions {
  // Job lifecycle management
  createJob: (jobData: Omit<Job, 'id' | 'createdAt' | 'updatedAt'>) => string
  updateJob: (jobId: string, updates: Partial<Job>) => void
  updateJobStatus: (jobId: string, status: JobStatus, progress?: number) => void
  updateJobProgress: (jobId: string, progress: number) => void
  completeJob: (jobId: string, resultUrl?: string, maskUrl?: string) => void
  failJob: (jobId: string, error: string) => void
  cancelJob: (jobId: string) => void
  removeJob: (jobId: string) => void
  
  // Job querying
  getJob: (jobId: string) => Job | undefined
  getJobsByType: (type: JobType) => Job[]
  getJobsByStatus: (status: JobStatus) => Job[]
  getActiveJobs: () => Job[]
  getLatestJob: (type?: JobType) => Job | undefined
  
  // Batch operations
  cancelAllJobs: () => void
  clearCompletedJobs: () => void
  clearFailedJobs: () => void
  
  // State management
  setProcessing: (processing: boolean) => void
  reset: () => void
}

export interface JobsStore extends JobsState, JobsActions {}

// Initial state
const initialState: JobsState = {
  jobs: {},
  activeJobs: [],
  jobHistory: [],
  isProcessing: false
}

// Job store implementation
export const useJobsStore = create<JobsStore>()(
  devtools(
    persist(
      immer((set, get) => ({
        ...initialState,

        // Job lifecycle management
        createJob: (jobData) => {
          const jobId = `job_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
          const now = new Date()
          
          const job: Job = {
            ...jobData,
            id: jobId,
            progress: 0,
            status: JobStatus.PENDING,
            createdAt: now,
            updatedAt: now
          }

          set((state) => {
            state.jobs[jobId] = job
            state.activeJobs.push(jobId)
            state.jobHistory.unshift(jobId)
            
            // Keep job history manageable
            if (state.jobHistory.length > 200) {
              const oldJobId = state.jobHistory.pop()
              if (oldJobId && state.jobs[oldJobId]?.status === JobStatus.COMPLETED) {
                delete state.jobs[oldJobId]
              }
            }
          })

          return jobId
        },

        updateJob: (jobId, updates) => {
          set((state) => {
            const job = state.jobs[jobId]
            if (job) {
              Object.assign(job, updates)
              job.updatedAt = new Date()
            }
          })
        },

        updateJobStatus: (jobId, status, progress) => {
          set((state) => {
            const job = state.jobs[jobId]
            if (job) {
              job.status = status
              job.updatedAt = new Date()
              
              if (progress !== undefined) {
                job.progress = progress
              }

              // Manage active jobs list
              const isActive = [JobStatus.PENDING, JobStatus.PROCESSING].includes(status)
              const currentlyActive = state.activeJobs.includes(jobId)
              
              if (isActive && !currentlyActive) {
                state.activeJobs.push(jobId)
              } else if (!isActive && currentlyActive) {
                state.activeJobs = state.activeJobs.filter(id => id !== jobId)
              }

              // Update processing state
              state.isProcessing = state.activeJobs.length > 0
            }
          })
        },

        updateJobProgress: (jobId, progress) => {
          set((state) => {
            const job = state.jobs[jobId]
            if (job) {
              job.progress = Math.max(0, Math.min(100, progress))
              job.updatedAt = new Date()
            }
          })
        },

        completeJob: (jobId, resultUrl, maskUrl) => {
          set((state) => {
            const job = state.jobs[jobId]
            if (job) {
              job.status = JobStatus.COMPLETED
              job.progress = 100
              job.updatedAt = new Date()
              
              if (resultUrl) job.resultUrl = resultUrl
              if (maskUrl) job.maskUrl = maskUrl
              
              // Remove from active jobs
              state.activeJobs = state.activeJobs.filter(id => id !== jobId)
              state.isProcessing = state.activeJobs.length > 0
            }
          })
        },

        failJob: (jobId, error) => {
          set((state) => {
            const job = state.jobs[jobId]
            if (job) {
              job.status = JobStatus.FAILED
              job.errorMessage = error
              job.updatedAt = new Date()
              
              // Remove from active jobs
              state.activeJobs = state.activeJobs.filter(id => id !== jobId)
              state.isProcessing = state.activeJobs.length > 0
            }
          })
        },

        cancelJob: (jobId) => {
          set((state) => {
            const job = state.jobs[jobId]
            if (job) {
              job.status = JobStatus.CANCELLED
              job.updatedAt = new Date()
              
              // Remove from active jobs
              state.activeJobs = state.activeJobs.filter(id => id !== jobId)
              state.isProcessing = state.activeJobs.length > 0
            }
          })
        },

        removeJob: (jobId) => {
          set((state) => {
            delete state.jobs[jobId]
            state.activeJobs = state.activeJobs.filter(id => id !== jobId)
            state.jobHistory = state.jobHistory.filter(id => id !== jobId)
            state.isProcessing = state.activeJobs.length > 0
          })
        },

        // Job querying
        getJob: (jobId) => {
          return get().jobs[jobId]
        },

        getJobsByType: (type) => {
          const { jobs } = get()
          return Object.values(jobs).filter(job => job.type === type)
        },

        getJobsByStatus: (status) => {
          const { jobs } = get()
          return Object.values(jobs).filter(job => job.status === status)
        },

        getActiveJobs: () => {
          const { jobs, activeJobs } = get()
          return activeJobs.map(id => jobs[id]).filter(Boolean)
        },

        getLatestJob: (type) => {
          const { jobs, jobHistory } = get()
          for (const jobId of jobHistory) {
            const job = jobs[jobId]
            if (job && (!type || job.type === type)) {
              return job
            }
          }
          return undefined
        },

        // Batch operations
        cancelAllJobs: () => {
          set((state) => {
            state.activeJobs.forEach(jobId => {
              const job = state.jobs[jobId]
              if (job) {
                job.status = JobStatus.CANCELLED
                job.updatedAt = new Date()
              }
            })
            state.activeJobs = []
            state.isProcessing = false
          })
        },

        clearCompletedJobs: () => {
          set((state) => {
            const completedJobIds = Object.keys(state.jobs).filter(
              jobId => state.jobs[jobId].status === JobStatus.COMPLETED
            )
            
            completedJobIds.forEach(jobId => {
              delete state.jobs[jobId]
            })
            
            state.jobHistory = state.jobHistory.filter(
              jobId => !completedJobIds.includes(jobId)
            )
          })
        },

        clearFailedJobs: () => {
          set((state) => {
            const failedJobIds = Object.keys(state.jobs).filter(
              jobId => state.jobs[jobId].status === JobStatus.FAILED
            )
            
            failedJobIds.forEach(jobId => {
              delete state.jobs[jobId]
            })
            
            state.jobHistory = state.jobHistory.filter(
              jobId => !failedJobIds.includes(jobId)
            )
          })
        },

        // State management
        setProcessing: (processing) => {
          set((state) => {
            state.isProcessing = processing
          })
        },

        reset: () => {
          set((state) => {
            Object.assign(state, initialState)
          })
        }
      })),
      {
        name: 'jobs-store',
        partialize: (state) => ({
          jobs: state.jobs,
          jobHistory: state.jobHistory.slice(0, 50), // Persist only recent job history
        })
      }
    ),
    {
      name: 'jobs-store'
    }
  )
)

// Selector hooks for optimized re-renders
export const useActiveJobs = () => useJobsStore((state) => 
  state.activeJobs.map(id => state.jobs[id]).filter(Boolean)
)

export const useJobsByType = (type: JobType) => useJobsStore((state) =>
  Object.values(state.jobs).filter(job => job.type === type)
)

export const useJobsByStatus = (status: JobStatus) => useJobsStore((state) =>
  Object.values(state.jobs).filter(job => job.status === status)
)

export const useIsProcessing = () => useJobsStore((state) => state.isProcessing)

export const useJobProgress = (jobId: string) => useJobsStore((state) => {
  const job = state.jobs[jobId]
  return job ? { progress: job.progress, status: job.status } : null
})

export const useLatestJobOfType = (type: JobType) => useJobsStore((state) => {
  for (const jobId of state.jobHistory) {
    const job = state.jobs[jobId]
    if (job && job.type === type) {
      return job
    }
  }
  return null
}) 