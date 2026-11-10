import { useEffect, useState } from 'react'
import type { ModelDoc } from './types'

let pending: Promise<ModelDoc> | null = null

/** model.json is small and read by several views, so fetch it once per session. */
export function loadModel(): Promise<ModelDoc> {
  if (!pending) {
    pending = fetch('/geo/model.json').then((r) => {
      if (!r.ok) throw new Error(`model.json returned ${r.status}`)
      return r.json() as Promise<ModelDoc>
    })
  }
  return pending
}

export function useModel(): { model: ModelDoc | null; error: string | null } {
  const [model, setModel] = useState<ModelDoc | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let alive = true
    loadModel().then(
      (m) => {
        if (alive) setModel(m)
      },
      (e: unknown) => {
        if (alive) setError(e instanceof Error ? e.message : 'Could not load the model record')
      },
    )
    return () => {
      alive = false
    }
  }, [])

  return { model, error }
}
