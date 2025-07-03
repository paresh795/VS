import { db } from "@/db"
import { credits, creditTransactions, users } from "@/db/schema"
import { eq, sql } from "drizzle-orm"
import { CREDIT_COSTS } from "./constants"

export class InsufficientCreditsError extends Error {
  constructor(required: number, available: number) {
    super(`Insufficient credits. Required: ${required}, Available: ${available}`)
    this.name = 'InsufficientCreditsError'
  }
}

// Get user's current credit balance
export async function getCreditBalance(userId: string): Promise<number> {
  const result = await db
    .select({ balance: credits.balance })
    .from(credits)
    .where(eq(credits.userId, userId))
    .limit(1)

  return result[0]?.balance ?? 0
}

// Initialize credit balance for new user
export async function initializeCredits(userId: string): Promise<void> {
  await db.insert(credits).values({
    userId,
    balance: 0
  }).onConflictDoNothing()
}

// Check if user has sufficient credits
export async function hasEnoughCredits(userId: string, required: number): Promise<boolean> {
  const balance = await getCreditBalance(userId)
  return balance >= required
}

// Deduct credits from user account
export async function deductCredits(
  userId: string, 
  amount: number, 
  description: string,
  jobId?: string
): Promise<void> {
  const currentBalance = await getCreditBalance(userId)
  
  // Only check balance for positive amounts (actual deductions)
  // Negative amounts are rollbacks/refunds and should always be allowed
  if (amount > 0 && currentBalance < amount) {
    throw new InsufficientCreditsError(amount, currentBalance)
  }

  await db.transaction(async (tx) => {
    // Update balance
    await tx
      .update(credits)
      .set({ 
        balance: sql`${credits.balance} - ${amount}`,
        updatedAt: new Date()
      })
      .where(eq(credits.userId, userId))

    // Record transaction
    await tx.insert(creditTransactions).values({
      userId,
      amount: -amount, // Negative for deduction
      type: 'debit',
      description: jobId ? `${description} (Job: ${jobId})` : description
    })
  })
}

// Add credits to user account (for purchases)
export async function addCredits(
  userId: string,
  amount: number,
  description: string,
  stripePaymentIntentId?: string
): Promise<void> {
  await db.transaction(async (tx) => {
    // Update or insert credit balance
    await tx
      .insert(credits)
      .values({
        userId,
        balance: amount,
        updatedAt: new Date()
      })
      .onConflictDoUpdate({
        target: [credits.userId],
        set: {
          balance: sql`${credits.balance} + ${amount}`,
          updatedAt: new Date()
        }
      })

    // Record transaction
    await tx.insert(creditTransactions).values({
      userId,
      amount,
      type: 'purchase',
      description,
      stripePaymentIntentId
    })
  })
}

// Get credit transaction history
export async function getCreditHistory(userId: string, limit: number = 50) {
  return await db
    .select()
    .from(creditTransactions)
    .where(eq(creditTransactions.userId, userId))
    .orderBy(sql`${creditTransactions.createdAt} DESC`)
    .limit(limit)
}

// Get credit cost for a specific operation
export function getCreditCost(operation: keyof typeof CREDIT_COSTS): number {
  return CREDIT_COSTS[operation]
}

// Check and deduct credits for specific operations
export async function checkAndDeductCredits(
  userId: string,
  operation: keyof typeof CREDIT_COSTS,
  jobId?: string
): Promise<void> {
  const cost = getCreditCost(operation)
  const operationNames = {
    MASK_AND_EMPTY: 'Mask Generation & Empty Room',
    STAGING_VARIANT: 'Room Staging Variant',
    STAGING_FULL: 'Full Room Staging',
    CHAT_EDIT: 'Chat Edit'
  }
  
  await deductCredits(userId, cost, operationNames[operation], jobId)
} 