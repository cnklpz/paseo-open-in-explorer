import type { PluginTheme } from "@getpaseo/plugin";
import { useRpc } from "@getpaseo/plugin/client";
import { useEffect, useMemo, useRef, useState } from "react";
import { type LayoutChangeEvent, Platform, Pressable, Text, type TextStyle, View, type ViewStyle } from "react-native";
import { openInExplorer } from "../shared/paths";
import { bindMenuRow, copyText, isWeb, onOutsideInteraction } from "./web";

const MAX_PATHS = 6;
const MONO = Platform.select({ web: "ui-monospace, 'Cascadia Code', Consolas, monospace", ios: "Menlo", default: "monospace" });

export interface MenuAnchor {
  x: number;
  y: number;
  /** Size of the area the menu must stay inside. */
  width: number;
  height: number;
}

type Action = "open" | "copy";
type Feedback = { key: string; state: "pending" | "done" | "error"; message?: string } | null;

interface Props {
  paths: string[];
  cwd: string | undefined;
  anchor: MenuAnchor;
  theme: PluginTheme;
  compact: boolean;
  onClose(): void;
}

export function PathMenu({ paths, cwd, anchor, theme, compact, onClose }: Props) {
  const run = useRpc(openInExplorer);
  const menuRef = useRef<View>(null);
  const [size, setSize] = useState<{ width: number; height: number } | null>(null);
  const [feedback, setFeedback] = useState<Feedback>(null);
  const shown = paths.slice(0, MAX_PATHS);

  useEffect(() => onOutsideInteraction(menuRef.current, onClose), [onClose]);

  const styles = useMemo(() => {
    const c = theme.colors;
    return {
      menu: {
        position: "absolute" as const,
        zIndex: 1000,
        minWidth: 240,
        maxWidth: compact ? 300 : 460,
        padding: 4,
        borderRadius: 10,
        borderWidth: 1,
        borderColor: c.border,
        backgroundColor: c.surface1,
        boxShadow: "0 10px 30px rgba(0, 0, 0, 0.28), 0 2px 6px rgba(0, 0, 0, 0.16)",
        elevation: 12,
      },
      header: { paddingHorizontal: 10, paddingTop: 6, paddingBottom: 4 },
      headerText: { color: c.foregroundMuted, fontSize: 11, fontFamily: MONO },
      divider: { height: 1, marginVertical: 4, marginHorizontal: 6, backgroundColor: c.border },
      row: {
        flexDirection: "row" as const,
        alignItems: "center" as const,
        gap: 10,
        paddingHorizontal: 10,
        paddingVertical: compact ? 9 : 6,
        borderRadius: 6,
      },
      rowActive: { backgroundColor: c.accent },
      icon: { width: 16, textAlign: "center" as const, fontSize: 13, color: c.foregroundMuted },
      iconActive: { color: c.accentForeground },
      label: { flex: 1, fontSize: 13, color: c.foreground },
      labelActive: { color: c.accentForeground },
      hint: { fontSize: 11, color: c.foregroundMuted },
      hintActive: { color: c.accentForeground, opacity: 0.85 },
      success: { color: c.statusSuccess },
      error: { color: c.statusDanger, fontSize: 12, paddingHorizontal: 10, paddingVertical: 6 },
    };
  }, [theme, compact]);

  // Keep the menu inside the message area; flip above the cursor when there is no room below.
  const position = useMemo(() => {
    if (!size) return { left: anchor.x, top: anchor.y + 2, opacity: 0 };
    const maxLeft = Math.max(4, anchor.width - size.width - 4);
    const left = Math.min(Math.max(4, anchor.x), maxLeft);
    const fitsBelow = anchor.y + size.height + 4 <= anchor.height || anchor.y < size.height;
    const top = fitsBelow ? anchor.y + 2 : anchor.y - size.height - 2;
    return { left, top, opacity: 1 };
  }, [anchor, size]);

  async function perform(target: string, action: Action) {
    const key = `${action}:${target}`;
    if (feedback?.state === "pending") return;
    setFeedback({ key, state: "pending" });
    try {
      const result = await run({ path: target, cwd, reveal: action === "open" });
      if (action === "copy") {
        await copyText(result.opened);
        setFeedback({ key, state: "done" });
        setTimeout(onClose, 650);
      } else {
        onClose();
      }
    } catch (error) {
      setFeedback({ key, state: "error", message: error instanceof Error ? error.message : String(error) });
    }
  }

  const onLayout = (event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    if (!size || size.width !== width || size.height !== height) setSize({ width, height });
  };

  return (
    <View ref={menuRef} onLayout={onLayout} style={[styles.menu, position]} accessibilityRole="menu">
      {shown.map((target, index) => (
        <View key={target}>
          {index > 0 ? <View style={styles.divider} /> : null}
          <View style={styles.header}>
            <Text style={styles.headerText} numberOfLines={2}>
              {target}
            </Text>
          </View>
          <MenuRow
            icon="↗"
            label="在资源管理器中打开"
            hint={feedback?.key === `open:${target}` && feedback.state === "pending" ? "正在打开…" : undefined}
            styles={styles}
            onActivate={() => void perform(target, "open")}
          />
          {isWeb ? (
            <MenuRow
              icon="⧉"
              label={feedback?.key === `copy:${target}` && feedback.state === "done" ? "已复制" : "复制完整路径"}
              success={feedback?.key === `copy:${target}` && feedback.state === "done"}
              styles={styles}
              onActivate={() => void perform(target, "copy")}
            />
          ) : null}
        </View>
      ))}
      {paths.length > MAX_PATHS ? (
        <Text style={[styles.hint, { paddingHorizontal: 10, paddingVertical: 4 }]}>
          还有 {paths.length - MAX_PATHS} 个路径未显示
        </Text>
      ) : null}
      {feedback?.state === "error" ? <Text style={styles.error}>{feedback.message}</Text> : null}
    </View>
  );
}

type MenuStyles = {
  row: ViewStyle;
  rowActive: ViewStyle;
  icon: TextStyle;
  iconActive: TextStyle;
  label: TextStyle;
  labelActive: TextStyle;
  hint: TextStyle;
  hintActive: TextStyle;
  success: TextStyle;
};

function MenuRow({
  icon,
  label,
  hint,
  success,
  styles,
  onActivate,
}: {
  icon: string;
  label: string;
  hint?: string;
  success?: boolean;
  styles: MenuStyles;
  onActivate(): void;
}) {
  const rowRef = useRef<View>(null);
  const [hovered, setHovered] = useState(false);
  const activate = useRef(onActivate);
  activate.current = onActivate;

  useEffect(
    () =>
      bindMenuRow(rowRef.current, {
        onEnter: () => setHovered(true),
        onLeave: () => setHovered(false),
        onActivate: () => activate.current(),
      }),
    [],
  );

  const content = (active: boolean) => (
    <>
      <Text style={[styles.icon, active && styles.iconActive, success && !active && styles.success]}>
        {success ? "✓" : icon}
      </Text>
      <Text style={[styles.label, active && styles.labelActive, success && !active && styles.success]}>{label}</Text>
      {hint ? <Text style={[styles.hint, active && styles.hintActive]}>{hint}</Text> : null}
    </>
  );

  if (isWeb) {
    return (
      <View ref={rowRef} accessibilityRole="menuitem" accessibilityLabel={label} style={[styles.row, hovered && styles.rowActive]}>
        {content(hovered)}
      </View>
    );
  }
  return (
    <Pressable accessibilityRole="menuitem" accessibilityLabel={label} onPress={onActivate} style={({ pressed }) => [styles.row, pressed && styles.rowActive]}>
      {({ pressed }) => content(pressed)}
    </Pressable>
  );
}
