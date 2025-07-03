import { NextRequest, NextResponse } from "next/server"
import { auth } from "@clerk/nextjs/server"
import { db } from "@/db"
import { sessions, generations, users } from "@/db/schema"
import { eq, desc } from "drizzle-orm"

// POST /api/sessions - Create new session
export async function POST(request: NextRequest) {
  try {
    console.log("🎬 [Sessions API] Creating new session")
    
    const { userId } = await auth()
    if (!userId) {
      console.log("❌ [Sessions API] Unauthorized - no user ID")
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()
    const { originalImageUrl, roomStateChoice } = body

    if (!originalImageUrl || !roomStateChoice) {
      console.log("❌ [Sessions API] Missing required fields")
      return NextResponse.json(
        { error: "Missing originalImageUrl or roomStateChoice" },
        { status: 400 }
      )
    }

    if (!['already_empty', 'generate_empty'].includes(roomStateChoice)) {
      console.log("❌ [Sessions API] Invalid room state choice:", roomStateChoice)
      return NextResponse.json(
        { error: "Invalid roomStateChoice. Must be 'already_empty' or 'generate_empty'" },
        { status: 400 }
      )
    }

    console.log("🔍 [Sessions API] Looking up user in database...")
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.clerkId, userId))
      .limit(1)

    if (!user) {
      console.log("❌ [Sessions API] User not found in database")
      return NextResponse.json({ error: "User not found" }, { status: 404 })
    }

    console.log("✅ [Sessions API] User found:", user.id)

    // Create new session
    console.log("📝 [Sessions API] Creating session with:", {
      userId: user.id,
      originalImageUrl,
      roomStateChoice
    })

    const [newSession] = await db
      .insert(sessions)
      .values({
        userId: user.id,
        originalImageUrl,
        roomStateChoice: roomStateChoice as 'already_empty' | 'generate_empty',
        selectedEmptyRoomUrl: roomStateChoice === 'already_empty' ? originalImageUrl : null
      })
      .returning()

    console.log("✅ [Sessions API] Session created successfully:", newSession.id)

    return NextResponse.json({
      success: true,
      session: newSession
    })
  } catch (error) {
    console.error("❌ [Sessions API] Error creating session:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}

// GET /api/sessions - Get user's session history
export async function GET(request: NextRequest) {
  try {
    console.log("📚 [Sessions API] Getting session history")
    
    const { userId } = await auth()
    if (!userId) {
      console.log("❌ [Sessions API] Unauthorized - no user ID")
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    console.log("🔍 [Sessions API] Looking up user in database...")
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.clerkId, userId))
      .limit(1)

    if (!user) {
      console.log("❌ [Sessions API] User not found in database")
      return NextResponse.json({ error: "User not found" }, { status: 404 })
    }

    console.log("✅ [Sessions API] User found:", user.id)

    // Get all sessions for this user with their generations
    console.log("📚 [Sessions API] Fetching sessions and generations...")
    
    const userSessions = await db
      .select()
      .from(sessions)
      .where(eq(sessions.userId, user.id))
      .orderBy(desc(sessions.createdAt))

    // For each session, get its generations
    const sessionsWithGenerations = await Promise.all(
      userSessions.map(async (session) => {
        const sessionGenerations = await db
          .select()
          .from(generations)
          .where(eq(generations.sessionId, session.id))
          .orderBy(desc(generations.createdAt))

        // Separate empty room and staging generations
        const emptyRoomGenerations = sessionGenerations
          .filter(g => g.generationType === 'empty_room')
          .map(g => ({
            id: g.id,
            generationNumber: g.generationNumber,
            inputImageUrl: g.inputImageUrl,
            outputImageUrls: g.outputImageUrls,
            creditsCost: g.creditsCost,
            status: g.status,
            errorMessage: g.errorMessage,
            createdAt: g.createdAt
          }))

        const stagingGenerations = sessionGenerations
          .filter(g => g.generationType === 'staging')
          .map(g => ({
            id: g.id,
            generationNumber: g.generationNumber,
            inputImageUrl: g.inputImageUrl,
            outputImageUrls: g.outputImageUrls,
            style: g.style || '',
            roomType: g.roomType || '',
            creditsCost: g.creditsCost,
            status: g.status,
            errorMessage: g.errorMessage,
            createdAt: g.createdAt
          }))

        return {
          ...session,
          emptyRoomGenerations,
          stagingGenerations
        }
      })
    )

    console.log(`✅ [Sessions API] Found ${sessionsWithGenerations.length} sessions`)

    return NextResponse.json({
      success: true,
      sessions: sessionsWithGenerations
    })
  } catch (error) {
    console.error("❌ [Sessions API] Error getting session history:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
} 