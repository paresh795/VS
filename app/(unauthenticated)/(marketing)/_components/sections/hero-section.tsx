"use client"

import { Button } from "@/components/ui/button"
import { motion } from "framer-motion"
import { ArrowRight, Sparkles } from "lucide-react"
import Link from "next/link"
import { useState } from "react"
import { SectionWrapper } from "./section-wrapper"

export function HeroSection() {
  const [sparkleHovered, setSparkleHovered] = useState(false)
  return (
    <SectionWrapper className="py-16 sm:py-32">
      {/* Animated gradient background */}

      <div className="mx-auto max-w-3xl text-center">
        <motion.div
          className="mb-8 flex justify-center"
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <div className="group ring-border hover:bg-accent hover:text-accent-foreground relative inline-flex items-center rounded-full px-3 py-1 text-xs leading-6 shadow-sm ring-1 transition-colors sm:text-sm">
            <span className="mr-2 inline-block">🏠</span>
            <span className="inline">AI-Powered Virtual Staging</span>
            <ArrowRight className="ml-2 h-4 w-4" />
          </div>
        </motion.div>

        <motion.h1
          className="text-foreground text-5xl font-bold tracking-tight sm:text-6xl lg:text-7xl"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.1 }}
        >
          Transform Empty Rooms into
          <motion.span
            className="from-brand-primary to-brand-secondary block bg-gradient-to-r bg-clip-text pb-2 leading-tight text-transparent"
            animate={{
              backgroundPosition: ["0% 50%", "100% 50%", "0% 50%"]
            }}
            transition={{
              duration: 5,
              ease: "linear",
              repeat: Infinity
            }}
            style={{
              backgroundSize: "200% 200%"
            }}
          >
            Stunning Spaces
          </motion.span>
        </motion.h1>
        <motion.p
          className="mx-auto mt-4 max-w-2xl text-base leading-7 sm:text-lg sm:leading-8"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
        >
          Professional virtual staging powered by AI. Upload empty room photos and get beautifully furnished spaces in minutes. Perfect for real estate professionals.
        </motion.p>
        <motion.div
          className="mt-8 flex flex-col items-center justify-center gap-4 sm:flex-row sm:gap-x-6"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.3 }}
        >
          <motion.div
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className="w-full sm:w-auto"
          >
            <Button
              size="lg"
              asChild
              className="group relative w-full overflow-hidden sm:w-auto"
            >
              <Link href="/signup">
                <motion.span
                  className="absolute inset-0 -skew-x-12 bg-gradient-to-r from-transparent via-white/20 to-transparent"
                  initial={{ x: "-200%" }}
                  whileHover={{ x: "200%" }}
                  transition={{ duration: 0.6 }}
                />
                Start Staging
                <motion.div
                  className="ml-2 inline-block"
                  initial={{ x: 0 }}
                  whileHover={{ x: 4 }}
                  transition={{ type: "spring", stiffness: 400, damping: 17 }}
                >
                  <ArrowRight className="h-4 w-4" />
                </motion.div>
              </Link>
            </Button>
          </motion.div>
          <motion.div
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className="w-full sm:w-auto"
          >
            <Button
              variant="outline"
              size="lg"
              asChild
              className="group w-full sm:w-auto"
              onMouseEnter={() => setSparkleHovered(true)}
              onMouseLeave={() => setSparkleHovered(false)}
            >
              <Link href="/features">
                See Examples
                <motion.div
                  className="ml-2 inline-block"
                  whileHover={{ rotate: 12 }}
                  transition={{ type: "spring", stiffness: 400, damping: 17 }}
                >
                  <Sparkles
                    className={`h-4 w-4 transition-colors ${sparkleHovered ? "text-brand-accent" : ""}`}
                    fill="currentColor"
                    stroke="currentColor"
                  />
                </motion.div>
              </Link>
            </Button>
          </motion.div>
        </motion.div>

        {/* Trust indicators */}
        <motion.div
          className="mt-8 flex flex-col items-center justify-center gap-4 sm:mt-10 sm:flex-row sm:gap-8"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6, delay: 0.6 }}
        >
          {["AI-Powered", "Professional Quality", "Minutes Not Hours"].map(
            (text, i) => (
              <motion.div
                key={text}
                className="flex w-full items-center justify-center gap-2 sm:w-auto"
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.4, delay: 0.7 + i * 0.1 }}
              >
                <motion.span
                  className="text-brand-primary"
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{
                    type: "spring",
                    stiffness: 500,
                    damping: 15,
                    delay: 0.8 + i * 0.1
                  }}
                >
                  ✓
                </motion.span>
                <span>{text}</span>
              </motion.div>
            )
          )}
        </motion.div>
      </div>
    </SectionWrapper>
  )
}
