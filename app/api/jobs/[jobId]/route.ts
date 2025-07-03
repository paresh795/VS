import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { db } from '@/db'
import { jobs, users } from '@/db/schema'
import { eq, and } from 'drizzle-orm'

export async function GET(
  request: NextRequest,
  { params }: { params: { jobId: string } }
) {
  try {
    console.log('🔍 [Job Status API] Checking job:', params.jobId)
    
    // Get authentication
    const { userId } = await auth()
    if (!userId) {
      console.error('❌ [Job Status API] Unauthorized request')
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Find user in database
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.clerkId, userId))
      .limit(1)

    if (!user) {
      console.error('❌ [Job Status API] User not found:', userId)
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    console.log('✅ [Job Status API] User found:', user.id)

    // Find job belonging to this user
    const job = await db
      .select()
      .from(jobs)
      .where(and(
        eq(jobs.id, params.jobId),
        eq(jobs.userId, user.id)
      ))
      .limit(1)

    if (job.length === 0) {
      console.error('❌ [Job Status API] Job not found or access denied:', params.jobId)
      return NextResponse.json({ error: 'Job not found' }, { status: 404 })
    }

    console.log('✅ [Job Status API] Job found:', {
      jobId: job[0].id,
      status: job[0].status,
      type: job[0].type,
      resultUrls: job[0].resultUrls?.length || 0
    })

    // Calculate progress based on status
    let progress = 0
    switch (job[0].status) {
      case 'pending':
        progress = 0
        break
      case 'processing':
        progress = 50
        break
      case 'completed':
        progress = 100
        break
      case 'failed':
        progress = 0
        break
      default:
        progress = 0
    }

    const response = {
      id: job[0].id,
      type: job[0].type,
      status: job[0].status,
      progress,
      imageUrl: job[0].inputImageUrl,
      resultUrls: job[0].resultUrls || [],
      errorMessage: job[0].errorMessage,
      creditsUsed: job[0].creditsUsed,
      createdAt: job[0].createdAt,
      completedAt: job[0].completedAt,
      falJobId: job[0].falJobId,
      prompt: job[0].prompt,
      style: job[0].style,
      roomType: job[0].roomType
    }

    console.log('📤 [Job Status API] Returning job data:', response)
    return NextResponse.json(response)

  } catch (error) {
    console.error('❌ [Job Status API] Error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
} 