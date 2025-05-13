-- 为projects表的path字段创建索引以提高搜索性能
CREATE INDEX IF NOT EXISTS idx_projects_path ON projects(path);
