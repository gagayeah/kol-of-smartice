// 从云端恢复数据脚本
import { createClient } from '@supabase/supabase-js';
import Database from 'better-sqlite3';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const SUPABASE_URL = 'https://ewspjkpkkrgsrpzgdoex.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV3c3Bqa3Bra3Jnc3Jwemdkb2V4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTk1MDc3NzksImV4cCI6MjA3NTA4Mzc3OX0.TBS2mwYwOGhwXzZ1dXiBQk0jzMSxsqkGl7uheogevUE';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function restoreFromCloud() {
  try {
    console.log('🔍 正在从云端获取数据...');

    // 获取所有分享记录
    const { data: shares, error } = await supabase
      .from('shared_projects')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('❌ 获取云端数据失败:', error);
      return;
    }

    if (!shares || shares.length === 0) {
      console.log('⚠️  云端没有找到分享记录');
      return;
    }

    console.log(`✅ 找到 ${shares.length} 个分享记录`);

    // 打开数据库
    const dbPath = join(__dirname, 'blogger_tracker.db');
    const db = new Database(dbPath);

    // 创建表结构
    console.log('📦 创建数据库表结构...');

    db.exec(`
      CREATE TABLE IF NOT EXISTS project_groups (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        is_current INTEGER DEFAULT 0,
        created_at INTEGER,
        updated_at INTEGER
      );

      CREATE TABLE IF NOT EXISTS projects (
        id TEXT PRIMARY KEY,
        group_id TEXT NOT NULL,
        name TEXT NOT NULL,
        is_current INTEGER DEFAULT 0,
        created_at INTEGER,
        updated_at INTEGER,
        FOREIGN KEY (group_id) REFERENCES project_groups(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS bloggers (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL,
        nickname TEXT NOT NULL,
        followers INTEGER,
        profileUrl TEXT,
        status TEXT DEFAULT '待审核',
        xhsLink TEXT,
        dianpingLink TEXT,
        douyinLink TEXT,
        publishTime INTEGER,
        notes TEXT,
        xhs_likes INTEGER,
        xhs_favorites INTEGER,
        xhs_comments INTEGER,
        xhs_shares INTEGER,
        dianping_likes INTEGER,
        dianping_favorites INTEGER,
        dianping_comments INTEGER,
        douyin_likes INTEGER,
        douyin_favorites INTEGER,
        douyin_comments INTEGER,
        created_at INTEGER,
        updated_at INTEGER,
        FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS shares (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL,
        share_id TEXT NOT NULL,
        created_at INTEGER,
        expires_at INTEGER
      );
    `);

    console.log('✅ 数据库表结构创建完成');

    // 恢复数据
    for (const share of shares) {
      console.log(`\n📝 恢复分享: ${share.project_name}`);

      const timestamp = Date.now();
      const groupId = `group_${timestamp}`;
      const groupName = share.project_group_name || '默认项目集';

      // 插入或更新项目集
      db.prepare(`
        INSERT OR IGNORE INTO project_groups (id, name, is_current, created_at, updated_at)
        VALUES (?, ?, 0, ?, ?)
      `).run(groupId, groupName, timestamp, timestamp);

      // 处理项目集模式
      if (share.projects && share.projects.length > 0) {
        console.log(`  包含 ${share.projects.length} 个项目`);

        for (const project of share.projects) {
          const projectId = project.id || `project_${timestamp}_${Math.random().toString(36).substr(2, 9)}`;

          // 插入项目
          db.prepare(`
            INSERT OR REPLACE INTO projects (id, group_id, name, is_current, created_at, updated_at)
            VALUES (?, ?, ?, 0, ?, ?)
          `).run(projectId, groupId, project.name, timestamp, timestamp);

          // 插入博主
          if (project.bloggers && project.bloggers.length > 0) {
            console.log(`    项目 "${project.name}" 包含 ${project.bloggers.length} 个博主`);

            for (const blogger of project.bloggers) {
              const bloggerId = blogger.id || `blogger_${timestamp}_${Math.random().toString(36).substr(2, 9)}`;

              db.prepare(`
                INSERT OR REPLACE INTO bloggers (
                  id, project_id, nickname, followers, profileUrl, status,
                  xhsLink, dianpingLink, douyinLink, publishTime, notes,
                  xhs_likes, xhs_favorites, xhs_comments, xhs_shares,
                  dianping_likes, dianping_favorites, dianping_comments,
                  douyin_likes, douyin_favorites, douyin_comments,
                  created_at, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
              `).run(
                bloggerId, projectId, blogger.nickname, blogger.followers,
                blogger.profileUrl, blogger.status || '待审核',
                blogger.xhsLink || blogger.xhs_link,
                blogger.dianpingLink || blogger.dianping_link,
                blogger.douyinLink || blogger.douyin_link,
                blogger.publishTime, blogger.notes,
                blogger.xhsLikes || blogger.xhs_likes,
                blogger.xhsFavorites || blogger.xhs_favorites,
                blogger.xhsComments || blogger.xhs_comments,
                blogger.xhsShares || blogger.xhs_shares,
                blogger.dianpingLikes || blogger.dianping_likes,
                blogger.dianpingFavorites || blogger.dianping_favorites,
                blogger.dianpingComments || blogger.dianping_comments,
                blogger.douyinLikes || blogger.douyin_likes,
                blogger.douyinFavorites || blogger.douyin_favorites,
                blogger.douyinComments || blogger.douyin_comments,
                timestamp, timestamp
              );
            }
          }
        }
      } else {
        // 单个项目模式
        const projectId = `project_${timestamp}`;

        db.prepare(`
          INSERT OR REPLACE INTO projects (id, group_id, name, is_current, created_at, updated_at)
          VALUES (?, ?, ?, 0, ?, ?)
        `).run(projectId, groupId, share.project_name, timestamp, timestamp);

        if (share.bloggers && share.bloggers.length > 0) {
          console.log(`  包含 ${share.bloggers.length} 个博主`);

          for (const blogger of share.bloggers) {
            const bloggerId = blogger.id || `blogger_${timestamp}_${Math.random().toString(36).substr(2, 9)}`;

            db.prepare(`
              INSERT OR REPLACE INTO bloggers (
                id, project_id, nickname, followers, profileUrl, status,
                xhsLink, dianpingLink, douyinLink, publishTime, notes,
                xhs_likes, xhs_favorites, xhs_comments, xhs_shares,
                dianping_likes, dianping_favorites, dianping_comments,
                douyin_likes, douyin_favorites, douyin_comments,
                created_at, updated_at
              ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `).run(
              bloggerId, projectId, blogger.nickname, blogger.followers,
              blogger.profileUrl, blogger.status || '待审核',
              blogger.xhsLink || blogger.xhs_link,
              blogger.dianpingLink || blogger.dianping_link,
              blogger.douyinLink || blogger.douyin_link,
              blogger.publishTime, blogger.notes,
              blogger.xhsLikes || blogger.xhs_likes,
              blogger.xhsFavorites || blogger.xhs_favorites,
              blogger.xhsComments || blogger.xhs_comments,
              blogger.xhsShares || blogger.xhs_shares,
              blogger.dianpingLikes || blogger.dianping_likes,
              blogger.dianpingFavorites || blogger.dianping_favorites,
              blogger.dianpingComments || blogger.dianping_comments,
              blogger.douyinLikes || blogger.douyin_likes,
              blogger.douyinFavorites || blogger.douyin_favorites,
              blogger.douyinComments || blogger.douyin_comments,
              timestamp, timestamp
            );
          }
        }
      }

      // 保存分享记录
      db.prepare(`
        INSERT OR REPLACE INTO shares (id, project_id, share_id, created_at, expires_at)
        VALUES (?, ?, ?, ?, ?)
      `).run(
        `share_${timestamp}`,
        groupId,
        share.share_id,
        timestamp,
        share.expires_at ? new Date(share.expires_at).getTime() : null
      );
    }

    // 设置第一个项目集和项目为当前
    db.prepare('UPDATE project_groups SET is_current = 0').run();
    db.prepare('UPDATE projects SET is_current = 0').run();

    const firstGroup = db.prepare('SELECT id FROM project_groups LIMIT 1').get();
    if (firstGroup) {
      db.prepare('UPDATE project_groups SET is_current = 1 WHERE id = ?').run(firstGroup.id);

      const firstProject = db.prepare('SELECT id FROM projects WHERE group_id = ? LIMIT 1').get(firstGroup.id);
      if (firstProject) {
        db.prepare('UPDATE projects SET is_current = 1 WHERE id = ?').run(firstProject.id);
      }
    }

    db.close();

    console.log('\n✅ 数据恢复完成！');
    console.log('🎉 请重新打开应用查看恢复的数据');

  } catch (error) {
    console.error('❌ 恢复失败:', error);
  }
}

restoreFromCloud();
