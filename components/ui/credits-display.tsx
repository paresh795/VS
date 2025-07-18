'use client'

import React, { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Coins, Plus, Loader2, RefreshCw } from 'lucide-react'
import { useAuth } from '@clerk/nextjs'
import { useCreditsStore } from '@/lib/store/credits-store'
import { syncCredits } from '@/lib/sync-credits'
import { toast } from 'sonner'

interface CreditsDisplayProps {
  variant?: 'compact' | 'full'
  className?: string
  showAddButton?: boolean
  onCreditsUpdate?: (newBalance: number) => void
}

export function CreditsDisplay({ 
  variant = 'full', 
  className = '',
  showAddButton = true,
  onCreditsUpdate
}: CreditsDisplayProps) {
  const { isSignedIn } = useAuth()
  
  // 🔥 UNIFIED: Read directly from useCreditsStore (single source of truth)
  const { balance, setBalance, isLoading, setLoading, lastUpdated } = useCreditsStore()
  const [isMounted, setIsMounted] = useState(false)

  // Prevent hydration mismatch
  useEffect(() => {
    setIsMounted(true)
  }, [])

  // Notify parent of balance changes
  useEffect(() => {
    if (isMounted && onCreditsUpdate) {
      onCreditsUpdate(balance)
    }
  }, [balance, isMounted, onCreditsUpdate])

  // Initial load - sync with server (with auth timing protection)
  useEffect(() => {
    if (isMounted && isSignedIn) {
      // Add a small delay to ensure authentication state is fully propagated
      const timer = setTimeout(() => {
        syncCreditsWithServer()
      }, 500) // 500ms delay to ensure auth is ready
      
      return () => clearTimeout(timer)
    }
  }, [isMounted, isSignedIn])

  const syncCreditsWithServer = async (retryCount = 0) => {
    if (isLoading) return
    
    setLoading(true)
    let caughtError: any = null
    
    try {
      const serverBalance = await syncCredits()
      setBalance(serverBalance)
    } catch (error: any) {
      caughtError = error
      console.error('[Credits Display] Sync failed:', error)
      
      // If it's a 401 error and we haven't retried too many times, retry with backoff
      if (error?.message?.includes('401') && retryCount < 3) {
        console.log(`[Credits Display] Retrying after 401 error (attempt ${retryCount + 1}/3)`)
        setLoading(false) // Reset loading state for retry
        
        // Exponential backoff: 1s, 2s, 4s
        const retryDelay = Math.pow(2, retryCount) * 1000
        setTimeout(() => {
          syncCreditsWithServer(retryCount + 1)
        }, retryDelay)
        return
      }
      
      // Only show toast for non-auth errors or after all retries failed
      if (!error?.message?.includes('401') || retryCount >= 3) {
        toast.error('Failed to sync credits')
      }
    } finally {
      if (retryCount === 0 || !caughtError?.message?.includes('401')) {
        setLoading(false)
      }
    }
  }

  const handleManualRefresh = () => {
    syncCreditsWithServer()
  }

  // Development add credits
  const handleAddCredits = async (amount: number = 100) => {
    if (!isSignedIn || isLoading) return
    
    setLoading(true)
    try {
      const response = await fetch('/api/dev/add-credits', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount }),
        credentials: 'include'
      })
      
      if (response.ok) {
        const data = await response.json()
        setBalance(data.newBalance || 0)
        toast.success(`Added ${amount} credits! New balance: ${data.newBalance}`)
      } else {
        const errorData = await response.json()
        toast.error(errorData.error || 'Failed to add credits')
      }
    } catch (error) {
      console.error('[Credits Display] Add credits failed:', error)
      toast.error('Failed to add credits')
    } finally {
      setLoading(false)
    }
  }

  // Don't render until mounted
  if (!isMounted || !isSignedIn) {
    return null
  }

  if (variant === 'compact') {
    return (
      <div className={`flex items-center gap-2 ${className}`}>
        <Badge variant="secondary" className="flex items-center gap-1">
          <Coins className="h-3 w-3 text-yellow-500" />
          {isLoading ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : (
            <span className="font-medium">{balance.toLocaleString()}</span>
          )}
        </Badge>
        
        <div className="flex items-center gap-1">
          {showAddButton && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => handleAddCredits(100)}
              disabled={isLoading}
              className="h-6 px-2 text-xs"
            >
              <Plus className="h-3 w-3" />
            </Button>
          )}
          
          <Button
            size="sm"
            variant="ghost"
            onClick={handleManualRefresh}
            disabled={isLoading}
            className="h-6 px-1 text-xs"
            title="Refresh credits"
          >
            <RefreshCw className="h-3 w-3" />
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className={`rounded-lg border bg-card p-4 ${className}`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <Coins className="h-5 w-5 text-yellow-500" />
            <div>
              <div className="text-sm font-medium text-muted-foreground">Credits Balance</div>
              <div className="text-2xl font-bold">
                {isLoading ? (
                  <Loader2 className="h-6 w-6 animate-spin" />
                ) : (
                  balance.toLocaleString()
                )}
              </div>
              {lastUpdated && (
                <div className="text-xs text-muted-foreground">
                  Last updated: {lastUpdated.toLocaleTimeString()}
                </div>
              )}
            </div>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={handleManualRefresh}
            disabled={isLoading}
          >
            <RefreshCw className="h-4 w-4 mr-1" />
            Refresh
          </Button>
          
          {showAddButton && (
            <Button
              size="sm"
              onClick={() => handleAddCredits(100)}
              disabled={isLoading}
            >
              <Plus className="h-4 w-4 mr-1" />
              Add Credits
            </Button>
          )}
        </div>
      </div>
    </div>
  )
} 