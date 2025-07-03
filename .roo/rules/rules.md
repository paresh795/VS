---
description: 
globs: 
alwaysApply: true
---
# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Rules

- Never ask: "Would you like me to make this change for you?". Just do it.
- Always use pnpm as package manager
- When installing packages with pnpm always use `pnpm add <packagename>@latest`
- For UI components, prefer `pnpm dlx shadcn@latest add <component-name>`
- Use `pnpm dev` instead of `npm run dev` for all commands
- When creating branches, prefer descriptive names with feature/ or fix/ prefixes
- Always run `pnpm lint:fix` and `pnpm format:write` before committing
- Use TypeScript strictly - always add proper types

## Commands

### Development
- `pnpm dev` - Start development server with Turbopack
- `pnpm build` - Build for production
- `pnpm start` - Start production server

### Code Quality
- `pnpm lint` - Run ESLint
- `pnpm lint:fix` - Run ESLint with auto-fix
- `pnpm types` - Run TypeScript type checking
- `pnpm format:write` - Format code with Prettier
- `pnpm clean` - Run both lint:fix and format:write

### Database
- `npx drizzle-kit push` - Push schema changes to database
- `npx drizzle-kit generate` - Generate migration files
- `npx drizzle-kit migrate` - Run migrations
- `npx bun db/seed` - Seed database
- `npx supabase start` - Start local Supabase instance

### Testing
- `pnpm test` - Run all tests (unit + e2e)
- `pnpm test:unit` - Run Jest unit tests
- `pnpm test:e2e` - Run Playwright e2e tests

### Shadcn UI Components
- `pnpm dlx shadcn@latest add [component-name]` - Install new Shadcn UI components

## Architecture

This is a Next.js 15 SaaS template using the App Router with clear separation between authenticated and unauthenticated routes.

### Route Structure
- `/app/(unauthenticated)` - Public routes
  - `(marketing)` - Landing pages, pricing, features
  - `(auth)` - Login and signup flows
- `/app/(authenticated)` - Protected routes requiring Clerk auth
  - `dashboard` - Main application with account, billing, support sections
- `/app/api` - API routes including Stripe webhook handler

### Key Patterns
- **Server Actions** in `/actions` for data mutations (customers, Stripe operations)
- **Database Schema** in `/db/schema` using Drizzle ORM with PostgreSQL
- **UI Components** in `/components/ui` from Shadcn UI library
- **Authentication** handled by Clerk middleware with protected route groups
- **Payments** integrated via Stripe with webhook handling

### Data Flow
1. Authentication state managed by Clerk (`@clerk/nextjs`)
2. Customer data stored in PostgreSQL via Drizzle ORM
3. Stripe integration for subscription management
4. Server actions handle all data mutations with proper auth checks

### Environment Variables Required
- `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` - Clerk public key
- `CLERK_SECRET_KEY` - Clerk secret key
- `STRIPE_SECRET_KEY` - Stripe secret key
- Database connection handled by Supabase CLI