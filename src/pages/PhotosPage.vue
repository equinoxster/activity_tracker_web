<template>
  <q-page padding>
    <div class="row items-center q-gutter-sm q-mb-md">
      <div class="text-h6">Progress photos</div>
      <q-space />
      <q-btn
        flat color="primary" icon="play_arrow" label="Play"
        :disable="photos.items.length < 2" @click="startSlideshow"
      />
      <q-input v-model="photoDate" dense outlined type="date" style="width: 160px" />
      <q-btn color="primary" icon="upload" label="Upload photo" @click="fileInput!.click()" />
      <input
        ref="fileInput" type="file" accept="image/*" style="display: none"
        @change="onFilePicked"
      />
    </div>

    <q-banner v-if="photos.error" dense class="bg-red-1 text-red-9 q-mb-md">{{ photos.error }}</q-banner>
    <q-inner-loading :showing="photos.loading" />

    <div v-if="!photos.loading && !photos.items.length" class="text-grey q-mt-lg">
      No progression photos yet. Upload one to start your timeline.
    </div>

    <div class="timeline">
      <div v-for="group in groups" :key="group.day" class="timeline-row">
        <div
          class="timeline-bubble" :class="{ open: expandedDays.has(group.day) }"
          @click="toggleDay(group.day)"
        >
          <div class="bubble-day">{{ group.day.slice(8) }}</div>
          <div class="bubble-month">{{ monthOf(group) }}</div>
        </div>
        <div class="timeline-body">
          <div class="cursor-pointer" @click="toggleDay(group.day)">
            <div class="text-subtitle2">{{ group.label }}</div>
            <div class="text-caption text-grey">
              {{ group.photos.length === 1 ? '1 photo' : `${group.photos.length} photos` }}
            </div>
          </div>
          <transition name="expand">
            <div v-if="expandedDays.has(group.day)" class="row q-gutter-sm q-mt-xs">
              <PhotoThumb
                v-for="p in group.photos" :key="p.id" :photo="p"
                @open="openPhoto(p)"
              />
            </div>
          </transition>
        </div>
      </div>
    </div>

    <q-dialog v-model="viewer.open">
      <q-card style="max-width: 90vw">
        <q-card-section class="q-pa-none">
          <img v-if="viewer.url" :src="viewer.url" style="max-width: 100%; max-height: 80vh; display: block" />
        </q-card-section>
        <q-card-actions align="between">
          <div class="text-caption q-pl-sm">{{ viewer.photo ? formatDate(viewer.photo.taken_at) : '' }}</div>
          <div>
            <q-btn flat color="negative" icon="delete" label="Delete" @click="confirmDelete" />
            <q-btn flat label="Close" v-close-popup />
          </div>
        </q-card-actions>
      </q-card>
    </q-dialog>

    <q-dialog v-model="slideshow.open" maximized @hide="stopSlideshow">
      <div class="slideshow" @click="slideshow.playing = !slideshow.playing">
        <img
          v-for="(p, i) in slideshowPhotos" v-show="i === slideshow.index" :key="p.id"
          :src="photos.urls[p.id] || ''" class="slideshow-img"
        />
        <div class="slideshow-caption">
          {{ currentSlide ? formatDate(currentSlide.taken_at) : '' }}
          · {{ slideshow.index + 1 }}/{{ slideshowPhotos.length }}
          <span v-if="!slideshow.playing"> · paused</span>
        </div>
        <q-btn
          class="slideshow-close" round dense icon="close" color="white" text-color="black"
          @click.stop="slideshow.open = false"
        />
      </div>
    </q-dialog>
  </q-page>
</template>

<script setup lang="ts">
import { computed, defineComponent, h, onMounted, onUnmounted, ref } from 'vue'
import type { PropType } from 'vue'
import { useQuasar } from 'quasar'
import { usePhotosStore } from '../stores/photos'
import { groupByDay, slideshowOrder } from '../photoTimeline'
import type { PhotoDayGroup } from '../photoTimeline'
import type { RemotePhoto } from '../types'

const photos = usePhotosStore()
const $q = useQuasar()
const fileInput = ref<HTMLInputElement | null>(null)
const photoDate = ref(new Date().toISOString().slice(0, 10))
const viewer = ref<{ open: boolean; photo: RemotePhoto | null; url: string }>({ open: false, photo: null, url: '' })

onMounted(() => photos.load())

// ── timeline ──
const groups = computed(() => groupByDay(photos.items))
const expandedDays = ref(new Set<string>())
let seededNewest = false

function toggleDay(day: string) {
  const next = new Set(expandedDays.value)
  if (next.has(day)) next.delete(day)
  else next.add(day)
  expandedDays.value = next
}

// The newest day starts expanded once the first load lands.
const stopSeed = computed(() => {
  if (!seededNewest && groups.value.length) {
    seededNewest = true
    expandedDays.value = new Set([groups.value[0]!.day])
  }
  return true
})
void stopSeed.value

function monthOf(group: PhotoDayGroup): string {
  return new Date(group.photos[0]!.taken_at).toLocaleDateString(undefined, { month: 'short' })
}

// ── slideshow ──
const slideshow = ref({ open: false, index: 0, playing: true })
const slideshowPhotos = computed(() => slideshowOrder(photos.items))
const currentSlide = computed(() => slideshowPhotos.value[slideshow.value.index] ?? null)
let timer: ReturnType<typeof setInterval> | null = null

async function startSlideshow() {
  slideshow.value = { open: true, index: 0, playing: true }
  // Warm the first few object URLs so the show starts smoothly.
  for (const p of slideshowPhotos.value.slice(0, 3)) {
    try {
      await photos.ensureUrl(p.id)
    } catch {
      /* keeps playing with what loaded */
    }
  }
  timer = setInterval(async () => {
    if (!slideshow.value.open || !slideshow.value.playing) return
    const next = (slideshow.value.index + 1) % slideshowPhotos.value.length
    slideshow.value.index = next
    const upcoming = slideshowPhotos.value[(next + 1) % slideshowPhotos.value.length]
    if (upcoming) {
      try {
        await photos.ensureUrl(upcoming.id)
      } catch {
        /* prefetch only */
      }
    }
  }, 1000)
}

function stopSlideshow() {
  if (timer) {
    clearInterval(timer)
    timer = null
  }
}

onUnmounted(stopSlideshow)

async function onFilePicked(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (!file) return
  const takenAt = photoDate.value ? Date.parse(photoDate.value + 'T12:00:00') : Date.now()
  await photos.upload(file, takenAt)
}

async function openPhoto(p: RemotePhoto) {
  viewer.value = { open: true, photo: p, url: '' }
  viewer.value.url = await photos.ensureUrl(p.id)
}

function confirmDelete() {
  const p = viewer.value.photo
  if (!p) return
  $q.dialog({
    title: 'Delete photo?',
    message: `Remove the photo from ${formatDate(p.taken_at)} everywhere?`,
    cancel: true,
  }).onOk(async () => {
    await photos.remove(p.id)
    viewer.value.open = false
  })
}

function formatDate(ms: number) {
  return new Date(ms).toLocaleDateString()
}

// Small thumb component: lazily fetches its blob URL with the Bearer token.
const PhotoThumb = defineComponent({
  props: { photo: { type: Object as PropType<RemotePhoto>, required: true } },
  emits: ['open'],
  setup(props, { emit }) {
    const url = ref(photos.urls[props.photo.id] || '')
    onMounted(async () => {
      try {
        url.value = await photos.ensureUrl(props.photo.id)
      } catch {
        url.value = ''
      }
    })
    return () =>
      h(
        'div',
        {
          style:
            'width: 140px; height: 140px; cursor: pointer; overflow: hidden; border-radius: 6px; background: #eceff1',
          onClick: () => emit('open'),
        },
        url.value
          ? [h('img', { src: url.value, style: 'width: 100%; height: 100%; object-fit: cover; display: block' })]
          : [],
      )
  },
})
</script>

<style scoped>
.timeline {
  position: relative;
  padding-left: 8px;
}
.timeline-row {
  position: relative;
  display: flex;
  gap: 16px;
  padding-bottom: 20px;
}
.timeline-row::before {
  content: '';
  position: absolute;
  left: 27px;
  top: 56px;
  bottom: 0;
  width: 2px;
  background: #cfd8dc;
}
.timeline-row:last-child::before {
  display: none;
}
.timeline-bubble {
  flex: 0 0 56px;
  height: 56px;
  border-radius: 50%;
  background: #eceff1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: background 0.2s, color 0.2s, transform 0.2s;
  z-index: 1;
}
.timeline-bubble.open {
  background: var(--q-primary);
  color: white;
  transform: scale(1.06);
}
.bubble-day {
  font-size: 18px;
  font-weight: 600;
  line-height: 1;
}
.bubble-month {
  font-size: 11px;
  text-transform: uppercase;
}
.timeline-body {
  flex: 1;
  min-width: 0;
}
.expand-enter-active,
.expand-leave-active {
  transition: opacity 0.25s ease, transform 0.25s ease;
}
.expand-enter-from,
.expand-leave-to {
  opacity: 0;
  transform: translateY(-6px);
}
.slideshow {
  width: 100%;
  height: 100%;
  background: black;
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
}
.slideshow-img {
  max-width: 100%;
  max-height: 100%;
  object-fit: contain;
  transition: opacity 0.3s ease;
}
.slideshow-caption {
  position: absolute;
  bottom: 24px;
  left: 0;
  right: 0;
  text-align: center;
  color: white;
  text-shadow: 0 1px 4px rgba(0, 0, 0, 0.8);
  font-size: 15px;
}
.slideshow-close {
  position: absolute;
  top: 16px;
  right: 16px;
}
</style>
