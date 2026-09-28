import { useEffect, useRef } from 'react'

// Anything that can be "backed out of" without leaving the current page
// (an in-page form, a detail view, a picker) registers a handler here while
// it is open. The phone's back button / back gesture runs the most recently
// registered one first; only when none is left does the app go back a page.
const handlers = []

export function useBackHandler(fn, active = true) {
  const ref = useRef(fn)
  ref.current = fn

  useEffect(() => {
    if (!active) return
    const h = () => ref.current?.()
    handlers.push(h)
    return () => {
      const i = handlers.lastIndexOf(h)
      if (i >= 0) handlers.splice(i, 1)
    }
  }, [active])
}

// Returns true if something was closed.
export function runBackHandler() {
  // Bottom sheets / modals always sit on top of the page, so they close
  // first. Every one of them closes when its dimmed backdrop is clicked.
  const overlays = document.querySelectorAll('.sheet-overlay, .modal-overlay')
  if (overlays.length) {
    overlays[overlays.length - 1].click()
    return true
  }
  // Then in-page sub-views (forms, detail views), most recent first.
  if (handlers.length) {
    handlers[handlers.length - 1]()
    return true
  }
  return false
}
