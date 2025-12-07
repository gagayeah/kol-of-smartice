const { contextBridge, ipcRenderer } = require('electron');

console.log('🔧 [Preload] preload.js 开始执行...');

// 向渲染进程暴露安全的API
contextBridge.exposeInMainWorld('electron', {
  // 数据库操作
  db: {
    query: (sql, params) => ipcRenderer.invoke('db:query', sql, params),
    run: (sql, params) => ipcRenderer.invoke('db:run', sql, params),
  },
  // 文件操作
  file: {
    selectExcel: () => ipcRenderer.invoke('file:select-excel'),
    exportExcel: (data, filename) => ipcRenderer.invoke('file:export-excel', data, filename),
    exportHtml: (htmlContent, filename) => ipcRenderer.invoke('file:export-html', htmlContent, filename),
    getShareTemplatePath: () => ipcRenderer.invoke('file:get-share-template-path'),
    readFile: (filePath) => ipcRenderer.invoke('file:read', filePath),
    saveShareHtml: (htmlContent, defaultFilename) => ipcRenderer.invoke('file:save-share-html', htmlContent, defaultFilename),
  },
  // 爬虫操作
  crawler: {
    crawlBloggers: (bloggers) => ipcRenderer.invoke('crawler:crawl-bloggers', bloggers),
    getHistory: (bloggerId, platform, days) => ipcRenderer.invoke('crawler:get-history', bloggerId, platform, days),
    // 监听爬虫进度
    onProgress: (callback) => {
      ipcRenderer.on('crawler:progress', (event, progress) => callback(progress));
    },
    // 移除进度监听器
    removeProgressListener: () => {
      ipcRenderer.removeAllListeners('crawler:progress');
    },
  },
  // 系统通知
  notification: {
    show: (options) => ipcRenderer.invoke('notification:show', options),
  },
});

console.log('✅ [Preload] window.electron 已成功注入!');
