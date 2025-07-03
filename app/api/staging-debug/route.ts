import { auth } from '@clerk/nextjs/server';
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { jobs, credits, users } from '@/db/schema';
import { eq, desc, sql } from 'drizzle-orm';
import { STYLE_PRESETS, CREDIT_COSTS, ROOM_TYPES } from '@/lib/constants';
import { getCreditBalance } from '@/lib/credits';
import { createSupabaseClient } from '@/lib/supabase';
import { checkFALConfig } from '@/lib/fal-config';

interface DiagnosticsResult {
  timestamp: string;
  environment: any;
  authentication: {
    isAuthenticated: boolean;
    userId: string | null;
    method?: string;
    error?: string;
  };
  database: any;
  credits: any;
  fal: any;
  jobs: any;
  overall: { 
    status: 'unknown' | 'healthy' | 'warning' | 'critical'; 
    issues: string[];
  };
}

export async function GET(request: NextRequest) {
  try {
    console.log('🔍 [STAGING DEBUG] Starting comprehensive system check...');

    const diagnostics: DiagnosticsResult = {
      timestamp: new Date().toISOString(),
      environment: {},
      authentication: {
        isAuthenticated: false,
        userId: null
      },
      database: {},
      credits: {},
      fal: {},
      jobs: {},
      overall: { status: 'unknown', issues: [] }
    };

    // 1. Environment Check
    console.log('🔍 [ENVIRONMENT] Checking environment variables...');
    diagnostics.environment = {
      NODE_ENV: process.env.NODE_ENV,
      hasFALKey: !!process.env.FAL_KEY,
      falKeyLength: process.env.FAL_KEY?.length || 0,
      hasClerkKey: !!process.env.CLERK_SECRET_KEY,
      hasDatabaseUrl: !!process.env.DATABASE_URL
    };

    if (!process.env.FAL_KEY) {
      diagnostics.overall.issues.push('Missing FAL_KEY environment variable');
    }
    if (!process.env.CLERK_SECRET_KEY) {
      diagnostics.overall.issues.push('Missing CLERK_SECRET_KEY environment variable');
    }
    if (!process.env.DATABASE_URL) {
      diagnostics.overall.issues.push('Missing DATABASE_URL environment variable');
    }

    // 2. Authentication Check
    console.log('🔍 [AUTHENTICATION] Checking authentication...');
    try {
      const authResult = await auth();
      const clerkUserId = authResult.userId;
      
      diagnostics.authentication = {
        isAuthenticated: !!clerkUserId,
        userId: clerkUserId || null,
        method: 'Clerk'
      };

      if (!clerkUserId) {
        diagnostics.overall.issues.push('User is not authenticated');
      }
    } catch (authError) {
      console.error('❌ [AUTHENTICATION] Auth error:', authError);
      diagnostics.authentication = {
        isAuthenticated: false,
        userId: null,
        error: authError instanceof Error ? authError.message : 'Unknown auth error'
      };
      diagnostics.overall.issues.push('Authentication system error');
    }

    // 3. Database Check
    console.log('🔍 [DATABASE] Checking database connectivity...');
    try {
      // Test basic database connectivity
      const dbTest = await db.select({ count: sql`count(*)` }).from(users);
      
      diagnostics.database = {
        connected: true,
        userCount: Number(dbTest[0]?.count || 0),
        connectionPool: 'active'
      };
    } catch (dbError) {
      console.error('❌ [DATABASE] Database error:', dbError);
      diagnostics.database = {
        connected: false,
        error: dbError instanceof Error ? dbError.message : 'Unknown database error'
      };
      diagnostics.overall.issues.push('Database connectivity issue');
    }

    // 4. Credits Check (only if authenticated)
    console.log('🔍 [CREDITS BALANCE] Checking user credits...');
    if (diagnostics.authentication.isAuthenticated && diagnostics.authentication.userId) {
      try {
        const [user] = await db
          .select()
          .from(users)
          .where(eq(users.clerkId, diagnostics.authentication.userId))
          .limit(1);

        if (user) {
          const creditBalance = await getCreditBalance(user.id);
          
          diagnostics.credits = {
            userExists: true,
            userId: user.id,
            balance: creditBalance,
            sufficient: creditBalance >= 20 // Minimum for staging
          };

          if (creditBalance < 20) {
            diagnostics.overall.issues.push('Insufficient credits for staging operation');
          }
        } else {
          diagnostics.credits = {
            userExists: false,
            error: 'User not found in database'
          };
          diagnostics.overall.issues.push('User account not found in database');
        }
      } catch (creditError) {
        console.error('❌ [CREDITS BALANCE] Credit check error:', creditError);
        diagnostics.credits = {
          userExists: false,
          error: creditError instanceof Error ? creditError.message : 'Unknown credit error'
        };
        diagnostics.overall.issues.push('Credit system error');
      }
    } else {
      console.log('❌ [CREDITS BALANCE] Authentication failed - no user ID');
      diagnostics.credits = {
        userExists: false,
        error: 'Cannot check credits - user not authenticated'
      };
    }

    // 5. FAL.AI Configuration Check
    console.log('🔍 [FAL CONFIG] Checking FAL.AI configuration...');
    try {
      const falConfig = checkFALConfig();
      
      diagnostics.fal = {
        configured: falConfig.isConfigured,
        message: falConfig.message,
        endpoint: 'fal-ai/flux-pro/kontext'
      };

      if (!falConfig.isConfigured) {
        diagnostics.overall.issues.push(`FAL.AI configuration issue: ${falConfig.message}`);
      }
    } catch (falError) {
      console.error('❌ [FAL CONFIG] FAL config error:', falError);
      diagnostics.fal = {
        configured: false,
        error: falError instanceof Error ? falError.message : 'Unknown FAL error'
      };
      diagnostics.overall.issues.push('FAL.AI configuration error');
    }

    // 6. Recent Jobs Analysis
    console.log('🔍 [JOBS] Analyzing recent staging jobs...');
    try {
      const recentJobs = await db
        .select({
          id: jobs.id,
          type: jobs.type,
          status: jobs.status,
          createdAt: jobs.createdAt,
          completedAt: jobs.completedAt,
          errorMessage: jobs.errorMessage,
          falJobId: jobs.falJobId,
          creditsUsed: jobs.creditsUsed
        })
        .from(jobs)
        .where(eq(jobs.type, 'staging'))
        .orderBy(sql`${jobs.createdAt} DESC`)
        .limit(10);

      const jobStats = {
        total: recentJobs.length,
        completed: recentJobs.filter(j => j.status === 'completed').length,
        failed: recentJobs.filter(j => j.status === 'failed').length,
        processing: recentJobs.filter(j => j.status === 'processing').length,
        stuckJobs: recentJobs.filter(j => 
          j.status === 'processing' && 
          j.createdAt && 
          (new Date().getTime() - new Date(j.createdAt).getTime()) > 5 * 60 * 1000 // 5 minutes
        ).length
      };

      diagnostics.jobs = {
        recent: recentJobs,
        stats: jobStats,
        analysis: {
          successRate: jobStats.total > 0 ? Math.round((jobStats.completed / jobStats.total) * 100) : 0,
          avgProcessingTime: 'N/A' // Could calculate this from completed jobs
        }
      };

      if (jobStats.stuckJobs > 0) {
        diagnostics.overall.issues.push(`${jobStats.stuckJobs} jobs appear to be stuck in processing`);
      }
      if (jobStats.failed > jobStats.completed && jobStats.total > 2) {
        diagnostics.overall.issues.push('High failure rate detected in recent jobs');
      }
    } catch (jobsError) {
      console.error('❌ [JOBS] Jobs analysis error:', jobsError);
      diagnostics.jobs = {
        error: jobsError instanceof Error ? jobsError.message : 'Unknown jobs error'
      };
      diagnostics.overall.issues.push('Jobs analysis failed');
    }

    // 7. Overall Status
    if (diagnostics.overall.issues.length === 0) {
      diagnostics.overall.status = 'healthy';
    } else if (diagnostics.overall.issues.length <= 2) {
      diagnostics.overall.status = 'warning';
    } else {
      diagnostics.overall.status = 'critical';
    }

    console.log(`🔍 [OVERALL] System status: ${diagnostics.overall.status}`);
    console.log(`🔍 [OVERALL] Issues found: ${diagnostics.overall.issues.length}`);

    return NextResponse.json(diagnostics, { 
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache'
      }
    });

  } catch (error) {
    console.error('❌ [STAGING DEBUG] Debug endpoint failed:', error);
    
    return NextResponse.json({
      error: 'Debug endpoint failed',
      details: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  // Quick staging test with minimal data
  try {
    console.log('🧪 [STAGING DEBUG] === STARTING QUICK STAGING TEST ===');
    
    const body = await request.json();
    const { testImageUrl = 'https://example.com/test.jpg', style = 'modern', space = 'living room' } = body;

    // Run basic validation
    if (!process.env.FAL_KEY) {
      return NextResponse.json({ 
        error: 'FAL_KEY missing',
        step: 'environment_check'
      }, { status: 500 });
    }

    const { userId: clerkUserId } = await auth();
    if (!clerkUserId) {
      return NextResponse.json({ 
        error: 'Not authenticated',
        step: 'auth_check'
      }, { status: 401 });
    }

    const userResult = await db
      .select()
      .from(users)
      .where(eq(users.clerkId, clerkUserId))
      .limit(1);

    if (!userResult[0]) {
      return NextResponse.json({ 
        error: 'User not found in database',
        step: 'user_lookup'
      }, { status: 404 });
    }

    const currentCredits = await getCreditBalance(userResult[0].id);
    if (currentCredits < CREDIT_COSTS.STAGING_FULL) {
      return NextResponse.json({ 
        error: 'Insufficient credits',
        required: CREDIT_COSTS.STAGING_FULL,
        current: currentCredits,
        step: 'credit_check'
      }, { status: 402 });
    }

    // If we get here, all basic checks pass
    return NextResponse.json({
      success: true,
      message: 'All staging prerequisites satisfied',
      step: 'all_checks_passed',
      user: userResult[0].id,
      credits: currentCredits,
      canProceed: true
    });

  } catch (error) {
    console.error('💥 [STAGING DEBUG] TEST ERROR:', error);
    return NextResponse.json({
      error: 'Test failed',
      details: error instanceof Error ? error.message : 'Unknown error',
      step: 'unknown_error'
    }, { status: 500 });
  }
} 