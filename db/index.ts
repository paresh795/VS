import { drizzle } from "drizzle-orm/postgres-js"
import postgres from "postgres"
import * as schema from "./schema"

const connectionString = process.env.DATABASE_URL!

// Production-ready Supabase connection configuration
export const client = postgres(connectionString, {
  prepare: false, // Required for Supabase's transaction mode
  max: 10, // Maximum connections in pool (Supabase free tier supports ~20)
  idle_timeout: 20, // Close idle connections after 20 seconds
  max_lifetime: 60 * 30, // Close connections after 30 minutes
  connect_timeout: 30, // Connection timeout in seconds
  // Retry configuration for temporary network issues
  connection: {
    application_name: 'virtual-staging-app',
    statement_timeout: 30000, // 30 second query timeout
  }
})

export const db = drizzle(client, { schema })

// Graceful shutdown handler
if (typeof process !== 'undefined') {
  process.on('beforeExit', () => {
    client.end()
  })
}
