'use client'

import React, { useRef, useEffect, useState, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Slider } from '@/components/ui/slider'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Eye, EyeOff, Download, RotateCcw } from 'lucide-react'

interface MaskOverlayProps {
  originalImageUrl: string
  maskImageUrl: string
  className?: string
  onMaskLoad?: (success: boolean) => void
}

export default function MaskOverlay({
  originalImageUrl,
  maskImageUrl,
  className = '',
  onMaskLoad
}: MaskOverlayProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showMask, setShowMask] = useState(true)
  const [maskOpacity, setMaskOpacity] = useState([0.6])
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 })
  const [isImagesLoaded, setIsImagesLoaded] = useState(false)

  // Image refs for canvas drawing
  const originalImageRef = useRef<HTMLImageElement | null>(null)
  const maskImageRef = useRef<HTMLImageElement | null>(null)

  // Load images
  const loadImages = useCallback(async () => {
    setIsLoading(true)
    setError(null)

    try {
      // Load original image
      const originalImg = new Image()
      originalImg.crossOrigin = 'anonymous'
      
      const originalPromise = new Promise<HTMLImageElement>((resolve, reject) => {
        originalImg.onload = () => resolve(originalImg)
        originalImg.onerror = () => reject(new Error('Failed to load original image'))
        originalImg.src = originalImageUrl
      })

      // Load mask image
      console.log(`🔍 MASK OVERLAY: Loading mask from URL:`, maskImageUrl)
      console.log(`🔍 MASK OVERLAY: URL type:`, typeof maskImageUrl)
      console.log(`🔍 MASK OVERLAY: URL length:`, maskImageUrl.length)
      console.log(`🔍 MASK OVERLAY: Is data URL:`, maskImageUrl.startsWith('data:'))
      
      const maskImg = new Image()
      maskImg.crossOrigin = 'anonymous'
      
      const maskPromise = new Promise<HTMLImageElement>((resolve, reject) => {
        maskImg.onload = () => {
          console.log(`🔍 MASK OVERLAY: Mask loaded successfully`)
          console.log(`🔍 MASK OVERLAY: Mask dimensions:`, maskImg.width, 'x', maskImg.height)
          resolve(maskImg)
        }
        maskImg.onerror = (e) => {
          console.error(`🔍 MASK OVERLAY: Failed to load mask image:`, e)
          console.error(`🔍 MASK OVERLAY: Failed URL:`, maskImageUrl)
          reject(new Error('Failed to load mask image'))
        }
        maskImg.src = maskImageUrl
      })

      // Wait for both images to load
      const [loadedOriginal, loadedMask] = await Promise.all([originalPromise, maskPromise])
      
      originalImageRef.current = loadedOriginal
      maskImageRef.current = loadedMask

      // Set canvas dimensions to match original image
      const maxWidth = 800
      const maxHeight = 600
      let { width, height } = loadedOriginal

      // Scale down if too large
      if (width > maxWidth || height > maxHeight) {
        const scale = Math.min(maxWidth / width, maxHeight / height)
        width *= scale
        height *= scale
      }

      setDimensions({ width, height })
      setIsImagesLoaded(true)
      onMaskLoad?.(true)
    } catch (err) {
      console.error('Error loading images:', err)
      setError(err instanceof Error ? err.message : 'Failed to load images')
      onMaskLoad?.(false)
    } finally {
      setIsLoading(false)
    }
  }, [originalImageUrl, maskImageUrl, onMaskLoad])

  // Draw on canvas
  const drawCanvas = useCallback(() => {
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    
    if (!canvas || !ctx || !originalImageRef.current || !isImagesLoaded) return

    // Set canvas size
    canvas.width = dimensions.width
    canvas.height = dimensions.height

    // Clear canvas
    ctx.clearRect(0, 0, dimensions.width, dimensions.height)

    // Draw original image
    ctx.drawImage(originalImageRef.current, 0, 0, dimensions.width, dimensions.height)

    // Draw mask overlay if enabled - EXACT SAME LOGIC AS PYTHON CODE
    if (showMask && maskImageRef.current) {
      console.log(`🔍 CANVAS: Drawing mask overlay`)
      console.log(`🔍 CANVAS: Mask dimensions:`, maskImageRef.current.width, 'x', maskImageRef.current.height)
      console.log(`🔍 CANVAS: Canvas dimensions:`, dimensions.width, 'x', dimensions.height)
      console.log(`🔍 CANVAS: Mask opacity:`, maskOpacity[0])
      
      // Step 1: Get image data from original image (already drawn)
      const imageData = ctx.getImageData(0, 0, dimensions.width, dimensions.height)
      const data = imageData.data
      
      // Step 2: Create a temporary canvas to get mask pixel data
      const maskCanvas = document.createElement('canvas')
      const maskCtx = maskCanvas.getContext('2d')!
      maskCanvas.width = dimensions.width
      maskCanvas.height = dimensions.height
      
      // Draw mask to temp canvas to get pixel data
      maskCtx.drawImage(maskImageRef.current, 0, 0, dimensions.width, dimensions.height)
      const maskData = maskCtx.getImageData(0, 0, dimensions.width, dimensions.height)
      const mask = maskData.data
      
      // Step 3: Create overlay - paint pink where mask is white (Python logic)
      const overlayData = ctx.createImageData(dimensions.width, dimensions.height)
      const overlay = overlayData.data
      
      // Copy original image to overlay
      for (let i = 0; i < data.length; i++) {
        overlay[i] = data[i]
      }
      
      // Paint pink where mask is white (mask value > 128)
      const pink = [255, 0, 255] // Hot pink in RGB
      const alpha = maskOpacity[0]
      
      for (let i = 0; i < mask.length; i += 4) {
        const maskValue = mask[i] // R channel of mask (grayscale)
        
        if (maskValue > 128) { // White area in mask = furniture
          const pixelIndex = i
          // Alpha blend: result = overlay * alpha + original * (1 - alpha)
          overlay[pixelIndex] = Math.round(pink[0] * alpha + data[pixelIndex] * (1 - alpha))     // R
          overlay[pixelIndex + 1] = Math.round(pink[1] * alpha + data[pixelIndex + 1] * (1 - alpha)) // G  
          overlay[pixelIndex + 2] = Math.round(pink[2] * alpha + data[pixelIndex + 2] * (1 - alpha)) // B
          // Alpha channel stays the same
          overlay[pixelIndex + 3] = data[pixelIndex + 3]
        }
      }
      
      // Step 4: Put the overlay back on canvas
      ctx.putImageData(overlayData, 0, 0)
      
      console.log(`🔍 CANVAS: Applied pixel-level mask overlay (Python method)`)
    }
  }, [dimensions, showMask, maskOpacity, isImagesLoaded])

  // Load images on mount or URL change
  useEffect(() => {
    loadImages()
  }, [loadImages])

  // Redraw canvas when settings change
  useEffect(() => {
    drawCanvas()
  }, [drawCanvas])

  // Download canvas as image
  const downloadImage = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const link = document.createElement('a')
    link.download = 'furniture-mask-overlay.png'
    link.href = canvas.toDataURL()
    link.click()
  }, [])

  // Reset to original view
  const resetView = useCallback(() => {
    setShowMask(true)
    setMaskOpacity([0.6])
  }, [])

  if (isLoading) {
    return (
      <Card className={className}>
        <CardContent className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-2"></div>
            <p className="text-sm text-muted-foreground">Loading mask overlay...</p>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (error) {
    return (
      <Card className={className}>
        <CardContent className="flex items-center justify-center h-64">
          <div className="text-center">
            <p className="text-sm text-destructive mb-2">Error: {error}</p>
            <Button onClick={loadImages} variant="outline" size="sm">
              Retry
            </Button>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className={className}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">Furniture Detection Mask</CardTitle>
          <div className="flex gap-2">
            <Badge variant="secondary">
              {dimensions.width} × {dimensions.height}
            </Badge>
            <Badge variant={showMask ? "default" : "outline"}>
              Mask {showMask ? 'ON' : 'OFF'}
            </Badge>
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {/* Canvas */}
        <div className="flex justify-center">
          <canvas
            ref={canvasRef}
            className="border rounded-lg shadow-sm max-w-full h-auto"
            style={{ maxWidth: '100%', height: 'auto' }}
          />
        </div>

        {/* Controls */}
        <div className="flex flex-col sm:flex-row gap-4 items-center">
          {/* Mask Toggle */}
          <Button
            onClick={() => setShowMask(!showMask)}
            variant={showMask ? "default" : "outline"}
            size="sm"
            className="flex items-center gap-2"
          >
            {showMask ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
            {showMask ? 'Hide Mask' : 'Show Mask'}
          </Button>

          {/* Opacity Slider */}
          {showMask && (
            <div className="flex items-center gap-2 flex-1 min-w-0">
              <span className="text-sm font-medium whitespace-nowrap">Opacity:</span>
              <Slider
                value={maskOpacity}
                onValueChange={setMaskOpacity}
                max={1}
                min={0.1}
                step={0.1}
                className="flex-1"
              />
              <span className="text-sm text-muted-foreground whitespace-nowrap">
                {Math.round(maskOpacity[0] * 100)}%
              </span>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex gap-2">
            <Button onClick={resetView} variant="outline" size="sm">
              <RotateCcw className="w-4 h-4" />
            </Button>
            <Button onClick={downloadImage} variant="outline" size="sm">
              <Download className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* Info */}
        <div className="text-xs text-muted-foreground text-center">
          Red overlay indicates detected furniture areas. Adjust opacity to see original image underneath.
        </div>
      </CardContent>
    </Card>
  )
} 