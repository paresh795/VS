import { NextRequest, NextResponse } from 'next/server'
import { getAuth } from '@clerk/nextjs/server'
import { db } from '@/db'
import { jobs, users } from '@/db/schema'
import { eq } from 'drizzle-orm'
import fal, { FAL_ENDPOINTS, FAL_DEFAULTS, handleFALError, checkFALConfig } from '@/lib/fal-config'
import { deductCredits, getCreditBalance } from '@/lib/credits'
import { CREDIT_COSTS } from '@/lib/constants'

export async function POST(request: NextRequest) {
  try {
    console.log('🚀 [Mask API] Starting FAL.AI mask generation request')
    
    // Check FAL.AI configuration
    const configCheck = checkFALConfig()
    if (!configCheck.isConfigured) {
      console.error('❌ [Mask API] Configuration error:', configCheck.message)
      return NextResponse.json({ error: configCheck.message }, { status: 500 })
    }

    // Parse request body
    const body = await request.json()
    const { imageUrl, text_prompt } = body

    if (!imageUrl) {
      console.error('❌ [Mask API] Missing imageUrl')
      return NextResponse.json({ error: 'Missing imageUrl' }, { status: 400 })
    }

    if (!text_prompt) {
      console.error('❌ [Mask API] Missing text_prompt')
      return NextResponse.json({ error: 'Missing text_prompt for mask generation' }, { status: 400 })
    }

    console.log('🔍 [Mask API] Request details:', { imageUrl, text_prompt })

    // Get authentication
    const { userId } = getAuth(request)
    if (!userId) {
      console.error('❌ [Mask API] Unauthorized request')
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get user from database
    const [user] = await db.select().from(users).where(eq(users.clerkId, userId))
    if (!user) {
      console.error('❌ [Mask API] User not found:', userId)
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    console.log('✅ [Mask API] User authenticated:', user.id)

    // Check and deduct credits
    const creditCost = CREDIT_COSTS.MASK_AND_EMPTY
    const currentBalance = await getCreditBalance(user.id)
    
    if (currentBalance < creditCost) {
      console.error('❌ [Mask API] Insufficient credits:', { needed: creditCost, available: currentBalance })
      return NextResponse.json({ error: `Insufficient credits. Required: ${creditCost}, Available: ${currentBalance}` }, { status: 402 })
    }

    console.log('💰 [Mask API] Credits sufficient:', { cost: creditCost, balance: currentBalance })

    // Create job record
    const jobId = crypto.randomUUID()
    const [jobRecord] = await db.insert(jobs).values({
      id: jobId,
      userId: user.id,
      type: 'mask',
      status: 'processing',
      inputImageUrl: imageUrl,
      creditsUsed: creditCost,
      createdAt: new Date(),
    }).returning()

    console.log('📝 [Mask API] Job created:', jobRecord.id)

    try {
      // Generate mask using FAL.AI Lang-SAM equivalent
      console.log('🎨 [Mask API] Starting FAL.AI mask generation...')
      
      const falResult = await fal.subscribe("fal-ai/lang-segment-anything", {
        input: {
          image_url: imageUrl,
          text_prompt: text_prompt,
          output_format: "png",
          return_mask: true
        },
        logs: true,
        onQueueUpdate: (update) => {
          if (update.status === "IN_PROGRESS" && update.logs) {
            update.logs.map((log) => log.message).forEach(console.log);
          }
        }
      })

      console.log('✅ [Mask API] FAL.AI response received:', falResult)

      let maskUrls: string[] = []
      
      if (falResult?.data?.mask_url) {
        maskUrls = [falResult.data.mask_url]
      } else if (falResult?.data?.masks && Array.isArray(falResult.data.masks)) {
        maskUrls = falResult.data.masks
      }

      if (maskUrls.length === 0) {
        throw new Error('No mask URLs returned from FAL.AI')
      }

      console.log('🎯 [Mask API] Generated mask URLs:', maskUrls)

      // Deduct credits
      await deductCredits(user.id, creditCost, 'Furniture Masking', jobId)

      // Update job with results
      await db.update(jobs)
          .set({
            status: 'completed',
          resultUrls: maskUrls,
          completedAt: new Date(),
          })
          .where(eq(jobs.id, jobId))

      console.log('✅ [Mask API] Job completed successfully')

        return NextResponse.json({
          success: true,
        jobId,
        maskUrls,
        creditsUsed: creditCost
        })

    } catch (error) {
      console.error('❌ [Mask API] FAL.AI generation failed:', error)

      // Update job with error
      await db.update(jobs)
        .set({
          status: 'failed',
          errorMessage: error instanceof Error ? error.message : 'Unknown error',
          completedAt: new Date(),
        })
        .where(eq(jobs.id, jobId))

      const errorResponse = handleFALError(error)
      return NextResponse.json(errorResponse, { status: 500 })
    }

  } catch (error) {
    console.error('❌ [Mask API] Request failed:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
} 