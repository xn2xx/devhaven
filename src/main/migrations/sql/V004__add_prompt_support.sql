-- 添加项目类型字段，支持 'project' 和 'prompt' 两种类型
ALTER TABLE projects ADD COLUMN type TEXT DEFAULT 'project' CHECK (type IN ('project', 'prompt'));

-- 添加 prompt 相关字段
ALTER TABLE projects ADD COLUMN prompt_arguments TEXT; -- JSON格式存储参数定义
ALTER TABLE projects ADD COLUMN prompt_messages TEXT;  -- JSON格式存储消息模板

-- 为 type 字段创建索引以提高查询性能
CREATE INDEX IF NOT EXISTS idx_projects_type ON projects(type);

-- 为 prompt 类型的项目，path 字段可以为空
-- 这里我们不能直接修改约束，但可以通过应用层来处理
