import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { db } from '@/db'
import { jobs, users, sessions, generations } from '@/db/schema'
import { eq } from 'drizzle-orm'
import fal, { FAL_ENDPOINTS, FAL_DEFAULTS, buildEmptyRoomPrompt, handleFALError, checkFALConfig } from '@/lib/fal-config'
import { getCreditBalance, deductCredits } from '@/lib/credits'
import { CREDIT_COSTS } from '@/lib/constants'

interface EmptyRoomRequest {
  imageUrl: string
  sessionId?: string
  retryNumber?: number
}

export async function POST(request: NextRequest) {
  try {
    console.log('🚀 [Empty Room API] Starting FAL.AI empty room generation request')
    
    // Check FAL.AI configuration
    const configCheck = checkFALConfig()
    if (!configCheck.isConfigured) {
      console.error('❌ [Empty Room API] Configuration error:', configCheck.message)
      return NextResponse.json({
        success: false,
        error: 'Service configuration error',
        details: configCheck.message
      }, { status: 500 })
    }
    
    // Check authentication
    const { userId: clerkUserId } = await auth()
    if (!clerkUserId) {
      console.log('❌ [Empty Room API] Unauthorized request')
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    console.log('✅ [Empty Room API] User authenticated:', clerkUserId)

    // Get user from database
    const user = await db
      .select()
      .from(users)
      .where(eq(users.clerkId, clerkUserId))
      .limit(1)

    if (!user[0]) {
      console.log('❌ [Empty Room API] User not found in database:', clerkUserId)
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      )
    }

    const dbUser = user[0]
    console.log('✅ [Empty Room API] Database user found:', dbUser.id)

    // Parse request body
    const { imageUrl, sessionId, retryNumber = 1 }: EmptyRoomRequest = await request.json()
    console.log('📝 [Empty Room API] Request data:', { imageUrl, sessionId, retryNumber })

    if (!imageUrl) {
      console.log('❌ [Empty Room API] Missing image URL')
      return NextResponse.json(
        { error: 'Image URL is required' },
        { status: 400 }
      )
    }

    // Validate session if provided
    let session = null
    if (sessionId) {
      console.log('🔍 [Empty Room API] Validating session:', sessionId)
      const [sessionRecord] = await db
        .select()
        .from(sessions)
        .where(eq(sessions.id, sessionId))
        .limit(1)

      if (!sessionRecord || sessionRecord.userId !== dbUser.id) {
        console.log('❌ [Empty Room API] Invalid session or unauthorized')
        return NextResponse.json(
          { error: 'Invalid session or unauthorized' },
          { status: 403 }
        )
      }
      session = sessionRecord
      console.log('✅ [Empty Room API] Session validated')
    }

    // Check if this is a retry and if retries are allowed
    const isRetry = retryNumber > 1
    const maxRetries = 3 // Initial + 2 free retries
    
    if (retryNumber > maxRetries) {
      console.log('❌ [Empty Room API] Maximum retries exceeded:', retryNumber)
      return NextResponse.json(
        { error: `Maximum retries exceeded. Only ${maxRetries - 1} retries allowed.` },
        { status: 400 }
      )
    }

    // Get credit cost - free for retries, normal cost for initial generation
    const creditCost = isRetry ? 0 : CREDIT_COSTS.MASK_AND_EMPTY
    console.log('💰 [Empty Room API] Credit cost:', { creditCost, isRetry, retryNumber })

    // Check credits only if not a retry
    if (!isRetry) {
      const currentBalance = await getCreditBalance(dbUser.id)
      if (currentBalance < creditCost) {
        console.error('❌ [Empty Room API] Insufficient credits:', { needed: creditCost, available: currentBalance })
        return NextResponse.json({ 
          error: `Insufficient credits. Required: ${creditCost}, Available: ${currentBalance}` 
        }, { status: 402 })
      }

      console.log('💰 [Empty Room API] Credits sufficient:', { cost: creditCost, balance: currentBalance })

      // 💳 DEDUCT CREDITS IMMEDIATELY (before FAL API calls)
      console.log('💳 [Empty Room API] Deducting credits immediately...')
      try {
        await deductCredits(dbUser.id, creditCost, 'Empty Room Generation', 'pending')
        console.log('✅ [Empty Room API] Credits deducted successfully')
      } catch (creditError) {
        console.error('❌ [Empty Room API] Credit deduction failed:', creditError)
        return NextResponse.json({ 
          error: 'Failed to deduct credits. Please try again.' 
        }, { status: 402 })
      }
    } else {
      console.log('🆓 [Empty Room API] Retry generation - no credits deducted')
    }

    // Get the exact empty room prompt
    const emptyRoomPrompt = buildEmptyRoomPrompt()

    // Create job record first
    const jobResult = await db.insert(jobs).values({
      userId: dbUser.id,
      sessionId: sessionId || null,
      type: 'empty_room',
      status: 'pending',
      inputImageUrl: imageUrl,
      creditsUsed: creditCost,
      prompt: emptyRoomPrompt
    }).returning()

    const job = jobResult[0]
    console.log('📋 [Empty Room API] Job created:', job.id)

    try {
      // Update job status to processing
      console.log('🔄 [Empty Room API] Updating job status to processing...')
      await db
        .update(jobs)
        .set({ 
          status: 'processing'
        })
        .where(eq(jobs.id, job.id))

      // Generate empty room using FAL.AI
      console.log('🤖 [Empty Room API] Calling FAL.AI API...')
      console.log('📝 [Empty Room API] Using prompt:', emptyRoomPrompt)
      console.log('📝 [Empty Room API] Using model:', FAL_ENDPOINTS.FLUX_KONTEXT_PRO)
      
      let falResult
      try {
        falResult = await fal.subscribe(FAL_ENDPOINTS.FLUX_KONTEXT_PRO, {
          input: {
            prompt: emptyRoomPrompt,
            image_url: imageUrl,
            ...FAL_DEFAULTS
          },
          logs: true,
          onQueueUpdate: (update) => {
            if (update.status === "IN_PROGRESS" && update.logs) {
              update.logs.map((log) => log.message).forEach(console.log);
            }
          }
        })
        
        console.log('🎨 [Empty Room API] FAL.AI response:', {
          type: typeof falResult,
          hasData: !!falResult.data,
          requestId: falResult.requestId
        })
        console.log('🎨 [Empty Room API] FAL.AI result data:', falResult.data)
        
      } catch (falError) {
        console.error('❌ [Empty Room API] FAL.AI API Error:', falError)
        const errorMessage = handleFALError(falError)
        throw new Error(`FAL.AI API failed: ${errorMessage}`)
      }
      
      // Extract image URLs from FAL.AI response
      if (!falResult?.data?.images || !Array.isArray(falResult.data.images) || falResult.data.images.length === 0) {
        throw new Error('No images generated by FAL.AI')
      }
      
      // CRITICAL FIX: Ensure we only use the first image, even if FAL returns multiple
      // The configuration is set to num_images: 1, but this ensures consistency
      const firstImage = falResult.data.images[0]
      if (!firstImage?.url) {
        throw new Error('Invalid image data from FAL.AI')
      }
      
      const emptyRoomUrl = firstImage.url
      
      console.log('🖼️ [Empty Room API] Selected empty room URL:', emptyRoomUrl)
      console.log('🖼️ [Empty Room API] Total images from FAL.AI:', falResult.data.images.length)
      
      // Validate that we have a valid URL string
      if (typeof emptyRoomUrl !== 'string') {
        console.error('❌ [Empty Room API] URL is not a string:', emptyRoomUrl)
        throw new Error(`Generated empty room URL is not a string, got: ${typeof emptyRoomUrl}`)
      }
      
      if (!emptyRoomUrl.startsWith('http') && !emptyRoomUrl.startsWith('data:')) {
        console.error('❌ [Empty Room API] Invalid URL format:', emptyRoomUrl)
        throw new Error(`Generated empty room URL has invalid format: ${emptyRoomUrl.substring(0, 100)}...`)
      }

      // Create generation record if session is provided
      if (sessionId) {
        console.log('📝 [Empty Room API] Creating generation record...')
        await db.insert(generations).values({
          sessionId,
          generationType: 'empty_room',
          generationNumber: retryNumber,
          inputImageUrl: imageUrl,
          outputImageUrls: [emptyRoomUrl], // Always store as single-element array
          creditsCost: creditCost,
          falJobId: falResult.requestId,
          status: 'completed'
        })
        console.log('✅ [Empty Room API] Generation record created')
      }

      // Update job with success result
      console.log('💾 [Empty Room API] Updating job with results...')
      await db
        .update(jobs)
        .set({ 
          status: 'completed',
          resultUrls: [emptyRoomUrl], // Always store as single-element array
          falJobId: falResult.requestId,
          completedAt: new Date()
        })
        .where(eq(jobs.id, job.id))

      console.log('✅ [Empty Room API] Job completed successfully')

      // SIMPLIFIED RESPONSE: Only return single URL
      const response = {
        success: true,
        jobId: job.id,
        emptyRoomUrl, // Single URL for frontend to use
        creditsUsed: creditCost,
        retryNumber,
        canRetry: retryNumber < maxRetries,
        retriesRemaining: maxRetries - retryNumber
      }
      console.log('📤 [Empty Room API] Sending response:', response)

      return NextResponse.json(response)

    } catch (error) {
      console.error('❌ [Empty Room API] Generation failed:', error)
      
      // Mark job as failed
      await db
        .update(jobs)
        .set({ 
          status: 'failed',
          errorMessage: error instanceof Error ? error.message : 'Unknown error'
        })
        .where(eq(jobs.id, job.id))

      // Create failed generation record if session is provided
      if (sessionId) {
        await db.insert(generations).values({
          sessionId,
          generationType: 'empty_room',
          generationNumber: retryNumber,
          inputImageUrl: imageUrl,
          outputImageUrls: [],
          creditsCost: creditCost,
          status: 'failed',
          errorMessage: error instanceof Error ? error.message : 'Unknown error'
        })
      }

      // 🔄 ROLLBACK CREDITS if this was the initial generation (not a retry)
      if (!isRetry && creditCost > 0) {
        console.log('🔄 [Empty Room API] Rolling back credits due to failure...')
        try {
          await deductCredits(dbUser.id, -creditCost, 'Empty Room Generation - Refund', 'refund')
          console.log('✅ [Empty Room API] Credits rolled back successfully')
        } catch (rollbackError) {
          console.error('❌ [Empty Room API] Credit rollback failed:', rollbackError)
        }
      }

      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred'
      return NextResponse.json(
        { 
          success: false,
          error: 'Empty room generation failed',
          details: errorMessage,
          retryNumber,
          canRetry: retryNumber < maxRetries
        },
        { status: 500 }
      )
    }
  } catch (error) {
    console.error('❌ [Empty Room API] Unexpected error:', error)
    return NextResponse.json(
      { 
        success: false,
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
} 