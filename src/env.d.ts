/// <reference types="vite/client" />

declare module '*.vue' {
  import type { DefineComponent } from 'vue'
  // Fallback shim for tools that cannot parse SFCs; vue-tsc itself resolves
  // .vue imports to their real component types.
  const component: DefineComponent<Record<string, unknown>, Record<string, unknown>, unknown>
  export default component
}

// type gap: leaflet ships no bundled TypeScript definitions and @types/leaflet
// is not installed, so the module (and everything imported from it) is `any`.
declare module 'leaflet'
