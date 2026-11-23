import { type PluginTimelineItemProps, useAgent, useRpc } from "@getpaseo/plugin/client";
import { Markdown } from "@getpaseo/plugin/client/ui";
import { useEffect, useMemo, useRef, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { z } from "zod";
import { findPaths, openInExplorer } from "../shared/paths";
import { isWeb, onOutsideInteraction, readContextMenu } from "./web";

export const messageSchema = z.object({
  text: z.string(),
  paths: z.array(z.string()),
});

type Menu = { x: number; y: number; paths: string[] };
type Status = { path: string; error?: string; pending?: boolean } | null;

export function PathMessage({ item, agentId, theme, layout }: PluginTimelineItemProps<z.infer<typeof messageSchema>>) {
  const { text, paths } = item.data;
  const cwd = useAgent(agentId, (agent) => agent.cwd) ?? undefined;
  const open = useRpc(openInExplorer);
  const containerRef = useRef<View>(null);
  const menuRef = useRef<View>(null);
  const [menu, setMenu] = useState<Menu | null>(null);
  const [status, setStatus] = useState<Status>(null);
  const [hovered, setHovered] = useState<string | null>(null);

  useEffect(() => {
    if (!menu) return;
    return onOutsideInteraction(menuRef.current, () => setMenu(null));
  }, [menu]);

  const styles = useMemo(
    () => ({
      root: { position: "relative" as const },
      menu: {
        position: "absolute" as const,
        zIndex: 1000,
        minWidth: 220,
        maxWidth: layout.compact ? 300 : 520,
        paddingVertical: 4,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: theme.colors.border,
        backgroundColor: theme.colors.surface2,
        shadowColor: "#000",
        shadowOpacity: 0.25,
        shadowRadius: 10,
        shadowOffset: { width: 0, height: 4 },
        elevation: 8,
      },
      row: { paddingHorizontal: 12, paddingVertical: 7, gap: 2 },
      rowHover: { backgroundColor: theme.colors.surface1 },
      webRow: { cursor: "pointer" as const, userSelect: "none" as const },
      label: { color: theme.colors.foreground, fontSize: 13 },
      path: { color: theme.colors.foregroundMuted, fontSize: 11 },
      error: { color: theme.colors.statusDanger, fontSize: 12, paddingHorizontal: 12, paddingVertical: 4 },
    }),
    [theme, layout.compact],
  );

  async function reveal(target: string) {
    setStatus({ path: target, pending: true });
    try {
      await open({ path: target, cwd });
      setStatus(null);
      setMenu(null);
    } catch (error) {
      setStatus({ path: target, error: error instanceof Error ? error.message : String(error) });
    }
  }

  function showMenu(candidates: string[], x: number, y: number) {
    setStatus(null);
    setMenu({ x, y, paths: candidates });
  }

  // react-native-web forwards onContextMenu to the DOM element; native platforms use long press.
  const contextMenuProps = isWeb
    ? {
        onContextMenu: (event: unknown) => {
          const hit = readContextMenu(event, containerRef.current);
          if (!hit) return;
          const fromSelection = findPaths(hit.selection);
          const candidates = fromSelection.length > 0 ? fromSelection : findPaths(hit.targetText);
          if (candidates.length === 0) return; // Keep the default menu for non-path text.
          hit.preventDefault();
          showMenu(candidates, hit.x, hit.y);
        },
      }
    : {};

  const body = <Markdown>{text}</Markdown>;

  return (
    <View ref={containerRef} style={styles.root} {...(contextMenuProps as object)}>
      {isWeb ? (
        body
      ) : (
        <Pressable onLongPress={() => showMenu(paths, 16, 16)} delayLongPress={450}>
          {body}
        </Pressable>
      )}
      {menu ? (
        <View ref={menuRef} style={[styles.menu, { left: menu.x, top: menu.y }]}>
          {menu.paths.map((target) => {
            const content = (
              <>
                <Text style={styles.label}>
                  {status?.pending && status.path === target ? "正在打开…" : "在资源管理器中打开"}
                </Text>
                <Text style={styles.path} numberOfLines={2}>
                  {target}
                </Text>
              </>
            );
            if (isWeb) {
              // On web, Pressable inside the timeline row does not receive the press reliably,
              // so use DOM mouse events (react-native-web forwards them) and stop them bubbling.
              const webProps = {
                onMouseDown: (event: { stopPropagation(): void; preventDefault(): void }) => {
                  event.stopPropagation();
                  event.preventDefault();
                },
                onClick: (event: { stopPropagation(): void }) => {
                  event.stopPropagation();
                  if (!status?.pending) void reveal(target);
                },
                onMouseEnter: () => setHovered(target),
                onMouseLeave: () => setHovered((value) => (value === target ? null : value)),
              };
              return (
                <View
                  key={target}
                  accessibilityRole="menuitem"
                  accessibilityLabel={`在资源管理器中打开 ${target}`}
                  style={[styles.row, styles.webRow, hovered === target && styles.rowHover]}
                  {...(webProps as object)}
                >
                  {content}
                </View>
              );
            }
            return (
              <Pressable
                key={target}
                accessibilityRole="menuitem"
                accessibilityLabel={`在资源管理器中打开 ${target}`}
                disabled={status?.pending}
                onPress={() => void reveal(target)}
                style={({ pressed }) => [styles.row, pressed && styles.rowHover]}
              >
                {content}
              </Pressable>
            );
          })}
          {status?.error ? <Text style={styles.error}>{status.error}</Text> : null}
        </View>
      ) : null}
    </View>
  );
}
