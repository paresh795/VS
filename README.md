# 🏠 Virtual Staging SaaS

A professional virtual staging platform that transforms empty rooms into beautifully furnished spaces using AI technology. Built with Next.js 15, Clerk authentication, Supabase, and Replicate AI models.

## ✨ Features

### 🎯 Core Functionality
- **📷 Image Upload**: Drag-and-drop interface for room photos (JPEG/PNG, up to 10MB)
- **🎭 Furniture Masking**: Automatic furniture detection and removal using Lang-SAM
- **🏠 Empty Room Generation**: AI-powered furniture removal with architectural preservation
- **🎨 Style-Based Staging**: 6 professional design styles with intelligent furniture placement
- **💳 Credit System**: Integrated billing with Stripe for pay-per-use model
- **📱 Responsive Design**: Modern UI with shadcn/ui components

### 🎨 Available Styles
- **Modern**: Clean lines, neutral colors, minimalist furniture
- **Scandinavian**: Light woods, hygge elements, cozy textiles
- **Industrial**: Raw materials, metal accents, vintage touches
- **Coastal**: Light blues, beach-inspired elements, natural textures
- **Farmhouse**: Rustic elements, vintage accessories, country charm
- **Luxury**: Rich fabrics, elegant furniture, high-end finishes

### 🔧 Technical Features
- **Real-time Processing**: WebSocket-based job status updates
- **Multi-variant Generation**: 2 style variations per staging request
- **Architectural Preservation**: Advanced prompting to maintain room geometry
- **Error Handling**: Comprehensive retry logic and fallback mechanisms
- **Debug Logging**: Detailed console output for troubleshooting

## 🚀 Technology Stack

### Frontend
- **Next.js 15** with App Router and Turbopack
- **TypeScript** for type safety
- **Tailwind CSS** for styling
- **shadcn/ui** for components
- **Zustand** for state management
- **React Query** for server state

### Backend & Services
- **Supabase** for database and storage
- **Clerk** for authentication
- **Stripe** for payments and billing
- **Replicate** for AI model integration
- **Drizzle ORM** for database operations

### AI Models
- **Flux Kontext-Pro** for staging and empty room generation
- **Lang-SAM** for furniture detection and masking

## 📁 Project Structure

```
├── app/                          # Next.js App Router
│   ├── (authenticated)/         # Protected routes
│   │   └── dashboard/           # Main application
│   ├── (unauthenticated)/       # Public routes
│   │   └── (marketing)/         # Landing pages
│   └── api/                     # API endpoints
│       ├── empty-room/          # Empty room generation
│       ├── stage/               # Room staging
│       ├── mask/                # Furniture masking
│       └── webhooks/            # External service hooks
├── components/                   # Reusable UI components
│   ├── ui/                      # shadcn/ui components
│   ├── staging/                 # Staging-specific components
│   └── upload/                  # File upload components
├── lib/                         # Utility libraries
│   ├── replicate.ts            # AI model integrations
│   ├── credits.ts              # Credit management
│   ├── constants.ts            # Style presets & config
│   └── store/                  # State management
├── db/                          # Database schema & migrations
└── hooks/                       # Custom React hooks
```

## 🛠️ Installation & Setup

### Prerequisites
- Node.js 18+ and pnpm
- Supabase account
- Clerk account
- Stripe account
- Replicate account

### Environment Variables
Create a `.env.local` file with the following variables:

```bash
# Database
DATABASE_URL="your-supabase-db-url"

# Authentication
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY="your-clerk-publishable-key"
CLERK_SECRET_KEY="your-clerk-secret-key"

# AI Services
REPLICATE_API_TOKEN="your-replicate-token"

# Payments
STRIPE_SECRET_KEY="your-stripe-secret-key"
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY="your-stripe-publishable-key"
STRIPE_WEBHOOK_SECRET="your-stripe-webhook-secret"

# Application
NEXT_PUBLIC_APP_URL="http://localhost:3000"
```

### Installation Steps

1. **Clone the repository**
   ```bash
   git clone https://github.com/paresh795/VS.git
   cd VS
   ```

2. **Install dependencies**
   ```bash
   pnpm install
   ```

3. **Set up the database**
   ```bash
   npx drizzle-kit push
   npx bun db/seed
   ```

4. **Start the development server**
   ```bash
   pnpm dev
   ```

5. **Open in browser**
   Navigate to `http://localhost:3000`

## 🎯 Usage

### For Users
1. **Sign up/Login** using Clerk authentication
2. **Upload** a room photo (empty or furnished)
3. **Generate empty room** if furniture needs removal
4. **Select style** from 6 available presets
5. **Choose room type** (bedroom, living room, etc.)
6. **Generate staging** with 2 style variants
7. **Download** final staged images

### Credit System
- **Empty Room Generation**: 2 credits
- **Room Staging**: 4 credits (2 variants)
- **Credit Bundles**: 2,000 credits for $19.90

## 🔧 Development

### Available Scripts
```bash
pnpm dev          # Start development server
pnpm build        # Build for production
pnpm start        # Start production server
pnpm lint         # Run ESLint
pnpm lint:fix     # Fix ESLint issues
pnpm format:write # Format code with Prettier
pnpm clean        # Run lint:fix and format:write
```

### Database Operations
```bash
npx drizzle-kit push      # Push schema changes
npx drizzle-kit generate  # Generate migrations
npx bun db/seed          # Seed database
```

### Testing
```bash
pnpm test        # Run all tests
pnpm test:unit   # Run unit tests
pnpm test:e2e    # Run E2E tests
```

## 📋 API Endpoints

### Core APIs
- `POST /api/upload` - Upload room images
- `POST /api/mask` - Generate furniture masks
- `POST /api/empty-room` - Create empty room images
- `POST /api/stage` - Generate staged rooms
- `GET /api/jobs/[id]` - Check job status

### Webhook Endpoints
- `POST /api/webhooks/clerk` - User management
- `POST /api/webhooks/replicate` - AI job updates
- `POST /api/webhooks/stripe` - Payment processing

## 🎨 Styling & Prompts

The application uses advanced AI prompting to ensure architectural preservation:

```
### VIRTUAL STAGING ONLY – DO NOT REMODEL 
1. Keep every fixed architectural element IDENTICAL to the ROOM IN THE input photo
2. Do NOT modify floor colour, floor material, grout lines, wall paint
3. Do NOT move, rotate, crop, zoom, or change camera perspective
4. Insert or replace movable furniture and décor only
```

## 🔒 Security

- **Environment Variables**: All API keys excluded from repository
- **Authentication**: Clerk-based user management
- **Authorization**: Route-level protection for authenticated users
- **Data Validation**: Input sanitization and type checking
- **Rate Limiting**: Credit-based usage control

## 📈 Performance

- **Image Processing**: Optimized for 4K output quality
- **Caching**: React Query for server state management
- **State Management**: Zustand for global state
- **Database**: Drizzle ORM with connection pooling
- **CDN**: Supabase storage for image delivery

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🆘 Support

For support, please contact [your-email@domain.com] or open an issue in the GitHub repository.

## 🚀 Deployment

The application is optimized for deployment on:
- **Vercel** (recommended for Next.js)
- **Railway**
- **Digital Ocean**

Make sure to configure all environment variables in your deployment platform.

---

**Built with ❤️ using Next.js, Supabase, and Replicate AI**
