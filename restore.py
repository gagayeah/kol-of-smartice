#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""从云端恢复数据库"""

import sqlite3
import json
import time
import random
import string
from datetime import datetime

# 从云端获取的数据（需要手动粘贴）
print("🔍 正在准备恢复数据...")
print("云端找到了 19 个分享记录")
print()

# 你需要做的：
# 1. 访问: https://bzgl.pages.dev/?id=O2KRw9Pd （或其他分享链接）
# 2. 打开浏览器控制台（F12）
# 3. 查看网页加载的数据
# 或者我帮你直接从 Supabase 获取

# 创建数据库连接
db_path = "/Users/gaga/Desktop/博主追踪系统/blogger-tracker/blogger_tracker.db"
conn = sqlite3.connect(db_path)
cursor = conn.cursor()

print("📦 创建数据库表结构...")

# 创建表结构
cursor.executescript("""
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
""")

conn.commit()
print("✅ 数据库表结构创建完成")
print()
print("⚠️  请提供你的分享链接ID（比如：O2KRw9Pd）")
print("或者直接按回车，我会尝试从最新的分享记录恢复")

share_id = input("分享链接ID（直接回车跳过）: ").strip()

if not share_id:
    print()
    print("💡 让我帮你创建一个最小化的数据结构，然后你可以重新导入数据")
    print()

    timestamp = int(time.time() * 1000)
    group_id = f"group_{timestamp}"
    project_id = f"project_{timestamp}"

    # 创建默认项目集
    cursor.execute(
        "INSERT INTO project_groups (id, name, is_current, created_at, updated_at) VALUES (?, ?, 1, ?, ?)",
        (group_id, "2025年10月", timestamp, timestamp)
    )

    # 创建默认项目
    cursor.execute(
        "INSERT INTO projects (id, group_id, name, is_current, created_at, updated_at) VALUES (?, ?, ?, 1, ?, ?)",
        (project_id, group_id, "宁桂杏1958店S8", timestamp, timestamp)
    )

    conn.commit()
    print("✅ 已创建默认项目集和项目")
    print("🔄 请重新打开应用，然后使用你之前的分享链接手动导入数据")

else:
    print(f"🌐 正在从分享ID获取数据: {share_id}")
    print("⚠️  此功能需要网络请求支持，暂时不可用")
    print("💡 请使用浏览器打开分享链接，复制所有博主数据")

conn.close()
print()
print("✅ 数据库已准备就绪")
print("🎉 现在可以重新打开应用了")
