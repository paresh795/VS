import { auth } from '@clerk/nextjs/server'
import { NextRequest, NextResponse } from 'next/server'
import { getCreditBalance } from '@/lib/credits'
import { db } from '@/db'
import { users } from '@/db/schema'
import { eq } from 'drizzle-orm'

export async function GET(request: NextRequest) {
  console.log('💰 [CREDITS BALANCE] === FETCHING CREDIT BALANCE ===')
  
  try {
    console.log('🔐 [CREDITS BALANCE] Step 1: Checking authentication...')
    
    // Get authentication with better error handling
    let authResult
    try {
      authResult = await auth()
    } catch (authError) {
      console.error('❌ [CREDITS BALANCE] Auth function failed:', authError)
      return NextResponse.json({ 
        error: 'Authentication service unavailable',
        details: 'Please refresh the page and try again'
      }, { status: 503 })
    }
    
    const { userId: clerkUserId } = authResult
    if (!clerkUserId) {
      console.log('❌ [CREDITS BALANCE] Authentication failed - no user ID')
      console.log('🔍 [CREDITS BALANCE] Auth result:', authResult)
      return NextResponse.json({ 
        error: 'Authentication required',
        details: 'Please sign in to view your credit balance'
      }, { status: 401 })
    }
    console.log('✅ [CREDITS BALANCE] Authentication successful:', clerkUserId)

    console.log('🔍 [CREDITS BALANCE] Step 2: Looking up user in database...')
    // Get user from database using Clerk ID
    const userResult = await db
      .select()
      .from(users)
      .where(eq(users.clerkId, clerkUserId))
      .limit(1)

    if (!userResult[0]) {
      console.log('❌ [CREDITS BALANCE] User not found in database:', clerkUserId)
      return NextResponse.json({ 
        error: 'User account not found',
        details: 'Please contact support if this issue persists'
      }, { status: 404 })
    }

    const user = userResult[0]
    const userId = user.id
    console.log('✅ [CREDITS BALANCE] User found:', userId)

    console.log('💳 [CREDITS BALANCE] Step 3: Fetching credit balance...')
    const balance = await getCreditBalance(userId)
    console.log('✅ [CREDITS BALANCE] Balance fetched:', balance)

    const response = {
      success: true,
      balance: balance,
      userId: userId
    }

    console.log('🎉 [CREDITS BALANCE] === BALANCE REQUEST COMPLETED ===')
    console.log('📤 [CREDITS BALANCE] Response:', response)
    
    return NextResponse.json(response, {
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      }
    })

  } catch (error) {
    console.error('❌ [CREDITS BALANCE] ERROR OCCURRED:')
    console.error('❌ [CREDITS BALANCE] Error type:', typeof error)
    console.error('❌ [CREDITS BALANCE] Error message:', error instanceof Error ? error.message : 'Unknown error')
    console.error('❌ [CREDITS BALANCE] Full error object:', error)
    
    return NextResponse.json({ 
      error: 'Failed to fetch credit balance',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
} 