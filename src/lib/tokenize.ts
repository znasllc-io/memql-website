// Shared, dependency-free syntax tokenizer.
//
// Used by the landing page (memql / python) and the docs renderer (which also
// needs go, proto, yaml, bash, sql, json, ts, make, ini, dockerfile). The
// memql + python rule sets reproduce the original page.tsx tokenizer exactly,
// so the landing page is unchanged; the rest are tasteful, brand-limited
// approximations — never crash, fall back to plain.
//
// Line-based: each line is tokenized independently. Multi-line constructs
// (block comments, raw strings spanning lines) are only approximated, which
// is acceptable for a docs highlighter.

export type Kind =
  | "annotation"
  | "keyword"
  | "type"
  | "string"
  | "number"
  | "comment"
  | "doc"
  | "property"
  | "plain";

export type Token = { text: string; kind: Kind };

export type Lang =
  | "memql" | "python" | "go" | "proto" | "yaml" | "bash" | "sh"
  | "sql" | "json" | "ts" | "typescript" | "make" | "ini" | "dockerfile"
  | "text" | "plain";

type Rule = { re: RegExp; kind: Kind };

// Build a sticky (anchored-at-lastIndex) clone of a source regex.
function sticky(src: RegExp): RegExp {
  const flags = src.flags.includes("y") ? src.flags : src.flags + "y";
  return new RegExp(src.source, flags);
}

/* ── shared atoms ───────────────────────────────────────────────── */
const DQ_STRING = /"(?:[^"\\]|\\.)*"/;
const SQ_STRING = /'(?:[^'\\]|\\.)*'/;
const BACKTICK = /`[^`]*`/;
const NUMBER = /0x[0-9a-fA-F]+|\b\d[\d_]*(?:\.\d+)?\b/;
const SLASH_COMMENT = /\/\/.*/;
const HASH_COMMENT = /#.*/;
const DASH_COMMENT = /--.*/;

function words(list: string[]): RegExp {
  return new RegExp(`\\b(?:${list.join("|")})\\b`);
}

const GO_KW = [
  "package", "import", "func", "var", "const", "type", "struct", "interface",
  "map", "chan", "go", "defer", "return", "if", "else", "for", "range",
  "switch", "case", "default", "break", "continue", "select", "fallthrough",
  "goto", "nil", "iota", "true", "false", "package",
];
const GO_TYPES = [
  "string", "int", "int8", "int16", "int32", "int64", "uint", "uint8",
  "uint16", "uint32", "uint64", "uintptr", "byte", "rune", "bool", "float32",
  "float64", "complex64", "complex128", "error", "any",
];

const PROTO_KW = [
  "syntax", "message", "service", "rpc", "returns", "repeated", "optional",
  "required", "enum", "import", "package", "option", "oneof", "reserved",
  "stream", "map", "extend", "extensions", "group",
];
const PROTO_TYPES = [
  "double", "float", "int32", "int64", "uint32", "uint64", "sint32", "sint64",
  "fixed32", "fixed64", "sfixed32", "sfixed64", "bool", "string", "bytes",
];

const PY_KW = [
  "def", "from", "import", "for", "if", "else", "elif", "not", "return", "as",
  "in", "is", "None", "True", "False", "class", "while", "try", "except",
  "finally", "with", "lambda", "pass", "raise", "yield", "and", "or", "async",
  "await", "global", "nonlocal", "del", "assert", "break", "continue",
];

const TS_KW = [
  "const", "let", "var", "function", "return", "import", "from", "export",
  "default", "interface", "type", "class", "extends", "implements", "new",
  "async", "await", "if", "else", "for", "while", "switch", "case", "break",
  "continue", "this", "super", "typeof", "instanceof", "in", "of", "void",
  "null", "undefined", "true", "false", "public", "private", "readonly",
  "static", "enum", "namespace",
];

const SQL_KW = [
  "SELECT", "FROM", "WHERE", "INSERT", "INTO", "VALUES", "UPDATE", "SET",
  "DELETE", "CREATE", "TABLE", "INDEX", "VIEW", "DROP", "ALTER", "ADD",
  "JOIN", "LEFT", "RIGHT", "INNER", "OUTER", "ON", "AS", "AND", "OR", "NOT",
  "NULL", "ORDER", "BY", "GROUP", "HAVING", "LIMIT", "OFFSET", "DISTINCT",
  "COUNT", "PRIMARY", "KEY", "FOREIGN", "REFERENCES", "DEFAULT", "RETURNING",
  "WITH", "UNION", "ALL", "ASC", "DESC", "BETWEEN", "LIKE", "IN", "IS",
  "INTERVAL", "TIMESTAMPTZ", "TEXT", "INT", "BIGINT", "BOOLEAN", "JSONB",
];

const BASH_KW = [
  "if", "then", "fi", "else", "elif", "for", "do", "done", "while", "until",
  "case", "esac", "function", "in", "return", "export", "source", "local",
  "echo", "cd", "set", "unset", "read", "exit", "make",
];

const DOCKER_KW = [
  "FROM", "RUN", "CMD", "COPY", "ADD", "ENV", "WORKDIR", "EXPOSE",
  "ENTRYPOINT", "VOLUME", "USER", "ARG", "LABEL", "HEALTHCHECK", "SHELL", "AS",
];

const MEMQL_KW = [
  "concept", "query", "mutation", "automation", "prompt", "provider", "tool",
  "policy", "spec", "shape", "builtin", "logic", "seed", "step", "args", "body",
  "filter", "insert", "params", "coalesce", "if", "return", "enum",
  "true", "false", "bool", "int", "string", "float", "object", "datetime",
];

function buildRules(lang: Lang): Rule[] {
  switch (lang) {
    case "memql":
      // Exactly the original landing-page memql rules, in priority order.
      return [
        { re: /@description\("[^"]*"\)/, kind: "doc" },
        { re: /"[^"]*"/, kind: "string" },
        { re: /@[A-Za-z_][A-Za-z0-9_]*/, kind: "annotation" },
        { re: words(MEMQL_KW), kind: "keyword" },
        { re: /\b\d+(?:\.\d+)?\b/, kind: "number" },
      ];
    case "python":
      return [
        { re: HASH_COMMENT, kind: "comment" },
        { re: DQ_STRING, kind: "string" },
        { re: SQ_STRING, kind: "string" },
        { re: NUMBER, kind: "number" },
        { re: /@[A-Za-z_][A-Za-z0-9_.]*/, kind: "annotation" },
        { re: words(PY_KW), kind: "keyword" },
      ];
    case "go":
      return [
        { re: SLASH_COMMENT, kind: "comment" },
        { re: DQ_STRING, kind: "string" },
        { re: BACKTICK, kind: "string" },
        { re: /'(?:[^'\\]|\\.)'/, kind: "string" },
        { re: NUMBER, kind: "number" },
        { re: words(GO_KW), kind: "keyword" },
        { re: words(GO_TYPES), kind: "type" },
      ];
    case "proto":
      return [
        { re: SLASH_COMMENT, kind: "comment" },
        { re: DQ_STRING, kind: "string" },
        { re: NUMBER, kind: "number" },
        { re: words(PROTO_KW), kind: "keyword" },
        { re: words(PROTO_TYPES), kind: "type" },
      ];
    case "ts":
    case "typescript":
      return [
        { re: SLASH_COMMENT, kind: "comment" },
        { re: DQ_STRING, kind: "string" },
        { re: SQ_STRING, kind: "string" },
        { re: BACKTICK, kind: "string" },
        { re: NUMBER, kind: "number" },
        { re: /@[A-Za-z_][A-Za-z0-9_.]*/, kind: "annotation" },
        { re: words(TS_KW), kind: "keyword" },
      ];
    case "sql":
      return [
        { re: DASH_COMMENT, kind: "comment" },
        { re: SQ_STRING, kind: "string" },
        { re: DQ_STRING, kind: "string" },
        { re: NUMBER, kind: "number" },
        { re: words(SQL_KW), kind: "keyword" },
        { re: new RegExp(words(SQL_KW.map((k) => k.toLowerCase())).source), kind: "keyword" },
      ];
    case "bash":
    case "sh":
    case "make":
      return [
        { re: HASH_COMMENT, kind: "comment" },
        { re: DQ_STRING, kind: "string" },
        { re: SQ_STRING, kind: "string" },
        { re: /\$\{?[A-Za-z_][A-Za-z0-9_]*\}?/, kind: "annotation" },
        { re: NUMBER, kind: "number" },
        { re: words(BASH_KW), kind: "keyword" },
      ];
    case "dockerfile":
      return [
        { re: HASH_COMMENT, kind: "comment" },
        { re: DQ_STRING, kind: "string" },
        { re: /^\s*(?:[A-Z]+)(?=\s)/, kind: "keyword" },
        { re: words(DOCKER_KW), kind: "keyword" },
        { re: NUMBER, kind: "number" },
      ];
    case "yaml":
      return [
        { re: HASH_COMMENT, kind: "comment" },
        { re: /[A-Za-z_][\w.-]*(?=\s*:)/, kind: "property" },
        { re: DQ_STRING, kind: "string" },
        { re: SQ_STRING, kind: "string" },
        { re: NUMBER, kind: "number" },
        { re: /\b(?:true|false|null|yes|no|on|off)\b/, kind: "keyword" },
      ];
    case "ini":
      return [
        { re: /[;#].*/, kind: "comment" },
        { re: /\[[^\]]*\]/, kind: "keyword" },
        { re: /[A-Za-z_][\w.-]*(?=\s*=)/, kind: "property" },
        { re: DQ_STRING, kind: "string" },
        { re: NUMBER, kind: "number" },
      ];
    case "json":
      return [
        { re: /"(?:[^"\\]|\\.)*"(?=\s*:)/, kind: "property" },
        { re: DQ_STRING, kind: "string" },
        { re: NUMBER, kind: "number" },
        { re: /\b(?:true|false|null)\b/, kind: "keyword" },
      ];
    default:
      return [];
  }
}

const ruleCache = new Map<Lang, Rule[]>();
function rulesFor(lang: Lang): Rule[] {
  let r = ruleCache.get(lang);
  if (!r) {
    r = buildRules(lang).map((rule) => ({ re: sticky(rule.re), kind: rule.kind }));
    ruleCache.set(lang, r);
  }
  return r;
}

export function tokenize(line: string, lang: Lang): Token[] {
  const rules = rulesFor(lang);
  if (rules.length === 0) return line ? [{ text: line, kind: "plain" }] : [];

  const out: Token[] = [];
  let plain = "";
  const flushPlain = () => {
    if (plain) {
      out.push({ text: plain, kind: "plain" });
      plain = "";
    }
  };

  let i = 0;
  while (i < line.length) {
    let matched = false;
    for (const rule of rules) {
      rule.re.lastIndex = i;
      const m = rule.re.exec(line);
      if (m && m.index === i && m[0].length > 0) {
        flushPlain();
        out.push({ text: m[0], kind: rule.kind });
        i += m[0].length;
        matched = true;
        break;
      }
    }
    if (!matched) {
      plain += line[i];
      i += 1;
    }
  }
  flushPlain();
  return out;
}

export function tokenClass(kind: Kind): string {
  switch (kind) {
    case "annotation": return "text-accent";
    case "keyword":    return "text-accent-bright";
    case "type":       return "text-accent";
    case "string":     return "text-string";
    case "number":     return "text-number";
    case "comment":    return "text-dim italic";
    case "doc":        return "text-muted italic";
    case "property":   return "text-fg";
    default:           return "text-fg-dim";
  }
}

// Normalize a fence info-string (```go, ```typescript, etc.) to a Lang.
export function normalizeLang(raw: string | undefined): Lang {
  const l = (raw || "").trim().toLowerCase();
  switch (l) {
    case "memql": return "memql";
    case "python": case "py": return "python";
    case "go": case "golang": return "go";
    case "proto": case "protobuf": return "proto";
    case "yaml": case "yml": return "yaml";
    case "bash": case "shell": case "sh": case "zsh": return "bash";
    case "sql": return "sql";
    case "json": return "json";
    case "ts": case "typescript": return "ts";
    case "js": case "javascript": return "ts";
    case "make": case "makefile": return "make";
    case "ini": case "toml": return "ini";
    case "dockerfile": case "docker": return "dockerfile";
    default: return "text";
  }
}
