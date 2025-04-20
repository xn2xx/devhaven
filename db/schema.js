// Database Schema for DevHaven

// Folder Table
// - Stores information about folders with hierarchical structure
const folderTable = `
CREATE TABLE IF NOT EXISTS folders (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  parent_id INTEGER,
  icon TEXT DEFAULT 'folder', -- Font Awesome icon name
  description TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (parent_id) REFERENCES folders (id) ON DELETE CASCADE
);
`;

// Project Table
// - Stores information about projects under folders
const projectTable = `
CREATE TABLE IF NOT EXISTS projects (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  folder_id INTEGER NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  path TEXT NOT NULL, -- Local filesystem path to the project
  preferred_ide TEXT DEFAULT 'vscode', -- Default IDE preference
  icon TEXT DEFAULT 'code', -- Font Awesome icon name
  branch TEXT, -- Current git branch (if applicable)
  source_type TEXT DEFAULT 'local', -- 'local' or 'github' to indicate project source
  github_url TEXT, -- GitHub repository URL (if applicable)
  is_cloned INTEGER DEFAULT 1, -- 1 if project is cloned locally, 0 if not yet cloned
  last_opened_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (folder_id) REFERENCES folders (id) ON DELETE CASCADE
);
`;

// Tags Table
// - Stores all available tags
const tagsTable = `
CREATE TABLE IF NOT EXISTS tags (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  color TEXT DEFAULT 'primary', -- CSS color class name
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
`;

// Project Tags - Junction Table
// - Associates projects with tags (many-to-many)
const projectTagsTable = `
CREATE TABLE IF NOT EXISTS project_tags (
  project_id INTEGER NOT NULL,
  tag_id INTEGER NOT NULL,
  PRIMARY KEY (project_id, tag_id),
  FOREIGN KEY (project_id) REFERENCES projects (id) ON DELETE CASCADE,
  FOREIGN KEY (tag_id) REFERENCES tags (id) ON DELETE CASCADE
);
`;

// Documents Table
// - Stores documentation related to folders or projects
const documentsTable = `
CREATE TABLE IF NOT EXISTS documents (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  content TEXT,
  type TEXT DEFAULT 'general', -- document type (e.g., config, credentials, api, guide)
  folder_id INTEGER,
  project_id INTEGER,
  icon TEXT DEFAULT 'file-alt', -- Font Awesome icon name
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (folder_id) REFERENCES folders (id) ON DELETE CASCADE,
  FOREIGN KEY (project_id) REFERENCES projects (id) ON DELETE CASCADE,
  CHECK ((folder_id IS NULL AND project_id IS NOT NULL) OR (folder_id IS NOT NULL AND project_id IS NULL))
);
`;

// Settings Table
// - Stores application settings
const settingsTable = `
CREATE TABLE IF NOT EXISTS settings (
  id INTEGER PRIMARY KEY CHECK (id = 1), -- Ensure only one settings row
  db_path TEXT, -- Custom SQLite database location
  theme TEXT DEFAULT 'light', -- UI theme (light/dark)
  default_ide TEXT DEFAULT 'vscode',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
`;

// IDE Config Table
// - Stores configuration for different IDEs
const ideConfigTable = `
CREATE TABLE IF NOT EXISTS ide_configs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE, -- IDE identifier (vscode, idea, etc.)
  display_name TEXT NOT NULL, -- Display name (Visual Studio Code, IntelliJ IDEA, etc.)
  command TEXT NOT NULL, -- Command to open the IDE
  args TEXT, -- Optional arguments template
  icon TEXT, -- Font Awesome icon name
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
`;

// Combine all table creation statements
const schema = [
  folderTable,
  projectTable,
  tagsTable,
  projectTagsTable,
  documentsTable,
  settingsTable,
  ideConfigTable
];

module.exports = schema;
