"use client"

import React, { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { toast } from 'sonner'
import { Loader2, Wand2, Download, Share, Heart } from 'lucide-react'
import { useSessionStore, useCurrentSession, useStagingGenerations, useStagingConfig, useEmptyRoomGenerations } from '@/lib/store/session-store'
import { useCreditsStore } from '@/lib/store/credits-store'
import { STYLE_PRESETS, ROOM_TYPES, CREDIT_COSTS } from '@/lib/constants'
import type { StylePreset, RoomType } from '@/lib/constants'

interface StagingGenerationProps {
  inputImageUrl: string
  onComplete?: () => void
  onBack?: () => void
}

export function StagingGeneration({ inputImageUrl, onComplete, onBack }: StagingGenerationProps) {
  const session = useCurrentSession()
  const stagingGenerations = useStagingGenerations()
  const stagingConfig = useStagingConfig()
  
  const emptyRoomGenerations = useEmptyRoomGenerations()
  
  const { 
    addStagingGeneration, 
    updateStagingConfig,
    setIsGenerating: setStoreIsGenerating 
  } = useSessionStore()
  
  const { deductCredits } = useCreditsStore()
  
  const [isGenerating, setIsGenerating] = useState(false)
  const [currentGeneration, setCurrentGeneration] = useState(1)
  const [selectedEmptyRoomUrl, setSelectedEmptyRoomUrl] = useState(inputImageUrl)
  
  // Debug logging
  console.log('🎯 [Staging Generation] Component state:', {
    sessionId: session?.id,
    emptyRoomGenerationsCount: emptyRoomGenerations?.length || 0,
    emptyRoomGenerations: emptyRoomGenerations,
    selectedEmptyRoomUrl,
    inputImageUrl
  })
  
  // Only show empty room generations (not the original image)
  const emptyRoomOptions = emptyRoomGenerations
    .filter(gen => gen.outputImageUrls && gen.outputImageUrls.length > 0)
    .map((gen, index) => ({
      url: gen.outputImageUrls[0],
      label: `Empty Room ${index + 1}`,
      generationNumber: gen.generationNumber,
      id: gen.id
    }))
    
  console.log('🎯 [Staging Generation] Empty room options:', emptyRoomOptions)
  
  // Initialize selected room
  useEffect(() => {
    // If we have empty room generations, default to the first one
    if (emptyRoomOptions.length > 0) {
      const firstEmptyRoom = emptyRoomOptions[0].url
      console.log('🎯 [Staging Generation] Auto-selecting first empty room:', firstEmptyRoom)
      setSelectedEmptyRoomUrl(firstEmptyRoom)
    }
  }, [emptyRoomOptions.length])

  // Create results array from staging generations
  const stagingResults = stagingGenerations.map((gen, index) => ({
    id: gen.id,
    urls: gen.outputImageUrls || [],
    style: gen.style,
    roomType: gen.roomType,
    generationNumber: gen.generationNumber,
    creditsCost: gen.creditsCost,
    status: gen.status
  }))

  console.log('🎯 [Staging Generation] Staging generations from store:', stagingGenerations)
  console.log('🎯 [Staging Generation] Processed staging results:', stagingResults)

  const handleStyleChange = (style: string) => {
    updateStagingConfig({ style: style as StylePreset })
  }

  const handleRoomTypeChange = (roomType: string) => {
    updateStagingConfig({ roomType: roomType as RoomType })
  }

  const handleGenerateStaging = async () => {
    if (!selectedEmptyRoomUrl || !session?.id) return
    
    setIsGenerating(true)
    setStoreIsGenerating(true)
    setCurrentGeneration(stagingResults.length + 1)
    
    try {
      console.log('🎨 [Staging Generation] Starting staging generation...', {
        selectedEmptyRoomUrl,
        style: stagingConfig.style,
        roomType: stagingConfig.roomType,
        sessionId: session.id,
        currentGeneration
      })
      
      // Deduct credits before making API call
      deductCredits(CREDIT_COSTS.STAGING_FULL, `staging-generation-${currentGeneration}`, `Staging Generation ${currentGeneration}`)
      
      const response = await fetch('/api/stage', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageUrl: selectedEmptyRoomUrl,
          style: stagingConfig.style,
          roomType: stagingConfig.roomType,
          sessionId: session.id,
          generationNumber: currentGeneration
        })
      })

      if (!response.ok) {
        const errorData = await response.json()
        console.error('❌ [Staging Generation] API Error:', errorData)
        throw new Error(errorData.message || errorData.error || 'Failed to generate staging')
      }

      const data = await response.json()
      console.log('✅ [Staging Generation] API Response:', data)
      
      // CRITICAL FIX: Use the correct field name from API response
      const imageUrls = data.stagedUrls || data.stagedRoomUrls || []
      
      if (!imageUrls || imageUrls.length === 0) {
        console.error('❌ [Staging Generation] No image URLs in response:', data)
        throw new Error('No staged images received from API')
      }
      
      console.log('🖼️ [Staging Generation] Extracted image URLs:', imageUrls)
      
      const newGeneration = {
        id: data.jobId,
        generationNumber: currentGeneration,
        inputImageUrl: selectedEmptyRoomUrl,
        outputImageUrls: imageUrls,
        style: stagingConfig.style,
        roomType: stagingConfig.roomType,
        creditsCost: CREDIT_COSTS.STAGING_FULL,
        status: 'completed' as const,
        createdAt: new Date()
      }
      
      console.log('📦 [Staging Generation] Adding generation to store:', newGeneration)
      addStagingGeneration(newGeneration)
      toast.success(`Staging generated successfully! (Generation ${currentGeneration})`)
      
    } catch (error) {
      console.error('❌ [Staging Generation] Error:', error)
      toast.error('Failed to generate staging', {
        description: error instanceof Error ? error.message : 'Unknown error occurred'
      })
    } finally {
      setIsGenerating(false)
      setStoreIsGenerating(false)
    }
  }

  const handleDownload = async (imageUrl: string, filename: string) => {
    try {
      const response = await fetch(imageUrl)
      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = filename
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      window.URL.revokeObjectURL(url)
      toast.success('Image downloaded successfully!')
    } catch (error) {
      toast.error('Failed to download image')
    }
  }

  const handleShare = async (imageUrl: string) => {
    try {
      if (navigator.share) {
        await navigator.share({
          title: 'Staged Room Design',
          text: 'Check out this virtually staged room!',
          url: imageUrl
        })
      } else {
        await navigator.clipboard.writeText(imageUrl)
        toast.success('Image URL copied to clipboard!')
      }
    } catch (error) {
      toast.error('Failed to share image')
    }
  }

  if (!session) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center space-y-2">
          <Loader2 className="h-8 w-8 animate-spin mx-auto" />
          <p className="text-sm text-muted-foreground">Loading session...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="text-center space-y-4">
        <h2 className="text-2xl font-semibold">Step 4: Virtual Staging</h2>
        <p className="text-muted-foreground">
          Apply professional staging styles to your empty room. Each generation includes 2 styled variations.
        </p>
      </div>

      {/* Empty Room Selection - Side by side layout */}
      {emptyRoomOptions.length > 0 && (
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-center">
            {emptyRoomOptions.length > 1 ? 'Choose Your Room' : 'Your Empty Room'}
          </h3>
          <p className="text-center text-sm text-muted-foreground">
            {emptyRoomOptions.length > 1 
              ? 'Select which empty room image to use for staging'
              : 'This empty room will be used for staging'
            }
          </p>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {emptyRoomOptions.map((option, index) => (
              <Card 
                key={option.id}
                className={`cursor-pointer transition-all duration-200 ${
                  selectedEmptyRoomUrl === option.url
                    ? 'ring-2 ring-green-500 ring-offset-2 bg-green-50/30'
                    : 'hover:shadow-lg border-2 border-transparent hover:border-gray-200'
                }`}
                onClick={() => setSelectedEmptyRoomUrl(option.url)}
              >
                <CardContent className="p-4">
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <h4 className="font-semibold text-sm">{option.label}</h4>
                      {selectedEmptyRoomUrl === option.url && (
                        <div className="w-6 h-6 bg-green-500 rounded-full flex items-center justify-center">
                          <div className="w-3 h-3 bg-white rounded-full" />
                        </div>
                      )}
                    </div>
                    
                    <div className="relative rounded-lg overflow-hidden">
                      <img
                        src={option.url}
                        alt={option.label}
                        className="w-full aspect-video object-cover"
                        onError={(e) => {
                          console.error('🖼️ [Staging Generation] Image failed to load:', option.url)
                          e.currentTarget.style.display = 'none'
                        }}
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}
      
      {/* Fallback when no empty room options */}
      {emptyRoomOptions.length === 0 && (
        <div className="space-y-4">
          <div className="text-center space-y-4 p-8 border rounded-xl bg-yellow-50/30">
            <h3 className="text-lg font-semibold text-yellow-800">No Empty Room Available</h3>
            <p className="text-sm text-yellow-700">
              You need to generate an empty room first before proceeding with staging.
            </p>
            <Button onClick={onBack} variant="outline" className="mt-4">
              ← Back to Empty Room Generation
            </Button>
          </div>
        </div>
      )}

      {/* Style Configuration */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-3">
          <label className="text-sm font-medium">Style Preset</label>
          <Select value={stagingConfig.style} onValueChange={handleStyleChange}>
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(STYLE_PRESETS).map(([key, preset]) => (
                <SelectItem key={key} value={key}>
                  <div className="flex items-center space-x-2">
                    <div 
                      className="w-3 h-3 rounded-full" 
                      style={{ backgroundColor: preset.color }} 
                    />
                    <span>{preset.name}</span>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            {STYLE_PRESETS[stagingConfig.style as StylePreset]?.description}
          </p>
        </div>

        <div className="space-y-3">
          <label className="text-sm font-medium">Room Type</label>
          <Select value={stagingConfig.roomType} onValueChange={handleRoomTypeChange}>
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(ROOM_TYPES).map(([key, value]) => (
                <SelectItem key={key} value={value}>
                  {value.charAt(0).toUpperCase() + value.slice(1)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Generate Button */}
      <div className="text-center">
        <Button
          onClick={handleGenerateStaging}
          disabled={isGenerating || !selectedEmptyRoomUrl}
          size="lg"
          className="px-8 py-3"
        >
          {isGenerating ? (
            <>
              <Loader2 className="h-5 w-5 animate-spin mr-2" />
              Generating...
            </>
          ) : (
            <>
              <Wand2 className="h-5 w-5 mr-2" />
              Generate Staging ({CREDIT_COSTS.STAGING_FULL} credits)
            </>
          )}
        </Button>
      </div>

      {/* Loading State for NEW Staging Generation - Show alongside existing results */}
      {isGenerating && (
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-center">Generating New Styled Room...</h3>
          <div className="rounded-xl border p-6 space-y-4 bg-blue-50/30">
            {/* Generation Header for New Generation */}
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <h4 className="font-semibold">Generation #{currentGeneration}</h4>
                <div className="flex items-center space-x-2">
                  <Badge variant="outline" className="text-xs">{STYLE_PRESETS[stagingConfig.style as keyof typeof STYLE_PRESETS]?.name || stagingConfig.style}</Badge>
                  <Badge variant="secondary" className="text-xs">{CREDIT_COSTS.STAGING_FULL} credits</Badge>
                </div>
              </div>
              <div className="text-sm text-muted-foreground">
                45-90 seconds
              </div>
            </div>
            
            {/* Loading Cards for New Generation */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {[1, 2].map((variantNum) => (
                <div key={variantNum} className="relative rounded-xl border-2 border-dashed border-blue-300 overflow-hidden">
                  <div className="aspect-video bg-gradient-to-br from-blue-100 to-blue-200 flex items-center justify-center">
                    <div className="text-center space-y-3">
                      <Loader2 className="w-8 h-8 animate-spin text-blue-500 mx-auto" />
                      <div>
                        <p className="font-medium text-blue-700">Creating Styled Version {variantNum}</p>
                        <p className="text-sm text-blue-600">Applying {STYLE_PRESETS[stagingConfig.style as keyof typeof STYLE_PRESETS]?.name} style...</p>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Generated Results - Clean grid layout - ALWAYS VISIBLE (Previous + Current) */}
      {stagingResults.length > 0 && (
        <div className="space-y-4">
          <div className="text-center space-y-2">
            <h3 className="text-lg font-semibold">Your Staged Rooms</h3>
            {stagingResults.length > 1 && (
              <p className="text-sm text-muted-foreground">
                {stagingResults.length} generation{stagingResults.length > 1 ? 's' : ''} created
                {isGenerating ? ' • New generation in progress...' : ''}
              </p>
            )}
          </div>
          
          {stagingResults.map((result, resultIndex) => (
            <div key={result.id} className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <h4 className="font-semibold">Generation {result.generationNumber}</h4>
                  <Badge variant="outline" className="text-xs">
                    {STYLE_PRESETS[result.style as keyof typeof STYLE_PRESETS]?.name || result.style}
                  </Badge>
                  <Badge variant="secondary" className="text-xs">
                    {result.creditsCost} credits
                  </Badge>
                </div>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {result.urls.map((imageUrl, imageIndex) => {
                  console.log(`🖼️ [Staging Generation] Rendering image ${imageIndex + 1}:`, imageUrl)
                  
                  return (
                    <Card key={imageIndex} className="overflow-hidden group">
                      <CardContent className="p-0">
                        <div className="relative">
                          <img
                            src={imageUrl}
                            alt={`Staged room ${result.generationNumber} variant ${imageIndex + 1}`}
                            className="w-full aspect-video object-cover group-hover:scale-105 transition-transform duration-300"
                            onClick={() => window.open(imageUrl, '_blank')}
                            onLoad={() => {
                              console.log(`✅ [Staging Generation] Image ${imageIndex + 1} loaded successfully:`, imageUrl)
                            }}
                            onError={(e) => {
                              console.error(`❌ [Staging Generation] Image ${imageIndex + 1} failed to load:`, imageUrl)
                              console.error('Image error event:', e)
                              // Show a placeholder or error message
                              e.currentTarget.style.background = 'linear-gradient(45deg, #f0f0f0, #e0e0e0)'
                              e.currentTarget.style.display = 'flex'
                              e.currentTarget.style.alignItems = 'center'
                              e.currentTarget.style.justifyContent = 'center'
                              e.currentTarget.innerHTML = '<div style="text-align: center; color: #666;"><p>Image failed to load</p><p style="font-size: 12px;">Click to view in new tab</p></div>'
                            }}
                          />
                          
                          {/* Action buttons */}
                          <div className="absolute top-2 right-2 flex space-x-2 opacity-0 group-hover:opacity-100 transition-opacity">
                            <Button
                              size="sm"
                              variant="secondary"
                              className="h-8 w-8 p-0"
                              onClick={(e) => {
                                e.stopPropagation()
                                handleDownload(imageUrl, `staged-room-${result.generationNumber}-${imageIndex + 1}.jpg`)
                              }}
                            >
                              <Download className="h-4 w-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="secondary"
                              className="h-8 w-8 p-0"
                              onClick={(e) => {
                                e.stopPropagation()
                                handleShare(imageUrl)
                              }}
                            >
                              <Share className="h-4 w-4" />
                            </Button>
                          </div>
                          
                          {/* Variant indicator */}
                          <div className="absolute bottom-2 left-2">
                            <Badge variant="secondary" className="text-xs bg-black/60 text-white">
                              Variant {imageIndex + 1}
                            </Badge>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Back Button */}
      {onBack && (
        <div className="flex justify-center">
          <Button
            onClick={onBack}
            variant="ghost"
            disabled={isGenerating}
          >
            ← Back to Empty Room
          </Button>
        </div>
      )}
    </div>
  )
} 