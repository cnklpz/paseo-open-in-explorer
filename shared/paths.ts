import { defineRpc } from "@getpaseo/plugin";
import { z } from "zod";

export const openInExplorer = defineRpc({
  name: "explorer.open",
  input: z.object({
    path: z.string().min(1),
    /** Base directory for relative paths, usually the agent's cwd. */
    cwd: z.string().optional(),
  }),
  output: z.object({
    /** The path that was actually shown (may be a parent if the original does not exist). */
    opened: z.string(),
    selected: z.boolean(),
  }),
});

// Characters that cannot appear in a path we want to match, plus common CJK punctuation.
// Absolute Windows paths: "C:\...", "C:/...", or UNC "\\server\...". Stops at whitespace, quotes,
// brackets and common CJK punctuation.
const WINDOWS_ABS =
  /(?:[A-Za-z]:[\\/]|\\\\[^\s"'<>|*?`()[\]{}，。；：、！？（）【】《》“”‘’\\/]+[\\/])[^\s"'<>|*?`()[\]{}，。；：、！？（）【】《》“”‘’]*/g;
// Relative: "./x", "../x", or "a/b.ext" style (a separator plus a file extension).
const RELATIVE =
  /(?<![\w:/\\.~-])(?:\.{1,2}[\\/][^\s"'<>|*?`()[\]{}，。；：、！？（）【】《》“”‘’]+|[\w@.-]+(?:[\\/][\w@.-]+)*[\\/][\w@-]+\.[A-Za-z0-9]{1,8}(?::\d+)*)/g;
const URL_LIKE = /\b[a-z][a-z0-9+.-]*:\/\/[^\s)]+/gi;

function clean(raw: string): string {
  let value = raw.replace(/[.,;:!?'"`]+$/u, "");
  // Strip trailing ":line" / ":line:col" suffixes.
  value = value.replace(/(?::\d+){1,2}$/, "");
  value = value.replace(/#L\d+(?:-L?\d+)?$/, "");
  return value;
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
  hits.sort((a, b) => a.index - b.index);
  const seen = new Set<string>();
  const result: string[] = [];
  for (const { value } of hits) {
    if (value.length < 3 || /^[A-Za-z]:[\\/]?$/.test(value) || seen.has(value)) continue;
    seen.add(value);
    result.push(value);
  }
  return result;
}
