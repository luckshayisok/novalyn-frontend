/**
 * HTTP client for the NOVALYN API.
 *
 * The access token lives in memory only. The refresh token is an httpOnly
 * cookie the browser sends to /auth/refresh; JavaScript never sees it. When a
 * request comes back 401, the client refreshes once and repeats the request.
 */

import type { TokenResponse } from '@/types/api'

const API_BASE: string = import.meta.env.VITE_API_URL ?? '/api/v1'

export interface FieldError {
  field: string
  message: string
}

export class ApiError extends Error {
  readonly status: number
  readonly code: string
  readonly details: unknown
  readonly requestId: string | null

  constructor(status: number, code: string, message: string, details: unknown, requestId: string | null) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.code = code
    this.details = details
    this.requestId = requestId
  }

  /** Per-field messages from a validation error, when the API sent them. */
  get fieldErrors(): FieldError[] {
    if (!Array.isArray(this.details)) return []
    return this.details.filter(
      (item): item is FieldError =>
        typeof item === 'object' && item !== null && 'field' in item && 'message' in item,
    )
  }
}

/** A readable message for any thrown value. */
export function errorMessage(error: unknown, fallback = 'Something went wrong. Try again.'): string {
  if (error instanceof ApiError) return error.message
  if (error instanceof TypeError) return 'Cannot reach the server. Check your connection and try again.'
  return fallback
}

let accessToken: string | null = null
let refreshInFlight: Promise<TokenResponse | null> | null = null
let onSessionExpired: (() => void) | null = null

export function setAccessToken(token: string | null): void {
  accessToken = token
}

export function hasAccessToken(): boolean {
  return accessToken !== null
}

export function setSessionExpiredHandler(handler: (() => void) | null): void {
  onSessionExpired = handler
}

async function send(path: string, init: RequestInit, withAuth: boolean): Promise<Response> {
  const headers = new Headers(init.headers)
  headers.set('X-Requested-With', 'XMLHttpRequest')
  headers.set('Accept', 'application/json')
  if (init.body !== undefined) headers.set('Content-Type', 'application/json')
  if (withAuth && accessToken) headers.set('Authorization', `Bearer ${accessToken}`)
  return fetch(`${API_BASE}${path}`, { ...init, headers, credentials: 'include' })
}

async function toApiError(response: Response): Promise<ApiError> {
  let code = 'http_error'
  let message = `The server answered with status ${response.status}.`
  let details: unknown = null
  let requestId: string | null = response.headers.get('X-Request-ID')
  try {
    const body: unknown = await response.json()
    if (typeof body === 'object' && body !== null && 'error' in body) {
      const error = (body as { error: Record<string, unknown> }).error
      if (typeof error.code === 'string') code = error.code
      if (typeof error.message === 'string') message = error.message
      details = error.details ?? null
      if (typeof error.request_id === 'string') requestId = error.request_id
    }
  } catch {
    // Not JSON (a proxy error page, for instance): keep the generic message.
  }
  return new ApiError(response.status, code, message, details, requestId)
}

/**
 * Exchange the refresh cookie for a new access token.
 * Concurrent callers share one request. Resolves to null when there is no valid session.
 */
export function refreshSession(): Promise<TokenResponse | null> {
  refreshInFlight ??= (async () => {
    try {
      const response = await send('/auth/refresh', { method: 'POST' }, false)
      if (!response.ok) {
        accessToken = null
        if (response.status === 401 || response.status === 403) return null
        throw await toApiError(response)
      }
      const session = (await response.json()) as TokenResponse
      accessToken = session.access_token
      return session
    } finally {
      refreshInFlight = null
    }
  })()
  return refreshInFlight
}

export interface RequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE'
  body?: unknown
  query?: Record<string, string | number | undefined | null>
  /** Send the access token and refresh on 401. Default true. */
  auth?: boolean
  signal?: AbortSignal
}

const REFRESHABLE_CODES = new Set(['invalid_token', 'not_authenticated', 'session_revoked'])

function withQuery(path: string, query?: RequestOptions['query']): string {
  if (!query) return path
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== null && value !== '') params.set(key, String(value))
  }
  const text = params.toString()
  return text ? `${path}?${text}` : path
}

/** Send a request; on an expired access token, refresh once and send it again. */
async function sendWithRefresh(url: string, init: RequestInit, auth: boolean): Promise<Response> {
  let response = await send(url, init, auth)
  if (response.status === 401 && auth) {
    const failure = await toApiError(response)
    if (!REFRESHABLE_CODES.has(failure.code)) throw failure
    const session = await refreshSession()
    if (!session) {
      onSessionExpired?.()
      throw failure
    }
    response = await send(url, init, auth)
  }
  if (!response.ok) throw await toApiError(response)
  return response
}

export async function api<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = 'GET', body, query, auth = true, signal } = options
  const init: RequestInit = { method, signal }
  if (body !== undefined) init.body = JSON.stringify(body)

  const response = await sendWithRefresh(withQuery(path, query), init, auth)
  if (response.status === 204) return undefined as T
  return (await response.json()) as T
}

/** Fetch a file the API generates (a report export) and hand it to the browser as a download. */
export async function downloadFile(path: string, query: RequestOptions['query'], fallbackName: string): Promise<void> {
  const response = await sendWithRefresh(withQuery(path, query), { method: 'GET' }, true)
  const disposition = response.headers.get('Content-Disposition') ?? ''
  const filename = /filename="([^"]+)"/.exec(disposition)?.[1] ?? fallbackName
  const url = URL.createObjectURL(await response.blob())
  try {
    const link = document.createElement('a')
    link.href = url
    link.download = filename
    document.body.append(link)
    link.click()
    link.remove()
  } finally {
    // Give the browser a moment to start the download before the URL is released.
    setTimeout(() => URL.revokeObjectURL(url), 10_000)
  }
}

function sendUpload(path: string, form: FormData, onProgress?: (fraction: number) => void): Promise<XMLHttpRequest> {
  return new Promise((resolve, reject) => {
    const request = new XMLHttpRequest()
    request.open('POST', `${API_BASE}${path}`)
    request.withCredentials = true
    request.setRequestHeader('X-Requested-With', 'XMLHttpRequest')
    request.setRequestHeader('Accept', 'application/json')
    if (accessToken) request.setRequestHeader('Authorization', `Bearer ${accessToken}`)
    request.upload.onprogress = (event) => {
      if (event.lengthComputable) onProgress?.(event.loaded / event.total)
    }
    request.onload = () => resolve(request)
    request.onerror = () => reject(new TypeError('Network request failed'))
    request.onabort = () => reject(new DOMException('Upload cancelled', 'AbortError'))
    request.send(form)
  })
}

function uploadError(request: XMLHttpRequest): ApiError {
  let code = 'http_error'
  let message = `The server answered with status ${request.status}.`
  let details: unknown = null
  let requestId = request.getResponseHeader('X-Request-ID')
  try {
    const body: unknown = JSON.parse(request.responseText)
    if (typeof body === 'object' && body !== null && 'error' in body) {
      const error = (body as { error: Record<string, unknown> }).error
      if (typeof error.code === 'string') code = error.code
      if (typeof error.message === 'string') message = error.message
      details = error.details ?? null
      if (typeof error.request_id === 'string') requestId = error.request_id
    }
  } catch {
    // Not JSON: keep the generic message.
  }
  return new ApiError(request.status, code, message, details, requestId)
}

/**
 * Send a multipart form (a file plus fields) and report progress.
 * `fetch` cannot report upload progress, so this uses XMLHttpRequest. Like
 * `api`, it refreshes the session once on 401 and repeats the upload.
 */
export async function upload<T>(
  path: string,
  form: FormData,
  onProgress?: (fraction: number) => void,
): Promise<T> {
  let request = await sendUpload(path, form, onProgress)
  if (request.status === 401) {
    const failure = uploadError(request)
    if (!REFRESHABLE_CODES.has(failure.code)) throw failure
    const session = await refreshSession()
    if (!session) {
      onSessionExpired?.()
      throw failure
    }
    request = await sendUpload(path, form, onProgress)
  }
  if (request.status < 200 || request.status >= 300) throw uploadError(request)
  return JSON.parse(request.responseText) as T
}
