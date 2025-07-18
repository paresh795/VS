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
import { StagingGeneration } from '@/components/staging-generation'
import { useAuth } from '@clerk/nextjs'

export default function DashboardPage() {
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
  const { deductCredits } = useCreditsStore()

  // Safety check: Reset to upload step if we're in empty_room step but have no valid session
  useEffect(() => {
    if (currentStep === 'empty_room' && (!currentSession || !currentSession.id)) {
      setCurrentStep('upload')
      resetCurrentSession()
    }
  }, [currentStep, currentSession, setCurrentStep, resetCurrentSession])

  // Step 1: Image Upload
  const handleImageUpload = useCallback((url: string) => {
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
      await createSession(uploadedImageUrl, choice)
      
      if (choice === 'already_empty') {
        toast.success('Using original image for staging')
        setCurrentStep('staging')
      } else {
        toast.success('Starting empty room generation...')
        setCurrentStep('empty_room')
      }
    } catch (error) {
      toast.error('Failed to create session. Please try again.')
    }
  }, [uploadedImageUrl, createSession, setCurrentStep])

  // Restart workflow
  const handleRestart = useCallback(() => {
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
            <p className="text-muted-foreground">Please sign in to access the virtual staging workflow.</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="container mx-auto max-w-6xl py-6">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Staging Studio</h1>
        </div>
        <div className="flex items-center space-x-4">
          {/* Compact Credits Display */}
          <div className="flex items-center space-x-2 px-3 py-1.5 bg-gray-50 rounded-lg border">
            <span className="text-sm font-medium text-gray-600">Credits:</span>
            <span className="text-sm font-bold text-gray-900">{credits.toLocaleString()}</span>
            <div className="text-xs text-gray-500 ml-1">
              Empty Room: {CREDIT_COSTS.MASK_AND_EMPTY} • Staging: {CREDIT_COSTS.STAGING_FULL}
            </div>
          </div>
          
          <Button
            variant="outline"
            onClick={() => {
              if (currentStep !== 'upload' || currentSession) {
                // Show confirmation if user has work in progress
                if (window.confirm('Starting a new session will reset your current progress. Continue?')) {
                  handleRestart()
                }
              } else {
                handleRestart()
              }
            }}
          >
            ✨ New Session
          </Button>
        </div>
      </div>

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
                    className="max-w-2xl max-h-96 object-contain rounded-lg border shadow-lg cursor-pointer hover:shadow-xl transition-shadow"
                    onClick={() => window.open(uploadedImageUrl, '_blank')}
                    title="Click to view full size"
                  />
                </div>

                <Separator />

                {/* Room State Options */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <Card className="cursor-pointer hover:shadow-lg transition-all duration-300 border-2 border-transparent hover:border-green-200 group rounded-xl">
                    <CardContent className="p-6" onClick={() => handleRoomStateSelection('already_empty')}>
                      <div className="text-center space-y-3">
                        <div className="w-12 h-12 mx-auto bg-green-50 rounded-full flex items-center justify-center group-hover:bg-green-100 transition-colors">
                          <Check className="w-6 h-6 text-green-500" />
                        </div>
                        <h3 className="text-xl font-semibold">Room is Already Empty</h3>
                        <p className="text-sm text-muted-foreground leading-relaxed">
                          Use the uploaded image directly for staging
                        </p>
                        <div className="pt-1">
                          <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-green-100 text-green-700 border border-green-200">
                            FREE - No additional credits
                          </span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <Card className={`cursor-pointer transition-all duration-300 border-2 group rounded-xl ${
                    hasEnoughCreditsForEmptyRoom 
                      ? 'border-transparent hover:border-blue-200 hover:shadow-lg' 
                      : 'border-red-200 opacity-60'
                  }`}>
                    <CardContent 
                      className="p-6" 
                      onClick={() => hasEnoughCreditsForEmptyRoom && handleRoomStateSelection('generate_empty')}
                    >
                      <div className="text-center space-y-3">
                        <div className={`w-12 h-12 mx-auto rounded-full flex items-center justify-center transition-colors ${
                          hasEnoughCreditsForEmptyRoom
                            ? 'bg-blue-50 group-hover:bg-blue-100'
                            : 'bg-gray-50'
                        }`}>
                          <Wand2 className="w-6 h-6 text-blue-500" />
                        </div>
                        <h3 className="text-xl font-semibold">Generate Empty Room</h3>
                        <p className="text-sm text-muted-foreground leading-relaxed">
                          AI will remove furniture and objects to create an empty room
                        </p>
                        <div className="pt-1">
                          {hasEnoughCreditsForEmptyRoom ? (
                            <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-blue-100 text-blue-700 border border-blue-200">
                              {CREDIT_COSTS.MASK_AND_EMPTY} credits + 2 free retries
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-red-100 text-red-700 border border-red-200">
                              Insufficient credits
                            </span>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>

                <div className="flex justify-center pt-4">
                  <Button 
                    variant="outline" 
                    onClick={() => setCurrentStep('upload')}
                    className="px-6 py-2 border-2 hover:border-gray-400 transition-colors rounded-xl"
                  >
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
            <StagingGeneration 
              inputImageUrl={selectedEmptyRoomUrl || currentSession.originalImageUrl}
              onBack={() => currentSession.roomStateChoice === 'generate_empty' ? setCurrentStep('empty_room') : setCurrentStep('room_state')}
            />
          </motion.div>
        )}


      </AnimatePresence>


    </div>
  )
}
