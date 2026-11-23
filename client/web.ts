import { Platform } from "react-native";

// This plugin typechecks without the DOM library. Declare only what this module uses.
// Everything here is a no-op on native platforms.
interface DomRect {
  left: number;
  top: number;
  width: number;
  height: number;
}
interface DomEvent {
  target: DomNode | null;
  clientX: number;
  clientY: number;
  preventDefault(): void;
  stopPropagation(): void;
}
interface DomNode {
  textContent: string | null;
  style?: Record<string, string>;
  contains?(other: DomNode | null): boolean;
  closest?(selector: string): DomNode | null;
  getBoundingClientRect?(): DomRect;
  addEventListener?(type: string, listener: (event: DomEvent) => void, capture?: boolean): void;
  removeEventListener?(type: string, listener: (event: DomEvent) => void, capture?: boolean): void;
}
declare const window: {
  innerWidth: number;
  innerHeight: number;
  getSelection(): { toString(): string } | null;
  addEventListener(type: string, listener: (event: DomEvent) => void, capture?: boolean): void;
  removeEventListener(type: string, listener: (event: DomEvent) => void, capture?: boolean): void;
};
declare const navigator: { clipboard?: { writeText(text: string): Promise<void> } };

export const isWeb = Platform.OS === "web";

export interface ContextMenuHit {
  /** Texts near the cursor, most specific first: the clicked element, then its link/code ancestor. */
  texts: string[];
  /** Currently selected text, if any. */
  selection: string;
  /** Cursor position relative to the container. */
  x: number;
  y: number;
  /** Container size, for keeping the menu inside it. */
  width: number;
  height: number;
}

/**
 * Listens for right-clicks inside `container` in the capture phase, so the plugin sees them before
 * Paseo's own link handlers. When `onHit` returns true the event is consumed (no browser or Paseo menu).
 */
export function listenContextMenu(container: unknown, onHit: (hit: ContextMenuHit) => boolean): () => void {
  const node = container as DomNode | null;
  if (!isWeb || !node?.addEventListener) return () => {};
  const listener = (event: DomEvent) => {
    const rect = node.getBoundingClientRect?.() ?? { left: 0, top: 0, width: 0, height: 0 };
    const target = event.target;
    const texts: string[] = [];
    if (target?.textContent) texts.push(target.textContent);
    const special = target?.closest?.("a, code");
    if (special && special !== target && special.textContent) texts.push(special.textContent);
    const handled = onHit({
      texts,
      selection: window.getSelection()?.toString() ?? "",
      x: event.clientX - rect.left,
      y: event.clientY - rect.top,
      width: rect.width,
      height: rect.height,
    });
    if (handled) {
      event.preventDefault();
      event.stopPropagation();
    }
  };
  node.addEventListener("contextmenu", listener, true);
  return () => node.removeEventListener?.("contextmenu", listener, true);
}

/** Calls `onDismiss` on a click, scroll, key press or window blur outside `inside`. */
export function onOutsideInteraction(inside: unknown, onDismiss: () => void): () => void {
  if (!isWeb) return () => {};
  const events = ["mousedown", "wheel", "keydown", "blur", "resize", "contextmenu"];
  const handler = (event: DomEvent) => {
    const node = inside as DomNode | null;
    if (event?.target && node?.contains?.(event.target)) return;
    onDismiss();
  };
  // Defer so the right-click that opened the menu does not close it.
  const timer = setTimeout(() => {
    for (const type of events) window.addEventListener(type, handler, true);
  }, 0);
  return () => {
    clearTimeout(timer);
    for (const type of events) window.removeEventListener(type, handler, true);
  };
}

/** Wires hover and click on a DOM-backed view directly, independent of react-native-web prop forwarding. */
export function bindMenuRow(
  row: unknown,
  handlers: { onEnter(): void; onLeave(): void; onActivate(): void },
): () => void {
  const node = row as DomNode | null;
  if (!isWeb || !node?.addEventListener) return () => {};
  if (node.style) {
    node.style.cursor = "pointer";
    node.style.userSelect = "none";
  }
  const enter = () => handlers.onEnter();
  const leave = () => handlers.onLeave();
  const down = (event: DomEvent) => {
    event.preventDefault();
    event.stopPropagation();
  };
  const click = (event: DomEvent) => {
    event.stopPropagation();
    handlers.onActivate();
  };
  node.addEventListener("mouseenter", enter);
  node.addEventListener("mouseleave", leave);
  node.addEventListener("mousedown", down);
  node.addEventListener("click", click);
  return () => {
    node.removeEventListener?.("mouseenter", enter);
    node.removeEventListener?.("mouseleave", leave);
    node.removeEventListener?.("mousedown", down);
    node.removeEventListener?.("click", click);
  };
}

export async function copyText(text: string): Promise<void> {
  if (!isWeb || !navigator.clipboard) throw new Error("当前平台不支持复制");
  await navigator.clipboard.writeText(text);
}
