// v2: 添加性能日志用于调试慢请求
import { createClient } from '@supabase/supabase-js';

// Supabase 配置
const SUPABASE_URL = 'https://wdpeoyugsxqnpwwtkqsl.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndkcGVveXVnc3hxbnB3d3RrcXNsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDQxNDgwNzgsImV4cCI6MjA1OTcyNDA3OH0.9bUpuZCOZxDSH3KsIu6FwWZyAvnV5xPJGNpO3luxWOE';

// 请求计数器用于追踪
let requestCounter = 0;

// 创建 Supabase 客户端
export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
  global: {
    headers: {
      'X-Client-Info': 'blogger-management-system/1.0.0',
    },
  },
});

// UUID 生成工具
function generateUUID() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

// 网络状态检测
let isOnline = navigator.onLine;

// 监听网络状态变化
window.addEventListener('online', () => {
  isOnline = true;
});

window.addEventListener('offline', () => {
  isOnline = false;
});

// 缓存管理
class CacheManager {
  constructor() {
    this.cache = new Map();
    this.cacheTimeout = new Map();
    this.DEFAULT_TTL = 5 * 60 * 1000; // 5分钟默认缓存时间
  }

  set(key, data, ttl = this.DEFAULT_TTL) {
    this.cache.set(key, data);

    // 清除之前的超时
    if (this.cacheTimeout.has(key)) {
      clearTimeout(this.cacheTimeout.get(key));
    }

    // 设置新的超时
    if (ttl > 0) {
      const timeout = setTimeout(() => {
        this.cache.delete(key);
        this.cacheTimeout.delete(key);
      }, ttl);
      this.cacheTimeout.set(key, timeout);
    }
  }

  get(key) {
    return this.cache.get(key);
  }

  delete(key) {
    this.cache.delete(key);
    if (this.cacheTimeout.has(key)) {
      clearTimeout(this.cacheTimeout.get(key));
      this.cacheTimeout.delete(key);
    }
  }

  clear() {
    this.cache.clear();
    this.cacheTimeout.forEach(timeout => clearTimeout(timeout));
    this.cacheTimeout.clear();
  }

  // 清理过期缓存
  cleanup() {
    const now = Date.now();
    for (const [key, timeout] of this.cacheTimeout.entries()) {
      // 这里简化处理，直接清除所有超时
      clearTimeout(timeout);
    }
    this.cacheTimeout.clear();
  }
}

export const cacheManager = new CacheManager();

// 错误处理工具
export class DatabaseError extends Error {
  constructor(message, code = 'DATABASE_ERROR', context = {}) {
    super(message);
    this.name = 'DatabaseError';
    this.code = code;
    this.context = context;
  }
}

// 网络错误处理
export function handleNetworkError(error) {
  console.error('网络错误:', error);

  if (!isOnline) {
    throw new DatabaseError('网络连接已断开，请检查网络设置', 'NETWORK_OFFLINE');
  }

  if (error.code === 'PGRST301') {
    throw new DatabaseError('数据库连接超时', 'TIMEOUT', { originalError: error });
  }

  if (error.status === 0) {
    throw new DatabaseError('无法连接到服务器', 'CONNECTION_FAILED', { originalError: error });
  }

  throw new DatabaseError(`网络错误: ${error.message}`, 'NETWORK_ERROR', { originalError: error });
}

// 数据库操作包装器
// v3: 添加请求计时和性能日志
export async function withErrorHandling(operation, errorMessage = '数据库操作失败') {
  const reqId = ++requestCounter;
  const startTime = performance.now();
  console.log(`🚀 [SUPABASE] #${reqId} 请求开始: ${errorMessage.replace('失败', '')}`);

  try {
    if (!isOnline) {
      throw new DatabaseError('网络连接已断开，请检查网络设置', 'NETWORK_OFFLINE');
    }

    const result = await operation();
    const duration = performance.now() - startTime;
    console.log(`✅ [SUPABASE] #${reqId} 请求完成: ${duration.toFixed(2)}ms`);

    // 检查是否是 Supabase 响应格式（包含 error 属性）
    if (result && typeof result === 'object' && 'error' in result && result.error) {
      throw new DatabaseError(result.error.message, 'SUPABASE_ERROR', {
        details: result.error.details,
        hint: result.error.hint
      });
    }

    // 如果结果包含 data 属性（Supabase 响应格式），返回 data
    // 否则直接返回结果（回调已处理过的数据）
    if (result && typeof result === 'object' && 'data' in result) {
      return result.data;
    }

    return result;
  } catch (error) {
    const duration = performance.now() - startTime;
    console.log(`❌ [SUPABASE] #${reqId} 请求失败: ${duration.toFixed(2)}ms - ${error.message}`);

    if (error instanceof DatabaseError) {
      throw error;
    }

    // 处理 fetch 错误
    if (error.name === 'TypeError' && error.message.includes('fetch')) {
      handleNetworkError(error);
    }

    throw new DatabaseError(`${errorMessage}: ${error.message}`, 'UNKNOWN_ERROR', { originalError: error });
  }
}

// 生成缓存键
export function generateCacheKey(table, params = {}) {
  const sortedParams = Object.keys(params)
    .sort()
    .map(key => `${key}:${params[key]}`)
    .join('|');
  return `${table}${sortedParams ? ':' + sortedParams : ''}`;
}

// 实时订阅管理
class RealtimeManager {
  constructor() {
    this.subscriptions = new Map();
  }

  subscribe(table, filter, callback) {
    const key = `${table}:${JSON.stringify(filter)}`;

    // 如果已存在订阅，先取消
    if (this.subscriptions.has(key)) {
      this.subscriptions.get(key).unsubscribe();
    }

    const subscription = supabase
      .channel(`${table}_changes`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: table,
          filter: filter
        },
        (payload) => {
          callback(payload);
        }
      )
      .subscribe();

    this.subscriptions.set(key, subscription);
    return subscription;
  }

  unsubscribe(table, filter) {
    const key = `${table}:${JSON.stringify(filter)}`;
    if (this.subscriptions.has(key)) {
      this.subscriptions.get(key).unsubscribe();
      this.subscriptions.delete(key);
    }
  }

  unsubscribeAll() {
    this.subscriptions.forEach(sub => sub.unsubscribe());
    this.subscriptions.clear();
  }
}

export const realtimeManager = new RealtimeManager();

// 导出网络状态
export function getNetworkStatus() {
  return isOnline;
}

// 数据转换工具
export function transformFromSupabase(data, tableName) {
  if (!data) return data;

  switch (tableName) {
    case 'kol_project_groups':
      return {
        id: data.id,
        name: data.name,
        createdAt: data.created_at,
        updatedAt: data.updated_at
      };

    case 'kol_projects':
      return {
        id: data.id,
        groupId: data.group_id,
        parentId: data.parent_id,
        name: data.name,
        createdAt: data.created_at,
        updatedAt: data.updated_at
      };

    case 'kol_bloggers':
      return {
        id: String(data.id),
        projectId: data.project_id,
        nickname: data.nickname,
        followers: data.followers,
        profileUrl: data.profile_url,
        status: data.status,
        publishTime: data.publish_time,
        xhsLink: data.xhs_link,
        dianpingLink: data.dianping_link,
        douyinLink: data.douyin_link,
        notes: data.notes || '',
        // 小红书互动数据
        xhsLikes: data.xhs_likes,
        xhsFavorites: data.xhs_favorites,
        xhsComments: data.xhs_comments,
        xhsShares: data.xhs_shares,
        // 大众点评互动数据
        dianpingLikes: data.dianping_likes,
        dianpingFavorites: data.dianping_favorites,
        dianpingComments: data.dianping_comments,
        dianpingShares: data.dianping_shares,
        // 抖音互动数据
        douyinLikes: data.douyin_likes,
        douyinFavorites: data.douyin_favorites,
        douyinComments: data.douyin_comments,
        douyinShares: data.douyin_shares,
        createdAt: data.created_at,
        updatedAt: data.updated_at
      };

    default:
      return data;
  }
}

export function transformToSupabase(data, tableName) {
  if (!data) return data;

  switch (tableName) {
    case 'kol_project_groups':
      return {
        id: data.id || generateUUID(),
        name: data.name,
        brand_id: data.brandId || null,
        description: data.description || null,
        is_active: data.isActive !== undefined ? data.isActive : true,
        created_at: data.createdAt || Date.now(),
        updated_at: data.updatedAt || Date.now()
      };

    case 'kol_projects':
      return {
        id: data.id || generateUUID(),
        group_id: data.groupId,
        parent_id: data.parentId,
        name: data.name,
        project_type: data.projectType || 'marketing',
        status: data.status || 'active',
        created_at: data.createdAt || Date.now(),
        updated_at: data.updatedAt || Date.now()
      };

    case 'kol_bloggers':
      return {
        id: data.id || generateUUID(),
        project_id: data.projectId,
        nickname: data.nickname,
        followers: data.followers,
        profile_url: data.profileUrl,
        status: data.status,
        publish_time: data.publishTime,
        xhs_link: data.xhsLink,
        dianping_link: data.dianpingLink,
        douyin_link: data.douyinLink,
        notes: data.notes,
        // 小红书互动数据
        xhs_likes: data.xhsLikes,
        xhs_favorites: data.xhsFavorites,
        xhs_comments: data.xhsComments,
        xhs_shares: data.xhsShares,
        // 大众点评互动数据
        dianping_likes: data.dianpingLikes,
        dianping_favorites: data.dianpingFavorites,
        dianping_comments: data.dianpingComments,
        dianping_shares: data.dianpingShares,
        // 抖音互动数据
        douyin_likes: data.douyinLikes,
        douyin_favorites: data.douyinFavorites,
        douyin_comments: data.douyinComments,
        douyin_shares: data.douyinShares,
        created_at: data.createdAt || Date.now(),
        updated_at: data.updatedAt || Date.now()
      };

    default:
      return data;
  }
}

// 导出工具函数
export default {
  supabase,
  cacheManager,
  realtimeManager,
  getNetworkStatus,
  withErrorHandling,
  handleNetworkError,
  generateCacheKey,
  DatabaseError,
  transformFromSupabase,
  transformToSupabase
};