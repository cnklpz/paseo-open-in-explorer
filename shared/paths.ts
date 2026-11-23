import { defineRpc } from "@getpaseo/plugin";
import { z } from "zod";

/** Resolves a path mentioned in chat and, when `reveal` is true, shows it in the file manager. */
export const openInExplorer = defineRpc({
  name: "explorer.open",
  input: z.object({
    path: z.string().min(1),
    /** Base directory for relative paths, usually the agent's cwd. */
    cwd: z.string().optional(),
    /** false: only resolve the path (used by "copy full path"). Defaults to true. */
    reveal: z.boolean().optional(),
  }),
  output: z.object({
    /** The resolved path; a parent folder when the original does not exist. */
    opened: z.string(),
    /** True when `opened` is the requested file or folder itself. */
    exact: z.boolean(),
    selected: z.boolean(),
  }),
});

// Absolute Windows paths: "C:\...", "C:/...", or UNC "\\server\...". Stops at whitespace, quotes,
// brackets and common CJK punctuation.
const WINDOWS_ABS =
  /(?:[A-Za-z]:[\\/]|\\\\[^\s"'<>|*?`()[\]{}，。；：、！？（）【】《》“”‘’\\/]+[\\/])[^\s"'<>|*?`()[\]{}，。；：、！？（）【】《》“”‘’]*/g;
// Relative: "./x", "../x", or "a/b.ext" style (a separator plus a file extension).
const RELATIVE =
  /(?<![\w:/\\.~-])(?:\.{1,2}[\\/][^\s"'<>|*?`()[\]{}，。；：、！？（）【】《》“”‘’]+|[\w@.-]+(?:[\\/][\w@.-]+)*[\\/][\w@-]+\.[A-Za-z0-9]{1,8}(?::\d+)*)/g;
const URL_LIKE = /\b[a-z][a-z0-9+.-]*:\/\/[^\s)]+/gi;
// A bare file name such as "package.json" or ".gitignore", optionally with ":line[:col]".
const BARE_FILE = /^(?:[\w@][\w@.-]*\.[A-Za-z][A-Za-z0-9]{0,7}|\.[A-Za-z][\w.-]*)(?::\d+){0,2}$/;
// Inline code spans; bare file names count as paths only inside them.
const INLINE_CODE = /`([^`\n]+)`/g;

function clean(raw: string): string {
  let value = raw.replace(/[.,;:!?'"`]+$/u, "");
  value = value.replace(/(?::\d+){1,2}$/, "");
  value = value.replace(/#L\d+(?:-L?\d+)?$/, "");
  return value;
}

/** True when the whole string is a bare file name like "package.json". */
export function isBareFile(text: string): boolean {
  return BARE_FILE.test(text.trim());
}

/** Returns distinct file-system paths mentioned in a piece of text, in order of appearance. */
export function findPaths(text: string): string[] {
  const withoutUrls = text.replace(URL_LIKE, (match) => " ".repeat(match.length));
  const hits: { index: number; value: string }[] = [];
  for (const match of withoutUrls.matchAll(WINDOWS_ABS)) {
    hits.push({ index: match.index ?? 0, value: clean(match[0]) });
  }
  const masked = withoutUrls.replace(WINDOWS_ABS, (match) => " ".repeat(match.length));
  for (const match of masked.matchAll(RELATIVE)) {
    hits.push({ index: match.index ?? 0, value: clean(match[0]) });
  }
  for (const match of withoutUrls.matchAll(INLINE_CODE)) {
    if (isBareFile(match[1])) hits.push({ index: match.index ?? 0, value: clean(match[1].trim()) });
  }
  hits.sort((a, b) => a.index - b.index);
  const seen = new Set<string>();
  const result: string[] = [];
  for (const { value } of hits) {
    if (value.length < 2 || /^[A-Za-z]:[\\/]?$/.test(value) || seen.has(value)) continue;
    seen.add(value);
    result.push(value);
  }
  return result;
}

/**
 * Paths under the cursor: the clicked element's own text when it is a path or a bare file name
 * (inline code and Paseo's file links render the name alone), otherwise paths found inside it.
 */
export function pathsInClickedText(text: string): string[] {
  const trimmed = clean(text.trim());
  if (trimmed && isBareFile(trimmed)) return [trimmed];
  return findPaths(text);
}
