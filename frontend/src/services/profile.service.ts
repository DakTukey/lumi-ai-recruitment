import { get, post, put } from './api'
import type { OnboardingStatus } from '../types/domain'

export type Profile = {
  userId: string
  fullName: string
  email: string
  phone: string | null
  location: string | null
  desiredPosition: string | null
  skills: string | null
  experienceYears: number | null
  onboardingStatus: OnboardingStatus
  onboardingStep: number
  employmentTypes: string[]
  workModes: string[]
  preferredLocations: string[]
  experienceRange: string | null
  positionUndecided: boolean
  updatedAt: string
}
export type ProfileInput = Pick<
  Profile,
  | 'fullName'
  | 'phone'
  | 'location'
  | 'desiredPosition'
  | 'skills'
  | 'experienceYears'
  | 'employmentTypes'
  | 'workModes'
  | 'preferredLocations'
  | 'experienceRange'
  | 'positionUndecided'
>
export const getProfile = async () => (await get<Profile>('/candidate/profile')).data
export const saveProfile = async (input: ProfileInput) =>
  (await put<Profile>('/candidate/profile', input)).data
export const saveStep = async (step: number, input: ProfileInput) =>
  (await post<Profile>(`/candidate/onboarding/steps/${step}`, input)).data
export const skipOnboarding = async () => (await post<Profile>('/candidate/onboarding/skip')).data

export type PreferenceOptions = {
  employmentTypes: string[]
  workModes: string[]
  locations: string[]
  positions: string[]
  skills: string[]
}
export const getPreferenceOptions = async () =>
  (await get<PreferenceOptions>('/candidate/profile/options')).data
