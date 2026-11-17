import { createBrowserRouter, Navigate } from 'react-router'

import { AuditLogPage } from '@/features/audit/AuditLogPage'
import { DocumentDetailPage } from '@/features/documents/DocumentDetailPage'
import { DocumentsPage } from '@/features/documents/DocumentsPage'
import { UploadPage } from '@/features/documents/UploadPage'
import { EntitiesPage } from '@/features/entities/EntitiesPage'
import { EntityDetailPage } from '@/features/entities/EntityDetailPage'
import { RenewalDetailPage } from '@/features/renewals/RenewalDetailPage'
import { RenewalsPage } from '@/features/renewals/RenewalsPage'
import { AcceptInvitePage } from '@/features/auth/AcceptInvitePage'
import { LoginPage } from '@/features/auth/LoginPage'
import { ForgotPasswordPage, ResetPasswordPage } from '@/features/auth/PasswordPages'
import { RegisterPage } from '@/features/auth/RegisterPage'
import { VerifyEmailPage } from '@/features/auth/VerifyEmail'
import { OverviewPage } from '@/features/dashboard/OverviewPage'
import { OnboardingPage } from '@/features/onboarding/OnboardingPage'
import { AccountSettingsPage } from '@/features/settings/AccountSettingsPage'
import { OrganizationSettingsPage } from '@/features/settings/OrganizationSettingsPage'
import { TeamPage } from '@/features/team/TeamPage'

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

export const router = createBrowserRouter([
  {
    errorElement: <RouteErrorPage />,
    children: [
      { path: paths.home, element: <IndexRedirect /> },
      {
        element: <GuestOnly />,
        children: [
          { path: paths.login, element: <LoginPage /> },
          { path: paths.register, element: <RegisterPage /> },
          { path: paths.forgotPassword, element: <ForgotPasswordPage /> },
        ],
      },
      {
        element: <SessionAware />,
        children: [
          { path: paths.resetPassword, element: <ResetPasswordPage /> },
          { path: paths.verifyEmail, element: <VerifyEmailPage /> },
          { path: '/invite/:token', element: <AcceptInvitePage /> },
        ],
      },
      {
        element: <RequireAuth />,
        children: [
          { path: paths.onboarding, element: <OnboardingPage /> },
          {
            path: '/o/:orgSlug',
            element: <OrganizationLayout />,
            children: [
              { index: true, element: <Navigate to="overview" replace /> },
              { path: 'overview', element: <OverviewPage /> },
              { path: 'documents', element: <DocumentsPage /> },
              { path: 'documents/upload', element: <UploadPage /> },
              { path: 'documents/:documentId', element: <DocumentDetailPage /> },
              { path: 'renewals', element: <RenewalsPage /> },
              { path: 'renewals/:renewalId', element: <RenewalDetailPage /> },
              { path: 'entities', element: <EntitiesPage /> },
              { path: 'entities/:entityId', element: <EntityDetailPage /> },
              { path: 'team', element: <TeamPage /> },
              {
                path: 'audit-log',
                element: (
                  <RequirePermission permission="audit:read">
                    <AuditLogPage />
                  </RequirePermission>
                ),
              },
              { path: 'settings', element: <OrganizationSettingsPage /> },
              { path: 'account', element: <AccountSettingsPage /> },
              { path: '*', element: <NotFoundInApp /> },
            ],
          },
        ],
      },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
])
