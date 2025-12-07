import { createRequire } from 'node:module';
import { app } from 'electron';
import path from 'node:path';
import fs from 'node:fs';

const require = createRequire(import.meta.url);
const Database = require('better-sqlite3');

let db = null;
let dbPath = null;

// 自动备份数据库
function backupDatabase() {
  if (!dbPath || !fs.existsSync(dbPath)) return;

  try {
    const userDataPath = app.getPath('userData');
    const backupDir = path.join(userDataPath, 'backups');

    // 创建备份目录
    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir, { recursive: true });
    }

    // 生成备份文件名（包含日期时间）
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const backupPath = path.join(backupDir, `blogger-tracker-${timestamp}.db`);

    // 复制数据库文件
    fs.copyFileSync(dbPath, backupPath);
    console.log('✅ 数据库自动备份成功:', backupPath);

    // 清理旧备份（保留最近30个）
    const backups = fs.readdirSync(backupDir)
      .filter(f => f.startsWith('blogger-tracker-') && f.endsWith('.db'))
      .map(f => ({ name: f, path: path.join(backupDir, f), time: fs.statSync(path.join(backupDir, f)).mtime }))
      .sort((a, b) => b.time - a.time);

    // 删除超过30个的旧备份
    if (backups.length > 30) {
      backups.slice(30).forEach(backup => {
        fs.unlinkSync(backup.path);
        console.log('🗑️ 删除旧备份:', backup.name);
      });
    }
  } catch (error) {
    console.error('❌ 备份失败:', error);
  }
}

// 初始化数据库（在app ready后调用）
export function initDatabase() {
  if (db) return; // 已经初始化

  // 数据库文件路径（存储在用户数据目录）
  const userDataPath = app.getPath('userData');
  dbPath = path.join(userDataPath, 'blogger-tracker.db');

  // 确保数据目录存在
  if (!fs.existsSync(userDataPath)) {
    fs.mkdirSync(userDataPath, { recursive: true });
  }

  // 启动前备份现有数据库
  if (fs.existsSync(dbPath)) {
    backupDatabase();
  }

  // 创建数据库连接
  db = new Database(dbPath);

  // 设置每小时自动备份
  setInterval(() => {
    backupDatabase();
  }, 60 * 60 * 1000); // 每小时备份一次

  // 创建项目集表（一级）
  db.exec(`
    CREATE TABLE IF NOT EXISTS project_groups (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    )
  `);

  // 检查projects表是否存在且是否有group_id列
  const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='projects'").all();
  const projectsTableExists = tables.length > 0;

  if (projectsTableExists) {
    // 表存在，检查是否有group_id列
    const tableInfo = db.prepare("PRAGMA table_info(projects)").all();
    const hasGroupId = tableInfo.some(col => col.name === 'group_id');

    if (!hasGroupId) {
      console.log('检测到旧版本数据库，开始迁移...');

      // 添加group_id列
      db.exec(`ALTER TABLE projects ADD COLUMN group_id TEXT`);

      // 获取或创建默认项目集
      const defaultGroup = db.prepare(
        "SELECT id FROM project_groups WHERE name = ?"
      ).get('默认项目集');

      const defaultGroupId = defaultGroup?.id || Date.now().toString();

      if (!defaultGroup) {
        const now = Date.now();
        db.prepare(
          "INSERT INTO project_groups (id, name, created_at, updated_at) VALUES (?, ?, ?, ?)"
        ).run(defaultGroupId, '默认项目集', now, now);
        console.log('✅ 创建默认项目集:', defaultGroupId);
      }

      // 将所有现有项目迁移到默认项目集
      db.prepare(
        "UPDATE projects SET group_id = ? WHERE group_id IS NULL"
      ).run(defaultGroupId);
      console.log('✅ 已将现有项目迁移到默认项目集');
    }

    // 检查是否有parent_id列（用于树形结构）
    const hasParentId = tableInfo.some(col => col.name === 'parent_id');
    if (!hasParentId) {
      console.log('为projects表添加parent_id列（支持树形结构）...');
      db.exec(`ALTER TABLE projects ADD COLUMN parent_id TEXT DEFAULT NULL`);
      console.log('✅ parent_id列添加成功，现在支持项目树形嵌套');
    }
  } else {
    // 表不存在，创建新表（包含group_id和parent_id）
    db.exec(`
      CREATE TABLE projects (
        id TEXT PRIMARY KEY,
        group_id TEXT NOT NULL,
        parent_id TEXT DEFAULT NULL,
        name TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        FOREIGN KEY (group_id) REFERENCES project_groups(id) ON DELETE CASCADE
      )
    `);
    console.log('✅ 创建新版本projects表（支持树形结构）');
  }

  // 创建博主表
  db.exec(`
    CREATE TABLE IF NOT EXISTS bloggers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      project_id TEXT NOT NULL,
      nickname TEXT NOT NULL,
      followers INTEGER,
      profile_url TEXT,
      status TEXT DEFAULT '待审核',
      publish_time INTEGER,
      xhs_link TEXT,
      dianping_link TEXT,
      douyin_link TEXT,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
    )
  `);

  // 检查bloggers表是否有notes列
  const bloggersTableInfo = db.prepare("PRAGMA table_info(bloggers)").all();
  const hasNotesColumn = bloggersTableInfo.some(col => col.name === 'notes');

  if (!hasNotesColumn) {
    console.log('为bloggers表添加notes列...');
    db.exec(`ALTER TABLE bloggers ADD COLUMN notes TEXT DEFAULT ''`);
    console.log('✅ notes列添加成功');
  }

  // 检查并添加互动数据字段（小红书、大众点评、抖音的点赞/收藏/评论/转发）
  const interactionColumns = [
    // 小红书互动数据
    'xhs_likes',
    'xhs_favorites',
    'xhs_comments',
    'xhs_shares',
    // 大众点评互动数据
    'dianping_likes',
    'dianping_favorites',
    'dianping_comments',
    'dianping_shares',
    // 抖音互动数据
    'douyin_likes',
    'douyin_favorites',
    'douyin_comments',
    'douyin_shares'
  ];

  const currentColumns = bloggersTableInfo.map(col => col.name);
  const missingColumns = interactionColumns.filter(col => !currentColumns.includes(col));

  if (missingColumns.length > 0) {
    console.log(`为bloggers表添加互动数据字段: ${missingColumns.join(', ')}`);
    missingColumns.forEach(col => {
      db.exec(`ALTER TABLE bloggers ADD COLUMN ${col} INTEGER DEFAULT NULL`);
    });
    console.log('✅ 互动数据字段添加成功');
  }

  // 创建分享表（用于项目分享功能）
  // 注意: project_id 可以是项目ID或项目集ID，因此不使用外键约束

  // 检查shares表是否存在外键约束
  const sharesTables = db.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='shares'").get();
  const hasSharesForeignKey = sharesTables && sharesTables.sql && sharesTables.sql.includes('FOREIGN KEY');

  if (hasSharesForeignKey) {
    console.log('检测到shares表有外键约束，重建表以移除约束...');

    // 备份数据
    db.exec(`CREATE TEMP TABLE shares_backup AS SELECT * FROM shares`);

    // 删除旧表
    db.exec(`DROP TABLE shares`);

    // 创建新表（无外键）
    db.exec(`
      CREATE TABLE shares (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL,
        share_id TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        expires_at INTEGER
      )
    `);

    // 恢复数据
    db.exec(`INSERT INTO shares SELECT * FROM shares_backup`);
    db.exec(`DROP TABLE shares_backup`);

    console.log('✅ shares表已重建，外键约束已移除');
  } else {
    db.exec(`
      CREATE TABLE IF NOT EXISTS shares (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL,
        share_id TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        expires_at INTEGER
      )
    `);
  }

  // 检查shares表是否有share_id列
  const sharesTableInfo = db.prepare("PRAGMA table_info(shares)").all();
  const hasShareIdColumn = sharesTableInfo.some(col => col.name === 'share_id');

  if (!hasShareIdColumn) {
    console.log('为shares表添加share_id列...');
    db.exec(`ALTER TABLE shares ADD COLUMN share_id TEXT`);
    console.log('✅ share_id列添加成功');
  }

  // 创建互动数据历史记录表
  db.exec(`
    CREATE TABLE IF NOT EXISTS interaction_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      blogger_id INTEGER NOT NULL,
      platform TEXT NOT NULL,
      likes INTEGER,
      favorites INTEGER,
      comments INTEGER,
      shares INTEGER,
      recorded_at INTEGER NOT NULL,
      FOREIGN KEY (blogger_id) REFERENCES bloggers(id) ON DELETE CASCADE
    )
  `);

  // 创建索引优化查询性能
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_projects_group_id ON projects(group_id);
    CREATE INDEX IF NOT EXISTS idx_bloggers_project_id ON bloggers(project_id);
    CREATE INDEX IF NOT EXISTS idx_bloggers_nickname ON bloggers(nickname);
    CREATE INDEX IF NOT EXISTS idx_bloggers_status ON bloggers(status);
    CREATE INDEX IF NOT EXISTS idx_interaction_history_blogger_id ON interaction_history(blogger_id);
    CREATE INDEX IF NOT EXISTS idx_interaction_history_platform ON interaction_history(platform);
    CREATE INDEX IF NOT EXISTS idx_interaction_history_recorded_at ON interaction_history(recorded_at);
  `);

  console.log('数据库初始化完成:', dbPath);
}

// 查询方法
export function query(sql, params = []) {
  if (!db) throw new Error('Database not initialized');
  try {
    const stmt = db.prepare(sql);
    return stmt.all(params);
  } catch (error) {
    console.error('查询错误:', error);
    throw error;
  }
}

// 执行方法（插入、更新、删除）
export function run(sql, params = []) {
  if (!db) throw new Error('Database not initialized');
  try {
    const stmt = db.prepare(sql);
    return stmt.run(params);
  } catch (error) {
    console.error('执行错误:', error);
    throw error;
  }
}

// 获取单条记录
export function get(sql, params = []) {
  if (!db) throw new Error('Database not initialized');
  try {
    const stmt = db.prepare(sql);
    return stmt.get(params);
  } catch (error) {
    console.error('查询错误:', error);
    throw error;
  }
}

// 事务支持
export function transaction(fn) {
  if (!db) throw new Error('Database not initialized');
  return db.transaction(fn);
}

// 导出数据库路径getter
export function getDbPath() {
  return dbPath;
}
