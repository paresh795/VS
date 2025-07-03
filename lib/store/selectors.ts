// Store Selectors - Cross-Store Queries and Complex Selectors
import { useCreditsStore } from './credits-store'
import { useJobsStore } from './jobs-store'
import { useWorkflowStore } from './workflow-store'
import { useErrorStore } from './error-store'
import { useAppStore } from './app-store'
import { JobType, JobStatus, ErrorSeverity } from './types'

// Cross-store selector hooks
export const useStoreSelectors = () => {
  // Complex selectors that combine multiple stores
  
  // System health check
  const useSystemHealth = () => {
    const hasErrors = useErrorStore((state) => 
      state.errors.some(error => !error.dismissed && error.severity >= ErrorSeverity.ERROR)
    )
    const isProcessing = useJobsStore((state) => state.isProcessing)
    const isOnline = useAppStore((state) => state.isOnline)
    const creditsBalance = useCreditsStore((state) => state.balance)
    
    return {
      isHealthy: !hasErrors && isOnline && creditsBalance > 0,
      hasErrors,
      isProcessing,
      isOnline,
      creditsBalance,
      canProcessJobs: isOnline && creditsBalance > 0 && !hasErrors
    }
  }

  // Job processing capabilities
  const useProcessingCapability = () => {
    const creditsBalance = useCreditsStore((state) => state.balance)
    const activeJobs = useJobsStore((state) => state.activeJobs.length)
    const isOnline = useAppStore((state) => state.isOnline)
    const hasBlockingErrors = useErrorStore((state) => 
      state.errors.some(error => 
        !error.dismissed && 
        error.severity === ErrorSeverity.CRITICAL
      )
    )
    
    const canStartMaskGeneration = creditsBalance >= 1 && isOnline && !hasBlockingErrors
    const canStartEmptyRoom = creditsBalance >= 2 && isOnline && !hasBlockingErrors
    const canStartFullWorkflow = creditsBalance >= 5 && isOnline && !hasBlockingErrors
    
    return {
      canStartMaskGeneration,
      canStartEmptyRoom, 
      canStartFullWorkflow,
      currentActiveJobs: activeJobs,
      availableCredits: creditsBalance,
      blockingErrors: hasBlockingErrors
    }
  }

  // Recent activity summary
  const useRecentActivity = () => {
    const recentJobs = useJobsStore((state) => 
      state.jobHistory.slice(0, 5).map(id => state.jobs[id]).filter(Boolean)
    )
    const recentTransactions = useCreditsStore((state) => 
      state.transactions.slice(0, 5)
    )
    const recentErrors = useErrorStore((state) => 
      state.errors.filter(error => !error.dismissed).slice(0, 3)
    )
    const currentWorkflow = useWorkflowStore((state) => state.currentWorkflow)
    
    return {
      recentJobs,
      recentTransactions,
      recentErrors,
      currentWorkflow,
      hasRecentActivity: recentJobs.length > 0 || recentTransactions.length > 0 || recentErrors.length > 0
    }
  }

  // Workflow state analysis
  const useWorkflowAnalysis = () => {
    const currentWorkflow = useWorkflowStore((state) => state.currentWorkflow)
    const isRunning = useWorkflowStore((state) => state.isRunning)
    const activeJobs = useJobsStore((state) => 
      state.activeJobs.map(id => state.jobs[id]).filter(Boolean)
    )
    
    if (!currentWorkflow) {
      return {
        hasWorkflow: false,
        canStartNew: activeJobs.length === 0,
        progress: 0,
        currentStep: null,
        estimatedCreditsNeeded: 0
      }
    }

    const completedSteps = currentWorkflow.steps.filter(step => 
      step.status === JobStatus.COMPLETED
    ).length
    
    const progress = (completedSteps / currentWorkflow.steps.length) * 100
    const currentStep = currentWorkflow.steps[currentWorkflow.currentStepIndex]
    
    // Estimate credits needed for remaining steps
    const remainingSteps = currentWorkflow.steps.slice(currentWorkflow.currentStepIndex)
    const estimatedCreditsNeeded = remainingSteps.reduce((total, step) => {
      switch (step.type) {
        case JobType.MASK_GENERATION: return total + 1
        case JobType.EMPTY_ROOM: return total + 2  
        case JobType.ROOM_STAGING: return total + 3
        case JobType.CHAT_EDIT: return total + 1
        default: return total + 1
      }
    }, 0)
    
    return {
      hasWorkflow: true,
      canStartNew: !isRunning,
      progress,
      currentStep,
      estimatedCreditsNeeded,
      isRunning,
      workflowId: currentWorkflow.id
    }
  }

  // Performance metrics
  const usePerformanceMetrics = () => {
    const totalJobs = useJobsStore((state) => Object.keys(state.jobs).length)
    const completedJobs = useJobsStore((state) => 
      Object.values(state.jobs).filter(job => job.status === JobStatus.COMPLETED).length
    )
    const failedJobs = useJobsStore((state) => 
      Object.values(state.jobs).filter(job => job.status === JobStatus.FAILED).length
    )
    const totalErrors = useErrorStore((state) => state.errors.length)
    const totalTransactions = useCreditsStore((state) => state.transactions.length)
    
    const successRate = totalJobs > 0 ? (completedJobs / totalJobs) * 100 : 0
    const errorRate = totalJobs > 0 ? (failedJobs / totalJobs) * 100 : 0
    
    return {
      totalJobs,
      completedJobs,
      failedJobs,
      successRate,
      errorRate,
      totalErrors,
      totalTransactions,
      averageJobsPerSession: totalJobs // Could be enhanced with session tracking
    }
  }

  // Dashboard summary
  const useDashboardSummary = () => {
    const health = useSystemHealth()
    const capability = useProcessingCapability()
    const activity = useRecentActivity()
    const workflow = useWorkflowAnalysis()
    const metrics = usePerformanceMetrics()
    
    return {
      health,
      capability,
      activity,
      workflow,
      metrics,
      // Quick status flags
      isOperational: health.isHealthy && capability.canStartMaskGeneration,
      needsAttention: !health.isHealthy || capability.blockingErrors,
      hasActiveWork: workflow.hasWorkflow && workflow.isRunning
    }
  }

  return {
    useSystemHealth,
    useProcessingCapability,
    useRecentActivity,
    useWorkflowAnalysis,
    usePerformanceMetrics,
    useDashboardSummary
  }
}

// Individual selector exports for convenience
export const useSystemHealth = () => useStoreSelectors().useSystemHealth()
export const useProcessingCapability = () => useStoreSelectors().useProcessingCapability()
export const useRecentActivity = () => useStoreSelectors().useRecentActivity()
export const useWorkflowAnalysis = () => useStoreSelectors().useWorkflowAnalysis()
export const usePerformanceMetrics = () => useStoreSelectors().usePerformanceMetrics()
export const useDashboardSummary = () => useStoreSelectors().useDashboardSummary() 