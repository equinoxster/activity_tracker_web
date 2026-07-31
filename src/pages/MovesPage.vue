<template>
  <q-page padding>
    <div class="row items-center q-mb-md">
      <div class="text-h6">Moves</div>
      <q-space />
      <q-btn color="primary" icon="add" label="New move" @click="openEditor()" />
    </div>

    <q-table
      :rows="dataset.data.moves"
      :columns="columns"
      row-key="name"
      dense
      flat
      bordered
      :pagination="{ rowsPerPage: 25, sortBy: 'name' }"
    >
      <template #body-cell-is_enabled="props">
        <q-td :props="props">
          <q-badge :color="props.row.is_enabled ? 'green' : 'grey'">
            {{ props.row.is_enabled ? 'enabled' : 'disabled' }}
          </q-badge>
        </q-td>
      </template>
      <template #body-cell-actions="props">
        <q-td :props="props" auto-width>
          <q-btn flat dense icon="edit" @click="openEditor(props.row)" />
          <q-btn flat dense icon="delete" color="negative" @click="confirmDelete(props.row)" />
        </q-td>
      </template>
    </q-table>

    <q-dialog v-model="editorOpen">
      <q-card style="width: 420px">
        <q-card-section class="text-h6">{{ editing ? 'Edit move' : 'New move' }}</q-card-section>
        <q-card-section class="q-gutter-sm">
          <q-input v-model="form.name" label="Name" outlined dense />
          <q-select v-model="form.movement_height" :options="['UPPER', 'LOWER', 'CORE']" label="Height" outlined dense />
          <q-select v-model="form.movement_group" :options="['LEGS', 'PUSH', 'PULL']" label="Group" outlined dense />
          <q-select v-model="form.laterality" :options="['BILATERAL', 'UNILATERAL']" label="Laterality" outlined dense />
          <q-select v-model="form.tracking_mode" :options="['WEIGHT', 'TIME']" label="Tracking" outlined dense />
          <q-input v-model="form.weight_note" label="Weight note" outlined dense />
          <q-toggle v-model="form.is_enabled" label="Enabled" />
        </q-card-section>
        <q-card-actions align="right">
          <q-btn flat label="Cancel" v-close-popup />
          <q-btn color="primary" label="Save" :disable="!form.name.trim()" @click="save" v-close-popup />
        </q-card-actions>
      </q-card>
    </q-dialog>
  </q-page>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useQuasar } from 'quasar'
import type { QTableColumn } from 'quasar'
import { useDatasetStore } from '../stores/dataset'
import type { Move, Unstamped } from '../types'

type MoveForm = Unstamped<Move>

const dataset = useDatasetStore()
const $q = useQuasar()

const columns: QTableColumn[] = [
  { name: 'name', label: 'Name', field: 'name', align: 'left', sortable: true },
  { name: 'movement_height', label: 'Height', field: 'movement_height', align: 'left' },
  { name: 'movement_group', label: 'Group', field: 'movement_group', align: 'left' },
  { name: 'laterality', label: 'Laterality', field: 'laterality', align: 'left' },
  { name: 'tracking_mode', label: 'Tracking', field: 'tracking_mode', align: 'left' },
  { name: 'is_enabled', label: 'Status', field: 'is_enabled', align: 'left' },
  { name: 'actions', label: '', field: 'name' },
]

const editorOpen = ref(false)
const editing = ref<Move | null>(null)
const form = ref<MoveForm>(blankForm())

function blankForm(): MoveForm {
  return {
    name: '',
    movement_height: 'LOWER',
    movement_group: 'LEGS',
    weight_note: '',
    is_enabled: true,
    laterality: 'BILATERAL',
    tracking_mode: 'WEIGHT',
  }
}

function openEditor(move?: Move) {
  editing.value = move || null
  form.value = move ? { ...move } : blankForm()
  editorOpen.value = true
}

function save() {
  const trimmed = form.value.name.trim()
  const clash = dataset.data.moves.find(
    (m) => m.name.trim().toLowerCase() === trimmed.toLowerCase() && m.uuid !== editing.value?.uuid,
  )
  if (clash) {
    $q.notify({ type: 'negative', message: `A move named "${clash.name}" already exists.` })
    return
  }
  dataset.upsertMove({ ...form.value, name: trimmed, uuid: editing.value?.uuid })
}

function confirmDelete(move: Move) {
  $q.dialog({
    title: 'Delete move',
    message: `Delete "${move.name}" everywhere? Workouts referencing it keep their history on devices until they sync.`,
    cancel: true,
  }).onOk(() => dataset.deleteMove(move.name))
}
</script>
