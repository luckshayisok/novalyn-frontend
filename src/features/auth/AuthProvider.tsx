import { useQuery, useQueryClient } from '@tanstack/react-query'
import { createContext, useCallback, useContext, useEffect, useMemo, type ReactNode } from 'react'

import { refreshSession, setAccessToken, setSessionExpiredHandler } from '@/lib/http'
import { authService } from '@/services/auth'
import { queryKeys } from '@/services/organizations'
import type { Me, Organization, TokenResponse, User } from '@/types/api'

type AuthStatus = 'loading' | 'authenticated' | 'unauthenticated'

interface AuthContextValue {
  status: AuthStatus
  user: User | null
  organizations: Organization[]
  /** Set when the session could not be checked (server unreachable), as opposed to "not signed in". */
  bootstrapError: unknown
  login: (input: { email: string; password: string }) => Promise<Me>
  register: (input: { email: string; password: string; full_name: string }) => Promise<Me>
  logout: () => Promise<void>
  /** Re-read the user and organizations from the server. */
  reload: () => Promise<Me | null>
  retryBootstrap: () => void
}

const AuthContext = createContext<AuthContextValue | null>(null)

/** Restore the session from the refresh cookie, then load the user. Null when signed out. */
async function loadSession(): Promise<Me | null> {
  const session = await refreshSession()
  if (!session) return null
  return authService.me()
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient()

  const sessionQuery = useQuery({
    queryKey: queryKeys.session,
    queryFn: loadSession,
    staleTime: Infinity,
    gcTime: Infinity,
    retry: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  })

  // When a request finds the session gone and refresh fails, drop to signed-out.
  useEffect(() => {
    setSessionExpiredHandler(() => {
      setAccessToken(null)
      queryClient.setQueryData(queryKeys.session, null)
    })
    return () => setSessionExpiredHandler(null)
  }, [queryClient])

  const establish = useCallback(
    async (session: TokenResponse): Promise<Me> => {
      setAccessToken(session.access_token)
      const me = await authService.me()
      queryClient.setQueryData(queryKeys.session, me)
      return me
    },
    [queryClient],
  )

  const login = useCallback<AuthContextValue['login']>(
    async (input) => establish(await authService.login(input)),
    [establish],
  )

  const register = useCallback<AuthContextValue['register']>(
    async (input) => establish(await authService.register(input)),
    [establish],
  )

  const logout = useCallback(async () => {
    try {
      await authService.logout()
    } finally {
      // Even if the request failed, forget the session on this device.
      setAccessToken(null)
      queryClient.setQueryData(queryKeys.session, null)
      queryClient.removeQueries({ predicate: (query) => query.queryKey[0] !== queryKeys.session[0] })
    }
  }, [queryClient])

  const reload = useCallback(async () => {
    const me = await authService.me()
    queryClient.setQueryData(queryKeys.session, me)
    return me
  }, [queryClient])

  const retryBootstrap = useCallback(() => {
    void sessionQuery.refetch()
  }, [sessionQuery])

  const value = useMemo<AuthContextValue>(() => {
    const me = sessionQuery.data ?? null
    const status: AuthStatus =
      sessionQuery.isPending || (sessionQuery.isError && sessionQuery.isFetching)
        ? 'loading'
        : me
          ? 'authenticated'
          : 'unauthenticated'
    return {
      status,
      user: me?.user ?? null,
      organizations: me?.organizations ?? [],
      bootstrapError: sessionQuery.isError ? sessionQuery.error : null,
      login,
      register,
      logout,
      reload,
      retryBootstrap,
    }
  }, [
    sessionQuery.data,
    sessionQuery.isPending,
    sessionQuery.isError,
    sessionQuery.isFetching,
    sessionQuery.error,
    login,
    register,
    logout,
    reload,
    retryBootstrap,
  ])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth must be used inside AuthProvider')
  return context
}

/** The signed-in user. Use only under a route that requires authentication. */
export function useCurrentUser(): User {
  const { user } = useAuth()
  if (!user) throw new Error('useCurrentUser used outside an authenticated route')
  return user
}
