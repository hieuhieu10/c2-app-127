'use client'

import { ChangeEvent, FormEvent, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { DashboardHeader } from '@/components/layout/dashboard-header'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Spinner } from '@/components/ui/spinner'
import { UserAvatar } from '@/components/ui/user-avatar'
import { useAuth } from '@/features/auth/auth-context'

export default function AccountPage() {
  const router = useRouter()
  const { user, loading, updateProfile, changePassword, uploadAvatar } = useAuth()
  const [name, setName] = useState('')
  const [profileError, setProfileError] = useState<string | null>(null)
  const [profileSuccess, setProfileSuccess] = useState<string | null>(null)
  const [profileSaving, setProfileSaving] = useState(false)
  const [avatarFile, setAvatarFile] = useState<File | null>(null)
  const [avatarError, setAvatarError] = useState<string | null>(null)
  const [avatarSuccess, setAvatarSuccess] = useState<string | null>(null)
  const [avatarUploading, setAvatarUploading] = useState(false)
  const avatarInputRef = useRef<HTMLInputElement | null>(null)

  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [passwordError, setPasswordError] = useState<string | null>(null)
  const [passwordSuccess, setPasswordSuccess] = useState<string | null>(null)
  const [passwordSaving, setPasswordSaving] = useState(false)

  useEffect(() => {
    if (!loading && !user) {
      router.push('/signin')
    }
  }, [loading, router, user])

  useEffect(() => {
    if (user) {
      setName(user.name)
    }
  }, [user])

  const avatarTitle = useMemo(() => {
    if (!user) return 'User'
    return user.email ? `${user.name} (${user.email})` : user.name
  }, [user])

  if (loading || !user) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Spinner />
      </div>
    )
  }

  async function handleProfileSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setProfileError(null)
    setProfileSuccess(null)

    const trimmedName = name.trim()
    if (!trimmedName) {
      setProfileError('Name is required')
      return
    }

    setProfileSaving(true)
    try {
      await updateProfile(trimmedName)
      setName(trimmedName)
      setProfileSuccess('Profile updated successfully')
    } catch (error) {
      setProfileError(error instanceof Error ? error.message : 'Failed to update profile')
    } finally {
      setProfileSaving(false)
    }
  }

  async function handlePasswordSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setPasswordError(null)
    setPasswordSuccess(null)

    if (newPassword.length < 6) {
      setPasswordError('New password must be at least 6 characters')
      return
    }

    if (newPassword !== confirmPassword) {
      setPasswordError('New password confirmation does not match')
      return
    }

    setPasswordSaving(true)
    try {
      await changePassword(currentPassword, newPassword)
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
      setPasswordSuccess('Password changed successfully')
    } catch (error) {
      setPasswordError(error instanceof Error ? error.message : 'Failed to change password')
    } finally {
      setPasswordSaving(false)
    }
  }

  async function uploadSelectedAvatar(file: File) {
    setAvatarError(null)
    setAvatarSuccess(null)

    if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) {
      setAvatarError('Avatar must be a PNG, JPEG, or WebP image')
      return
    }

    if (file.size > 2 * 1024 * 1024) {
      setAvatarError('Avatar must be 2MB or smaller')
      return
    }

    setAvatarUploading(true)
    try {
      await uploadAvatar(file)
      setAvatarFile(file)
      setAvatarSuccess('Avatar uploaded successfully')
    } catch (error) {
      setAvatarError(error instanceof Error ? error.message : 'Failed to upload avatar')
    } finally {
      setAvatarUploading(false)
    }
  }

  async function handleAvatarChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (!file) return
    setAvatarFile(file)
    await uploadSelectedAvatar(file)
    event.target.value = ''
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-secondary/5">
      <DashboardHeader />

      <main className="mx-auto max-w-4xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-foreground">Account</h1>
          <p className="mt-2 text-muted-foreground">Manage your profile details and password.</p>
        </div>

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          <Card>
            <CardHeader>
              <CardTitle>Profile</CardTitle>
              <CardDescription>Update how your account appears inside LearnGame.</CardDescription>
            </CardHeader>
            <CardContent>
              <form className="space-y-5" onSubmit={(event) => void handleProfileSubmit(event)}>
                <div className="flex items-center gap-4 rounded-lg border border-border bg-muted/30 p-4">
                  <div className="space-y-2">
                    <button
                      type="button"
                      className={`group relative rounded-full transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ${avatarUploading ? 'opacity-70' : ''}`}
                      onClick={() => avatarInputRef.current?.click()}
                      aria-label="Change avatar"
                    >
                      <UserAvatar
                        name={user.name}
                        email={user.email}
                        avatarUrl={user.avatarUrl}
                        sizeClassName="h-14 w-14"
                        textClassName="text-lg"
                        className="transition-transform group-hover:scale-[1.02]"
                        title={avatarTitle}
                      />
                      <div className="absolute inset-0 flex items-center justify-center rounded-full bg-black/0 text-[11px] font-semibold text-white transition group-hover:bg-black/45 group-focus-visible:bg-black/45">
                        <span className="opacity-0 transition group-hover:opacity-100 group-focus-visible:opacity-100">
                          {avatarUploading ? 'Uploading' : 'Change'}
                        </span>
                      </div>
                    </button>
                    <input
                      ref={avatarInputRef}
                      id="avatar-file"
                      type="file"
                      accept="image/png,image/jpeg,image/webp"
                      hidden
                      onChange={(event) => void handleAvatarChange(event)}
                    />
                  </div>
                  <div className="min-w-0">
                    <p className="font-medium text-foreground">{user.name}</p>
                    <p className="truncate text-sm text-muted-foreground">{user.email}</p>
                  </div>
                </div>

                <div className="space-y-3 rounded-lg border border-border bg-muted/20 p-4">
                  <div>
                    <Label htmlFor="avatar-file">Avatar</Label>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Click avatar to change. PNG, JPEG, or WebP up to 2MB.
                    </p>
                  </div>
                  {avatarFile ? <p className="text-sm text-muted-foreground">{avatarFile.name}</p> : null}
                  {avatarError ? <p className="text-sm text-destructive">{avatarError}</p> : null}
                  {avatarSuccess ? <p className="text-sm text-emerald-600">{avatarSuccess}</p> : null}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="account-email">Email</Label>
                  <Input id="account-email" value={user.email} readOnly disabled />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="account-name">Name</Label>
                  <Input
                    id="account-name"
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    autoComplete="name"
                  />
                </div>

                {profileError ? <p className="text-sm text-destructive">{profileError}</p> : null}
                {profileSuccess ? <p className="text-sm text-emerald-600">{profileSuccess}</p> : null}

                <Button type="submit" disabled={profileSaving}>
                  {profileSaving ? 'Saving...' : 'Save Profile'}
                </Button>
              </form>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Change Password</CardTitle>
              <CardDescription>Use a new password with at least 6 characters.</CardDescription>
            </CardHeader>
            <CardContent>
              <form className="space-y-5" onSubmit={(event) => void handlePasswordSubmit(event)}>
                <div className="space-y-2">
                  <Label htmlFor="current-password">Current Password</Label>
                  <Input
                    id="current-password"
                    type="password"
                    value={currentPassword}
                    onChange={(event) => setCurrentPassword(event.target.value)}
                    autoComplete="current-password"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="new-password">New Password</Label>
                  <Input
                    id="new-password"
                    type="password"
                    value={newPassword}
                    onChange={(event) => setNewPassword(event.target.value)}
                    autoComplete="new-password"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="confirm-password">Confirm New Password</Label>
                  <Input
                    id="confirm-password"
                    type="password"
                    value={confirmPassword}
                    onChange={(event) => setConfirmPassword(event.target.value)}
                    autoComplete="new-password"
                  />
                </div>

                {passwordError ? <p className="text-sm text-destructive">{passwordError}</p> : null}
                {passwordSuccess ? <p className="text-sm text-emerald-600">{passwordSuccess}</p> : null}

                <Button type="submit" disabled={passwordSaving}>
                  {passwordSaving ? 'Updating...' : 'Change Password'}
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  )
}
