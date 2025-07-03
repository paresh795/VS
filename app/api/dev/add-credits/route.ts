import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { db } from '@/db'
import { users } from '@/db/schema'
import { eq } from 'drizzle-orm'

export async function POST(request: NextRequest) {
  try {
    // Only allow in development
    if (process.env.NODE_ENV !== 'development') {
      return NextResponse.json(
        { error: 'This endpoint is only available in development' },
        { status: 403 }
      )
    }

    // Authenticate user
    const { userId: clerkUserId } = await auth()
    if (!clerkUserId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Parse request body
    const body = await request.json()
    const { amount = 100 } = body

    // Find user in database
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.clerkId, clerkUserId))
      .limit(1)

    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      )
    }

    // Add credits using the proper credits library function
    const { addCredits, getCreditBalance } = await import('@/lib/credits')
    await addCredits(user.id, amount, 'Development credits (manual)')

    // Get updated balance
    const newBalance = await getCreditBalance(user.id)

    return NextResponse.json({
      success: true,
      message: `Successfully added ${amount} credits`,
      newBalance: newBalance,
      user: {
        clerkId: user.clerkId,
        databaseId: user.id
      }
    })

  } catch (error) {
    console.error('Add credits API error:', error)
    return NextResponse.json(
      { 
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

// Handle GET requests to show current balance
export async function GET() {
  try {
    // Only allow in development
    if (process.env.NODE_ENV !== 'development') {
      return NextResponse.json(
        { error: 'This endpoint is only available in development' },
        { status: 403 }
      )
    }

    // Authenticate user
    const { userId: clerkUserId } = await auth()
    if (!clerkUserId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Find user in database
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.clerkId, clerkUserId))
      .limit(1)

    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      )
    }

    // Get current balance
    const { getCreditBalance } = await import('@/lib/credits')
    const currentBalance = await getCreditBalance(user.id)

    return NextResponse.json({
      user: {
        clerkId: user.clerkId,
        databaseId: user.id,
        email: user.email
      },
      currentBalance: currentBalance
    })

  } catch (error) {
    console.error('Get credits API error:', error)
    return NextResponse.json(
      { 
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
} 