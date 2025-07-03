'use client'

import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { Plus, Coins, TrendingUp, Clock, AlertCircle, RefreshCw, Loader2 } from 'lucide-react'
import { CREDIT_COSTS, CREDIT_BUNDLE } from '@/lib/constants'
import { useCreditsStore } from '@/lib/store/credits-store'
import { syncCredits } from '@/lib/sync-credits'
import { toast } from 'sonner'
import { useAuth } from '@clerk/nextjs'

interface SafeCreditsDisplayProps {
  showAddButton?: boolean
  compact?: boolean
  className?: string
}

export function SafeCreditsDisplay({ 
  showAddButton = true, 
  compact = false,
  className = ""
}: SafeCreditsDisplayProps) {
  const { isSignedIn } = useAuth()
  
  // 🔥 UNIFIED: Read directly from useCreditsStore (single source of truth)
  const { balance, setBalance, isLoading, setLoading, lastUpdated } = useCreditsStore()
  const [isMounted, setIsMounted] = useState(false)

  // Prevent hydration mismatch
  useEffect(() => {
    setIsMounted(true)
  }, [])

  // Initial load - sync with server  
  useEffect(() => {
    if (isMounted && isSignedIn) {
      syncCreditsWithServer()
    }
  }, [isMounted, isSignedIn])

  const syncCreditsWithServer = async () => {
    if (isLoading) return
    
    setLoading(true)
    try {
      const serverBalance = await syncCredits()
      setBalance(serverBalance)
    } catch (error) {
      console.error('[Safe Credits Display] Sync failed:', error)
    } finally {
      setLoading(false)
      }
    }

  const handleAddCredits = async (amount: number = 100) => {
    if (process.env.NODE_ENV !== 'development') {
      toast.error('Credit purchases are not implemented yet')
      return
    }

    if (isLoading || !isMounted) return

    setLoading(true)
    try {
      const response = await fetch('/api/dev/add-credits', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount }),
        credentials: 'include'
      })

      const data = await response.json()
      
      if (response.ok && isMounted) {
        setBalance(data.newBalance || 0)
        toast.success(`Added ${amount} credits! New balance: ${data.newBalance}`)
      } else {
        toast.error(data.error || 'Failed to add credits')
      }
    } catch (error) {
      console.error('Add credits error:', error)
      toast.error('Failed to add credits')
    } finally {
      if (isMounted) {
        setLoading(false)
      }
    }
  }

  const getBalanceColor = () => {
    if (balance >= 200) return 'text-green-600'
    if (balance >= 50) return 'text-yellow-600'
    return 'text-red-600'
  }

  const getBalanceIcon = () => {
    if (balance >= 200) return <TrendingUp className="h-4 w-4" />
    if (balance >= 50) return <Clock className="h-4 w-4" />
    return <AlertCircle className="h-4 w-4" />
  }

  // Don't render until mounted
  if (!isMounted || !isSignedIn) {
    return null
  }

  if (compact) {
    return (
      <div className={`flex items-center gap-2 ${className}`}>
        <Badge variant="secondary" className={`text-sm ${getBalanceColor()}`}>
          <Coins className="h-3 w-3 mr-1" />
          {isLoading ? '...' : balance} credits
        </Badge>
        {showAddButton && (
          <Button 
            onClick={() => handleAddCredits()} 
            variant="outline" 
            size="sm"
            disabled={isLoading}
            className="text-xs"
          >
            {isLoading ? (
              <Loader2 className="h-3 w-3 animate-spin mr-1" />
            ) : (
              <Plus className="h-3 w-3 mr-1" />
            )}
            Add Credits
          </Button>
        )}
      </div>
    )
  }

  return (
    <Card className={className}>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Coins className="h-5 w-5 text-blue-600" />
          Credit Balance
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {getBalanceIcon()}
            <span className={`text-2xl font-bold ${getBalanceColor()}`}>
              {isLoading ? (
                <div className="animate-pulse bg-gray-200 h-8 w-16 rounded" />
              ) : (
                balance
              )}
            </span>
            <span className="text-gray-500">credits</span>
          </div>
        </div>

        {lastUpdated && (
          <p className="text-xs text-gray-500">
            Last updated: {lastUpdated.toLocaleTimeString()}
          </p>
        )}

        <Separator />

        <div className="space-y-2 text-sm">
          <h4 className="font-medium">Credit Costs:</h4>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="flex justify-between">
              <span>Masking:</span>
              <span>{CREDIT_COSTS.MASK_AND_EMPTY}</span>
            </div>
            <div className="flex justify-between">
              <span>Staging:</span>
              <span>{CREDIT_COSTS.STAGING_VARIANT * 2}</span>
            </div>
          </div>
        </div>

        {showAddButton && (
          <div className="space-y-2">
            <Button 
              onClick={() => handleAddCredits(100)} 
              variant="outline" 
              size="sm"
              disabled={isLoading}
              className="w-full"
            >
              {isLoading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Adding...
                </>
              ) : (
                <>
                  <Plus className="h-4 w-4 mr-2" />
                  Add 100 Credits (Dev)
                </>
              )}
            </Button>
            
            {process.env.NODE_ENV === 'production' && (
              <Button 
                onClick={() => toast.info('Credit purchases coming soon!')}
                className="w-full"
                size="sm"
              >
                Buy {CREDIT_BUNDLE.AMOUNT} Credits - ${(CREDIT_BUNDLE.PRICE_CENTS / 100).toFixed(2)}
              </Button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
} 