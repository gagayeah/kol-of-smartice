// 数据库工具 - 支持Electron SQLite和浏览器LocalStorage

const DB_KEY = 'blogger_tracker_db';

// 检测是否在Electron环境中
const isElectron = () => typeof window !== 'undefined' && window.electron;

// LocalStorage版本（浏览器环境）
function initLocalDB() {
  const db = localStorage.getItem(DB_KEY);
  if (!db) {
    const initialData = {
      projectGroups: [],
      projects: [],
      bloggers: [],
      currentGroupId: null,
      currentProjectId: null,
    };
    localStorage.setItem(DB_KEY, JSON.stringify(initialData));
    return initialData;
  }
  return JSON.parse(db);
}

function getLocalDB() {
  return initLocalDB();
}

function saveLocalDB(data) {
  localStorage.setItem(DB_KEY, JSON.stringify(data));
}

// 项目集管理（一级）
export const projectGroupDB = {
  // 获取所有项目集
  async getAll() {
    if (isElectron()) {
      const groups = await window.electron.db.query(
        'SELECT * FROM project_groups ORDER BY created_at DESC',
        []
      );
      return groups.map(g => ({
        id: g.id,
        name: g.name,
        createdAt: g.created_at,
        updatedAt: g.updated_at,
      }));
    }

    const db = getLocalDB();
    return db.projectGroups || [];
  },

  // 创建项目集
  async create(name) {
    const id = Date.now().toString();
    const now = Date.now();

    if (isElectron()) {
      await window.electron.db.run(
        'INSERT INTO project_groups (id, name, created_at, updated_at) VALUES (?, ?, ?, ?)',
        [id, name, now, now]
      );

      // 设置为当前项目集
      localStorage.setItem('currentGroupId', id);

      return { id, name, createdAt: now, updatedAt: now };
    }

    const db = getLocalDB();
    if (!db.projectGroups) db.projectGroups = [];

    const newGroup = {
      id,
      name,
      createdAt: now,
      updatedAt: now,
    };
    db.projectGroups.push(newGroup);
    db.currentGroupId = newGroup.id;
    saveLocalDB(db);
    return newGroup;
  },

  // 获取当前项目集
  async getCurrent() {
    const groups = await this.getAll();

    if (isElectron()) {
      const currentId = localStorage.getItem('currentGroupId');
      return groups.find(g => g.id === currentId) || groups[0];
    }

    const db = getLocalDB();
    return groups.find(g => g.id === db.currentGroupId) || groups[0];
  },

  // 切换项目集
  async switch(groupId) {
    if (isElectron()) {
      localStorage.setItem('currentGroupId', groupId);
      return;
    }

    const db = getLocalDB();
    db.currentGroupId = groupId;
    saveLocalDB(db);
  },

  // 重命名项目集
  async rename(groupId, newName) {
    if (isElectron()) {
      await window.electron.db.run(
        'UPDATE project_groups SET name = ?, updated_at = ? WHERE id = ?',
        [newName, Date.now(), groupId]
      );
      return;
    }

    const db = getLocalDB();
    const group = db.projectGroups?.find(g => g.id === groupId);
    if (group) {
      group.name = newName;
      group.updatedAt = Date.now();
      saveLocalDB(db);
    }
  },

  // 删除项目集（会级联删除所有项目和博主）
  async delete(groupId) {
    if (isElectron()) {
      // SQLite会通过外键约束自动级联删除
      await window.electron.db.run('DELETE FROM project_groups WHERE id = ?', [groupId]);

      const currentId = localStorage.getItem('currentGroupId');
      if (currentId === groupId) {
        const groups = await this.getAll();
        localStorage.setItem('currentGroupId', groups[0]?.id || '');
        // 重要：清理currentProjectId，因为原项目已删除
        localStorage.setItem('currentProjectId', '');
      }
      return;
    }

    const db = getLocalDB();
    // 删除项目集下的所有项目
    const projectsToDelete = db.projects?.filter(p => p.groupId === groupId).map(p => p.id) || [];
    // 删除这些项目的所有博主
    db.bloggers = db.bloggers?.filter(b => !projectsToDelete.includes(b.projectId)) || [];
    // 删除项目
    db.projects = db.projects?.filter(p => p.groupId !== groupId) || [];
    // 删除项目集
    db.projectGroups = db.projectGroups?.filter(g => g.id !== groupId) || [];

    if (db.currentGroupId === groupId) {
      db.currentGroupId = db.projectGroups[0]?.id || null;
      db.currentProjectId = null;
    }
    saveLocalDB(db);
  },
};

// 项目管理（二级）
export const projectDB = {
  // 获取所有项目
  async getAll() {
    if (isElectron()) {
      const projects = await window.electron.db.query(
        'SELECT * FROM projects ORDER BY created_at DESC',
        []
      );
      return projects.map(p => ({
        id: p.id,
        groupId: p.group_id,
        parentId: p.parent_id,
        name: p.name,
        createdAt: p.created_at,
        updatedAt: p.updated_at,
      }));
    }
    return getLocalDB().projects || [];
  },

  // 获取特定项目集的所有项目（包括所有层级）
  async getByGroup(groupId) {
    if (isElectron()) {
      const projects = await window.electron.db.query(
        'SELECT * FROM projects WHERE group_id = ? ORDER BY created_at DESC',
        [groupId]
      );
      return projects.map(p => ({
        id: p.id,
        groupId: p.group_id,
        parentId: p.parent_id,
        name: p.name,
        createdAt: p.created_at,
        updatedAt: p.updated_at,
      }));
    }

    const db = getLocalDB();
    return (db.projects || []).filter(p => p.groupId === groupId);
  },

  // 获取某个项目的所有子项目
  async getChildren(parentId) {
    if (isElectron()) {
      const projects = await window.electron.db.query(
        'SELECT * FROM projects WHERE parent_id = ? ORDER BY created_at DESC',
        [parentId]
      );
      return projects.map(p => ({
        id: p.id,
        groupId: p.group_id,
        parentId: p.parent_id,
        name: p.name,
        createdAt: p.created_at,
        updatedAt: p.updated_at,
      }));
    }

    const db = getLocalDB();
    return (db.projects || []).filter(p => p.parentId === parentId);
  },

  // 创建项目（需要指定所属项目集，可选父项目）
  async create(name, groupId, parentId = null) {
    const id = Date.now().toString();
    const now = Date.now();

    if (isElectron()) {
      await window.electron.db.run(
        'INSERT INTO projects (id, group_id, parent_id, name, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)',
        [id, groupId, parentId, name, now, now]
      );

      // 设置为当前项目
      localStorage.setItem('currentProjectId', id);

      return { id, groupId, parentId, name, createdAt: now, updatedAt: now };
    }

    const db = getLocalDB();
    if (!db.projects) db.projects = [];

    const newProject = {
      id,
      groupId,
      parentId,
      name,
      createdAt: now,
      updatedAt: now,
    };
    db.projects.push(newProject);
    db.currentProjectId = newProject.id;
    saveLocalDB(db);
    return newProject;
  },

  // 获取当前项目（必须是当前项目集的项目）
  async getCurrent(currentGroupId = null) {
    if (isElectron()) {
      const currentId = localStorage.getItem('currentProjectId');
      const currentGroupId = currentGroupId || localStorage.getItem('currentGroupId');

      if (!currentGroupId) return null;

      // 获取当前项目集的所有项目
      const groupProjects = await this.getByGroup(currentGroupId);
      // 只在当前项目集中查找
      return groupProjects.find(p => p.id === currentId) || groupProjects[0] || null;
    }

    const db = getLocalDB();
    if (!db.currentGroupId) return null;

    const groupProjects = db.projects?.filter(p => p.groupId === db.currentGroupId) || [];
    return groupProjects.find(p => p.id === db.currentProjectId) || groupProjects[0] || null;
  },

  // 切换项目
  async switch(projectId) {
    if (isElectron()) {
      localStorage.setItem('currentProjectId', projectId);
      return;
    }

    const db = getLocalDB();
    db.currentProjectId = projectId;
    saveLocalDB(db);
  },

  // 重命名项目
  async rename(projectId, newName) {
    if (isElectron()) {
      await window.electron.db.run(
        'UPDATE projects SET name = ?, updated_at = ? WHERE id = ?',
        [newName, Date.now(), projectId]
      );
      return;
    }

    const db = getLocalDB();
    const project = db.projects?.find(p => p.id === projectId);
    if (project) {
      project.name = newName;
      project.updatedAt = Date.now();
      saveLocalDB(db);
    }
  },

  // 更新项目的父级（调整层级）
  async updateParent(projectId, newParentId) {
    if (isElectron()) {
      await window.electron.db.run(
        'UPDATE projects SET parent_id = ?, updated_at = ? WHERE id = ?',
        [newParentId, Date.now(), projectId]
      );
      return;
    }

    const db = getLocalDB();
    const project = db.projects?.find(p => p.id === projectId);
    if (project) {
      project.parentId = newParentId;
      project.updatedAt = Date.now();
      saveLocalDB(db);
    }
  },

  // 删除项目（递归删除所有子项目和博主）
  async delete(projectId) {
    if (isElectron()) {
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
      for (const id of allProjectIds) {
        await window.electron.db.run('DELETE FROM bloggers WHERE project_id = ?', [id]);
      }

      // 删除所有项目
      for (const id of allProjectIds) {
        await window.electron.db.run('DELETE FROM projects WHERE id = ?', [id]);
      }

      const currentId = localStorage.getItem('currentProjectId');
      if (allProjectIds.includes(currentId)) {
        // 获取当前项目集的项目，而不是所有项目
        const currentGroupId = localStorage.getItem('currentGroupId');
        if (currentGroupId) {
          const groupProjects = await this.getByGroup(currentGroupId);
          localStorage.setItem('currentProjectId', groupProjects[0]?.id || '');
        } else {
          localStorage.setItem('currentProjectId', '');
        }
      }
      return;
    }

    const db = getLocalDB();

    // LocalStorage版本的递归删除
    const getAllChildIds = (parentId) => {
      const children = (db.projects || []).filter(p => p.parentId === parentId);
      let allIds = [parentId];
      for (const child of children) {
        allIds = allIds.concat(getAllChildIds(child.id));
      }
      return allIds;
    };

    const allProjectIds = getAllChildIds(projectId);

    db.projects = db.projects.filter(p => !allProjectIds.includes(p.id));
    db.bloggers = db.bloggers.filter(b => !allProjectIds.includes(b.projectId));

    if (allProjectIds.includes(db.currentProjectId)) {
      db.currentProjectId = db.projects[0]?.id || null;
    }
    saveLocalDB(db);
  },
};

// 博主管理
export const bloggerDB = {
  // 获取当前项目的所有博主
  async getByProject(projectId) {
    if (isElectron()) {
      const bloggers = await window.electron.db.query(
        'SELECT * FROM bloggers WHERE project_id = ? ORDER BY created_at DESC',
        [projectId]
      );
      return bloggers.map(b => ({
        id: String(b.id),
        projectId: b.project_id,
        nickname: b.nickname,
        followers: b.followers,
        profileUrl: b.profile_url,
        status: b.status,
        publishTime: b.publish_time,
        xhsLink: b.xhs_link,
        dianpingLink: b.dianping_link,
        douyinLink: b.douyin_link,
        notes: b.notes || '',
        // 小红书互动数据
        xhsLikes: b.xhs_likes,
        xhsFavorites: b.xhs_favorites,
        xhsComments: b.xhs_comments,
        xhsShares: b.xhs_shares,
        // 大众点评互动数据
        dianpingLikes: b.dianping_likes,
        dianpingFavorites: b.dianping_favorites,
        dianpingComments: b.dianping_comments,
        dianpingShares: b.dianping_shares,
        // 抖音互动数据
        douyinLikes: b.douyin_likes,
        douyinFavorites: b.douyin_favorites,
        douyinComments: b.douyin_comments,
        douyinShares: b.douyin_shares,
        createdAt: b.created_at,
        updatedAt: b.updated_at,
      }));
    }

    const db = getLocalDB();
    return db.bloggers.filter(b => b.projectId === projectId);
  },

  // 批量导入博主
  async importBatch(projectId, bloggers) {
    console.log('importBatch 收到的数据：', bloggers);

    if (isElectron()) {
      const existingBloggers = await this.getByProject(projectId);
      const newBloggers = [];

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
        await window.electron.db.run(
          `INSERT INTO bloggers (
            project_id, nickname, followers, profile_url, status,
            publish_time, xhs_link, dianping_link, douyin_link, notes,
            xhs_likes, xhs_favorites, xhs_comments, xhs_shares,
            dianping_likes, dianping_favorites, dianping_comments, dianping_shares,
            douyin_likes, douyin_favorites, douyin_comments, douyin_shares,
            created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            projectId,
            blogger.nickname || '',
            blogger.followers || 0,
            blogger.profileUrl || '',
            '待审核',
            null,
            '',
            '',
            '',
            '',
            // 小红书互动数据
            blogger.xhsLikes || null,
            blogger.xhsFavorites || null,
            blogger.xhsComments || null,
            blogger.xhsShares || null,
            // 大众点评互动数据
            blogger.dianpingLikes || null,
            blogger.dianpingFavorites || null,
            blogger.dianpingComments || null,
            blogger.dianpingShares || null,
            // 抖音互动数据
            blogger.douyinLikes || null,
            blogger.douyinFavorites || null,
            blogger.douyinComments || null,
            blogger.douyinShares || null,
            now,
            now,
          ]
        );

        newBloggers.push({
          projectId,
          nickname: blogger.nickname,
          followers: blogger.followers,
          profileUrl: blogger.profileUrl,
          status: '待审核',
        });
      }

      console.log('成功导入的博主列表：', newBloggers);
      return newBloggers;
    }

    // LocalStorage版本
    const db = getLocalDB();
    const existingBloggers = await this.getByProject(projectId);

    const newBloggers = [];
    let idCounter = 0;

    for (const blogger of bloggers) {
      const exists = existingBloggers.find(
        b => b.nickname === blogger.nickname && b.profileUrl === blogger.profileUrl
      );

      if (exists) {
        console.log('跳过重复博主：', blogger.nickname);
        continue;
      }

      const newBlogger = {
        id: `${Date.now()}_${idCounter++}_${Math.random().toString(36).substr(2, 9)}`,
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
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      console.log('创建新博主对象：', newBlogger);
      newBloggers.push(newBlogger);
    }

    console.log('即将保存的新博主列表：', newBloggers);
    db.bloggers.push(...newBloggers);
    saveLocalDB(db);
    return newBloggers;
  },

  // 更新博主信息
  async update(bloggerId, updates) {
    if (isElectron()) {
      const updateFields = [];
      const updateValues = [];

      if (updates.status !== undefined) {
        updateFields.push('status = ?');
        updateValues.push(updates.status);
      }
      if (updates.publishTime !== undefined) {
        updateFields.push('publish_time = ?');
        updateValues.push(updates.publishTime);
      }
      if (updates.xhsLink !== undefined) {
        updateFields.push('xhs_link = ?');
        updateValues.push(updates.xhsLink);
      }
      if (updates.dianpingLink !== undefined) {
        updateFields.push('dianping_link = ?');
        updateValues.push(updates.dianpingLink);
      }
      if (updates.douyinLink !== undefined) {
        updateFields.push('douyin_link = ?');
        updateValues.push(updates.douyinLink);
      }
      if (updates.notes !== undefined) {
        updateFields.push('notes = ?');
        updateValues.push(updates.notes);
      }
      // 小红书互动数据
      if (updates.xhsLikes !== undefined) {
        updateFields.push('xhs_likes = ?');
        updateValues.push(updates.xhsLikes);
      }
      if (updates.xhsFavorites !== undefined) {
        updateFields.push('xhs_favorites = ?');
        updateValues.push(updates.xhsFavorites);
      }
      if (updates.xhsComments !== undefined) {
        updateFields.push('xhs_comments = ?');
        updateValues.push(updates.xhsComments);
      }
      if (updates.xhsShares !== undefined) {
        updateFields.push('xhs_shares = ?');
        updateValues.push(updates.xhsShares);
      }
      // 大众点评互动数据
      if (updates.dianpingLikes !== undefined) {
        updateFields.push('dianping_likes = ?');
        updateValues.push(updates.dianpingLikes);
      }
      if (updates.dianpingFavorites !== undefined) {
        updateFields.push('dianping_favorites = ?');
        updateValues.push(updates.dianpingFavorites);
      }
      if (updates.dianpingComments !== undefined) {
        updateFields.push('dianping_comments = ?');
        updateValues.push(updates.dianpingComments);
      }
      if (updates.dianpingShares !== undefined) {
        updateFields.push('dianping_shares = ?');
        updateValues.push(updates.dianpingShares);
      }
      // 抖音互动数据
      if (updates.douyinLikes !== undefined) {
        updateFields.push('douyin_likes = ?');
        updateValues.push(updates.douyinLikes);
      }
      if (updates.douyinFavorites !== undefined) {
        updateFields.push('douyin_favorites = ?');
        updateValues.push(updates.douyinFavorites);
      }
      if (updates.douyinComments !== undefined) {
        updateFields.push('douyin_comments = ?');
        updateValues.push(updates.douyinComments);
      }
      if (updates.douyinShares !== undefined) {
        updateFields.push('douyin_shares = ?');
        updateValues.push(updates.douyinShares);
      }

      updateFields.push('updated_at = ?');
      updateValues.push(Date.now());
      updateValues.push(bloggerId);

      await window.electron.db.run(
        `UPDATE bloggers SET ${updateFields.join(', ')} WHERE id = ?`,
        updateValues
      );

      const result = await window.electron.db.query(
        'SELECT * FROM bloggers WHERE id = ?',
        [bloggerId]
      );

      if (result[0]) {
        const b = result[0];
        return {
          id: String(b.id),
          projectId: b.project_id,
          nickname: b.nickname,
          followers: b.followers,
          profileUrl: b.profile_url,
          status: b.status,
          publishTime: b.publish_time,
          xhsLink: b.xhs_link,
          dianpingLink: b.dianping_link,
          douyinLink: b.douyin_link,
          notes: b.notes || '',
          // 小红书互动数据
          xhsLikes: b.xhs_likes,
          xhsFavorites: b.xhs_favorites,
          xhsComments: b.xhs_comments,
          xhsShares: b.xhs_shares,
          // 大众点评互动数据
          dianpingLikes: b.dianping_likes,
          dianpingFavorites: b.dianping_favorites,
          dianpingComments: b.dianping_comments,
          dianpingShares: b.dianping_shares,
          // 抖音互动数据
          douyinLikes: b.douyin_likes,
          douyinFavorites: b.douyin_favorites,
          douyinComments: b.douyin_comments,
          douyinShares: b.douyin_shares,
          createdAt: b.created_at,
          updatedAt: b.updated_at,
        };
      }
      return null;
    }

    const db = getLocalDB();
    const index = db.bloggers.findIndex(b => b.id === bloggerId);
    if (index !== -1) {
      db.bloggers[index] = {
        ...db.bloggers[index],
        ...updates,
        updatedAt: Date.now(),
      };
      saveLocalDB(db);
      return db.bloggers[index];
    }
    return null;
  },

  // 批量更新博主状态
  async updateStatus(bloggerIds, status) {
    if (isElectron()) {
      const placeholders = bloggerIds.map(() => '?').join(',');
      await window.electron.db.run(
        `UPDATE bloggers SET status = ?, updated_at = ? WHERE id IN (${placeholders})`,
        [status, Date.now(), ...bloggerIds]
      );
      return;
    }

    const db = getLocalDB();
    bloggerIds.forEach(id => {
      const index = db.bloggers.findIndex(b => b.id === id);
      if (index !== -1) {
        db.bloggers[index].status = status;
        db.bloggers[index].updatedAt = Date.now();
      }
    });
    saveLocalDB(db);
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
    if (isElectron()) {
      await window.electron.db.run('DELETE FROM bloggers WHERE id = ?', [bloggerId]);
      return;
    }

    const db = getLocalDB();
    db.bloggers = db.bloggers.filter(b => b.id !== bloggerId);
    saveLocalDB(db);
  },
};

// 导出数据库检测函数
export { isElectron };
