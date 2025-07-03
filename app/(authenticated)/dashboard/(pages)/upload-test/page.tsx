"use client"

import { useState, useEffect } from "react"
import { ImageUpload } from "@/components/upload/image-upload"
import { EmptyRoomGenerator } from "@/components/empty-room/empty-room-generator"
import { StyleSelector } from "@/components/staging/style-selector"
import { VariantComparison } from "@/components/staging/variant-comparison"
import { StagingDebug } from "@/components/staging/staging-debug"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Separator } from "@/components/ui/separator"
import { 
  CheckCircle, 
  Upload, 
  Zap, 
  Palette, 
  Download,
  RotateCcw,
  ArrowRight,
  Sparkles
} from "lucide-react"
import { type UploadResult } from "@/lib/upload"
import { StylePreset, STYLE_PRESETS, CREDIT_COSTS } from "@/lib/constants"
import { useCreditsStore } from "@/lib/store/credits-store"
import { toast } from "sonner"

type WorkflowStep = 'upload' | 'empty-room' | 'styling' | 'results';

interface StepStatus {
  upload: boolean;
  emptyRoom: boolean;
  styling: boolean;
  results: boolean;
}

export default function VirtualStagingWorkflow() {
  // Credit store for immediate UI updates
  const { deductCredits: deductCreditsFromStore, addCredits: addCreditsToStore, balance } = useCreditsStore()
  
  // Core state
  const [currentStep, setCurrentStep] = useState<WorkflowStep>('upload')
  const [stepStatus, setStepStatus] = useState<StepStatus>({
    upload: false,
    emptyRoom: false,
    styling: false,
    results: false
  })

  // Upload state
  const [uploadResults, setUploadResults] = useState<UploadResult[]>([])
  const [selectedImage, setSelectedImage] = useState<string | null>(null)
  
  // Empty room state
  const [emptyRoomResults, setEmptyRoomResults] = useState<Record<string, string>>({})
  const [selectedEmptyRoom, setSelectedEmptyRoom] = useState<string | null>(null)

  // Styling state
  const [selectedStyle, setSelectedStyle] = useState<StylePreset | null>(null)
  const [selectedRoomType, setSelectedRoomType] = useState<string | null>(null)

  // Staging state (simple synchronous approach)
  const [isStaging, setIsStaging] = useState(false)
  const [stagingResult, setStagingResult] = useState<any>(null)

  // Simple staging function that works like empty room generation
  const performStaging = async (params: any) => {
    setIsStaging(true)
    setStagingResult(null)
    
    // ✨ IMMEDIATE CREDIT DEDUCTION FOR UI
    const creditCost = CREDIT_COSTS.STAGING_FULL
    
    // Check if user has enough credits
    if (balance < creditCost) {
      toast.error(`Insufficient credits. Required: ${creditCost}, Available: ${balance}`)
      setIsStaging(false)
      return
    }
    
    // Deduct credits immediately from UI (this will automatically track as pending)
    try {
      deductCreditsFromStore(creditCost, 'staging-pending', 'Virtual Staging')
      toast.info(`Deducted ${creditCost} credits. Generation starting...`)
    } catch (storeError) {
      toast.error('Failed to deduct credits from local store')
      setIsStaging(false)
      return
    }
    
    try {
      console.log('🎬 [STAGING] Starting staging request...')
      console.log('🎬 [STAGING] Params:', params)
      console.log('🎬 [STAGING] Style value:', params.style, typeof params.style)
      console.log('🎬 [STAGING] Space value:', params.space, typeof params.space)
      
      const response = await fetch('/api/stage', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params)
      })
      
      const data = await response.json()
      console.log('🎬 [STAGING] API response:', data)
      
      if (!response.ok) {
        console.error('🎬 [STAGING] API error details:', data)
        
        // 🔄 ROLLBACK CREDITS ON UI FAILURE
        console.log('🔄 [STAGING] Rolling back credits in UI due to API failure...')
        addCreditsToStore(creditCost, 'Staging Refund - API Failed')
        
        const errorMessage = data.details || data.error || 'Staging failed'
        throw new Error(errorMessage)
      }
      
      if (data.success && data.stagedUrls?.length >= 2) {
        const result = {
          success: true,
          stagedUrls: data.stagedUrls,
          creditsUsed: data.creditsUsed
        }
        setStagingResult(result)
        setStepStatus(prev => ({ ...prev, results: true }))
        toast.success('Staging completed successfully!')
        return result
      } else {
        // 🔄 ROLLBACK CREDITS ON INVALID RESPONSE
        console.log('🔄 [STAGING] Rolling back credits in UI due to invalid response...')
        addCreditsToStore(creditCost, 'Staging Refund - Invalid Response')
        throw new Error('Invalid staging response')
      }
      
    } catch (error) {
      console.error('🎬 [STAGING] Error:', error)
      
      // 🔄 ROLLBACK CREDITS ON ANY ERROR (if not already done)
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      if (!errorMessage.includes('Staging failed') && !errorMessage.includes('Invalid staging response')) {
        console.log('🔄 [STAGING] Rolling back credits in UI due to unexpected error...')
        addCreditsToStore(creditCost, 'Staging Refund - Unexpected Error')
      }
      
      toast.error(`Staging failed: ${errorMessage}`)
      throw error
    } finally {
      setIsStaging(false)
    }
  }

  // Progress calculation
  const getProgress = () => {
    const steps = Object.values(stepStatus)
    const completed = steps.filter(Boolean).length
    return (completed / steps.length) * 100
  }

  // Handlers
  const handleUploadComplete = (results: UploadResult[]) => {
    console.log('Upload completed:', results)
    setUploadResults(prev => [...prev, ...results])
    
    // Auto-select first successful upload
    const firstSuccess = results.find(r => r.success && r.imageUrl)
    if (firstSuccess?.imageUrl) {
      setSelectedImage(firstSuccess.imageUrl)
      setStepStatus(prev => ({ ...prev, upload: true }))
    }
  }

  const handleEmptyRoomComplete = (imageUrl: string, emptyRoomUrl: string) => {
    setEmptyRoomResults(prev => ({
      ...prev,
      [imageUrl]: emptyRoomUrl
    }))
    
    // Auto-select if this is the selected image
    if (imageUrl === selectedImage) {
      setSelectedEmptyRoom(emptyRoomUrl)
      setStepStatus(prev => ({ ...prev, emptyRoom: true }))
      setCurrentStep('styling')
    }
  }

  const handleStyleSelect = (style: StylePreset) => {
    setSelectedStyle(style)
  }

  const handleRoomTypeSelect = (roomType: string) => {
    setSelectedRoomType(roomType)
  }

  const handleProceedToStaging = async () => {
    if (!selectedImage || !selectedEmptyRoom || !selectedStyle || !selectedRoomType) {
      toast.error('Please complete all previous steps before staging')
      return
    }

    setStepStatus(prev => ({ ...prev, styling: true }))
    setCurrentStep('results')

    // Use simple staging function
    try {
      await performStaging({
        originalImageUrl: selectedImage,
        emptyRoomUrl: selectedEmptyRoom,
        style: selectedStyle,
        space: selectedRoomType
      })
    } catch (error) {
      setCurrentStep('styling')
      console.error('Staging failed:', error)
    }
  }

  const handleRegenerateStaging = async () => {
    if (!selectedImage || !selectedEmptyRoom || !selectedStyle || !selectedRoomType) return

    // Use simple staging function for regeneration
    try {
      await performStaging({
        originalImageUrl: selectedImage,
        emptyRoomUrl: selectedEmptyRoom,
        style: selectedStyle,
        space: selectedRoomType
      })
    } catch (error) {
      console.error('Regeneration failed:', error)
    }
  }

  const handleDownload = (imageUrl: string, variant: number) => {
    const link = document.createElement('a')
    link.href = imageUrl
    link.download = `staged-room-${selectedStyle ? STYLE_PRESETS[selectedStyle].name : 'variant'}-${variant}.jpg`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    toast.success(`Downloaded variant ${variant}`)
  }

  const handleStartOver = () => {
    setCurrentStep('upload')
    setStepStatus({ upload: false, emptyRoom: false, styling: false, results: false })
    setUploadResults([])
    setSelectedImage(null)
    setEmptyRoomResults({})
    setSelectedEmptyRoom(null)
    setSelectedStyle(null)
    setSelectedRoomType(null)
    // Clear any staging jobs from store if needed
    // The jobs store will handle cleanup automatically
    toast.info('Starting new staging workflow')
  }

  const handleSelectImage = (imageUrl: string) => {
    setSelectedImage(imageUrl)
    setSelectedEmptyRoom(emptyRoomResults[imageUrl] || null)
    setStepStatus(prev => ({ 
      ...prev, 
      upload: true, 
      emptyRoom: !!emptyRoomResults[imageUrl] 
    }))
    
    if (emptyRoomResults[imageUrl]) {
      setCurrentStep('styling')
    } else {
      setCurrentStep('empty-room')
    }
  }

  const steps = [
    { key: 'upload', label: 'Upload Images', icon: Upload, completed: stepStatus.upload },
    { key: 'empty-room', label: 'Generate Empty Room', icon: Zap, completed: stepStatus.emptyRoom },
    { key: 'styling', label: 'Select Style', icon: Palette, completed: stepStatus.styling },
    { key: 'results', label: 'View Results', icon: Sparkles, completed: stepStatus.results }
  ]

  return (
    <div className="container mx-auto p-6 max-w-7xl">
      <div className="space-y-8">
        {/* Header */}
        <div className="text-center space-y-4">
          <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
            🏠 Virtual Staging Workflow
          </h1>
          <p className="text-lg text-muted-foreground max-w-3xl mx-auto">
            Complete end-to-end testing environment for Virtual Staging SaaS. 
            Upload room images, generate empty rooms, select styling, and get professional results.
          </p>
        </div>

        {/* Progress Header */}
        <Card>
          <CardContent className="pt-6">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold">Workflow Progress</h3>
                <Badge variant="outline">{Math.round(getProgress())}% Complete</Badge>
              </div>
              
              <Progress value={getProgress()} className="h-2" />
              
              <div className="grid grid-cols-4 gap-4">
                {steps.map((step, index) => {
                  const Icon = step.icon
                  const isActive = currentStep === step.key
                  const isCompleted = step.completed
                  
                  return (
                    <div 
                      key={step.key}
                      className={`flex items-center gap-2 p-3 rounded-lg border transition-all ${
                        isActive 
                          ? 'bg-blue-50 border-blue-200 text-blue-700' 
                          : isCompleted 
                            ? 'bg-green-50 border-green-200 text-green-700'
                            : 'bg-gray-50 border-gray-200 text-gray-500'
                      }`}
                    >
                      <Icon className="h-4 w-4" />
                      <span className="text-sm font-medium">{step.label}</span>
                      {isCompleted && <CheckCircle className="h-4 w-4 ml-auto" />}
                    </div>
                  )
                })}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Step Content */}
        {currentStep === 'upload' && (
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Upload className="h-5 w-5" />
                  Step 1: Upload Room Images
                </CardTitle>
                <CardDescription>
                  Upload your room photos to begin the staging process. Supports JPEG, PNG, and WebP files up to 10MB.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ImageUpload
                  onUploadComplete={handleUploadComplete}
                  maxFiles={3}
                  className="min-h-[200px]"
                />
              </CardContent>
            </Card>

            {uploadResults.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <CheckCircle className="h-5 w-5 text-green-500" />
                    Uploaded Images
                  </CardTitle>
                  <CardDescription>
                    Select an image to proceed with staging
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {uploadResults.filter(r => r.success && r.imageUrl).map((result, index) => (
                      <div 
                        key={index} 
                        className={`border rounded-lg p-4 cursor-pointer transition-all hover:shadow-lg ${
                          selectedImage === result.imageUrl ? 'ring-2 ring-blue-500 bg-blue-50' : ''
                        }`}
                        onClick={() => handleSelectImage(result.imageUrl!)}
                      >
                        <div className="space-y-3">
                          <img
                            src={result.imageUrl!}
                            alt={result.fileName || `Upload ${index + 1}`}
                            className="w-full h-40 object-cover rounded"
                          />
                          <div className="space-y-1">
                            <p className="font-medium text-sm">{result.fileName}</p>
                            <p className="text-xs text-muted-foreground">
                              {result.fileSize ? (result.fileSize / (1024 * 1024)).toFixed(2) + ' MB' : 'Unknown size'}
                            </p>
                          </div>
                          {selectedImage === result.imageUrl && (
                            <Badge className="w-full justify-center">Selected</Badge>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        )}

        {currentStep === 'empty-room' && selectedImage && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Zap className="h-5 w-5 text-blue-500" />
                Step 2: Generate Empty Room
              </CardTitle>
              <CardDescription>
                Generate an empty version of your room for staging
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div>
                  <h4 className="font-medium mb-2">Original Image</h4>
                  <img 
                    src={selectedImage} 
                    alt="Original room" 
                    className="w-full h-64 object-cover rounded-lg border"
                  />
                </div>
                <div>
                  <h4 className="font-medium mb-2">Empty Room Generation</h4>
                  <EmptyRoomGenerator 
                    imageUrl={selectedImage}
                    onComplete={(emptyRoomUrl) => handleEmptyRoomComplete(selectedImage, emptyRoomUrl)}
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {currentStep === 'styling' && selectedImage && selectedEmptyRoom && (
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Palette className="h-5 w-5 text-purple-500" />
                  Step 3: Choose Staging Style
                </CardTitle>
                <CardDescription>
                  Select a design style and room type for your virtual staging
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  <div>
                    <h4 className="font-medium mb-2">Original</h4>
                    <img 
                      src={selectedImage} 
                      alt="Original room" 
                      className="w-full h-32 object-cover rounded-lg border"
                    />
                  </div>
                  <div>
                    <h4 className="font-medium mb-2">Empty Room</h4>
                    <img 
                      src={selectedEmptyRoom} 
                      alt="Empty room" 
                      className="w-full h-32 object-cover rounded-lg border"
                    />
                  </div>
                  <div className="flex items-center justify-center">
                    <ArrowRight className="h-6 w-6 text-gray-400" />
                    <span className="text-sm text-gray-500 ml-2">Ready for staging</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            <StyleSelector
              selectedStyle={selectedStyle}
              selectedRoomType={selectedRoomType}
              onStyleSelect={handleStyleSelect}
              onRoomTypeSelect={handleRoomTypeSelect}
              onProceed={handleProceedToStaging}
              disabled={isStaging}
            />
          </div>
        )}

        {currentStep === 'results' && (
          <div className="space-y-6">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Sparkles className="h-5 w-5 text-yellow-500" />
                    Step 4: Staging Results
                  </CardTitle>
                  <CardDescription>
                    Your professionally staged room variants
                  </CardDescription>
                </div>
                <div className="flex gap-2">
                  <Button 
                    variant="outline" 
                    onClick={handleRegenerateStaging}
                    disabled={isStaging}
                    className="flex items-center gap-2"
                  >
                    <RotateCcw className="h-4 w-4" />
                    Regenerate
                  </Button>
                  <Button 
                    onClick={handleStartOver}
                    className="flex items-center gap-2"
                  >
                    <Upload className="h-4 w-4" />
                    Start New
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                                 {stagingResult && stagingResult.stagedUrls && stagingResult.stagedUrls.length >= 2 ? (
                   <VariantComparison
                     originalImageUrl={selectedImage!}
                     emptyRoomUrl={selectedEmptyRoom!}
                     variant1Url={stagingResult.stagedUrls[0]}
                     variant2Url={stagingResult.stagedUrls[1]}
                     style={selectedStyle ? STYLE_PRESETS[selectedStyle].name : 'Unknown'}
                     roomType={selectedRoomType || 'Unknown'}
                     onDownload={handleDownload}
                     onRegenerate={handleRegenerateStaging}
                   />
                 ) : isStaging ? (
                  <div className="text-center py-12">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
                    <p className="text-lg font-medium">Generating your staged room variants...</p>
                    <p className="text-sm text-muted-foreground">This may take 30-60 seconds</p>
                  </div>
                 ) : (
                   <div className="space-y-6">
                     <div className="text-center py-8">
                       <p className="text-lg font-medium text-red-600">Staging Failed</p>
                       <p className="text-sm text-muted-foreground">Something went wrong during the staging process</p>
                     </div>
                     
                     <StagingDebug />
                     
                     <div className="text-center">
                       <Button onClick={handleRegenerateStaging} className="flex items-center gap-2">
                         <RotateCcw className="h-4 w-4" />
                         Try Again
                       </Button>
                     </div>
                   </div>
                )}
              </CardContent>
            </Card>
          </div>
        )}

        {/* Development Info */}
        <Card className="border-dashed">
          <CardHeader>
            <CardTitle className="text-sm">Development Testing Information</CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground space-y-2">
            <p><strong>Current Step:</strong> {currentStep}</p>
            <p><strong>Selected Image:</strong> {selectedImage ? '✓ Set' : '✗ None'}</p>
            <p><strong>Empty Room:</strong> {selectedEmptyRoom ? '✓ Generated' : '✗ Pending'}</p>
                         <p><strong>Style Selection:</strong> {selectedStyle ? `✓ ${STYLE_PRESETS[selectedStyle].name}` : '✗ None'}</p>
            <p><strong>Room Type:</strong> {selectedRoomType || 'None selected'}</p>
            <p><strong>Staging Status:</strong> {isStaging ? 'Processing...' : 'Ready'}</p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
} 