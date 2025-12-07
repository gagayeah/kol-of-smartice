import { app, BrowserWindow, ipcMain, dialog, Notification } from 'electron';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import * as db from './database.js';
import * as crawler from './crawler.js';
import fs from 'node:fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// 开发模式下的Vite服务器地址
const VITE_DEV_SERVER_URL = process.env.VITE_DEV_SERVER_URL;

let mainWindow = null;

function createWindow() {
  // 开发模式下直接使用源文件,生产模式使用编译后的文件
  const preloadPath = VITE_DEV_SERVER_URL
    ? path.join(__dirname, '../electron/preload.cjs')
    : path.join(__dirname, 'preload.cjs');

  console.log('🔍 [Main] __dirname:', __dirname);
  console.log('🔍 [Main] preload路径:', preloadPath);
  console.log('🔍 [Main] preload文件是否存在:', fs.existsSync(preloadPath));

  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1200,
    minHeight: 700,
    webPreferences: {
      preload: preloadPath,
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false,  // 禁用sandbox,确保preload脚本能正常加载
    },
    titleBarStyle: 'hiddenInset', // macOS优化：隐藏标题栏
    trafficLightPosition: { x: 15, y: 15 }, // macOS红绿灯位置
  });

  // 监听preload错误
  mainWindow.webContents.on('preload-error', (event, preloadPath, error) => {
    console.error('❌ [Main] Preload脚本加载失败!');
    console.error('[Main] Preload路径:', preloadPath);
    console.error('[Main] 错误详情:', error);
  });

  // 监听页面加载完成
  mainWindow.webContents.on('did-finish-load', () => {
    console.log('✅ [Main] 页面加载完成');
    // 检查preload是否成功执行
    mainWindow.webContents.executeJavaScript('typeof window.electron !== "undefined"')
      .then(hasElectron => {
        console.log('[Main] window.electron是否存在:', hasElectron);
        if (!hasElectron) {
          console.error('❌ [Main] window.electron未注入! Preload脚本可能没有执行!');
        }
      });
  });

  // 开发模式加载Vite服务器，生产模式加载打包文件
  if (VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(VITE_DEV_SERVER_URL);
    mainWindow.webContents.openDevTools(); // 开发模式打开调试工具
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
    mainWindow.webContents.openDevTools(); // 临时打开调试工具查看错误
  }
}

// 注册IPC处理器
function registerIpcHandlers() {
  // 数据库查询
  ipcMain.handle('db:query', async (event, sql, params) => {
    return db.query(sql, params);
  });

  // 数据库执行
  ipcMain.handle('db:run', async (event, sql, params) => {
    return db.run(sql, params);
  });

  // 选择Excel文件
  ipcMain.handle('file:select-excel', async () => {
    const result = await dialog.showOpenDialog(mainWindow, {
      properties: ['openFile'],
      filters: [
        { name: 'Excel文件', extensions: ['xlsx', 'xls', 'csv'] }
      ]
    });

    if (!result.canceled && result.filePaths.length > 0) {
      const filePath = result.filePaths[0];
      const fileBuffer = fs.readFileSync(filePath);
      return {
        success: true,
        data: fileBuffer.toString('base64'),
        filename: path.basename(filePath)
      };
    }
    return { success: false };
  });

  // 导出Excel文件
  ipcMain.handle('file:export-excel', async (event, base64Data, filename) => {
    const result = await dialog.showSaveDialog(mainWindow, {
      defaultPath: filename,
      filters: [
        { name: 'Excel文件', extensions: ['xlsx'] }
      ]
    });

    if (!result.canceled && result.filePath) {
      const buffer = Buffer.from(base64Data, 'base64');
      fs.writeFileSync(result.filePath, buffer);
      return { success: true, path: result.filePath };
    }
    return { success: false };
  });

  // 导出HTML分享文件
  ipcMain.handle('file:export-html', async (event, htmlContent, filename) => {
    const result = await dialog.showSaveDialog(mainWindow, {
      defaultPath: filename,
      filters: [
        { name: 'HTML文件', extensions: ['html'] }
      ]
    });

    if (!result.canceled && result.filePath) {
      fs.writeFileSync(result.filePath, htmlContent, 'utf-8');
      return { success: true, path: result.filePath };
    }
    return { success: false };
  });

  // 获取分享HTML模板路径
  ipcMain.handle('file:get-share-template-path', async () => {
    const templatePath = VITE_DEV_SERVER_URL
      ? path.join(__dirname, '../public/share.html')
      : path.join(process.resourcesPath, 'app.asar/dist/share.html');
    return templatePath;
  });

  // 读取文件内容
  ipcMain.handle('file:read', async (event, filePath) => {
    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      return { success: true, content };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  // 保存分享HTML文件
  ipcMain.handle('file:save-share-html', async (event, htmlContent, defaultFilename) => {
    const result = await dialog.showSaveDialog(mainWindow, {
      defaultPath: defaultFilename,
      filters: [
        { name: 'HTML文件', extensions: ['html'] }
      ]
    });

    if (!result.canceled && result.filePath) {
      fs.writeFileSync(result.filePath, htmlContent, 'utf-8');
      return { success: true, path: result.filePath };
    }
    return { success: false };
  });

  // 爬虫：爬取博主互动数据
  ipcMain.handle('crawler:crawl-bloggers', async (event, bloggers) => {
    try {
      console.log('[IPC] 收到爬虫请求，博主数量:', bloggers.length);

      // 进度回调函数
      const progressCallback = (progress) => {
        // 向渲染进程发送进度更新
        mainWindow.webContents.send('crawler:progress', progress);
      };

      const results = await crawler.crawlBloggers(bloggers, progressCallback);
      return { success: true, results };
    } catch (error) {
      console.error('[IPC] 爬虫执行失败:', error);
      return { success: false, error: error.message };
    }
  });

  // 获取博主历史互动数据
  ipcMain.handle('crawler:get-history', async (event, bloggerId, platform, days) => {
    try {
      const history = await crawler.getInteractionHistory(bloggerId, platform, days);
      return { success: true, history };
    } catch (error) {
      console.error('[IPC] 获取历史数据失败:', error);
      return { success: false, error: error.message };
    }
  });

  // 显示系统通知
  ipcMain.handle('notification:show', async (event, options) => {
    try {
      const notification = new Notification({
        title: options.title || '博主追踪系统',
        body: options.body || '',
        icon: options.icon || null,
        silent: options.silent || false,
      });

      notification.show();

      // 点击通知时聚焦到主窗口
      notification.on('click', () => {
        if (mainWindow) {
          if (mainWindow.isMinimized()) mainWindow.restore();
          mainWindow.focus();
        }
      });

      return { success: true };
    } catch (error) {
      console.error('[IPC] 显示通知失败:', error);
      return { success: false, error: error.message };
    }
  });
}

// 当 Electron 完成初始化时创建窗口
app.whenReady().then(() => {
  db.initDatabase(); // 初始化数据库
  registerIpcHandlers();
  createWindow();

  app.on('activate', () => {
    // macOS特性：点击dock图标时重新创建窗口
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

// 所有窗口关闭时退出应用（macOS除外）
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
