<template>
  <q-layout>
    <q-page-container>
      <q-page class="flex flex-center bg-grey-2">
        <q-card style="width: 360px" class="q-pa-md">
          <q-card-section>
            <div class="text-h6">Training Calculator</div>
            <div class="text-caption text-grey">Sign in to your account</div>
          </q-card-section>
          <q-form @submit.prevent="submit">
            <q-card-section class="q-gutter-md">
              <q-input v-model="username" label="Username" autofocus outlined dense />
              <q-input v-model="password" label="Password" type="password" outlined dense />
              <q-banner v-if="error" dense class="bg-red-1 text-red-9">{{ error }}</q-banner>
            </q-card-section>
            <q-card-actions align="right">
              <q-btn type="submit" color="primary" label="Log in" :loading="busy" />
            </q-card-actions>
          </q-form>
        </q-card>
      </q-page>
    </q-page-container>
  </q-layout>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import type { AxiosError } from 'axios'
import { useAuthStore } from '../stores/auth'

const auth = useAuthStore()
const router = useRouter()
const username = ref('')
const password = ref('')
const error = ref('')
const busy = ref(false)

async function submit() {
  busy.value = true
  error.value = ''
  try {
    await auth.login(username.value.trim(), password.value)
    router.push('/history')
  } catch (e) {
    const err = e as AxiosError
    error.value = err.response?.status === 401 ? 'Wrong username or password.' : `Login failed: ${err.message}`
  } finally {
    busy.value = false
  }
}
</script>
