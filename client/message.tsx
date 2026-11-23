import { type PluginTimelineItemProps, useAgent } from "@getpaseo/plugin/client";
import { Markdown } from "@getpaseo/plugin/client/ui";
import { useCallback, useEffect, useRef, useState } from "react";
import { type LayoutChangeEvent, Pressable, View } from "react-native";
import { z } from "zod";
import { findPaths, pathsInClickedText } from "../shared/paths";
import { type MenuAnchor, PathMenu } from "./menu";
import { isWeb, listenContextMenu } from "./web";

export const messageSchema = z.object({
  text: z.string(),
  paths: z.array(z.string()),
});

type MenuState = { anchor: MenuAnchor; paths: string[] };

export function PathMessage({ item, agentId, theme, layout }: PluginTimelineItemProps<z.infer<typeof messageSchema>>) {
  const { text, paths } = item.data;
  const cwd = useAgent(agentId, (agent) => agent.cwd) ?? undefined;
  const containerRef = useRef<View>(null);
  const sizeRef = useRef({ width: 0, height: 0 });
  const [menu, setMenu] = useState<MenuState | null>(null);
  const close = useCallback(() => setMenu(null), []);

  useEffect(
    () =>
      listenContextMenu(containerRef.current, (hit) => {
        let candidates: string[] = [];
        for (const value of hit.texts) {
          candidates = pathsInClickedText(value);
          if (candidates.length > 0) break;
        }
        if (candidates.length === 0 && hit.selection.trim()) candidates = pathsInClickedText(hit.selection);
        if (candidates.length === 0) return false; // Keep the normal menu for non-path text.
        setMenu({ anchor: { x: hit.x, y: hit.y, width: hit.width, height: hit.height }, paths: candidates });
        return true;
      }),
    [],
  );

  const onLayout = (event: LayoutChangeEvent) => {
    sizeRef.current = event.nativeEvent.layout;
  };

  const body = <Markdown>{text}</Markdown>;

  return (
    <View ref={containerRef} onLayout={onLayout} style={{ position: "relative", zIndex: menu ? 1000 : undefined }}>
      {isWeb ? (
        body
      ) : (
        <Pressable
          delayLongPress={450}
          onLongPress={() => {
            const all = paths.length > 0 ? paths : findPaths(text);
            if (all.length === 0) return;
            const { width, height } = sizeRef.current;
            setMenu({ anchor: { x: 12, y: 12, width, height }, paths: all });
          }}
        >
          {body}
        </Pressable>
      )}
      {menu ? (
        <PathMenu
          paths={menu.paths}
          cwd={cwd}
          anchor={menu.anchor}
          theme={theme}
          compact={layout.compact}
          onClose={close}
        />
      ) : null}
    </View>
  );
}
