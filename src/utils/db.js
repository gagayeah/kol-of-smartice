// 数据库工具 - 使用 Supabase 云数据库

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

// 本地存储当前选中的项目集和项目ID（用于会话保持）
const CURRENT_GROUP_KEY = 'current_group_id';
const CURRENT_PROJECT_KEY = 'current_project_id';

// 检测是否在Electron环境中（保持兼容性）
const isElectron = () => typeof window !== 'undefined' && window.electron;

// 获取当前项目集ID
function getCurrentGroupId() {
  return localStorage.getItem(CURRENT_GROUP_KEY);
}

// 设置当前项目集ID
function setCurrentGroupId(groupId) {
  if (groupId) {
    localStorage.setItem(CURRENT_GROUP_KEY, groupId);
  } else {
    localStorage.removeItem(CURRENT_GROUP_KEY);
  }
}

// 获取当前项目ID
function getCurrentProjectId() {
  return localStorage.getItem(CURRENT_PROJECT_KEY);
}

// 设置当前项目ID
function setCurrentProjectId(projectId) {
  if (projectId) {
    localStorage.setItem(CURRENT_PROJECT_KEY, projectId);
  } else {
    localStorage.removeItem(CURRENT_PROJECT_KEY);
  }
}

// 项目集管理（一级）
export const projectGroupDB = {
  // 获取所有项目集
  async getAll() {
    const cacheKey = generateCacheKey('kol_project_groups');

    // 尝试从缓存获取
    const cached = cacheManager.get(cacheKey);
    if (cached) {
      return cached;
    }

    return await withErrorHandling(async () => {
      const { data } = await supabase
        .from('kol_project_groups')
        .select('*')
        .order('created_at', { ascending: false });

      const transformed = data.map(item => transformFromSupabase(item, 'kol_project_groups'));

      // 缓存结果
      cacheManager.set(cacheKey, transformed);

      return transformed;
    }, '获取项目集列表失败');
  },

  // 创建项目集
  async create(name) {
    return await withErrorHandling(async () => {
      const now = Date.now();
      const { data } = await supabase
        .from('kol_project_groups')
        .insert([transformToSupabase({ name, createdAt: now, updatedAt: now }, 'kol_project_groups')])
        .select()
        .single();

      const transformed = transformFromSupabase(data, 'kol_project_groups');

      // 设置为当前项目集
      setCurrentGroupId(transformed.id);
      setCurrentProjectId(null); // 清理当前项目ID

      // 清除相关缓存
      cacheManager.clear('kol_project_groups');

      return transformed;
    }, '创建项目集失败');
  },

  // 获取当前项目集
  async getCurrent() {
    const groups = await this.getAll();
    const currentId = getCurrentGroupId();

    // 添加调试日志
    console.log('getCurrent - currentId from localStorage:', currentId);
    console.log('getCurrent - available groups:', groups.map(g => ({ id: g.id, name: g.name })));

    const currentGroup = groups.find(g => g.id === currentId) || groups[0];
    console.log('getCurrent - returning group:', currentGroup);

    return currentGroup;
  },

  // 切换项目集
  async switch(groupId) {
    setCurrentGroupId(groupId);
    // 重要：清理currentProjectId，防止项目显示在错误的项目集中
    setCurrentProjectId(null);

    // 清除相关缓存
    cacheManager.clear('kol_projects');
    cacheManager.clear('kol_bloggers');
  },

  // 重命名项目集
  async rename(groupId, newName) {
    return await withErrorHandling(async () => {
      const { data } = await supabase
        .from('kol_project_groups')
        .update({
          name: newName,
          updated_at: Date.now()
        })
        .eq('id', groupId)
        .select()
        .single();

      // 清除相关缓存
      cacheManager.clear('kol_project_groups');

      return transformFromSupabase(data, 'kol_project_groups');
    }, '重命名项目集失败');
  },

  // 删除项目集（会级联删除所有项目和博主）
  async delete(groupId) {
    return await withErrorHandling(async () => {
      // Supabase会通过外键约束自动级联删除
      await supabase
        .from('kol_project_groups')
        .delete()
        .eq('id', groupId);

      const currentId = getCurrentGroupId();
      if (currentId === groupId) {
        const groups = await this.getAll();
        setCurrentGroupId(groups[0]?.id || null);
        // 重要：清理currentProjectId，因为原项目已删除
        setCurrentProjectId(null);
      }

      // 清除所有相关缓存
      cacheManager.clear();
    }, '删除项目集失败');
  },
};

// 项目管理（二级）
export const projectDB = {
  // 获取所有项目
  async getAll() {
    const cacheKey = generateCacheKey('kol_projects');

    // 尝试从缓存获取
    const cached = cacheManager.get(cacheKey);
    if (cached) {
      return cached;
    }

    return await withErrorHandling(async () => {
      const { data } = await supabase
        .from('kol_projects')
        .select('*')
        .order('created_at', { ascending: false });

      const transformed = data.map(item => transformFromSupabase(item, 'kol_projects'));

      // 缓存结果
      cacheManager.set(cacheKey, transformed);

      return transformed;
    }, '获取项目列表失败');
  },

  // 获取特定项目集的所有项目（包括所有层级）
  async getByGroup(groupId) {
    const cacheKey = generateCacheKey('kol_projects', { group_id: groupId });

    // 尝试从缓存获取
    const cached = cacheManager.get(cacheKey);
    if (cached) {
      return cached;
    }

    return await withErrorHandling(async () => {
      const { data } = await supabase
        .from('kol_projects')
        .select('*')
        .eq('group_id', groupId)
        .order('created_at', { ascending: false });

      const transformed = data.map(item => transformFromSupabase(item, 'kol_projects'));

      // 缓存结果
      cacheManager.set(cacheKey, transformed);

      return transformed;
    }, '获取项目集项目失败');
  },

  // 获取某个项目的所有子项目
  async getChildren(parentId) {
    const cacheKey = generateCacheKey('kol_projects', { parent_id: parentId });

    // 尝试从缓存获取
    const cached = cacheManager.get(cacheKey);
    if (cached) {
      return cached;
    }

    return await withErrorHandling(async () => {
      const { data } = await supabase
        .from('kol_projects')
        .select('*')
        .eq('parent_id', parentId)
        .order('created_at', { ascending: false });

      const transformed = data.map(item => transformFromSupabase(item, 'kol_projects'));

      // 缓存结果
      cacheManager.set(cacheKey, transformed);

      return transformed;
    }, '获取子项目失败');
  },

  // 创建项目（需要指定所属项目集，可选父项目）
  async create(name, groupId, parentId = null) {
    return await withErrorHandling(async () => {
      const now = Date.now();
      const { data } = await supabase
        .from('kol_projects')
        .insert([transformToSupabase({
          name,
          groupId,
          parentId,
          createdAt: now,
          updatedAt: now
        }, 'kol_projects')])
        .select()
        .single();

      const transformed = transformFromSupabase(data, 'kol_projects');

      // 只有当项目属于当前项目集时，才设置为当前项目
      const currentGroupId = getCurrentGroupId();
      if (groupId === currentGroupId) {
        setCurrentProjectId(transformed.id);
      }

      // 清除相关缓存
      cacheManager.clear('kol_projects');

      return transformed;
    }, '创建项目失败');
  },

  // 获取当前项目（必须是当前项目集的项目）
  async getCurrent(currentGroupId = null) {
    const currentId = getCurrentProjectId();
    const groupId = currentGroupId || getCurrentGroupId();

    if (!groupId) return null;

    // 获取当前项目集的所有项目
    const groupProjects = await this.getByGroup(groupId);
    // 只在当前项目集中查找
    return groupProjects.find(p => p.id === currentId) || groupProjects[0] || null;
  },

  // 切换项目
  async switch(projectId) {
    setCurrentProjectId(projectId);
  },

  // 重命名项目
  async rename(projectId, newName) {
    return await withErrorHandling(async () => {
      const { data } = await supabase
        .from('kol_projects')
        .update({
          name: newName,
          updated_at: Date.now()
        })
        .eq('id', projectId)
        .select()
        .single();

      // 清除相关缓存
      cacheManager.clear('kol_projects');

      return transformFromSupabase(data, 'kol_projects');
    }, '重命名项目失败');
  },

  // 更新项目的父级（调整层级）
  async updateParent(projectId, newParentId) {
    return await withErrorHandling(async () => {
      const { data } = await supabase
        .from('kol_projects')
        .update({
          parent_id: newParentId,
          updated_at: Date.now()
        })
        .eq('id', projectId)
        .select()
        .single();

      // 清除相关缓存
      cacheManager.clear('kol_projects');

      return transformFromSupabase(data, 'kol_projects');
    }, '更新项目层级失败');
  },

  // 删除项目（递归删除所有子项目和博主）
  async delete(projectId) {
    return await withErrorHandling(async () => {
      // 递归获取所有子项目ID
      const getAllChildIds = async (parentId) => {
        const children = await this.getChildren(parentId);
        let allIds = [parentId];
        for (const child of children) {
          const childIds = await getAllChildIds(child.id);
          allIds = allIds.concat(childIds);
        }
        return allIds;
      };

      const allProjectIds = await getAllChildIds(projectId);

      // 删除所有项目的博主
      await supabase
        .from('kol_bloggers')
        .delete()
        .in('project_id', allProjectIds);

      // 删除所有项目（Supabase会通过外键约束自动级联删除子项目）
      await supabase
        .from('kol_projects')
        .delete()
        .in('id', allProjectIds);

      const currentId = getCurrentProjectId();
      if (allProjectIds.includes(currentId)) {
        // 获取当前项目集的项目，而不是所有项目
        const currentGroupId = getCurrentGroupId();
        if (currentGroupId) {
          const groupProjects = await this.getByGroup(currentGroupId);
          setCurrentProjectId(groupProjects[0]?.id || null);
        } else {
          setCurrentProjectId(null);
        }
      }

      // 清除所有相关缓存
      cacheManager.clear();
    }, '删除项目失败');
  },
};

// 博主管理
export const bloggerDB = {
  // 获取当前项目的所有博主
  async getByProject(projectId) {
    const cacheKey = generateCacheKey('kol_bloggers', { project_id: projectId });

    // 尝试从缓存获取
    const cached = cacheManager.get(cacheKey);
    if (cached) {
      return cached;
    }

    return await withErrorHandling(async () => {
      const { data } = await supabase
        .from('kol_bloggers')
        .select('*')
        .eq('project_id', projectId)
        .order('created_at', { ascending: false });

      const transformed = data.map(item => transformFromSupabase(item, 'kol_bloggers'));

      // 缓存结果
      cacheManager.set(cacheKey, transformed);

      return transformed;
    }, '获取博主列表失败');
  },

  // 批量导入博主
  async importBatch(projectId, bloggers) {
    console.log('importBatch 收到的数据：', bloggers);

    return await withErrorHandling(async () => {
      const existingBloggers = await this.getByProject(projectId);
      const newBloggers = [];
      const insertData = [];

      for (const blogger of bloggers) {
        // 去重：检查昵称+主页链接
        const exists = existingBloggers.find(
          b => b.nickname === blogger.nickname && b.profileUrl === blogger.profileUrl
        );

        if (exists) {
          console.log('跳过重复博主：', blogger.nickname);
          continue;
        }

        const now = Date.now();
        const newBloggerData = {
          projectId,
          nickname: blogger.nickname || '',
          followers: blogger.followers || 0,
          profileUrl: blogger.profileUrl || '',
          status: '待审核',
          publishTime: null,
          xhsLink: '',
          dianpingLink: '',
          douyinLink: '',
          notes: '',
          // 小红书互动数据
          xhsLikes: blogger.xhsLikes || null,
          xhsFavorites: blogger.xhsFavorites || null,
          xhsComments: blogger.xhsComments || null,
          xhsShares: blogger.xhsShares || null,
          // 大众点评互动数据
          dianpingLikes: blogger.dianpingLikes || null,
          dianpingFavorites: blogger.dianpingFavorites || null,
          dianpingComments: blogger.dianpingComments || null,
          dianpingShares: blogger.dianpingShares || null,
          // 抖音互动数据
          douyinLikes: blogger.douyinLikes || null,
          douyinFavorites: blogger.douyinFavorites || null,
          douyinComments: blogger.douyinComments || null,
          douyinShares: blogger.douyinShares || null,
          createdAt: now,
          updatedAt: now,
        };

        insertData.push(transformToSupabase(newBloggerData, 'kol_bloggers'));

        newBloggers.push({
          projectId,
          nickname: blogger.nickname,
          followers: blogger.followers,
          profileUrl: blogger.profileUrl,
          status: '待审核',
        });
      }

      if (insertData.length > 0) {
        // 批量插入到 Supabase
        const { data } = await supabase
          .from('kol_bloggers')
          .insert(insertData)
          .select();

        console.log('成功导入的博主列表：', newBloggers);

        // 清除相关缓存
        cacheManager.clear(`kol_bloggers:project_id:${projectId}`);
      }

      return newBloggers;
    }, '批量导入博主失败');
  },

  // 更新博主信息
  async update(bloggerId, updates) {
    return await withErrorHandling(async () => {
      // 先获取博主信息以获得 projectId
      const { data: existing } = await supabase
        .from('kol_bloggers')
        .select('project_id')
        .eq('id', bloggerId)
        .single();

      if (!existing) {
        throw new Error('博主不存在');
      }

      // 添加更新时间
      const updateData = {
        ...updates,
        updated_at: Date.now()
      };

      const { data } = await supabase
        .from('kol_bloggers')
        .update(transformToSupabase(updateData, 'kol_bloggers'))
        .eq('id', bloggerId)
        .select()
        .single();

      const transformed = transformFromSupabase(data, 'kol_bloggers');

      // 清除相关缓存
      cacheManager.clear(`kol_bloggers:project_id:${existing.project_id}`);

      return transformed;
    }, '更新博主信息失败');
  },

  // 批量更新博主状态
  async updateStatus(bloggerIds, status) {
    return await withErrorHandling(async () => {
      // 先获取所有博主的项目ID
      const { data: bloggers } = await supabase
        .from('kol_bloggers')
        .select('project_id')
        .in('id', bloggerIds);

      await supabase
        .from('kol_bloggers')
        .update({
          status: status,
          updated_at: Date.now()
        })
        .in('id', bloggerIds);

      // 清除相关缓存
      const projectIds = [...new Set(bloggers?.map(b => b.project_id) || [])];
      projectIds.forEach(projectId => {
        cacheManager.clear(`kol_bloggers:project_id:${projectId}`);
      });
    }, '批量更新博主状态失败');
  },

  // 根据昵称查找博主
  async findByNickname(projectId, nickname) {
    const bloggers = await this.getByProject(projectId);

    // 先尝试精确匹配
    const exactMatch = bloggers.find(b => b.nickname === nickname);
    if (exactMatch) return exactMatch;

    // 如果精确匹配失败，尝试去除空格后匹配
    const trimmedNickname = nickname.trim();
    const trimMatch = bloggers.find(b => b.nickname.trim() === trimmedNickname);
    if (trimMatch) {
      console.log(`模糊匹配成功：'${nickname}' -> '${trimMatch.nickname}'`);
      return trimMatch;
    }

    // 如果还是失败，输出调试信息
    console.log(`未找到博主：'${nickname}'`);
    console.log('当前项目ID:', projectId);
    console.log('当前项目所有博主:', bloggers.map(b => `'${b.nickname}'`));

    return null;
  },

  // 删除博主
  async delete(bloggerId) {
    return await withErrorHandling(async () => {
      // 先获取博主信息以获得 projectId
      const { data: existing } = await supabase
        .from('kol_bloggers')
        .select('project_id')
        .eq('id', bloggerId)
        .single();

      if (!existing) {
        throw new Error('博主不存在');
      }

      await supabase
        .from('kol_bloggers')
        .delete()
        .eq('id', bloggerId);

      // 清除相关缓存
      cacheManager.clear(`kol_bloggers:project_id:${existing.project_id}`);
    }, '删除博主失败');
  },
};

// 导出数据库检测函数
export { isElectron };
