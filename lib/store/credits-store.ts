// Credits Store - Professional Credit Management
import { create } from 'zustand'
import { devtools, persist } from 'zustand/middleware'
import { immer } from 'zustand/middleware/immer'
import { CreditsState, CreditTransaction } from './types'

// Credits store actions
interface CreditsActions {
  // Balance management
  setBalance: (balance: number) => void
  deductCredits: (amount: number, jobId?: string, description?: string) => void
  addCredits: (amount: number, description?: string) => void
  
  // Pending deductions management
  addPendingDeduction: (amount: number) => void
  confirmPendingDeduction: (amount: number) => void
  clearPendingDeductions: () => void
  
  // API sync methods - removed to prevent hydration issues
  
  // Transaction management
  addTransaction: (transaction: Omit<CreditTransaction, 'id' | 'createdAt'>) => void
  getTransactionHistory: () => CreditTransaction[]
  
  // Loading states
  setLoading: (loading: boolean) => void
  updateLastSyncTime: () => void
  
  // Reset and cleanup
  reset: () => void
}

export interface CreditsStore extends CreditsState, CreditsActions {}

// Initial state
const initialState: CreditsState = {
  balance: 0,
  transactions: [],
  isLoading: false,
  lastUpdated: null,
  pendingDeductions: 0
}

// Credits store implementation
export const useCreditsStore = create<CreditsStore>()(
  devtools(
    persist(
      immer((set, get) => ({
        ...initialState,

        // Balance management
        setBalance: (balance: number) => {
          set((state) => {
            state.balance = balance
            state.lastUpdated = new Date()
            state.isLoading = false
            // Clear pending deductions when server confirms balance
            state.pendingDeductions = 0
          })
        },

        // API sync methods removed to prevent hydration issues
        // Use external creditSync service instead

        deductCredits: (amount: number, jobId?: string, description = 'Credit deduction') => {
          const currentBalance = get().balance
          
          if (currentBalance < amount) {
            throw new Error('Insufficient credits')
          }

          set((state) => {
            state.balance -= amount
            state.lastUpdated = new Date()
            state.pendingDeductions += amount // Track as pending
            
            // Add transaction record
            const transaction: CreditTransaction = {
              id: `txn_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
              userId: '', // Will be set from auth context
              amount: -amount,
              type: 'debit',
              jobId,
              description,
              createdAt: new Date()
            }
            
            state.transactions.unshift(transaction)
            
            // Keep only last 100 transactions for performance
            if (state.transactions.length > 100) {
              state.transactions = state.transactions.slice(0, 100)
            }
          })
        },

        addCredits: (amount: number, description = 'Credit addition') => {
          set((state) => {
            state.balance += amount
            state.lastUpdated = new Date()
            
            // Add transaction record
            const transaction: CreditTransaction = {
              id: `txn_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
              userId: '', // Will be set from auth context
              amount,
              type: 'credit',
              description,
              createdAt: new Date()
            }
            
            state.transactions.unshift(transaction)
            
            // Keep only last 100 transactions for performance
            if (state.transactions.length > 100) {
              state.transactions = state.transactions.slice(0, 100)
            }
          })
        },

        // Pending deductions management
        addPendingDeduction: (amount: number) => {
          set((state) => {
            state.pendingDeductions += amount
          })
        },

        confirmPendingDeduction: (amount: number) => {
          set((state) => {
            state.pendingDeductions = Math.max(0, state.pendingDeductions - amount)
          })
        },

        clearPendingDeductions: () => {
          set((state) => {
            state.pendingDeductions = 0
          })
        },

        // Transaction management
        addTransaction: (transactionData) => {
          set((state) => {
            const transaction: CreditTransaction = {
              ...transactionData,
              id: `txn_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
              createdAt: new Date()
            }
            
            state.transactions.unshift(transaction)
            
            // Keep only last 100 transactions for performance
            if (state.transactions.length > 100) {
              state.transactions = state.transactions.slice(0, 100)
            }
          })
        },

        getTransactionHistory: () => {
          return get().transactions
        },

        // Loading states
        setLoading: (loading: boolean) => {
          set((state) => {
            state.isLoading = loading
          })
        },

        updateLastSyncTime: () => {
          set((state) => {
            state.lastUpdated = new Date()
          })
        },

        // Reset and cleanup
        reset: () => {
          set((state) => {
            Object.assign(state, initialState)
          })
        }
      })),
      {
        name: 'credits-store',
        partialize: (state) => ({
          balance: state.balance,
          transactions: state.transactions.slice(0, 50), // Persist only recent transactions
          lastUpdated: state.lastUpdated,
          pendingDeductions: state.pendingDeductions
        })
      }
    ),
    {
      name: 'credits-store'
    }
  )
)

// Selector hooks for optimized re-renders
export const useCreditsBalance = () => useCreditsStore((state) => state.balance)
export const useCreditsLoading = () => useCreditsStore((state) => state.isLoading)
export const useRecentTransactions = (limit = 10) => 
  useCreditsStore((state) => state.transactions.slice(0, limit))

// Computed selectors
export const useCanAfford = (amount: number) => 
  useCreditsStore((state) => state.balance >= amount)

// Fixed: Use individual selectors instead of creating new objects
export const useCreditsStatus = () => {
  const balance = useCreditsStore((state) => state.balance)
  const isLoading = useCreditsStore((state) => state.isLoading)
  const lastUpdated = useCreditsStore((state) => state.lastUpdated)
  
  return {
    balance,
    isLoading,
    lastUpdated,
    canAfford: (amount: number) => balance >= amount
  }
} 