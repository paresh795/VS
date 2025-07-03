import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useJobsStore } from '@/lib/store/jobs-store'
import { JobType, JobStatus } from '@/lib/store/types'
import { toast } from 'sonner'

interface GenerateStagingRequest {
  originalImageUrl: string
  emptyRoomUrl: string
  style: string
  space: string
}

interface GenerateStagingResponse {
  success: boolean
  jobId: string
  stagedUrls: string[]
  creditsUsed: number
}

// Generate staging API call
const generateStaging = async (data: GenerateStagingRequest): Promise<GenerateStagingResponse> => {
  const response = await fetch('/api/stage', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(data),
  })

  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.error || 'Failed to generate staging')
  }

  return response.json()
}

// React Query hook for staging generation
export const useGenerateStaging = () => {
  const queryClient = useQueryClient()
  const { createJob, updateJobStatus, completeJob, failJob, updateJob } = useJobsStore()

  return useMutation({
    mutationFn: generateStaging,
    onMutate: async ({ originalImageUrl, style, space }) => {
      // Create a job in the store for immediate UI feedback
      const clientJobId = createJob({
        type: JobType.ROOM_STAGING,
        imageUrl: originalImageUrl,
        status: JobStatus.PENDING,
        progress: 0,
        metadata: {
          operation: 'staging_generation',
          style,
          space,
          startTime: Date.now()
        }
      })

      // Update job status to processing
      updateJobStatus(clientJobId, JobStatus.PROCESSING, 10)

      toast.info('Generating staged room variants...', {
        description: 'This may take up to 2 minutes'
      })

      return { clientJobId }
    },
    onSuccess: (data, variables, context) => {
      if (context?.clientJobId && data.jobId && data.stagedUrls?.length >= 2) {
        // Update the client job with the database job ID and result
        updateJob(context.clientJobId, {
          status: JobStatus.COMPLETED,
          progress: 100,
          resultUrl: data.stagedUrls[0], // Primary result
          metadata: {
            ...context.clientJobId ? useJobsStore.getState().jobs[context.clientJobId]?.metadata : {},
            databaseJobId: data.jobId, // CRITICAL: Store database job ID for sync
            creditsUsed: data.creditsUsed,
            resultUrls: data.stagedUrls,
            stagedUrls: data.stagedUrls,
            completedAt: new Date().toISOString()
          }
        })
        
        // Complete the job in the store
        completeJob(context.clientJobId, data.stagedUrls[0])
        
        toast.success('Staging completed successfully!', {
          description: `Generated ${data.stagedUrls.length} variants using ${data.creditsUsed} credits`
        })
      }

      // Invalidate related queries
      queryClient.invalidateQueries({ queryKey: ['credits'] })
      queryClient.invalidateQueries({ queryKey: ['jobs'] })
    },
    onError: (error: Error, variables, context) => {
      if (context?.clientJobId) {
        // Mark job as failed in the store
        failJob(context.clientJobId, error.message)
      }

      // Handle specific error types
      if (error.message.includes('Insufficient credits')) {
        toast.error('Insufficient credits', {
          description: 'Please purchase more credits to continue',
          action: {
            label: 'Buy Credits',
            onClick: () => {
              // Navigate to billing page
              window.location.href = '/dashboard/billing'
            }
          }
        })
      } else {
        toast.error('Failed to generate staging', {
          description: error.message
        })
      }
    }
  })
}

// Progress simulation for better UX
export const useStagingProgress = (jobId: string) => {
  const { updateJobProgress } = useJobsStore()

  const simulateProgress = () => {
    let progress = 10
    const interval = setInterval(() => {
      progress += Math.random() * 15
      if (progress >= 90) {
        progress = 90 // Stop at 90% until actual completion
        clearInterval(interval)
      }
      updateJobProgress(jobId, progress)
    }, 1500) // Slightly slower than empty room

    return () => clearInterval(interval)
  }

  return { simulateProgress }
} 