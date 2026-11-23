import type { PluginServerContext } from "@getpaseo/plugin/server";
import { openPath } from "./server/open";
import { openInExplorer } from "./shared/paths";

export default function contribute(server: PluginServerContext) {
  server.handle(openInExplorer, openPath);
  return () => {};
}
