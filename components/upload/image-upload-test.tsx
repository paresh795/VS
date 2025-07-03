"use client"

import React, { useCallback, useState } from 'react'
import { useDropzone, FileRejection } from 'react-dropzone'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { Badge } from '@/components/ui/badge'
import { Upload, X, CheckCircle, AlertCircle, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { 
  uploadFiles, 
  createUploadController, 
  formatFileSize,
  type UploadResult, 
  type UploadProgress 
} from '@/lib/upload-test'
import { UPLOAD_LIMITS } from '@/lib/constants'

interface FileUploadState {
  file: File
  progress: number
  status: 'pending' | 'uploading' | 'completed' | 'error'
  result?: UploadResult
  error?: string
}

interface ImageUploadProps {
  onUploadComplete?: (results: UploadResult[]) => void
  onError?: (error: string) => void
  maxFiles?: number
  className?: string
}

export function ImageUploadTest({ 
  onUploadComplete, 
  onError, 
  maxFiles = UPLOAD_LIMITS.MAX_FILES,
  className 
}: ImageUploadProps) {
  const [files, setFiles] = useState<FileUploadState[]>([])
  const [isUploading, setIsUploading] = useState(false)
  const [uploadController, setUploadController] = useState<ReturnType<typeof createUploadController> | null>(null)

  const onDrop = useCallback((acceptedFiles: File[], rejectedFiles: FileRejection[]) => {
    console.log('🧪 Test upload - Files dropped:', acceptedFiles.length)
    
    // Handle rejected files
    if (rejectedFiles.length > 0) {
      const errorMessages = rejectedFiles.map(({ file, errors }) => 
        `${file.name}: ${errors.map(e => e.message).join(', ')}`
      )
      onError?.(`Upload rejected: ${errorMessages.join('; ')}`)
      return
    }

    // Check if we would exceed max files
    const totalFiles = files.length + acceptedFiles.length
    if (totalFiles > maxFiles) {
      onError?.(`Too many files. Maximum ${maxFiles} file(s) allowed.`)
      return
    }

    // Add new files to state
    const newFiles: FileUploadState[] = acceptedFiles.map(file => ({
      file,
      progress: 0,
      status: 'pending'
    }))

    setFiles(prev => [...prev, ...newFiles])
  }, [files.length, maxFiles, onError])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'image/jpeg': ['.jpg', '.jpeg'],
      'image/png': ['.png'],
      'image/webp': ['.webp']
    },
    maxSize: UPLOAD_LIMITS.MAX_FILE_SIZE,
    disabled: isUploading
  })

  const removeFile = (index: number) => {
    setFiles(prev => prev.filter((_, i) => i !== index))
  }

  const startUpload = async () => {
    const pendingFiles = files.filter(f => f.status === 'pending')
    if (pendingFiles.length === 0) return

    console.log('🧪 Starting test upload for', pendingFiles.length, 'files')
    
    setIsUploading(true)
    const controller = createUploadController()
    setUploadController(controller)

    // Reset file states
    setFiles(prev => prev.map(f => 
      f.status === 'pending' ? { ...f, status: 'uploading', progress: 0 } : f
    ))

    try {
      const results = await uploadFiles(
        pendingFiles.map(f => f.file),
        {
          onFileProgress: (fileIndex, progress) => {
            const actualIndex = files.findIndex(f => f.file === pendingFiles[fileIndex].file)
            if (actualIndex !== -1) {
              setFiles(prev => prev.map((f, i) => 
                i === actualIndex ? { ...f, progress: progress.percentage } : f
              ))
            }
          },
          onFileComplete: (fileIndex, result) => {
            const actualIndex = files.findIndex(f => f.file === pendingFiles[fileIndex].file)
            if (actualIndex !== -1) {
              setFiles(prev => prev.map((f, i) => 
                i === actualIndex ? { 
                  ...f, 
                  status: result.success ? 'completed' : 'error',
                  result,
                  error: result.error,
                  progress: result.success ? 100 : f.progress
                } : f
              ))
            }
          },
          onError: (error) => {
            console.error('❌ Upload error:', error)
            onError?.(error)
          },
          signal: controller.signal,
          concurrent: false
        }
      )

      console.log('✅ Test upload completed:', results)
      onUploadComplete?.(results.filter(r => r.success))
    } catch (error) {
      console.error('❌ Upload failed:', error)
      onError?.(error instanceof Error ? error.message : 'Upload failed')
    } finally {
      setIsUploading(false)
      setUploadController(null)
    }
  }

  const cancelUpload = () => {
    if (uploadController) {
      uploadController.cancel()
      setIsUploading(false)
      setUploadController(null)
      
      // Reset uploading files to pending
      setFiles(prev => prev.map(f => 
        f.status === 'uploading' ? { ...f, status: 'pending', progress: 0 } : f
      ))
    }
  }

  const clearAll = () => {
    setFiles([])
  }

  const pendingCount = files.filter(f => f.status === 'pending').length
  const completedCount = files.filter(f => f.status === 'completed').length
  const errorCount = files.filter(f => f.status === 'error').length

  return (
    <div className={cn("space-y-4", className)}>
      {/* Dropzone */}
      <div
        {...getRootProps()}
        className={cn(
          "border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors",
          isDragActive ? "border-primary bg-primary/5" : "border-border",
          isUploading && "cursor-not-allowed opacity-50"
        )}
      >
        <input {...getInputProps()} />
        <div className="space-y-4">
          <div className="mx-auto w-12 h-12 text-muted-foreground">
            <Upload className="w-full h-full" />
          </div>
          <div>
            <p className="text-lg font-medium">
              {isDragActive ? "Drop images here" : "Drag & drop images here"}
            </p>
            <p className="text-sm text-muted-foreground mt-1">
              or click to browse • JPEG, PNG, WebP up to {Math.round(UPLOAD_LIMITS.MAX_FILE_SIZE / (1024 * 1024))}MB
            </p>
            <div className="mt-2">
              <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-200">
                🧪 Test Mode - No Authentication Required
              </Badge>
            </div>
          </div>
        </div>
      </div>

      {/* File List */}
      {files.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-medium">
              Files ({files.length})
              {completedCount > 0 && (
                <Badge variant="secondary" className="ml-2">
                  {completedCount} completed
                </Badge>
              )}
              {errorCount > 0 && (
                <Badge variant="destructive" className="ml-2">
                  {errorCount} failed
                </Badge>
              )}
            </h3>
            <div className="flex gap-2">
              {pendingCount > 0 && !isUploading && (
                <Button onClick={startUpload} size="sm">
                  Upload {pendingCount} file{pendingCount !== 1 ? 's' : ''}
                </Button>
              )}
              {isUploading && (
                <Button onClick={cancelUpload} variant="outline" size="sm">
                  Cancel
                </Button>
              )}
              <Button onClick={clearAll} variant="outline" size="sm">
                Clear All
              </Button>
            </div>
          </div>

          <div className="space-y-2">
            {files.map((fileState, index) => (
              <div
                key={`${fileState.file.name}-${index}`}
                className="flex items-center gap-3 p-3 border rounded-lg"
              >
                {/* Status Icon */}
                <div className="flex-shrink-0">
                  {fileState.status === 'pending' && (
                    <Upload className="w-4 h-4 text-muted-foreground" />
                  )}
                  {fileState.status === 'uploading' && (
                    <Loader2 className="w-4 h-4 text-blue-500 animate-spin" />
                  )}
                  {fileState.status === 'completed' && (
                    <CheckCircle className="w-4 h-4 text-green-500" />
                  )}
                  {fileState.status === 'error' && (
                    <AlertCircle className="w-4 h-4 text-red-500" />
                  )}
                </div>

                {/* File Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-medium truncate">{fileState.file.name}</p>
                    <Badge variant="outline" className="text-xs">
                      {formatFileSize(fileState.file.size)}
                    </Badge>
                  </div>
                  
                  {fileState.status === 'uploading' && (
                    <div className="mt-2">
                      <Progress value={fileState.progress} className="h-2" />
                      <p className="text-xs text-muted-foreground mt-1">
                        {fileState.progress}% uploaded
                      </p>
                    </div>
                  )}
                  
                  {fileState.status === 'error' && fileState.error && (
                    <p className="text-xs text-red-500 mt-1">{fileState.error}</p>
                  )}

                  {fileState.status === 'completed' && fileState.result?.message && (
                    <p className="text-xs text-green-600 mt-1">{fileState.result.message}</p>
                  )}
                </div>

                {/* Remove Button */}
                {fileState.status !== 'uploading' && (
                  <Button
                    onClick={() => removeFile(index)}
                    variant="ghost"
                    size="sm"
                    className="flex-shrink-0"
                  >
                    <X className="w-4 h-4" />
                  </Button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
} 