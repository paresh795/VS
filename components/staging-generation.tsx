"use client"

import { useState, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { Loader2, Wand2, Download, Share, Heart } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  useSessionStore,
  useStagingGenerations,
  useStagingConfig,
  useIsGenerating,
  type SessionWithGenerations
} from '@/lib/store/session-store'
import { useCreditsStore } from '@/lib/store/credits-store'
import { STYLE_PRESETS, ROOM_TYPES, CREDIT_COSTS } from '@/lib/constants'
import { toast } from 'sonner'

interface StagingGenerationProps {
  session: SessionWithGenerations
  inputImageUrl: string
  onComplete: () => void
  onBack: () => void
}

interface StagingResult {
  id: string
  urls: string[]
  style: string
  roomType: string
  generationNumber: number
  creditsCost: number
  createdAt: Date
}

export function StagingGenerationComponent({ 
  session, 
  inputImageUrl, 
  onComplete, 
  onBack 
}: StagingGenerationProps) {
  const [isGenerating, setIsGenerating] = useState(false)
  const [currentGeneration, setCurrentGeneration] = useState(1)
  
  // Store selectors
  const stagingGenerations = useStagingGenerations()
  const stagingConfig = useStagingConfig()
  const storeIsGenerating = useIsGenerating()
  
  // Store actions
  const {
    addStagingGeneration,
    updateStagingConfig,
    setIsGenerating: setStoreIsGenerating
  } = useSessionStore()
  
  const { deductCredits } = useCreditsStore()
  
  // Create results array from generations
  const stagingResults: StagingResult[] = stagingGenerations.map(gen => ({
    id: gen.id,
    urls: gen.outputImageUrls,
    style: gen.style,
    roomType: gen.roomType,
    generationNumber: gen.generationNumber,
    creditsCost: gen.creditsCost,
    createdAt: gen.createdAt
  }))

  const handleStyleChange = useCallback((style: string) => {
    updateStagingConfig({ style })
  }, [updateStagingConfig])

  const handleRoomTypeChange = useCallback((roomType: string) => {
    updateStagingConfig({ roomType })
  }, [updateStagingConfig])

  const handleGenerateStaging = useCallback(async () => {
    if (!session.id) {
      toast.error('No session found')
      return
    }

    if (!stagingConfig.style) {
      toast.error('Please select a style')
      return
    }

    setIsGenerating(true)
    setStoreIsGenerating(true)
    const generationNumber = stagingGenerations.length + 1
    setCurrentGeneration(generationNumber)

    try {
      console.log('🎨 [Staging Generation] Starting staging...', { 
        sessionId: session.id, 
        style: stagingConfig.style,
        roomType: stagingConfig.roomType,
        generationNumber 
      })
      
      // Optimistic credit deduction for UI feedback
      deductCredits(CREDIT_COSTS.STAGING_FULL)

      const response = await fetch('/api/stage', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          originalImageUrl: inputImageUrl,
          style: stagingConfig.style,
          roomType: stagingConfig.roomType || 'living_room',
          sessionId: session.id,
          generationNumber
        })
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to generate staging')
      }

      console.log('✅ [Staging Generation] Success:', data)

      // Add generation to store
      const newGeneration = {
        id: data.jobId,
        generationNumber,
        inputImageUrl,
        outputImageUrls: data.stagedUrls,
        style: stagingConfig.style,
        roomType: stagingConfig.roomType || 'living_room',
        creditsCost: data.creditsUsed,
        status: 'completed' as const,
        createdAt: new Date()
      }
      
      addStagingGeneration(newGeneration)

      toast.success('Virtual staging completed successfully!')

    } catch (error) {
      console.error('❌ [Staging Generation] Error:', error)
      
      // Add failed generation to store
      const failedGeneration = {
        id: `failed-${Date.now()}`,
        generationNumber,
        inputImageUrl,
        outputImageUrls: [],
        style: stagingConfig.style,
        roomType: stagingConfig.roomType || 'living_room',
        creditsCost: CREDIT_COSTS.STAGING_FULL,
        status: 'failed' as const,
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
        createdAt: new Date()
      }
      
      addStagingGeneration(failedGeneration)
      
      toast.error(
        error instanceof Error 
          ? error.message 
          : 'Failed to generate staging'
      )
    } finally {
      setIsGenerating(false)
      setStoreIsGenerating(false)
    }
  }, [session, inputImageUrl, stagingConfig, stagingGenerations.length, addStagingGeneration, setStoreIsGenerating, deductCredits])

  const handleDownloadImage = useCallback((url: string, filename: string) => {
    const link = document.createElement('a')
    link.href = url
    link.download = filename
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    toast.success('Download started!')
  }, [])

  const handleCompleteWorkflow = useCallback(() => {
    console.log('🎉 [Staging Generation] Completing workflow')
    toast.success('Staging session completed!')
    onComplete()
  }, [onComplete])

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card>
        <CardHeader>
          <CardTitle>Step 4: Virtual Staging</CardTitle>
          <CardDescription>
            Configure your staging preferences and generate professionally staged images
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">Input Image</p>
              <Badge variant="outline">
                {session.roomStateChoice === 'already_empty' ? 'Original Image' : 'Generated Empty Room'}
              </Badge>
            </div>
            
            <div className="text-right">
              <p className="text-sm text-muted-foreground">Credit Cost</p>
              <p className="text-lg font-semibold">
                {CREDIT_COSTS.STAGING_FULL} credits
                <span className="text-sm text-blue-600 ml-2">2 styled images</span>
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Input Image */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Input Image</CardTitle>
          <CardDescription>
            {session.roomStateChoice === 'already_empty' 
              ? 'Original uploaded image' 
              : 'AI-generated empty room'
            }
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex justify-center">
            <img 
              src={inputImageUrl} 
              alt="Input for staging" 
              className="max-w-md max-h-64 object-contain rounded-lg border"
            />
          </div>
        </CardContent>
      </Card>

      {/* Configuration */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Staging Configuration</CardTitle>
          <CardDescription>
            Choose the style and room type for your virtual staging
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Style Selection */}
            <div className="space-y-2">
              <Label htmlFor="style">Style</Label>
              <Select
                value={stagingConfig.style}
                onValueChange={handleStyleChange}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a style" />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(STYLE_PRESETS).map(([key, preset]) => (
                    <SelectItem key={key} value={key}>
                      <div className="flex items-center space-x-2">
                        <span>{preset.name}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Room Type Selection */}
            <div className="space-y-2">
              <Label htmlFor="roomType">Room Type</Label>
              <Select
                value={stagingConfig.roomType}
                onValueChange={handleRoomTypeChange}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select room type" />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(ROOM_TYPES).map(([key, roomTypeName]) => (
                    <SelectItem key={key} value={key}>
                      {roomTypeName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Generate Button */}
          <div className="pt-4">
            <Button 
              onClick={handleGenerateStaging}
              disabled={isGenerating || !stagingConfig.style}
              size="lg"
              className="w-full"
            >
              {isGenerating ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Generating Staging...
                </>
              ) : (
                <>
                  <Wand2 className="w-4 h-4 mr-2" />
                  Generate Virtual Staging
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Generated Results */}
      {stagingResults.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Generated Stagings</CardTitle>
            <CardDescription>
              Your professionally staged room images
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              <AnimatePresence>
                {stagingResults.map((result, resultIndex) => (
                  <motion.div
                    key={result.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20 }}
                    transition={{ duration: 0.3, delay: resultIndex * 0.1 }}
                    className="border rounded-lg p-4"
                  >
                    <div className="flex items-center justify-between mb-4">
                      <div>
                        <h4 className="font-semibold">Generation #{result.generationNumber}</h4>
                        <div className="flex items-center space-x-2 mt-1">
                          <Badge variant="outline">{STYLE_PRESETS[result.style as keyof typeof STYLE_PRESETS]?.name || result.style}</Badge>
                          <Badge variant="secondary">{ROOM_TYPES[result.roomType as keyof typeof ROOM_TYPES] || result.roomType}</Badge>
                          <Badge variant="outline">{result.creditsCost} credits</Badge>
                        </div>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {result.createdAt.toLocaleString()}
                      </p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {result.urls.map((url, urlIndex) => (
                        <div key={urlIndex} className="space-y-2">
                          <div className="relative group">
                            <img 
                              src={url} 
                              alt={`Staged result ${resultIndex + 1}.${urlIndex + 1}`}
                              className="w-full h-64 object-cover rounded-lg border"
                            />
                            
                            {/* Overlay with actions */}
                            <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-30 transition-all rounded-lg flex items-center justify-center opacity-0 group-hover:opacity-100">
                              <div className="flex space-x-2">
                                <Button
                                  size="sm"
                                  variant="secondary"
                                  onClick={() => handleDownloadImage(url, `staging-${result.generationNumber}-${urlIndex + 1}.jpg`)}
                                >
                                  <Download className="w-4 h-4" />
                                </Button>
                                <Button
                                  size="sm"
                                  variant="secondary"
                                  onClick={() => navigator.share?.({ url }) || navigator.clipboard.writeText(url)}
                                >
                                  <Share className="w-4 h-4" />
                                </Button>
                              </div>
                            </div>
                          </div>
                          
                          <p className="text-sm text-center text-muted-foreground">
                            Variant {urlIndex + 1}
                          </p>
                        </div>
                      ))}
                    </div>
                  </motion.div>
                ))}

                {/* Loading state for current generation */}
                {isGenerating && (
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="border-2 border-dashed border-gray-300 rounded-lg p-4"
                  >
                    <div className="text-center space-y-4">
                      <div className="flex items-center justify-center space-x-2">
                        <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
                        <span className="font-medium">Generating Staging #{currentGeneration}...</span>
                      </div>
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {[1, 2].map((variant) => (
                          <div key={variant} className="h-64 bg-gray-100 rounded-lg flex items-center justify-center">
                            <div className="text-center space-y-2">
                              <Loader2 className="w-8 h-8 animate-spin mx-auto text-gray-400" />
                              <p className="text-sm text-gray-500">Variant {variant}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                      
                      <div className="flex items-center justify-center space-x-2">
                        <Badge variant="outline">{STYLE_PRESETS[stagingConfig.style as keyof typeof STYLE_PRESETS]?.name}</Badge>
                        <Badge variant="secondary">{ROOM_TYPES[stagingConfig.roomType as keyof typeof ROOM_TYPES] || stagingConfig.roomType}</Badge>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Completion Actions */}
      {stagingResults.length > 0 && !isGenerating && (
        <Card className="border-green-200 bg-green-50">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <Heart className="w-5 h-5 text-green-600" />
                <div>
                  <h3 className="font-semibold text-green-800">Staging Complete!</h3>
                  <p className="text-sm text-green-600">
                    Your virtual staging session has been saved. You can generate more variations or complete the workflow.
                  </p>
                </div>
              </div>
              
              <div className="flex space-x-2">
                <Button 
                  variant="outline" 
                  onClick={handleGenerateStaging}
                  disabled={!stagingConfig.style}
                >
                  Generate Another
                </Button>
                <Button onClick={handleCompleteWorkflow}>
                  Complete Workflow
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Navigation */}
      <div className="flex justify-between">
        <Button variant="outline" onClick={onBack}>
          ← Back to {session.roomStateChoice === 'generate_empty' ? 'Empty Room' : 'Room State'}
        </Button>
        
        {stagingResults.length > 0 && (
          <Button onClick={handleCompleteWorkflow}>
            Complete Workflow →
          </Button>
        )}
      </div>
    </div>
  )
} 