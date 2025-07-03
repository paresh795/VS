import { createClient } from '@supabase/supabase-js'
import { v4 as uuidv4 } from 'uuid'

// Create a Supabase client with service role key for backend operations
export const createSupabaseClient = () => {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  console.log(`[Supabase] Environment check:`, {
    url: !!supabaseUrl,
    urlLength: supabaseUrl?.length || 0,
    urlPrefix: supabaseUrl?.substring(0, 20) || 'undefined',
    serviceKey: !!supabaseServiceKey,
    serviceKeyLength: supabaseServiceKey?.length || 0,
    nodeEnv: process.env.NODE_ENV,
    allEnvKeys: Object.keys(process.env).filter(k => k.includes('SUPABASE')).join(', ')
  })

  if (!supabaseUrl) {
    throw new Error(`Missing NEXT_PUBLIC_SUPABASE_URL environment variable. Available SUPABASE env vars: ${Object.keys(process.env).filter(k => k.includes('SUPABASE')).join(', ')}`)
  }

  if (!supabaseServiceKey) {
    throw new Error(`Missing SUPABASE_SERVICE_ROLE_KEY environment variable. Available SUPABASE env vars: ${Object.keys(process.env).filter(k => k.includes('SUPABASE')).join(', ')}`)
  }

  console.log(`[Supabase] Creating client with URL: ${supabaseUrl}`)
  console.log(`[Supabase] Service key present: ${!!supabaseServiceKey}, length: ${supabaseServiceKey.length}`)

  return createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
})
}

// Note: Use createSupabaseClient() instead of singleton to avoid module load issues

// Create a client-side Supabase client
export const createClientSupabase = () => {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  return createClient(supabaseUrl, supabaseAnonKey)
}

// Generate a unique filename for uploaded images
export function generateImageFileName(originalName: string): string {
  const extension = originalName.split('.').pop()?.toLowerCase()
  const timestamp = Date.now()
  const uuid = uuidv4().slice(0, 8) // Use shorter UUID for filename
  return `${timestamp}-${uuid}.${extension}`
}

// Upload file to Supabase Storage
export async function uploadToSupabase(
  file: File,
  filePath: string,
  bucket: string = 'uploads'
): Promise<{
  success: boolean
  data?: {
    path: string
    publicUrl: string
  }
  error?: string
}> {
  try {
    console.log(`[Supabase] Starting upload to bucket: ${bucket}, path: ${filePath}`)
    
    // Create a fresh client for this operation to ensure we have latest env vars
    let supabaseClient
    try {
      supabaseClient = createSupabaseClient()
    } catch (envError) {
      console.error('[Supabase] Environment variable error:', envError)
      return {
        success: false,
        error: `Configuration error: ${envError instanceof Error ? envError.message : 'Unknown error'}`
      }
    }
    
    // Check if bucket exists first
    const { data: buckets, error: bucketsError } = await supabaseClient.storage.listBuckets()
    if (bucketsError) {
      console.error('[Supabase] Error listing buckets:', bucketsError)
      return {
        success: false,
        error: `Failed to list buckets: ${bucketsError.message}`
      }
    }
    
    const bucketExists = buckets?.some(b => b.name === bucket)
    if (!bucketExists) {
      console.warn(`[Supabase] Bucket '${bucket}' does not exist. Available buckets:`, buckets?.map(b => b.name))
      return {
        success: false,
        error: `Bucket '${bucket}' does not exist. Available buckets: ${buckets?.map(b => b.name).join(', ')}`
      }
    }
    
    console.log(`[Supabase] Bucket '${bucket}' exists, proceeding with upload`)
    
    // Convert File to ArrayBuffer for server-side upload
    const arrayBuffer = await file.arrayBuffer()
    console.log(`[Supabase] File converted to ArrayBuffer, size: ${arrayBuffer.byteLength} bytes`)
    
    // First, try to remove the existing file if it exists (to avoid conflicts)
    try {
      await supabaseClient.storage.from(bucket).remove([filePath])
      console.log(`[Supabase] Removed existing file at path: ${filePath}`)
    } catch (removeError) {
      console.log(`[Supabase] No existing file to remove or removal failed (this is OK):`, removeError)
    }
    
    // Upload the file with detailed options
    const uploadOptions = {
      contentType: file.type,
      cacheControl: '3600',
      upsert: true // Allow overwriting files
    }
    
    console.log(`[Supabase] Uploading with options:`, uploadOptions)
    
    const { data, error } = await supabaseClient.storage
      .from(bucket)
      .upload(filePath, arrayBuffer, uploadOptions)

    if (error) {
      console.error('[Supabase] Storage upload error:', {
        message: error.message,
        statusCode: (error as any).statusCode,
        error: error
      })
      
      // Provide more specific error messages
      let errorMessage = error.message
      if (error.message.includes('signature')) {
        errorMessage = `Authentication/signature error: ${error.message}. Please check Supabase service role key.`
      } else if (error.message.includes('permission') || error.message.includes('policy')) {
        errorMessage = `Permission denied: ${error.message}. Please check bucket policies and RLS settings.`
      } else if (error.message.includes('bucket')) {
        errorMessage = `Bucket error: ${error.message}. Please check if bucket exists and is accessible.`
      }
      
      return {
        success: false,
        error: errorMessage
      }
    }

    console.log(`[Supabase] Upload successful, file path: ${data.path}`)

    // Get the public URL
    const { data: publicUrlData } = supabaseClient.storage
      .from(bucket)
      .getPublicUrl(filePath)

    console.log(`[Supabase] Public URL generated: ${publicUrlData.publicUrl}`)

    return {
      success: true,
      data: {
        path: data.path,
        publicUrl: publicUrlData.publicUrl
      }
    }
  } catch (error) {
    console.error('[Supabase] Unexpected upload error:', error)
    const errorMessage = error instanceof Error ? error.message : 'Unknown upload error'
    return {
      success: false,
      error: `Upload failed: ${errorMessage}`
    }
  }
}

// Delete file from Supabase Storage
export async function deleteFromSupabase(
  filePath: string,
  bucket: string = 'originals'
): Promise<{ success: boolean; error?: string }> {
  try {
    const supabaseClient = createSupabaseClient()
    const { error } = await supabaseClient.storage
      .from(bucket)
      .remove([filePath])

    if (error) {
      console.error('Supabase delete error:', error)
      return {
        success: false,
        error: error.message
      }
    }

    return { success: true }
  } catch (error) {
    console.error('Delete error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown delete error'
    }
  }
}

// Get signed URL for private file access
export async function getSignedUrl(
  filePath: string,
  expiresIn: number = 3600, // 1 hour default
  bucket: string = 'originals'
): Promise<{
  success: boolean
  data?: { signedUrl: string }
  error?: string
}> {
  try {
    const supabaseClient = createSupabaseClient()
    const { data, error } = await supabaseClient.storage
      .from(bucket)
      .createSignedUrl(filePath, expiresIn)

    if (error) {
      console.error('Supabase signed URL error:', error)
      return {
        success: false,
        error: error.message
      }
    }

    return {
      success: true,
      data: { signedUrl: data.signedUrl }
    }
  } catch (error) {
    console.error('Signed URL error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown signed URL error'
    }
  }
}

// Storage bucket names
export const STORAGE_BUCKETS = {
  ORIGINAL_IMAGES: 'original-images',
  PROCESSED_IMAGES: 'processed-images',
  MASKS: 'masks'
} as const

// File upload utilities
export const uploadFile = async (
  bucket: string, 
  path: string, 
  file: File | Buffer,
  options?: { contentType?: string; cacheControl?: string }
) => {
  const supabaseClient = createSupabaseClient()
  const { data, error } = await supabaseClient.storage
    .from(bucket)
    .upload(path, file, {
      contentType: options?.contentType,
      cacheControl: options?.cacheControl || '3600'
    })

  if (error) {
    throw new Error(`Failed to upload file: ${error.message}`)
  }

  return data
}

export const getPublicUrl = (bucket: string, path: string) => {
  const supabaseClient = createSupabaseClient()
  const { data } = supabaseClient.storage
    .from(bucket)
    .getPublicUrl(path)
  
  return data.publicUrl
}

export const deleteFile = async (bucket: string, path: string) => {
  const supabaseClient = createSupabaseClient()
  const { error } = await supabaseClient.storage
    .from(bucket)
    .remove([path])

  if (error) {
    throw new Error(`Failed to delete file: ${error.message}`)
  }
} 