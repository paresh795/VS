import { pgEnum, pgTable, text, timestamp, uuid, integer, json } from "drizzle-orm/pg-core"

// Keep existing customers table from original template
export const membership = pgEnum("membership", ["free", "pro"])

export const customers = pgTable("customers", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: text("user_id").unique().notNull(),
  membership: membership("membership").default("free").notNull(),
  stripeCustomerId: text("stripe_customer_id").unique(),
  stripeSubscriptionId: text("stripe_subscription_id").unique(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull()
})

// Users table for Virtual Staging SaaS
export const users = pgTable("users", {
  id: uuid("id").defaultRandom().primaryKey(),
  clerkId: text("clerk_id").unique().notNull(),
  email: text("email").notNull(),
  firstName: text("first_name"),
  lastName: text("last_name"),
  imageUrl: text("image_url"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull()
})

// Credits system
export const transactionType = pgEnum("transaction_type", ["purchase", "debit", "refund"])

export const credits = pgTable("credits", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  balance: integer("balance").default(0).notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull()
})

export const creditTransactions = pgTable("credit_transactions", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  amount: integer("amount").notNull(), // positive for credits, negative for debits
  type: transactionType("type").notNull(),
  description: text("description").notNull(),
  stripePaymentIntentId: text("stripe_payment_intent_id"),
  createdAt: timestamp("created_at").defaultNow().notNull()
})

// Enhanced workflow: Sessions table to track user staging workflows
export const roomStateChoice = pgEnum("room_state_choice", ["already_empty", "generate_empty"])

export const sessions = pgTable("sessions", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  originalImageUrl: text("original_image_url").notNull(),
  roomStateChoice: roomStateChoice("room_state_choice").notNull(),
  selectedEmptyRoomUrl: text("selected_empty_room_url"), // Final chosen empty room image
  title: text("title"), // Optional session title/name
  description: text("description"), // Optional session description
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull()
})

// Enhanced workflow: Generation history for both empty room and staging
export const generationType = pgEnum("generation_type", ["empty_room", "staging"])
export const generationStatus = pgEnum("generation_status", ["pending", "processing", "completed", "failed"])

export const generations = pgTable("generations", {
  id: uuid("id").defaultRandom().primaryKey(),
  sessionId: uuid("session_id").references(() => sessions.id, { onDelete: "cascade" }).notNull(),
  generationType: generationType("generation_type").notNull(),
  generationNumber: integer("generation_number").notNull(), // 1, 2, 3 for retries
  inputImageUrl: text("input_image_url").notNull(),
  outputImageUrls: json("output_image_urls").$type<string[]>().notNull(), // Array of generated URLs
  style: text("style"), // For staging generations
  roomType: text("room_type"), // For staging generations
  creditsCost: integer("credits_cost").notNull(),
  falJobId: text("fal_job_id"),
  status: generationStatus("status").default("pending").notNull(),
  errorMessage: text("error_message"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  completedAt: timestamp("completed_at")
})

// Jobs table for AI processing (enhanced with session tracking)
export const jobType = pgEnum("job_type", ["upload", "mask", "empty_room", "staging", "edit"])
export const jobStatus = pgEnum("job_status", ["pending", "processing", "completed", "failed"])

export const jobs = pgTable("jobs", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  sessionId: uuid("session_id").references(() => sessions.id, { onDelete: "cascade" }), // Link to session
  type: jobType("type").notNull(),
  status: jobStatus("status").default("pending").notNull(),
  
  // Input data
  inputImageUrl: text("input_image_url").notNull(),
  prompt: text("prompt"),
  style: text("style"), // for staging jobs
  roomType: text("room_type"), // bedroom, living_room, etc.
  maskUrl: text("mask_url"), // for editing jobs
  
  // FAL.AI job tracking (replacing Replicate)
  falJobId: text("fal_job_id"),
  
  // Results
  resultUrls: json("result_urls").$type<string[]>(), // array of generated image URLs
  errorMessage: text("error_message"),
  
  // Credits used
  creditsUsed: integer("credits_used").default(0).notNull(),
  
  // Timestamps
  createdAt: timestamp("created_at").defaultNow().notNull(),
  completedAt: timestamp("completed_at"),
  
  // Auto-purge tracking
  purgeAt: timestamp("purge_at") // when files should be deleted
})

// Export types
export type InsertCustomer = typeof customers.$inferInsert
export type SelectCustomer = typeof customers.$inferSelect

export type InsertUser = typeof users.$inferInsert
export type SelectUser = typeof users.$inferSelect

export type InsertCredit = typeof credits.$inferInsert
export type SelectCredit = typeof credits.$inferSelect

export type InsertCreditTransaction = typeof creditTransactions.$inferInsert
export type SelectCreditTransaction = typeof creditTransactions.$inferSelect

export type InsertSession = typeof sessions.$inferInsert
export type SelectSession = typeof sessions.$inferSelect

export type InsertGeneration = typeof generations.$inferInsert
export type SelectGeneration = typeof generations.$inferSelect

export type InsertJob = typeof jobs.$inferInsert
export type SelectJob = typeof jobs.$inferSelect 