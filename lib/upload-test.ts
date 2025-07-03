import { UPLOAD_LIMITS } from './constants'

// Upload progress interface
export interface UploadProgress {
  loaded: number
  total: number
  percentage: number
}

// Upload result interface
export interface UploadResult {
  success: boolean
  jobId?: string
  imageUrl?: string
  fileName?: string
  fileSize?: number
  storagePath?: string
  error?: string
  message?: string
}

// Upload options interface
export interface UploadOptions {
  onProgress?: (progress: UploadProgress) => void
  onError?: (error: string) => void
  signal?: AbortSignal
}

// Custom upload error class
export class UploadError extends Error {
  constructor(message: string, public code: string) {
    super(message)
    this.name = 'UploadError'
  }
}

// Validate file before upload
export function validateUploadFile(file: File): { valid: boolean; error?: string } {
  // Check file type
  const acceptedTypes: readonly string[] = UPLOAD_LIMITS.ACCEPTED_TYPES
  if (!acceptedTypes.includes(file.type)) {
    return {
      valid: false,
      error: `Invalid file type. Please upload ${acceptedTypes.join(', ')} files only.`
    }
  }

  // Check file size
  if (file.size > UPLOAD_LIMITS.MAX_FILE_SIZE) {
    const maxSizeMB = UPLOAD_LIMITS.MAX_FILE_SIZE / (1024 * 1024)
    return {
      valid: false,
      error: `File too large. Maximum size is ${maxSizeMB}MB.`
    }
  }

  // Check minimum file size (1KB)
  if (file.size < 1024) {
    return {
      valid: false,
      error: 'File too small. Minimum size is 1KB.'
    }
  }

  return { valid: true }
}

// Upload file with progress tracking - TEST VERSION
export async function uploadFile(
  file: File,
  options: UploadOptions = {}
): Promise<UploadResult> {
  const { onProgress, onError, signal } = options

  try {
    console.log('🧪 Using TEST upload endpoint')
    
    // Validate file
    const validation = validateUploadFile(file)
    if (!validation.valid) {
      const error = validation.error || 'Invalid file'
      onError?.(error)
      return { success: false, error }
    }

    // Create FormData
    const formData = new FormData()
    formData.append('file', file)

    // Create XMLHttpRequest for progress tracking
    return new Promise<UploadResult>((resolve, reject) => {
      const xhr = new XMLHttpRequest()

      // Handle progress
      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable) {
          const progress: UploadProgress = {
            loaded: event.loaded,
            total: event.total,
            percentage: Math.round((event.loaded / event.total) * 100)
          }
          onProgress?.(progress)
        }
      }

      // Handle completion
      xhr.onload = () => {
        try {
          if (xhr.status === 200) {
            const result = JSON.parse(xhr.responseText) as UploadResult
            console.log('✅ Test upload successful:', result)
            resolve(result)
          } else {
            const errorData = JSON.parse(xhr.responseText)
            const error = errorData.error || `Upload failed with status ${xhr.status}`
            console.error('❌ Upload failed:', error)
            onError?.(error)
            resolve({ success: false, error })
          }
        } catch (parseError) {
          const error = 'Failed to parse server response'
          console.error('❌ Parse error:', parseError)
          onError?.(error)
          resolve({ success: false, error })
        }
      }

      // Handle errors
      xhr.onerror = () => {
        const error = 'Network error occurred during upload'
        console.error('❌ Network error')
        onError?.(error)
        resolve({ success: false, error })
      }

      // Handle timeout
      xhr.ontimeout = () => {
        const error = 'Upload timeout'
        console.error('❌ Upload timeout')
        onError?.(error)
        resolve({ success: false, error })
      }

      // Handle abort
      xhr.onabort = () => {
        const error = 'Upload cancelled'
        console.log('⚠️ Upload cancelled')
        onError?.(error)
        resolve({ success: false, error })
      }

      // Set up abort signal
      if (signal) {
        signal.addEventListener('abort', () => {
          xhr.abort()
        })
      }

      // Configure and send request - USE TEST ENDPOINT
      xhr.timeout = 5 * 60 * 1000 // 5 minutes timeout
      xhr.open('POST', '/api/upload-test')
      xhr.send(formData)
    })
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred'
    console.error('❌ Upload function error:', error)
    onError?.(errorMessage)
    return { success: false, error: errorMessage }
  }
}

// Upload multiple files with progress tracking
export async function uploadFiles(
  files: File[],
  options: {
    onFileProgress?: (fileIndex: number, progress: UploadProgress) => void
    onFileComplete?: (fileIndex: number, result: UploadResult) => void
    onError?: (error: string) => void
    signal?: AbortSignal
    concurrent?: boolean
  } = {}
): Promise<UploadResult[]> {
  const { onFileProgress, onFileComplete, onError, signal, concurrent = false } = options

  if (files.length === 0) {
    return []
  }

  if (files.length > UPLOAD_LIMITS.MAX_FILES) {
    const error = `Too many files. Maximum ${UPLOAD_LIMITS.MAX_FILES} file(s) allowed.`
    onError?.(error)
    return [{ success: false, error }]
  }

  const uploadPromises = files.map((file, index) =>
    uploadFile(file, {
      onProgress: (progress) => onFileProgress?.(index, progress),
      onError: (error) => onError?.(error),
      signal
    }).then((result) => {
      onFileComplete?.(index, result)
      return result
    })
  )

  if (concurrent) {
    // Upload all files simultaneously
    return Promise.all(uploadPromises)
  } else {
    // Upload files sequentially
    const results: UploadResult[] = []
    for (const uploadPromise of uploadPromises) {
      const result = await uploadPromise
      results.push(result)
      
      // Stop if there was an error and signal is aborted
      if (!result.success && signal?.aborted) {
        break
      }
    }
    return results
  }
}

// Create an AbortController for cancelling uploads
export function createUploadController(): {
  controller: AbortController
  cancel: () => void
  signal: AbortSignal
} {
  const controller = new AbortController()
  
  return {
    controller,
    signal: controller.signal,
    cancel: () => controller.abort()
  }
}

// Format file size for display
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes'
  
  const k = 1024
  const sizes = ['Bytes', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}

// Get file extension
export function getFileExtension(filename: string): string {
  return filename.split('.').pop()?.toLowerCase() || ''
}

// Check if file type is supported
export function isSupportedFileType(file: File): boolean {
  const acceptedTypes: readonly string[] = UPLOAD_LIMITS.ACCEPTED_TYPES
  return acceptedTypes.includes(file.type)
} 