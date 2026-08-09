import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import { fileURLToPath } from 'node:url'

const frontendNodeModules = fileURLToPath(
  new URL('./node_modules/', import.meta.url),
)

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@testing-library/jest-dom/vitest': `${frontendNodeModules}@testing-library/jest-dom/vitest.js`,
      '@testing-library/react': `${frontendNodeModules}@testing-library/react/dist/@testing-library/react.esm.js`,
      '@testing-library/user-event': `${frontendNodeModules}@testing-library/user-event/dist/esm/index.js`,
    },
    dedupe: ['react', 'react-dom', 'react-router', 'react-router-dom'],
  },
  server: {
    proxy: {
      '/api': 'http://127.0.0.1:8000',
    },
    fs: {
      allow: ['..'],
    },
  },
  test: {
    environment: 'jsdom',
    include: ['../tests/frontend/**/*.test.tsx'],
    setupFiles: '../tests/frontend/setup.ts',
  },
})
