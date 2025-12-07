const XLSX = require('xlsx');

// 创建测试数据
const testData = [
  {
    '昵称': '美食博主小红',
    '粉丝数': 50000,
    '主页链接': 'https://www.xiaohongshu.com/user/profile/1',
    '小红书点赞': 12500,
    '小红书收藏': 8560,
    '小红书评论': 2340,
    '小红书转发': 890,
  },
  {
    '昵称': '探店达人小明',
    '粉丝数': 80000,
    '主页链接': 'https://www.xiaohongshu.com/user/profile/2',
    '大众点评点赞': 5600,
    '大众点评收藏': 3400,
    '大众点评评论': 890,
    '大众点评转发': 234,
  },
  {
    '昵称': '抖音吃货',
    '粉丝数': 120000,
    '主页链接': 'https://www.douyin.com/user/3',
    '抖音点赞': 56000,
    '抖音收藏': 32000,
    '抖音评论': 12340,
    '抖音转发': 4500,
  },
  {
    '昵称': '全能KOL',
    '粉丝数': 200000,
    '主页链接': 'https://www.xiaohongshu.com/user/profile/4',
    '小红书点赞': 25000,
    '小红书收藏': 15000,
    '小红书评论': 5000,
    '小红书转发': 2000,
    '大众点评点赞': 8000,
    '大众点评收藏': 5000,
    '大众点评评论': 1500,
    '大众点评转发': 500,
    '抖音点赞': 100000,
    '抖音收藏': 60000,
    '抖音评论': 20000,
    '抖音转发': 8000,
  },
];

// 创建工作簿
const worksheet = XLSX.utils.json_to_sheet(testData);
const workbook = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(workbook, worksheet, '博主数据');

// 保存文件
XLSX.writeFile(workbook, '测试博主数据_含互动数据.xlsx');
console.log('✅ 测试文件创建成功: 测试博主数据_含互动数据.xlsx');
