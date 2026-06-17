'use client'

import { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import {
  beWebApi,
  clearAccessToken,
  getAccessToken,
  mapAuthUser,
  setAccessToken,
} from '@/features/game-library/services/be-web'
import { User } from '@/types/app'

interface AuthContextType {
  user: User | null
  loading: boolean
  signUp: (email: string, password: string, name: string) => Promise<void>
  signIn: (email: string, password: string) => Promise<void>
  signOut: () => Promise<void>
  updateProfile: (name: string) => Promise<void>
  changePassword: (currentPassword: string, newPassword: string) => Promise<void>
  uploadAvatar: (file: File) => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const token = getAccessToken()
    if (!token) {
      setLoading(false)
      return
    }

    beWebApi
      .me()
      .then((currentUser) => {
        setUser(mapAuthUser(currentUser))
      })
      .catch(() => {
        clearAccessToken()
        setUser(null)
      })
      .finally(() => {
        setLoading(false)
      })
  }, [])

  const signUp = async (email: string, password: string, name: string) => {
    setLoading(true)
    try {
      const response = await beWebApi.signUp({ name, email, password })
      setAccessToken(response.accessToken)
      setUser(mapAuthUser(response.user))
    } finally {
      setLoading(false)
    }
  }

  const signIn = async (email: string, password: string) => {
    setLoading(true)
    try {
      const response = await beWebApi.signIn({ email, password })
      setAccessToken(response.accessToken)
      setUser(mapAuthUser(response.user))
    } finally {
      setLoading(false)
    }
  }

  const signOut = async () => {
    try {
      if (getAccessToken()) {
        await beWebApi.signOut()
      }
    } catch {
      // Frontend token removal is the effective signout in V1.
    } finally {
      clearAccessToken()
      setUser(null)
    }
  }

  const updateProfile = async (name: string) => {
    const updatedUser = await beWebApi.updateMe({ name })
    setUser(mapAuthUser(updatedUser))
  }

  const changePassword = async (currentPassword: string, newPassword: string) => {
    await beWebApi.changePassword({ currentPassword, newPassword })
  }

  const uploadAvatar = async (file: File) => {
    const updatedUser = await beWebApi.uploadAvatar(file)
    setUser(mapAuthUser(updatedUser))
  }

  return (
    <AuthContext.Provider
      value={{ user, loading, signUp, signIn, signOut, updateProfile, changePassword, uploadAvatar }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider')
  }
  return context
}
