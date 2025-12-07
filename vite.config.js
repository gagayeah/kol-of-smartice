import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import electron from 'vite-plugin-electron'
import fs from 'node:fs'
import path from 'node:path'
// import renderer from 'vite-plugin-electron-renderer'  // 暂时禁用,可能干扰preload加载

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    electron([
      {
        entry: 'electron/main.js',
        vite: {
          build: {
            outDir: 'dist-electron',
            rollupOptions: {
              external: ['better-sqlite3', 'playwright', 'playwright-core']
            }
          }
        }
      },
    ]),
    // 自定义插件：直接复制preload文件
    {
      name: 'copy-preload',
      buildStart() {
        const destDir = path.resolve('dist-electron')
        if (!fs.existsSync(destDir)) {
          fs.mkdirSync(destDir, { recursive: true })
        }
        const src = path.resolve('electron/preload.cjs')
        const dest = path.resolve('dist-electron/preload.cjs')
        if (fs.existsSync(src)) {
          fs.copyFileSync(src, dest)
          console.log('✅ preload.cjs 已复制')
        }
      },
    },
    // 自定义插件：复制 share.html 模板
    {
      name: 'copy-share-template',
      closeBundle() {
        const src = path.resolve('public/share.html')
        const dest = path.resolve('dist/share.html')
        if (fs.existsSync(src)) {
          fs.copyFileSync(src, dest)
          console.log('✅ share.html 已复制到 dist')
        }
      },
    },
    // renderer(),  // 暂时禁用,可能干扰preload加载
  ],
  server: {
    port: 5173,
  },
})
