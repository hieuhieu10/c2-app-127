'use client'

import { useEffect, useState } from 'react'
import { fetchTemplates } from './ai-api'

type CategoryMap = Record<string, string>

// Template id -> category is static for the app session, so fetch it once and
// share it. The module-level cache dedupes concurrent callers and survives route
// changes; `inflight` collapses simultaneous first-mounts into one request.
let cache: CategoryMap | null = null
let inflight: Promise<CategoryMap> | null = null

function loadCategories(): Promise<CategoryMap> {
  if (cache) return Promise.resolve(cache)
  if (!inflight) {
    inflight = fetchTemplates()
      .then((templates) => {
        cache = Object.fromEntries(templates.map((t) => [t.id, t.category]))
        return cache
      })
      .catch((err) => {
        inflight = null // let the next mount retry instead of caching the failure
        throw err
      })
  }
  return inflight
}

/**
 * Backend-owned template categories (`GameSpec.category` via `GET /templates`),
 * shared across every view. Returns the cached map synchronously on later mounts
 * (no refetch, no flicker) and `{}` until first load — callers fall back to their
 * registry category for any id not present.
 */
export function useTemplateCategories(): CategoryMap {
  const [categories, setCategories] = useState<CategoryMap>(() => cache ?? {})

  useEffect(() => {
    if (cache) return
    let cancelled = false
    loadCategories()
      .then((map) => { if (!cancelled) setCategories(map) })
      .catch(() => { /* keep registry categories as fallback */ })
    return () => { cancelled = true }
  }, [])

  return categories
}
