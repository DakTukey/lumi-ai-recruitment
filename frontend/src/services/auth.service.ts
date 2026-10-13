import type { AuthResponse, LoginRequest } from '../types/api'
import type { User } from '../types/domain'
import { get, post } from './api'

export async function login(request: LoginRequest): Promise<AuthResponse> {
  const response = await post<AuthResponse>('/auth/login', request)
  return response.data
}

export async function register(
  email: string,
  password: string,
  fullName: string,
): Promise<AuthResponse> {
  const response = await post<AuthResponse>('/auth/register', { email, password, fullName })
  return response.data
}

export async function getMe(): Promise<User> {
  const response = await get<User>('/auth/me')
  return response.data
}

export async function logout(): Promise<void> {
  await post<void>('/auth/logout')
}
