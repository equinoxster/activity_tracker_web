import axios from 'axios'

export const TOKEN_KEY = 'tc_token'
export const USERNAME_KEY = 'tc_username'
export const ROLE_KEY = 'tc_role'
export const WEIGHT_UNIT_KEY = 'tc_weight_unit'
export const HEIGHT_UNIT_KEY = 'tc_height_unit'

export const api = axios.create({ baseURL: '' })

api.interceptors.request.use((config) => {
  const token = localStorage.getItem(TOKEN_KEY)
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

// On 401 anywhere, drop the session and land on the login page.
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401 && !error.config?.url?.endsWith('/api/auth/login')) {
      localStorage.removeItem(TOKEN_KEY)
      localStorage.removeItem(USERNAME_KEY)
      localStorage.removeItem(ROLE_KEY)
      if (window.location.pathname !== '/login') window.location.assign('/login')
    }
    return Promise.reject(error)
  },
)
