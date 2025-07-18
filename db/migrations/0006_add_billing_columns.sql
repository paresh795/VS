-- Add missing billing_address and payment_method columns to users table
ALTER TABLE "users" ADD COLUMN "billing_address" json;
ALTER TABLE "users" ADD COLUMN "payment_method" json; 