//! Convert an agent's Markdown output into Slack "mrkdwn" before posting it
//! into a thread. Slack's `text` field is NOT Markdown — it renders its own
//! flavor — so `**bold**`, `### headers`, and `| pipe tables |` show up
//! literally and look broken. This is a pragmatic, line-based converter that
//! handles the constructs agents actually emit: headings, bold, links,
//! bullets, horizontal rules, and GitHub-style tables. It is intentionally
//! not a full CommonMark parser.

use std::sync::LazyLock;

use regex::Regex;

static LINK: LazyLock<Regex> =
    LazyLock::new(|| Regex::new(r"\[([^\]]+)\]\((https?://[^)\s]+)\)").unwrap());
static BOLD_STAR: LazyLock<Regex> = LazyLock::new(|| Regex::new(r"\*\*([^*]+)\*\*").unwrap());
static BOLD_UNDER: LazyLock<Regex> = LazyLock::new(|| Regex::new(r"__([^_]+)__").unwrap());
static STRIKE: LazyLock<Regex> = LazyLock::new(|| Regex::new(r"~~([^~]+)~~").unwrap());
static HEADER: LazyLock<Regex> =
    LazyLock::new(|| Regex::new(r"^\s{0,3}#{1,6}\s+(.*?)\s*#*\s*$").unwrap());
// The `regex` crate has no backreferences, so spell out each rule char.
static HR: LazyLock<Regex> =
    LazyLock::new(|| Regex::new(r"^\s*(?:(?:-\s*){3,}|(?:\*\s*){3,}|(?:_\s*){3,})$").unwrap());

/// Inline span conversions: Markdown links/bold/strike → Slack equivalents.
fn inline(s: &str) -> String {
    // Links first so a bolded link still converts cleanly.
    let s = LINK.replace_all(s, "<$2|$1>");
    let s = BOLD_STAR.replace_all(&s, "*$1*");
    let s = BOLD_UNDER.replace_all(&s, "*$1*");
    let s = STRIKE.replace_all(&s, "~$1~");
    s.into_owned()
}

fn transform_line(line: &str) -> String {
    let rest = line.trim_start();
    let indent = &line[..line.len() - rest.len()];
    // Markdown bullets (-, *, +) render literally in Slack; normalize to a
    // real bullet so a leading "*" can't be mistaken for bold.
    for marker in ["- ", "* ", "+ "] {
        if let Some(body) = rest.strip_prefix(marker) {
            return format!("{indent}•  {}", inline(body));
        }
    }
    format!("{indent}{}", inline(rest))
}

fn split_row(line: &str) -> Vec<String> {
    let t = line.trim();
    let t = t.strip_prefix('|').unwrap_or(t);
    let t = t.strip_suffix('|').unwrap_or(t);
    t.split('|').map(|c| c.trim().to_string()).collect()
}

fn is_separator_cell(c: &str) -> bool {
    !c.is_empty() && c.chars().all(|ch| ch == '-' || ch == ':') && c.contains('-')
}

/// Render a run of `|`-bearing lines as a table, or None if it isn't one
/// (no separator row → treat as ordinary text). Cells keep their inline
/// formatting (so links survive) rather than going into a monospace block.
fn render_table(block: &[&str]) -> Option<Vec<String>> {
    let rows: Vec<Vec<String>> = block.iter().map(|l| split_row(l)).collect();
    let sep = rows
        .iter()
        .position(|r| !r.is_empty() && r.iter().all(|c| is_separator_cell(c)))?;
    if sep == 0 {
        return None; // separator with no header above it
    }
    let header = &rows[sep - 1];
    let mut out = Vec::new();
    out.push(format!(
        "*{}*",
        header
            .iter()
            .map(|c| inline(c))
            .collect::<Vec<_>>()
            .join("  ·  ")
    ));
    for (idx, row) in rows.iter().enumerate() {
        if idx <= sep {
            continue; // skip header + separator
        }
        let cells: Vec<String> = row.iter().map(|c| inline(c)).collect();
        out.push(format!("•  {}", cells.join("  ·  ")));
    }
    Some(out)
}

/// Drop the leading "user> …" transcript echo that render_output prepends.
/// In Slack the user already sees their own message in the thread, so the
/// echo is redundant noise; strip through the blank line that ends it.
pub fn strip_user_echo(s: &str) -> &str {
    if let Some(rest) = s.strip_prefix("user> ") {
        if let Some(idx) = rest.find("\n\n") {
            return &rest[idx + 2..];
        }
        if let Some(nl) = rest.find('\n') {
            return &rest[nl + 1..];
        }
    }
    s
}

/// Convert Markdown to Slack mrkdwn.
pub fn to_mrkdwn(input: &str) -> String {
    let lines: Vec<&str> = input.lines().collect();
    let mut out: Vec<String> = Vec::new();
    let mut i = 0;
    while i < lines.len() {
        let line = lines[i];

        // A maximal run of pipe-bearing lines may be a table.
        if line.contains('|') {
            let mut j = i;
            while j < lines.len() && lines[j].contains('|') {
                j += 1;
            }
            if let Some(rendered) = render_table(&lines[i..j]) {
                out.extend(rendered);
                i = j;
                continue;
            }
        }

        if HR.is_match(line) {
            i += 1; // drop horizontal rules entirely
            continue;
        }
        if let Some(c) = HEADER.captures(line) {
            // Slack has no headings; bold the text so it still reads as one.
            out.push(format!("*{}*", inline(c.get(1).unwrap().as_str())));
            i += 1;
            continue;
        }
        out.push(transform_line(line));
        i += 1;
    }
    out.join("\n")
}

#[cfg(test)]
mod tests {
    use super::to_mrkdwn;

    #[test]
    fn converts_bold_and_headers() {
        assert_eq!(to_mrkdwn("### Deal Stages"), "*Deal Stages*");
        assert_eq!(to_mrkdwn("**New Lead** is hot"), "*New Lead* is hot");
        assert_eq!(to_mrkdwn("__also bold__"), "*also bold*");
    }

    #[test]
    fn converts_links() {
        assert_eq!(
            to_mrkdwn("see [hellowisp.com](https://hellowisp.com) now"),
            "see <https://hellowisp.com|hellowisp.com> now",
        );
    }

    #[test]
    fn normalizes_bullets() {
        assert_eq!(to_mrkdwn("- Drata — $50,000"), "•  Drata — $50,000");
        assert_eq!(to_mrkdwn("  * nested"), "  •  nested");
    }

    #[test]
    fn drops_horizontal_rules() {
        assert_eq!(to_mrkdwn("a\n---\nb"), "a\nb");
    }

    #[test]
    fn renders_a_table_without_pipes() {
        let md = "\
| Deal | Stage | Value |
|------|-------|-------|
| Drata | Evaluation | $50,000 |
| Firework | Proposal | $18,000 |";
        let out = to_mrkdwn(md);
        assert_eq!(
            out,
            "*Deal  ·  Stage  ·  Value*\n\
             •  Drata  ·  Evaluation  ·  $50,000\n\
             •  Firework  ·  Proposal  ·  $18,000",
        );
    }

    #[test]
    fn leaves_plain_text_alone() {
        assert_eq!(to_mrkdwn("just a sentence."), "just a sentence.");
    }

    #[test]
    fn strips_the_user_echo() {
        use super::strip_user_echo;
        assert_eq!(
            strip_user_echo("user> do we have prospects?\n\nYes, we do."),
            "Yes, we do.",
        );
        // No echo → untouched.
        assert_eq!(strip_user_echo("Just the reply."), "Just the reply.");
    }
}
