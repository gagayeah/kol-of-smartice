import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import fs from 'node:fs'
import path from 'node:path'

// GitHub Pages 专用构建配置
export default defineConfig({
  plugins: [
    react(),
    // 自定义插件：复制 share.html 模板
    {
      name: 'copy-share-template',
      closeBundle() {
        const src = path.resolve('public/share.html')
        const dest = path.resolve('dist-web/share.html')
        if (!fs.existsSync('dist-web')) {
          fs.mkdirSync('dist-web', { recursive: true })
        }
        if (fs.existsSync(src)) {
          fs.copyFileSync(src, dest)
          console.log('✅ share.html 已复制到 dist-web')
        }
      },
    },
  ],
  base: '/kol-of-smartice/', // GitHub Pages 仓库名称
  build: {
    outDir: 'dist-web',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        main: './index.html'
      }
    }
  },
  server: {
    port: 5173,
  },
})