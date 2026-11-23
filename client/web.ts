import { Platform } from "react-native";

// This plugin typechecks without the DOM library. Declare only what this module uses.
interface DomRect {
  left: number;
  top: number;
}
interface DomNode {
  textContent: string | null;
  contains?(other: DomNode | null): boolean;
  getBoundingClientRect?(): DomRect;
}
interface DomMouseEvent {
  clientX: number;
  clientY: number;
  target: DomNode | null;
  preventDefault(): void;
  stopPropagation(): void;
}
declare const window: {
  getSelection(): { toString(): string } | null;
  addEventListener(type: string, listener: (event?: { target?: DomNode | null }) => void, capture?: boolean): void;
  removeEventListener(type: string, listener: (event?: { target?: DomNode | null }) => void, capture?: boolean): void;
};

export const isWeb = Platform.OS === "web";

export interface ContextMenuHit {
  /** Text of the element under the cursor. */
  targetText: string;
  /** Currently selected text, if any. */
  selection: string;
  /** Cursor position relative to `container`. */
  x: number;
  y: number;
  preventDefault(): void;
}

/** Reads a react-native-web contextmenu event. Returns null on native platforms. */
export function readContextMenu(event: unknown, container: unknown): ContextMenuHit | null {
  if (!isWeb) return null;
  const native = ((event as { nativeEvent?: DomMouseEvent }).nativeEvent ?? event) as DomMouseEvent;
  const rect = (container as DomNode | null)?.getBoundingClientRect?.() ?? { left: 0, top: 0 };
  return {
    targetText: native.target?.textContent ?? "",
    selection: window.getSelection()?.toString() ?? "",
    x: native.clientX - rect.left,
    y: native.clientY - rect.top,
    preventDefault() {
      native.preventDefault();
      native.stopPropagation();
    },
  };
}

/** Calls `onDismiss` on a click/scroll/keypress outside `inside`. Returns an unsubscribe. */
export function onOutsideInteraction(inside: unknown, onDismiss: () => void): () => void {
  if (!isWeb) return () => {};
  const events = ["mousedown", "wheel", "keydown", "blur"];
  const handler = (event?: { target?: DomNode | null }) => {
    const node = inside as DomNode | null;
    if (event?.target && node?.contains?.(event.target)) return;
    onDismiss();
  };
  for (const type of events) window.addEventListener(type, handler, true);
  return () => {
    for (const type of events) window.removeEventListener(type, handler, true);
  };
}
