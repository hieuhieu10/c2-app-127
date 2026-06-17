'use client'

import { Suspense, useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { useAuth } from '@/features/auth/auth-context'
import { beWebApi } from '@/features/game-library/services/be-web'
import { TEMPLATE_REGISTRY, getTemplateMetadata } from '@/features/game-creation/template-registry'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Spinner } from '@/components/ui/spinner'
import type { GameTemplateType } from '@/types/app'

function templateTypeToProductId(type: GameTemplateType | null): string {
  if (type === 'battleship') return 'battleship'
  return 'treasure_hunt'
}

interface LessonForm {
  title: string
  content: string
}

export default function LessonSetupPage() {
  return (
    <Suspense fallback={<div className="flex h-screen items-center justify-center"><Spinner /></div>}>
      <LessonSetupContent />
    </Suspense>
  )
}

function LessonSetupContent() {
  const { user, loading: authLoading } = useAuth()
  const router = useRouter()
  const searchParams = useSearchParams()
  const selectedTemplate = searchParams.get('template') as GameTemplateType | null
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState<LessonForm>({
    title: '',
    content: '',
  })

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/signin')
    }
  }, [user, authLoading, router])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user) return

    setLoading(true)
    try {
      if (!form.title.trim() || !form.content.trim()) {
        alert('Please enter game title and input')
        return
      }

      const product_template_id = templateTypeToProductId(selectedTemplate)

      const game = await beWebApi.generateGame({
        title: form.title.trim(),
        input: form.content.trim(),
        product_template_id,
      })

      router.push(`/dashboard/lesson/${game.lessonId}/validate/${game.gameId}`)
    } catch (error) {
      console.error('Failed to create lesson:', error)
      alert(error instanceof Error ? error.message : 'Failed to generate game')
    } finally {
      setLoading(false)
    }
  }

  if (authLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Spinner />
      </div>
    )
  }

  if (!selectedTemplate) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-background to-secondary/5">
        <header className="border-b border-border sticky top-0 z-10 bg-background/80 backdrop-blur-sm">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
            <Link href="/dashboard" className="text-2xl font-bold text-primary hover:opacity-80">
              LearnGame
            </Link>
            <div className="text-sm text-muted-foreground">Step 1 of 4: Choose Game Template</div>
          </div>
        </header>

        <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-foreground mb-2">Choose a Game Template</h1>
            <p className="text-muted-foreground">
              Start by choosing the game format. For now, the project focuses on one polished template.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-6">
            {TEMPLATE_REGISTRY.map((template) => (
              <Link key={template.type} href={`/dashboard/lesson/new?template=${template.type}`}>
                <Card className="h-full cursor-pointer transition-all hover:border-primary hover:shadow-lg">
                  <CardHeader>
                    <div className="text-5xl mb-2">{template.icon}</div>
                    <CardTitle className="text-2xl">{template.title}</CardTitle>
                    <CardDescription>{template.description}</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="text-sm text-muted-foreground">
                      <span className="font-semibold">Interaction:</span> {template.interactionType}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      <span className="font-semibold">Best for:</span> {template.bestFor}
                    </div>
                    <div className="p-3 bg-secondary/30 rounded text-sm text-muted-foreground border border-border">
                      <span className="font-semibold block mb-1">Example:</span>
                      {template.example}
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        </main>
      </div>
    )
  }

  const template = getTemplateMetadata(selectedTemplate)

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-secondary/5">
      {/* Header */}
      <header className="border-b border-border sticky top-0 z-10 bg-background/80 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
          <Link href="/dashboard" className="text-2xl font-bold text-primary hover:opacity-80">
            LearnGame
          </Link>
          <div className="text-sm text-muted-foreground">Step 1 of 3: Game Input</div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-foreground mb-2">Create {template.title} Game</h1>
          <p className="text-muted-foreground">
            Paste the lesson content or describe what students should practice.
          </p>
          <div className="mt-4 inline-flex items-center gap-2 px-3 py-1 bg-primary/10 text-primary rounded-full text-sm">
            <span>{template.icon}</span>
            <span className="font-semibold">{template.title}</span>
          </div>
        </div>

        <Card>
          <CardContent className="pt-6">
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="title" className="text-base font-semibold">
                  Title *
                </Label>
                <Input
                  id="title"
                  placeholder="e.g., Practice the 6 times table"
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  disabled={loading}
                  className="text-base"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="content" className="text-base font-semibold">
                  Input *
                </Label>
                <Textarea
                  id="content"
                  placeholder="e.g., Create a 10-question game for practicing the 6 times table. Or paste lesson content so the system can generate questions."
                  value={form.content}
                  onChange={(e) => setForm({ ...form, content: e.target.value })}
                  disabled={loading}
                  className="min-h-56 text-base"
                />
                <p className="text-sm text-muted-foreground mt-2">
                  Enter the lesson content or game request. Other settings use prototype defaults for now.
                </p>
              </div>

              {/* Form Actions */}
              <div className="flex gap-3 pt-4 border-t border-border">
                <Link href="/dashboard" className="flex-1">
                  <Button variant="outline" className="w-full" disabled={loading}>
                    Cancel
                  </Button>
                </Link>
                <Button type="submit" className="flex-1 bg-primary hover:bg-primary/90" disabled={loading}>
                  {loading ? 'Creating...' : 'Generate Game'}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </main>
    </div>
  )
}
