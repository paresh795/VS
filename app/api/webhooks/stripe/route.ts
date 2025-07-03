import { NextRequest, NextResponse } from 'next/server';
import { headers } from 'next/headers';
import Stripe from 'stripe';
import { db } from '@/db';
import { users, credits, creditTransactions } from '@/db/schema';
import { eq, sql } from 'drizzle-orm';

// Initialize Stripe with secret key
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET!;

export async function POST(request: NextRequest) {
  console.log('🪝 [STRIPE WEBHOOK] === WEBHOOK RECEIVED ===');
  
  try {
    const body = await request.text();
    const headersList = await headers();
    const signature = headersList.get('stripe-signature');

    if (!signature) {
      console.log('❌ [STRIPE WEBHOOK] Missing stripe-signature header');
      return NextResponse.json({ error: 'Missing signature' }, { status: 400 });
    }

    console.log('🔍 [STRIPE WEBHOOK] Verifying signature...');
    // Verify webhook signature
    let event: Stripe.Event;
    try {
      event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
      console.log('✅ [STRIPE WEBHOOK] Signature verified. Event type:', event.type);
    } catch (err) {
      console.error('❌ [STRIPE WEBHOOK] Signature verification failed:', err);
      return NextResponse.json({ 
        error: 'Invalid signature',
        details: err instanceof Error ? err.message : 'Unknown error'
      }, { status: 400 });
    }

    // Handle the event
    if (event.type === 'checkout.session.completed') {
      console.log('💳 [STRIPE WEBHOOK] Processing checkout.session.completed...');
      const session = event.data.object as Stripe.Checkout.Session;
      
      console.log('📋 [STRIPE WEBHOOK] Session data:', {
        id: session.id,
        client_reference_id: session.client_reference_id,
        metadata: session.metadata,
        amount_total: session.amount_total,
        currency: session.currency
      });

      // Extract data from session
      const clerkUserId = session.client_reference_id || session.metadata?.clerkUserId;
      const packageType = session.metadata?.packageType;
      const creditsAmount = parseInt(session.metadata?.credits || '0');
      const price = parseFloat(session.metadata?.price || '0');

      if (!clerkUserId) {
        console.error('❌ [STRIPE WEBHOOK] Missing clerkUserId in session');
        return NextResponse.json({ error: 'Missing user ID' }, { status: 400 });
      }

      if (!creditsAmount || creditsAmount <= 0) {
        console.error('❌ [STRIPE WEBHOOK] Invalid credits amount:', creditsAmount);
        return NextResponse.json({ error: 'Invalid credits amount' }, { status: 400 });
      }

      console.log('🔍 [STRIPE WEBHOOK] Looking up user in database...');
      // Get user from database using Clerk ID
      const userResult = await db
        .select()
        .from(users)
        .where(eq(users.clerkId, clerkUserId))
        .limit(1);

      if (!userResult[0]) {
        console.error('❌ [STRIPE WEBHOOK] User not found in database:', clerkUserId);
        return NextResponse.json({ error: 'User not found' }, { status: 404 });
      }

      const user = userResult[0];
      const userId = user.id;
      console.log('✅ [STRIPE WEBHOOK] User found:', userId);

      console.log('💰 [STRIPE WEBHOOK] Adding credits to user account...');
      // Add credits to user account using transaction
      await db.transaction(async (tx) => {
        // Check if user has existing credits record
        const existingCredits = await tx
          .select()
          .from(credits)
          .where(eq(credits.userId, userId))
          .limit(1);

        if (existingCredits.length === 0) {
          console.log('📝 [STRIPE WEBHOOK] Creating new credits record...');
          // Create new credits record
          await tx.insert(credits).values({
            userId: userId,
            balance: creditsAmount,
            updatedAt: new Date()
          });
        } else {
          console.log('📝 [STRIPE WEBHOOK] Updating existing credits record...');
          // Update existing credits record
          await tx.update(credits)
            .set({ 
              balance: sql`${credits.balance} + ${creditsAmount}`,
              updatedAt: new Date()
            })
            .where(eq(credits.userId, userId));
        }

        console.log('📝 [STRIPE WEBHOOK] Recording credit transaction...');
        // Record the transaction
        await tx.insert(creditTransactions).values({
          userId: userId,
          type: 'purchase',
          amount: creditsAmount,
          description: `Credit purchase: ${packageType} package`,
          stripePaymentIntentId: session.payment_intent as string,
          createdAt: new Date()
        });
      });

      console.log('✅ [STRIPE WEBHOOK] Credits added successfully:', {
        userId,
        creditsAdded: creditsAmount,
        packageType,
        sessionId: session.id
      });

    } else {
      console.log('ℹ️ [STRIPE WEBHOOK] Unhandled event type:', event.type);
    }

    console.log('🎉 [STRIPE WEBHOOK] === WEBHOOK PROCESSED SUCCESSFULLY ===');
    return NextResponse.json({ received: true });

  } catch (error) {
    console.error('❌ [STRIPE WEBHOOK] ERROR OCCURRED:');
    console.error('❌ [STRIPE WEBHOOK] Error type:', typeof error);
    console.error('❌ [STRIPE WEBHOOK] Error message:', error instanceof Error ? error.message : 'Unknown error');
    console.error('❌ [STRIPE WEBHOOK] Full error object:', error);
    
    return NextResponse.json({ 
      error: 'Webhook processing failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
} 