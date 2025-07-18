"use client"

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useSessionStore } from '@/lib/store/session-store'
import { Card, CardContent } from '@/components/ui/card'
import { Loader2 } from 'lucide-react'

export default function NewSessionPage() {
  const router = useRouter()
  const { resetCurrentSession, setCurrentStep } = useSessionStore()

  useEffect(() => {
    // Reset session and redirect to main dashboard
    const resetAndRedirect = async () => {
      try {
        console.log('🆕 [New Session] Resetting session and redirecting')
        resetCurrentSession()
        setCurrentStep('upload')
        
        // Short delay to ensure state is reset
        setTimeout(() => {
          router.replace('/dashboard')
        }, 100)
      } catch (error) {
        console.error('❌ [New Session] Error resetting session:', error)
        // Redirect anyway
        router.replace('/dashboard')
      }
    }

    resetAndRedirect()
  }, [resetCurrentSession, setCurrentStep, router])

  return (
    <div className="container mx-auto max-w-4xl py-8">
      <Card>
        <CardContent className="flex items-center justify-center p-8">
          <div className="text-center space-y-4">
            <Loader2 className="h-8 w-8 animate-spin mx-auto" />
            <p className="text-muted-foreground">Starting new session...</p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
} 