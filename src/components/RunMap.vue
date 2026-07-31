<template>
  <div ref="el" style="height: 500px; width: 100%"></div>
</template>

<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'
import type { PropType } from 'vue'
import L from 'leaflet'
import iconUrl from 'leaflet/dist/images/marker-icon.png'
import iconRetinaUrl from 'leaflet/dist/images/marker-icon-2x.png'
import shadowUrl from 'leaflet/dist/images/marker-shadow.png'
import type { RunPoint } from '../types'

// Vite rewrites asset URLs, so the default icon paths must be re-pointed.
L.Icon.Default.mergeOptions({ iconUrl, iconRetinaUrl, shadowUrl })

const props = defineProps({
  // [[lat, lon, t], ...] — the sync-document point format.
  points: { type: Array as PropType<RunPoint[]>, required: true },
})

const el = ref<HTMLDivElement | null>(null)
// type gap: leaflet ships no TypeScript definitions, so the map handle is any.
let map: any
let resizeObserver: ResizeObserver | undefined
let invalidateTimer: ReturnType<typeof setTimeout> | undefined

function invalidateMapSize() {
  map?.invalidateSize()
}

onMounted(() => {
  map = L.map(el.value)
  L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; OpenStreetMap contributors',
    maxZoom: 19,
  }).addTo(map)
  const latlngs = props.points.map(([lat, lon]): [number, number] => [lat, lon])
  if (latlngs.length >= 2) {
    const line = L.polyline(latlngs, { weight: 4 }).addTo(map)
    L.marker(latlngs[0]).addTo(map).bindPopup('Start')
    L.marker(latlngs[latlngs.length - 1]).addTo(map).bindPopup('End')
    map.fitBounds(line.getBounds().pad(0.15))
  } else {
    map.setView([60.17, 24.94], 12)
  }
  if (el.value) {
    resizeObserver = new ResizeObserver(invalidateMapSize)
    resizeObserver.observe(el.value)
  }
  window.addEventListener('resize', invalidateMapSize)
  // Expansion transitions can complete after mount; invalidate again after layout settles.
  requestAnimationFrame(() => requestAnimationFrame(invalidateMapSize))
  invalidateTimer = setTimeout(invalidateMapSize, 250)
})

onBeforeUnmount(() => {
  if (invalidateTimer) clearTimeout(invalidateTimer)
  invalidateTimer = undefined
  resizeObserver?.disconnect()
  resizeObserver = undefined
  window.removeEventListener('resize', invalidateMapSize)
  map?.remove()
  map = undefined
})
</script>
