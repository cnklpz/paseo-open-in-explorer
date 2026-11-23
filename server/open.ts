import { spawn } from "node:child_process";
import { readdir, stat } from "node:fs/promises";
import path from "node:path";
import type { RpcInput } from "@getpaseo/plugin";
import type { openInExplorer } from "../shared/paths";
import { focusExplorerWindow } from "./focus";

const SKIP_DIRS = new Set(["node_modules", ".git", ".hg", ".svn", "dist", "build", "out", "target", ".next", ".venv", "__pycache__"]);
const SEARCH_DEPTH = 5;
const SEARCH_LIMIT = 20000;

async function kind(target: string): Promise<"file" | "dir" | null> {
  try {
    const info = await stat(target);
    return info.isDirectory() ? "dir" : "file";
  } catch {
    return null;
  }
}

/**
 * Agents often mention files by a name relative to some project folder ("package.json",
 * "client/web.ts"). Search below `root` for an entry whose path ends with `relative`.
 */
async function searchBelow(root: string, relative: string): Promise<string | null> {
  const suffix = relative.replace(/^\.[\\/]/, "").split(/[\\/]+/).filter(Boolean);
  if (suffix.length === 0 || suffix.includes("..")) return null;
  const name = suffix[suffix.length - 1].toLowerCase();
  let visited = 0;
  let queue = [root];
  for (let depth = 0; depth <= SEARCH_DEPTH && queue.length > 0; depth++) {
    const next: string[] = [];
    for (const dir of queue) {
      let entries;
      try {
        entries = await readdir(dir, { withFileTypes: true });
      } catch {
        continue;
      }
      for (const entry of entries) {
        if (++visited > SEARCH_LIMIT) return null;
        const full = path.join(dir, entry.name);
        if (entry.name.toLowerCase() === name) {
          const parts = full.split(/[\\/]+/).slice(-suffix.length);
          if (parts.every((part, i) => part.toLowerCase() === suffix[i].toLowerCase())) return full;
        }
        if (entry.isDirectory() && !SKIP_DIRS.has(entry.name)) next.push(full);
      }
    }
    queue = next;
  }
  return null;
}

function launch(command: string, args: string[], verbatim = false) {
  const child = spawn(command, args, {
    detached: true,
    stdio: "ignore",
    windowsVerbatimArguments: verbatim,
  });
  child.on("error", (error: Error) => console.error(`[open-in-explorer] ${command} failed`, error));
  child.unref();
}

export async function resolvePath(raw: string, cwd: string | undefined) {
  const expanded = raw
    .trim()
    .replace(/(?<=[^:\\/])(?::\d+){1,2}$/, "")
    .replace(/%([^%]+)%/g, (all, name: string) => process.env[name] ?? all);
  const base = cwd && !path.isAbsolute(expanded) ? cwd : process.cwd();
  const requested = path.resolve(base, expanded);

  let found = await kind(requested);
  if (found) return { target: requested, found, exact: true };

  if (!path.isAbsolute(expanded) && cwd) {
    const match = await searchBelow(cwd, expanded);
    const matchKind = match ? await kind(match) : null;
    if (match && matchKind) return { target: match, found: matchKind, exact: true };
  }

  // Fall back to the nearest existing parent folder.
  let target = requested;
  while (!found) {
    const parent = path.dirname(target);
    if (parent === target) throw new Error(`路径不存在：${raw}`);
    target = parent;
    found = await kind(target);
  }
  return { target, found, exact: false };
}

export async function openPath({ path: raw, cwd, reveal = true }: RpcInput<typeof openInExplorer>) {
  const { target, found, exact } = await resolvePath(raw, cwd);
  const select = found === "file";
  if (!reveal) return { opened: target, exact, selected: select };

  if (process.platform === "win32") {
    // explorer.exe needs the quotes inside the /select argument, so pass it verbatim.
    if (select) launch("explorer.exe", [`/select,"${target}"`], true);
    else launch("explorer.exe", [`"${target}"`], true);
    focusExplorerWindow(select ? path.dirname(target) : target);
  } else if (process.platform === "darwin") {
    launch("open", select ? ["-R", target] : [target]);
  } else {
    launch("xdg-open", [select ? path.dirname(target) : target]);
  }
  console.log(`[open-in-explorer] opened ${target}${exact ? "" : ` (fallback for ${raw})`}`);
  return { opened: target, exact, selected: select };
}
