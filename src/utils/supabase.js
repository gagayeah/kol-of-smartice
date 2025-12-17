// 使用统一的 Supabase 客户端配置
import { supabase, withErrorHandling, cacheManager, generateCacheKey } from './supabase-client.js';

// 重新导出 supabase 客户端（保持向后兼容）
export { supabase };

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

    // 保存分享记录到 kol_shares 表
    const timestamp = Date.now();
    const recordId = timestamp.toString();
    let localExpiresAt = null;
    if (options.expiresIn) {
      localExpiresAt = timestamp + options.expiresIn * 24 * 60 * 60 * 1000;
    }

    // 项目集模式使用 groupId，单个项目模式使用 projectId
    const entityId = projectData.groupId || projectData.projectId;

    await supabase
      .from('kol_shares')
      .insert([{
        id: recordId,
        project_id: entityId,
        share_id: shareId,
        created_at: timestamp,
        expires_at: localExpiresAt
      }]);

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
 * v1.4.0 - 禁用自动同步功能，避免 kol_shares 表查询错误
 * 分享功能需要重新设计以适配新的数据结构
 * @param {string} projectId - 项目ID（门店ID）
 */
export async function autoSyncProjectIfShared(projectId) {
  // 暂时禁用自动同步功能
  // 原因：kol_shares.project_id 是 UUID 类型，但之前的代码试图用 brand ID (integer) 查询
  // 需要重新设计分享功能以适配新的 品牌 -> 门店 -> 分类 -> 博主 数据结构
  return { success: true, synced: false, reason: 'feature_disabled' };
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
