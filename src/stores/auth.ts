import { defineStore } from 'pinia'
import { api, TOKEN_KEY, USERNAME_KEY, ROLE_KEY } from '../api'

interface LoginResponse {
  token: string
  username: string
  role: string
}

export const useAuthStore = defineStore('auth', {
  state: () => ({
    token: localStorage.getItem(TOKEN_KEY) || '',
    username: localStorage.getItem(USERNAME_KEY) || '',
    role: localStorage.getItem(ROLE_KEY) || '',
  }),
  getters: {
    isLoggedIn: (s) => !!s.token,
    isAdmin: (s) => s.role === 'admin',
  },
  actions: {
    async login(username: string, password: string) {
      const { data } = await api.post<LoginResponse>('/api/auth/login', { username, password })
      this.token = data.token
      this.username = data.username
      this.role = data.role
      localStorage.setItem(TOKEN_KEY, data.token)
      localStorage.setItem(USERNAME_KEY, data.username)
      localStorage.setItem(ROLE_KEY, data.role)
    },
    async logout() {
      try {
        await api.post('/api/auth/logout')
      } catch {
        // Best effort; the local session dies regardless.
      }
      this.token = ''
      this.username = ''
      this.role = ''
      localStorage.removeItem(TOKEN_KEY)
      localStorage.removeItem(USERNAME_KEY)
      localStorage.removeItem(ROLE_KEY)
    },
  },
})
