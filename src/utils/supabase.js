import { createClient } from '@supabase/supabase-js';

// Supabase 配置
const SUPABASE_URL = 'https://ewspjkpkkrgsrpzgdoex.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV3c3Bqa3Bra3Jnc3Jwemdkb2V4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTk1MDc3NzksImV4cCI6MjA3NTA4Mzc3OX0.TBS2mwYwOGhwXzZ1dXiBQk0jzMSxsqkGl7uheogevUE';

// 创建 Supabase 客户端
export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

/**
 * 分享项目到云端
 * @param {Object} projectData - 项目数据
 * @param {string} projectData.projectName - 项目名称
 * @param {string} projectData.projectGroupName - 项目集名称
 * @param {Array} projectData.bloggers - 博主列表
 * @param {Object} options - 分享选项
 * @param {string} options.password - 密码（可选）
 * @param {number} options.expiresIn - 有效期（天数，可选）
 * @returns {Object} { success, shareId, shareUrl, error }
 */
export async function shareProject(projectData, options = {}) {
  try {
    const shareId = generateShareId();
    const now = new Date().toISOString();

    // 计算过期时间
    let expiresAt = null;
    if (options.expiresIn) {
      const expiryDate = new Date();
      expiryDate.setDate(expiryDate.getDate() + options.expiresIn);
      expiresAt = expiryDate.toISOString();
    }

    // 插入分享记录
    const { data, error } = await supabase
      .from('shared_projects')
      .insert([
        {
          share_id: shareId,
          project_name: projectData.projectName || projectData.groupName,
          project_group_name: projectData.projectGroupName || projectData.groupName || '默认项目集',
          bloggers: projectData.bloggers,
          projects: projectData.projects || null, // 项目集模式下保存项目信息
          password: options.password || null,
          expires_at: expiresAt,
          created_at: now,
          updated_at: now,
          view_count: 0,
        }
      ])
      .select();

    if (error) {
      console.error('分享失败:', error);
      return { success: false, error: error.message };
    }

    // 保存分享记录到本地数据库
    const timestamp = Date.now();
    const recordId = timestamp.toString();
    let localExpiresAt = null;
    if (options.expiresIn) {
      localExpiresAt = timestamp + options.expiresIn * 24 * 60 * 60 * 1000;
    }

    // 项目集模式使用 groupId，单个项目模式使用 projectId
    const entityId = projectData.groupId || projectData.projectId;

    await window.electron.db.run(
      'INSERT OR REPLACE INTO shares (id, project_id, share_id, created_at, expires_at) VALUES (?, ?, ?, ?, ?)',
      [recordId, entityId, shareId, timestamp, localExpiresAt]
    );

    return {
      success: true,
      shareId,
      data: data[0]
    };
  } catch (error) {
    console.error('分享异常:', error);
    return { success: false, error: error.message };
  }
}

/**
 * 更新已分享的项目数据
 * @param {string} shareId - 分享ID
 * @param {Array} bloggers - 更新后的博主列表
 */
export async function updateSharedProject(shareId, bloggers) {
  try {
    const { data, error } = await supabase
      .from('shared_projects')
      .update({
        bloggers: bloggers,
        updated_at: new Date().toISOString()
      })
      .eq('share_id', shareId)
      .select();

    if (error) {
      console.error('更新失败:', error);
      return { success: false, error: error.message };
    }

    return { success: true, data: data[0] };
  } catch (error) {
    console.error('更新异常:', error);
    return { success: false, error: error.message };
  }
}

/**
 * 获取分享的项目数据
 * @param {string} shareId - 分享ID
 * @param {string} password - 密码（如果需要）
 */
export async function getSharedProject(shareId, password = null) {
  try {
    let query = supabase
      .from('shared_projects')
      .select('*')
      .eq('share_id', shareId)
      .single();

    const { data, error } = await query;

    if (error) {
      console.error('获取失败:', error);
      return { success: false, error: '分享不存在或已过期' };
    }

    // 检查是否过期
    if (data.expires_at) {
      const expiryDate = new Date(data.expires_at);
      if (expiryDate < new Date()) {
        return { success: false, error: '分享已过期' };
      }
    }

    // 检查密码
    if (data.password && data.password !== password) {
      return { success: false, error: '密码错误', needPassword: true };
    }

    // 增加查看次数
    await supabase
      .from('shared_projects')
      .update({ view_count: (data.view_count || 0) + 1 })
      .eq('share_id', shareId);

    return { success: true, data };
  } catch (error) {
    console.error('获取异常:', error);
    return { success: false, error: error.message };
  }
}

/**
 * 删除分享
 * @param {string} shareId - 分享ID
 */
export async function deleteSharedProject(shareId) {
  try {
    const { error } = await supabase
      .from('shared_projects')
      .delete()
      .eq('share_id', shareId);

    if (error) {
      console.error('删除失败:', error);
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (error) {
    console.error('删除异常:', error);
    return { success: false, error: error.message };
  }
}

/**
 * 自动同步项目数据到云端（如果项目已分享）
 * @param {string} projectId - 项目ID
 */
export async function autoSyncProjectIfShared(projectId) {
  try {
    // 获取项目信息
    const project = await window.electron.db.query(
      'SELECT * FROM projects WHERE id = ?',
      [projectId]
    );

    if (project.length === 0) {
      return { success: false, error: '项目不存在' };
    }

    const groupId = project[0].group_id;

    // 查询该项目是否已分享（单个项目模式）
    const projectShares = await window.electron.db.query(
      'SELECT share_id FROM shares WHERE project_id = ?',
      [projectId]
    );

    // 查询该项目所属的项目集是否已分享（项目集模式）
    const groupShares = await window.electron.db.query(
      'SELECT share_id FROM shares WHERE project_id = ?',
      [groupId]
    );

    if (projectShares.length === 0 && groupShares.length === 0) {
      // 项目和项目集都未分享，无需同步
      return { success: true, synced: false };
    }

    let syncCount = 0;

    // 同步单个项目的分享
    if (projectShares.length > 0) {
      const bloggers = await window.electron.db.query(
        'SELECT * FROM bloggers WHERE project_id = ?',
        [projectId]
      );

      for (const share of projectShares) {
        const result = await updateSharedProject(share.share_id, bloggers);
        if (result.success) {
          syncCount++;
        }
      }
    }

    // 同步项目集的分享
    if (groupShares.length > 0) {
      // 获取项目集下的所有项目
      const allProjects = await window.electron.db.query(
        'SELECT * FROM projects WHERE group_id = ?',
        [groupId]
      );

      // 获取所有博主数据（项目集模式）
      const allBloggers = [];
      const projectsData = [];

      for (const proj of allProjects) {
        const projectBloggers = await window.electron.db.query(
          'SELECT * FROM bloggers WHERE project_id = ?',
          [proj.id]
        );

        allBloggers.push(...projectBloggers);

        projectsData.push({
          id: proj.id,
          name: proj.name,
          bloggers: projectBloggers
        });
      }

      // 更新项目集的分享
      for (const share of groupShares) {
        const { data, error } = await supabase
          .from('shared_projects')
          .update({
            bloggers: allBloggers,
            projects: projectsData,
            updated_at: new Date().toISOString()
          })
          .eq('share_id', share.share_id)
          .select();

        if (!error) {
          syncCount++;
        }
      }
    }

    if (syncCount > 0) {
      console.log(`✅ 已同步 ${syncCount} 个分享到云端`);
    }
    return { success: true, synced: true, count: syncCount };
  } catch (error) {
    console.error('自动同步失败:', error);
    return { success: false, error: error.message };
  }
}

function generateShareId() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < 8; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

/**
 * 生成独立的分享 HTML 文件
 */
async function generateShareHtml(shareId, projectData, options) {
  try {
    // 获取 HTML 模板路径
    const templatePath = await window.electron.file.getShareTemplatePath();

    // 读取模板内容
    const result = await window.electron.file.readFile(templatePath);
    if (!result.success) {
      throw new Error('读取模板文件失败: ' + result.error);
    }

    let template = result.content;

    // 在模板中注入 shareId
    const html = template.replace(
      'const SHARE_ID = null;',
      `const SHARE_ID = '${shareId}';`
    );

    // 生成文件名
    const timestamp = new Date().toISOString().slice(0, 10);
    const projectName = projectData.projectName || projectData.groupName || '项目';
    const filename = `${projectName}_分享_${timestamp}.html`;

    // 保存文件
    const saveResult = await window.electron.file.saveShareHtml(html, filename);

    if (!saveResult.success) {
      throw new Error('保存文件失败');
    }

    return saveResult.path;
  } catch (error) {
    console.error('生成分享HTML失败:', error);
    throw error;
  }
}
