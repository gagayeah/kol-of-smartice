// 数据迁移工具：将 localStorage 数据导入到 SQLite
const Database = require('better-sqlite3');
const path = require('path');
const os = require('os');
const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function question(query) {
  return new Promise(resolve => rl.question(query, resolve));
}

async function migrate() {
  console.log('\n=== 博主追踪系统 - 数据迁移工具 ===\n');
  console.log('请按照以下步骤操作：');
  console.log('1. 打开浏览器开发者工具（F12 或 Cmd+Option+I）');
  console.log('2. 切换到 Console（控制台）标签');
  console.log('3. 复制并执行以下命令：\n');
  console.log('localStorage.getItem("blogger_tracker_db")');
  console.log('\n4. 复制输出的 JSON 字符串（包括引号）');
  console.log('5. 粘贴到下面：\n');

  const jsonStr = await question('请粘贴 JSON 数据: ');

  if (!jsonStr || jsonStr.trim() === '') {
    console.log('❌ 未输入数据，退出');
    rl.close();
    return;
  }

  try {
    // 移除首尾的引号（如果有）
    let cleanedStr = jsonStr.trim();
    if (cleanedStr.startsWith('"') && cleanedStr.endsWith('"')) {
      cleanedStr = cleanedStr.slice(1, -1);
    }

    // 解析转义字符
    cleanedStr = cleanedStr.replace(/\\"/g, '"');

    const data = JSON.parse(cleanedStr);
    console.log('\n✅ JSON 数据解析成功');
    console.log('项目集数量:', data.projectGroups?.length || 0);
    console.log('项目数量:', data.projects?.length || 0);
    console.log('博主数量:', data.bloggers?.length || 0);

    // 连接到数据库
    const dbPath = path.join(os.homedir(), 'Library', 'Application Support', 'blogger-tracker', 'blogger-tracker.db');
    const db = new Database(dbPath);

    // 清空现有数据
    console.log('\n⚠️  即将清空数据库并导入新数据');
    const confirm = await question('确认继续？(yes/no): ');

    if (confirm.toLowerCase() !== 'yes') {
      console.log('已取消');
      rl.close();
      db.close();
      return;
    }

    db.exec('DELETE FROM bloggers');
    db.exec('DELETE FROM projects');
    db.exec('DELETE FROM project_groups');
    console.log('✅ 已清空旧数据');

    // 导入项目集
    const insertGroup = db.prepare(
      'INSERT INTO project_groups (id, name, created_at, updated_at) VALUES (?, ?, ?, ?)'
    );

    for (const group of data.projectGroups || []) {
      insertGroup.run(
        group.id,
        group.name,
        group.createdAt,
        group.updatedAt
      );
    }
    console.log(`✅ 已导入 ${data.projectGroups?.length || 0} 个项目集`);

    // 导入项目
    const insertProject = db.prepare(
      'INSERT INTO projects (id, group_id, name, created_at, updated_at) VALUES (?, ?, ?, ?, ?)'
    );

    for (const project of data.projects || []) {
      insertProject.run(
        project.id,
        project.groupId,
        project.name,
        project.createdAt,
        project.updatedAt
      );
    }
    console.log(`✅ 已导入 ${data.projects?.length || 0} 个项目`);

    // 导入博主
    const insertBlogger = db.prepare(
      `INSERT INTO bloggers (
        project_id, nickname, followers, profile_url, status,
        publish_time, xhs_link, dianping_link, douyin_link, notes,
        created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    );

    for (const blogger of data.bloggers || []) {
      insertBlogger.run(
        blogger.projectId,
        blogger.nickname || '',
        blogger.followers || 0,
        blogger.profileUrl || '',
        blogger.status || '待审核',
        blogger.publishTime || null,
        blogger.xhsLink || '',
        blogger.dianpingLink || '',
        blogger.douyinLink || '',
        blogger.notes || '',
        blogger.createdAt,
        blogger.updatedAt
      );
    }
    console.log(`✅ 已导入 ${data.bloggers?.length || 0} 个博主`);

    // 设置当前项目集和项目
    if (data.currentGroupId) {
      console.log(`✅ 当前项目集 ID: ${data.currentGroupId}`);
    }
    if (data.currentProjectId) {
      console.log(`✅ 当前项目 ID: ${data.currentProjectId}`);
    }

    db.close();
    console.log('\n🎉 数据迁移完成！现在可以打开桌面应用查看数据了。\n');

  } catch (error) {
    console.error('❌ 迁移失败:', error.message);
  }

  rl.close();
}

migrate();
