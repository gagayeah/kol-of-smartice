#!/usr/bin/env node

/**
 * 本地数据备份脚本
 *
 * 使用方法：
 * 1. 在浏览器控制台中运行此脚本
 * 2. 备份文件将自动下载
 */

const DB_KEY = 'blogger_tracker_db';

// 读取本地数据
function readLocalData() {
  const db = localStorage.getItem(DB_KEY);
  if (!db) {
    console.error('❌ 未找到本地数据');
    return null;
  }
  return JSON.parse(db);
}

// 生成备份文件
function generateBackup(data) {
  const timestamp = new Date().toISOString().slice(0, 19).replace(/[:-]/g, '');
  const filename = `blogger-tracker-backup-${timestamp}.json`;

  const backup = {
    version: '1.2.0',
    timestamp: new Date().toISOString(),
    data: data,
    metadata: {
      projectGroups: data.projectGroups?.length || 0,
      projects: data.projects?.length || 0,
      bloggers: data.bloggers?.length || 0,
      currentGroupId: data.currentGroupId,
      currentProjectId: data.currentProjectId
    }
  };

  return { filename, content: JSON.stringify(backup, null, 2) };
}

// 下载备份文件
function downloadBackup(filename, content) {
  const blob = new Blob([content], { type: 'application/json' });
  const url = URL.createObjectURL(blob);

  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// 主备份函数
function createBackup() {
  console.log('🔄 开始备份本地数据...');

  const data = readLocalData();
  if (!data) {
    console.error('❌ 备份失败：无法读取本地数据');
    return;
  }

  const { filename, content } = generateBackup(data);

  try {
    downloadBackup(filename, content);
    console.log(`✅ 备份成功！文件已保存为: ${filename}`);
    console.log('\n📊 备份内容：');
    console.log(`  - 项目集: ${data.projectGroups?.length || 0} 个`);
    console.log(`  - 项目: ${data.projects?.length || 0} 个`);
    console.log(`  - 博主: ${data.bloggers?.length || 0} 个`);
    console.log(`  - 当前项目集: ${data.currentGroupId}`);
    console.log(`  - 当前项目: ${data.currentProjectId}`);
  } catch (err) {
    console.error('❌ 备份失败:', err.message);
  }
}

// 检查环境
if (typeof window !== 'undefined' && typeof localStorage !== 'undefined') {
  createBackup();
} else {
  console.log('❌ 此脚本需要在浏览器环境中运行');
  console.log('💡 请在浏览器控制台中执行此脚本');
}