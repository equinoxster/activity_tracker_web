import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Mock } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'

vi.mock('../../api', () => ({
  api: { get: vi.fn(), post: vi.fn(), delete: vi.fn() },
}))

import { api } from '../../api'
import { usePhotosStore } from '../photos'
import type { RemotePhoto } from '../../types'

// The module mock above replaces the axios instance with plain vi.fn()s.
const mockApi = api as unknown as { get: Mock; post: Mock; delete: Mock }

describe('photos store', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    mockApi.get.mockReset()
    mockApi.post.mockReset()
    mockApi.delete.mockReset()
  })

  it('loads the photo list', async () => {
    mockApi.get.mockResolvedValue({ data: [{ id: 2, taken_at: 200 }, { id: 1, taken_at: 100 }] })
    const store = usePhotosStore()
    await store.load()
    expect(api.get).toHaveBeenCalledWith('/api/photos')
    expect(store.items).toHaveLength(2)
    expect(store.error).toBe('')
  })

  it('uploads a blob as multipart form data and reloads', async () => {
    mockApi.post.mockResolvedValue({ data: { id: 3 } })
    mockApi.get.mockResolvedValue({ data: [{ id: 3, taken_at: 300 }] })
    const store = usePhotosStore()
    await store.uploadBlob(new Blob(['x'], { type: 'image/jpeg' }), 300)
    expect(api.post).toHaveBeenCalledTimes(1)
    const [path, form] = mockApi.post.mock.calls[0]
    expect(path).toBe('/api/photos')
    expect(form.get('taken_at')).toBe('300')
    expect(form.get('file')).toBeTruthy()
    expect(store.items).toEqual([{ id: 3, taken_at: 300 }])
  })

  it('deletes a photo and reloads', async () => {
    mockApi.delete.mockResolvedValue({ data: { status: 'ok' } })
    mockApi.get.mockResolvedValue({ data: [] })
    const store = usePhotosStore()
    await store.remove(9)
    expect(api.delete).toHaveBeenCalledWith('/api/photos/9')
    expect(store.items).toEqual([])
  })

  it('keeps items and surfaces an error on failed upload', async () => {
    mockApi.post.mockRejectedValue({ message: 'boom', response: { data: { error: 'only JPEG photos are accepted' } } })
    const store = usePhotosStore()
    store.items = [{ id: 1, taken_at: 100 } as RemotePhoto]
    await store.uploadBlob(new Blob(['x']), 100)
    expect(store.error).toContain('only JPEG')
    expect(store.items).toHaveLength(1)
  })
})
