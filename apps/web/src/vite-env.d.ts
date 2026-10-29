/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** The backend's address for a build served from another origin. Empty in development. */
  readonly VITE_API_BASE?: string
}
