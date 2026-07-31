import { describe, expect, it } from 'vitest'
import { groupByDay, slideshowOrder } from '../photoTimeline'
import type { RemotePhoto } from '../types'

const photo = (id: number, takenAt: number): RemotePhoto => ({ id, taken_at: takenAt, size_bytes: 1 })

describe('photo timeline helpers', () => {
  const noonUtc = (day: string) => Date.parse(`${day}T12:00:00`)
  const photos = [
    photo(1, noonUtc('2026-07-10')),
    photo(3, noonUtc('2026-07-12') + 2000),
    photo(2, noonUtc('2026-07-12')),
  ]

  it('groups by day, newest day first, photos ascending inside', () => {
    const groups = groupByDay(photos)
    expect(groups).toHaveLength(2)
    expect(groups[0]!.day > groups[1]!.day).toBe(true)
    expect(groups[0]!.photos.map((p) => p.id)).toEqual([2, 3])
    expect(groups[1]!.photos.map((p) => p.id)).toEqual([1])
    expect(groups[0]!.label).toBeTruthy()
  })

  it('orders the slideshow oldest to newest', () => {
    expect(slideshowOrder(photos).map((p) => p.id)).toEqual([1, 2, 3])
  })
})
