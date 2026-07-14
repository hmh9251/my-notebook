use serde::{Deserialize, Serialize};

/// 任务状态（生命周期）
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum TaskStatus {
    Dev,
    Testing,
    Released,
}

impl TaskStatus {
    pub fn as_str(&self) -> &'static str {
        match self {
            TaskStatus::Dev => "dev",
            TaskStatus::Testing => "testing",
            TaskStatus::Released => "released",
        }
    }

    pub fn from_str(s: &str) -> Self {
        match s {
            "testing" => TaskStatus::Testing,
            "released" => TaskStatus::Released,
            _ => TaskStatus::Dev,
        }
    }

    /// 循环切换：dev → testing → released → dev
    pub fn next(&self) -> Self {
        match self {
            TaskStatus::Dev => TaskStatus::Testing,
            TaskStatus::Testing => TaskStatus::Released,
            TaskStatus::Released => TaskStatus::Dev,
        }
    }
}

/// 任务类型（与 status 正交）
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum TaskType {
    Main,
    Sub,
    Bug,
}

impl TaskType {
    pub fn as_str(&self) -> &'static str {
        match self {
            TaskType::Main => "main",
            TaskType::Sub => "sub",
            TaskType::Bug => "bug",
        }
    }

    pub fn from_str(s: &str) -> Self {
        match s {
            "sub" => TaskType::Sub,
            "bug" => TaskType::Bug,
            _ => TaskType::Main,
        }
    }
}

/// 周任务
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WeekTask {
    pub id: i64,
    pub name: String,
    pub link_url: String,
    pub task_no: String,
    pub branch: String,
    pub status: String,
    pub r#type: String,
    pub parent_id: Option<i64>,
    pub content: String,
    pub week_key: String,
    pub sort_order: i64,
    pub created_at: String,
    pub updated_at: String,
}

/// 新建任务入参
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NewTask {
    pub name: String,
    pub link_url: String,
    pub task_no: String,
    pub branch: String,
    pub status: String,
    pub r#type: String,
    pub parent_id: Option<i64>,
    pub content: String,
    pub week_key: String,
    pub sort_order: i64,
}

/// 笔记
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Note {
    pub id: i64,
    pub title: String,
    pub content: String,
    pub tags: Option<String>,
    pub folder_id: Option<i64>,
    pub created_at: String,
    pub updated_at: String,
}

/// 文件夹（含笔记计数）
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Folder {
    pub id: i64,
    pub name: String,
    pub count: i64,
}

/// 最近周次
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RecentWeek {
    pub week_key: String,
    pub count: i64,
    pub start_date: String,
    pub end_date: String,
}

/// 标签计数
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TagCount {
    pub tag: String,
    pub count: i64,
}

/// 预览文件缓存记录
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CachedFile {
    pub url: String,
    pub name: String,
    #[serde(skip_serializing)]
    pub path: String,
    pub ext: String,
    pub size: i64,
    pub created_at: String,
}

/// cache_file 返回：含 base64 字节供前端渲染
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CachedFileWithBytes {
    pub url: String,
    pub name: String,
    pub ext: String,
    pub b64: String,
}

/// 搜索结果
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "kind")]
pub enum SearchResult {
    #[serde(rename = "task")]
    Task {
        id: i64,
        name: String,
        task_no: String,
        week_key: String,
    },
    #[serde(rename = "note")]
    Note {
        id: i64,
        title: String,
        preview: String,
    },
}
