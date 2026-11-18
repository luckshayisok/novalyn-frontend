import type { ComponentType } from 'react'
import { createBrowserRouter, Navigate } from 'react-router'

import { PageLoader } from '@/components/shared/states'
import { LoginPage } from '@/features/auth/LoginPage'
import type { Permission } from '@/types/api'

import {
  GuestOnly,
  IndexRedirect,
  NotFoundInApp,
  NotFoundPage,
  OrganizationLayout,
  RequireAuth,
  RequirePermission,
  RouteErrorPage,
  SessionAware,
} from './guards'
import { paths } from './paths'

/**
 * Load a page's code only when the page is first opened. Each feature becomes
 * its own file, so signing in does not download the charts, the calendar or
 * the reports.
 */
function page<K extends string>(
  load: () => Promise<{ [P in K]: ComponentType }>,
  name: K,
  permission?: Permission,
) {
  return async () => {
    const Component: ComponentType = (await load())[name]
    if (!permission) return { Component }
    return {
      element: (
        <RequirePermission permission={permission}>
          <Component />
        </RequirePermission>
      ),
    }
  }
}

export const router = createBrowserRouter([
  {
    errorElement: <RouteErrorPage />,
    hydrateFallbackElement: <PageLoader />,
    children: [
      { path: paths.home, element: <IndexRedirect /> },
      {
        element: <GuestOnly />,
        children: [
          // The sign-in page is the most common first screen; it stays in the main file.
          { path: paths.login, element: <LoginPage /> },
          { path: paths.register, lazy: page(() => import('@/features/auth/RegisterPage'), 'RegisterPage') },
          {
            path: paths.forgotPassword,
            lazy: page(() => import('@/features/auth/PasswordPages'), 'ForgotPasswordPage'),
          },
        ],
      },
      {
        element: <SessionAware />,
        children: [
          {
            path: paths.resetPassword,
            lazy: page(() => import('@/features/auth/PasswordPages'), 'ResetPasswordPage'),
          },
          { path: paths.verifyEmail, lazy: page(() => import('@/features/auth/VerifyEmail'), 'VerifyEmailPage') },
          { path: '/invite/:token', lazy: page(() => import('@/features/auth/AcceptInvitePage'), 'AcceptInvitePage') },
        ],
      },
      {
        element: <RequireAuth />,
        children: [
          { path: paths.onboarding, lazy: page(() => import('@/features/onboarding/OnboardingPage'), 'OnboardingPage') },
          {
            path: '/o/:orgSlug',
            element: <OrganizationLayout />,
            children: [
              { index: true, element: <Navigate to="overview" replace /> },
              { path: 'overview', lazy: page(() => import('@/features/dashboard/OverviewPage'), 'OverviewPage') },
              { path: 'documents', lazy: page(() => import('@/features/documents/DocumentsPage'), 'DocumentsPage') },
              { path: 'documents/upload', lazy: page(() => import('@/features/documents/UploadPage'), 'UploadPage') },
              {
                path: 'documents/:documentId',
                lazy: page(() => import('@/features/documents/DocumentDetailPage'), 'DocumentDetailPage'),
              },
              { path: 'renewals', lazy: page(() => import('@/features/renewals/RenewalsPage'), 'RenewalsPage') },
              {
                path: 'renewals/:renewalId',
                lazy: page(() => import('@/features/renewals/RenewalDetailPage'), 'RenewalDetailPage'),
              },
              { path: 'entities', lazy: page(() => import('@/features/entities/EntitiesPage'), 'EntitiesPage') },
              {
                path: 'entities/:entityId',
                lazy: page(() => import('@/features/entities/EntityDetailPage'), 'EntityDetailPage'),
              },
              { path: 'calendar', lazy: page(() => import('@/features/calendar/CalendarPage'), 'CalendarPage') },
              {
                path: 'reports',
                lazy: page(() => import('@/features/reports/ReportsPage'), 'ReportsPage', 'reports:read'),
              },
              { path: 'billing', lazy: page(() => import('@/features/billing/BillingPage'), 'BillingPage') },
              { path: 'team', lazy: page(() => import('@/features/team/TeamPage'), 'TeamPage') },
              {
                path: 'audit-log',
                lazy: page(() => import('@/features/audit/AuditLogPage'), 'AuditLogPage', 'audit:read'),
              },
              {
                path: 'settings',
                lazy: page(() => import('@/features/settings/OrganizationSettingsPage'), 'OrganizationSettingsPage'),
              },
              {
                path: 'account',
                lazy: page(() => import('@/features/settings/AccountSettingsPage'), 'AccountSettingsPage'),
              },
              { path: '*', element: <NotFoundInApp /> },
            ],
          },
        ],
      },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
])
