import {
  boolean,
  integer,
  json,
  pgEnum,
  pgTable,
  pgView,
  primaryKey,
  real,
  serial,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

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
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  // billingAddress: json("billing_address"), // Removed - doesn't exist in DB
  // paymentMethod: json("payment_method"),   // Removed - doesn't exist in DB
});

// Credits system
export const transactionType = pgEnum("transaction_type", ["purchase", "debit", "refund"])

export const credits = pgTable("credits", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  balance: integer("balance").default(0).notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  // Removed last_top_up_at - not used anywhere and doesn't exist in DB
  },
  (table) => {
    return {
    };
  }
);

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

export const apiTests = pgTable("api_tests", {
  id: serial("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id),
  provider: text("provider").notNull(), // 'fal' or 'replicate'
  model: text("model").notNull(),
  inputImageUrl: text("input_image_url").notNull(),
  prompt: text("prompt").notNull(),
  outputImageUrl: text("output_image_url"),
  processingTime: real("processing_time"),
  status: text("status").notNull(), // 'success' or 'error'
  errorMessage: text("error_message"),
  timestamp: timestamp("timestamp").defaultNow().notNull(),
});

export const apiComparisonView = pgView("api_comparison_view", {
  id: serial("id"),
  userId: text("user_id"),
  inputImageUrl: text("input_image_url"),
  prompt: text("prompt"),
  falProcessingTime: real("fal_processing_time"),
  replicateProcessingTime: real("replicate_processing_time"),
  falStatus: text("fal_status"),
  replicateStatus: text("replicate_status"),
  timestamp: timestamp("timestamp"),
}).as(sql`
  SELECT 
    ROW_NUMBER() OVER (ORDER BY f.timestamp) as id,
    f.user_id,
    f.input_image_url,
    f.prompt,
    f.processing_time as fal_processing_time,
    r.processing_time as replicate_processing_time,
    f.status as fal_status,
    r.status as replicate_status,
    f.timestamp
  FROM 
    api_tests f
  JOIN 
    api_tests r 
  ON 
    f.input_image_url = r.input_image_url AND
    f.prompt = r.prompt AND
    f.user_id = r.user_id AND
    ABS(EXTRACT(EPOCH FROM (f.timestamp - r.timestamp))) < 60
  WHERE
    f.provider = 'fal' AND
    r.provider = 'replicate'
`);

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