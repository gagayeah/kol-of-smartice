// 日期工具函数

/**
 * 获取指定日期的零点时间戳（只保留年月日）
 * @param {Date|number} date - 日期对象或时间戳，默认为当前时间
 * @returns {number} 零点时间戳
 */
export function getDateOnlyTimestamp(date = new Date()) {
  const d = date instanceof Date ? date : new Date(date);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

/**
 * 格式化时间戳为年月日字符串
 * @param {number} timestamp - 时间戳
 * @returns {string} 格式化后的日期字符串，如 "2025-10-04"
 */
export function formatDateOnly(timestamp) {
  if (!timestamp) return '-';
  const date = new Date(timestamp);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * 格式化时间戳为中文年月日
 * @param {number} timestamp - 时间戳
 * @returns {string} 格式化后的日期字符串，如 "2025年10月4日"
 */
export function formatDateChinese(timestamp) {
  if (!timestamp) return '-';
  const date = new Date(timestamp);
  const year = date.getFullYear();
  const month = date.getMonth() + 1;
  const day = date.getDate();
  return `${year}年${month}月${day}日`;
}
