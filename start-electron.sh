#!/bin/bash

echo "🚀 启动多项目博主管理系统..."

# 清理可能存在的进程
pkill -f "vite\|electron" 2>/dev/null || true
sleep 2

# 启动 Vite 开发服务器（后台运行）
echo "📡 启动 Vite 开发服务器..."
npm run dev &
VITE_PID=$!

# 等待 Vite 服务器启动
echo "⏳ 等待 Vite 服务器启动..."
sleep 5

# 等待更长时间确保 Vite 服务器完全启动
echo "⏳ 等待 Vite 服务器完全启动..."
sleep 3

# 直接启动 Electron 应用（跳过检查）
echo "✅ Vite 服务器已启动"
echo "🖥️ 启动 Electron 桌面应用..."
VITE_DEV_SERVER_URL=http://localhost:5173 npx electron dist-electron/main.js

# 清理
kill $VITE_PID 2>/dev/null || true