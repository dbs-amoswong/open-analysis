import { copyFile, mkdir } from 'node:fs/promises'
import path from 'node:path'

const source = path.resolve('node_modules/@lottiefiles/dotlottie-web/dist')
const target = path.resolve('../lottie-assets')
await mkdir(target, { recursive: true })
for (const file of ['dotlottie-player.wasm', 'dotlottie.worker.js']) {
  await copyFile(path.join(source, file), path.join(target, file))
  console.log(`copied ${file}`)
}
