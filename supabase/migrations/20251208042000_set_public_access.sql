-- 创建公开访问策略
-- 允许任何人读取public bucket中的所有文件

-- 1. 确保public bucket存在
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'public',
  'public',
  true,
  52428800, -- 50MB
  ARRAY['image/*', 'text/html', 'text/css', 'application/javascript', 'image/svg+xml']
) ON CONFLICT (id) DO NOTHING;

-- 2. 允许匿名用户读取public bucket中的任何文件
CREATE POLICY "Public Access" ON storage.objects
FOR SELECT USING (bucket_id = 'public');

-- 3. 允许匿名用户访问public bucket
CREATE POLICY "Public Bucket Access" ON storage.buckets
FOR SELECT USING (id = 'public');

-- 4. 允许匿名用户上传到public bucket（可选，根据需要启用）
-- CREATE POLICY "Public Insert" ON storage.objects
-- FOR INSERT WITH CHECK (bucket_id = 'public');

-- 5. 允许匿名用户更新public bucket中的文件（可选，根据需要启用）
-- CREATE POLICY "Public Update" ON storage.objects
-- FOR UPDATE USING (bucket_id = 'public');

-- 6. 允许匿名用户删除public bucket中的文件（可选，根据需要启用）
-- CREATE POLICY "Public Delete" ON storage.objects
-- FOR DELETE USING (bucket_id = 'public');