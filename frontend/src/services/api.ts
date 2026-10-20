import type { ApiResponse, CsrfResponse, ValidationError } from '../types/api'

const BASE_URL = import.meta.env.VITE_API_BASE_URL ?? '/api'

export class ApiError extends Error {
  status: number
  errors?: ValidationError[]

  constructor(status: number, message: string, errors?: ValidationError[]) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.errors = errors
  }
}

async function fetchResponse(
  path: string,
  options: RequestInit,
  timeoutMs = 15000,
): Promise<Response> {
  try {
    return await fetch(`${BASE_URL}${path}`, {
      ...options,
      credentials: 'include',
      signal: AbortSignal.timeout(timeoutMs),
    })
  } catch {
    throw new ApiError(0, 'Không thể kết nối máy chủ. Vui lòng thử lại.')
  }
}

async function readResponse<T>(response: Response, path: string): Promise<T> {
  if (!response.ok) {
    const error = await response.json().catch(() => ({}))
    if (response.status === 401 && path !== '/auth/login' && path !== '/auth/me') {
      window.dispatchEvent(new Event('lumi-session-expired'))
    }
    throw new ApiError(
      response.status,
      error.message ?? 'Có lỗi xảy ra. Vui lòng thử lại.',
      error.errors,
    )
  }
  if (response.status === 204) return undefined as T
  return response.json() as Promise<T>
}

async function request<T>(
  method: string,
  path: string,
  body?: unknown,
  timeoutMs?: number,
): Promise<ApiResponse<T>> {
  const headers = new Headers()
  const isFormData = body instanceof FormData
  if (body !== undefined && !isFormData) headers.set('Content-Type', 'application/json')
  if (!['GET', 'HEAD', 'OPTIONS'].includes(method)) {
    const csrf = await readResponse<ApiResponse<CsrfResponse>>(
      await fetchResponse('/auth/csrf', { method: 'GET' }),
      '/auth/csrf',
    )
    headers.set(csrf.data.headerName, csrf.data.token)
  }
  const response = await fetchResponse(
    path,
    {
      method,
      headers,
      body: body === undefined ? undefined : isFormData ? body : JSON.stringify(body),
    },
    timeoutMs,
  )
  return readResponse<ApiResponse<T>>(response, path)
}

export function get<T>(path: string): Promise<ApiResponse<T>> {
  return request<T>('GET', path)
}

export function post<T>(
  path: string,
  body?: unknown,
  options?: { timeoutMs?: number },
): Promise<ApiResponse<T>> {
  return request<T>('POST', path, body, options?.timeoutMs)
}

export function put<T>(path: string, body?: unknown): Promise<ApiResponse<T>> {
  return request<T>('PUT', path, body)
}

export function del<T = void>(path: string): Promise<ApiResponse<T>> {
  return request<T>('DELETE', path)
}

export function upload<T>(
  path: string,
  formData: FormData,
  options?: { timeoutMs?: number },
): Promise<ApiResponse<T>> {
  return request<T>('POST', path, formData, options?.timeoutMs ?? 65000)
}
