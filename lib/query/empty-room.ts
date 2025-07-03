import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useJobsStore } from '@/lib/store/jobs-store'
import { useCreditsStore } from '@/lib/store/credits-store'
import { JobType, JobStatus } from '@/lib/store/types'
import { CREDIT_COSTS } from '@/lib/constants'
import { toast } from 'sonner'

interface GenerateEmptyRoomRequest {
  imageUrl: string
}

interface GenerateEmptyRoomResponse {
  success: boolean
  jobId: string
  emptyRoomUrl: string
  creditsUsed: number
}

// Generate empty room API call
const generateEmptyRoom = async (data: GenerateEmptyRoomRequest): Promise<GenerateEmptyRoomResponse> => {
  const response = await fetch('/api/empty-room', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(data),
  })

  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.error || 'Failed to generate empty room')
  }

  return response.json()
}

// React Query hook for empty room generation
export const useGenerateEmptyRoom = () => {
  const queryClient = useQueryClient()
  const { createJob, updateJobStatus, completeJob, failJob, updateJob } = useJobsStore()
  const { deductCredits: deductCreditsFromStore, addCredits: addCreditsToStore, balance } = useCreditsStore()

  return useMutation({
    mutationFn: generateEmptyRoom,
    onMutate: async ({ imageUrl }) => {
      // ✨ IMMEDIATE CREDIT DEDUCTION FOR UI
      const creditCost = CREDIT_COSTS.MASK_AND_EMPTY
      
      // Check if user has enough credits
      if (balance < creditCost) {
        toast.error(`Insufficient credits. Required: ${creditCost}, Available: ${balance}`)
        throw new Error(`Insufficient credits. Required: ${creditCost}, Available: ${balance}`)
      }
      
      // Deduct credits immediately from UI
      try {
        deductCreditsFromStore(creditCost, 'empty-room-pending', 'Empty Room Generation')
        toast.info(`Deducted ${creditCost} credits. Generation starting...`)
      } catch (storeError) {
        toast.error('Failed to deduct credits from local store')
        throw new Error('Failed to deduct credits from local store')
      }

      // Create a job in the store for immediate UI feedback
      const clientJobId = createJob({
        type: JobType.EMPTY_ROOM,
        imageUrl,
        status: JobStatus.PENDING,
        progress: 0,
        metadata: {
          operation: 'empty_room_generation',
          startTime: Date.now(),
          creditsDeducted: creditCost
        }
      })

      // Update job status to processing
      updateJobStatus(clientJobId, JobStatus.PROCESSING, 10)

      toast.info('Generating empty room...', {
        description: 'This may take up to 2 minutes'
      })

      return { clientJobId, creditCost }
    },
    onSuccess: (data, variables, context) => {
      if (context?.clientJobId && data.jobId && data.emptyRoomUrl) {
        // Update the client job with the database job ID and result
        updateJob(context.clientJobId, {
          id: data.jobId, // Store the database UUID
          resultUrl: data.emptyRoomUrl,
          metadata: {
            ...context.clientJobId ? useJobsStore.getState().jobs[context.clientJobId]?.metadata : {},
            databaseJobId: data.jobId,
            creditsUsed: data.creditsUsed,
            resultUrls: [data.emptyRoomUrl]
          }
        })
        
        // Complete the job in the store
        completeJob(context.clientJobId, data.emptyRoomUrl)
        
        toast.success('Empty room generated successfully!', {
          description: `Used ${data.creditsUsed} credits`
        })
      }

      // Invalidate related queries
      queryClient.invalidateQueries({ queryKey: ['credits'] })
      queryClient.invalidateQueries({ queryKey: ['jobs'] })
    },
    onError: (error: Error, variables, context) => {
      // 🔄 ROLLBACK CREDITS ON FAILURE
      if (context?.creditCost) {
        console.log('🔄 [Empty Room] Rolling back credits in UI due to failure...')
        addCreditsToStore(context.creditCost, 'Empty Room Refund - Generation Failed')
      }

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
        toast.error('Failed to generate empty room', {
          description: error.message
        })
      }
    }
  })
}

// Progress simulation for better UX
export const useEmptyRoomProgress = (jobId: string) => {
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
    }, 1000)

    return () => clearInterval(interval)
  }

  return { simulateProgress }
} 