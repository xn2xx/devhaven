import type { TerminalTab } from "../../models/terminal";
import { IconPlusCircle, IconX } from "../Icons";

type TerminalTabsProps = {
  tabs: TerminalTab[];
  activeTabId: string;
  onSelect: (tabId: string) => void;
  onNewTab: () => void;
  onCloseTab: (tabId: string) => void;
};

export default function TerminalTabs({
  tabs,
  activeTabId,
  onSelect,
  onNewTab,
  onCloseTab,
}: TerminalTabsProps) {
  return (
    <div className="flex items-center gap-1 overflow-x-auto">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          className={`flex items-center gap-2 rounded-md px-2.5 py-1 text-[12px] font-semibold ${
            tab.id === activeTabId
              ? "bg-[rgba(69,59,231,0.25)] text-text"
              : "text-secondary-text hover:bg-button-hover hover:text-text"
          }`}
          onClick={() => onSelect(tab.id)}
        >
          <span className="truncate max-w-[140px]">{tab.title}</span>
          {tabs.length > 1 ? (
            <span
              className="inline-flex h-4 w-4 items-center justify-center rounded hover:bg-[rgba(255,255,255,0.2)]"
              onClick={(event) => {
                event.stopPropagation();
                onCloseTab(tab.id);
              }}
            >
              <IconX size={12} />
            </span>
          ) : null}
        </button>
      ))}
      <button className="icon-btn" onClick={onNewTab} aria-label="新建终端 Tab">
        <IconPlusCircle size={16} />
      </button>
    </div>
  );
}
