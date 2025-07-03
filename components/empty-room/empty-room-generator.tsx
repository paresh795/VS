'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Badge } from '@/components/ui/badge'
import { Loader2, Zap, ArrowRight } from 'lucide-react'
import { useGenerateEmptyRoom } from '@/lib/query/empty-room'
import { useJobsStore } from '@/lib/store/jobs-store'
import { JobType } from '@/lib/store/types'
import { CREDIT_COSTS } from '@/lib/constants'

interface EmptyRoomGeneratorProps {
  imageUrl: string
  onComplete?: (emptyRoomUrl: string) => void
}

export function EmptyRoomGenerator({ imageUrl, onComplete }: EmptyRoomGeneratorProps) {
  const [showResult, setShowResult] = useState(false)
  const generateEmptyRoom = useGenerateEmptyRoom()
  const { getLatestJob } = useJobsStore()

  // Get the latest empty room job for this image
  const latestJob = getLatestJob(JobType.EMPTY_ROOM)
  const isProcessing = latestJob?.status === 'processing' || generateEmptyRoom.isPending
  const isCompleted = latestJob?.status === 'completed' && latestJob?.resultUrl
  const isFailed = latestJob?.status === 'failed'

  const handleGenerate = async () => {
    try {
      const result = await generateEmptyRoom.mutateAsync({ imageUrl })
      if (result.emptyRoomUrl && onComplete) {
        onComplete(result.emptyRoomUrl)
      }
      setShowResult(true)
    } catch (error) {
      // Error is handled by the mutation
      console.error('Failed to generate empty room:', error)
    }
  }

  const getProgress = () => {
    if (!latestJob) return 0
    if (latestJob.status === 'completed') return 100
    return latestJob.progress || 0
  }

  const getStatusMessage = () => {
    if (isProcessing) return 'Removing furniture and décor...'
    if (isCompleted) return 'Empty room generated successfully!'
    if (isFailed) return 'Generation failed'
    return 'Ready to generate empty room'
  }

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Zap className="h-5 w-5 text-blue-500" />
          Empty Room Generation
        </CardTitle>
        <CardDescription>
          Remove all furniture and décor while preserving the room's architecture and lighting.
        </CardDescription>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {/* Credit Cost Display */}
        <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
          <span className="text-sm font-medium">Credit Cost:</span>
          <Badge variant="secondary">{CREDIT_COSTS.MASK_AND_EMPTY} credits</Badge>
        </div>

        {/* Progress Display */}
        {isProcessing && (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span>{getStatusMessage()}</span>
              <span>{Math.round(getProgress())}%</span>
            </div>
            <Progress value={getProgress()} className="h-2" />
          </div>
        )}

        {/* Generation Button */}
        <Button 
          onClick={handleGenerate}
          disabled={isProcessing}
          className="w-full"
          size="lg"
        >
          {isProcessing ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Generating...
            </>
          ) : (
            <>
              <Zap className="mr-2 h-4 w-4" />
              Generate Empty Room
            </>
          )}
        </Button>

        {/* Status Messages */}
        {isFailed && latestJob?.errorMessage && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-sm text-red-700">{latestJob.errorMessage}</p>
          </div>
        )}

        {/* Before/After Comparison */}
        {(isCompleted || showResult) && latestJob?.resultUrl && (
          <div className="space-y-4">
            <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
              <p className="text-sm text-green-700 font-medium">✓ Empty room generated successfully!</p>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Original Image */}
              <div className="space-y-2">
                <h4 className="text-sm font-medium text-gray-700">Original Room</h4>
                <div className="relative aspect-square rounded-lg overflow-hidden border">
                  <img 
                    src={imageUrl} 
                    alt="Original room"
                    className="w-full h-full object-cover"
                  />
                </div>
              </div>

              {/* Generated Empty Room */}
              <div className="space-y-2">
                <h4 className="text-sm font-medium text-gray-700">Empty Room</h4>
                <div className="relative aspect-square rounded-lg overflow-hidden border">
                  <img 
                    src={latestJob.resultUrl} 
                    alt="Empty room"
                    className="w-full h-full object-cover"
                  />
                </div>
              </div>
            </div>

            {/* Next Steps */}
            <div className="flex items-center justify-center p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <span className="text-sm text-blue-700 mr-2">Ready for staging</span>
              <ArrowRight className="h-4 w-4 text-blue-500" />
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
} 