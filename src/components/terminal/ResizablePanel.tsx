import { useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";

export type ResizablePanelProps = {
  children: React.ReactNode;
  width: number;
  onWidthChange: (width: number) => void;
  minWidth: number;
  maxWidth: number;
  handleSide: "left" | "right";
  className?: string;
};

export default function ResizablePanel({
  children,
  width,
  onWidthChange,
  minWidth,
  maxWidth,
  handleSide,
  className,
}: ResizablePanelProps) {
  const startXRef = useRef(0);
  const startWidthRef = useRef(0);
  const [isResizing, setIsResizing] = useState(false);
  const isResizingRef = useRef(false);
  isResizingRef.current = isResizing;

  const handlePointerMove = useCallback(
    (moveEvent: PointerEvent) => {
      if (!isResizingRef.current) {
        return;
      }
      const delta = moveEvent.clientX - startXRef.current;
      // Left handle: dragging left increases width (invert delta).
      const adjusted = handleSide === "left" ? -delta : delta;
      const next = Math.max(minWidth, Math.min(maxWidth, startWidthRef.current + adjusted));
      onWidthChange(next);
    },
    [handleSide, maxWidth, minWidth, onWidthChange],
  );

  const handlePointerUp = useCallback(() => {
    if (isResizingRef.current) {
      setIsResizing(false);
    }
  }, []);

  const handlePointerDown = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      if (event.button !== 0) {
        return;
      }
      event.preventDefault();
      event.stopPropagation();
      startXRef.current = event.clientX;
      startWidthRef.current = width;
      setIsResizing(true);
    },
    [width],
  );

  useEffect(() => {
    if (!isResizing) {
      return;
    }
    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);
    const previousUserSelect = document.body.style.userSelect;
    const previousCursor = document.body.style.cursor;
    document.body.style.userSelect = "none";
    document.body.style.cursor = "col-resize";
    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
      document.body.style.userSelect = previousUserSelect;
      document.body.style.cursor = previousCursor;
    };
  }, [handlePointerMove, handlePointerUp, isResizing]);

  return (
    <div
      className={`relative h-full shrink-0 overflow-hidden bg-[var(--terminal-panel-bg)] border-[var(--terminal-divider)] ${
        handleSide === "left" ? "border-l" : "border-r"
      } ${className ?? ""}`}
      style={{ width }}
    >
      {children}
      <div
        role="separator"
        aria-orientation="vertical"
        aria-valuenow={width}
        aria-valuemin={minWidth}
        aria-valuemax={maxWidth}
        tabIndex={0}
        onPointerDown={handlePointerDown}
        className={`group absolute top-0 h-full w-4 cursor-col-resize z-30 touch-none ${
          handleSide === "left" ? "-left-2" : "-right-2"
        }`}
      >
        <div
          className={`absolute top-0 h-full w-[2px] transition-colors ${
            handleSide === "left" ? "right-2" : "left-2"
          } ${
            isResizing
              ? "bg-[var(--terminal-divider)]"
              : "bg-transparent group-hover:bg-[var(--terminal-divider)]"
          }`}
        />
      </div>
    </div>
  );
}
