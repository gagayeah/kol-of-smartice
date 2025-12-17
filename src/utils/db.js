// 数据库工具 - Supabase 主数据源 + 本地 SQLite 备份
// v6: 添加性能日志用于调试慢启动问题
// 品牌和门店数据为只读，项目分类和博主数据可读写
// 数据结构: 品牌 → 门店 → 项目分类 → 博主

// 数据库请求性能日志
const dbPerfLog = {
  start(label) {
    const startTime = performance.now();
    console.log(`🔵 [DB] START: ${label}`);
    return startTime;
  },
  end(label, startTime, fromCache = false) {
    const duration = performance.now() - startTime;
    const cacheStatus = fromCache ? '(缓存)' : '(网络)';
    console.log(`🟢 [DB] END: ${label} - ${duration.toFixed(2)}ms ${cacheStatus}`);
    return duration;
  },
  cacheHit(label) {
    console.log(`💾 [DB] CACHE HIT: ${label}`);
  },
  cacheMiss(label) {
    console.log(`🌐 [DB] CACHE MISS: ${label} - 需要网络请求`);
  }
};

import {
  supabase,
  withErrorHandling,
  generateCacheKey,
  cacheManager,
  transformFromSupabase,
  transformToSupabase,
  getNetworkStatus,
  DatabaseError
} from './supabase-client.js';

// 本地存储当前选中的品牌、门店和项目分类ID
const CURRENT_BRAND_KEY = 'current_brand_id';
const CURRENT_RESTAURANT_KEY = 'current_restaurant_id';
const CURRENT_CATEGORY_KEY = 'current_category_id';

// 检测是否在 Electron 环境中（用于本地备份）
const isElectron = () => typeof window !== 'undefined' && window.electron && window.electron.db;

// 生成 UUID
function generateUUID() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

// 获取当前品牌ID
function getCurrentBrandId() {
  return localStorage.getItem(CURRENT_BRAND_KEY);
}

// 设置当前品牌ID
function setCurrentBrandId(brandId) {
  if (brandId) {
    localStorage.setItem(CURRENT_BRAND_KEY, String(brandId));
  } else {
    localStorage.removeItem(CURRENT_BRAND_KEY);
  }
}

// 获取当前门店ID
function getCurrentRestaurantId() {
  return localStorage.getItem(CURRENT_RESTAURANT_KEY);
}

// 设置当前门店ID
function setCurrentRestaurantId(restaurantId) {
  if (restaurantId) {
    localStorage.setItem(CURRENT_RESTAURANT_KEY, restaurantId);
  } else {
    localStorage.removeItem(CURRENT_RESTAURANT_KEY);
  }
}

// 获取当前项目分类ID
function getCurrentCategoryId() {
  return localStorage.getItem(CURRENT_CATEGORY_KEY);
}

// 设置当前项目分类ID
function setCurrentCategoryId(categoryId) {
  if (categoryId) {
    localStorage.setItem(CURRENT_CATEGORY_KEY, categoryId);
  } else {
    localStorage.removeItem(CURRENT_CATEGORY_KEY);
  }
}

// ============================================================
// 数据转换函数
// ============================================================

// 转换 master_brand 到前端格式（兼容 projectGroup 接口）
function transformBrand(row) {
  return {
    id: String(row.id),
    name: row.name,
    nameEn: row.name_en,
    code: row.code,
    description: row.description,
    isActive: row.is_active,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

// 转换 master_restaurant 到前端格式（兼容 project 接口）
function transformRestaurant(row) {
  return {
    id: row.id,
    groupId: String(row.brand_id), // 映射 brand_id 为 groupId
    name: row.restaurant_name,
    city: row.city,
    address: row.address,
    phone: row.phone,
    isActive: row.is_active,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

// 转换 kol_project_categories 到前端格式
function transformCategory(row) {
  return {
    id: row.id,
    restaurantId: row.restaurant_id,
    name: row.name,
    description: row.description,
    startDate: row.start_date,
    endDate: row.end_date,
    status: row.status,
    sortOrder: row.sort_order,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

// 转换项目分类到 Supabase 格式
function transformCategoryToSupabase(data) {
  return {
    id: data.id || generateUUID(),
    restaurant_id: data.restaurantId,
    name: data.name || '',
    description: data.description || '',
    start_date: data.startDate || null,
    end_date: data.endDate || null,
    status: data.status || 'active',
    sort_order: data.sortOrder || 0,
    created_at: data.createdAt || new Date().toISOString(),
    updated_at: new Date().toISOString()
  };
}

// 转换博主数据
function transformBlogger(row) {
  return {
    id: String(row.id),
    projectId: row.project_id, // 关联门店ID
    categoryId: row.category_id, // 关联项目分类ID
    nickname: row.nickname,
    followers: row.followers,
    profileUrl: row.profile_url,
    status: row.status,
    publishTime: row.publish_time,
    xhsLink: row.xhs_link,
    dianpingLink: row.dianping_link,
    douyinLink: row.douyin_link,
    weiboLink: row.weibo_link,
    notes: row.notes || '',
    // 小红书互动数据
    xhsLikes: row.xhs_likes,
    xhsFavorites: row.xhs_favorites,
    xhsComments: row.xhs_comments,
    xhsShares: row.xhs_shares,
    // 大众点评互动数据
    dianpingLikes: row.dianping_likes,
    dianpingFavorites: row.dianping_favorites,
    dianpingComments: row.dianping_comments,
    dianpingShares: row.dianping_shares,
    // 抖音互动数据
    douyinLikes: row.douyin_likes,
    douyinFavorites: row.douyin_favorites,
    douyinComments: row.douyin_comments,
    douyinShares: row.douyin_shares,
    // 微博互动数据
    weiboLikes: row.weibo_likes,
    weiboFavorites: row.weibo_favorites,
    weiboComments: row.weibo_comments,
    weiboShares: row.weibo_shares,
    // 其他
    contactInfo: row.contact_info,
    cooperationFee: row.cooperation_fee,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

// 转换博主数据到 Supabase 格式
function transformBloggerToSupabase(data) {
  return {
    id: data.id || generateUUID(),
    project_id: data.projectId,
    category_id: data.categoryId || null,
    nickname: data.nickname || '',
    followers: data.followers || 0,
    profile_url: data.profileUrl || '',
    status: data.status || '待审核',
    publish_time: data.publishTime || null,
    xhs_link: data.xhsLink || '',
    dianping_link: data.dianpingLink || '',
    douyin_link: data.douyinLink || '',
    weibo_link: data.weiboLink || '',
    notes: data.notes || '',
    xhs_likes: data.xhsLikes || null,
    xhs_favorites: data.xhsFavorites || null,
    xhs_comments: data.xhsComments || null,
    xhs_shares: data.xhsShares || null,
    dianping_likes: data.dianpingLikes || null,
    dianping_favorites: data.dianpingFavorites || null,
    dianping_comments: data.dianpingComments || null,
    dianping_shares: data.dianpingShares || null,
    douyin_likes: data.douyinLikes || null,
    douyin_favorites: data.douyinFavorites || null,
    douyin_comments: data.douyinComments || null,
    douyin_shares: data.douyinShares || null,
    weibo_likes: data.weiboLikes || null,
    weibo_favorites: data.weiboFavorites || null,
    weibo_comments: data.weiboComments || null,
    weibo_shares: data.weiboShares || null,
    contact_info: data.contactInfo || null,
    cooperation_fee: data.cooperationFee || null,
    created_at: data.createdAt || new Date().toISOString(),
    updated_at: new Date().toISOString()
  };
}

// ============================================================
// 品牌管理（一级）- 从 master_brand 读取（只读）
// 对外保持 projectGroupDB 接口兼容
// ============================================================
export const projectGroupDB = {
  // 获取所有品牌
  async getAll() {
    const startTime = dbPerfLog.start('projectGroupDB.getAll (master_brand)');
    const cacheKey = generateCacheKey('master_brand');
    const cached = cacheManager.get(cacheKey);
    if (cached) {
      dbPerfLog.cacheHit('master_brand');
      dbPerfLog.end('projectGroupDB.getAll', startTime, true);
      return cached;
    }

    dbPerfLog.cacheMiss('master_brand');
    return await withErrorHandling(async () => {
      const { data, error } = await supabase
        .from('master_brand')
        .select('*')
        .eq('is_active', true)
        .order('id', { ascending: true });

      if (error) throw new Error(error.message);

      const transformed = (data || []).map(transformBrand);
      cacheManager.set(cacheKey, transformed);
      dbPerfLog.end('projectGroupDB.getAll', startTime, false);
      return transformed;
    }, '获取品牌列表失败');
  },

  // 获取当前品牌
  async getCurrent() {
    const startTime = dbPerfLog.start('projectGroupDB.getCurrent');
    const brands = await this.getAll();
    const currentId = getCurrentBrandId();
    const result = brands.find(b => b.id === currentId) || brands[0] || null;
    dbPerfLog.end('projectGroupDB.getCurrent', startTime, true);
    return result;
  },

  // 切换品牌
  async switch(brandId) {
    setCurrentBrandId(brandId);
    setCurrentRestaurantId(null);
    setCurrentCategoryId(null);
    cacheManager.delete(generateCacheKey('master_restaurant'));
    cacheManager.delete(generateCacheKey('kol_project_categories'));
    cacheManager.delete(generateCacheKey('kol_bloggers'));
  },

  // 创建品牌 - 禁用（master 数据只读）
  async create(name) {
    throw new DatabaseError('品牌数据为只读，请联系管理员添加', 'READONLY');
  },

  // 重命名品牌 - 禁用（master 数据只读）
  async rename(brandId, newName) {
    throw new DatabaseError('品牌数据为只读，请联系管理员修改', 'READONLY');
  },

  // 删除品牌 - 禁用（master 数据只读）
  async delete(brandId) {
    throw new DatabaseError('品牌数据为只读，请联系管理员删除', 'READONLY');
  },
};

// ============================================================
// 门店管理（二级）- 从 master_restaurant 读取（只读）
// 对外保持 projectDB 接口兼容
// ============================================================
export const projectDB = {
  // 获取所有门店
  async getAll() {
    const startTime = dbPerfLog.start('projectDB.getAll (master_restaurant)');
    const cacheKey = generateCacheKey('master_restaurant');
    const cached = cacheManager.get(cacheKey);
    if (cached) {
      dbPerfLog.cacheHit('master_restaurant');
      dbPerfLog.end('projectDB.getAll', startTime, true);
      return cached;
    }

    dbPerfLog.cacheMiss('master_restaurant');
    return await withErrorHandling(async () => {
      const { data, error } = await supabase
        .from('master_restaurant')
        .select('*')
        .eq('is_active', true)
        .order('restaurant_name', { ascending: true });

      if (error) throw new Error(error.message);

      const transformed = (data || []).map(transformRestaurant);
      cacheManager.set(cacheKey, transformed);
      dbPerfLog.end('projectDB.getAll', startTime, false);
      return transformed;
    }, '获取门店列表失败');
  },

  // 获取特定品牌的所有门店
  async getByGroup(brandId) {
    const startTime = dbPerfLog.start(`projectDB.getByGroup (brand_id=${brandId})`);
    const cacheKey = generateCacheKey('master_restaurant', { brand_id: brandId });
    const cached = cacheManager.get(cacheKey);
    if (cached) {
      dbPerfLog.cacheHit(`master_restaurant brand_id=${brandId}`);
      dbPerfLog.end('projectDB.getByGroup', startTime, true);
      return cached;
    }

    dbPerfLog.cacheMiss(`master_restaurant brand_id=${brandId}`);
    return await withErrorHandling(async () => {
      const { data, error } = await supabase
        .from('master_restaurant')
        .select('*')
        .eq('brand_id', parseInt(brandId))
        .eq('is_active', true)
        .order('restaurant_name', { ascending: true });

      if (error) throw new Error(error.message);

      const transformed = (data || []).map(transformRestaurant);
      cacheManager.set(cacheKey, transformed);
      dbPerfLog.end('projectDB.getByGroup', startTime, false);
      return transformed;
    }, '获取门店列表失败');
  },

  // 获取子门店（不适用于当前结构，返回空数组）
  async getChildren(parentId) {
    return [];
  },

  // 获取当前门店
  async getCurrent(currentBrandId = null) {
    const startTime = dbPerfLog.start('projectDB.getCurrent');
    const currentId = getCurrentRestaurantId();
    const brandId = currentBrandId || getCurrentBrandId();
    if (!brandId) {
      dbPerfLog.end('projectDB.getCurrent (no brandId)', startTime, true);
      return null;
    }

    const restaurants = await this.getByGroup(brandId);
    const result = restaurants.find(r => r.id === currentId) || restaurants[0] || null;
    dbPerfLog.end('projectDB.getCurrent', startTime, true);
    return result;
  },

  // 切换门店
  async switch(restaurantId) {
    setCurrentRestaurantId(restaurantId);
    setCurrentCategoryId(null);
    cacheManager.delete(generateCacheKey('kol_project_categories'));
    cacheManager.delete(generateCacheKey('kol_bloggers'));
  },

  // 创建门店 - 禁用（master 数据只读）
  async create(name, brandId, parentId = null) {
    throw new DatabaseError('门店数据为只读，请联系管理员添加', 'READONLY');
  },

  // 重命名门店 - 禁用（master 数据只读）
  async rename(restaurantId, newName) {
    throw new DatabaseError('门店数据为只读，请联系管理员修改', 'READONLY');
  },

  // 更新门店父级 - 禁用（master 数据只读）
  async updateParent(restaurantId, newParentId) {
    throw new DatabaseError('门店数据为只读，请联系管理员修改', 'READONLY');
  },

  // 删除门店 - 禁用（master 数据只读）
  async delete(restaurantId) {
    throw new DatabaseError('门店数据为只读，请联系管理员删除', 'READONLY');
  },
};

// ============================================================
// 项目分类管理（三级）- 使用 kol_project_categories 表（可读写）
// ============================================================
export const categoryDB = {
  // 获取门店的所有项目分类
  async getByRestaurant(restaurantId) {
    const startTime = dbPerfLog.start(`categoryDB.getByRestaurant (restaurant_id=${restaurantId})`);
    const cacheKey = generateCacheKey('kol_project_categories', { restaurant_id: restaurantId });
    const cached = cacheManager.get(cacheKey);
    if (cached) {
      dbPerfLog.cacheHit(`kol_project_categories restaurant_id=${restaurantId}`);
      dbPerfLog.end('categoryDB.getByRestaurant', startTime, true);
      return cached;
    }

    dbPerfLog.cacheMiss(`kol_project_categories restaurant_id=${restaurantId}`);
    return await withErrorHandling(async () => {
      const { data, error } = await supabase
        .from('kol_project_categories')
        .select('*')
        .eq('restaurant_id', restaurantId)
        .order('sort_order', { ascending: true });

      if (error) throw new Error(error.message);

      const transformed = (data || []).map(transformCategory);
      cacheManager.set(cacheKey, transformed);
      dbPerfLog.end('categoryDB.getByRestaurant', startTime, false);
      return transformed;
    }, '获取项目分类列表失败');
  },

  // 获取当前项目分类
  async getCurrent(currentRestaurantId = null) {
    const startTime = dbPerfLog.start('categoryDB.getCurrent');
    const currentId = getCurrentCategoryId();
    const restaurantId = currentRestaurantId || getCurrentRestaurantId();
    if (!restaurantId) {
      dbPerfLog.end('categoryDB.getCurrent (no restaurantId)', startTime, true);
      return null;
    }

    const categories = await this.getByRestaurant(restaurantId);
    const result = categories.find(c => c.id === currentId) || categories[0] || null;
    dbPerfLog.end('categoryDB.getCurrent', startTime, true);
    return result;
  },

  // 切换项目分类
  async switch(categoryId) {
    setCurrentCategoryId(categoryId);
    cacheManager.delete(generateCacheKey('kol_bloggers'));
  },

  // 创建项目分类
  async create(name, restaurantId, options = {}) {
    return await withErrorHandling(async () => {
      // 获取当前最大排序值
      const { data: existing } = await supabase
        .from('kol_project_categories')
        .select('sort_order')
        .eq('restaurant_id', restaurantId)
        .order('sort_order', { ascending: false })
        .limit(1);

      const maxOrder = existing?.[0]?.sort_order || 0;

      const categoryData = transformCategoryToSupabase({
        restaurantId,
        name,
        description: options.description || '',
        startDate: options.startDate || null,
        endDate: options.endDate || null,
        status: options.status || 'active',
        sortOrder: maxOrder + 1
      });

      const { data, error } = await supabase
        .from('kol_project_categories')
        .insert([categoryData])
        .select()
        .single();

      if (error) throw new Error(error.message);

      cacheManager.delete(generateCacheKey('kol_project_categories', { restaurant_id: restaurantId }));
      return transformCategory(data);
    }, '创建项目分类失败');
  },

  // 更新项目分类
  async update(categoryId, updates) {
    return await withErrorHandling(async () => {
      const { data: existing } = await supabase
        .from('kol_project_categories')
        .select('restaurant_id')
        .eq('id', categoryId)
        .single();

      if (!existing) throw new Error('项目分类不存在');

      const updateData = {
        updated_at: new Date().toISOString()
      };

      const fieldMap = {
        name: 'name',
        description: 'description',
        startDate: 'start_date',
        endDate: 'end_date',
        status: 'status',
        sortOrder: 'sort_order'
      };

      for (const [key, value] of Object.entries(updates)) {
        if (fieldMap[key]) {
          updateData[fieldMap[key]] = value;
        }
      }

      const { data, error } = await supabase
        .from('kol_project_categories')
        .update(updateData)
        .eq('id', categoryId)
        .select()
        .single();

      if (error) throw new Error(error.message);

      cacheManager.delete(generateCacheKey('kol_project_categories', { restaurant_id: existing.restaurant_id }));
      return transformCategory(data);
    }, '更新项目分类失败');
  },

  // 重命名项目分类
  async rename(categoryId, newName) {
    return await this.update(categoryId, { name: newName });
  },

  // 删除项目分类
  async delete(categoryId) {
    return await withErrorHandling(async () => {
      const { data: existing } = await supabase
        .from('kol_project_categories')
        .select('restaurant_id')
        .eq('id', categoryId)
        .single();

      if (!existing) throw new Error('项目分类不存在');

      // 检查分类下是否有博主
      const { count } = await supabase
        .from('kol_bloggers')
        .select('id', { count: 'exact', head: true })
        .eq('category_id', categoryId);

      if (count > 0) {
        throw new Error(`该分类下还有 ${count} 个博主，请先移动或删除博主`);
      }

      const { error } = await supabase
        .from('kol_project_categories')
        .delete()
        .eq('id', categoryId);

      if (error) throw new Error(error.message);

      cacheManager.delete(generateCacheKey('kol_project_categories', { restaurant_id: existing.restaurant_id }));

      // 如果删除的是当前分类，清除选中状态
      if (getCurrentCategoryId() === categoryId) {
        setCurrentCategoryId(null);
      }
    }, '删除项目分类失败');
  },
};

// ============================================================
// 博主管理 - 使用 kol_bloggers 表
// ============================================================
export const bloggerDB = {
  // 获取门店的所有博主
  async getByProject(restaurantId) {
    const startTime = dbPerfLog.start(`bloggerDB.getByProject (project_id=${restaurantId})`);
    const cacheKey = generateCacheKey('kol_bloggers', { project_id: restaurantId });
    const cached = cacheManager.get(cacheKey);
    if (cached) {
      dbPerfLog.cacheHit(`kol_bloggers project_id=${restaurantId}`);
      dbPerfLog.end('bloggerDB.getByProject', startTime, true);
      return cached;
    }

    dbPerfLog.cacheMiss(`kol_bloggers project_id=${restaurantId}`);
    return await withErrorHandling(async () => {
      const { data, error } = await supabase
        .from('kol_bloggers')
        .select('*')
        .eq('project_id', restaurantId)
        .order('created_at', { ascending: false });

      if (error) throw new Error(error.message);

      const transformed = (data || []).map(transformBlogger);
      cacheManager.set(cacheKey, transformed);
      dbPerfLog.end('bloggerDB.getByProject', startTime, false);
      return transformed;
    }, '获取博主列表失败');
  },

  // 获取项目分类的所有博主
  async getByCategory(categoryId) {
    const startTime = dbPerfLog.start(`bloggerDB.getByCategory (category_id=${categoryId})`);
    const cacheKey = generateCacheKey('kol_bloggers', { category_id: categoryId });
    const cached = cacheManager.get(cacheKey);
    if (cached) {
      dbPerfLog.cacheHit(`kol_bloggers category_id=${categoryId}`);
      dbPerfLog.end('bloggerDB.getByCategory', startTime, true);
      return cached;
    }

    dbPerfLog.cacheMiss(`kol_bloggers category_id=${categoryId}`);
    return await withErrorHandling(async () => {
      const { data, error } = await supabase
        .from('kol_bloggers')
        .select('*')
        .eq('category_id', categoryId)
        .order('created_at', { ascending: false });

      if (error) throw new Error(error.message);

      const transformed = (data || []).map(transformBlogger);
      cacheManager.set(cacheKey, transformed);
      dbPerfLog.end('bloggerDB.getByCategory', startTime, false);
      return transformed;
    }, '获取博主列表失败');
  },

  // 批量导入博主
  // categoryId 参数可选，如果提供则将博主关联到指定分类
  async importBatch(restaurantId, bloggers, categoryId = null) {
    const existingBloggers = await this.getByProject(restaurantId);
    const newBloggers = [];
    const insertData = [];

    for (const blogger of bloggers) {
      // 去重：检查昵称+主页链接
      const exists = existingBloggers.find(
        b => b.nickname === blogger.nickname && b.profileUrl === blogger.profileUrl
      );
      if (exists) continue;

      const bloggerData = {
        projectId: restaurantId,
        categoryId: blogger.categoryId || categoryId,
        nickname: blogger.nickname || '',
        followers: blogger.followers || 0,
        profileUrl: blogger.profileUrl || '',
        status: '待审核',
        xhsLikes: blogger.xhsLikes || null,
        xhsFavorites: blogger.xhsFavorites || null,
        xhsComments: blogger.xhsComments || null,
        xhsShares: blogger.xhsShares || null,
        dianpingLikes: blogger.dianpingLikes || null,
        dianpingFavorites: blogger.dianpingFavorites || null,
        dianpingComments: blogger.dianpingComments || null,
        dianpingShares: blogger.dianpingShares || null,
        douyinLikes: blogger.douyinLikes || null,
        douyinFavorites: blogger.douyinFavorites || null,
        douyinComments: blogger.douyinComments || null,
        douyinShares: blogger.douyinShares || null,
      };

      insertData.push(transformBloggerToSupabase(bloggerData));
      newBloggers.push(bloggerData);
    }

    if (insertData.length > 0) {
      return await withErrorHandling(async () => {
        await supabase.from('kol_bloggers').insert(insertData);
        cacheManager.delete(generateCacheKey('kol_bloggers', { project_id: restaurantId }));
        if (categoryId) {
          cacheManager.delete(generateCacheKey('kol_bloggers', { category_id: categoryId }));
        }
        return newBloggers;
      }, '批量导入博主失败');
    }

    return newBloggers;
  },

  // 更新博主信息
  async update(bloggerId, updates) {
    return await withErrorHandling(async () => {
      const { data: existing } = await supabase
        .from('kol_bloggers')
        .select('project_id, category_id')
        .eq('id', bloggerId)
        .single();

      if (!existing) throw new Error('博主不存在');

      // 字段映射
      const updateData = {
        updated_at: new Date().toISOString()
      };

      const fieldMap = {
        categoryId: 'category_id',
        nickname: 'nickname',
        followers: 'followers',
        profileUrl: 'profile_url',
        status: 'status',
        publishTime: 'publish_time',
        xhsLink: 'xhs_link',
        dianpingLink: 'dianping_link',
        douyinLink: 'douyin_link',
        weiboLink: 'weibo_link',
        notes: 'notes',
        xhsLikes: 'xhs_likes',
        xhsFavorites: 'xhs_favorites',
        xhsComments: 'xhs_comments',
        xhsShares: 'xhs_shares',
        dianpingLikes: 'dianping_likes',
        dianpingFavorites: 'dianping_favorites',
        dianpingComments: 'dianping_comments',
        dianpingShares: 'dianping_shares',
        douyinLikes: 'douyin_likes',
        douyinFavorites: 'douyin_favorites',
        douyinComments: 'douyin_comments',
        douyinShares: 'douyin_shares',
        weiboLikes: 'weibo_likes',
        weiboFavorites: 'weibo_favorites',
        weiboComments: 'weibo_comments',
        weiboShares: 'weibo_shares',
        contactInfo: 'contact_info',
        cooperationFee: 'cooperation_fee',
      };

      for (const [key, value] of Object.entries(updates)) {
        if (fieldMap[key]) {
          updateData[fieldMap[key]] = value;
        }
      }

      const { data } = await supabase
        .from('kol_bloggers')
        .update(updateData)
        .eq('id', bloggerId)
        .select()
        .single();

      // 清除相关缓存
      cacheManager.delete(generateCacheKey('kol_bloggers', { project_id: existing.project_id }));
      if (existing.category_id) {
        cacheManager.delete(generateCacheKey('kol_bloggers', { category_id: existing.category_id }));
      }
      // 如果分类改变了，也清除新分类的缓存
      if (updates.categoryId && updates.categoryId !== existing.category_id) {
        cacheManager.delete(generateCacheKey('kol_bloggers', { category_id: updates.categoryId }));
      }
      return transformBlogger(data);
    }, '更新博主信息失败');
  },

  // 批量更新博主状态
  async updateStatus(bloggerIds, status) {
    return await withErrorHandling(async () => {
      const { data: bloggers } = await supabase
        .from('kol_bloggers')
        .select('project_id')
        .in('id', bloggerIds);

      await supabase
        .from('kol_bloggers')
        .update({ status, updated_at: new Date().toISOString() })
        .in('id', bloggerIds);

      // 清除相关缓存
      const projectIds = [...new Set(bloggers?.map(b => b.project_id) || [])];
      projectIds.forEach(projectId => {
        cacheManager.delete(generateCacheKey('kol_bloggers', { project_id: projectId }));
      });
    }, '批量更新博主状态失败');
  },

  // 根据昵称查找博主
  async findByNickname(restaurantId, nickname) {
    const bloggers = await this.getByProject(restaurantId);

    // 先尝试精确匹配
    const exactMatch = bloggers.find(b => b.nickname === nickname);
    if (exactMatch) return exactMatch;

    // 如果精确匹配失败，尝试去除空格后匹配
    const trimmedNickname = nickname.trim();
    const trimMatch = bloggers.find(b => b.nickname.trim() === trimmedNickname);
    if (trimMatch) return trimMatch;

    return null;
  },

  // 删除博主
  async delete(bloggerId) {
    return await withErrorHandling(async () => {
      const { data: existing } = await supabase
        .from('kol_bloggers')
        .select('project_id, category_id')
        .eq('id', bloggerId)
        .single();

      if (!existing) throw new Error('博主不存在');

      await supabase.from('kol_bloggers').delete().eq('id', bloggerId);
      cacheManager.delete(generateCacheKey('kol_bloggers', { project_id: existing.project_id }));
      if (existing.category_id) {
        cacheManager.delete(generateCacheKey('kol_bloggers', { category_id: existing.category_id }));
      }
    }, '删除博主失败');
  },

  // 批量移动博主到新分类
  async moveToCategory(bloggerIds, newCategoryId) {
    return await withErrorHandling(async () => {
      // 获取受影响的博主以便清除缓存
      const { data: bloggers } = await supabase
        .from('kol_bloggers')
        .select('project_id, category_id')
        .in('id', bloggerIds);

      await supabase
        .from('kol_bloggers')
        .update({ category_id: newCategoryId, updated_at: new Date().toISOString() })
        .in('id', bloggerIds);

      // 清除相关缓存
      const projectIds = [...new Set(bloggers?.map(b => b.project_id) || [])];
      const categoryIds = [...new Set(bloggers?.map(b => b.category_id).filter(Boolean) || [])];

      projectIds.forEach(projectId => {
        cacheManager.delete(generateCacheKey('kol_bloggers', { project_id: projectId }));
      });
      categoryIds.forEach(categoryId => {
        cacheManager.delete(generateCacheKey('kol_bloggers', { category_id: categoryId }));
      });
      if (newCategoryId) {
        cacheManager.delete(generateCacheKey('kol_bloggers', { category_id: newCategoryId }));
      }
    }, '批量移动博主失败');
  },
};

// ============================================================
// 本地备份功能（Electron 环境）
// ============================================================
export const localBackup = {
  // 备份品牌数据到本地
  async backupBrands() {
    if (!isElectron()) return;

    try {
      const brands = await projectGroupDB.getAll();
      for (const brand of brands) {
        await window.electron.db.run(
          `INSERT OR REPLACE INTO project_groups (id, name, created_at, updated_at)
           VALUES (?, ?, ?, ?)`,
          [brand.id, brand.name, brand.createdAt, brand.updatedAt]
        );
      }
      console.log(`已备份 ${brands.length} 个品牌到本地`);
    } catch (error) {
      console.error('备份品牌失败:', error);
    }
  },

  // 备份门店数据到本地
  async backupRestaurants() {
    if (!isElectron()) return;

    try {
      const restaurants = await projectDB.getAll();
      for (const restaurant of restaurants) {
        await window.electron.db.run(
          `INSERT OR REPLACE INTO projects (id, group_id, name, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?)`,
          [restaurant.id, restaurant.groupId, restaurant.name, restaurant.createdAt, restaurant.updatedAt]
        );
      }
      console.log(`已备份 ${restaurants.length} 个门店到本地`);
    } catch (error) {
      console.error('备份门店失败:', error);
    }
  },

  // 备份博主数据到本地
  async backupBloggers(restaurantId) {
    if (!isElectron()) return;

    try {
      const bloggers = await bloggerDB.getByProject(restaurantId);
      for (const blogger of bloggers) {
        await window.electron.db.run(
          `INSERT OR REPLACE INTO bloggers (
            id, project_id, nickname, followers, profile_url, status,
            publish_time, xhs_link, dianping_link, douyin_link, notes,
            xhs_likes, xhs_favorites, xhs_comments, xhs_shares,
            dianping_likes, dianping_favorites, dianping_comments, dianping_shares,
            douyin_likes, douyin_favorites, douyin_comments, douyin_shares,
            created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            blogger.id, blogger.projectId, blogger.nickname, blogger.followers,
            blogger.profileUrl, blogger.status, blogger.publishTime,
            blogger.xhsLink, blogger.dianpingLink, blogger.douyinLink, blogger.notes,
            blogger.xhsLikes, blogger.xhsFavorites, blogger.xhsComments, blogger.xhsShares,
            blogger.dianpingLikes, blogger.dianpingFavorites, blogger.dianpingComments, blogger.dianpingShares,
            blogger.douyinLikes, blogger.douyinFavorites, blogger.douyinComments, blogger.douyinShares,
            blogger.createdAt, blogger.updatedAt
          ]
        );
      }
      console.log(`已备份 ${bloggers.length} 个博主到本地`);
    } catch (error) {
      console.error('备份博主失败:', error);
    }
  },

  // 执行全量备份
  async fullBackup() {
    await this.backupBrands();
    await this.backupRestaurants();
    // 博主需要按门店备份
    const restaurants = await projectDB.getAll();
    for (const restaurant of restaurants) {
      await this.backupBloggers(restaurant.id);
    }
  }
};

// 导出数据库检测函数
export { isElectron };
