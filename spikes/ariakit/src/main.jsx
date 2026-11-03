import React, { useEffect } from 'react'
import { createRoot } from 'react-dom/client'
import {
  Dialog,
  DialogDescription,
  DialogDismiss,
  DialogDisclosure,
  DialogHeading,
  useDialogStore,
} from '@ariakit/react'

const start = performance.now()

function report() {
  const dialog = document.querySelector('[role="dialog"]')
  window.__spike = {
    lib: 'ariakit',
    mount_ms: Math.round(performance.now() - start),
    dialog: Boolean(dialog),
    ariaModal: dialog?.getAttribute('aria-modal') ?? null,
    activeElement: document.activeElement?.tagName ?? null,
    react: React.version,
  }
  document.getElementById('status').textContent =
    `Mounted in ${window.__spike.mount_ms} ms · dialog ${window.__spike.dialog ? 'open' : 'missing'} · aria-modal ${window.__spike.ariaModal}`
}

function App() {
  const dialog = useDialogStore({ open: true })
  useEffect(() => {
    const id = requestAnimationFrame(() => setTimeout(report, 100))
    return () => cancelAnimationFrame(id)
  }, [])

  return (
    <>
      <DialogDisclosure store={dialog} className="demo-button">Open dialog</DialogDisclosure>
      <Dialog store={dialog} className="dialog" backdrop={<div className="dialog-backdrop" />}>
        <DialogHeading>Ark UI dialog</DialogHeading>
        <DialogDescription>This dialog is rendered by Ariakit.</DialogDescription>
        <div className="dialog-actions">
          <DialogDismiss className="demo-button">Close</DialogDismiss>
        </div>
      </Dialog>
    </>
  )
}

createRoot(document.getElementById('root')).render(<App />)
