import { create } from 'zustand'
import { createAuthAwarePersist } from './middleware/auth-aware-persistence'
import { SelectSession, SelectGeneration } from '@/db/schema'

// Enhanced types for the session workflow
export interface EmptyRoomGeneration {
  id: string
  generationNumber: number
  inputImageUrl: string
  outputImageUrls: string[]
  creditsCost: number
  status: 'pending' | 'processing' | 'completed' | 'failed'
  errorMessage?: string
  createdAt: Date
}

export interface StagingGeneration {
  id: string
  emptyRoomUrl: string
  style: string
  roomType: string
  outputImageUrls: string[]
  creditsCost: number
  status: 'pending' | 'processing' | 'completed' | 'failed'
  errorMessage?: string
  createdAt: Date
}

export interface StagingConfig {
  style: string
  roomType: string
}

export interface SessionWithGenerations extends SelectSession {
  emptyRoomGenerations: EmptyRoomGeneration[]
  stagingGenerations: StagingGeneration[]
}

interface SessionState {
  _currentUserId?: string | null // Add auth tracking
  
  // Current session
  currentSession: SessionWithGenerations | null
  
  // Empty room generation state
  emptyRoomGenerations: EmptyRoomGeneration[]
  selectedEmptyRoomUrl: string | null
  emptyRoomRetries: number
  maxEmptyRoomRetries: number
  
  // Paid retry system
  paidRetryAttempts: number
  allowPaidRetries: boolean
  
  // Staging generation state
  stagingGenerations: StagingGeneration[]
  stagingConfig: StagingConfig
  
  // History
  allSessions: SessionWithGenerations[]
  isLoadingHistory: boolean
  
  // UI state
  currentStep: 'upload' | 'room_state' | 'empty_room' | 'staging'
  isGenerating: boolean
  
  // Actions (same as before)
  createSession: (originalImageUrl: string, roomStateChoice: 'already_empty' | 'generate_empty') => Promise<void>
  setCurrentSession: (session: SessionWithGenerations | null) => void
  addEmptyRoomGeneration: (generation: EmptyRoomGeneration) => void
  selectEmptyRoom: (url: string) => void
  incrementEmptyRoomRetries: () => void
  resetEmptyRoomRetries: () => void
  incrementPaidRetryAttempts: () => void
  resetPaidRetryAttempts: () => void
  canAffordPaidRetry: (creditBalance: number) => boolean
  getTotalAttempts: () => number
  addStagingGeneration: (generation: StagingGeneration) => void
  updateStagingConfig: (config: Partial<StagingConfig>) => void
  loadSessionHistory: () => Promise<void>
  addToHistory: (session: SessionWithGenerations) => void
  setCurrentStep: (step: SessionState['currentStep']) => void
  setIsGenerating: (generating: boolean) => void
  resetCurrentSession: () => void
  resetAll: () => void
}

const defaultStagingConfig: StagingConfig = {
  style: 'modern',
  roomType: 'living_room'
}

const authAwarePersist = createAuthAwarePersist<SessionState>({
  name: 'session-store',
  partialize: (state) => ({
    // Persist essential workflow state
    currentSession: state.currentSession,
    emptyRoomGenerations: state.emptyRoomGenerations,
    selectedEmptyRoomUrl: state.selectedEmptyRoomUrl,
    emptyRoomRetries: state.emptyRoomRetries,
    paidRetryAttempts: state.paidRetryAttempts,
    allowPaidRetries: state.allowPaidRetries,
    stagingGenerations: state.stagingGenerations,
    stagingConfig: state.stagingConfig,
    allSessions: state.allSessions,
    currentStep: state.currentStep
  }),
})

export const useSessionStore = create<SessionState>()(
  authAwarePersist(
    (set, get) => ({
      // Initial state
      _currentUserId: null,
      currentSession: null,
      emptyRoomGenerations: [],
      selectedEmptyRoomUrl: null,
      emptyRoomRetries: 0,
      maxEmptyRoomRetries: 2,
      paidRetryAttempts: 0,
      allowPaidRetries: true,
      stagingGenerations: [],
      stagingConfig: defaultStagingConfig,
      allSessions: [],
      isLoadingHistory: false,
      currentStep: 'upload',
      isGenerating: false,

      // Actions (all your existing actions remain the same)
      createSession: async (originalImageUrl: string, roomStateChoice: 'already_empty' | 'generate_empty') => {
        try {
          console.log('🎬 [Session Store] Creating session...', { originalImageUrl, roomStateChoice })
          
          const response = await fetch('/api/sessions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              originalImageUrl,
              roomStateChoice
            })
          })

          if (!response.ok) {
            throw new Error('Failed to create session')
          }

          const responseData = await response.json()
          console.log('✅ [Session Store] API Response:', responseData)
          
          const session = responseData.session
          console.log('✅ [Session Store] Session data:', session)
          
          if (!session || !session.id) {
            throw new Error('Invalid session data received from API')
          }
          
          const sessionWithGenerations: SessionWithGenerations = {
            ...session,
            emptyRoomGenerations: [],
            stagingGenerations: []
          }

          const newState = {
            currentSession: sessionWithGenerations,
            emptyRoomGenerations: [],
            stagingGenerations: [],
            selectedEmptyRoomUrl: roomStateChoice === 'already_empty' ? originalImageUrl : null,
            emptyRoomRetries: 0,
            currentStep: (roomStateChoice === 'already_empty' ? 'staging' : 'empty_room') as SessionState['currentStep']
          }

          console.log('🔄 [Session Store] Setting new state:', {
            sessionId: sessionWithGenerations.id,
            currentStep: newState.currentStep,
            hasSession: !!newState.currentSession
          })
          set(newState)
          
          console.log('✅ [Session Store] State updated successfully')
        } catch (error) {
          console.error('❌ [Session Store] Failed to create session:', error)
          throw error
        }
      },

      // ... rest of your actions remain exactly the same ...

      setCurrentSession: (session) => {
        set({ currentSession: session })
      },

      addEmptyRoomGeneration: (generation) => {
        console.log('🔧 [Session Store] addEmptyRoomGeneration called with:', generation.id)
        console.log('🔧 [Session Store] About to call set() - this should trigger interceptedSet')
        
        // IMMEDIATE DEBUG: Check localStorage before and after
        const userKey = `session-store_user_${get()._currentUserId}`
        const beforeValue = typeof window !== 'undefined' ? window.localStorage.getItem(userKey) : null
        console.log('🔍 [DEBUG] Before set - localStorage value:', beforeValue)
        
        set((state) => ({
          emptyRoomGenerations: [...state.emptyRoomGenerations, generation],
          currentSession: state.currentSession ? {
            ...state.currentSession,
            emptyRoomGenerations: [...state.currentSession.emptyRoomGenerations, generation]
          } : null
        }))
        
        console.log('🔧 [Session Store] set() call completed')
        
        // IMMEDIATE DEBUG: Force save to localStorage manually
        setTimeout(() => {
          const currentState = get()
          const afterValue = typeof window !== 'undefined' ? window.localStorage.getItem(userKey) : null
          console.log('🔍 [DEBUG] After set - localStorage value:', afterValue)
          console.log('🔍 [DEBUG] Current state emptyRoomGenerations count:', currentState.emptyRoomGenerations.length)
          
          // FORCE MANUAL SAVE
          if (typeof window !== 'undefined') {
            const manualSave = JSON.stringify({
              emptyRoomGenerations: currentState.emptyRoomGenerations,
              stagingGenerations: currentState.stagingGenerations,
              currentSession: currentState.currentSession,
              _currentUserId: currentState._currentUserId
            })
            window.localStorage.setItem(userKey, manualSave)
            console.log('💾 [DEBUG] MANUALLY SAVED TO LOCALSTORAGE:', userKey)
          }
        }, 100)
      },

      selectEmptyRoom: (url) => {
        set((state) => ({
          selectedEmptyRoomUrl: url,
          currentSession: state.currentSession ? {
            ...state.currentSession,
            selectedEmptyRoomUrl: url
          } : null
        }))
      },

      incrementEmptyRoomRetries: () => {
        set((state) => ({
          emptyRoomRetries: state.emptyRoomRetries + 1
        }))
      },

      resetEmptyRoomRetries: () => {
        set({ emptyRoomRetries: 0 })
      },

      incrementPaidRetryAttempts: () => {
        set((state) => ({
          paidRetryAttempts: state.paidRetryAttempts + 1
        }))
      },

      resetPaidRetryAttempts: () => {
        set({ paidRetryAttempts: 0 })
      },

      canAffordPaidRetry: (creditBalance: number) => {
        return creditBalance >= 10; // MASK_AND_EMPTY cost from constants
      },

      getTotalAttempts: () => {
        return get().paidRetryAttempts;
      },

      addStagingGeneration: (generation) => {
        set((state) => {
          const newState = {
            stagingGenerations: [...state.stagingGenerations, generation],
            currentSession: state.currentSession ? {
              ...state.currentSession,
              stagingGenerations: [...state.currentSession.stagingGenerations, generation]
            } : null,
            allSessions: state.allSessions
          }
          
          // Auto-save session when staging generation is completed
          if (generation.status === 'completed' && state.currentSession) {
            console.log('✅ [Session Store] Auto-saving completed staging generation')
            // Add to session history
            const updatedSession = {
              ...state.currentSession,
              stagingGenerations: [...state.currentSession.stagingGenerations, generation]
            }
            newState.allSessions = [updatedSession, ...state.allSessions.filter(s => s.id !== updatedSession.id)]
          }
          
          return newState
        })
      },

      updateStagingConfig: (config) => {
        set((state) => ({
          stagingConfig: { ...state.stagingConfig, ...config }
        }))
      },

      loadSessionHistory: async () => {
        set({ isLoadingHistory: true })
        try {
          const response = await fetch('/api/sessions')
          if (!response.ok) {
            throw new Error('Failed to load session history')
          }
          const sessions = await response.json()
          set({ allSessions: sessions })
        } catch (error) {
          console.error('Failed to load session history:', error)
        } finally {
          set({ isLoadingHistory: false })
        }
      },

      addToHistory: (session) => {
        set((state) => ({
          allSessions: [session, ...state.allSessions]
        }))
      },

      setCurrentStep: (step) => {
        set({ currentStep: step })
      },

      setIsGenerating: (generating) => {
        set({ isGenerating: generating })
      },

      resetCurrentSession: () => {
        set({
          currentSession: null,
          emptyRoomGenerations: [],
          selectedEmptyRoomUrl: null,
          emptyRoomRetries: 0,
          paidRetryAttempts: 0,
          allowPaidRetries: true,
          stagingGenerations: [],
          stagingConfig: defaultStagingConfig,
          currentStep: 'upload',
          isGenerating: false
        })
      },

      resetAll: () => {
        set({
          currentSession: null,
          emptyRoomGenerations: [],
          selectedEmptyRoomUrl: null,
          emptyRoomRetries: 0,
          maxEmptyRoomRetries: 2,
          paidRetryAttempts: 0,
          allowPaidRetries: true,
          stagingGenerations: [],
          stagingConfig: defaultStagingConfig,
          allSessions: [],
          isLoadingHistory: false,
          currentStep: 'upload',
          isGenerating: false
        })
      }
    })
  )
)

// Selectors for easy state access
export const useCurrentSession = () => useSessionStore((state) => state.currentSession)
export const useEmptyRoomGenerations = () => useSessionStore((state) => state.emptyRoomGenerations)
export const useSelectedEmptyRoomUrl = () => useSessionStore((state) => state.selectedEmptyRoomUrl)
export const useStagingGenerations = () => useSessionStore((state) => state.stagingGenerations)
export const useStagingConfig = () => useSessionStore((state) => state.stagingConfig)
export const useCurrentStep = () => useSessionStore((state) => state.currentStep)
export const useIsGenerating = () => useSessionStore((state) => state.isGenerating)
export const useSessionHistory = () => useSessionStore((state) => state.allSessions)
export const useCanRetryEmptyRoom = () => useSessionStore((state) => 
  state.emptyRoomRetries < state.maxEmptyRoomRetries
)

// Paid retry selectors
export const usePaidRetryAttempts = () => useSessionStore((state) => state.paidRetryAttempts)
export const useCanAffordPaidRetry = (creditBalance: number) => useSessionStore((state) => 
  state.canAffordPaidRetry(creditBalance)
)
export const useHasExhaustedFreeRetries = () => useSessionStore((state) => 
  state.emptyRoomRetries >= state.maxEmptyRoomRetries
)
export const getTotalEmptyRoomAttempts = () => useSessionStore((state) => 
  state.emptyRoomRetries + state.paidRetryAttempts + 1 // +1 for initial attempt
) 