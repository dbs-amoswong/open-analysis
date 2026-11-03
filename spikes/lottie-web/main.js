import lottie from 'lottie-web'
import animationData from '../lottie-assets/spike.json'

const start = performance.now()
const animation = lottie.loadAnimation({
  container: document.getElementById('root'),
  renderer: 'svg',
  loop: true,
  autoplay: true,
  animationData,
})

animation.addEventListener('DOMLoaded', () => {
  window.__spike = {
    lib: 'lottie-web',
    mount_ms: Math.round(performance.now() - start),
    renderer: 'svg',
    format: 'json',
    frames: animation.totalFrames,
  }
  document.getElementById('status').textContent =
    `Loaded in ${window.__spike.mount_ms} ms · ${window.__spike.frames} frames · lottie-web ${animation.version ?? ''}`.trim()
})
