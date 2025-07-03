import Stripe from "stripe"

const stripeSecretKey = process.env.STRIPE_SECRET_KEY

if (!stripeSecretKey && process.env.NODE_ENV !== "production") {
  console.warn("STRIPE_SECRET_KEY is not set - using placeholder for development")
}

// Use a placeholder key for build time if not set
const key = stripeSecretKey || "sk_test_placeholder_key_for_build"

export const stripe = new Stripe(key, {
  apiVersion: "2025-05-28.basil",
  appInfo: {
    name: "Virtual Staging SaaS",
    version: "1.0.0"
  }
})
