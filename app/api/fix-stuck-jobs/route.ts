import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { db } from '@/db'
import { jobs, users } from '@/db/schema'
import { eq, and, lt, isNull, inArray } from 'drizzle-orm'

export async function POST(request: NextRequest) {
  try {
    console.log('🔧 [FIX STUCK JOBS] Starting stuck job cleanup process...')
    
    // Check authentication
    const { userId } = await auth()
    if (!userId) {
      console.error('❌ [FIX STUCK JOBS] Unauthorized request')
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get user from database
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.clerkId, userId))
      .limit(1)

    if (!user) {
      console.error('❌ [FIX STUCK JOBS] User not found:', userId)
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    console.log('✅ [FIX STUCK JOBS] User authenticated:', user.id)
    
    // Find stuck jobs that are more than 5 minutes old and still processing
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000)
    
    console.log('🔍 [FIX STUCK JOBS] Finding stuck jobs older than:', fiveMinutesAgo.toISOString())

    const stuckJobs = await db
      .select()
      .from(jobs)
      .where(
        and(
          eq(jobs.userId, user.id),
          inArray(jobs.status, ['pending', 'processing']),
          lt(jobs.createdAt, fiveMinutesAgo)
        )
      )

    console.log(`🔍 [FIX STUCK JOBS] Found ${stuckJobs.length} stuck jobs:`)
    stuckJobs.forEach(job => {
      const ageMinutes = Math.round((Date.now() - new Date(job.createdAt).getTime()) / 60000)
      console.log(`  - Job ${job.id}: type=${job.type}, created ${ageMinutes} minutes ago, status: ${job.status}, falJobId: ${job.falJobId}`)
    })

    if (stuckJobs.length === 0) {
      console.log('✅ [FIX STUCK JOBS] No stuck jobs found')
      return NextResponse.json({
        success: true,
        message: 'No stuck jobs found',
        fixedJobs: 0,
        details: 'All jobs are processing normally'
      })
    }

    // Update all stuck jobs to failed status
    console.log('🔧 [FIX STUCK JOBS] Marking stuck jobs as failed...')
    
    const stuckJobIds = stuckJobs.map(job => job.id)
      
    await db
          .update(jobs)
          .set({
            status: 'failed',
        errorMessage: 'Job timed out - marked as failed by cleanup process',
            completedAt: new Date()
          })
      .where(inArray(jobs.id, stuckJobIds))

    console.log(`✅ [FIX STUCK JOBS] Successfully marked ${stuckJobs.length} jobs as failed`)

    return NextResponse.json({
      success: true,
      message: `Fixed ${stuckJobs.length} stuck jobs`,
      fixedJobs: stuckJobs.length,
      details: `Marked ${stuckJobs.length} stuck jobs as failed`,
      jobIds: stuckJobIds
    })

  } catch (error) {
    console.error('❌ [FIX STUCK JOBS] Error:', error)
    return NextResponse.json(
      {
        success: false,
      error: 'Failed to fix stuck jobs',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

// Add GET method for easy testing
export async function GET(request: NextRequest) {
  console.log('🔧 [FIX STUCK JOBS] GET request received - redirecting to POST')
  return POST(request)
} 