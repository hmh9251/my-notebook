use super::models::WeekTask;
use super::week_tasks::get_tasks_by_week;
use chrono::{Datelike, NaiveDate};
use r2d2::Pool;
use r2d2_sqlite::SqliteConnectionManager;

type DbPool = Pool<SqliteConnectionManager>;

fn get_type_label(r#type: &str) -> &str {
    match r#type {
        "main" => "主任务",
        "sub" => "子任务",
        "bug" => "缺陷",
        _ => r#type,
    }
}

fn get_status_label(status: &str) -> &str {
    match status {
        "dev" => "开发中",
        "testing" => "已提测",
        "released" => "已上线",
        _ => status,
    }
}

/// 主任务按状态折算进度百分比：已提测/已上线 → 100%，开发中 → 50%。
/// 非 main 类型返回 None（用原类型标签）。
fn main_progress(status: &str) -> Option<&'static str> {
    match status {
        "dev" => Some("50%"),
        "testing" | "released" => Some("100%"),
        _ => None,
    }
}

/// 行内第二标签：主任务显示进度百分比，否则显示类型标签。
fn progress_or_type(r#type: &str, status: &str) -> String {
    if r#type == "main" {
        if let Some(p) = main_progress(status) {
            return p.to_string();
        }
    }
    get_type_label(r#type).to_string()
}

/// 由 ISO 周次（YYYY-Www）算出该周周一~周日
pub fn iso_week_dates(week_key: &str) -> Option<(NaiveDate, NaiveDate)> {
    let parts: Vec<&str> = week_key.split('-').collect();
    if parts.len() != 2 {
        return None;
    }
    let year: i32 = parts[0].parse().ok()?;
    let wstr = parts[1];
    if !wstr.starts_with('W') {
        return None;
    }
    let week: u32 = wstr[1..].parse().ok()?;

    // ISO 周：该年第一个周四所在周为第 1 周；1 月 4 日必在第 1 周内
    let jan4 = NaiveDate::from_ymd_opt(year, 1, 4)?;
    let jan4_weekday = jan4.weekday().num_days_from_monday() as i64; // Mon=0
    let week1_monday = jan4 - chrono::Duration::days(jan4_weekday);
    let monday = week1_monday + chrono::Duration::weeks((week as i64) - 1);
    let sunday = monday + chrono::Duration::days(6);
    Some((monday, sunday))
}

/// 由 ISO 周次算出该周周一~周日的日期范围（各分量）
fn week_range(week_key: &str) -> Option<(i32, u32, u32, i32, u32, u32)> {
    let (monday, sunday) = iso_week_dates(week_key)?;
    Some((
        monday.year(),
        monday.month(),
        monday.day(),
        sunday.year(),
        sunday.month(),
        sunday.day(),
    ))
}

pub fn generate_weekly_report(pool: &DbPool, week_key: &str) -> Result<String, Box<dyn std::error::Error>> {
    let tasks = get_tasks_by_week(pool, week_key)?;

    let mut main_tasks: Vec<&WeekTask> = tasks.iter().filter(|t| t.parent_id.is_none()).collect();
    main_tasks.sort_by_key(|t| t.sort_order);

    let mut children_map: std::collections::HashMap<i64, Vec<&WeekTask>> = std::collections::HashMap::new();
    for task in tasks.iter().filter(|t| t.parent_id.is_some()) {
        if let Some(pid) = task.parent_id {
            children_map.entry(pid).or_default().push(task);
        }
    }
    for (_, children) in children_map.iter_mut() {
        children.sort_by_key(|t| t.sort_order);
    }

    let mut report = String::new();
    match week_range(week_key) {
        Some((y1, m1, d1, _y2, m2, d2)) => {
            report.push_str(&format!("周报 {}（{}.{:02}.{:02} ~ {}.{:02}.{:02}）\n\n", week_key, y1, m1, d1, y1, m2, d2));
        }
        None => report.push_str(&format!("周报 {}\n\n", week_key)),
    }

    let mut main_index = 1;
    for main_task in &main_tasks {
        report.push_str(&format!(
            "{}. {}（{}，{}，{}）\n",
            main_index,
            main_task.name,
            main_task.task_no,
            progress_or_type(&main_task.r#type, &main_task.status),
            get_status_label(&main_task.status),
        ));

        if let Some(children) = children_map.get(&main_task.id) {
            let mut child_index = 1;
            for child in children {
                report.push_str(&format!(
                    "   {}.{} {}（{}，{}，{}）\n",
                    main_index,
                    child_index,
                    child.name,
                    child.task_no,
                    progress_or_type(&child.r#type, &child.status),
                    get_status_label(&child.status),
                ));
                child_index += 1;
            }
        }
        main_index += 1;
    }

    if main_tasks.is_empty() {
        report.push_str("（本周无任务）\n");
    }

    Ok(report)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db::schema;
    use crate::db::models::NewTask;
    use crate::db::week_tasks::create_task;
    use r2d2::Pool;
    use r2d2_sqlite::SqliteConnectionManager;
    use std::sync::atomic::{AtomicU64, Ordering};

    static SEQ: AtomicU64 = AtomicU64::new(0);

    fn tmp_pool() -> DbPool {
        let n = SEQ.fetch_add(1, Ordering::SeqCst);
        let path = std::env::temp_dir().join(format!("jilu_rpt_{}_{}.db", std::process::id(), n));
        let _ = std::fs::remove_file(&path);
        let manager = SqliteConnectionManager::file(&path);
        let pool = Pool::builder().max_size(2).build(manager).unwrap();
        schema::migrate(&pool.get().unwrap()).unwrap();
        pool
    }

    fn new_task(name: &str, task_no: &str, week: &str, parent: Option<i64>) -> NewTask {
        NewTask {
            name: name.into(),
            link_url: format!("https://x/{task_no}"),
            task_no: task_no.into(),
            branch: task_no.into(),
            status: "dev".into(),
            r#type: "main".into(),
            parent_id: parent,
            content: String::new(),
            week_key: week.into(),
            sort_order: 0,
        }
    }

    #[test]
    fn report_is_plain_text_list() {
        let pool = tmp_pool();
        let week = "2026-W28";
        let p = create_task(&pool, &new_task("用户登录优化", "XXZX-29986", week, None)).unwrap();
        let mut c = new_task("校验逻辑", "XXZX-29987", week, Some(p.id));
        c.r#type = "sub".into();
        create_task(&pool, &c).unwrap();

        let report = generate_weekly_report(&pool, week).unwrap();
        // 纯文本：不含 markdown 表格/标题
        assert!(!report.contains('|'));
        assert!(!report.contains("# 周报"));
        assert!(report.starts_with("周报 2026-W28（"));
        // 主任务 dev → 50%；子任务仍显示类型标签
        assert!(report.contains("1. 用户登录优化（XXZX-29986，50%，开发中）"));
        assert!(report.contains("1.1 校验逻辑（XXZX-29987，子任务，开发中）"));
    }

    #[test]
    fn report_main_progress_by_status() {
        let pool = tmp_pool();
        let week = "2026-W28";
        // dev → 50%
        let mut t1 = new_task("登录页", "XXZX-1", week, None);
        t1.status = "dev".into();
        create_task(&pool, &t1).unwrap();
        // testing → 100%
        let mut t2 = new_task("下单流程", "XXZX-2", week, None);
        t2.status = "testing".into();
        create_task(&pool, &t2).unwrap();
        // released → 100%
        let mut t3 = new_task("支付回调", "XXZX-3", week, None);
        t3.status = "released".into();
        create_task(&pool, &t3).unwrap();

        let report = generate_weekly_report(&pool, week).unwrap();
        assert!(report.contains("1. 登录页（XXZX-1，50%，开发中）"));
        assert!(report.contains("2. 下单流程（XXZX-2，100%，已提测）"));
        assert!(report.contains("3. 支付回调（XXZX-3，100%，已上线）"));
        assert!(!report.contains("主任务"));
    }

    #[test]
    fn report_empty_week() {
        let pool = tmp_pool();
        let report = generate_weekly_report(&pool, "2026-W10").unwrap();
        assert!(report.contains("（本周无任务）"));
    }
}