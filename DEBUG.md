# 爬虫测试调试指南

## 1. 检查浏览器开发者工具

在应用中按 `Cmd+Option+I` 打开开发者工具,查看Console标签页。

## 2. 测试步骤

### 测试1: 检查数据是否正确
1. 打开"更新互动数据"弹窗
2. 查看"将要更新的博主"列表
3. 确认:
   - 博主状态是否为"已发布"
   - 是否显示有小红书链接
   - 数量是否正确

### 测试2: 查看爬虫启动情况
1. 点击"开始更新"按钮
2. 观察:
   - 是否打开了Chrome浏览器窗口?
   - 进度条是否开始移动?
   - 浏览器是否访问小红书?

### 测试3: 查看控制台输出
在开发者工具Console中搜索:
- `[爬虫启动]`
- `[前端]`
- `error`
- 任何红色的错误信息

## 3. 常见问题

### 问题1: 没有可更新的博主
**原因**: 博主状态不是"已发布"或没有小红书链接
**解决**:
1. 在博主列表中,将状态改为"已发布"
2. 确保填写了小红书笔记链接(xhsLink字段)

### 问题2: 浏览器没有打开
**原因**: Playwright未正确安装
**解决**: 在终端运行:
```bash
cd /Users/gaga/Desktop/博主追踪系统/blogger-tracker
npx playwright install chromium
```

### 问题3: 爬虫启动但提取不到数据
**原因**: 小红书页面结构与预期不符
**解决**: 需要调整爬虫代码中的选择器

## 4. 获取帮助

请提供以下信息:
1. 开发者工具Console中的错误信息
2. "更新互动数据"弹窗显示的博主数量
3. 点击"开始更新"后的现象(浏览器是否打开等)
4. 一个真实的小红书笔记链接(用于测试)

---

## 开发日志

### 2025-10-16: 修复Preload脚本加载问题 ✅

**问题描述:**
- Electron应用中`window.electron`始终为`undefined`
- Preload脚本无法正常加载,导致所有IPC通信功能失效
- 爬虫功能、数据库操作、文件操作等核心功能全部无法使用

**根本原因:**
1. `package.json`中的`"type": "module"`导致所有.js文件都被Node.js视为ES模块
2. Electron的preload脚本使用`require()`加载,不支持ES模块格式
3. Vite构建工具无论如何配置,都会在编译后的文件中混入ES模块语法(`import`/`export`)

**尝试过的失败方案:**
- ❌ 在vite.config.js中设置`format: 'cjs'` - 依然生成了ES模块语法
- ❌ 设置`external: ['electron']` - 仍然使用`import`引入外部依赖
- ❌ 添加各种rollupOptions配置 - 无法阻止Vite混合ES/CJS语法
- ❌ 禁用sandbox模式 - 不是根本问题

**最终解决方案:**
1. 将`electron/preload.js`重命名为`electron/preload.cjs`(.cjs扩展名明确表示CommonJS)
2. 修改`electron/main.js`,在开发模式下**绕过Vite构建**,直接加载源文件:
   ```javascript
   const preloadPath = VITE_DEV_SERVER_URL
     ? path.join(__dirname, '../electron/preload.cjs')  // 开发模式:源文件
     : path.join(__dirname, 'preload.cjs');             // 生产模式:编译后
   ```
3. 在vite.config.js中移除preload的构建配置(开发模式不需要构建)

**修改的文件:**
- `electron/preload.js` → `electron/preload.cjs` (重命名+改用`require()`)
- `electron/main.js` (添加开发/生产模式的preload路径判断)
- `vite.config.js` (移除preload构建配置)

**验证结果:**
- ✅ `window.electron`成功注入
- ✅ 所有IPC通信API可用(db, file, crawler, notification)
- ✅ 爬虫功能可以正常启动
- ✅ Playwright浏览器窗口能够正常打开

**遗留问题:**
- ⚠️ 小红书需要登录才能查看数据,爬虫目前会因登录验证失败
- 📝 需要实现登录状态保持(cookies/session管理)
- 📝 生产模式下的preload.cjs编译方案需要进一步测试

---

### 2025-10-16: 优化小红书爬虫登录和数据提取 🔧

**问题描述:**
- 爬虫启动后只有3-5秒让用户登录，时间不够
- 即使成功登录，也提示"成功"但实际没有提取到数据
- 用户无法判断是登录失败还是数据提取失败

**解决方案:**

1. **延长登录时间 (crawler.js:56-72)**
   - 为第一个博主提供60秒的登录时间窗口
   - 添加`isFirstRun`参数，只在处理第一个博主时等待登录
   - 登录后验证登录状态，确保真正登录成功

2. **智能登录状态检测 (crawler.js:23-37)**
   ```javascript
   async function checkLoginStatus(page) {
     const loginRequired = await page.evaluate(() => {
       const loginTexts = ['登录', '请先登录', '立即登录', '去登录'];
       const bodyText = document.body.innerText;
       return loginTexts.some(text => bodyText.includes(text));
     });
     return loginRequired;
   }
   ```

3. **调试截图功能 (crawler.js:77-81)**
   - 每次爬取都保存页面截图到桌面
   - 文件名格式: `xiaohongshu-debug-[时间戳].png`
   - 方便用户检查页面实际状态

4. **智能数据提取 (crawler.js:84-179)**
   - 不再依赖固定的CSS选择器
   - 遍历页面所有元素，通过class名和文本内容智能识别互动数据
   - 识别关键字：
     - 点赞: `like`, `zan`, `赞`, `praise`
     - 收藏: `collect`, `star`, `favorite`, `收藏`
     - 评论: `comment`, `chat`, `评论`
     - 分享: `share`, `forward`, `分享`, `转发`
   - 支持数字单位解析：`w`, `W`, `万`, `千`, `百`

5. **数据有效性验证 (crawler.js:184-196)**
   - 检查是否至少提取到一项有效数据
   - 如果数据全为0，输出警告信息和调试数据
   - 不抛出错误，但标记`_warning`字段提醒用户

**修改的文件:**
- `electron/crawler.js` (多处修改)

**测试说明:**
用户需要测试以下流程：
1. 点击"开始更新"按钮
2. 浏览器打开后，有60秒时间完成小红书登录
3. 登录成功后，系统会自动继续爬取
4. 查看终端输出，确认是否提取到数据
5. 检查桌面截图文件，查看页面实际状态

**预期效果:**
- ✅ 充足的登录时间（60秒）
- ✅ 明确的登录状态反馈
- ✅ 详细的数据提取日志
- ✅ 截图辅助调试
- ✅ 准确的成功/失败判断

---

### 2025-10-16: 实现Cookie持久化，保持登录状态 🔧

**问题描述:**
- 第一次爬取需要登录，成功后可以获取数据
- 第二次爬取时又需要重新登录，Cookie没有保存
- 用户在其他地方（查看笔记链接）使用系统浏览器可以保持登录

**根本原因:**
Playwright每次启动都创建全新的浏览器上下文，没有持久化Cookie和登录状态。

**解决方案:**
使用 `chromium.launchPersistentContext()` 替代 `chromium.launch()` + `newContext()`

**修改内容 (crawler.js:257-286):**

```javascript
// 设置用户数据目录，用于持久化Cookie和登录状态
const userDataDir = `${process.env.HOME}/Library/Application Support/blogger-tracker/playwright-data`;
console.log(`[爬虫启动] 使用用户数据目录: ${userDataDir}`);

// 启动浏览器，使用持久化上下文
context = await chromium.launchPersistentContext(userDataDir, {
  headless: CRAWLER_CONFIG.headless,
  userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36...',
  viewport: { width: 1280, height: 800 },
  locale: 'zh-CN',
  timezoneId: 'Asia/Shanghai',
  args: [
    '--disable-blink-features=AutomationControlled',
    '--disable-dev-shm-usage',
    '--no-sandbox',
  ],
});

const page = context.pages()[0] || await context.newPage();
```

**技术要点:**
- `launchPersistentContext()` 会将Cookie、LocalStorage、IndexedDB等持久化到指定目录
- 首次登录后，后续运行会自动加载保存的登录状态
- 用户数据目录：`~/Library/Application Support/blogger-tracker/playwright-data`
- 与系统浏览器Cookie分离，不会互相干扰

**预期效果:**
- ✅ 第一次运行：需要登录（60秒时间窗口）
- ✅ 后续运行：自动使用保存的登录状态，无需重新登录
- ✅ 即使关闭应用，登录状态依然保留

**测试说明:**
1. **清空旧的登录数据**（如果之前测试过）：
   ```bash
   rm -rf ~/Library/Application\ Support/blogger-tracker/playwright-data
   ```
2. **第一次测试**：点击"开始更新"，在60秒内完成登录
3. **第二次测试**：再次点击"开始更新"，应该直接开始爬取，不再要求登录

---

### 2025-10-16: 优化爬虫速度，大幅缩短处理时间 ⚡

**问题描述:**
- Cookie持久化成功后，发现每个博主需要10-13秒
- 100个博主需要17-22分钟，太慢了
- 主要时间消耗：页面加载等待5秒 + 截图2秒 + 随机延迟2-5秒

**优化方案:**

1. **缩短随机延迟 (crawler.js:6-8)**
   ```javascript
   minDelay: 500,    // 从2000ms减少到500ms
   maxDelay: 1500,   // 从5000ms减少到1500ms
   ```

2. **优化页面加载策略 (crawler.js:47-49)**
   ```javascript
   await page.goto(noteUrl, {
     waitUntil: 'domcontentloaded', // 从'networkidle'改为'domcontentloaded'
     timeout: CRAWLER_CONFIG.timeout
   });
   ```
   - `domcontentloaded`: DOM加载完成即可，不等待所有图片/样式
   - `networkidle`: 等待所有网络请求完成（更慢）

3. **减少等待时间 (crawler.js:53, 84)**
   - 页面基本加载：从 2000ms → 800ms
   - 互动数据加载：从 3000ms → 1000ms

4. **截图改为可选 (crawler.js:14, 87-92)**
   ```javascript
   enableScreenshot: false, // 生产环境关闭，节省2秒/博主
   ```

**优化效果对比:**

| 项目 | 优化前 | 优化后 | 节省 |
|------|--------|--------|------|
| 页面加载等待 | 5秒 | 1.8秒 | 3.2秒 |
| 截图时间 | 2秒 | 0秒 | 2秒 |
| 随机延迟 | 2-5秒 | 0.5-1.5秒 | 1.5-3.5秒 |
| **单个博主总耗时** | **10-13秒** | **约3-4秒** | **7-9秒** |
| **100个博主** | **17-22分钟** | **5-7分钟** | **节省12-15分钟** |

**配置说明:**
- 如需调试截图，修改 `CRAWLER_CONFIG.enableScreenshot: true`
- 如需更保守的延迟（避免被识别为机器人），可适当增加 `minDelay` 和 `maxDelay`

**风险控制:**
- 保持User-Agent模拟真实浏览器
- 保持登录状态持久化
- 随机延迟依然存在，只是缩短了
- 建议分批爬取（如每次20-30个），避免短时间大量请求

---

### 2025-10-16: 修复数据提取精度问题，使用精确选择器 ✅

**问题描述:**
- 智能识别会误提取混合文本，例如把 "8可以添加到收藏夹啦" 提取成 "218"
- 原因：父元素包含多个子元素的文本拼接在一起
- 数据不准确：点赞21、收藏8、评论3 被识别成 点赞21、收藏218、评论3

**问题分析:**
通过开发者工具检查小红书页面结构，发现：
```html
点赞：<span class="count">21</span>
收藏：<span class="count">8</span>
评论：<span class="count">3</span>
```
所有互动数据都使用 `span.count` 元素，通过父元素的class来区分类型。

**解决方案 (crawler.js:96-173):**
```javascript
// 查找所有 class="count" 的 span 元素
const countElements = document.querySelectorAll('span.count');

countElements.forEach(el => {
  const text = el.textContent?.trim() || '';
  const parent = el.parentElement;
  const parentClass = parent?.className?.toLowerCase() || '';

  // 根据父元素class判断数据类型
  if (parentClass.includes('like')) {
    result.likes = parseNumberWithUnit(text);
  } else if (parentClass.includes('collect')) {
    result.favorites = parseNumberWithUnit(text);
  } else if (parentClass.includes('chat')) {
    result.comments = parseNumberWithUnit(text);
  } else if (parentClass.includes('share')) {
    result.shares = parseNumberWithUnit(text);
  }
});
```

**优势:**
- ✅ 只提取 `span.count` 内的纯数字，不会混入其他文字
- ✅ 通过父元素class精确判断数据类型
- ✅ 代码更简洁，逻辑更清晰
- ✅ 支持各种数字格式（1.2w、3000、500等）

**测试结果:**
- 点赞：21 ✅
- 收藏：8 ✅
- 评论：3 ✅
- 分享：0 ✅

**调试技巧:**
添加了调试模式配置，方便后续调试：
- `debugMode: true` - 爬取完成后浏览器不关闭
- `enableScreenshot: true` - 保存页面截图到桌面
- 开发者工具检查元素 - 获取精确的HTML结构

**技术要点:**
- Electron preload脚本必须使用CommonJS格式(`require`/`module.exports`)
- 在`"type": "module"`的项目中,使用.cjs扩展名可以强制文件为CommonJS
- 开发模式下可以绕过构建工具直接加载源文件,提高开发效率
- `contextBridge.exposeInMainWorld()`在preload脚本执行时`window`对象可能尚未完全初始化

**经验总结:**
当Electron与现代前端构建工具(Vite/Webpack)结合时,ES模块和CommonJS的兼容性是一个常见陷阱。对于preload这类特殊脚本,有时最简单的方案(直接加载源文件)反而是最可靠的。
