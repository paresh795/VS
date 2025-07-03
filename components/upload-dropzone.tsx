"use client"

import { ImageUpload } from '@/components/upload/image-upload'
import type { UploadResult } from '@/lib/upload'

interface UploadDropzoneProps {
  onUpload: (url: string) => void
  disabled?: boolean
  className?: string
}

export function UploadDropzone({ onUpload, disabled = false, className }: UploadDropzoneProps) {
  const handleUploadComplete = (results: UploadResult[]) => {
    const successfulResult = results.find(result => result.success && result.imageUrl)
    if (successfulResult?.imageUrl) {
      onUpload(successfulResult.imageUrl)
    }
  }

  return (
    <ImageUpload
      onUploadComplete={handleUploadComplete}
      maxFiles={1}
      className={className}
      disabled={disabled}
    />
  )
} 