import type { PluginClientContext } from "@getpaseo/plugin/client";
import { messageSchema, PathMessage } from "./client/message";
import { findPaths } from "./shared/paths";

const KIND = "path-message";

export default function contribute(client: PluginClientContext) {
  client.addTimelineTransformer({
    id: "path-message",
    query: { itemType: "assistant_message" },
    transform: ({ item, phase }) => {
      // Leave streaming text to Paseo's own renderer; claim only finished messages that mention paths.
      if (phase !== "complete") return undefined;
      const paths = findPaths(item.text);
      if (paths.length === 0) return undefined;
      return { items: [{ type: "plugin", kind: KIND, version: 1, data: { text: item.text, paths } }] };
    },
  });
  client.addTimelineRenderer({ kind: KIND, version: 1, schema: messageSchema, Component: PathMessage });
  return () => {};
}
