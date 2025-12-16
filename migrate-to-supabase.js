#!/usr/bin/env node

/**
 * 数据迁移脚本 - 从本地存储迁移到 Supabase
 *
 * 使用方法：
 * node migrate-to-supabase.js
 */

import { createClient } from '@supabase/supabase-js';
import readline from 'readline';

// Supabase 配置
const SUPABASE_URL = 'https://wdpeoyugsxqnpwwtkqsl.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndkcGVveXVnc3hxbnB3d3RrcXNsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDQxNDgwNzgsImV4cCI6MjA1OTcyNDA3OH0.9bUpuZCOZxDSH3KsIu6FwWZyAvnV5xPJGNpO3luxWOE';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// 本地存储键名
const DB_KEY = 'blogger_tracker_db';

// 交互式命令行界面
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

// 询问用户确认
function askQuestion(question) {
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      resolve(answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes');
    });
  });
}

// 读取本地数据
function readLocalData() {
  console.log('📖 读取本地数据...');

  const db = localStorage.getItem(DB_KEY);
  if (!db) {
    console.log('❌ 未找到本地数据');
    return null;
  }

  const data = JSON.parse(db);
  console.log(`✅ 成功读取本地数据：
  - 项目集: ${data.projectGroups?.length || 0} 个
  - 项目: ${data.projects?.length || 0} 个
  - 博主: ${data.bloggers?.length || 0} 个`);

  return data;
}

// 迁移项目集
async function migrateProjectGroups(projectGroups) {
  console.log('\n🔄 开始迁移项目集...');

  let successCount = 0;
  let errorCount = 0;

  for (const group of projectGroups) {
    try {
      const { data, error } = await supabase
        .from('kol_project_groups')
        .insert({
          id: group.id,
          name: group.name,
          brand_id: 1, // 默认品牌ID
          description: `从本地迁移的项目集：${group.name}`,
          is_active: true,
          created_at: new Date(group.createdAt).toISOString(),
          updated_at: new Date(group.updatedAt).toISOString()
        })
        .select();

      if (error) {
        console.error(`❌ 项目集迁移失败: ${group.name} - ${error.message}`);
        errorCount++;
      } else {
        console.log(`✅ 项目集迁移成功: ${group.name}`);
        successCount++;
      }
    } catch (err) {
      console.error(`❌ 项目集迁移异常: ${group.name} - ${err.message}`);
      errorCount++;
    }
  }

  console.log(`\n📊 项目集迁移结果：成功 ${successCount}，失败 ${errorCount}`);
  return { successCount, errorCount };
}

// 迁移项目
async function migrateProjects(projects) {
  console.log('\n🔄 开始迁移项目...');

  let successCount = 0;
  let errorCount = 0;

  for (const project of projects) {
    try {
      const { data, error } = await supabase
        .from('kol_projects')
        .insert({
          id: project.id,
          group_id: project.groupId,
          parent_id: project.parentId || null,
          restaurant_id: null, // 暂时不关联门店
          name: project.name,
          project_type: 'marketing',
          status: 'active',
          created_at: new Date(project.createdAt).toISOString(),
          updated_at: new Date(project.updatedAt).toISOString()
        })
        .select();

      if (error) {
        console.error(`❌ 项目迁移失败: ${project.name} - ${error.message}`);
        errorCount++;
      } else {
        console.log(`✅ 项目迁移成功: ${project.name}`);
        successCount++;
      }
    } catch (err) {
      console.error(`❌ 项目迁移异常: ${project.name} - ${err.message}`);
      errorCount++;
    }
  }

  console.log(`\n📊 项目迁移结果：成功 ${successCount}，失败 ${errorCount}`);
  return { successCount, errorCount };
}

// 迁移博主
async function migrateBloggers(bloggers) {
  console.log('\n🔄 开始迁移博主...');

  let successCount = 0;
  let errorCount = 0;

  for (const blogger of bloggers) {
    try {
      const { data, error } = await supabase
        .from('kol_bloggers')
        .insert({
          id: blogger.id,
          project_id: blogger.projectId,
          nickname: blogger.nickname,
          followers: blogger.followers || 0,
          profile_url: blogger.profileUrl || '',
          status: blogger.status || '待审核',

          // 平台链接
          xhs_link: blogger.xhsLink || '',
          dianping_link: blogger.dianpingLink || '',
          douyin_link: blogger.douyinLink || '',
          weibo_link: '',

          // 小红书互动数据
          xhs_likes: blogger.xhsLikes || null,
          xhs_favorites: blogger.xhsFavorites || null,
          xhs_comments: blogger.xhsComments || null,
          xhs_shares: blogger.xhsShares || null,

          // 大众点评互动数据
          dianping_likes: blogger.dianpingLikes || null,
          dianping_favorites: blogger.dianpingFavorites || null,
          dianping_comments: blogger.dianpingComments || null,
          dianping_shares: blogger.dianpingShares || null,

          // 抖音互动数据
          douyin_likes: blogger.douyinLikes || null,
          douyin_favorites: blogger.douyinFavorites || null,
          douyin_comments: blogger.douyinComments || null,
          douyin_shares: blogger.douyinShares || null,

          // 微博互动数据（默认为0）
          weibo_likes: 0,
          weibo_favorites: 0,
          weibo_comments: 0,
          weibo_shares: 0,

          // 其他信息
          contact_info: null,
          cooperation_fee: null,
          publish_time: blogger.publishTime ? new Date(blogger.publishTime).toISOString() : null,
          notes: blogger.notes || '',

          created_at: new Date(blogger.createdAt).toISOString(),
          updated_at: new Date(blogger.updatedAt).toISOString()
        })
        .select();

      if (error) {
        console.error(`❌ 博主迁移失败: ${blogger.nickname} - ${error.message}`);
        errorCount++;
      } else {
        console.log(`✅ 博主迁移成功: ${blogger.nickname} (${blogger.followers} 粉丝)`);
        successCount++;
      }
    } catch (err) {
      console.error(`❌ 博主迁移异常: ${blogger.nickname} - ${err.message}`);
      errorCount++;
    }
  }

  console.log(`\n📊 博主迁移结果：成功 ${successCount}，失败 ${errorCount}`);
  return { successCount, errorCount };
}

// 验证迁移结果
async function verifyMigration() {
  console.log('\n🔍 验证迁移结果...');

  try {
    const { data: projectGroups, error: pgError } = await supabase
      .from('kol_project_groups')
      .select('id, name');

    const { data: projects, error: pError } = await supabase
      .from('kol_projects')
      .select('id, name');

    const { data: bloggers, error: bError } = await supabase
      .from('kol_bloggers')
      .select('id, nickname, followers');

    if (pgError || pError || bError) {
      console.error('❌ 验证失败:', pgError?.message || pError?.message || bError?.message);
      return false;
    }

    console.log(`✅ 验证成功！Supabase 中的数据：
  - 项目集: ${projectGroups.length} 个
  - 项目: ${projects.length} 个
  - 博主: ${bloggers.length} 个`);

    return true;
  } catch (err) {
    console.error('❌ 验证异常:', err.message);
    return false;
  }
}

// 主迁移函数
async function main() {
  console.log('🚀 开始数据迁移到 Supabase...\n');

  // 读取本地数据
  const localData = readLocalData();
  if (!localData) {
    console.log('❌ 迁移失败：无法读取本地数据');
    rl.close();
    return;
  }

  // 确认迁移
  console.log('\n⚠️  即将开始迁移，确认要继续吗？');
  const confirmed = await askQuestion('继续迁移？(y/n): ');

  if (!confirmed) {
    console.log('❌ 迁移已取消');
    rl.close();
    return;
  }

  // 执行迁移
  try {
    const results = {};

    if (localData.projectGroups?.length > 0) {
      results.projectGroups = await migrateProjectGroups(localData.projectGroups);
    }

    if (localData.projects?.length > 0) {
      results.projects = await migrateProjects(localData.projects);
    }

    if (localData.bloggers?.length > 0) {
      results.bloggers = await migrateBloggers(localData.bloggers);
    }

    // 验证迁移
    const verified = await verifyMigration();

    console.log('\n🎉 迁移完成！');
    console.log('\n📋 迁移汇总：');
    for (const [table, result] of Object.entries(results)) {
      console.log(`  - ${table}: 成功 ${result.successCount}，失败 ${result.errorCount}`);
    }
    console.log(`  - 验证: ${verified ? '✅ 通过' : '❌ 失败'}`);

    if (verified) {
      console.log('\n✨ 恭喜！数据已成功迁移到 Supabase！');
      console.log('💡 建议备份本地数据后，可以开始使用新的云数据库版本了。');
    }

  } catch (err) {
    console.error('\n❌ 迁移过程中发生错误:', err.message);
  }

  rl.close();
}

// 检查是否在浏览器环境中运行
if (typeof window !== 'undefined' && typeof localStorage !== 'undefined') {
  main();
} else {
  console.log('❌ 此脚本需要在浏览器环境中运行');
  console.log('💡 请在浏览器控制台中执行此脚本');
}