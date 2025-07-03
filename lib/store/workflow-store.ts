// Workflow Store - Multi-Step Process Management
import { create } from 'zustand'
import { devtools, persist } from 'zustand/middleware'
import { immer } from 'zustand/middleware/immer'
import { WorkflowState, Workflow, WorkflowStep, JobStatus, JobType } from './types'

// Workflow store actions
interface WorkflowActions {
  // Workflow lifecycle
  createWorkflow: (imageUrl: string, steps: Omit<WorkflowStep, 'id'>[]) => string
  updateWorkflow: (workflowId: string, updates: Partial<Workflow>) => void
  
  // Step management
  updateStep: (workflowId: string, stepIndex: number, updates: Partial<WorkflowStep>) => void
  completeCurrentStep: (workflowId: string, result: any) => void
  failCurrentStep: (workflowId: string, error: string) => void
  advanceToNextStep: (workflowId: string) => void
  
  // Workflow control
  startWorkflow: (workflowId: string) => void
  pauseWorkflow: () => void
  resumeWorkflow: () => void
  cancelWorkflow: (workflowId: string) => void
  completeWorkflow: (workflowId: string, finalResult: string) => void
  
  // Current workflow management
  setCurrentWorkflow: (workflow: Workflow | null) => void
  getCurrentStep: () => WorkflowStep | null
  isWorkflowComplete: (workflowId: string) => boolean
  
  // Cleanup
  clearHistory: () => void
  reset: () => void
}

export interface WorkflowStore extends WorkflowState, WorkflowActions {}

// Initial state
const initialState: WorkflowState = {
  currentWorkflow: null,
  workflowHistory: [],
  isRunning: false
}

// Workflow store implementation
export const useWorkflowStore = create<WorkflowStore>()(
  devtools(
    persist(
      immer((set, get) => ({
        ...initialState,

        // Workflow lifecycle
        createWorkflow: (imageUrl, stepDefs) => {
          const workflowId = `workflow_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
          const now = new Date()
          
          const steps: WorkflowStep[] = stepDefs.map((stepDef, index) => ({
            ...stepDef,
            id: `step_${index}_${Math.random().toString(36).substr(2, 6)}`,
            status: index === 0 ? JobStatus.PENDING : JobStatus.IDLE
          }))

          const workflow: Workflow = {
            id: workflowId,
            steps,
            currentStepIndex: 0,
            imageUrl,
            createdAt: now,
            updatedAt: now
          }

          set((state) => {
            state.workflowHistory.unshift(workflow)
            
            // Keep history manageable
            if (state.workflowHistory.length > 50) {
              state.workflowHistory = state.workflowHistory.slice(0, 50)
            }
          })

          return workflowId
        },

        updateWorkflow: (workflowId, updates) => {
          set((state) => {
            const workflow = state.workflowHistory.find(w => w.id === workflowId)
            if (workflow) {
              Object.assign(workflow, updates)
              workflow.updatedAt = new Date()
            }
            
            if (state.currentWorkflow?.id === workflowId) {
              Object.assign(state.currentWorkflow, updates)
              state.currentWorkflow.updatedAt = new Date()
            }
          })
        },

        // Step management
        updateStep: (workflowId, stepIndex, updates) => {
          set((state) => {
            const workflow = state.workflowHistory.find(w => w.id === workflowId)
            if (workflow && workflow.steps[stepIndex]) {
              Object.assign(workflow.steps[stepIndex], updates)
              workflow.updatedAt = new Date()
            }
            
            if (state.currentWorkflow?.id === workflowId && state.currentWorkflow.steps[stepIndex]) {
              Object.assign(state.currentWorkflow.steps[stepIndex], updates)
              state.currentWorkflow.updatedAt = new Date()
            }
          })
        },

        completeCurrentStep: (workflowId, result) => {
          set((state) => {
            const workflow = state.currentWorkflow
            if (workflow && workflow.id === workflowId) {
              const currentStep = workflow.steps[workflow.currentStepIndex]
              if (currentStep) {
                currentStep.status = JobStatus.COMPLETED
                currentStep.result = result
                workflow.updatedAt = new Date()
              }
            }
          })
        },

        failCurrentStep: (workflowId, error) => {
          set((state) => {
            const workflow = state.currentWorkflow
            if (workflow && workflow.id === workflowId) {
              const currentStep = workflow.steps[workflow.currentStepIndex]
              if (currentStep) {
                currentStep.status = JobStatus.FAILED
                currentStep.error = error
                workflow.updatedAt = new Date()
              }
              state.isRunning = false
            }
          })
        },

        advanceToNextStep: (workflowId) => {
          set((state) => {
            const workflow = state.currentWorkflow
            if (workflow && workflow.id === workflowId) {
              const nextIndex = workflow.currentStepIndex + 1
              
              if (nextIndex < workflow.steps.length) {
                workflow.currentStepIndex = nextIndex
                workflow.steps[nextIndex].status = JobStatus.PENDING
                workflow.updatedAt = new Date()
              } else {
                // Workflow completed
                state.isRunning = false
              }
            }
          })
        },

        // Workflow control
        startWorkflow: (workflowId) => {
          set((state) => {
            const workflow = state.workflowHistory.find(w => w.id === workflowId)
            if (workflow) {
              state.currentWorkflow = { ...workflow }
              state.isRunning = true
              
              // Set first step to pending
              if (workflow.steps.length > 0) {
                state.currentWorkflow.steps[0].status = JobStatus.PENDING
                state.currentWorkflow.updatedAt = new Date()
              }
            }
          })
        },

        pauseWorkflow: () => {
          set((state) => {
            state.isRunning = false
            if (state.currentWorkflow) {
              const currentStep = state.currentWorkflow.steps[state.currentWorkflow.currentStepIndex]
              if (currentStep && currentStep.status === JobStatus.PROCESSING) {
                currentStep.status = JobStatus.PENDING
              }
            }
          })
        },

        resumeWorkflow: () => {
          set((state) => {
            if (state.currentWorkflow) {
              state.isRunning = true
              const currentStep = state.currentWorkflow.steps[state.currentWorkflow.currentStepIndex]
              if (currentStep && currentStep.status === JobStatus.PENDING) {
                currentStep.status = JobStatus.PROCESSING
              }
            }
          })
        },

        cancelWorkflow: (workflowId) => {
          set((state) => {
            if (state.currentWorkflow?.id === workflowId) {
              // Cancel current step
              const currentStep = state.currentWorkflow.steps[state.currentWorkflow.currentStepIndex]
              if (currentStep) {
                currentStep.status = JobStatus.CANCELLED
              }
              
              state.currentWorkflow = null
              state.isRunning = false
            }
          })
        },

        completeWorkflow: (workflowId, finalResult) => {
          set((state) => {
            if (state.currentWorkflow?.id === workflowId) {
              state.currentWorkflow.finalResult = finalResult
              state.currentWorkflow.updatedAt = new Date()
              state.isRunning = false
            }
          })
        },

        // Current workflow management
        setCurrentWorkflow: (workflow) => {
          set((state) => {
            state.currentWorkflow = workflow
            state.isRunning = workflow !== null
          })
        },

        getCurrentStep: () => {
          const { currentWorkflow } = get()
          if (currentWorkflow && currentWorkflow.currentStepIndex < currentWorkflow.steps.length) {
            return currentWorkflow.steps[currentWorkflow.currentStepIndex]
          }
          return null
        },

        isWorkflowComplete: (workflowId) => {
          const { workflowHistory } = get()
          const workflow = workflowHistory.find(w => w.id === workflowId)
          
          if (!workflow) return false
          
          return workflow.steps.every(step => 
            step.status === JobStatus.COMPLETED || step.status === JobStatus.FAILED
          )
        },

        // Cleanup
        clearHistory: () => {
          set((state) => {
            state.workflowHistory = []
          })
        },

        reset: () => {
          set((state) => {
            Object.assign(state, initialState)
          })
        }
      })),
      {
        name: 'workflow-store',
        partialize: (state) => ({
          workflowHistory: state.workflowHistory.slice(0, 20), // Persist only recent workflows
        })
      }
    ),
    {
      name: 'workflow-store'
    }
  )
)

// Selector hooks for optimized re-renders
export const useCurrentWorkflow = () => useWorkflowStore((state) => state.currentWorkflow)
export const useIsWorkflowRunning = () => useWorkflowStore((state) => state.isRunning)
export const useCurrentStep = () => useWorkflowStore((state) => {
  const workflow = state.currentWorkflow
  if (workflow && workflow.currentStepIndex < workflow.steps.length) {
    return workflow.steps[workflow.currentStepIndex]
  }
  return null
})

export const useWorkflowProgress = () => useWorkflowStore((state) => {
  const workflow = state.currentWorkflow
  if (!workflow) return { progress: 0, currentStep: 0, totalSteps: 0 }
  
  const completedSteps = workflow.steps.filter(step => 
    step.status === JobStatus.COMPLETED
  ).length
  
  return {
    progress: (completedSteps / workflow.steps.length) * 100,
    currentStep: workflow.currentStepIndex + 1,
    totalSteps: workflow.steps.length
  }
})

export const useWorkflowHistory = (limit = 10) => useWorkflowStore((state) => 
  state.workflowHistory.slice(0, limit)
) 