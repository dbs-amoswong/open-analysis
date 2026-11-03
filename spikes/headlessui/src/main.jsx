import React, { useEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { Dialog, DialogBackdrop, DialogPanel, DialogTitle, DialogDescription } from '@headlessui/react'

const start = performance.now()

function report() {
  const dialog = document.querySelector('[role="dialog"]')
  window.__spike = {
    lib: 'headlessui',
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
  const [open, setOpen] = useState(true)
  useEffect(() => {
    const id = requestAnimationFrame(() => setTimeout(report, 100))
    return () => cancelAnimationFrame(id)
  }, [])

  return (
    <Dialog open={open} onClose={() => setOpen(false)}>
      <DialogBackdrop className="dialog-backdrop" />
      <div className="dialog-backdrop" style={{ background: 'transparent' }}>
        <DialogPanel className="dialog">
          <DialogTitle>Headless UI dialog</DialogTitle>
          <DialogDescription>This dialog is rendered by Headless UI.</DialogDescription>
          <div className="dialog-actions">
            <button type="button" className="demo-button" onClick={() => setOpen(false)}>Close</button>
          </div>
        </DialogPanel>
      </div>
    </Dialog>
  )
}

createRoot(document.getElementById('root')).render(<App />)
