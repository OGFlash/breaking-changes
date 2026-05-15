import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface AuthState {
  token: string | null
  expiresAt: string | null
  setToken: (token: string, expiresAt: string) => void
  logout: () => void
  isAuthenticated: () => boolean
}

export const useAuth = create<AuthState>()(
  persist(
    (set, get) => ({
      token: null,
      expiresAt: null,
      setToken: (token, expiresAt) => set({ token, expiresAt }),
      logout: () => set({ token: null, expiresAt: null }),
      isAuthenticated: () => {
        const { token, expiresAt } = get()
        if (!token || !expiresAt) return false
        return new Date(expiresAt) > new Date()
      },
    }),
    { name: 'bc-admin-auth' }
  )
)
