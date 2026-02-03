import { IconX } from "./Icons";

export type RecycleBinItem = {
  path: string;
  name: string;
  missing: boolean;
};

export type RecycleBinModalProps = {
  items: RecycleBinItem[];
  onClose: () => void;
  onRestore: (path: string) => void;
};

/** 回收站弹窗，展示隐藏项目并支持恢复。 */
export default function RecycleBinModal({ items, onClose, onRestore }: RecycleBinModalProps) {
  return (
    <div className="modal-overlay" role="dialog" aria-modal>
      <div className="modal-panel w-[min(820px,90vw)] max-h-[85vh] overflow-hidden">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-[18px] font-semibold">回收站</div>
            <div className="text-fs-caption text-secondary-text">共 {items.length} 个项目</div>
          </div>
          <div className="inline-flex items-center gap-2">
            <button className="icon-btn" onClick={onClose} aria-label="关闭">
              <IconX size={14} />
            </button>
          </div>
        </div>

        {items.length === 0 ? (
          <div className="px-3 py-6 text-center text-fs-caption text-secondary-text">回收站为空</div>
        ) : (
          <div className="flex flex-col overflow-hidden rounded-[10px] border border-border bg-card-bg">
            <div className="grid grid-cols-[minmax(140px,1.2fr)_minmax(220px,2.4fr)_90px_90px] items-center gap-3 border-t-0 border-border bg-secondary-background px-3 py-2.5 text-[13px] font-semibold text-secondary-text">
              <span>名称</span>
              <span>路径</span>
              <span>状态</span>
              <span>操作</span>
            </div>
            {items.map((item) => (
              <div
                className="grid grid-cols-[minmax(140px,1.2fr)_minmax(220px,2.4fr)_90px_90px] items-center gap-3 border-t border-border px-3 py-2.5 text-[13px]"
                key={item.path}
              >
                <span className="truncate" title={item.name}>
                  {item.name}
                </span>
                <span className="truncate" title={item.path}>
                  {item.path}
                </span>
                <span className={item.missing ? "text-error" : "text-secondary-text"}>
                  {item.missing ? "已丢失" : "可恢复"}
                </span>
                <button className="btn btn-outline" onClick={() => onRestore(item.path)}>
                  恢复
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
