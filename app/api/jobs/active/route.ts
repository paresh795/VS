import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { db } from '@/db'
import { jobs, users } from '@/db/schema'
import { eq, inArray } from 'drizzle-orm'

export async function GET(request: NextRequest) {
  try {
    console.log('🔍 [Active Jobs API] Getting active jobs')

    // Get authentication
    const { userId } = await auth()
    if (!userId) {
      console.error('❌ [Active Jobs API] Unauthorized request')
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Find user in database
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.clerkId, userId))
      .limit(1)

    if (!user) {
      console.error('❌ [Active Jobs API] User not found:', userId)
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    console.log('✅ [Active Jobs API] User found:', user.id)

    // Get active jobs for this user
    const activeJobs = await db
      .select()
      .from(jobs)
      .where(
        eq(jobs.userId, user.id)
      )

    // Filter for jobs that are pending or processing
    const filteredJobs = activeJobs.filter(job => 
      job.status === 'pending' || job.status === 'processing'
    )

    // Transform job data
    const jobsData = filteredJobs.map(job => {
      // Calculate progress based on status
      let progress = 0
      switch (job.status) {
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

      return {
      id: job.id,
      type: job.type,
      status: job.status,
        progress,
        imageUrl: job.inputImageUrl,
      resultUrls: job.resultUrls || [],
      errorMessage: job.errorMessage,
        creditsUsed: job.creditsUsed,
      createdAt: job.createdAt,
      completedAt: job.completedAt,
        falJobId: job.falJobId,
      prompt: job.prompt,
      style: job.style,
      roomType: job.roomType
      }
    })

    console.log(`📤 [Active Jobs API] Returning ${jobsData.length} active jobs`)

    return NextResponse.json(jobsData)

  } catch (error) {
    console.error('❌ [Active Jobs API] Error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
} 