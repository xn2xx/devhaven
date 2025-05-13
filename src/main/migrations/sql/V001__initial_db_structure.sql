-- 创建文件夹表
CREATE TABLE IF NOT EXISTS folders
(
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  name        TEXT NOT NULL,
  parent_id   INTEGER,
  icon        TEXT      DEFAULT 'folder',
  description TEXT,
  order_index INTEGER   DEFAULT 0,
  created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (parent_id) REFERENCES folders (id) ON DELETE CASCADE
);

-- 创建项目表
CREATE TABLE IF NOT EXISTS projects
(
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  folder_id      INTEGER NOT NULL,
  name           TEXT    NOT NULL,
  description    TEXT,
  path           TEXT    NOT NULL,
  preferred_ide  TEXT      DEFAULT '["vscode"]',
  icon           TEXT      DEFAULT 'code',
  is_favorite    INTEGER   DEFAULT 0,
  branch         TEXT,
  source_type    TEXT      DEFAULT 'local',
  github_url     TEXT,
  is_cloned      INTEGER   DEFAULT 1,
  last_opened_at TIMESTAMP,
  created_at     TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at     TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (folder_id) REFERENCES folders (id) ON DELETE CASCADE
);

-- 创建标签表
CREATE TABLE IF NOT EXISTS tags
(
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  name       TEXT NOT NULL UNIQUE,
  color      TEXT      DEFAULT 'primary',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 创建项目标签关联表
CREATE TABLE IF NOT EXISTS project_tags
(
  project_id INTEGER NOT NULL,
  tag_id     INTEGER NOT NULL,
  PRIMARY KEY (project_id, tag_id),
  FOREIGN KEY (project_id) REFERENCES projects
    (id) ON DELETE CASCADE,
  FOREIGN KEY (tag_id) REFERENCES tags (id) ON DELETE CASCADE
);

-- 创建文档表
CREATE TABLE IF NOT EXISTS documents
(
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  title      TEXT NOT NULL,
  content    TEXT,
  type       TEXT      DEFAULT 'general',
  folder_id  INTEGER,
  project_id INTEGER,
  icon       TEXT      DEFAULT 'file-alt',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (folder_id) REFERENCES folders (id) ON DELETE CASCADE,
  FOREIGN KEY (project_id) REFERENCES projects (id) ON DELETE CASCADE,
  CHECK (
    (folder_id IS NULL AND project_id IS NOT NULL) OR (folder_id IS NOT NULL AND project_id IS NULL)
    )
);

-- 创建设置表
CREATE TABLE IF NOT EXISTS settings
(
  id          INTEGER PRIMARY KEY CHECK ( id = 1 ),
  db_path     TEXT,
  theme       TEXT      DEFAULT 'light',
  default_ide TEXT      DEFAULT 'vscode',
  created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 创建IDE配置表
CREATE TABLE IF NOT EXISTS ide_configs
(
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  name         TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  command      TEXT NOT NULL,
  args         TEXT,
  icon         TEXT,
  created_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 创建github仓库表
CREATE TABLE IF NOT EXISTS github_repositories
(
  id               INTEGER PRIMARY KEY,
  name             TEXT NOT NULL,
  full_name        TEXT NOT NULL,
  html_url         TEXT,
  description      TEXT,
  stargazers_count INTEGER,
  forks_count      INTEGER,
  language         TEXT,
  topics           TEXT,
  owner            TEXT
);

-- 创建迁移版本记录表
CREATE TABLE IF NOT EXISTS schema_migrations
(
  version     TEXT NOT NULL PRIMARY KEY,
  description TEXT,
  applied_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
