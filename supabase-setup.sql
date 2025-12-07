-- 创建分享项目表
CREATE TABLE shared_projects (
  id BIGSERIAL PRIMARY KEY,
  share_id TEXT UNIQUE NOT NULL,
  project_name TEXT NOT NULL,
  project_group_name TEXT,
  bloggers JSONB NOT NULL,
  projects JSONB, -- 项目集模式下保存项目列表
  password TEXT,
  expires_at TIMESTAMPTZ,
  view_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 如果表已存在，添加projects列
ALTER TABLE shared_projects ADD COLUMN IF NOT EXISTS projects JSONB;

-- 创建索引
CREATE INDEX idx_shared_projects_share_id ON shared_projects(share_id);
CREATE INDEX idx_shared_projects_created_at ON shared_projects(created_at);

-- 启用 RLS (Row Level Security)
ALTER TABLE shared_projects ENABLE ROW LEVEL SECURITY;

-- 创建策略：允许所有人读取（查看分享）
CREATE POLICY "Allow public read access"
ON shared_projects
FOR SELECT
TO public
USING (true);

-- 创建策略：允许所有人插入（创建分享）
CREATE POLICY "Allow public insert access"
ON shared_projects
FOR INSERT
TO public
WITH CHECK (true);

-- 创建策略：允许所有人更新（更新分享）
CREATE POLICY "Allow public update access"
ON shared_projects
FOR UPDATE
TO public
USING (true);

-- 创建策略：允许所有人删除（删除分享）
CREATE POLICY "Allow public delete access"
ON shared_projects
FOR DELETE
TO public
USING (true);
