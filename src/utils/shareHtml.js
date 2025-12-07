// HTML 分享生成工具
import { formatDateOnly } from './dateHelper';

/**
 * 生成博主追踪分享 HTML
 * @param {string} projectName 项目名称
 * @param {Array} bloggers 博主数据
 * @returns {string} HTML 字符串
 */
export function generateShareHtml(projectName, bloggers) {
  // 统计数据
  const total = bloggers.length;
  const published = bloggers.filter(b => b.status === '已发布').length;
  const reviewing = bloggers.filter(b => b.status === '待审核').length;
  const editing = bloggers.filter(b => b.status === '改稿中').length;
  const finalized = bloggers.filter(b => b.status === '已定稿').length;

  const html = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <meta name="format-detection" content="telephone=no">
  <title>${projectName} - 博主进度追踪</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }

    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", "Helvetica Neue", Helvetica, Arial, sans-serif;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      min-height: 100vh;
      padding: 20px 10px;
      line-height: 1.6;
    }

    .container {
      max-width: 1200px;
      margin: 0 auto;
      background: white;
      border-radius: 16px;
      box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
      overflow: hidden;
    }

    .header {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      padding: 30px 20px;
      text-align: center;
    }

    .header h1 {
      font-size: 24px;
      margin-bottom: 10px;
      font-weight: 600;
    }

    .header p {
      opacity: 0.9;
      font-size: 14px;
    }

    .stats {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
      gap: 15px;
      padding: 20px;
      background: #f7f9fc;
    }

    .stat-card {
      background: white;
      border-radius: 12px;
      padding: 15px;
      text-align: center;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
    }

    .stat-card .label {
      font-size: 12px;
      color: #666;
      margin-bottom: 5px;
    }

    .stat-card .value {
      font-size: 24px;
      font-weight: 700;
      color: #333;
    }

    .stat-card.total .value { color: #667eea; }
    .stat-card.published .value { color: #52c41a; }
    .stat-card.reviewing .value { color: #faad14; }
    .stat-card.editing .value { color: #ff7875; }
    .stat-card.finalized .value { color: #1890ff; }

    .table-container {
      overflow-x: auto;
      padding: 20px;
    }

    table {
      width: 100%;
      border-collapse: collapse;
      font-size: 14px;
    }

    thead {
      background: #fafafa;
    }

    th {
      padding: 12px 8px;
      text-align: left;
      font-weight: 600;
      color: #333;
      border-bottom: 2px solid #e8e8e8;
      white-space: nowrap;
    }

    td {
      padding: 12px 8px;
      border-bottom: 1px solid #f0f0f0;
      color: #595959;
    }

    tbody tr:hover {
      background: #fafafa;
    }

    .status-tag {
      display: inline-block;
      padding: 4px 12px;
      border-radius: 12px;
      font-size: 12px;
      font-weight: 500;
      white-space: nowrap;
    }

    .status-待审核 { background: #fff7e6; color: #fa8c16; }
    .status-改稿中 { background: #fff1f0; color: #f5222d; }
    .status-已定稿 { background: #e6f7ff; color: #1890ff; }
    .status-已发布 { background: #f6ffed; color: #52c41a; }

    .link {
      color: #1890ff;
      text-decoration: none;
      word-break: break-all;
    }

    .link:hover {
      text-decoration: underline;
    }

    .no-data {
      color: #d9d9d9;
      font-size: 12px;
    }

    .footer {
      text-align: center;
      padding: 20px;
      color: #999;
      font-size: 12px;
      border-top: 1px solid #f0f0f0;
    }

    /* 卡片式布局（仅移动端） */
    .card-list {
      display: none;
    }

    .blogger-card {
      background: white;
      border-radius: 8px;
      padding: 15px;
      margin-bottom: 12px;
      border: 1px solid #f0f0f0;
    }

    .blogger-card .card-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 12px;
      padding-bottom: 12px;
      border-bottom: 1px solid #f0f0f0;
    }

    .blogger-card .nickname {
      font-size: 16px;
      font-weight: 600;
      color: #333;
    }

    .blogger-card .card-info {
      display: grid;
      gap: 8px;
    }

    .blogger-card .info-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-size: 13px;
    }

    .blogger-card .info-label {
      color: #999;
      min-width: 70px;
    }

    .blogger-card .info-value {
      color: #333;
      flex: 1;
      text-align: right;
    }

    /* 移动端适配 */
    @media (max-width: 768px) {
      body {
        padding: 10px 5px;
      }

      .header h1 {
        font-size: 20px;
      }

      .stats {
        grid-template-columns: repeat(2, 1fr);
        gap: 10px;
        padding: 15px;
      }

      .stat-card {
        padding: 12px;
      }

      .stat-card .value {
        font-size: 20px;
      }

      /* 隐藏表格，显示卡片 */
      .table-container table {
        display: none;
      }

      .card-list {
        display: block;
      }
    }
  </style>
</head>
<body>
  <div class="container">
    <!-- 头部 -->
    <div class="header">
      <h1>${projectName}</h1>
      <p>博主进度追踪 · 生成时间：${new Date().toLocaleString('zh-CN')}</p>
    </div>

    <!-- 统计卡片 -->
    <div class="stats">
      <div class="stat-card total">
        <div class="label">总博主数</div>
        <div class="value">${total}</div>
      </div>
      <div class="stat-card published">
        <div class="label">已发布</div>
        <div class="value">${published}</div>
      </div>
      <div class="stat-card finalized">
        <div class="label">已定稿</div>
        <div class="value">${finalized}</div>
      </div>
      <div class="stat-card editing">
        <div class="label">改稿中</div>
        <div class="value">${editing}</div>
      </div>
      <div class="stat-card reviewing">
        <div class="label">待审核</div>
        <div class="value">${reviewing}</div>
      </div>
    </div>

    <!-- 博主列表 -->
    <div class="table-container">
      <!-- 桌面端：表格 -->
      <table>
        <thead>
          <tr>
            <th>昵称</th>
            <th>粉丝数</th>
            <th>状态</th>
            <th>小红书</th>
            <th>大众点评</th>
            <th>抖音</th>
          </tr>
        </thead>
        <tbody>
          ${bloggers.map(blogger => `
            <tr>
              <td>
                ${blogger.profileUrl
                  ? `<a href="${blogger.profileUrl}" class="link" target="_blank">${blogger.nickname}</a>`
                  : blogger.nickname
                }
              </td>
              <td>${blogger.followers ? blogger.followers.toLocaleString() : '-'}</td>
              <td><span class="status-tag status-${blogger.status}">${blogger.status}</span></td>
              <td>
                ${blogger.xhsLink
                  ? `<a href="${blogger.xhsLink}" class="link" target="_blank">查看</a>`
                  : '<span class="no-data">-</span>'
                }
              </td>
              <td>
                ${blogger.dianpingLink
                  ? `<a href="${blogger.dianpingLink}" class="link" target="_blank">查看</a>`
                  : '<span class="no-data">-</span>'
                }
              </td>
              <td>
                ${blogger.douyinLink
                  ? `<a href="${blogger.douyinLink}" class="link" target="_blank">查看</a>`
                  : '<span class="no-data">-</span>'
                }
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>

      <!-- 移动端：卡片 -->
      <div class="card-list">
        ${bloggers.map(blogger => `
          <div class="blogger-card">
            <div class="card-header">
              <div class="nickname">
                ${blogger.profileUrl
                  ? `<a href="${blogger.profileUrl}" class="link" target="_blank">${blogger.nickname}</a>`
                  : blogger.nickname
                }
              </div>
              <span class="status-tag status-${blogger.status}">${blogger.status}</span>
            </div>
            <div class="card-info">
              ${blogger.followers ? `
                <div class="info-row">
                  <span class="info-label">粉丝数</span>
                  <span class="info-value">${blogger.followers.toLocaleString()}</span>
                </div>
              ` : ''}
              ${blogger.xhsLink ? `
                <div class="info-row">
                  <span class="info-label">📱 小红书</span>
                  <span class="info-value"><a href="${blogger.xhsLink}" class="link" target="_blank">查看笔记</a></span>
                </div>
              ` : ''}
              ${blogger.dianpingLink ? `
                <div class="info-row">
                  <span class="info-label">⭐ 大众点评</span>
                  <span class="info-value"><a href="${blogger.dianpingLink}" class="link" target="_blank">查看评价</a></span>
                </div>
              ` : ''}
              ${blogger.douyinLink ? `
                <div class="info-row">
                  <span class="info-label">🎵 抖音</span>
                  <span class="info-value"><a href="${blogger.douyinLink}" class="link" target="_blank">查看视频</a></span>
                </div>
              ` : ''}
            </div>
          </div>
        `).join('')}
      </div>
    </div>

    <!-- 页脚 -->
    <div class="footer">
      由 博主追踪系统 生成 · 仅供内部查阅
    </div>
  </div>
</body>
</html>`;

  return html;
}

/**
 * 导出 HTML 文件（Electron 环境）
 * @param {string} projectName 项目名称
 * @param {Array} bloggers 博主数据
 */
export async function exportShareHtml(projectName, bloggers) {
  const html = generateShareHtml(projectName, bloggers);
  const filename = `${projectName}_博主追踪_${new Date().getTime()}.html`;

  // Electron 环境
  if (typeof window !== 'undefined' && window.electron) {
    const result = await window.electron.file.exportHtml(html, filename);
    return result;
  }

  // 浏览器环境 - 直接下载
  const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);

  return { success: true, path: filename };
}
