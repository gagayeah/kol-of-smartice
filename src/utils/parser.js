// 智能解析工具

// 识别链接类型
export function detectLinkType(url) {
  if (!url) return null;

  if (url.includes('xhslink.com') || url.includes('xiaohongshu.com')) {
    return 'xhs';
  }
  if (url.includes('dpurl.cn') || url.includes('dianping.com')) {
    return 'dianping';
  }
  if (url.includes('v.douyin.com') || url.includes('douyin.com')) {
    return 'douyin';
  }
  return null;
}

// 从文本中提取所有链接
export function extractLinks(text) {
  const urlRegex = /(https?:\/\/[^\s]+)/g;
  const matches = text.match(urlRegex) || [];
  return matches.map(url => url.trim());
}

// 解析博主回执文本（单个博主）
// 第一行是昵称，后面所有内容都扫描链接
export function parseReceipt(text) {
  if (!text || !text.trim()) {
    return [];
  }

  const lines = text.split('\n');
  let nickname = '';
  const blogger = {
    nickname: '',
    xhsLink: '',
    dianpingLink: '',
    douyinLink: '',
  };

  // 第一个非空行是昵称
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed) {
      blogger.nickname = trimmed;
      break;
    }
  }

  // 如果没有昵称，返回空
  if (!blogger.nickname) {
    return [];
  }

  // 扫描所有行的链接
  for (const line of lines) {
    const links = extractLinks(line);
    links.forEach(link => {
      const type = detectLinkType(link);
      if (type === 'xhs' && !blogger.xhsLink) {
        blogger.xhsLink = link;
      } else if (type === 'dianping' && !blogger.dianpingLink) {
        blogger.dianpingLink = link;
      } else if (type === 'douyin' && !blogger.douyinLink) {
        blogger.douyinLink = link;
      }
    });
  }

  return [blogger];
}
