import { spawn } from "node:child_process";
import { stat } from "node:fs/promises";
import path from "node:path";
import type { RpcInput } from "@getpaseo/plugin";
import type { openInExplorer } from "../shared/paths";
import { focusExplorerWindow } from "./focus";

async function kind(target: string): Promise<"file" | "dir" | null> {
  try {
    const info = await stat(target);
    return info.isDirectory() ? "dir" : "file";
  } catch {
    return null;
  }
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

export async function openPath({ path: raw, cwd }: RpcInput<typeof openInExplorer>) {
  const expanded = raw
    .trim()
    .replace(/(?<=[^:\\/])(?::\d+){1,2}$/, "")
    .replace(/%([^%]+)%/g, (all, name: string) => process.env[name] ?? all);
  const requested = path.resolve(cwd && !path.isAbsolute(expanded) ? cwd : process.cwd(), expanded);
  let target = requested;

  let found = await kind(target);
  // Fall back to the nearest existing parent folder.
  while (!found) {
    const parent = path.dirname(target);
    if (parent === target) throw new Error(`路径不存在：${raw}`);
    target = parent;
    found = await kind(target);
  }
  const exact = target === requested;
  const select = found === "file";

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
  return { opened: target, selected: select };
}
