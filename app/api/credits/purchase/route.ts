import { auth } from '@clerk/nextjs/server';
import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { CREDIT_PACKAGES } from '@/lib/constants';

// Initialize Stripe with secret key
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

export async function POST(request: NextRequest) {
  console.log('💳 [CREDITS PURCHASE] === STARTING CREDIT PURCHASE ===');
  
  try {
    console.log('🔐 [CREDITS PURCHASE] Step 1: Checking authentication...');
    const { userId: clerkUserId } = await auth();
    if (!clerkUserId) {
      console.log('❌ [CREDITS PURCHASE] Authentication failed - no user ID');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.log('✅ [CREDITS PURCHASE] Authentication successful:', clerkUserId);

    console.log('📥 [CREDITS PURCHASE] Step 2: Parsing request body...');
    const body = await request.json();
    const { packageType } = body;
    console.log('📋 [CREDITS PURCHASE] Package type:', packageType);

    // Validate package type
    if (!packageType || !CREDIT_PACKAGES[packageType as keyof typeof CREDIT_PACKAGES]) {
      console.log('❌ [CREDITS PURCHASE] Invalid package type:', packageType);
      return NextResponse.json({ 
        error: 'Invalid package type. Must be one of: ' + Object.keys(CREDIT_PACKAGES).join(', ') 
      }, { status: 400 });
    }

    const packageConfig = CREDIT_PACKAGES[packageType as keyof typeof CREDIT_PACKAGES];
    console.log('✅ [CREDITS PURCHASE] Package config:', packageConfig);

    console.log('🚀 [CREDITS PURCHASE] Step 3: Creating Stripe checkout session...');
    // Create Stripe checkout session
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [
        {
          price: packageConfig.priceId,
          quantity: 1,
        },
      ],
      mode: 'payment',
      success_url: `${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/dashboard?purchase=success`,
      cancel_url: `${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/dashboard?purchase=cancelled`,
      client_reference_id: clerkUserId, // Store Clerk user ID for webhook processing
      metadata: {
        clerkUserId: clerkUserId,
        packageType: packageType,
        credits: packageConfig.credits.toString(),
        price: packageConfig.price.toString()
      }
    });

    console.log('✅ [CREDITS PURCHASE] Checkout session created:', session.id);
    
    const response = {
      success: true,
      sessionId: session.id,
      url: session.url,
      packageType: packageConfig.name,
      credits: packageConfig.credits,
      price: packageConfig.price
    };

    console.log('🎉 [CREDITS PURCHASE] === PURCHASE REQUEST COMPLETED ===');
    console.log('📤 [CREDITS PURCHASE] Response:', response);
    
    return NextResponse.json(response);

  } catch (error) {
    console.error('❌ [CREDITS PURCHASE] ERROR OCCURRED:');
    console.error('❌ [CREDITS PURCHASE] Error type:', typeof error);
    console.error('❌ [CREDITS PURCHASE] Error message:', error instanceof Error ? error.message : 'Unknown error');
    console.error('❌ [CREDITS PURCHASE] Full error object:', error);
    
    return NextResponse.json({ 
      error: 'Failed to create checkout session',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
} 