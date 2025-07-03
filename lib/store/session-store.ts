import { create } from 'zustand'
import { persist } from 'zustand/middleware'
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
  generationNumber: number
  inputImageUrl: string
  outputImageUrls: string[]
  style: string
  roomType: string
  creditsCost: number
  status: 'pending' | 'processing' | 'completed' | 'failed'
  errorMessage?: string
  createdAt: Date
}

export interface SessionWithGenerations extends SelectSession {
  emptyRoomGenerations: EmptyRoomGeneration[]
  stagingGenerations: StagingGeneration[]
}

export interface StagingConfig {
  style: string
  roomType: string
}

interface SessionState {
  // Current session
  currentSession: SessionWithGenerations | null
  
  // Empty room generation state
  emptyRoomGenerations: EmptyRoomGeneration[]
  selectedEmptyRoomUrl: string | null
  emptyRoomRetries: number
  maxEmptyRoomRetries: number
  
  // Staging generation state
  stagingGenerations: StagingGeneration[]
  stagingConfig: StagingConfig
  
  // History
  allSessions: SessionWithGenerations[]
  isLoadingHistory: boolean
  
  // UI state
  currentStep: 'upload' | 'room_state' | 'empty_room' | 'staging' | 'complete'
  isGenerating: boolean
  
  // Actions
  createSession: (originalImageUrl: string, roomStateChoice: 'already_empty' | 'generate_empty') => Promise<void>
  setCurrentSession: (session: SessionWithGenerations | null) => void
  
  // Empty room actions
  addEmptyRoomGeneration: (generation: EmptyRoomGeneration) => void
  selectEmptyRoom: (url: string) => void
  incrementEmptyRoomRetries: () => void
  resetEmptyRoomRetries: () => void
  
  // Staging actions
  addStagingGeneration: (generation: StagingGeneration) => void
  updateStagingConfig: (config: Partial<StagingConfig>) => void
  
  // History actions
  loadSessionHistory: () => Promise<void>
  addToHistory: (session: SessionWithGenerations) => void
  
  // Navigation actions
  setCurrentStep: (step: SessionState['currentStep']) => void
  setIsGenerating: (generating: boolean) => void
  
  // Reset actions
  resetCurrentSession: () => void
  resetAll: () => void
}

const defaultStagingConfig: StagingConfig = {
  style: 'modern',
  roomType: 'living_room'
}

export const useSessionStore = create<SessionState>()(
  persist(
    (set, get) => ({
      // Initial state
      currentSession: null,
      emptyRoomGenerations: [],
      selectedEmptyRoomUrl: null,
      emptyRoomRetries: 0,
      maxEmptyRoomRetries: 2,
      stagingGenerations: [],
      stagingConfig: defaultStagingConfig,
      allSessions: [],
      isLoadingHistory: false,
      currentStep: 'upload',
      isGenerating: false,

      // Actions
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
          
          // Extract the actual session from the response
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

      setCurrentSession: (session) => {
        set({ currentSession: session })
      },

      addEmptyRoomGeneration: (generation) => {
        set((state) => ({
          emptyRoomGenerations: [...state.emptyRoomGenerations, generation],
          currentSession: state.currentSession ? {
            ...state.currentSession,
            emptyRoomGenerations: [...state.currentSession.emptyRoomGenerations, generation]
          } : null
        }))
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

      addStagingGeneration: (generation) => {
        set((state) => ({
          stagingGenerations: [...state.stagingGenerations, generation],
          currentSession: state.currentSession ? {
            ...state.currentSession,
            stagingGenerations: [...state.currentSession.stagingGenerations, generation]
          } : null
        }))
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
          stagingGenerations: [],
          stagingConfig: defaultStagingConfig,
          allSessions: [],
          isLoadingHistory: false,
          currentStep: 'upload',
          isGenerating: false
        })
      }
    }),
    {
      name: 'session-store',
      partialize: (state) => ({
        // Persist essential workflow state
        currentSession: state.currentSession,
        emptyRoomGenerations: state.emptyRoomGenerations,
        selectedEmptyRoomUrl: state.selectedEmptyRoomUrl,
        emptyRoomRetries: state.emptyRoomRetries,
        stagingGenerations: state.stagingGenerations,
        stagingConfig: state.stagingConfig,
        allSessions: state.allSessions,
        currentStep: state.currentStep
      }),
      onRehydrateStorage: () => (state) => {
        console.log('🔄 [Session Store] Starting rehydration with state:', state ? {
          hasCurrentSession: !!state.currentSession,
          currentStep: state.currentStep,
          sessionKeys: state.currentSession ? Object.keys(state.currentSession) : [],
          sessionId: state.currentSession?.id,
          originalImageUrl: state.currentSession?.originalImageUrl
        } : 'null')
        
        if (state) {
          // Validate session integrity
          const hasCorruptedSession = state.currentSession && (
            !state.currentSession.id || 
            !state.currentSession.originalImageUrl ||
            typeof state.currentSession.id !== 'string'
          )
          
          console.log('🔍 [Session Store] Corruption check:', {
            hasCurrentSession: !!state.currentSession,
            hasId: state.currentSession ? !!state.currentSession.id : false,
            hasOriginalImageUrl: state.currentSession ? !!state.currentSession.originalImageUrl : false,
            idType: state.currentSession ? typeof state.currentSession.id : 'n/a',
            hasCorruptedSession
          })
          
          if (hasCorruptedSession) {
            console.warn('🚨 [Session Store] Corrupted session detected, resetting state:', {
              sessionId: state.currentSession?.id,
              hasOriginalImageUrl: !!state.currentSession?.originalImageUrl,
              sessionKeys: state.currentSession ? Object.keys(state.currentSession) : []
            })
            
            const resetState = {
              currentSession: null,
              emptyRoomGenerations: [],
              selectedEmptyRoomUrl: null,
              emptyRoomRetries: 0,
              maxEmptyRoomRetries: 2,
              stagingGenerations: [],
              stagingConfig: defaultStagingConfig,
              allSessions: state.allSessions || [],
              isLoadingHistory: false,
              currentStep: 'upload' as SessionState['currentStep'],
              isGenerating: false
            }
            
            console.log('✅ [Session Store] Returning reset state:', {
              currentStep: resetState.currentStep,
              hasCurrentSession: !!resetState.currentSession
            })
            
            return resetState
          }
          
          console.log('🔄 [Session Store] Rehydrating session state:', {
            sessionId: state.currentSession?.id,
            currentStep: state.currentStep,
            emptyRoomGenerations: state.emptyRoomGenerations?.length || 0,
            selectedEmptyRoomUrl: state.selectedEmptyRoomUrl ? 'Yes' : 'No'
          })
        }
        
        console.log('✅ [Session Store] Rehydration complete, returning original state')
        return state
      }
    }
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