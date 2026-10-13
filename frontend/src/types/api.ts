/* ============================================================
 *  API Response Types — Lumi Studio
 *  Các wrapper type cho response từ Spring Boot backend.
 * ============================================================ */

import type { User } from './domain'

/** Response chung cho mọi endpoint. */
export type ApiResponse<T> = {
  success: boolean
  data: T
  message: string
  timestamp: string
}

/** Response phân trang (Spring Data Page). */
export type PaginatedResponse<T> = {
  content: T[]
  page: number
  size: number
  totalElements: number
  totalPages: number
  first: boolean
  last: boolean
}

/** Response đăng nhập. */
export type AuthResponse = {
  message: string
  user: User
}

export type LoginRequest = {
  email: string
  password: string
}

export type CsrfResponse = {
  headerName: string
  token: string
}

/** Lỗi validation từ backend. */
export type ValidationError = {
  field: string
  message: string
}

/** Response lỗi chung. */
export type ErrorResponse = {
  status: number
  message: string
  errors?: ValidationError[]
  timestamp: string
}
