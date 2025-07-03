"use client"

import { useState, useCallback, useRef } from "react"
import { useDropzone, type FileRejection } from "react-dropzone"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { Badge } from "@/components/ui/badge"
import { Upload, X, Image as ImageIcon, AlertCircle, CheckCircle } from "lucide-react"
import { cn } from "@/lib/utils"
import { UPLOAD_LIMITS } from "@/lib/constants"
import { 
  uploadFile, 
  validateUploadFile, 
  createUploadController,
  formatFileSize,
  type UploadResult,
  type UploadProgress 
} from "@/lib/upload"

interface ImageFile {
  file: File
  preview: string
  id: string
  status: 'idle' | 'uploading' | 'success' | 'error'
  progress: number
  error?: string
  result?: UploadResult
  controller?: AbortController
}

interface ImageUploadProps {
  onUploadComplete?: (results: UploadResult[]) => void
  onRemove?: (fileId: string) => void
  maxFiles?: number
  className?: string
  disabled?: boolean
}

const ACCEPTED_TYPES = {
  'image/jpeg': ['.jpg', '.jpeg'],
  'image/png': ['.png'],
  'image/webp': ['.webp']
}

export function ImageUpload({
  onUploadComplete,
  onRemove,
  maxFiles = 1,
  className,
  disabled = false
}: ImageUploadProps) {
  const [uploadedFiles, setUploadedFiles] = useState<ImageFile[]>([])
  const [isUploading, setIsUploading] = useState(false)
  const fileIdCounter = useRef(0)

  const createImageFile = (file: File): ImageFile => {
    const id = `file-${++fileIdCounter.current}`
    return {
      file,
      preview: URL.createObjectURL(file),
      id,
      status: 'idle',
      progress: 0
    }
  }

  const updateFileStatus = (fileId: string, updates: Partial<ImageFile>) => {
    setUploadedFiles(prev => 
      prev.map(file => 
        file.id === fileId ? { ...file, ...updates } : file
      )
    )
  }

  const uploadSingleFile = async (imageFile: ImageFile) => {
    const { controller, signal, cancel } = createUploadController()
    
    // Update file with controller for cancellation
    updateFileStatus(imageFile.id, { 
      status: 'uploading',
      progress: 0,
      controller,
      error: undefined 
    })

    try {
      const result = await uploadFile(imageFile.file, {
        signal,
        onProgress: (progress: UploadProgress) => {
          updateFileStatus(imageFile.id, { 
            progress: progress.percentage 
          })
        },
        onError: (error: string) => {
          updateFileStatus(imageFile.id, { 
            status: 'error',
            error,
            progress: 0 
          })
        }
      })

      if (result.success) {
        updateFileStatus(imageFile.id, { 
          status: 'success',
          progress: 100,
          result,
          error: undefined 
        })
      } else {
        updateFileStatus(imageFile.id, { 
          status: 'error',
          error: result.error || 'Upload failed',
          progress: 0 
        })
      }

      return result
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Upload failed'
      updateFileStatus(imageFile.id, { 
        status: 'error',
        error: errorMessage,
        progress: 0 
      })
      return { success: false, error: errorMessage }
    }
  }

  const onDrop = useCallback(
    async (acceptedFiles: File[], rejectedFiles: FileRejection[]) => {
      if (disabled || isUploading) return

      // Handle rejected files
      if (rejectedFiles.length > 0) {
        console.warn('Rejected files:', rejectedFiles)
        return
      }

      // Validate files
      const validFiles: File[] = []
      const invalidFiles: { file: File; error: string }[] = []

      for (const file of acceptedFiles) {
        const validation = validateUploadFile(file)
        if (!validation.valid) {
          invalidFiles.push({ file, error: validation.error || 'Invalid file' })
        } else {
          validFiles.push(file)
        }
      }

      // Show errors for invalid files
      if (invalidFiles.length > 0) {
        invalidFiles.forEach(({ file, error }) => {
          console.error(`${file.name}: ${error}`)
          // You could show a toast notification here
        })
      }

      // Check if we exceed max files
      const totalFiles = uploadedFiles.length + validFiles.length
      if (totalFiles > maxFiles) {
        console.error(`Maximum ${maxFiles} file(s) allowed`)
        return
      }

      if (validFiles.length === 0) return

      // Create image file objects
      const newImageFiles = validFiles.map(createImageFile)
      setUploadedFiles(prev => [...prev, ...newImageFiles])
      setIsUploading(true)

      try {
        // Upload files sequentially
        const results: UploadResult[] = []
        for (const imageFile of newImageFiles) {
          const result = await uploadSingleFile(imageFile)
          results.push(result)
        }

        // Notify parent component
        const successfulResults = results.filter(r => r.success)
        if (successfulResults.length > 0) {
          onUploadComplete?.(successfulResults)
        }
      } finally {
        setIsUploading(false)
      }
    },
    [uploadedFiles.length, maxFiles, disabled, isUploading, onUploadComplete, uploadSingleFile]
  )

  const { getRootProps, getInputProps, isDragActive, isDragReject } = useDropzone({
    onDrop,
    accept: ACCEPTED_TYPES,
    maxFiles,
    maxSize: UPLOAD_LIMITS.MAX_FILE_SIZE,
    disabled: disabled || isUploading,
    multiple: maxFiles > 1
  })

  const removeFile = (fileId: string) => {
    setUploadedFiles(prev => {
      const fileToRemove = prev.find(f => f.id === fileId)
      if (fileToRemove) {
        // Cancel upload if in progress
        if (fileToRemove.status === 'uploading' && fileToRemove.controller) {
          fileToRemove.controller.abort()
        }
        // Clean up preview URL
        URL.revokeObjectURL(fileToRemove.preview)
      }
      return prev.filter(f => f.id !== fileId)
    })
    onRemove?.(fileId)
  }

  const cancelUpload = (fileId: string) => {
    const file = uploadedFiles.find(f => f.id === fileId)
    if (file?.controller) {
      file.controller.abort()
    }
  }

  const getStatusIcon = (imageFile: ImageFile) => {
    switch (imageFile.status) {
      case 'success':
        return <CheckCircle className="h-4 w-4 text-green-500" />
      case 'error':
        return <AlertCircle className="h-4 w-4 text-red-500" />
      case 'uploading':
        return <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      default:
        return <ImageIcon className="h-4 w-4 text-muted-foreground" />
    }
  }

  const canUploadMore = uploadedFiles.length < maxFiles && !isUploading
  const hasFiles = uploadedFiles.length > 0

  return (
    <div className={cn("space-y-4", className)}>
      {/* Upload Area */}
      {canUploadMore && (
        <div
          {...getRootProps()}
          className={cn(
            "border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors",
            isDragActive && !isDragReject && "border-primary bg-primary/5",
            isDragReject && "border-red-500 bg-red-50",
            disabled && "cursor-not-allowed opacity-50",
            !isDragActive && !isDragReject && "border-muted-foreground/25 hover:border-primary/50"
          )}
        >
          <input {...getInputProps()} />
          
          <div className="flex flex-col items-center gap-2">
            <Upload className={cn(
              "h-8 w-8 mx-auto",
              isDragActive && !isDragReject && "text-primary",
              isDragReject && "text-red-500",
              !isDragActive && "text-muted-foreground"
            )} />
            
            {isDragReject ? (
              <div className="text-red-500">
                <p className="font-medium">Invalid file type</p>
                <p className="text-sm">Please upload JPEG, PNG, or WebP images</p>
              </div>
            ) : (
              <div>
                <p className="font-medium">
                  {isDragActive 
                    ? "Drop your images here" 
                    : "Drag & drop images here, or click to browse"
                  }
                </p>
                <p className="text-sm text-muted-foreground mt-1">
                  JPEG, PNG, WebP up to {UPLOAD_LIMITS.MAX_FILE_SIZE / (1024 * 1024)}MB
                  {maxFiles > 1 && ` (max ${maxFiles} files)`}
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Uploaded Files */}
      {hasFiles && (
        <div className="space-y-3">
          <h4 className="font-medium text-sm">
            Uploaded Files ({uploadedFiles.length}/{maxFiles})
          </h4>
          
          <div className="space-y-2">
            {uploadedFiles.map((imageFile) => (
              <div
                key={imageFile.id}
                className="flex items-center gap-3 p-3 border rounded-lg bg-card"
              >
                {/* Thumbnail */}
                <div className="flex-shrink-0">
                  <img
                    src={imageFile.preview}
                    alt={imageFile.file.name}
                    className="h-12 w-12 object-cover rounded"
                  />
                </div>

                {/* File Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    {getStatusIcon(imageFile)}
                    <p className="font-medium text-sm truncate">
                      {imageFile.file.name}
                    </p>
                    <Badge variant="secondary" className="text-xs">
                      {formatFileSize(imageFile.file.size)}
                    </Badge>
                  </div>

                  {imageFile.status === 'uploading' && (
                    <div className="mt-2 space-y-1">
                      <Progress value={imageFile.progress} className="h-1" />
                      <div className="flex justify-between text-xs text-muted-foreground">
                        <span>{imageFile.progress}%</span>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => cancelUpload(imageFile.id)}
                          className="h-auto p-0 text-xs"
                        >
                          Cancel
                        </Button>
                      </div>
                    </div>
                  )}

                  {imageFile.error && (
                    <p className="text-xs text-red-500 mt-1">{imageFile.error}</p>
                  )}

                  {imageFile.status === 'success' && imageFile.result && (
                    <p className="text-xs text-green-600 mt-1">
                      ✓ Upload successful
                    </p>
                  )}
                </div>

                {/* Remove Button */}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => removeFile(imageFile.id)}
                  disabled={imageFile.status === 'uploading'}
                  className="flex-shrink-0"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
} 