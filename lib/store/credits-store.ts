// Credits Store - Professional Credit Management
import { create } from 'zustand'
import { devtools } from 'zustand/middleware'
import { immer } from 'zustand/middleware/immer'
import { createAuthAwarePersist } from './middleware/auth-aware-persistence'
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
  
  // Transaction management
  addTransaction: (transaction: Omit<CreditTransaction, 'id' | 'createdAt'>) => void
  getTransactionHistory: () => CreditTransaction[]
  
  // Loading states
  setLoading: (loading: boolean) => void
  updateLastSyncTime: () => void
  
  // Reset and cleanup
  reset: () => void
}

type CreditsStore = CreditsState & CreditsActions & {
  _currentUserId?: string | null
}

// Initial state
const initialState: CreditsState & { _currentUserId?: string | null } = {
  _currentUserId: null,
  balance: 0,
  pendingDeductions: 0,
  transactions: [],
  isLoading: false,
  lastUpdated: null
}

const authAwarePersist = createAuthAwarePersist<CreditsStore>({
  name: 'credits-store',
  partialize: (state) => ({
    balance: state.balance,
    transactions: state.transactions.slice(0, 50), // Persist only recent transactions
    lastUpdated: state.lastUpdated,
    pendingDeductions: state.pendingDeductions
  }),
})

export const useCreditsStore = create<CreditsStore>()(
  devtools(
    authAwarePersist(
      immer((set, get) => ({
        ...initialState,

        // Balance management
        setBalance: (balance: number) => {
          set((state) => {
            state.balance = balance
            state.lastUpdated = new Date()
          })
        },

        deductCredits: (amount: number, jobId?: string, description?: string) => {
          set((state) => {
            const previousBalance = state.balance
            state.balance = Math.max(0, state.balance - amount)
            
            // Add transaction record
            const transaction: CreditTransaction = {
              id: `txn_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
              amount: -amount,
              type: 'debit',
              description: description || `Credits used${jobId ? ` for job ${jobId}` : ''}`,
              jobId,
              createdAt: new Date()
            }
            
            state.transactions.unshift(transaction)
            state.lastUpdated = new Date()
            
            // Keep only last 100 transactions
            if (state.transactions.length > 100) {
              state.transactions = state.transactions.slice(0, 100)
            }
          })
        },

        addCredits: (amount: number, description?: string) => {
          set((state) => {
            state.balance += amount
            
            // Add transaction record
            const transaction: CreditTransaction = {
              id: `txn_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
              amount,
              type: 'purchase',
              description: description || 'Credits purchased',
              createdAt: new Date()
            }
            
            state.transactions.unshift(transaction)
            state.lastUpdated = new Date()
            
            // Keep only last 100 transactions
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
    ),
    {
      name: 'credits-store'
    }
  )
)

// Selectors for easy state access
export const useCreditsBalance = () => useCreditsStore((state) => state.balance)
export const usePendingDeductions = () => useCreditsStore((state) => state.pendingDeductions)
export const useCreditsLoading = () => useCreditsStore((state) => state.isLoading)
export const useCreditsTransactions = () => useCreditsStore((state) => state.transactions)
export const useCreditsLastUpdated = () => useCreditsStore((state) => state.lastUpdated)

// Computed selectors
export const useAvailableCredits = () => useCreditsStore((state) => 
  Math.max(0, state.balance - state.pendingDeductions)
)

export const useCanAfford = (amount: number) => useCreditsStore((state) => 
  (state.balance - state.pendingDeductions) >= amount
) 