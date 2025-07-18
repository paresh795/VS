"use server"

import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { db } from '@/db'
import { sessions, generations, users } from '@/db/schema'
import { eq, desc, inArray } from 'drizzle-orm'

export async function GET() {
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

    // Fetch user's sessions
    const userSessions = await db.select()
      .from(sessions)
      .where(eq(sessions.userId, user.id))
      .orderBy(desc(sessions.updatedAt))
      .limit(50) // Limit to last 50 sessions for performance

    // Get all session IDs for fetching generations
    const sessionIds = userSessions.map(session => session.id)
    
    // Fetch all generations for these sessions
    const allGenerations = sessionIds.length > 0 
      ? await db.select()
          .from(generations)
          .where(inArray(generations.sessionId, sessionIds))
          .orderBy(desc(generations.createdAt))
      : []

    // Group generations by session ID
    const generationsBySession = allGenerations.reduce((acc, gen) => {
      if (!acc[gen.sessionId]) {
        acc[gen.sessionId] = []
      }
      acc[gen.sessionId].push(gen)
      return acc
    }, {} as Record<string, typeof allGenerations>)

    // Transform the data to match our SessionWithGenerations interface
    const transformedSessions = userSessions.map(session => {
      const sessionGenerations = generationsBySession[session.id] || []
      
      return {
        ...session,
        emptyRoomGenerations: sessionGenerations
          .filter(gen => gen.generationType === 'empty_room')
          .map(gen => ({
            id: gen.id,
            generationNumber: gen.generationNumber,
            inputImageUrl: gen.inputImageUrl,
            outputImageUrls: gen.outputImageUrls as string[],
            creditsCost: gen.creditsCost,
            status: gen.status,
            errorMessage: gen.errorMessage || undefined,
            createdAt: gen.createdAt
          })),
        stagingGenerations: sessionGenerations
          .filter(gen => gen.generationType === 'staging')
          .map(gen => ({
            id: gen.id,
            generationNumber: gen.generationNumber,
            inputImageUrl: gen.inputImageUrl,
            outputImageUrls: gen.outputImageUrls as string[],
            style: gen.style || '',
            roomType: gen.roomType || '',
            creditsCost: gen.creditsCost,
            status: gen.status,
            errorMessage: gen.errorMessage || undefined,
            createdAt: gen.createdAt
          }))
      }
    })

    console.log(`✅ [Sessions History API] Found ${transformedSessions.length} sessions for user ${user.id}`)
    
    return NextResponse.json({
      success: true,
      sessions: transformedSessions
    })

  } catch (error) {
    console.error('❌ [Sessions History API] Error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch session history' },
      { status: 500 }
    )
  }
} 