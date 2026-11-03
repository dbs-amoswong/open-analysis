import React, { useEffect } from 'react'
import { createRoot } from 'react-dom/client'
import { Button, Dialog, DialogTrigger, Heading, Modal, Text } from 'react-aria-components'

const start = performance.now()

function report() {
  const dialog = document.querySelector('[role="dialog"]')
  window.__spike = {
    lib: 'react-aria-components',
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
    <DialogTrigger defaultOpen>
      <Button className="demo-button">Open dialog</Button>
      <Modal className="dialog-backdrop">
        <Dialog className="dialog">
          <Heading slot="title">React Aria dialog</Heading>
          <Text slot="description">This dialog is rendered by React Aria Components.</Text>
          <div className="dialog-actions">
            <Button className="demo-button" slot="close">Close</Button>
          </div>
        </Dialog>
      </Modal>
    </DialogTrigger>
  )
}

createRoot(document.getElementById('root')).render(<App />)
