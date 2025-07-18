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
  // State
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
  const emptyRoomResults: EmptyRoomResult[] = emptyRoomGenerations.map(gen => {
    const url = gen.outputImageUrls?.[0] || ''
    console.log('🖼️ [Debug] Empty room generation:', { 
      id: gen.id, 
      outputImageUrls: gen.outputImageUrls, 
      firstUrl: url,
      urlType: typeof url,
      urlLength: url?.length,
      status: gen.status,
      fullGeneration: gen
    })
    return {
    id: gen.id,
      url: url,
      isSelected: selectedEmptyRoomUrl === url,
    generationNumber: gen.generationNumber,
    creditsCost: gen.creditsCost
    }
  })

  console.log('🖼️ [Debug] EmptyRoomResults:', emptyRoomResults)
  console.log('🖼️ [Debug] Raw emptyRoomGenerations:', emptyRoomGenerations)

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

      // Test URLs immediately for accessibility
      if (data.emptyRoomUrls && data.emptyRoomUrls.length > 0) {
        console.log('🧪 [URL Test] Testing URL accessibility...')
        data.emptyRoomUrls.forEach((url: string, index: number) => {
          fetch(url, { method: 'HEAD' })
            .then(response => {
              console.log(`✅ [URL Test] URL ${index + 1} accessible:`, {
                url,
                status: response.status,
                ok: response.ok,
                contentType: response.headers.get('content-type')
              })
            })
            .catch(error => {
              console.error(`❌ [URL Test] URL ${index + 1} not accessible:`, {
                url,
                error
              })
            })
        })
      }

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
      
      console.log('📦 [Store] Adding generation to store:', {
        newGeneration,
        apiData: data,
        outputImageUrls: newGeneration.outputImageUrls,
        firstUrl: newGeneration.outputImageUrls[0]
      })
      
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
      {/* Original Image - Clean design matching step 1 */}
      <div className="text-center space-y-4">
        <h2 className="text-2xl font-semibold">Step 3: Empty Room Generation</h2>
        <p className="text-muted-foreground">
            Generate an empty version of your room. You get 2 free retries if you don't like the result.
        </p>
        
        {/* Original Image with same sizing as step 1 */}
        <div className="flex justify-center">
          <img 
            src={session.originalImageUrl} 
            alt="Original room" 
            className="max-w-2xl max-h-96 object-contain rounded-lg border shadow-lg cursor-pointer hover:shadow-xl transition-shadow"
            onClick={() => window.open(session.originalImageUrl, '_blank')}
            title="Click to view full size"
          />
        </div>

        {/* Generation Status - Compact display */}
        <div className="inline-flex items-center space-x-4 px-4 py-2 bg-gray-50 rounded-lg border">
              <div className="flex items-center space-x-2">
            <Badge variant="outline" className="text-xs">
              {retriesUsed}/{maxRetries} attempts
                </Badge>
                {retriesRemaining > 0 && (
              <Badge variant="secondary" className="text-xs">
                {retriesRemaining} retries left
                  </Badge>
                )}
          </div>
          <div className="text-sm">
            <span className="font-medium">{CREDIT_COSTS.MASK_AND_EMPTY} credits</span>
            <span className="text-green-600 ml-1">+ Free retries</span>
          </div>
              </div>
            </div>
            
      {/* Loading State During Generation */}
      {isLocalGenerating && (
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-center">Generating Your Empty Room...</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {[1, 2].map((placeholder) => (
              <div
                key={placeholder}
                className="relative rounded-xl border-2 border-dashed border-gray-300 overflow-hidden"
              >
                <div className="aspect-video bg-gradient-to-br from-gray-100 to-gray-200 flex items-center justify-center">
                  <div className="text-center space-y-3">
                    <Loader2 className="w-12 h-12 animate-spin text-blue-500 mx-auto" />
                    <div>
                      <p className="font-medium text-gray-700">Generating Option {placeholder}</p>
                      <p className="text-sm text-gray-500">This usually takes 30-60 seconds</p>
                    </div>
                  </div>
                </div>
                <div className="p-4 bg-white">
                  <div className="flex items-center justify-between">
                    <div className="h-4 bg-gray-200 rounded w-24 animate-pulse"></div>
                    <div className="h-3 bg-gray-200 rounded w-16 animate-pulse"></div>
                  </div>
            </div>
          </div>
            ))}
          </div>
        </div>
      )}

      {/* Generation Controls - When no generations exist */}
      {emptyRoomGenerations.length === 0 && !isLocalGenerating && (
            <div className="text-center space-y-4">
              <Button 
                onClick={() => handleGenerateEmptyRoom(1)}
                disabled={isLocalGenerating}
                size="lg"
            className="px-8 py-3 rounded-xl"
              >
                    <RotateCcw className="w-4 h-4 mr-2" />
                    Generate Empty Room
              </Button>
            </div>
      )}

      {/* Generated Results - Large Grid Layout (like before) */}
      {emptyRoomResults.length > 0 && !isLocalGenerating && (
        <div className="space-y-6">
          <h3 className="text-lg font-semibold text-center">Choose Your Empty Room</h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <AnimatePresence>
                {emptyRoomResults.map((result, index) => (
                  <motion.div
                    key={result.id}
                  initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                    transition={{ duration: 0.3, delay: index * 0.1 }}
                    className={`
                    relative cursor-pointer rounded-xl border-2 transition-all hover:shadow-lg group overflow-hidden
                    ${result.isSelected ? 'border-blue-500 ring-2 ring-blue-200 bg-blue-50' : 'border-gray-200 hover:border-gray-300'}
                    `}
                    onClick={() => handleSelectEmptyRoom(result.url)}
                  >
                  {/* Selection Indicator */}
                  {result.isSelected && (
                    <div className="absolute top-3 right-3 z-10 bg-blue-500 text-white rounded-full p-2 shadow-lg">
                      <Check className="w-5 h-5" />
                    </div>
                  )}
                  
                  {/* Large Image Display */}
                  <div className="aspect-video relative">
                    {result.url ? (
                        <img 
                          src={result.url} 
                          alt={`Empty room generation ${result.generationNumber}`}
                        className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                        onError={(e) => {
                          console.error('❌ [Image] Failed to load:', result.url)
                        }}
                        onClick={(e) => {
                          e.stopPropagation()
                          window.open(result.url, '_blank')
                        }}
                        title="Click to view full size"
                      />
                    ) : (
                      <div className="w-full h-full bg-gray-200 flex items-center justify-center">
                        <p className="text-gray-500">No image available</p>
                        </div>
                    )}
                      </div>
                      
                  {/* Generation Info - Full clickable area */}
                  <div className="p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <Badge variant="outline" className="text-sm">
                          Generation {result.generationNumber}
                      </Badge>
                      <span className="text-sm text-gray-500">
                        {result.creditsCost} credits
                      </span>
                    </div>
                    <div className="text-center">
                      <p className="text-lg font-medium text-gray-800">
                        {result.isSelected ? (
                          <span className="text-blue-600">✓ Selected for Staging</span>
                        ) : (
                          'Click anywhere to select'
                        )}
                      </p>
                      <p className="text-sm text-gray-500 mt-1">
                        Click image to view full size
                        </p>
                      </div>
                    </div>
                  </motion.div>
                ))}
            </AnimatePresence>
                      </div>
                    </div>
      )}

      {/* Retry Section */}
      {emptyRoomResults.length > 0 && canRetryEmptyRoom && !isLocalGenerating && (
        <div className="text-center space-y-3">
          <p className="text-sm text-muted-foreground">
            Not satisfied with the results? You can try again.
          </p>
          <Button
            variant="outline"
            onClick={() => handleGenerateEmptyRoom(retriesUsed + 1)}
            className="flex items-center space-x-2 rounded-xl"
          >
            <RotateCcw className="w-4 h-4" />
            <span>Retry ({retriesRemaining} left)</span>
              </Button>
            </div>
      )}

      {/* Action Buttons */}
      {emptyRoomGenerations.length > 0 && selectedEmptyRoomUrl && (
        <div className="text-center space-y-4">
          <Button 
            onClick={handleLockAndProceed}
            size="lg"
            className="px-8 py-3 rounded-xl"
          >
            Continue to Staging →
          </Button>
            </div>
      )}

      {/* Back Button */}
      <div className="flex justify-center pt-4">
        <Button 
          variant="outline" 
          onClick={onBack}
          className="px-6 py-2 border-2 hover:border-gray-400 transition-colors rounded-xl"
        >
          ← Back to Room State
        </Button>
      </div>
    </div>
  )
} 