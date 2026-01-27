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
      <div className="modal modal-large recycle-bin-modal">
        <div className="recycle-bin-header">
          <div>
            <div className="recycle-bin-title">回收站</div>
            <div className="recycle-bin-subtitle">共 {items.length} 个项目</div>
          </div>
          <div className="recycle-bin-actions">
            <button className="icon-button" onClick={onClose} aria-label="关闭">
              <IconX size={14} />
            </button>
          </div>
        </div>

        {items.length === 0 ? (
          <div className="recycle-bin-empty-state">回收站为空</div>
        ) : (
          <div className="recycle-bin-table">
            <div className="recycle-bin-row recycle-bin-row-header">
              <span>名称</span>
              <span>路径</span>
              <span>状态</span>
              <span>操作</span>
            </div>
            {items.map((item) => (
              <div className="recycle-bin-row" key={item.path}>
                <span className="recycle-bin-name" title={item.name}>
                  {item.name}
                </span>
                <span className="recycle-bin-path" title={item.path}>
                  {item.path}
                </span>
                <span className={`recycle-bin-status${item.missing ? " is-missing" : ""}`}>
                  {item.missing ? "已丢失" : "可恢复"}
                </span>
                <button className="button button-outline" onClick={() => onRestore(item.path)}>
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
