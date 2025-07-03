"use client"

import { useState, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Loader2, RotateCcw, Check, Lock, AlertCircle } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  useSessionStore,
  useEmptyRoomGenerations,
  useSelectedEmptyRoomUrl,
  useCanRetryEmptyRoom,
  useIsGenerating,
  type SessionWithGenerations
} from '@/lib/store/session-store'
import { useCreditsStore } from '@/lib/store/credits-store'
import { CREDIT_COSTS } from '@/lib/constants'
import { toast } from 'sonner'

interface EmptyRoomGenerationProps {
  session: SessionWithGenerations
  onComplete: () => void
  onBack: () => void
}

interface EmptyRoomResult {
  id: string
  url: string
  isSelected: boolean
  generationNumber: number
  creditsCost: number
}

export function EmptyRoomGenerationComponent({ 
  session, 
  onComplete, 
  onBack 
}: EmptyRoomGenerationProps) {
  const [isLocalGenerating, setIsLocalGenerating] = useState(false)
  const [currentRetry, setCurrentRetry] = useState(1)
  
  // Debug logging
  console.log('🏠 [EmptyRoomGeneration] Component mounted with session:', {
    sessionExists: !!session,
    sessionId: session?.id,
    sessionType: typeof session,
    sessionKeys: session ? Object.keys(session) : [],
    originalImageUrl: session?.originalImageUrl,
    roomStateChoice: session?.roomStateChoice,
    hasOriginalImage: !!session?.originalImageUrl
  })
  
  // More detailed session validation
  if (!session) {
    console.error('❌ [EmptyRoomGeneration] No session provided to component')
    return (
      <Card>
        <CardContent className="p-6 text-center">
          <p className="text-red-600">No session data provided to component</p>
          <Button onClick={onBack} className="mt-4">Go Back</Button>
        </CardContent>
      </Card>
    )
  }
  
  if (!session.id) {
    console.error('❌ [EmptyRoomGeneration] Session missing ID:', {
      session: session,
      sessionKeys: Object.keys(session),
      hasId: 'id' in session,
      idValue: session.id,
      idType: typeof session.id
    })
    return (
      <Card>
        <CardContent className="p-6 text-center">
          <p className="text-red-600">Session is missing ID. Please try creating a new session.</p>
          <Button onClick={onBack} className="mt-4">Go Back</Button>
        </CardContent>
      </Card>
    )
  }
  
  // Store selectors
  const emptyRoomGenerations = useEmptyRoomGenerations()
  const selectedEmptyRoomUrl = useSelectedEmptyRoomUrl()
  const canRetryEmptyRoom = useCanRetryEmptyRoom()
  const storeIsGenerating = useIsGenerating()
  
  // Store actions
  const {
    addEmptyRoomGeneration,
    selectEmptyRoom,
    incrementEmptyRoomRetries,
    setIsGenerating: setStoreIsGenerating
  } = useSessionStore()
  
  const { deductCredits } = useCreditsStore()
  
  // Create results array from generations
  const emptyRoomResults: EmptyRoomResult[] = emptyRoomGenerations.map(gen => ({
    id: gen.id,
    url: gen.outputImageUrls[0] || '',
    isSelected: selectedEmptyRoomUrl === gen.outputImageUrls[0],
    generationNumber: gen.generationNumber,
    creditsCost: gen.creditsCost
  }))

  const handleGenerateEmptyRoom = useCallback(async (retryNumber: number = 1) => {
    setIsLocalGenerating(true)
    setStoreIsGenerating(true)
    setCurrentRetry(retryNumber)

    try {
      console.log('🏠 [Empty Room Generation] Starting generation...', { sessionId: session.id, retryNumber })
      
      // Optimistic credit deduction for UI feedback (only for initial generation)
      if (retryNumber === 1) {
        deductCredits(CREDIT_COSTS.MASK_AND_EMPTY)
      }

      const response = await fetch('/api/empty-room', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageUrl: session.originalImageUrl,
          sessionId: session.id,
          retryNumber
        })
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to generate empty room')
      }

      console.log('✅ [Empty Room Generation] Success:', data)

      // Add generation to store
      const newGeneration = {
        id: data.jobId,
        generationNumber: retryNumber,
        inputImageUrl: session.originalImageUrl,
        outputImageUrls: data.emptyRoomUrls || [data.emptyRoomUrl],
        creditsCost: data.creditsUsed,
        status: 'completed' as const,
        createdAt: new Date()
      }
      
      addEmptyRoomGeneration(newGeneration)

      // Auto-select the new generation if it's the first one
      if (retryNumber === 1) {
        selectEmptyRoom(data.emptyRoomUrl)
      }

      // Increment retry count in store
      if (retryNumber > 1) {
        incrementEmptyRoomRetries()
      }

      toast.success(
        retryNumber === 1 
          ? 'Empty room generated successfully!' 
          : `Retry ${retryNumber - 1} completed!`
      )

    } catch (error) {
      console.error('❌ [Empty Room Generation] Error:', error)
      
      // Add failed generation to store
      const failedGeneration = {
        id: `failed-${Date.now()}`,
        generationNumber: retryNumber,
        inputImageUrl: session.originalImageUrl,
        outputImageUrls: [],
        creditsCost: retryNumber === 1 ? CREDIT_COSTS.MASK_AND_EMPTY : 0,
        status: 'failed' as const,
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
        createdAt: new Date()
      }
      
      addEmptyRoomGeneration(failedGeneration)
      
      toast.error(
        error instanceof Error 
          ? error.message 
          : 'Failed to generate empty room'
      )
    } finally {
      setIsLocalGenerating(false)
      setStoreIsGenerating(false)
    }
  }, [session, addEmptyRoomGeneration, selectEmptyRoom, incrementEmptyRoomRetries, setStoreIsGenerating, deductCredits])

  const handleSelectEmptyRoom = useCallback((url: string) => {
    console.log('🎯 [Empty Room Generation] Selecting empty room:', url)
    selectEmptyRoom(url)
    toast.success('Empty room selected for staging')
  }, [selectEmptyRoom])

  const handleLockAndProceed = useCallback(() => {
    if (!selectedEmptyRoomUrl) {
      toast.error('Please select an empty room first')
      return
    }
    
    console.log('🔒 [Empty Room Generation] Locking selection and proceeding to staging')
    toast.success('Empty room locked! Proceeding to staging...')
    onComplete()
  }, [selectedEmptyRoomUrl, onComplete])

  const maxRetries = 3
  const retriesUsed = emptyRoomGenerations.length
  const retriesRemaining = maxRetries - retriesUsed

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card>
        <CardHeader>
          <CardTitle>Step 3: Empty Room Generation</CardTitle>
          <CardDescription>
            Generate an empty version of your room. You get 2 free retries if you don't like the result.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">Generation Progress</p>
              <div className="flex items-center space-x-2">
                <Badge variant="outline">
                  {retriesUsed}/{maxRetries} attempts used
                </Badge>
                {retriesRemaining > 0 && (
                  <Badge variant="secondary">
                    {retriesRemaining} retries remaining
                  </Badge>
                )}
              </div>
            </div>
            
            <div className="text-right">
              <p className="text-sm text-muted-foreground">Credit Cost</p>
              <p className="text-lg font-semibold">
                {CREDIT_COSTS.MASK_AND_EMPTY} credits
                <span className="text-sm text-green-600 ml-2">+ Free retries</span>
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Original Image */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Original Image</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex justify-center">
            <img 
              src={session.originalImageUrl} 
              alt="Original room" 
              className="max-w-md max-h-64 object-contain rounded-lg border"
            />
          </div>
        </CardContent>
      </Card>

      {/* Generation Controls */}
      {emptyRoomGenerations.length === 0 && (
        <Card>
          <CardContent className="p-6">
            <div className="text-center space-y-4">
              <h3 className="text-lg font-semibold">Ready to Generate Empty Room</h3>
              <p className="text-muted-foreground">
                AI will analyze your image and remove furniture and objects to create an empty room.
              </p>
              <Button 
                onClick={() => handleGenerateEmptyRoom(1)}
                disabled={isLocalGenerating}
                size="lg"
                className="w-full max-w-xs"
              >
                {isLocalGenerating ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <RotateCcw className="w-4 h-4 mr-2" />
                    Generate Empty Room
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Generated Results */}
      {emptyRoomGenerations.length > 0 && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-lg">Generated Empty Rooms</CardTitle>
                <CardDescription>
                  Select the version you prefer for staging
                </CardDescription>
              </div>
              
              {canRetryEmptyRoom && !isLocalGenerating && (
                <Button 
                  variant="outline"
                  onClick={() => handleGenerateEmptyRoom(retriesUsed + 1)}
                  className="flex items-center space-x-2"
                >
                  <RotateCcw className="w-4 h-4" />
                  <span>Retry ({retriesRemaining} left)</span>
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <AnimatePresence>
                {emptyRoomResults.map((result, index) => (
                  <motion.div
                    key={result.id}
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.8 }}
                    transition={{ duration: 0.3, delay: index * 0.1 }}
                    className={`
                      relative cursor-pointer rounded-lg border-2 transition-all hover:shadow-lg
                      ${result.isSelected ? 'border-blue-500 ring-2 ring-blue-200' : 'border-gray-200 hover:border-gray-300'}
                    `}
                    onClick={() => handleSelectEmptyRoom(result.url)}
                  >
                    <div className="p-3">
                      <div className="relative">
                        <img 
                          src={result.url} 
                          alt={`Empty room generation ${result.generationNumber}`}
                          className="w-full h-48 object-cover rounded"
                        />
                        
                        {/* Selection indicator */}
                        {result.isSelected && (
                          <div className="absolute top-2 right-2">
                            <div className="bg-blue-500 text-white rounded-full p-1">
                              <Check className="w-4 h-4" />
                            </div>
                          </div>
                        )}
                        
                        {/* Generation number badge */}
                        <div className="absolute top-2 left-2">
                          <Badge variant="secondary">
                            #{result.generationNumber}
                          </Badge>
                        </div>
                      </div>
                      
                      <div className="mt-2 text-center">
                        <p className="text-sm font-medium">
                          Generation {result.generationNumber}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {result.creditsCost > 0 ? `${result.creditsCost} credits` : 'Free retry'}
                        </p>
                      </div>
                    </div>
                  </motion.div>
                ))}

                {/* Loading state for current generation */}
                {isLocalGenerating && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="border-2 border-dashed border-gray-300 rounded-lg p-3"
                  >
                    <div className="h-48 flex items-center justify-center bg-gray-50 rounded">
                      <div className="text-center space-y-2">
                        <Loader2 className="w-8 h-8 animate-spin mx-auto text-blue-500" />
                        <p className="text-sm text-muted-foreground">
                          Generating #{currentRetry}...
                        </p>
                      </div>
                    </div>
                    <div className="mt-2 text-center">
                      <Badge variant="outline">Generating...</Badge>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Selection and Proceed */}
      {selectedEmptyRoomUrl && !isLocalGenerating && (
        <Card className="border-green-200 bg-green-50">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <Lock className="w-5 h-5 text-green-600" />
                <div>
                  <h3 className="font-semibold text-green-800">Empty Room Selected</h3>
                  <p className="text-sm text-green-600">
                    This image will be used for virtual staging
                  </p>
                </div>
              </div>
              
              <Button onClick={handleLockAndProceed} size="lg">
                Lock & Proceed to Staging
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* No retries left warning */}
      {!canRetryEmptyRoom && !selectedEmptyRoomUrl && (
        <Card className="border-orange-200 bg-orange-50">
          <CardContent className="p-6">
            <div className="flex items-center space-x-3">
              <AlertCircle className="w-5 h-5 text-orange-600" />
              <div>
                <h3 className="font-semibold text-orange-800">No More Retries</h3>
                <p className="text-sm text-orange-600">
                  You've used all available retries. Please select one of the generated images to proceed.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Navigation */}
      <div className="flex justify-between">
        <Button variant="outline" onClick={onBack}>
          ← Back to Room State
        </Button>
        
        {selectedEmptyRoomUrl && (
          <Button onClick={handleLockAndProceed}>
            Proceed to Staging →
          </Button>
        )}
      </div>
    </div>
  )
} 