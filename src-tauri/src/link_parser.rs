//! 解析 Jira-like 链接 / 任务号，供 MCP create_task 复用。

/// 从字符串中提取首个形如 `XXZX-29986`（大写字母/数字前缀 + '-' + 数字）的任务号。
/// 链接如 `https://jira.xxx/browse/XXZX-29986` → `XXZX-29986`。
pub fn extract_task_no(s: &str) -> Option<String> {
    let bytes = s.as_bytes();
    let mut i = 0;
    while i < bytes.len() {
        if bytes[i].is_ascii_uppercase() {
            let start = i;
            while i < bytes.len()
                && (bytes[i].is_ascii_uppercase() || bytes[i].is_ascii_digit())
            {
                i += 1;
            }
            // 前缀需至少 2 字符，避免误命中单字母
            if i > start + 1 && i < bytes.len() && bytes[i] == b'-' {
                let num_start = i + 1;
                let mut j = num_start;
                while j < bytes.len() && bytes[j].is_ascii_digit() {
                    j += 1;
                }
                if j > num_start {
                    return Some(String::from_utf8_lossy(&bytes[start..j]).to_string());
                }
            }
            i = start + 1; // 继续扫描
        } else {
            i += 1;
        }
    }
    None
}

/// 由链接解析任务号；解析失败则取 URL 最后一段，再失败则原样返回。
pub fn parse_task_no(link: &str) -> String {
    let link = link.trim();
    if let Some(tn) = extract_task_no(link) {
        return tn;
    }
    // 兜底：取最后一段非空 path 片段
    let last = link
        .split(|c: char| matches!(c, '/' | '?' | '#' | '&'))
        .filter(|s| !s.is_empty())
        .last()
        .unwrap_or(link);
    last.to_string()
}

/// 分支默认 = 任务号
pub fn default_branch(task_no: &str) -> String {
    task_no.to_string()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn extracts_from_url() {
        assert_eq!(
            extract_task_no("https://jira.abc/browse/XXZX-29986?jql=ok").as_deref(),
            Some("XXZX-29986")
        );
        assert_eq!(extract_task_no("XXZX-29986").as_deref(), Some("XXZX-29986"));
        assert_eq!(extract_task_no("feat/ABC-1 branch").as_deref(), Some("ABC-1"));
    }

    #[test]
    fn parse_no_match_fallback() {
        assert_eq!(parse_task_no("https://x/y/随便"), "随便");
        assert_eq!(parse_task_no("XX-5"), "XX-5");
    }

    #[test]
    fn branch_defaults_to_task_no() {
        assert_eq!(default_branch("XXZX-29986"), "XXZX-29986");
    }
}
