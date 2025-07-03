// Core Types for State Management Architecture

import { StateCreator } from 'zustand'

// Base store slice type
export interface StoreSlice<T> {
  (...args: Parameters<StateCreator<T>>): StateCreator<T>
}

// Middleware type for store enhancers
export interface StoreMiddleware<T> {
  (config: StateCreator<T>): StateCreator<T>
}

// Job status enum for consistent job tracking
export enum JobStatus {
  IDLE = 'idle',
  PENDING = 'pending',
  PROCESSING = 'processing',
  COMPLETED = 'completed',
  FAILED = 'failed',
  CANCELLED = 'cancelled'
}

// Job types for different AI operations
export enum JobType {
  MASK_GENERATION = 'mask_generation',
  EMPTY_ROOM = 'empty_room',
  ROOM_STAGING = 'room_staging',
  CHAT_EDIT = 'chat_edit'
}

// Individual job interface
export interface Job {
  id: string
  type: JobType
  status: JobStatus
  imageUrl: string
  resultUrl?: string
  maskUrl?: string
  errorMessage?: string
  progress: number
  createdAt: Date
  updatedAt: Date
  metadata?: Record<string, any>
}

// Credits transaction interface
export interface CreditTransaction {
  id: string
  userId: string
  amount: number
  type: 'credit' | 'debit'
  jobId?: string
  description: string
  createdAt: Date
}

// Workflow step interface
export interface WorkflowStep {
  id: string
  type: JobType
  status: JobStatus
  jobId?: string
  result?: any
  error?: string
}

// Complete workflow interface
export interface Workflow {
  id: string
  steps: WorkflowStep[]
  currentStepIndex: number
  imageUrl: string
  finalResult?: string
  createdAt: Date
  updatedAt: Date
}

// Error severity levels
export enum ErrorSeverity {
  INFO = 'info',
  WARNING = 'warning',
  ERROR = 'error',
  CRITICAL = 'critical'
}

// Application error interface
export interface AppError {
  id: string
  message: string
  severity: ErrorSeverity
  code?: string
  timestamp: Date
  context?: Record<string, any>
  dismissed: boolean
}

// Store state interfaces
export interface CreditsState {
  balance: number
  transactions: CreditTransaction[]
  isLoading: boolean
  lastUpdated: Date | null
  pendingDeductions: number
}

export interface JobsState {
  jobs: Record<string, Job>
  activeJobs: string[]
  jobHistory: string[]
  isProcessing: boolean
}

export interface WorkflowState {
  currentWorkflow: Workflow | null
  workflowHistory: Workflow[]
  isRunning: boolean
}

export interface ErrorState {
  errors: AppError[]
  globalError: AppError | null
  isRecovering: boolean
}

export interface AppState {
  isInitialized: boolean
  isOnline: boolean
  lastSyncTime: Date | null
  theme: 'light' | 'dark' | 'system'
  preferences: Record<string, any>
} 