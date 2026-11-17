import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { RouterProvider } from 'react-router'
import { Toaster } from 'sonner'

import { AuthProvider } from '@/features/auth/AuthProvider'
import { ApiError } from '@/lib/http'
import { router } from '@/routes/router'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      refetchOnWindowFocus: false,
      // Retry network hiccups and server errors once; never retry a 4xx, which will not change.
      retry: (failureCount, error) =>
        failureCount < 1 && !(error instanceof ApiError && error.status < 500),
    },
  },
})

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <RouterProvider router={router} />
        <Toaster
          position="bottom-right"
          toastOptions={{
            style: {
              fontFamily: 'inherit',
              fontSize: '13px',
              borderRadius: '8px',
              border: '1px solid var(--border)',
              color: 'var(--foreground)',
              background: 'var(--card)',
            },
          }}
        />
      </AuthProvider>
    </QueryClientProvider>
  )
}
