import { db } from "@/db"
import { users } from "@/db/schema"
import { initializeCredits } from "@/lib/credits"
import { Webhook } from "svix"
import { headers } from "next/headers"
import { eq } from "drizzle-orm"

// Define types for Clerk webhook events
interface ClerkWebhookEvent {
  type: string
  data: {
    id: string
    email_addresses?: Array<{ email_address: string }>
    first_name?: string
    last_name?: string
    image_url?: string
  }
}

export async function POST(req: Request) {
  // Get the headers
  const headerPayload = await headers()
  const svix_id = headerPayload.get("svix-id")
  const svix_timestamp = headerPayload.get("svix-timestamp")
  const svix_signature = headerPayload.get("svix-signature")

  // If there are no headers, error out
  if (!svix_id || !svix_timestamp || !svix_signature) {
    return new Response("Error occurred -- no svix headers", {
      status: 400,
    })
  }

  // Get the body
  const payload = await req.text()
  const body = JSON.parse(payload)

  // Get the Webhook secret
  const WEBHOOK_SECRET = process.env.CLERK_WEBHOOK_SECRET

  if (!WEBHOOK_SECRET) {
    throw new Error("Please add CLERK_WEBHOOK_SECRET from Clerk Dashboard to .env.local")
  }

  // Create a new SVIX instance with your secret.
  const wh = new Webhook(WEBHOOK_SECRET)

  let evt: ClerkWebhookEvent

  // Verify the payload with the headers
  try {
    evt = wh.verify(payload, {
      "svix-id": svix_id,
      "svix-timestamp": svix_timestamp,
      "svix-signature": svix_signature,
    }) as ClerkWebhookEvent
  } catch (err) {
    console.error("Error verifying webhook:", err)
    return new Response("Error occurred", {
      status: 400,
    })
  }

  // Handle the webhook
  const eventType = evt.type

  if (eventType === "user.created") {
    const { id, email_addresses, first_name, last_name, image_url } = evt.data

    try {
      // Create user in database
      await db.insert(users).values({
        clerkId: id,
        email: email_addresses?.[0]?.email_address || "",
        firstName: first_name || null,
        lastName: last_name || null,
        imageUrl: image_url || null,
      })

      // Initialize credits for new user
      await initializeCredits(id)

      console.log("User created successfully:", id)
    } catch (error) {
      console.error("Error creating user:", error)
      return new Response("Error creating user", { status: 500 })
    }
  }

  if (eventType === "user.updated") {
    const { id, email_addresses, first_name, last_name, image_url } = evt.data

    try {
      // Update user in database
      await db
        .update(users)
        .set({
          email: email_addresses?.[0]?.email_address || "",
          firstName: first_name || null,
          lastName: last_name || null,
          imageUrl: image_url || null,
          updatedAt: new Date(),
        })
        .where(eq(users.clerkId, id))

      console.log("User updated successfully:", id)
    } catch (error) {
      console.error("Error updating user:", error)
      return new Response("Error updating user", { status: 500 })
    }
  }

  if (eventType === "user.deleted") {
    const { id } = evt.data

    try {
      // Delete user from database (cascade will handle related data)
      await db.delete(users).where(eq(users.clerkId, id))

      console.log("User deleted successfully:", id)
    } catch (error) {
      console.error("Error deleting user:", error)
      return new Response("Error deleting user", { status: 500 })
    }
  }

  return new Response("Webhook handled successfully", { status: 200 })
} 