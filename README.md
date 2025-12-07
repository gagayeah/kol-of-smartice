# 📊 博主追踪系统

一款专为营销团队设计的博主进度追踪桌面应用，支持多项目管理、Excel导入、智能回执解析等功能。

## ✨ 核心功能

### 1. 多项目管理
- 创建、切换、删除项目
- 标签页式项目切换
- 项目数据完全隔离

### 2. Excel数据导入
- 支持 `.xlsx`、`.xls`、`.csv` 格式
- 智能识别10+种列名格式
- 自动去重（昵称+主页链接）
- 拖拽上传，即时反馈

### 3. 智能回执解析
- 自动识别小红书、抖音、大众点评链接
- 批量解析博主回执
- 一键更新博主状态和发布链接

### 4. 博主状态管理
- 4种状态：待审核、改稿中、已定稿、已发布
- 单个/批量修改状态
- 自动记录发布时间

### 5. 搜索与筛选
- 搜索昵称或链接
- 按状态筛选
- 实时搜索结果

### 6. 数据导出
- 一键导出Excel文件
- 保留所有博主数据
- 自动命名（项目名_日期）

## 🚀 安装使用

### macOS用户

1. **下载安装包**
   - 打开桌面上的 `博主追踪系统-1.0.0-arm64.dmg`

2. **安装应用**
   - 拖拽应用到 `Applications` 文件夹
   - 首次打开可能需要在"系统设置-隐私与安全性"中允许运行

3. **开始使用**
   - 创建第一个项目
   - 导入Excel博主数据或添加测试数据

## 📝 使用指南

### Excel导入格式

**必填列：**
- 昵称（或：nickname、名称、博主昵称）

**可选列：**
- 粉丝数（或：followers、粉丝）
- 主页链接（或：链接、主页、小红书链接、url）

**示例：**
```
昵称          | 粉丝数  | 主页链接
快乐肥仔gaga   | 15000  | https://xiaohongshu.com/user/abc123
美食探店小王   | 8500   | https://xiaohongshu.com/user/def456
```

### 智能回执格式

支持批量粘贴，用**空行**分隔不同博主：

```
快乐肥仔gaga
宁桂杏江油店打卡！... http://xhslink.com/abc
http://dpurl.cn/xyz
https://v.douyin.com/123/

美食探店小王
江油肥肠体验分享 http://xhslink.com/def
```

## 💾 数据存储

- **数据库位置**：`~/Library/Application Support/blogger-tracker/blogger-tracker.db`
- **数据类型**：SQLite数据库
- **备份建议**：定期备份数据库文件

## 🛠️ 技术栈

- **框架**：Electron + React 19
- **UI库**：Ant Design 5
- **数据库**：better-sqlite3
- **构建工具**：Vite 7
- **打包工具**：electron-builder

## 📦 开发命令

```bash
# 安装依赖
npm install

# 开发模式（Electron窗口）
npm run dev

# 打包macOS应用
npm run build:mac

# 浏览器开发模式（使用LocalStorage）
npm run dev
# 然后访问 http://localhost:5173
```

## 🐛 常见问题

### Q: 首次打开提示"无法打开"？
A: 前往"系统设置 - 隐私与安全性"，点击"仍要打开"。

### Q: 数据会丢失吗？
A: 数据存储在本地SQLite数据库，不会丢失。建议定期备份数据库文件。

### Q: 如何重置数据？
A: 删除 `~/Library/Application Support/blogger-tracker/blogger-tracker.db` 文件，重启应用即可。

### Q: 支持Windows吗？
A: 当前仅支持macOS ARM64，需要Windows版本请联系开发者。

## 📄 许可证

本项目仅供内部使用，未经授权请勿传播。

## 📞 技术支持

如有问题，请查看 `DEVLOG.md` 开发日志或联系开发团队。

---

**版本**：v1.0.0
**最后更新**：2025-10-04
**开发者**：Claude Code 辅助开发
