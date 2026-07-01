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
    if (!user) return 'Người dùng'
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
      setProfileError('Tên không được để trống')
      return
    }

    setProfileSaving(true)
    try {
      await updateProfile(trimmedName)
      setName(trimmedName)
      setProfileSuccess('Cập nhật hồ sơ thành công')
    } catch (error) {
      setProfileError(error instanceof Error ? error.message : 'Cập nhật hồ sơ thất bại')
    } finally {
      setProfileSaving(false)
    }
  }

  async function handlePasswordSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setPasswordError(null)
    setPasswordSuccess(null)

    if (newPassword.length < 6) {
      setPasswordError('Mật khẩu mới phải có ít nhất 6 ký tự')
      return
    }

    if (newPassword !== confirmPassword) {
      setPasswordError('Mật khẩu xác nhận mới không khớp')
      return
    }

    setPasswordSaving(true)
    try {
      await changePassword(currentPassword, newPassword)
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
      setPasswordSuccess('Đổi mật khẩu thành công')
    } catch (error) {
      setPasswordError(error instanceof Error ? error.message : 'Đổi mật khẩu thất bại')
    } finally {
      setPasswordSaving(false)
    }
  }

  async function uploadSelectedAvatar(file: File) {
    setAvatarError(null)
    setAvatarSuccess(null)

    if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) {
      setAvatarError('Ảnh đại diện phải là PNG, JPEG hoặc WebP')
      return
    }

    if (file.size > 2 * 1024 * 1024) {
      setAvatarError('Ảnh đại diện phải nhỏ hơn hoặc bằng 2MB')
      return
    }

    setAvatarUploading(true)
    try {
      await uploadAvatar(file)
      setAvatarFile(file)
      setAvatarSuccess('Tải ảnh đại diện lên thành công')
    } catch (error) {
      setAvatarError(error instanceof Error ? error.message : 'Tải ảnh đại diện lên thất bại')
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
          <h1 className="text-3xl font-bold text-foreground">Tài khoản</h1>
          <p className="mt-2 text-muted-foreground">Quản lý thông tin hồ sơ và mật khẩu của bạn.</p>
        </div>

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          <Card>
            <CardHeader>
              <CardTitle>Hồ sơ</CardTitle>
              <CardDescription>Cập nhật cách tài khoản của bạn hiển thị trong Học Mà Chơi.</CardDescription>
            </CardHeader>
            <CardContent>
              <form className="space-y-5" onSubmit={(event) => void handleProfileSubmit(event)}>
                <div className="flex items-center gap-4 rounded-lg border border-border bg-muted/30 p-4">
                  <div className="space-y-2">
                    <button
                      type="button"
                      className={`group relative rounded-full transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ${avatarUploading ? 'opacity-70' : ''}`}
                      onClick={() => avatarInputRef.current?.click()}
                      aria-label="Đổi ảnh đại diện"
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
                          {avatarUploading ? 'Đang tải' : 'Đổi'}
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
                    <Label htmlFor="avatar-file">Ảnh đại diện</Label>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Bấm vào ảnh đại diện để thay đổi. Hỗ trợ PNG, JPEG hoặc WebP tối đa 2MB.
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
                  <Label htmlFor="account-name">Tên</Label>
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
                  {profileSaving ? 'Đang lưu...' : 'Lưu hồ sơ'}
                </Button>
              </form>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Đổi mật khẩu</CardTitle>
              <CardDescription>Dùng mật khẩu mới có ít nhất 6 ký tự.</CardDescription>
            </CardHeader>
            <CardContent>
              <form className="space-y-5" onSubmit={(event) => void handlePasswordSubmit(event)}>
                <div className="space-y-2">
                  <Label htmlFor="current-password">Mật khẩu hiện tại</Label>
                  <Input
                    id="current-password"
                    type="password"
                    value={currentPassword}
                    onChange={(event) => setCurrentPassword(event.target.value)}
                    autoComplete="current-password"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="new-password">Mật khẩu mới</Label>
                  <Input
                    id="new-password"
                    type="password"
                    value={newPassword}
                    onChange={(event) => setNewPassword(event.target.value)}
                    autoComplete="new-password"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="confirm-password">Xác nhận mật khẩu mới</Label>
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
                  {passwordSaving ? 'Đang cập nhật...' : 'Đổi mật khẩu'}
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  )
}
