export type AgentSpecHighlightLanguage = "json" | "yaml";

export type AgentSpecHighlightKind =
  | "plain"
  | "key"
  | "string"
  | "number"
  | "literal"
  | "comment"
  | "punctuation";

export type AgentSpecHighlightToken = {
  kind: AgentSpecHighlightKind;
  text: string;
};

export function detectAgentSpecLanguage(
  source: string,
  framework?: "pydantic-agentspec" | "cargo-ai",
): AgentSpecHighlightLanguage {
  if (framework === "cargo-ai") return "json";

  const first = source.trimStart()[0];
  return first === "{" || first === "[" ? "json" : "yaml";
}

export function highlightAgentSpec(
  source: string,
  language: AgentSpecHighlightLanguage,
): AgentSpecHighlightToken[] {
  return language === "json" ? highlightJson(source) : highlightYaml(source);
}

function pushToken(
  tokens: AgentSpecHighlightToken[],
  kind: AgentSpecHighlightKind,
  text: string,
) {
  if (!text) return;

  const previous = tokens[tokens.length - 1];
  if (previous?.kind === kind) {
    previous.text += text;
    return;
  }

  tokens.push({ kind, text });
}

function highlightJson(source: string): AgentSpecHighlightToken[] {
  const tokens: AgentSpecHighlightToken[] = [];
  let i = 0;

  while (i < source.length) {
    const char = source[i];

    if (/\s/.test(char)) {
      const start = i;
      while (i < source.length && /\s/.test(source[i])) i += 1;
      pushToken(tokens, "plain", source.slice(start, i));
      continue;
    }

    if (char === '"') {
      const end = scanJsonString(source, i);
      const text = source.slice(i, end);
      pushToken(tokens, isJsonObjectKey(source, end) ? "key" : "string", text);
      i = end;
      continue;
    }

    const rest = source.slice(i);
    const number = rest.match(/^-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?/);
    if (number) {
      pushToken(tokens, "number", number[0]);
      i += number[0].length;
      continue;
    }

    const literal = rest.match(/^(?:true|false|null)\b/);
    if (literal) {
      pushToken(tokens, "literal", literal[0]);
      i += literal[0].length;
      continue;
    }

    if ("{}[]:,".includes(char)) {
      pushToken(tokens, "punctuation", char);
      i += 1;
      continue;
    }

    pushToken(tokens, "plain", char);
    i += 1;
  }

  return tokens;
}

function scanJsonString(source: string, start: number): number {
  let i = start + 1;

  while (i < source.length) {
    if (source[i] === "\\") {
      i += 2;
      continue;
    }

    if (source[i] === '"') return i + 1;
    i += 1;
  }

  return source.length;
}

function isJsonObjectKey(source: string, stringEnd: number): boolean {
  let i = stringEnd;
  while (i < source.length && /\s/.test(source[i])) i += 1;
  return source[i] === ":";
}

function highlightYaml(source: string): AgentSpecHighlightToken[] {
  const tokens: AgentSpecHighlightToken[] = [];
  const lines = source.match(/[^\n]*(?:\n|$)/g) ?? [];
  let blockScalarIndent: number | null = null;

  for (const line of lines) {
    if (line === "") continue;

    const content = line.endsWith("\n") ? line.slice(0, -1) : line;
    const newline = line.endsWith("\n") ? "\n" : "";
    const indent = countIndent(content);

    if (blockScalarIndent !== null) {
      if (content.trim() === "" || indent > blockScalarIndent) {
        pushToken(tokens, "plain", line);
        continue;
      }

      blockScalarIndent = null;
    }

    const keyMatch = content.match(
      /^(\s*(?:-\s*)?)([A-Za-z0-9_.-]+|"(?:\\.|[^"])*"|'(?:''|[^'])*')(\s*:\s*)(.*)$/,
    );

    if (keyMatch) {
      const [, prefix, key, colon, value] = keyMatch;
      pushToken(tokens, "plain", prefix);
      pushToken(tokens, "key", key);
      pushToken(tokens, "punctuation", colon);

      const valueTokens = highlightYamlInlineValue(value);
      for (const token of valueTokens) pushToken(tokens, token.kind, token.text);

      if (startsBlockScalar(value)) blockScalarIndent = indent;
      pushToken(tokens, "plain", newline);
      continue;
    }

    const sequenceMatch = content.match(/^(\s*-\s+)(.*)$/);
    if (sequenceMatch) {
      const [, prefix, value] = sequenceMatch;
      pushToken(tokens, "punctuation", prefix);
      const valueTokens = highlightYamlInlineValue(value);
      for (const token of valueTokens) pushToken(tokens, token.kind, token.text);
      pushToken(tokens, "plain", newline);
      continue;
    }

    if (content.trimStart().startsWith("#")) {
      pushToken(tokens, "comment", content);
      pushToken(tokens, "plain", newline);
      continue;
    }

    pushToken(tokens, "plain", line);
  }

  return tokens;
}

function countIndent(line: string): number {
  const match = line.match(/^\s*/);
  return match?.[0].length ?? 0;
}

function startsBlockScalar(value: string): boolean {
  const beforeComment = splitYamlComment(value).value.trim();
  return beforeComment.startsWith("|") || beforeComment.startsWith(">");
}

function highlightYamlInlineValue(value: string): AgentSpecHighlightToken[] {
  const tokens: AgentSpecHighlightToken[] = [];
  const { value: beforeComment, comment } = splitYamlComment(value);
  let i = 0;

  while (i < beforeComment.length) {
    const char = beforeComment[i];

    if (/\s/.test(char)) {
      const start = i;
      while (i < beforeComment.length && /\s/.test(beforeComment[i])) i += 1;
      pushToken(tokens, "plain", beforeComment.slice(start, i));
      continue;
    }

    if (char === '"' || char === "'") {
      const end = scanYamlQuotedString(beforeComment, i, char);
      pushToken(tokens, "string", beforeComment.slice(i, end));
      i = end;
      continue;
    }

    const rest = beforeComment.slice(i);
    const number = rest.match(/^-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?\b/);
    if (number) {
      pushToken(tokens, "number", number[0]);
      i += number[0].length;
      continue;
    }

    const literal = rest.match(/^(?:true|false|null|yes|no|on|off)\b/i);
    if (literal) {
      pushToken(tokens, "literal", literal[0]);
      i += literal[0].length;
      continue;
    }

    if ("[]{}:,|>&*-".includes(char)) {
      pushToken(tokens, "punctuation", char);
      i += 1;
      continue;
    }

    const scalar = rest.match(/^[^\s,[\]{}#]+/);
    if (scalar) {
      pushToken(tokens, "string", scalar[0]);
      i += scalar[0].length;
      continue;
    }

    pushToken(tokens, "plain", char);
    i += 1;
  }

  if (comment) pushToken(tokens, "comment", comment);
  return tokens;
}

function splitYamlComment(value: string): { value: string; comment: string } {
  let quote: '"' | "'" | null = null;

  for (let i = 0; i < value.length; i += 1) {
    const char = value[i];

    if (quote === '"') {
      if (char === "\\") i += 1;
      else if (char === '"') quote = null;
      continue;
    }

    if (quote === "'") {
      if (char === "'" && value[i + 1] === "'") i += 1;
      else if (char === "'") quote = null;
      continue;
    }

    if (char === '"' || char === "'") {
      quote = char;
      continue;
    }

    if (char === "#" && (i === 0 || /\s/.test(value[i - 1]))) {
      return { value: value.slice(0, i), comment: value.slice(i) };
    }
  }

  return { value, comment: "" };
}

function scanYamlQuotedString(
  source: string,
  start: number,
  quote: '"' | "'",
): number {
  let i = start + 1;

  while (i < source.length) {
    if (quote === '"' && source[i] === "\\") {
      i += 2;
      continue;
    }

    if (quote === "'" && source[i] === "'" && source[i + 1] === "'") {
      i += 2;
      continue;
    }

    if (source[i] === quote) return i + 1;
    i += 1;
  }

  return source.length;
}
