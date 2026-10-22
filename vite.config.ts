import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  base: process.env.GITHUB_PAGES === 'true' ? '/json-treeview-online-tool/' : '/',
  server: {
    // Desktop on macOS often drops native file-change events, so Vite never
    // sees a save and keeps serving the previous files until a restart.
    watch: {
      usePolling: true,
      interval: 150,
    },
  },
})
