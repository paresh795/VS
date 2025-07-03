"use client"

import { useState, useCallback, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { Upload, RotateCcw, Wand2, Check, X, Loader2 } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  useSessionStore, 
  useCurrentSession, 
  useCurrentStep,
  useEmptyRoomGenerations,
  useSelectedEmptyRoomUrl,
  useStagingGenerations,
  useStagingConfig,
  useIsGenerating,
  useCanRetryEmptyRoom
} from '@/lib/store/session-store'
import { useCreditsStore, useCreditsBalance } from '@/lib/store/credits-store'
import { CREDIT_COSTS } from '@/lib/constants'
import { toast } from 'sonner'
import { UploadDropzone } from '@/components/upload-dropzone'
import { EmptyRoomGenerationComponent } from '@/components/empty-room-generation'
import { StagingGenerationComponent } from '@/components/staging-generation'
import { useAuth } from '@clerk/nextjs'

export default function EnhancedStagingPage() {
  const { isSignedIn } = useAuth()
  const [uploadedImageUrl, setUploadedImageUrl] = useState<string | null>(null)
  
  // Session store selectors
  const currentSession = useCurrentSession()
  const currentStep = useCurrentStep()
  const emptyRoomGenerations = useEmptyRoomGenerations()
  const selectedEmptyRoomUrl = useSelectedEmptyRoomUrl()
  const stagingGenerations = useStagingGenerations()
  const stagingConfig = useStagingConfig()
  const isGenerating = useIsGenerating()
  const canRetryEmptyRoom = useCanRetryEmptyRoom()
  
  // Session store actions
  const {
    createSession,
    setCurrentStep,
    resetCurrentSession
  } = useSessionStore()
  
  // Credits
  const credits = useCreditsBalance()

  // Debug logging
  console.log('🔍 [Enhanced Staging] Current state:', {
    currentStep,
    uploadedImageUrl,
    currentSession: currentSession ? {
      id: currentSession.id,
      originalImageUrl: currentSession.originalImageUrl,
      roomStateChoice: currentSession.roomStateChoice
    } : null,
    emptyRoomGenerations: emptyRoomGenerations.length,
    selectedEmptyRoomUrl: selectedEmptyRoomUrl ? 'Yes' : 'No',
    isGenerating
  })

  // Safety check: Reset to upload step if we're in empty_room step but have no valid session
  useEffect(() => {
    if (currentStep === 'empty_room' && (!currentSession || !currentSession.id)) {
      console.log('🚨 [Enhanced Staging] Invalid state detected: empty_room step without valid session, resetting to upload')
      setCurrentStep('upload')
      resetCurrentSession()
    }
  }, [currentStep, currentSession, setCurrentStep, resetCurrentSession])

  // Specific debug for empty room step
  if (currentStep === 'empty_room') {
    console.log('🏠 [Enhanced Staging] In empty_room step:', {
      hasCurrentSession: !!currentSession,
      sessionId: currentSession?.id,
      originalImageUrl: currentSession?.originalImageUrl
    })
  }

  // Step 1: Image Upload
  const handleImageUpload = useCallback((url: string) => {
    console.log('📸 [Enhanced Staging] Image uploaded:', url)
    setUploadedImageUrl(url)
    setCurrentStep('room_state')
  }, [setCurrentStep])

  // Step 2: Room State Selection
  const handleRoomStateSelection = useCallback(async (choice: 'already_empty' | 'generate_empty') => {
    if (!uploadedImageUrl) {
      toast.error('Please upload an image first')
      return
    }

    try {
      console.log('🏠 [Enhanced Staging] Room state choice:', choice)
      console.log('🏠 [Enhanced Staging] Using image URL:', uploadedImageUrl)
      
      await createSession(uploadedImageUrl, choice)
      
      if (choice === 'already_empty') {
        toast.success('Using original image for staging')
        setCurrentStep('staging')
      } else {
        toast.success('Session created! Ready to generate empty room')
        setCurrentStep('empty_room')
      }
      
      console.log('✅ [Enhanced Staging] Session creation completed, step set to:', choice === 'already_empty' ? 'staging' : 'empty_room')
    } catch (error) {
      console.error('❌ [Enhanced Staging] Failed to create session:', error)
      toast.error('Failed to create session. Please try again.')
    }
  }, [uploadedImageUrl, createSession, setCurrentStep])

  // Step 3: Complete Workflow - Restart
  const handleRestart = useCallback(() => {
    console.log('🔄 [Enhanced Staging] Restarting workflow')
    resetCurrentSession()
    setUploadedImageUrl(null)
    setCurrentStep('upload')
    toast.info('Workflow reset. Ready for new session!')
  }, [resetCurrentSession, setCurrentStep])

  // Credit check
  const hasEnoughCreditsForEmptyRoom = credits >= CREDIT_COSTS.MASK_AND_EMPTY
  const hasEnoughCreditsForStaging = credits >= CREDIT_COSTS.STAGING_FULL

  if (!isSignedIn) {
    return (
      <div className="container mx-auto max-w-4xl py-8">
        <Card>
          <CardContent className="flex items-center justify-center p-8">
            <p className="text-muted-foreground">Please sign in to access the enhanced staging workflow.</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="container mx-auto max-w-6xl py-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Enhanced Virtual Staging</h1>
        <p className="text-muted-foreground">
          Complete workflow for empty room generation and virtual staging with session management
        </p>
      </div>

      {/* Progress Indicator */}
      <div className="mb-8">
        <div className="flex items-center space-x-4">
          {[
            { key: 'upload', label: 'Upload', icon: Upload },
            { key: 'room_state', label: 'Room State', icon: Wand2 },
            { key: 'empty_room', label: 'Empty Room', icon: RotateCcw },
            { key: 'staging', label: 'Staging', icon: Check },
          ].map((step, index) => {
            const isActive = currentStep === step.key
            const isCompleted = ['upload', 'room_state', 'empty_room', 'staging'].indexOf(currentStep) > index
            const IconComponent = step.icon
            
            return (
              <div key={step.key} className="flex items-center">
                <div className={`
                  flex items-center justify-center w-10 h-10 rounded-full border-2 transition-colors
                  ${isActive ? 'border-blue-500 bg-blue-500 text-white' : 
                    isCompleted ? 'border-green-500 bg-green-500 text-white' : 
                    'border-gray-300 bg-gray-100 text-gray-400'}
                `}>
                  <IconComponent className="w-5 h-5" />
                </div>
                <span className={`ml-2 text-sm font-medium ${
                  isActive ? 'text-blue-600' : isCompleted ? 'text-green-600' : 'text-gray-400'
                }`}>
                  {step.label}
                </span>
                {index < 3 && (
                  <div className={`w-8 h-0.5 mx-4 ${
                    isCompleted ? 'bg-green-500' : 'bg-gray-300'
                  }`} />
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* Credits Display */}
      <Card className="mb-6">
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Available Credits</p>
              <p className="text-2xl font-bold">{credits.toLocaleString()}</p>
            </div>
            <div className="text-right text-sm text-muted-foreground">
              <p>Empty Room: {CREDIT_COSTS.MASK_AND_EMPTY} credits</p>
              <p>Staging: {CREDIT_COSTS.STAGING_FULL} credits</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Main Content */}
      <AnimatePresence mode="wait">
        {/* Step 1: Image Upload */}
        {currentStep === 'upload' && (
          <motion.div
            key="upload"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.3 }}
          >
            <Card>
              <CardHeader>
                <CardTitle>Step 1: Upload Your Room Image</CardTitle>
                <CardDescription>
                  Upload a high-quality image of the room you want to stage
                </CardDescription>
              </CardHeader>
              <CardContent>
                <UploadDropzone onUpload={handleImageUpload} />
              </CardContent>
            </Card>
          </motion.div>
        )}

        {/* Step 2: Room State Selection */}
        {currentStep === 'room_state' && uploadedImageUrl && (
          <motion.div
            key="room_state"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.3 }}
          >
            <Card>
              <CardHeader>
                <CardTitle>Step 2: Room State Selection</CardTitle>
                <CardDescription>
                  Is your room already empty, or do you need us to empty it first?
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Uploaded Image Preview */}
                <div className="flex justify-center">
                  <img 
                    src={uploadedImageUrl} 
                    alt="Uploaded room" 
                    className="max-w-md max-h-64 object-contain rounded-lg border"
                  />
                </div>

                <Separator />

                {/* Room State Options */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Card className="cursor-pointer hover:shadow-md transition-shadow border-2 border-transparent hover:border-blue-200">
                    <CardContent className="p-6" onClick={() => handleRoomStateSelection('already_empty')}>
                      <div className="text-center space-y-3">
                        <Check className="w-12 h-12 mx-auto text-green-500" />
                        <h3 className="text-lg font-semibold">Room is Already Empty</h3>
                        <p className="text-sm text-muted-foreground">
                          Use the uploaded image directly for staging
                        </p>
                        <p className="text-sm font-medium text-green-600">FREE - No additional credits</p>
                      </div>
                    </CardContent>
                  </Card>

                  <Card className={`cursor-pointer transition-shadow border-2 ${
                    hasEnoughCreditsForEmptyRoom 
                      ? 'border-transparent hover:border-blue-200 hover:shadow-md' 
                      : 'border-red-200 opacity-50'
                  }`}>
                    <CardContent 
                      className="p-6" 
                      onClick={() => hasEnoughCreditsForEmptyRoom && handleRoomStateSelection('generate_empty')}
                    >
                      <div className="text-center space-y-3">
                        <Wand2 className="w-12 h-12 mx-auto text-blue-500" />
                        <h3 className="text-lg font-semibold">Generate Empty Room</h3>
                        <p className="text-sm text-muted-foreground">
                          AI will remove furniture and objects to create an empty room
                        </p>
                        <p className="text-sm font-medium text-blue-600">
                          {CREDIT_COSTS.MASK_AND_EMPTY} credits + 2 free retries
                        </p>
                        {!hasEnoughCreditsForEmptyRoom && (
                          <p className="text-sm text-red-600">Insufficient credits</p>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                </div>

                <div className="flex justify-center">
                  <Button variant="outline" onClick={() => setCurrentStep('upload')}>
                    ← Back to Upload
                  </Button>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {/* Step 3: Empty Room Generation */}
        {currentStep === 'empty_room' && currentSession && (
          <motion.div
            key="empty_room"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.3 }}
          >
            <EmptyRoomGenerationComponent 
              session={currentSession}
              onComplete={() => setCurrentStep('staging')}
              onBack={() => setCurrentStep('room_state')}
            />
          </motion.div>
        )}

        {/* Debug: Show if we're in empty_room step but missing session */}
        {currentStep === 'empty_room' && !currentSession && (
          <motion.div
            key="empty_room_error"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.3 }}
          >
            <Card className="border-red-200 bg-red-50">
              <CardContent className="p-6">
                <div className="text-center space-y-4">
                  <h3 className="text-lg font-semibold text-red-800">Session Error</h3>
                  <p className="text-red-600">
                    No session found. Please go back and create a new session.
                  </p>
                  <Button onClick={() => setCurrentStep('upload')} variant="outline">
                    Start Over
                  </Button>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {/* Step 4: Staging Generation */}
        {currentStep === 'staging' && currentSession && (
          <motion.div
            key="staging"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.3 }}
          >
            <StagingGenerationComponent 
              session={currentSession}
              inputImageUrl={selectedEmptyRoomUrl || currentSession.originalImageUrl}
              onComplete={() => setCurrentStep('complete')}
              onBack={() => currentSession.roomStateChoice === 'generate_empty' ? setCurrentStep('empty_room') : setCurrentStep('room_state')}
            />
          </motion.div>
        )}

        {/* Step 5: Complete */}
        {currentStep === 'complete' && (
          <motion.div
            key="complete"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.3 }}
          >
            <Card>
              <CardHeader className="text-center">
                <CardTitle className="text-2xl text-green-600">Workflow Complete! 🎉</CardTitle>
                <CardDescription>
                  Your virtual staging session has been completed and saved
                </CardDescription>
              </CardHeader>
              <CardContent className="text-center space-y-6">
                <div className="flex justify-center space-x-4">
                  <Button onClick={handleRestart}>
                    Start New Session
                  </Button>
                  <Button variant="outline" onClick={() => window.open('/dashboard', '_blank')}>
                    View Dashboard
                  </Button>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Debug Info */}
      <Card className="mt-4 border-yellow-200 bg-yellow-50">
        <CardHeader>
          <CardTitle className="text-sm text-yellow-800">🔍 Debug Info (Always Visible)</CardTitle>
        </CardHeader>
        <CardContent className="text-sm">
          <div className="space-y-2">
            <p><strong>currentStep:</strong> {currentStep}</p>
            <p><strong>uploadedImageUrl:</strong> {uploadedImageUrl || 'null'}</p>
            <p><strong>currentSession:</strong> {currentSession ? `ID: ${currentSession.id}` : 'null'}</p>
            <p><strong>isSignedIn:</strong> {isSignedIn ? 'true' : 'false'}</p>
            <p><strong>credits:</strong> {credits}</p>
            <p><strong>Should show upload step:</strong> {currentStep === 'upload' ? 'YES' : 'NO'}</p>
            <div className="mt-4 pt-2 border-t border-yellow-300">
              <Button 
                size="sm" 
                variant="outline"
                onClick={() => {
                  console.log('🔧 [Debug] Force resetting state')
                  resetCurrentSession()
                  setUploadedImageUrl(null)
                  setCurrentStep('upload')
                }}
              >
                🔧 Force Reset to Upload
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Session Debug Info (Development only) */}
      {process.env.NODE_ENV === 'development' && currentSession && (
        <Card className="mt-8 border-dashed">
          <CardHeader>
            <CardTitle className="text-sm">Debug Info</CardTitle>
          </CardHeader>
          <CardContent>
            <pre className="text-xs bg-gray-100 p-4 rounded overflow-x-auto">
              {JSON.stringify({
                currentStep,
                sessionId: currentSession.id,
                roomStateChoice: currentSession.roomStateChoice,
                emptyRoomGenerations: emptyRoomGenerations.length,
                stagingGenerations: stagingGenerations.length,
                selectedEmptyRoomUrl: selectedEmptyRoomUrl ? 'Yes' : 'No'
              }, null, 2)}
            </pre>
          </CardContent>
        </Card>
      )}
    </div>
  )
} 