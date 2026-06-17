import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function getUserInitials(name?: string | null, email?: string | null): string {
  const trimmedName = name?.trim()
  if (trimmedName) {
    const parts = trimmedName.split(/\s+/).filter(Boolean)
    if (parts.length >= 2) {
      return `${parts[0][0]}${parts[1][0]}`.toUpperCase()
    }
    return trimmedName[0].toUpperCase()
  }

  const trimmedEmail = email?.trim()
  if (trimmedEmail) {
    return trimmedEmail[0].toUpperCase()
  }

  return 'U'
}
