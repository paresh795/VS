'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { Loader2, Upload, Wand2 } from 'lucide-react'
import { toast } from 'sonner'
import { ImageUpload } from '@/components/upload/image-upload'
import MaskOverlay from '@/components/mask/mask-overlay'
import { type UploadResult as LibUploadResult } from '@/lib/upload'

interface UploadResult {
  jobId: string
  originalImageUrl: string
}

interface MaskResult {
  success: boolean
  jobId: string
  maskUrl: string
  creditsDeducted: number
  remainingCredits: number
}

export default function MaskTestPage() {
  const [uploadResults, setUploadResults] = useState<UploadResult[]>([])
  const [selectedJob, setSelectedJob] = useState<UploadResult | null>(null)
  const [maskResult, setMaskResult] = useState<MaskResult | null>(null)
  const [isProcessing, setIsProcessing] = useState(false)
  const [furnitureTags, setFurnitureTags] = useState('sofa,chair,table,lamp,bed,dresser,cabinet,bookshelf')
  const [useAsync, setUseAsync] = useState(false)
  const [pollingInterval, setPollingInterval] = useState<NodeJS.Timeout | null>(null)
  const [currentCredits, setCurrentCredits] = useState<number | null>(null)

  // Handle successful upload
  const handleUploadSuccess = (results: LibUploadResult[]) => {
    const newResults = results
      .filter(result => result.success && result.jobId && result.imageUrl)
      .map(result => ({
        jobId: result.jobId!,
        originalImageUrl: result.imageUrl!
      }))
    setUploadResults(prev => [...prev, ...newResults])
    toast.success(`Uploaded ${newResults.length} image(s) successfully`)
  }

  // Handle upload error
  const handleUploadError = (error: string) => {
    toast.error(`Upload failed: ${error}`)
  }

  // Add development credits
  const addCredits = async (amount: number = 100) => {
    try {
      const response = await fetch('/api/dev/add-credits', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ amount })
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to add credits')
      }

      setCurrentCredits(data.newBalance)
      toast.success(`Added ${amount} credits! New balance: ${data.newBalance}`)
    } catch (error) {
      console.error('Add credits error:', error)
      toast.error(error instanceof Error ? error.message : 'Failed to add credits')
    }
  }

  // Check current credits
  const checkCredits = async () => {
    try {
      const response = await fetch('/api/dev/add-credits')
      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to check credits')
      }

      setCurrentCredits(data.currentBalance)
    } catch (error) {
      console.error('Check credits error:', error)
    }
  }

  // Check credits on component mount
  useEffect(() => {
    checkCredits()
  }, [])

  // Poll job status for async processing
  const pollJobStatus = async (jobId: string) => {
    try {
      const response = await fetch(`/api/mask?jobId=${jobId}`)
      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to get job status')
      }

      console.log('Job status:', data.status)

      if (data.status === 'completed') {
        // Job completed successfully
        setMaskResult({
          success: true,
          jobId: data.jobId,
          maskUrl: data.maskUrl,
          creditsDeducted: data.creditsUsed || 0,
          remainingCredits: 0 // We don't track this in polling
        })
        setIsProcessing(false)
        if (pollingInterval) {
          clearInterval(pollingInterval)
          setPollingInterval(null)
        }
        toast.success('Furniture mask generated successfully!')
      } else if (data.status === 'failed') {
        // Job failed
        setIsProcessing(false)
        if (pollingInterval) {
          clearInterval(pollingInterval)
          setPollingInterval(null)
        }
        toast.error(`Mask generation failed: ${data.errorMessage || 'Unknown error'}`)
      }
      // If status is still 'processing', continue polling
    } catch (error) {
      console.error('Polling error:', error)
      // Continue polling on error, don't fail completely
    }
  }

  // Generate mask for selected job
  const generateMask = async () => {
    if (!selectedJob) return

    setIsProcessing(true)
    setMaskResult(null)

    try {
      const response = await fetch('/api/mask', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          imageUrl: selectedJob.originalImageUrl,
          tags: furnitureTags,
          async: useAsync
        })
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to generate mask')
      }

      if (useAsync && data.mode === 'async') {
        // Start polling for async job
        toast.success('Mask generation started! Processing asynchronously...')
        const interval = setInterval(() => pollJobStatus(data.jobId), 3000) // Poll every 3 seconds
        setPollingInterval(interval)
        
        // Set timeout to stop polling after 5 minutes
        setTimeout(() => {
          if (pollingInterval) {
            clearInterval(pollingInterval)
            setPollingInterval(null)
            setIsProcessing(false)
            toast.error('Job timed out after 5 minutes')
          }
        }, 5 * 60 * 1000)
      } else {
        // Synchronous result
        setMaskResult(data)
        setIsProcessing(false)
        setCurrentCredits(data.remainingCredits)
        toast.success('Furniture mask generated successfully!')
      }
    } catch (error) {
      console.error('Mask generation error:', error)
      toast.error(error instanceof Error ? error.message : 'Failed to generate mask')
      setIsProcessing(false)
    }
  }

  // Cleanup polling on unmount
  useEffect(() => {
    return () => {
      if (pollingInterval) {
        clearInterval(pollingInterval)
      }
    }
  }, [pollingInterval])

  // Clear results
  const clearResults = () => {
    setUploadResults([])
    setSelectedJob(null)
    setMaskResult(null)
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Furniture Masking Test</h1>
          <p className="text-muted-foreground">
            Test the Lang-SAM furniture detection and masking functionality
          </p>
        </div>
        <div className="flex items-center gap-4">
          {currentCredits !== null && (
            <div className="flex items-center gap-2">
              <Badge variant="secondary" className="text-sm">
                💰 Credits: {currentCredits}
              </Badge>
              <Button 
                onClick={() => addCredits(100)} 
                variant="outline" 
                size="sm"
                className="text-xs"
              >
                Add 100 Credits
              </Button>
            </div>
          )}
          {uploadResults.length > 0 && (
            <Button onClick={clearResults} variant="outline">
              Clear All
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Upload Section */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Upload className="w-5 h-5" />
              Upload Image
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ImageUpload
              onUploadComplete={handleUploadSuccess}
              maxFiles={1}
              className="h-48"
            />
          </CardContent>
        </Card>

        {/* Configuration Section */}
        <Card>
          <CardHeader>
            <CardTitle>Configuration</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="furniture-tags">Furniture Tags</Label>
              <Textarea
                id="furniture-tags"
                value={furnitureTags}
                onChange={(e) => setFurnitureTags(e.target.value)}
                placeholder="Enter furniture types separated by commas"
                className="mt-1"
                rows={3}
              />
              <p className="text-xs text-muted-foreground mt-1">
                Common furniture: sofa, chair, table, lamp, bed, dresser, cabinet, bookshelf
              </p>
            </div>

            <div className="flex items-center space-x-2">
              <Checkbox
                id="async-mode"
                checked={useAsync}
                onCheckedChange={(checked) => setUseAsync(checked === true)}
              />
              <Label htmlFor="async-mode" className="text-sm font-medium">
                Use Async Processing
              </Label>
              <Badge variant="outline" className="text-xs">
                {useAsync ? 'Webhook' : 'Sync'}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground">
              Async mode uses webhooks for better performance but requires polling for results.
            </p>

            {selectedJob && (
              <div className="space-y-2">
                <Label>Selected Image</Label>
                <div className="p-2 border rounded-lg bg-muted/50">
                  <p className="text-sm font-mono">{selectedJob.jobId}</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Uploaded Images */}
      {uploadResults.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Uploaded Images</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {uploadResults.map((result) => (
                <div
                  key={result.jobId}
                  className={`relative cursor-pointer border-2 rounded-lg overflow-hidden transition-colors ${
                    selectedJob?.jobId === result.jobId
                      ? 'border-primary bg-primary/5'
                      : 'border-border hover:border-primary/50'
                  }`}
                  onClick={() => setSelectedJob(result)}
                >
                  <img
                    src={result.originalImageUrl}
                    alt="Uploaded"
                    className="w-full h-32 object-cover"
                  />
                  <div className="absolute inset-0 bg-black/0 hover:bg-black/10 transition-colors" />
                  {selectedJob?.jobId === result.jobId && (
                    <Badge className="absolute top-2 right-2">
                      Selected
                    </Badge>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Generate Mask Section */}
      {selectedJob && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Wand2 className="w-5 h-5" />
              Generate Furniture Mask
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-4">
              <Button
                onClick={generateMask}
                disabled={isProcessing}
                className="flex items-center gap-2"
              >
                {isProcessing ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Wand2 className="w-4 h-4" />
                )}
                {isProcessing ? 'Generating Mask...' : 'Generate Mask'}
              </Button>
              
              {maskResult && (
                <div className="flex gap-2">
                  <Badge variant="secondary">
                    Credits Used: {maskResult.creditsDeducted}
                  </Badge>
                  <Badge variant="outline">
                    Remaining: {maskResult.remainingCredits}
                  </Badge>
                </div>
              )}
            </div>

            {isProcessing && (
              <div className="text-sm text-muted-foreground">
                Processing with Lang-SAM model... This may take up to 60 seconds.
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Mask Results */}
      {maskResult && selectedJob && (
        <MaskOverlay
          originalImageUrl={selectedJob.originalImageUrl}
          maskImageUrl={maskResult.maskUrl}
          className="w-full"
          onMaskLoad={(success) => {
            if (!success) {
              toast.error('Failed to load mask overlay')
            }
          }}
        />
      )}

      {/* Instructions */}
      <Card>
        <CardHeader>
          <CardTitle>How to Use</CardTitle>
        </CardHeader>
        <CardContent className="prose prose-sm max-w-none">
          <ol className="space-y-2">
            <li>
              <strong>Upload an Image:</strong> Use the upload area to select a room image with furniture
            </li>
            <li>
              <strong>Configure Tags:</strong> Customize the furniture types you want to detect
            </li>
            <li>
              <strong>Select Image:</strong> Click on an uploaded image to select it for processing
            </li>
            <li>
              <strong>Generate Mask:</strong> Click "Generate Mask" to run Lang-SAM furniture detection
            </li>
            <li>
              <strong>View Results:</strong> The mask overlay will show detected furniture areas in red
            </li>
            <li>
              <strong>Adjust Visualization:</strong> Use the controls to toggle mask visibility and adjust opacity
            </li>
          </ol>
        </CardContent>
      </Card>
    </div>
  )
} 