"use server"

import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { db } from '@/db'
import { sessions, generations, users } from '@/db/schema'
import { eq, lt, and, desc } from 'drizzle-orm'

const RETENTION_DAYS = 30 // Keep sessions for 30 days
const FAILED_RETENTION_DAYS = 7 // Keep failed generations for only 7 days

export async function POST() {
  try {
    const { userId: clerkUserId } = await auth()
    
    if (!clerkUserId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get user from database
    const user = await db.query.users.findFirst({
      where: eq(users.clerkId, clerkUserId)
    })

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    const now = new Date()
    const retentionCutoff = new Date(now.getTime() - (RETENTION_DAYS * 24 * 60 * 60 * 1000))
    const failedRetentionCutoff = new Date(now.getTime() - (FAILED_RETENTION_DAYS * 24 * 60 * 60 * 1000))

    console.log(`🧹 [Cleanup API] Starting cleanup for user ${user.id}`)
    console.log(`🧹 [Cleanup API] Retention cutoff: ${retentionCutoff.toISOString()}`)
    console.log(`🧹 [Cleanup API] Failed retention cutoff: ${failedRetentionCutoff.toISOString()}`)

    // 1. Delete failed generations older than 7 days (need to join through sessions)
    const userSessionIds = await db.query.sessions.findMany({
      where: eq(sessions.userId, user.id),
      columns: { id: true }
    })
    
    const sessionIdArray = userSessionIds.map(session => session.id)
    
    const failedGenerations = sessionIdArray.length > 0 ? await db
      .delete(generations)
      .where(
        and(
          eq(generations.status, 'failed'),
          lt(generations.createdAt, failedRetentionCutoff)
        )
      )
      .returning({ id: generations.id }) : []

    // 2. Find sessions older than 30 days
    const oldSessions = await db.query.sessions.findMany({
      where: and(
        eq(sessions.userId, user.id),
        lt(sessions.createdAt, retentionCutoff)
      ),
      columns: {
        id: true,
        createdAt: true
      }
    })

    // 3. Delete generations for old sessions
    const deletedGenerations = []
    for (const session of oldSessions) {
      const sessionGenerations = await db
        .delete(generations)
        .where(eq(generations.sessionId, session.id))
        .returning({ id: generations.id })
      
      deletedGenerations.push(...sessionGenerations)
    }

    // 4. Delete old sessions
    const deletedSessions = await db
      .delete(sessions)
      .where(
        and(
          eq(sessions.userId, user.id),
          lt(sessions.createdAt, retentionCutoff)
        )
      )
      .returning({ id: sessions.id })

    // 5. Find and clean up orphaned generations (generations without sessions)
    // Get all generations for user's sessions
    const allUserGenerations = sessionIdArray.length > 0 ? await db.query.generations.findMany({
      columns: {
        id: true,
        sessionId: true
      }
    }) : []

    const allUserSessions = await db.query.sessions.findMany({
      where: eq(sessions.userId, user.id),
      columns: {
        id: true
      }
    })

    const sessionIds = new Set(allUserSessions.map(s => s.id))
    const orphanedGenerations = allUserGenerations.filter(gen => 
      gen.sessionId && !sessionIds.has(gen.sessionId)
    )

    // Delete orphaned generations
    const deletedOrphanedGenerations = []
    for (const orphaned of orphanedGenerations) {
      const deleted = await db
        .delete(generations)
        .where(eq(generations.id, orphaned.id))
        .returning({ id: generations.id })
      
      deletedOrphanedGenerations.push(...deleted)
    }

    const cleanupSummary = {
      failedGenerationsDeleted: failedGenerations.length,
      oldSessionsDeleted: deletedSessions.length,
      generationsFromOldSessionsDeleted: deletedGenerations.length,
      orphanedGenerationsDeleted: deletedOrphanedGenerations.length,
      totalGenerationsDeleted: failedGenerations.length + deletedGenerations.length + deletedOrphanedGenerations.length
    }

    console.log('✅ [Cleanup API] Cleanup completed:', cleanupSummary)

    return NextResponse.json({
      success: true,
      message: 'Cleanup completed successfully',
      summary: cleanupSummary
    })

  } catch (error) {
    console.error('❌ [Cleanup API] Error:', error)
    return NextResponse.json(
      { error: 'Failed to perform cleanup' },
      { status: 500 }
    )
  }
}

// Optional: Auto-cleanup endpoint for cron jobs
export async function GET() {
  try {
    console.log('🤖 [Auto Cleanup] Starting automated cleanup...')
    
    // This would be called by a cron job or scheduled task
    // For now, it just returns info about what would be cleaned
    
    const now = new Date()
    const retentionCutoff = new Date(now.getTime() - (RETENTION_DAYS * 24 * 60 * 60 * 1000))
    const failedRetentionCutoff = new Date(now.getTime() - (FAILED_RETENTION_DAYS * 24 * 60 * 60 * 1000))

    // Count what would be cleaned without actually cleaning
    const oldSessionsCount = await db.query.sessions.findMany({
      where: lt(sessions.createdAt, retentionCutoff),
      columns: { id: true }
    })

    const failedGenerationsCount = await db.query.generations.findMany({
      where: and(
        eq(generations.status, 'failed'),
        lt(generations.createdAt, failedRetentionCutoff)
      ),
      columns: { id: true }
    })

    return NextResponse.json({
      success: true,
      message: 'Auto-cleanup analysis completed',
      wouldClean: {
        oldSessions: oldSessionsCount.length,
        failedGenerations: failedGenerationsCount.length,
        retentionCutoff: retentionCutoff.toISOString(),
        failedRetentionCutoff: failedRetentionCutoff.toISOString()
      }
    })

  } catch (error) {
    console.error('❌ [Auto Cleanup] Error:', error)
    return NextResponse.json(
      { error: 'Failed to perform auto-cleanup analysis' },
      { status: 500 }
    )
  }
} 