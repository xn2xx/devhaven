use std::collections::HashMap;

use serde::{Deserialize, Serialize};

pub type SwiftDate = f64;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AppStateFile {
    pub version: i32,
    pub tags: Vec<TagData>,
    pub directories: Vec<String>,
}

impl Default for AppStateFile {
    /// 默认应用状态结构。
    fn default() -> Self {
        Self {
            version: 2,
            tags: Vec::new(),
            directories: Vec::new(),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TagData {
    pub name: String,
    pub color: ColorData,
    pub hidden: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ColorData {
    pub r: f64,
    pub g: f64,
    pub b: f64,
    pub a: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Project {
    pub id: String,
    pub name: String,
    pub path: String,
    pub tags: Vec<String>,
    pub mtime: SwiftDate,
    pub size: i64,
    pub checksum: String,
    pub git_commits: i64,
    pub git_last_commit: SwiftDate,
    pub git_daily: Option<String>,
    pub created: SwiftDate,
    pub checked: SwiftDate,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GitDailyResult {
    pub path: String,
    #[serde(rename = "gitDaily")]
    pub git_daily: Option<String>,
    pub error: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HeatmapCacheEntry {
    #[serde(rename = "dateString")]
    pub date_string: String,
    #[serde(rename = "commitCount")]
    pub commit_count: i64,
    #[serde(rename = "projectIds")]
    pub project_ids: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HeatmapCacheFile {
    pub version: i32,
    #[serde(rename = "lastUpdated")]
    pub last_updated: String,
    #[serde(rename = "dailyActivity")]
    pub daily_activity: HashMap<String, HeatmapCacheEntry>,
    #[serde(rename = "projectCount")]
    pub project_count: i64,
    #[serde(default, rename = "gitDailySignature")]
    pub git_daily_signature: String,
}

impl Default for HeatmapCacheFile {
    fn default() -> Self {
        Self {
            version: 1,
            last_updated: String::new(),
            daily_activity: HashMap::new(),
            project_count: 0,
            git_daily_signature: String::new(),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BranchListItem {
    pub name: String,
    #[serde(rename = "isMain")]
    pub is_main: bool,
}
