import React, { useEffect } from 'react'
import { createRoot } from 'react-dom/client'
import { Dialog } from '@ark-ui/react'

const start = performance.now()

function report() {
  const dialog = document.querySelector('[role="dialog"]')
  window.__spike = {
    lib: 'ark-ui',
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
  useEffect(() => {
    const id = requestAnimationFrame(() => setTimeout(report, 100))
    return () => cancelAnimationFrame(id)
  }, [])

  return (
    <Dialog.Root defaultOpen>
      <Dialog.Trigger className="demo-button">Open dialog</Dialog.Trigger>
      <Dialog.Backdrop className="dialog-backdrop" />
      <Dialog.Positioner className="dialog-backdrop" style={{ background: 'transparent' }}>
        <Dialog.Content className="dialog">
          <Dialog.Title>Ark UI dialog</Dialog.Title>
          <Dialog.Description>This dialog is rendered by Ark UI.</Dialog.Description>
          <div className="dialog-actions">
            <Dialog.CloseTrigger className="demo-button">Close</Dialog.CloseTrigger>
          </div>
        </Dialog.Content>
      </Dialog.Positioner>
    </Dialog.Root>
  )
}

createRoot(document.getElementById('root')).render(<App />)
