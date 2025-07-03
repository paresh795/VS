import { auth } from '@clerk/nextjs/server';
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { jobs, users, credits, sessions, generations } from '@/db/schema';
import { eq } from 'drizzle-orm';
import fal, { FAL_ENDPOINTS, FAL_DEFAULTS, buildStagingPrompt, handleFALError, checkFALConfig } from '@/lib/fal-config';
import { STYLE_PRESETS, CREDIT_COSTS, ROOM_TYPES } from '@/lib/constants';
import { getCreditBalance, deductCredits } from '@/lib/credits';
import { v4 as uuidv4 } from 'uuid';

// Configure FAL.AI client
if (process.env.FAL_KEY) {
  fal.config({
    credentials: process.env.FAL_KEY
  });
}

interface StagingRequest {
  originalImageUrl?: string;
  imageUrl?: string; // Support both field names for backward compatibility
  emptyRoomUrl?: string;
  style: string;
  roomType?: string;
  sessionId?: string;
  generationNumber?: number;
}

interface FALResponse {
  images: Array<{
    url: string;
    width: number;
    height: number;
    content_type?: string;
  }>;
}

export async function POST(request: NextRequest) {
  const startTime = Date.now();
  
  try {
    console.log('🚀 [Staging API] Starting FAL.AI staging request');
    
    // Check FAL.AI configuration
    const configCheck = checkFALConfig()
    if (!configCheck.isConfigured) {
      console.error('❌ [Staging API] Configuration error:', configCheck.message)
      return NextResponse.json({ error: configCheck.message }, { status: 500 })
    }
    
    // Parse request body
    const body: StagingRequest = await request.json();
    const { originalImageUrl, imageUrl, emptyRoomUrl, style, roomType, sessionId, generationNumber = 1 } = body;
    
    // Use imageUrl or originalImageUrl for backward compatibility
    const inputImageUrl = originalImageUrl || imageUrl;
    
    if (!inputImageUrl) {
      console.error('❌ [Staging API] Missing image URL');
      return NextResponse.json({ error: 'Missing originalImageUrl or imageUrl' }, { status: 400 });
    }

    if (!style) {
      console.error('❌ [Staging API] Missing style');
      return NextResponse.json({ error: 'Missing style parameter' }, { status: 400 });
    }

    console.log('🔍 [Staging API] Request details:', { inputImageUrl, style, roomType, sessionId, generationNumber });
    
    // Get authentication
    const { userId } = await auth();
    if (!userId) {
      console.error('❌ [Staging API] Unauthorized request');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    // Get user from database
    const [user] = await db.select().from(users).where(eq(users.clerkId, userId));
    if (!user) {
      console.error('❌ [Staging API] User not found:', userId);
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    console.log('✅ [Staging API] User authenticated:', user.id);

    // Validate session if provided
    let session = null
    if (sessionId) {
      console.log('🔍 [Staging API] Validating session:', sessionId)
      const [sessionRecord] = await db
        .select()
        .from(sessions)
        .where(eq(sessions.id, sessionId))
        .limit(1)

      if (!sessionRecord || sessionRecord.userId !== user.id) {
        console.log('❌ [Staging API] Invalid session or unauthorized')
        return NextResponse.json(
          { error: 'Invalid session or unauthorized' },
          { status: 403 }
        )
      }
      session = sessionRecord
      console.log('✅ [Staging API] Session validated')
    }
    
    // Check credits
    const creditCost = CREDIT_COSTS.STAGING_FULL;
    const currentBalance = await getCreditBalance(user.id);
    
    if (currentBalance < creditCost) {
      console.error('❌ [Staging API] Insufficient credits:', { needed: creditCost, available: currentBalance });
      return NextResponse.json({ 
        error: `Insufficient credits. Required: ${creditCost}, Available: ${currentBalance}` 
      }, { status: 402 });
    }

    console.log('💰 [Staging API] Credits sufficient:', { cost: creditCost, balance: currentBalance });
    
    // 💳 DEDUCT CREDITS IMMEDIATELY (before FAL API calls)
    console.log('💳 [Staging API] Deducting credits immediately...');
    try {
      await deductCredits(user.id, creditCost, 'Virtual Staging', 'pending');
      console.log('✅ [Staging API] Credits deducted successfully');
    } catch (creditError) {
      console.error('❌ [Staging API] Credit deduction failed:', creditError);
      return NextResponse.json({ 
        error: 'Failed to deduct credits. Please try again.' 
      }, { status: 402 });
    }
    
    // Create job record
    const jobId = uuidv4();
    const [jobRecord] = await db.insert(jobs).values({
      id: jobId,
      userId: user.id,
      sessionId: sessionId || null,
      type: 'staging',
      status: 'processing',
      inputImageUrl,
      style,
      roomType: roomType || 'living_room',
      creditsUsed: creditCost,
      createdAt: new Date(),
    }).returning();

    console.log('📝 [Staging API] Job created:', jobRecord.id);
    
    try {
      // Build staging prompts using the exact working prompts from constants
      const prompt1 = buildStagingPrompt(style);
      const prompt2 = `${buildStagingPrompt(style)} Alternative design approach.`;
      
      console.log('📝 [Staging API] Generated prompts:', { prompt1: prompt1.substring(0, 100) + '...', prompt2: prompt2.substring(0, 100) + '...' });
      
      // Start both staging variants simultaneously
      console.log('🎨 [Staging API] Starting FAL.AI staging generation...');
      
      const variant1Promise = fal.subscribe(FAL_ENDPOINTS.FLUX_KONTEXT_PRO, {
        input: {
          prompt: prompt1,
          image_url: inputImageUrl,
          ...FAL_DEFAULTS
        },
        logs: true,
        onQueueUpdate: (update) => {
          if (update.status === "IN_PROGRESS" && update.logs) {
            update.logs.map((log) => log.message).forEach(console.log);
          }
        }
      });
      
      const variant2Promise = fal.subscribe(FAL_ENDPOINTS.FLUX_KONTEXT_PRO, {
        input: {
          prompt: prompt2,
          image_url: inputImageUrl,
          ...FAL_DEFAULTS
        },
        logs: true,
        onQueueUpdate: (update) => {
          if (update.status === "IN_PROGRESS" && update.logs) {
            update.logs.map((log) => log.message).forEach(console.log);
          }
        }
      });
      
      // Wait for both variants to complete
      const [variant1Result, variant2Result] = await Promise.all([variant1Promise, variant2Promise]);

      console.log('✅ [Staging API] FAL.AI responses received');
      
      // Extract image URLs from results
      let stagedUrls: string[] = [];
      
      if (variant1Result?.data?.images?.[0]?.url) {
        stagedUrls.push(variant1Result.data.images[0].url);
      }
      if (variant2Result?.data?.images?.[0]?.url) {
        stagedUrls.push(variant2Result.data.images[0].url);
      }
      
      if (stagedUrls.length === 0) {
        throw new Error('No staged images returned from FAL.AI');
      }

      console.log('🎯 [Staging API] Generated staged URLs:', stagedUrls);
      
      // Store FAL.AI job IDs for tracking
      const falJobIds = [
        variant1Result?.requestId,
        variant2Result?.requestId
      ].filter(Boolean).join(',');

      // Create generation record if session is provided
      if (sessionId) {
        console.log('📝 [Staging API] Creating generation record...')
        await db.insert(generations).values({
          sessionId,
          generationType: 'staging',
          generationNumber,
          inputImageUrl,
          outputImageUrls: stagedUrls,
          style,
          roomType: roomType || 'living_room',
          creditsCost: creditCost,
          falJobId: falJobIds,
          status: 'completed'
        })
        console.log('✅ [Staging API] Generation record created')
      }
      
      // Update job with results
      await db.update(jobs)
        .set({
          status: 'completed',
          resultUrls: stagedUrls,
          falJobId: falJobIds,
          completedAt: new Date(),
        })
        .where(eq(jobs.id, jobId));

      console.log('✅ [Staging API] Job completed successfully');
      
      const duration = Date.now() - startTime;
      console.log(`⏱️ [Staging API] Total processing time: ${duration}ms`);
      
      return NextResponse.json({
        success: true,
        jobId,
        stagedUrls,
        creditsUsed: creditCost,
        generationNumber,
        processingTime: duration
      });
      
    } catch (error) {
      console.error('❌ [Staging API] Generation failed:', error);
      
      // Mark job as failed
      await db.update(jobs)
        .set({
          status: 'failed',
          errorMessage: error instanceof Error ? error.message : 'Unknown error',
        })
        .where(eq(jobs.id, jobId));

      // Create failed generation record if session is provided
      if (sessionId) {
        await db.insert(generations).values({
          sessionId,
          generationType: 'staging',
          generationNumber,
          inputImageUrl,
          outputImageUrls: [],
          style,
          roomType: roomType || 'living_room',
          creditsCost: creditCost,
          status: 'failed',
          errorMessage: error instanceof Error ? error.message : 'Unknown error'
        })
      }
      
      // 🔄 ROLLBACK CREDITS ON FAILURE
      console.log('🔄 [Staging API] Rolling back credits due to failure...');
      try {
        await deductCredits(user.id, -creditCost, 'Virtual Staging - Refund', 'refund');
        console.log('✅ [Staging API] Credits rolled back successfully');
      } catch (rollbackError) {
        console.error('❌ [Staging API] Credit rollback failed:', rollbackError);
      }
      
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      return NextResponse.json({
        success: false,
        error: 'Staging generation failed',
        details: errorMessage,
        generationNumber
      }, { status: 500 });
    }
    
  } catch (error) {
    console.error('❌ [Staging API] Unexpected error:', error);
    return NextResponse.json({
      success: false,
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
} 