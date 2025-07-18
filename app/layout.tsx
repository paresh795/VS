import { CheckoutRedirect } from "@/components/payments/checkout-redirect"
import { StateProviders } from "@/components/providers/state-providers"
import { TooltipProvider } from "@/components/ui/tooltip"
import { TailwindIndicator } from "@/components/utility/tailwind-indicator"
import { ClerkProvider } from "@clerk/nextjs"
import type { Metadata } from "next"
import { ThemeProvider } from "next-themes"
import { Geist, Geist_Mono } from "next/font/google"
import { Toaster } from "sonner"
import "./globals.css"
import { Manrope } from "next/font/google"
import localFont from "next/font/local"
import { cn } from "@/lib/utils"

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"]
})

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"]
})

const manrope = Manrope({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-manrope",
})

const futura = localFont({
  src: "../public/fonts/Futura-Condensed-Extra-Bold.ttf",
  variable: "--font-futura",
})

export const metadata: Metadata = {
  title: "Virtual Staging Pro - AI-Powered Real Estate Staging",
  description: "Transform empty rooms into stunning staged spaces with AI. Professional virtual staging for real estate professionals."
}

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <ClerkProvider>
      <html lang="en" suppressHydrationWarning className={`${geistSans.variable} ${geistMono.variable} ${manrope.variable} ${futura.variable} font-manrope`}>
        <body
          className={cn(
            "min-h-screen bg-background font-sans antialiased",
            "dark"
          )}
        >
          <StateProviders>
          <ThemeProvider attribute="class" defaultTheme="light" enableSystem>
            <TooltipProvider>
              {children}
              <CheckoutRedirect />

              <TailwindIndicator />
              <Toaster />
            </TooltipProvider>
          </ThemeProvider>
          </StateProviders>
        </body>
      </html>
    </ClerkProvider>
  )
}
