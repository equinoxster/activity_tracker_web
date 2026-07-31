<template>
  <q-page padding>
    <div class="row items-center q-mb-md">
      <div class="text-h6">Admin — Users</div>
      <q-space />
      <q-btn color="primary" icon="person_add" label="New user" @click="createOpen = true" />
    </div>

    <q-table :rows="users" :columns="columns" row-key="id" dense flat bordered :loading="loading">
      <template #body-cell-role="props">
        <q-td :props="props">
          <q-badge :color="props.row.role === 'admin' ? 'purple' : 'blue-grey'">{{ props.row.role }}</q-badge>
        </q-td>
      </template>
      <template #body-cell-disabled="props">
        <q-td :props="props">
          <q-badge :color="props.row.disabled ? 'red' : 'green'">
            {{ props.row.disabled ? 'disabled' : 'active' }}
          </q-badge>
        </q-td>
      </template>
      <template #body-cell-actions="props">
        <q-td :props="props" auto-width>
          <q-btn flat dense icon="visibility" title="View data" :to="`/admin/users/${props.row.id}`" />
          <q-btn flat dense icon="key" title="Reset password" @click="openReset(props.row)" />
          <q-btn
            flat dense
            :icon="props.row.role === 'admin' ? 'arrow_downward' : 'arrow_upward'"
            :title="props.row.role === 'admin' ? 'Demote to user' : 'Promote to admin'"
            @click="toggleRole(props.row)"
          />
          <q-btn
            flat dense
            :icon="props.row.disabled ? 'lock_open' : 'lock'"
            :title="props.row.disabled ? 'Enable' : 'Disable'"
            @click="toggleDisabled(props.row)"
          />
          <q-btn flat dense icon="delete_forever" color="negative" @click="openDelete(props.row)" />
        </q-td>
      </template>
    </q-table>

    <q-card flat bordered class="q-mt-md">
      <q-card-section>
        <div class="row items-center q-mb-sm">
          <div class="text-subtitle2">Login attempts</div>
          <q-space />
          <q-btn flat dense icon="refresh" @click="loadAudit" />
        </div>
        <div v-if="audit.blocked_ips.length || audit.locked_accounts.length" class="q-mb-sm">
          <q-chip v-for="b in audit.blocked_ips" :key="b.ip" color="red" text-color="white" dense icon="block">
            {{ b.ip }} until {{ formatTime(b.until) }}
          </q-chip>
          <q-chip v-for="a in audit.locked_accounts" :key="a.username" color="orange" text-color="white" dense
            icon="lock">
            {{ a.username }} until {{ formatTime(a.until) }}
          </q-chip>
        </div>
        <div v-else class="text-grey q-mb-sm">No active blocks.</div>
        <q-markup-table dense flat>
          <thead>
            <tr>
              <th class="text-left">Time</th>
              <th class="text-left">IP</th>
              <th class="text-left">Username</th>
              <th class="text-left">Result</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="a in audit.attempts" :key="a.id">
              <td>{{ formatTime(a.at) }}</td>
              <td>{{ a.ip }}</td>
              <td>{{ a.username }}</td>
              <td>
                <q-badge :color="a.success ? 'green' : 'red'">{{ a.success ? 'ok' : 'fail' }}</q-badge>
              </td>
            </tr>
          </tbody>
        </q-markup-table>
      </q-card-section>
    </q-card>

    <q-banner v-if="error" dense class="bg-red-1 text-red-9 q-mt-md">{{ error }}</q-banner>

    <q-dialog v-model="createOpen">
      <q-card style="width: 360px">
        <q-card-section class="text-h6">New user</q-card-section>
        <q-card-section class="q-gutter-sm">
          <q-input v-model="createForm.username" label="Username" outlined dense />
          <q-input v-model="createForm.password" label="Password" type="password" outlined dense />
          <q-select v-model="createForm.role" :options="['user', 'admin']" label="Role" outlined dense />
        </q-card-section>
        <q-card-actions align="right">
          <q-btn flat label="Cancel" v-close-popup />
          <q-btn color="primary" label="Create" :disable="!createForm.username || !createForm.password" @click="createUser" v-close-popup />
        </q-card-actions>
      </q-card>
    </q-dialog>

    <q-dialog v-model="resetOpen">
      <q-card style="width: 360px">
        <q-card-section class="text-h6">Reset password — {{ target?.username }}</q-card-section>
        <q-card-section>
          <q-input v-model="newPassword" label="New password" type="password" outlined dense />
        </q-card-section>
        <q-card-actions align="right">
          <q-btn flat label="Cancel" v-close-popup />
          <q-btn color="primary" label="Reset" :disable="!newPassword" @click="resetPassword" v-close-popup />
        </q-card-actions>
      </q-card>
    </q-dialog>

    <q-dialog v-model="deleteOpen">
      <q-card style="width: 400px">
        <q-card-section class="text-h6 text-negative">Delete {{ target?.username }}?</q-card-section>
        <q-card-section>
          <p>This permanently deletes the user and <b>all of their workout data</b> on the server.</p>
          <q-input v-model="deleteConfirm" :label="`Type ${target?.username} to confirm`" outlined dense />
        </q-card-section>
        <q-card-actions align="right">
          <q-btn flat label="Cancel" v-close-popup />
          <q-btn color="negative" label="Delete forever" :disable="deleteConfirm !== target?.username" @click="deleteUser" v-close-popup />
        </q-card-actions>
      </q-card>
    </q-dialog>
  </q-page>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue'
import type { AxiosError } from 'axios'
import type { QTableColumn } from 'quasar'
import { api } from '../api'

// Shapes match the backend admin endpoints (Go time.Time serializes as an
// RFC 3339 string).
interface AdminUser {
  id: number
  username: string
  role: string
  disabled: boolean
  created_at: string
}

interface LoginAudit {
  attempts: Array<{ id: number; at: string; ip: string; username: string; success: boolean }>
  blocked_ips: Array<{ ip: string; until: string }>
  locked_accounts: Array<{ username: string; until: string }>
}

const users = ref<AdminUser[]>([])
const loading = ref(false)
const error = ref('')

const columns: QTableColumn[] = [
  { name: 'id', label: 'ID', field: 'id', align: 'left', sortable: true },
  { name: 'username', label: 'Username', field: 'username', align: 'left', sortable: true },
  { name: 'role', label: 'Role', field: 'role', align: 'left' },
  { name: 'disabled', label: 'Status', field: 'disabled', align: 'left' },
  { name: 'created_at', label: 'Created', field: (r) => new Date(r.created_at).toLocaleDateString(), align: 'left' },
  { name: 'actions', label: '', field: 'id' },
]

async function refresh() {
  loading.value = true
  error.value = ''
  try {
    users.value = (await api.get<AdminUser[]>('/api/admin/users')).data
  } catch (e) {
    error.value = friendly(e)
  } finally {
    loading.value = false
  }
}
const audit = ref<LoginAudit>({ attempts: [], blocked_ips: [], locked_accounts: [] })

async function loadAudit() {
  try {
    audit.value = (await api.get<LoginAudit>('/api/admin/login-attempts')).data
  } catch {
    audit.value = { attempts: [], blocked_ips: [], locked_accounts: [] }
  }
}

function formatTime(t: string) {
  return new Date(t).toLocaleString()
}

onMounted(() => {
  refresh()
  loadAudit()
})

function friendly(e: unknown) {
  const err = e as AxiosError<{ error?: string }>
  return err.response?.data?.error || err.message
}

const createOpen = ref(false)
const createForm = ref({ username: '', password: '', role: 'user' })
async function createUser() {
  try {
    await api.post('/api/admin/users', createForm.value)
    createForm.value = { username: '', password: '', role: 'user' }
    await refresh()
  } catch (e) {
    error.value = friendly(e)
  }
}

const resetOpen = ref(false)
const deleteOpen = ref(false)
const target = ref<AdminUser | null>(null)
const newPassword = ref('')
const deleteConfirm = ref('')

function openReset(user: AdminUser) {
  target.value = user
  newPassword.value = ''
  resetOpen.value = true
}
async function resetPassword() {
  try {
    await api.patch(`/api/admin/users/${target.value!.id}`, { password: newPassword.value })
  } catch (e) {
    error.value = friendly(e)
  }
}

async function toggleRole(user: AdminUser) {
  try {
    await api.patch(`/api/admin/users/${user.id}`, { role: user.role === 'admin' ? 'user' : 'admin' })
    await refresh()
  } catch (e) {
    error.value = friendly(e)
  }
}

async function toggleDisabled(user: AdminUser) {
  try {
    await api.patch(`/api/admin/users/${user.id}`, { disabled: !user.disabled })
    await refresh()
  } catch (e) {
    error.value = friendly(e)
  }
}

function openDelete(user: AdminUser) {
  target.value = user
  deleteConfirm.value = ''
  deleteOpen.value = true
}
async function deleteUser() {
  try {
    await api.delete(`/api/admin/users/${target.value!.id}`)
    await refresh()
  } catch (e) {
    error.value = friendly(e)
  }
}
</script>
