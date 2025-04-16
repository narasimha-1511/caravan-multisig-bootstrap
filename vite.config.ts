import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import wasm from 'vite-plugin-wasm'
import topLevelAwait from 'vite-plugin-top-level-await'
import tailwindcss from '@tailwindcss/vite'
import { nodePolyfills } from 'vite-plugin-node-polyfills'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    wasm(),
    topLevelAwait(),
    tailwindcss(),
    nodePolyfills({
      globals: {
        Buffer: true,
        process: true
      },
      protocolImports: true
    })
  ],
  optimizeDeps: {
    exclude: ['@noble/secp256k1']
  }
})
