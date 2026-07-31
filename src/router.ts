import { createRouter, createWebHistory } from 'vue-router'
import { useAuthStore } from './stores/auth'

export const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/login', component: () => import('./pages/LoginPage.vue') },
    {
      path: '/',
      component: () => import('./layouts/MainLayout.vue'),
      children: [
        { path: '', redirect: '/history' },
        { path: 'history', component: () => import('./pages/HistoryPage.vue') },
        { path: 'moves', component: () => import('./pages/MovesPage.vue') },
        { path: 'templates', component: () => import('./pages/TemplatesPage.vue') },
        { path: 'stats', component: () => import('./pages/StatsPage.vue') },
        { path: 'measurements', component: () => import('./pages/MeasurementsPage.vue') },
        { path: 'photos', component: () => import('./pages/PhotosPage.vue') },
        { path: 'admin', component: () => import('./pages/AdminPage.vue'), meta: { admin: true } },
        { path: 'admin/users/:id', component: () => import('./pages/AdminUserDataPage.vue'), meta: { admin: true } },
      ],
    },
  ],
})

router.beforeEach((to) => {
  const auth = useAuthStore()
  if (to.path !== '/login' && !auth.isLoggedIn) return '/login'
  if (to.path === '/login' && auth.isLoggedIn) return '/history'
  if (to.meta.admin && !auth.isAdmin) return '/history'
  return true
})
