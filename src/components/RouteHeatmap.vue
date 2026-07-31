<template>
  <div ref="el" style="height: 320px; width: 100%"></div>
</template>

<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import type { PropType } from 'vue'
import L from 'leaflet'
import type { RunPoint } from '../types'

const props = defineProps({
  // One [[lat, lon, t], ...] track per run, overlaid as low-opacity polylines.
  routes: { type: Array as PropType<RunPoint[][]>, required: true },
})

const el = ref<HTMLDivElement | null>(null)
// type gap: leaflet ships no TypeScript definitions, so the map handle is any.
let map: any
let layer: any

function draw() {
  if (!map) return
  if (layer) {
    layer.remove()
    layer = undefined
  }
  const lines = props.routes
    .filter((points) => points.length >= 2)
    .map((points) =>
      L.polyline(
        points.map(([lat, lon]): [number, number] => [lat, lon]),
        { weight: 3, opacity: 0.35, color: '#2a78d6' },
      ),
    )
  if (!lines.length) {
    map.setView([60.17, 24.94], 12)
    return
  }
  layer = L.featureGroup(lines).addTo(map)
  map.fitBounds(layer.getBounds().pad(0.1))
}

onMounted(() => {
  map = L.map(el.value)
  L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; OpenStreetMap contributors',
    maxZoom: 19,
  }).addTo(map)
  draw()
  // Expansion items mount their content at zero height first.
  setTimeout(() => map && map.invalidateSize(), 50)
})

watch(() => props.routes, draw)

onBeforeUnmount(() => {
  map?.remove()
  map = undefined
})
</script>
