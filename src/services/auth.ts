import { api } from '@/lib/http'
import type { Me, Message, TokenResponse, User } from '@/types/api'

export const authService = {
  register: (input: { email: string; password: string; full_name: string }) =>
    api<TokenResponse>('/auth/register', { method: 'POST', body: input, auth: false }),

  login: (input: { email: string; password: string }) =>
    api<TokenResponse>('/auth/login', { method: 'POST', body: input, auth: false }),

  logout: () => api<void>('/auth/logout', { method: 'POST', auth: false }),

  logoutAll: () => api<void>('/auth/logout-all', { method: 'POST' }),

  me: () => api<Me>('/auth/me'),

  updateProfile: (input: { full_name: string }) => api<User>('/auth/me', { method: 'PATCH', body: input }),

  verifyEmail: (token: string) =>
    api<User>('/auth/verify-email', { method: 'POST', body: { token }, auth: false }),

  resendVerification: () => api<Message>('/auth/resend-verification', { method: 'POST' }),

  forgotPassword: (email: string) =>
    api<Message>('/auth/forgot-password', { method: 'POST', body: { email }, auth: false }),

  resetPassword: (input: { token: string; password: string }) =>
    api<Message>('/auth/reset-password', { method: 'POST', body: input, auth: false }),

  changePassword: (input: { current_password: string; new_password: string }) =>
    api<Message>('/auth/change-password', { method: 'POST', body: input }),
}
