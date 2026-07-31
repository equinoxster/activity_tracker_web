import { defineStore } from 'pinia'
import type { AxiosError } from 'axios'
import { api } from '../api'
import { downscaleImage } from '../photoResize'
import type { RemotePhoto } from '../types'

interface PhotosState {
  items: RemotePhoto[]
  urls: Record<number, string>
  loading: boolean
  error: string
}

/** Progression photos: thin client over the binary API (server list = truth). */
export const usePhotosStore = defineStore('photos', {
  state: (): PhotosState => ({
    items: [], // [{id, taken_at, size_bytes}] newest first
    urls: {}, // id -> object URL (blob-fetched; <img> can't send the Bearer header)
    loading: false,
    error: '',
  }),
  actions: {
    async load() {
      this.loading = true
      this.error = ''
      try {
        const { data } = await api.get<RemotePhoto[]>('/api/photos')
        this.items = data
      } catch (e) {
        this.error = `Load failed: ${(e as Error).message}`
      } finally {
        this.loading = false
      }
    },

    async ensureUrl(id: number): Promise<string> {
      if (this.urls[id]) return this.urls[id]
      const { data } = await api.get<Blob>(`/api/photos/${id}`, { responseType: 'blob' })
      const url = URL.createObjectURL(data)
      this.urls[id] = url
      return url
    },

    async upload(file: File, takenAtMs: number) {
      const blob = await downscaleImage(file)
      return this.uploadBlob(blob, takenAtMs)
    },

    async uploadBlob(blob: Blob, takenAtMs: number) {
      this.error = ''
      try {
        const form = new FormData()
        form.append('taken_at', String(takenAtMs))
        form.append('file', blob, 'photo.jpg')
        await api.post('/api/photos', form)
        await this.load()
      } catch (e) {
        const err = e as AxiosError<{ error?: string }>
        this.error = `Upload failed: ${err.response?.data?.error || err.message}`
      }
    },

    async remove(id: number) {
      this.error = ''
      try {
        await api.delete(`/api/photos/${id}`)
        if (this.urls[id]) {
          URL.revokeObjectURL(this.urls[id])
          delete this.urls[id]
        }
        await this.load()
      } catch (e) {
        this.error = `Delete failed: ${(e as Error).message}`
      }
    },
  },
})
