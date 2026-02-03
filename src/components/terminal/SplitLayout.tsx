import type { ReactNode, RefObject } from "react";
import { Fragment, useRef } from "react";

import type { SplitNode, SplitOrientation } from "../../models/terminal";

type SplitLayoutProps = {
  root: SplitNode;
  activeSessionId: string;
  onActivate: (sessionId: string) => void;
  onResize: (path: number[], ratios: number[]) => void;
  renderPane: (sessionId: string, isActive: boolean) => ReactNode;
  path?: number[];
};

type SplitDividerProps = {
  orientation: SplitOrientation;
  index: number;
  ratios: number[];
  path: number[];
  containerRef: RefObject<HTMLDivElement | null>;
  onResize: (path: number[], ratios: number[]) => void;
};

const MIN_RATIO = 0.05;

function SplitDivider({ orientation, index, ratios, path, containerRef, onResize }: SplitDividerProps) {
  const isVertical = orientation === "v";
  const cursor = isVertical ? "cursor-col-resize" : "cursor-row-resize";
  const dividerSize = isVertical ? "w-1.5" : "h-1.5";
  const dividerClass = `${dividerSize} bg-[rgba(255,255,255,0.08)] hover:bg-[rgba(255,255,255,0.2)]`;

  const handleMouseDown = (event: React.MouseEvent<HTMLDivElement>) => {
    event.preventDefault();
    const container = containerRef.current;
    if (!container) {
      return;
    }
    const rect = container.getBoundingClientRect();
    const startPos = isVertical ? event.clientX : event.clientY;
    const size = isVertical ? rect.width : rect.height;
    const startRatios = [...ratios];
    const pairTotal = (startRatios[index] ?? 0) + (startRatios[index + 1] ?? 0);

    const handleMove = (moveEvent: MouseEvent) => {
      const currentPos = isVertical ? moveEvent.clientX : moveEvent.clientY;
      const delta = (currentPos - startPos) / size;
      let left = (startRatios[index] ?? 0) + delta;
      let right = (startRatios[index + 1] ?? 0) - delta;
      if (left < MIN_RATIO) {
        left = MIN_RATIO;
        right = pairTotal - left;
      }
      if (right < MIN_RATIO) {
        right = MIN_RATIO;
        left = pairTotal - right;
      }
      const nextRatios = [...startRatios];
      nextRatios[index] = left;
      nextRatios[index + 1] = right;
      onResize(path, nextRatios);
    };

    const handleUp = () => {
      window.removeEventListener("mousemove", handleMove);
      window.removeEventListener("mouseup", handleUp);
    };

    window.addEventListener("mousemove", handleMove);
    window.addEventListener("mouseup", handleUp);
  };

  return (
    <div
      className={`${cursor} ${dividerClass} shrink-0`}
      onMouseDown={handleMouseDown}
      role="separator"
      aria-orientation={isVertical ? "vertical" : "horizontal"}
    />
  );
}

export default function SplitLayout({
  root,
  activeSessionId,
  onActivate,
  onResize,
  renderPane,
  path = [],
}: SplitLayoutProps) {
  if (root.type === "pane") {
    return <div className="h-full w-full">{renderPane(root.sessionId, root.sessionId === activeSessionId)}</div>;
  }

  const containerRef = useRef<HTMLDivElement>(null);
  const isVertical = root.orientation === "v";
  const containerClass = `flex h-full w-full min-h-0 min-w-0 ${isVertical ? "flex-row" : "flex-col"}`;

  return (
    <div ref={containerRef} className={containerClass}>
      {root.children.map((child, index) => {
        const ratio = root.ratios[index] ?? 1 / root.children.length;
        return (
          <Fragment key={`${path.join("-")}-${index}`}>
            <div
              className="min-h-0 min-w-0 flex"
              style={{ flexBasis: `${ratio * 100}%`, flexGrow: ratio, flexShrink: 0 }}
            >
              <SplitLayout
                root={child}
                activeSessionId={activeSessionId}
                onActivate={onActivate}
                onResize={onResize}
                renderPane={renderPane}
                path={[...path, index]}
              />
            </div>
            {index < root.children.length - 1 ? (
              <SplitDivider
                orientation={root.orientation}
                index={index}
                ratios={root.ratios}
                path={path}
                containerRef={containerRef}
                onResize={onResize}
              />
            ) : null}
          </Fragment>
        );
      })}
    </div>
  );
}
