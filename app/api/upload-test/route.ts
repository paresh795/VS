import { NextRequest, NextResponse } from "next/server"
import { db } from "@/db"
import { jobs, users } from "@/db/schema"
import { uploadToSupabase, generateImageFileName } from "@/lib/supabase"
import { UPLOAD_LIMITS } from "@/lib/constants"
import { v4 as uuidv4 } from "uuid"

// Validate file type by checking both MIME type and file signature
async function validateFileType(file: File): Promise<boolean> {
  // Check MIME type
  const acceptedTypes: readonly string[] = UPLOAD_LIMITS.ACCEPTED_TYPES
  if (!acceptedTypes.includes(file.type)) {
    return false
  }

  // Check file signature for security (first few bytes)
  const buffer = await file.arrayBuffer()
  const bytes = new Uint8Array(buffer.slice(0, 12))
  
  // JPEG signatures
  if (bytes[0] === 0xFF && bytes[1] === 0xD8 && bytes[2] === 0xFF) {
    return file.type === 'image/jpeg'
  }
  
  // PNG signature
  if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4E && bytes[3] === 0x47) {
    return file.type === 'image/png'
  }
  
  // WebP signature
  if (bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46 &&
      bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50) {
    return file.type === 'image/webp'
  }
  
  return false
}

export async function POST(request: NextRequest) {
  try {
    console.log('🧪 Upload Test API - No authentication required')
    
    // Test environment variables first
    console.log('🔧 Environment variables check:', {
      supabaseUrl: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
      serviceKey: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
      nodeEnv: process.env.NODE_ENV
    })
    
    // Use test user ID in UUID format for database compatibility
    const userId = '00000000-0000-0000-0000-000000000001'
    
    // Ensure test user exists in database
    try {
      await db.insert(users).values({
        id: userId,
        email: 'test@example.com',
        clerkId: 'test-clerk-id'
      }).onConflictDoNothing()
    } catch (error) {
      console.log('Test user already exists or creation failed:', error)
    }

    // Parse multipart form data
    const formData = await request.formData()
    const file = formData.get('file') as File
    
    if (!file) {
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400 }
      )
    }

    console.log(`📁 Processing file: ${file.name} (${file.size} bytes)`)

    // Validate file size
    if (file.size > UPLOAD_LIMITS.MAX_FILE_SIZE) {
      const maxSizeMB = UPLOAD_LIMITS.MAX_FILE_SIZE / (1024 * 1024)
      return NextResponse.json(
        { error: `File too large. Maximum size is ${maxSizeMB}MB` },
        { status: 400 }
      )
    }

    // Validate file type and signature
    const isValidType = await validateFileType(file)
    if (!isValidType) {
      return NextResponse.json(
        { error: 'Invalid file type. Please upload JPEG, PNG, or WebP images only.' },
        { status: 400 }
      )
    }

    // Generate unique filename
    const fileName = generateImageFileName(file.name)
    const filePath = `${userId}/${fileName}`

    console.log(`[Upload Test] Processing file: ${file.name} -> ${fileName}`)
    console.log(`[Upload Test] Upload path: ${filePath}`)

    // Try uploading to primary bucket first, then fallbacks
    const bucketTiers = [
      { name: 'originals', primary: true },
      { name: 'uploads', primary: false },
      { name: 'user-uploads', primary: false }
    ]
    
    let uploadResult = null
    let lastError = ''
    let bucketUsed = ''

    for (const bucketTier of bucketTiers) {
      console.log(`[Upload Test] Attempting upload to bucket: ${bucketTier.name}`)
      uploadResult = await uploadToSupabase(file, filePath, bucketTier.name)
      
      if (uploadResult.success) {
        bucketUsed = bucketTier.name
        console.log(`[Upload Test] Upload successful to bucket: ${bucketTier.name}`)
        break
      } else {
        lastError = uploadResult.error || 'Unknown error'
        console.log(`[Upload Test] Upload failed to bucket ${bucketTier.name}: ${lastError}`)
        
        // If this is a bucket existence error, continue to next bucket
        // If it's an auth/permission error, it will likely affect all buckets
        if (lastError.includes('signature') || lastError.includes('permission')) {
          console.error(`[Upload Test] Authentication/permission error encountered, stopping bucket attempts`)
          break
        }
      }
    }
    
    if (!uploadResult?.success || !uploadResult.data) {
      console.error(`[Upload Test] All upload attempts failed. Last error: ${lastError}`)
      
      // Provide more helpful error messages to the user
      let userErrorMessage = lastError
      if (lastError.includes('signature')) {
        userErrorMessage = 'Authentication error with storage service. Please try again or contact support.'
      } else if (lastError.includes('permission')) {
        userErrorMessage = 'Storage permission error. Please try again or contact support.'
      } else if (lastError.includes('bucket')) {
        userErrorMessage = 'Storage configuration error. Please contact support.'
      }
      
      return NextResponse.json(
        { error: userErrorMessage, details: lastError },
        { status: 500 }
      )
    }

    console.log(`[Upload Test] Upload successful: ${uploadResult.data.publicUrl}`)
    console.log(`[Upload Test] Storage path: ${uploadResult.data.path}`)
    console.log(`[Upload Test] Bucket used: ${bucketUsed}`)

    // Create job record in database
    const jobId = uuidv4()
    
    console.log(`[Upload Test] Creating job record: ${jobId}`)
    
    try {
      const [job] = await db.insert(jobs).values({
        id: jobId,
        userId,
        type: 'upload',
        status: 'completed',
        inputImageUrl: uploadResult.data.path,
        resultUrls: [uploadResult.data.publicUrl],
        creditsUsed: 0, // No credits charged for upload
        createdAt: new Date(),
        completedAt: new Date()
      }).returning()

      console.log(`[Upload Test] Job record created: ${job.id}`)
    } catch (dbError) {
      console.error('[Upload Test] Database error:', dbError)
      // Continue even if DB insert fails for testing
    }

    return NextResponse.json({
      success: true,
      jobId: jobId,
      imageUrl: uploadResult.data.publicUrl,
      fileName: fileName,
      fileSize: file.size,
      storagePath: uploadResult.data.path,
      bucketUsed: bucketUsed,
      message: '🧪 Test upload successful - no authentication required'
    })

  } catch (error) {
    console.error('❌ Upload Test API error:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

// Handle GET requests (not allowed)
export async function GET() {
  return NextResponse.json(
    { error: 'Method not allowed - use POST to upload files' },
    { status: 405 }
  )
} 