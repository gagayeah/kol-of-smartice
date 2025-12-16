import * as XLSX from 'xlsx';

// 解析Excel文件
export function parseExcelFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, { type: 'array', codepage: 65001 });

        // 读取第一个工作表
        const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
        const jsonData = XLSX.utils.sheet_to_json(firstSheet, { raw: false });

        // 智能检测列名（处理编码问题和不同命名）
        const detectColumnName = (row, possibleNames) => {
          // 首先尝试直接匹配
          for (const name of possibleNames) {
            if (row[name] !== undefined) {
              return row[name];
            }
          }

          // 如果直接匹配失败，尝试模糊匹配（处理编码问题）
          const keys = Object.keys(row);
          for (const key of keys) {
            // 检查是否是第一列、第二列、第三列（根据位置判断）
            const keyLower = key.toLowerCase();
            for (const name of possibleNames) {
              if (keyLower.includes(name.toLowerCase()) ||
                  name.toLowerCase().includes(keyLower)) {
                return row[key];
              }
            }
          }

          return undefined;
        };

        // 如果检测到列名有编码问题，尝试按列位置读取
        const keys = jsonData[0] ? Object.keys(jsonData[0]) : [];
        const hasEncodingIssue = keys.some(k => k.includes('\\x') || /[^\x00-\x7F\u4e00-\u9fa5]/.test(k));

        // 转换字段名（支持多种列名变体）
        const bloggers = jsonData.map((row, index) => {
          let nickname, followersValue, profileUrl;

          if (hasEncodingIssue) {
            // 如果有编码问题，按列位置读取（假设前3列是：昵称、某个字段、某个字段）
            const values = Object.values(row);
            nickname = String(values[0] || '').trim();

            // 尝试判断哪个是粉丝数（通常是数字）
            const val1 = values[1];
            const val2 = values[2];

            // 如果第2列是数字，第3列是链接
            if (!isNaN(val1) && String(val2).includes('http')) {
              followersValue = val1;
              profileUrl = String(val2).trim();
            }
            // 如果第2列是链接，第3列是数字
            else if (String(val1).includes('http') && !isNaN(val2)) {
              profileUrl = String(val1).trim();
              followersValue = val2;
            }
            // 否则按顺序猜测
            else {
              followersValue = val1;
              profileUrl = String(val2 || '').trim();
            }
          } else {
            // 正常的列名匹配
            nickname = String(
              row['昵称'] ||
              row['红薯名'] ||
              row['nickname'] ||
              row['Nickname'] ||
              row['名称'] ||
              row['博主名'] ||
              row['博主昵称'] ||
              row['博主名称'] ||
              ''
            ).trim();

            followersValue =
              row['粉丝数'] ||
              row['粉丝量'] ||
              row['粉丝'] ||
              row['followers'] ||
              row['Followers'] ||
              0;

            profileUrl = String(
              row['主页链接'] ||
              row['profile_url'] ||
              row['profileUrl'] ||
              row['链接'] ||
              row['主页'] ||
              row['小红书链接'] ||
              row['小红书主页'] ||
              row['url'] ||
              row['URL'] ||
              ''
            ).trim();
          }

          const followers = parseInt(followersValue) || 0;

          // 小红书互动数据
          const xhsLikes = parseInt(row['小红书点赞'] || row['xhs_likes'] || 0) || null;
          const xhsFavorites = parseInt(row['小红书收藏'] || row['xhs_favorites'] || 0) || null;
          const xhsComments = parseInt(row['小红书评论'] || row['xhs_comments'] || 0) || null;
          const xhsShares = parseInt(row['小红书转发'] || row['xhs_shares'] || 0) || null;

          // 大众点评互动数据
          const dianpingLikes = parseInt(row['大众点评点赞'] || row['dianping_likes'] || 0) || null;
          const dianpingFavorites = parseInt(row['大众点评收藏'] || row['dianping_favorites'] || 0) || null;
          const dianpingComments = parseInt(row['大众点评评论'] || row['dianping_comments'] || 0) || null;
          const dianpingShares = parseInt(row['大众点评转发'] || row['dianping_shares'] || 0) || null;

          // 抖音互动数据
          const douyinLikes = parseInt(row['抖音点赞'] || row['douyin_likes'] || 0) || null;
          const douyinFavorites = parseInt(row['抖音收藏'] || row['douyin_favorites'] || 0) || null;
          const douyinComments = parseInt(row['抖音评论'] || row['douyin_comments'] || 0) || null;
          const douyinShares = parseInt(row['抖音转发'] || row['douyin_shares'] || 0) || null;

          return {
            nickname,
            followers,
            profileUrl,
            // 小红书互动数据
            xhsLikes,
            xhsFavorites,
            xhsComments,
            xhsShares,
            // 大众点评互动数据
            dianpingLikes,
            dianpingFavorites,
            dianpingComments,
            dianpingShares,
            // 抖音互动数据
            douyinLikes,
            douyinFavorites,
            douyinComments,
            douyinShares,
          };
        });

        resolve(bloggers);
      } catch (error) {
        reject(new Error('Excel文件解析失败: ' + error.message));
      }
    };

    reader.onerror = () => {
      reject(new Error('文件读取失败'));
    };

    reader.readAsArrayBuffer(file);
  });
}

// 导出为Excel文件
export function exportToExcel(data, filename = '博主数据.xlsx') {
  // 转换数据格式
  const exportData = data.map(blogger => {
    // 日期格式化 - 使用标准格式
    let publishTimeStr = '';
    if (blogger.publishTime) {
      try {
        const date = new Date(blogger.publishTime);
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        const hours = String(date.getHours()).padStart(2, '0');
        const minutes = String(date.getMinutes()).padStart(2, '0');
        const seconds = String(date.getSeconds()).padStart(2, '0');
        publishTimeStr = `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
      } catch (e) {
        publishTimeStr = '';
      }
    }

    return {
      '昵称': blogger.nickname || '',
      '粉丝数': blogger.followers || 0,
      '主页链接': blogger.profileUrl || '',
      '状态': blogger.status || '',
      '发布时间': publishTimeStr,
      '小红书链接': blogger.xhsLink || '',
      '小红书点赞': blogger.xhsLikes ?? '',
      '小红书收藏': blogger.xhsFavorites ?? '',
      '小红书评论': blogger.xhsComments ?? '',
      '小红书转发': blogger.xhsShares ?? '',
      '大众点评链接': blogger.dianpingLink || '',
      '大众点评点赞': blogger.dianpingLikes ?? '',
      '大众点评收藏': blogger.dianpingFavorites ?? '',
      '大众点评评论': blogger.dianpingComments ?? '',
      '大众点评转发': blogger.dianpingShares ?? '',
      '抖音链接': blogger.douyinLink || '',
      '抖音点赞': blogger.douyinLikes ?? '',
      '抖音收藏': blogger.douyinFavorites ?? '',
      '抖音评论': blogger.douyinComments ?? '',
      '抖音转发': blogger.douyinShares ?? '',
      '备注': blogger.notes || '',
    };
  });

  // 创建工作簿
  const worksheet = XLSX.utils.json_to_sheet(exportData);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, '博主数据');

  // 下载文件 - 明确指定文件格式
  XLSX.writeFile(workbook, filename, {
    bookType: 'xlsx',
    type: 'binary'
  });
}
