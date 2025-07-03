import { NextRequest, NextResponse } from "next/server"
import { auth } from "@clerk/nextjs/server"
import { db } from "@/db"
import { jobs, users } from "@/db/schema"
import { eq } from "drizzle-orm"
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
    // Check authentication
    const { userId: clerkUserId } = await auth()
    if (!clerkUserId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Get user's UUID from database using Clerk ID, create if doesn't exist
    let [user] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.clerkId, clerkUserId))
      .limit(1)

    if (!user) {
      // User doesn't exist, create them (fallback for missing webhook)
      try {
        const [newUser] = await db.insert(users).values({
          clerkId: clerkUserId,
          email: '', // Will be updated when user profile is available
        }).returning({ id: users.id })
        
        user = newUser
        console.log('Created new user in database:', clerkUserId)
      } catch (error) {
        console.error('Error creating user:', error)
        return NextResponse.json(
          { error: 'Failed to create user in database' },
          { status: 500 }
        )
      }
    }

    const userId = user.id

    // Parse multipart form data
    const formData = await request.formData()
    const file = formData.get('file') as File
    
    if (!file) {
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400 }
      )
    }

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

    // Note: Image dimension validation is handled on the client side

    // Generate unique filename  
    const fileName = generateImageFileName(file.name)
    const filePath = `${clerkUserId}/${fileName}`

    console.log(`[Upload] Processing file: ${file.name} -> ${fileName}`)
    console.log(`[Upload] Upload path: ${filePath}`)

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
      console.log(`[Upload] Attempting upload to bucket: ${bucketTier.name}`)
      uploadResult = await uploadToSupabase(file, filePath, bucketTier.name)
      
      if (uploadResult.success) {
        bucketUsed = bucketTier.name
        console.log(`[Upload] Upload successful to bucket: ${bucketTier.name}`)
        break
      } else {
        lastError = uploadResult.error || 'Unknown error'
        console.log(`[Upload] Upload failed to bucket ${bucketTier.name}: ${lastError}`)
        
        // If this is a bucket existence error, continue to next bucket
        // If it's an auth/permission error, it will likely affect all buckets
        if (lastError.includes('signature') || lastError.includes('permission')) {
          console.error(`[Upload] Authentication/permission error encountered, stopping bucket attempts`)
          break
        }
      }
    }
    
    if (!uploadResult?.success || !uploadResult.data) {
      console.error(`[Upload] All upload attempts failed. Last error: ${lastError}`)
      
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

    // Create job record in database
    const jobId = uuidv4()
    
    console.log(`[Upload] Creating job record: ${jobId}`)
    console.log(`[Upload] Image URL: ${uploadResult.data.publicUrl}`)
    console.log(`[Upload] Storage path: ${uploadResult.data.path}`)
    console.log(`[Upload] Bucket used: ${bucketUsed}`)
    
    const [job] = await db.insert(jobs).values({
      id: jobId,
      userId,
      type: 'upload',
      status: 'completed',
      inputImageUrl: uploadResult.data.publicUrl,
      resultUrls: [uploadResult.data.publicUrl],
      creditsUsed: 0, // No credits charged for upload
      createdAt: new Date(),
      completedAt: new Date()
    }).returning()

    console.log(`[Upload] Job created successfully: ${job.id}`)

    return NextResponse.json({
      success: true,
      jobId: job.id,
      imageUrl: uploadResult.data.publicUrl,
      fileName: fileName,
      fileSize: file.size,
      storagePath: uploadResult.data.path,
      bucketUsed: bucketUsed
    })

  } catch (error) {
    console.error('Upload API error:', error)
    return NextResponse.json(
      { error: 'Internal server error during upload' },
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