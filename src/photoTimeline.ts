// Pure grouping/ordering helpers for the photo timeline and slideshow.
import type { RemotePhoto } from './types'

export interface PhotoDayGroup {
  day: string // local ISO date, e.g. "2026-07-12"
  label: string // human date, e.g. "12 Jul 2026"
  photos: RemotePhoto[] // ascending by taken_at
}

const dayKeyOf = (ms: number): string => {
  const d = new Date(ms)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

/** Groups photos per local calendar day: groups newest-first, photos within a day ascending. */
export function groupByDay(photos: RemotePhoto[]): PhotoDayGroup[] {
  const byDay = new Map<string, RemotePhoto[]>()
  for (const p of photos) {
    const key = dayKeyOf(p.taken_at)
    const list = byDay.get(key) ?? []
    list.push(p)
    byDay.set(key, list)
  }
  return [...byDay.entries()]
    .sort((a, b) => b[0].localeCompare(a[0]))
    .map(([day, list]) => ({
      day,
      label: new Date(list[0]!.taken_at).toLocaleDateString(undefined, {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      }),
      photos: [...list].sort((a, b) => a.taken_at - b.taken_at),
    }))
}

/** Slideshow plays oldest → newest. */
export function slideshowOrder(photos: RemotePhoto[]): RemotePhoto[] {
  return [...photos].sort((a, b) => a.taken_at - b.taken_at)
}
