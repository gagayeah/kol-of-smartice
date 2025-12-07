import { chromium } from 'playwright';
import { run as dbRun, query as dbQuery } from './database.js';

// 爬虫配置
const CRAWLER_CONFIG = {
  // 每个链接之间的随机延迟(毫秒) - 优化后缩短延迟
  minDelay: 500,    // 从2000ms减少到500ms
  maxDelay: 1500,   // 从5000ms减少到1500ms
  // 页面超时时间
  timeout: 30000,
  // 浏览器设置
  headless: false, // 设置为false可以看到浏览器操作,调试时很有用
  // 是否保存截图（调试用，生产环境可关闭）
  enableScreenshot: false, // 生产环境关闭截图以提高速度
  // 调试模式：完成后不关闭浏览器，方便查看页面
  debugMode: false, // 生产环境关闭调试模式
};

// 生成随机延迟
function randomDelay() {
  const delay = Math.floor(
    Math.random() * (CRAWLER_CONFIG.maxDelay - CRAWLER_CONFIG.minDelay) + CRAWLER_CONFIG.minDelay
  );
  return new Promise(resolve => setTimeout(resolve, delay));
}

// 检查是否需要登录
async function checkLoginStatus(page) {
  try {
    // 检查是否有登录提示或登录按钮
    const loginRequired = await page.evaluate(() => {
      // 检查常见的登录相关元素
      const loginTexts = ['登录', '请先登录', '立即登录', '去登录'];
      const bodyText = document.body.innerText;
      return loginTexts.some(text => bodyText.includes(text));
    });
    return loginRequired;
  } catch (error) {
    return false;
  }
}

// 小红书爬虫 - 从笔记链接提取互动数据
async function crawlXiaohongshu(noteUrl, page, isFirstRun = false) {
  console.log(`[小红书爬虫] 开始爬取: ${noteUrl}`);

  try {
    // 访问笔记页面 - 优化：使用domcontentloaded而不是networkidle
    await page.goto(noteUrl, {
      waitUntil: 'domcontentloaded', // 更快，不等待所有网络请求
      timeout: CRAWLER_CONFIG.timeout
    });

    // 等待页面基本加载 - 优化：从2秒减少到800毫秒
    await page.waitForTimeout(800);

    // 检查是否需要登录
    const needLogin = await checkLoginStatus(page);

    if (needLogin && isFirstRun) {
      console.log('[小红书爬虫] ⚠️  检测到需要登录,请在浏览器中完成登录...');
      console.log('[小红书爬虫] 等待60秒供你登录...');

      // 等待60秒让用户登录
      await page.waitForTimeout(60000);

      // 再次检查登录状态
      const stillNeedLogin = await checkLoginStatus(page);
      if (stillNeedLogin) {
        throw new Error('登录超时或登录失败,请重试');
      }

      console.log('[小红书爬虫] ✅ 登录成功!');

      // 登录后重新加载页面
      await page.goto(noteUrl, {
        waitUntil: 'domcontentloaded',
        timeout: CRAWLER_CONFIG.timeout
      });
      await page.waitForTimeout(800);
    } else if (needLogin) {
      throw new Error('需要登录,但已经不是第一次运行。请重新开始更新流程');
    }

    // 等待互动数据加载 - 优化：从3秒减少到1秒
    await page.waitForTimeout(1000);

    // 截图（可选，调试用）
    if (CRAWLER_CONFIG.enableScreenshot) {
      console.log('[小红书爬虫] 正在截图保存页面...');
      const screenshotPath = `${process.env.HOME}/Desktop/xiaohongshu-debug-${Date.now()}.png`;
      await page.screenshot({ path: screenshotPath, fullPage: false });
      console.log(`[小红书爬虫] 截图已保存到: ${screenshotPath}`);
    }

    // 使用精确的选择器提取互动数据
    const interactionData = await page.evaluate(() => {
      const result = {
        likes: 0,
        favorites: 0,
        comments: 0,
        shares: 0,
        debug: {
          foundElements: [],
          method: 'precise-selector'
        }
      };

      try {
        // 辅助函数:解析带单位的数字
        function parseNumberWithUnit(text) {
          if (!text) return 0;
          const match = text.trim().match(/(\d+(?:\.\d+)?)\s*([wW万千百]?)/);
          if (!match) return 0;

          let num = parseFloat(match[1]);
          const unit = match[2];

          if (unit === 'w' || unit === 'W' || unit === '万') {
            num *= 10000;
          } else if (unit === '千') {
            num *= 1000;
          } else if (unit === '百') {
            num *= 100;
          }

          return Math.floor(num);
        }

        // 策略1: 查找所有 class="count" 的 span 元素，通过父元素class判断类型
        const countElements = document.querySelectorAll('span.count');

        countElements.forEach(el => {
          const text = el.textContent?.trim() || '';
          const parent = el.parentElement;
          const parentClass = parent?.className?.toLowerCase() || '';

          result.debug.foundElements.push({
            text: text,
            parentClass: parentClass.substring(0, 50)
          });

          // 点赞
          if (parentClass.includes('like') || parentClass.includes('zan') || parentClass.includes('praise')) {
            const num = parseNumberWithUnit(text);
            if (num > result.likes) result.likes = num;
          }

          // 收藏
          else if (parentClass.includes('collect') || parentClass.includes('star') || parentClass.includes('favorite')) {
            const num = parseNumberWithUnit(text);
            if (num > result.favorites) result.favorites = num;
          }

          // 评论
          else if (parentClass.includes('chat') || parentClass.includes('comment')) {
            const num = parseNumberWithUnit(text);
            if (num > result.comments) result.comments = num;
          }

          // 分享
          else if (parentClass.includes('share') || parentClass.includes('forward')) {
            const num = parseNumberWithUnit(text);
            if (num > result.shares) result.shares = num;
          }
        });

      } catch (error) {
        result.debug.error = error.toString();
      }

      return result;
    });

    console.log(`[小红书爬虫] 提取到数据:`, interactionData);
    console.log(`[小红书爬虫] 调试信息:`, interactionData.debug);

    // 验证数据有效性
    const hasValidData = interactionData.likes > 0 ||
                        interactionData.favorites > 0 ||
                        interactionData.comments > 0;

    if (!hasValidData) {
      console.warn('[小红书爬虫] ⚠️  未提取到有效数据,可能需要调整选择器或检查登录状态');
      console.warn('[小红书爬虫] 找到的元素:', interactionData.debug.foundElements);
      console.warn('[小红书爬虫] 页面文本预览:', interactionData.debug.pageText);

      // 不抛出错误,但标记数据可能无效
      interactionData._warning = '未提取到有效数据,请检查截图';
    }

    // 移除debug信息
    delete interactionData.debug;

    return interactionData;

  } catch (error) {
    console.error(`[小红书爬虫] 爬取失败: ${error.message}`);
    throw error;
  }
}

// 保存互动数据到数据库
async function saveInteractionData(bloggerId, platform, data) {
  const now = Date.now();

  // 更新博主表的最新数据
  const updateFields = [];
  const updateValues = [];

  if (platform === 'xiaohongshu') {
    if (data.likes !== undefined) {
      updateFields.push('xhs_likes = ?');
      updateValues.push(data.likes);
    }
    if (data.favorites !== undefined) {
      updateFields.push('xhs_favorites = ?');
      updateValues.push(data.favorites);
    }
    if (data.comments !== undefined) {
      updateFields.push('xhs_comments = ?');
      updateValues.push(data.comments);
    }
    if (data.shares !== undefined) {
      updateFields.push('xhs_shares = ?');
      updateValues.push(data.shares);
    }
  }

  if (updateFields.length > 0) {
    updateFields.push('updated_at = ?');
    updateValues.push(now);
    updateValues.push(bloggerId);

    await dbRun(
      `UPDATE bloggers SET ${updateFields.join(', ')} WHERE id = ?`,
      updateValues
    );
  }

  // 保存历史记录
  await dbRun(
    `INSERT INTO interaction_history (blogger_id, platform, likes, favorites, comments, shares, recorded_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [bloggerId, platform, data.likes || 0, data.favorites || 0, data.comments || 0, data.shares || 0, now]
  );

  console.log(`[数据库] 已保存博主 ${bloggerId} 的 ${platform} 数据`);
}

// 主爬虫函数 - 批量爬取博主数据
export async function crawlBloggers(bloggers, progressCallback) {
  let context = null;
  const results = [];

  try {
    console.log('[爬虫启动] 准备启动浏览器...');

    // 设置用户数据目录，用于持久化Cookie和登录状态
    const userDataDir = `${process.env.HOME}/Library/Application Support/blogger-tracker/playwright-data`;
    console.log(`[爬虫启动] 使用用户数据目录: ${userDataDir}`);

    // 启动浏览器，使用持久化上下文
    context = await chromium.launchPersistentContext(userDataDir, {
      headless: CRAWLER_CONFIG.headless,
      // 设置真实的User-Agent
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      viewport: { width: 1280, height: 800 },
      // 模拟真实浏览器
      locale: 'zh-CN',
      timezoneId: 'Asia/Shanghai',
      // 使用真实的浏览器指纹
      args: [
        '--disable-blink-features=AutomationControlled',
        '--disable-dev-shm-usage',
        '--no-sandbox',
      ],
    });

    const page = context.pages()[0] || await context.newPage();

    console.log(`[爬虫启动] 浏览器已启动,开始爬取 ${bloggers.length} 个博主`);

    // 遍历博主列表
    for (let i = 0; i < bloggers.length; i++) {
      const blogger = bloggers[i];

      try {
        // 通知进度
        if (progressCallback) {
          progressCallback({
            current: i + 1,
            total: bloggers.length,
            blogger: blogger.nickname,
            status: 'processing',
          });
        }

        console.log(`\n[${i + 1}/${bloggers.length}] 处理博主: ${blogger.nickname}`);

        // 检查是否有小红书链接
        if (blogger.xhsLink && blogger.xhsLink.trim() !== '') {
          console.log(`  └─ 小红书链接: ${blogger.xhsLink}`);

          try {
            // 第一个博主时isFirstRun=true,允许登录时间
            const xhsData = await crawlXiaohongshu(blogger.xhsLink, page, i === 0);
            await saveInteractionData(blogger.id, 'xiaohongshu', xhsData);

            results.push({
              bloggerId: blogger.id,
              nickname: blogger.nickname,
              platform: 'xiaohongshu',
              success: true,
              data: xhsData,
            });

            console.log(`  └─ ✅ 小红书数据采集成功`);
          } catch (error) {
            console.error(`  └─ ❌ 小红书数据采集失败: ${error.message}`);
            results.push({
              bloggerId: blogger.id,
              nickname: blogger.nickname,
              platform: 'xiaohongshu',
              success: false,
              error: error.message,
            });
          }

          // 随机延迟,避免被识别为机器人
          const delay = Math.floor(Math.random() * (CRAWLER_CONFIG.maxDelay - CRAWLER_CONFIG.minDelay) + CRAWLER_CONFIG.minDelay);
          console.log(`  └─ 等待 ${(delay / 1000).toFixed(1)}秒 后继续...`);
          await randomDelay();
        } else {
          console.log(`  └─ ⚠️  未找到小红书链接,跳过`);
          results.push({
            bloggerId: blogger.id,
            nickname: blogger.nickname,
            platform: 'xiaohongshu',
            success: false,
            error: '没有小红书链接',
          });
        }

        // TODO: 后续可以添加抖音和大众点评的爬虫
        // if (blogger.douyinLink) { ... }
        // if (blogger.dianpingLink) { ... }

      } catch (error) {
        console.error(`处理博主 ${blogger.nickname} 时出错:`, error);
        if (progressCallback) {
          progressCallback({
            current: i + 1,
            total: bloggers.length,
            blogger: blogger.nickname,
            status: 'error',
            error: error.message,
          });
        }
      }
    }

    console.log('\n[爬虫完成] 所有博主数据采集完成');

    if (progressCallback) {
      progressCallback({
        current: bloggers.length,
        total: bloggers.length,
        status: 'completed',
        results,
      });
    }

    return results;

  } catch (error) {
    console.error('[爬虫错误]', error);
    throw error;
  } finally {
    // 关闭浏览器上下文（调试模式下不关闭）
    if (context && !CRAWLER_CONFIG.debugMode) {
      await context.close();
      console.log('[爬虫关闭] 浏览器已关闭');
    } else if (CRAWLER_CONFIG.debugMode) {
      console.log('[调试模式] 浏览器保持打开，请手动关闭');
    }
  }
}

// 获取博主的历史互动数据
export async function getInteractionHistory(bloggerId, platform, days = 30) {
  const startTime = Date.now() - days * 24 * 60 * 60 * 1000;

  const history = await dbQuery(
    `SELECT * FROM interaction_history
     WHERE blogger_id = ? AND platform = ? AND recorded_at >= ?
     ORDER BY recorded_at ASC`,
    [bloggerId, platform, startTime]
  );

  return history.map(h => ({
    id: h.id,
    bloggerId: h.blogger_id,
    platform: h.platform,
    likes: h.likes,
    favorites: h.favorites,
    comments: h.comments,
    shares: h.shares,
    recordedAt: h.recorded_at,
  }));
}
