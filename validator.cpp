/*
 * validator.cpp — General-Purpose Code Validator
 * WASM Function for the Marketplace
 *
 * Input  (WASM_ARGS):  {"code": "your source code here"}
 * Output (stdout):     JSON validation report with score, issues, and stats
 *
 * Language-agnostic checks:
 *   • Bracket / brace / parenthesis balance & nesting
 *   • Line statistics (count, length, empty lines, code lines)
 *   • Trailing whitespace detection
 *   • Mixed indentation (tabs vs spaces)
 *   • Excessive consecutive blank lines (>2)
 *   • Long line detection (>80 and >120 chars)
 *   • TODO / FIXME / HACK / XXX marker count
 *   • Overall quality score (0–100) with letter grade
 */

#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <ctype.h>
#include <stdarg.h>

// ── JSON Helpers ──────────────────────────────────────────────────────────────

// Extract a JSON string value by key from a flat JSON object.
// Handles standard JSON escape sequences (\n, \t, \\, \", etc.).
char* json_extract_string(const char* json, const char* key) {
    char pattern[256];
    snprintf(pattern, sizeof(pattern), "\"%s\"", key);

    const char* pos = strstr(json, pattern);
    if (!pos) return NULL;

    pos += strlen(pattern);
    while (*pos && (*pos == ' ' || *pos == '\t' || *pos == '\n' || *pos == '\r' || *pos == ':'))
        pos++;

    if (*pos != '"') return NULL;
    pos++; // skip opening quote

    size_t cap = strlen(pos) + 1;
    char* out = (char*)malloc(cap);
    if (!out) return NULL;

    size_t i = 0;
    while (*pos) {
        if (*pos == '\\') {
            pos++;
            if (!*pos) break;
            switch (*pos) {
                case '"':  out[i++] = '"';  break;
                case '\\': out[i++] = '\\'; break;
                case '/':  out[i++] = '/';  break;
                case 'n':  out[i++] = '\n'; break;
                case 't':  out[i++] = '\t'; break;
                case 'r':  out[i++] = '\r'; break;
                case 'b':  out[i++] = '\b'; break;
                case 'f':  out[i++] = '\f'; break;
                default:   out[i++] = *pos; break;
            }
        } else if (*pos == '"') {
            break; // end of JSON string
        } else {
            out[i++] = *pos;
        }
        pos++;
    }
    out[i] = '\0';
    return out;
}

// Print a C string as a properly escaped JSON string (with quotes).
void json_print_string(const char* s) {
    putchar('"');
    for (; *s; s++) {
        switch (*s) {
            case '"':  printf("\\\""); break;
            case '\\': printf("\\\\"); break;
            case '\n': printf("\\n");  break;
            case '\r': printf("\\r");  break;
            case '\t': printf("\\t");  break;
            default:
                if ((unsigned char)*s < 0x20)
                    printf("\\u%04x", (unsigned char)*s);
                else
                    putchar(*s);
        }
    }
    putchar('"');
}

// ── Issue Collector ───────────────────────────────────────────────────────────

#define MAX_ISSUES 32

struct Issue {
    char severity[12];   // "error", "warning", "info"
    char message[300];
    int  line;           // -1 if not line-specific
    int  deduction;      // score points to deduct
};

static Issue g_issues[MAX_ISSUES];
static int   g_num_issues = 0;

void add_issue(const char* severity, int line, int deduction, const char* fmt, ...) {
    if (g_num_issues >= MAX_ISSUES) return;
    Issue* iss = &g_issues[g_num_issues++];
    strncpy(iss->severity, severity, sizeof(iss->severity) - 1);
    iss->severity[sizeof(iss->severity) - 1] = '\0';
    iss->line = line;
    iss->deduction = deduction;
    va_list ap;
    va_start(ap, fmt);
    vsnprintf(iss->message, sizeof(iss->message), fmt, ap);
    va_end(ap);
}

// ── Bracket / Brace / Parenthesis Matching ────────────────────────────────────

struct BracketResult {
    bool balanced;
    int  error_line;
};

static char match_open(char close) {
    if (close == ')') return '(';
    if (close == ']') return '[';
    if (close == '}') return '{';
    return 0;
}

static char match_close(char open) {
    if (open == '(') return ')';
    if (open == '[') return ']';
    if (open == '{') return '}';
    return 0;
}

BracketResult check_brackets(const char* code) {
    BracketResult res = {true, -1};

    char stack[8192];
    int  sline[8192];
    int  top = -1;

    int  line = 1;
    bool in_string = false;
    char str_char  = 0;
    bool in_lc     = false; // line comment  (//)
    bool in_bc     = false; // block comment (/* */)

    for (int i = 0; code[i]; i++) {
        char c  = code[i];
        char nx = code[i + 1];

        if (c == '\n') { line++; in_lc = false; continue; }
        if (in_lc) continue;
        if (in_bc) {
            if (c == '*' && nx == '/') { in_bc = false; i++; }
            continue;
        }
        if (in_string) {
            if (c == '\\') { i++; continue; } // skip escaped char
            if (c == str_char) in_string = false;
            continue;
        }

        // Detect comments
        if (c == '/' && nx == '/') { in_lc = true;  i++; continue; }
        if (c == '/' && nx == '*') { in_bc = true;  i++; continue; }

        // Detect string literals
        if (c == '"' || c == '\'' || c == '`') {
            in_string = true;
            str_char  = c;
            continue;
        }

        // Opening brackets
        if (c == '(' || c == '[' || c == '{') {
            if (top < 8191) { top++; stack[top] = c; sline[top] = line; }
        }
        // Closing brackets
        else if (c == ')' || c == ']' || c == '}') {
            char expected = match_open(c);
            if (top < 0) {
                res.balanced   = false;
                res.error_line = line;
                add_issue("error", line, 15,
                    "Unexpected closing '%c' at line %d with no matching opener", c, line);
                return res;
            }
            if (stack[top] != expected) {
                res.balanced   = false;
                res.error_line = line;
                add_issue("error", line, 15,
                    "Mismatched bracket at line %d: found '%c', expected '%c' to close '%c' from line %d",
                    line, c, match_close(stack[top]), stack[top], sline[top]);
                return res;
            }
            top--;
        }
    }

    if (top >= 0) {
        res.balanced   = false;
        res.error_line = sline[top];
        add_issue("error", sline[top], 15,
            "Unclosed '%c' opened at line %d — expected '%c' before end of file",
            stack[top], sline[top], match_close(stack[top]));
    }

    return res;
}

// ── Line-by-Line Analysis ─────────────────────────────────────────────────────

struct LineStats {
    int  total_lines;
    int  empty_lines;
    int  code_lines;
    int  max_line_length;
    long total_length;
    int  trailing_ws_lines;
    int  long_lines_120;
    int  long_lines_80;
    int  max_consec_empty;
    int  tab_indent_lines;
    int  space_indent_lines;
};

LineStats analyze_lines(const char* code) {
    LineStats s = {};
    int consec_empty = 0;

    const char* p = code;
    while (true) {
        const char* eol = strchr(p, '\n');
        int len  = eol ? (int)(eol - p) : (int)strlen(p);
        int dlen = len; // display length (strip \r)
        if (dlen > 0 && p[dlen - 1] == '\r') dlen--;

        s.total_lines++;
        s.total_length += dlen;
        if (dlen > s.max_line_length) s.max_line_length = dlen;
        if (dlen > 120) s.long_lines_120++;
        if (dlen > 80)  s.long_lines_80++;

        // Check if the line is blank (whitespace-only)
        bool empty = true;
        for (int i = 0; i < dlen; i++) {
            if (!isspace((unsigned char)p[i])) { empty = false; break; }
        }

        if (empty) {
            s.empty_lines++;
            consec_empty++;
            if (consec_empty > s.max_consec_empty)
                s.max_consec_empty = consec_empty;
        } else {
            s.code_lines++;
            consec_empty = 0;

            // Trailing whitespace on non-empty lines
            if (dlen > 0 && isspace((unsigned char)p[dlen - 1]))
                s.trailing_ws_lines++;

            // Leading indentation style
            if (p[0] == '\t')      s.tab_indent_lines++;
            else if (p[0] == ' ')  s.space_indent_lines++;
        }

        if (!eol) break;
        p = eol + 1;
    }

    return s;
}

// ── Pattern Counter (case-sensitive) ──────────────────────────────────────────

int count_pattern(const char* text, const char* pattern) {
    int count = 0;
    size_t plen = strlen(pattern);
    const char* p = text;
    while ((p = strstr(p, pattern)) != NULL) { count++; p += plen; }
    return count;
}

// ── Grade from score ──────────────────────────────────────────────────────────

const char* grade_from_score(int score) {
    if (score >= 95) return "A+";
    if (score >= 90) return "A";
    if (score >= 85) return "B+";
    if (score >= 80) return "B";
    if (score >= 75) return "C+";
    if (score >= 70) return "C";
    if (score >= 60) return "D";
    return "F";
}

// ── Summary sentence ──────────────────────────────────────────────────────────

const char* summary_text(bool valid, int score) {
    if (!valid)
        return "Invalid — code has structural errors (mismatched brackets or unclosed delimiters). Fix these before proceeding.";
    if (score >= 95)
        return "Excellent! Code passes all structural checks with virtually no issues.";
    if (score >= 85)
        return "Great. Code is structurally valid with only minor style observations.";
    if (score >= 70)
        return "Good. Code is structurally valid but has some style issues worth addressing.";
    if (score >= 50)
        return "Fair. Code is structurally valid but has several quality issues that should be fixed.";
    return "Poor. Code is structurally valid but has many quality issues. Consider a thorough cleanup.";
}

// ══════════════════════════════════════════════════════════════════════════════
//  MAIN
// ══════════════════════════════════════════════════════════════════════════════

int main() {
    const char* args = getenv("WASM_ARGS");
    if (!args) {
        printf("{\"error\": \"No WASM_ARGS provided. Expected: {\\\"code\\\": \\\"...\\\"}\"}\n");
        return 1;
    }

    char* code = json_extract_string(args, "code");
    if (!code || strlen(code) == 0) {
        printf("{\"error\": \"Missing or empty 'code' field in input\"}\n");
        if (code) free(code);
        return 1;
    }

    size_t code_len = strlen(code);

    // ── Run all checks ───────────────────────────────────────────────────────

    BracketResult brackets = check_brackets(code);
    LineStats     lines    = analyze_lines(code);

    int todo_count  = count_pattern(code, "TODO");
    int fixme_count = count_pattern(code, "FIXME");
    int hack_count  = count_pattern(code, "HACK");
    int xxx_count   = count_pattern(code, "XXX");
    int marker_total = todo_count + fixme_count + hack_count + xxx_count;

    // ── Collect non-bracket issues ───────────────────────────────────────────

    // Mixed indentation
    bool mixed_indent = (lines.tab_indent_lines > 0 && lines.space_indent_lines > 0);
    if (mixed_indent) {
        add_issue("warning", -1, 10,
            "Mixed indentation detected: %d line(s) use tabs, %d use spaces — pick one style",
            lines.tab_indent_lines, lines.space_indent_lines);
    }

    // Trailing whitespace
    if (lines.trailing_ws_lines > 0) {
        int d = lines.trailing_ws_lines > 10 ? 8 : (lines.trailing_ws_lines > 3 ? 5 : 3);
        add_issue("warning", -1, d,
            "Trailing whitespace on %d line(s)", lines.trailing_ws_lines);
    }

    // Long lines (>120)
    if (lines.long_lines_120 > 0) {
        int d = lines.long_lines_120 > 10 ? 8 : 4;
        add_issue("warning", -1, d,
            "%d line(s) exceed 120 characters (longest: %d chars)", lines.long_lines_120, lines.max_line_length);
    }

    // Excessive consecutive empty lines
    if (lines.max_consec_empty > 2) {
        add_issue("info", -1, 3,
            "Up to %d consecutive empty lines found — consider reducing to 1-2", lines.max_consec_empty);
    }

    // TODO / FIXME markers
    if (marker_total > 0) {
        add_issue("info", -1, 2,
            "Found %d code marker(s): %d TODO, %d FIXME, %d HACK, %d XXX",
            marker_total, todo_count, fixme_count, hack_count, xxx_count);
    }

    // High empty-line ratio
    if (lines.total_lines > 5) {
        double ratio = (double)lines.empty_lines / lines.total_lines;
        if (ratio > 0.40) {
            add_issue("warning", -1, 5,
                "High empty-line ratio: %.0f%% of lines are blank", ratio * 100);
        }
    }

    // No code at all
    if (lines.code_lines == 0) {
        add_issue("warning", -1, 10, "File contains no code lines — only whitespace");
    }

    // ── Calculate score ──────────────────────────────────────────────────────

    int score = 100;
    for (int i = 0; i < g_num_issues; i++)
        score -= g_issues[i].deduction;
    if (score < 0) score = 0;

    bool valid    = brackets.balanced;
    double avg_ll = lines.total_lines > 0
                        ? (double)lines.total_length / lines.total_lines
                        : 0.0;

    int errors   = 0;
    int warnings = 0;
    int infos    = 0;
    for (int i = 0; i < g_num_issues; i++) {
        if (strcmp(g_issues[i].severity, "error") == 0)        errors++;
        else if (strcmp(g_issues[i].severity, "warning") == 0) warnings++;
        else                                                   infos++;
    }

    // ── Output JSON report ───────────────────────────────────────────────────

    printf("{\n");
    printf("  \"valid\": %s,\n", valid ? "true" : "false");
    printf("  \"score\": %d,\n", score);
    printf("  \"grade\": \"%s\",\n", grade_from_score(score));

    // Stats block
    printf("  \"stats\": {\n");
    printf("    \"total_lines\": %d,\n",               lines.total_lines);
    printf("    \"code_lines\": %d,\n",                lines.code_lines);
    printf("    \"empty_lines\": %d,\n",               lines.empty_lines);
    printf("    \"total_characters\": %d,\n",          (int)code_len);
    printf("    \"max_line_length\": %d,\n",           lines.max_line_length);
    printf("    \"avg_line_length\": %.1f,\n",         avg_ll);
    printf("    \"trailing_whitespace_lines\": %d,\n", lines.trailing_ws_lines);
    printf("    \"lines_over_80_chars\": %d,\n",       lines.long_lines_80);
    printf("    \"lines_over_120_chars\": %d,\n",      lines.long_lines_120);
    printf("    \"max_consecutive_empty_lines\": %d,\n", lines.max_consec_empty);
    printf("    \"indentation\": {\n");
    printf("      \"tab_lines\": %d,\n",               lines.tab_indent_lines);
    printf("      \"space_lines\": %d,\n",             lines.space_indent_lines);
    printf("      \"consistent\": %s\n",               mixed_indent ? "false" : "true");
    printf("    },\n");
    printf("    \"markers\": {\n");
    printf("      \"TODO\": %d,\n",  todo_count);
    printf("      \"FIXME\": %d,\n", fixme_count);
    printf("      \"HACK\": %d,\n",  hack_count);
    printf("      \"XXX\": %d\n",    xxx_count);
    printf("    }\n");
    printf("  },\n");

    // Brackets block
    printf("  \"brackets\": {\n");
    printf("    \"balanced\": %s", brackets.balanced ? "true" : "false");
    if (!brackets.balanced)
        printf(",\n    \"error_line\": %d", brackets.error_line);
    printf("\n  },\n");

    // Issues array
    printf("  \"issues_summary\": { \"errors\": %d, \"warnings\": %d, \"info\": %d },\n",
           errors, warnings, infos);
    printf("  \"issues\": [\n");
    for (int i = 0; i < g_num_issues; i++) {
        printf("    {\n");
        printf("      \"severity\": \"%s\",\n", g_issues[i].severity);
        if (g_issues[i].line >= 0)
            printf("      \"line\": %d,\n", g_issues[i].line);
        printf("      \"message\": ");
        json_print_string(g_issues[i].message);
        printf("\n    }%s\n", i < g_num_issues - 1 ? "," : "");
    }
    printf("  ],\n");

    // Summary
    printf("  \"summary\": ");
    json_print_string(summary_text(valid, score));
    printf("\n}\n");

    free(code);
    return 0;
}
