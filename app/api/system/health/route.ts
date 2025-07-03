import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/db'

export async function GET(request: NextRequest) {
  try {
    // Basic health checks
    const healthChecks = {
      database: false,
      timestamp: new Date().toISOString(),
      healthy: false,
      services: {
        database: { status: 'unknown', responseTime: 0 },
        fal: { status: 'external', available: true },
        storage: { status: 'external', available: true }
      }
    }

    // Check database connectivity
    const dbStart = Date.now()
    try {
      await db.execute(sql`SELECT 1`)
      healthChecks.services.database = {
        status: 'healthy',
        responseTime: Date.now() - dbStart
      }
      healthChecks.database = true
    } catch (dbError) {
      healthChecks.services.database = {
        status: 'unhealthy',
        responseTime: Date.now() - dbStart
      }
    }

    // Overall health status
    healthChecks.healthy = healthChecks.database

    const statusCode = healthChecks.healthy ? 200 : 503

    return NextResponse.json(healthChecks, { status: statusCode })

  } catch (error) {
    console.error('Health check error:', error)
    return NextResponse.json(
      { 
        healthy: false,
        error: 'Health check failed',
        details: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    )
  }
}

// Import sql at the top
import { sql } from 'drizzle-orm' 