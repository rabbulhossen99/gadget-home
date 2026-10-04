'use client'

// Registered at client module-eval time (not inside an effect) so it is active
// as early as possible during hydration. React does not execute inline <script>
// children rendered by components, so this client module is the correct place
// for a global handler. Rejections carrying a real reason are logged; empty /
// undefined ones (emitted by the dev/HMR harness and browser tooling) are
// absorbed so they don't surface as phantom runtime errors.

declare global {
  interface Window {
    __v0RejectionGuardInstalled?: boolean
  }
}

if (typeof window !== 'undefined' && !window.__v0RejectionGuardInstalled) {
  window.__v0RejectionGuardInstalled = true

  window.addEventListener('unhandledrejection', (event) => {
    const reason = event.reason
    const isEmpty =
      reason == null ||
      (typeof reason === 'object' &&
        !('message' in reason) &&
        !('stack' in reason) &&
        Object.keys(reason as object).length === 0)

    if (isEmpty) {
      event.preventDefault()
      return
    }

    console.error('[v0] Unhandled rejection:', reason)
  })
}

export function GlobalErrorGuard() {
  return null
}
