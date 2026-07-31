<template>
  <q-layout view="hHh Lpr lFf">
    <q-header elevated>
      <q-toolbar>
        <q-btn flat dense round icon="menu" @click="drawer = !drawer" />
        <q-toolbar-title>Training Calculator</q-toolbar-title>
        <q-chip
          v-if="dataset.loaded"
          :color="dataset.syncing ? 'orange' : dataset.dirty ? 'amber' : 'green'"
          text-color="white"
          dense
          clickable
          :icon="dataset.syncing ? 'sync' : dataset.dirty ? 'cloud_upload' : 'cloud_done'"
          @click="dataset.syncNow()"
        >
          {{ dataset.syncing ? 'Syncing…' : dataset.dirty ? 'Pending' : 'Synced' }}
        </q-chip>
        <q-btn flat dense :label="auth.username" icon="person">
          <q-menu>
            <q-list style="min-width: 140px">
              <q-item clickable v-close-popup @click="logout">
                <q-item-section>Log out</q-item-section>
              </q-item>
            </q-list>
          </q-menu>
        </q-btn>
      </q-toolbar>
    </q-header>

    <q-drawer v-model="drawer" show-if-above bordered :width="220">
      <q-list>
        <q-item v-for="item in items" :key="item.to" :to="item.to" exact clickable>
          <q-item-section avatar><q-icon :name="item.icon" /></q-item-section>
          <q-item-section>{{ item.label }}</q-item-section>
        </q-item>
      </q-list>
    </q-drawer>

    <q-page-container>
      <router-view />
    </q-page-container>
  </q-layout>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useQuasar } from 'quasar'
import { useAuthStore } from '../stores/auth'
import { useDatasetStore } from '../stores/dataset'

const auth = useAuthStore()
const dataset = useDatasetStore()
const router = useRouter()
const $q = useQuasar()
const drawer = ref(true)

const items = computed(() => {
  const base = [
    { to: '/history', label: 'History', icon: 'history' },
    { to: '/moves', label: 'Moves', icon: 'directions_run' },
    { to: '/templates', label: 'Templates', icon: 'list_alt' },
    { to: '/stats', label: 'Statistics', icon: 'bar_chart' },
    { to: '/measurements', label: 'Measurements', icon: 'monitor_heart' },
    { to: '/photos', label: 'Photos', icon: 'photo_camera' },
  ]
  if (auth.isAdmin) base.push({ to: '/admin', label: 'Admin', icon: 'admin_panel_settings' })
  return base
})

onMounted(() => dataset.load())

function logout() {
  $q.dialog({
    title: 'Log out?',
    message: dataset.dirty
      ? 'You have unsynced changes — they will be lost if you log out now. Sync first (the cloud chip in the header) or log out anyway.'
      : 'End this session?',
    cancel: true,
    ok: { label: 'Log out', color: dataset.dirty ? 'negative' : 'primary' },
  }).onOk(async () => {
    await auth.logout()
    router.push('/login')
  })
}
</script>
