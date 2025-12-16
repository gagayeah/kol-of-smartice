#!/usr/bin/env node

/**
 * 本地数据恢复脚本
 *
 * 使用方法：
 * 1. 在浏览器控制台中运行此脚本
 * 2. 选择备份文件进行恢复
 */

const DB_KEY = 'blogger_tracker_db';

// 文件选择器
function selectBackupFile() {
  return new Promise((resolve, reject) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';

    input.onchange = (event) => {
      const file = event.target.files[0];
      if (!file) {
        reject(new Error('未选择文件'));
        return;
      }

      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const content = e.target.result;
          const backup = JSON.parse(content);
          resolve(backup);
        } catch (err) {
          reject(new Error('备份文件格式错误'));
        }
      };

      reader.onerror = () => reject(new Error('文件读取失败'));
      reader.readAsText(file);
    };

    input.click();
  });
}

// 验证备份数据
function validateBackup(backup) {
  if (!backup || typeof backup !== 'object') {
    throw new Error('备份数据格式无效');
  }

  if (!backup.data || typeof backup.data !== 'object') {
    throw new Error('备份数据缺少 data 字段');
  }

  const { data } = backup;
  const requiredFields = ['projectGroups', 'projects', 'bloggers'];
  for (const field of requiredFields) {
    if (!Array.isArray(data[field])) {
      throw new Error(`备份数据缺少 ${field} 字段或格式错误`);
    }
  }

  return true;
}

// 显示备份信息
function showBackupInfo(backup) {
  console.log('📋 备份信息：');
  console.log(`  - 版本: ${backup.version || '未知'}`);
  console.log(`  - 备份时间: ${backup.timestamp || '未知'}`);

  if (backup.metadata) {
    console.log(`  - 项目集: ${backup.metadata.projectGroups} 个`);
    console.log(`  - 项目: ${backup.metadata.projects} 个`);
    console.log(`  - 博主: ${backup.metadata.bloggers} 个`);
  }
}

// 恢复数据
function restoreData(backup) {
  const { data } = backup;

  // 备份当前数据
  const currentData = localStorage.getItem(DB_KEY);
  if (currentData) {
    const backupCurrent = {
      version: '1.2.0',
      timestamp: new Date().toISOString(),
      data: JSON.parse(currentData),
      type: 'pre-restore-backup'
    };

    const backupFilename = `pre-restore-backup-${Date.now()}.json`;
    const backupContent = JSON.stringify(backupCurrent, null, 2);

    // 下载当前数据的备份
    const blob = new Blob([backupContent], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = backupFilename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    console.log(`✅ 当前数据已备份为: ${backupFilename}`);
  }

  // 恢复数据
  localStorage.setItem(DB_KEY, JSON.stringify(data));

  console.log('✅ 数据恢复成功！');
  console.log('🔄 页面将在 3 秒后刷新以加载新数据...');

  setTimeout(() => {
    window.location.reload();
  }, 3000);
}

// 主恢复函数
async function restoreFromBackup() {
  console.log('🔄 开始从备份恢复数据...\n');

  try {
    // 选择备份文件
    console.log('📁 请选择备份文件...');
    const backup = await selectBackupFile();

    // 验证备份数据
    validateBackup(backup);

    // 显示备份信息
    showBackupInfo(backup);

    // 确认恢复
    const confirmed = confirm('⚠️ 确定要恢复此备份吗？当前数据将被覆盖！');
    if (!confirmed) {
      console.log('❌ 恢复已取消');
      return;
    }

    // 执行恢复
    restoreData(backup);

  } catch (err) {
    console.error('❌ 恢复失败:', err.message);
  }
}

// 检查环境
if (typeof window !== 'undefined' && typeof localStorage !== 'undefined') {
  restoreFromBackup();
} else {
  console.log('❌ 此脚本需要在浏览器环境中运行');
  console.log('💡 请在浏览器控制台中执行此脚本');
}