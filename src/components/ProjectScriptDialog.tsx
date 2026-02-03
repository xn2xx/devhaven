import { useEffect, useState } from "react";

export type ProjectScriptDialogProps = {
  title: string;
  isOpen: boolean;
  initialName?: string;
  initialStart?: string;
  initialStop?: string | null;
  onClose: () => void;
  onSubmit: (value: { name: string; start: string; stop?: string | null }) => void;
};

/** 项目脚本编辑弹窗。 */
export default function ProjectScriptDialog({
  title,
  isOpen,
  initialName = "",
  initialStart = "",
  initialStop = "",
  onClose,
  onSubmit,
}: ProjectScriptDialogProps) {
  const [name, setName] = useState(initialName);
  const [start, setStart] = useState(initialStart);
  const [stop, setStop] = useState(initialStop ?? "");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!isOpen) {
      return;
    }
    setName(initialName);
    setStart(initialStart);
    setStop(initialStop ?? "");
    setError("");
  }, [initialName, initialStart, initialStop, isOpen]);

  if (!isOpen) {
    return null;
  }

  const handleSubmit = () => {
    const trimmedName = name.trim();
    const trimmedStart = start.trim();
    const trimmedStop = stop.trim();
    if (!trimmedName) {
      setError("脚本名称不能为空");
      return;
    }
    if (!trimmedStart) {
      setError("启动命令不能为空");
      return;
    }
    onSubmit({
      name: trimmedName,
      start: trimmedStart,
      stop: trimmedStop ? trimmedStop : null,
    });
  };

  return (
    <div className="modal-overlay" role="dialog" aria-modal>
      <div className="modal-panel min-w-[600px]">
        <div className="text-[16px] font-semibold">{title}</div>
        <label className="flex flex-col gap-1.5 text-[13px] text-secondary-text">
          <span>脚本名称</span>
          <input
            className="rounded-md border border-border bg-card-bg px-2 py-2 text-text"
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="例如：开发服务器"
          />
        </label>
        <label className="flex flex-col gap-1.5 text-[13px] text-secondary-text">
          <span>启动命令</span>
          <textarea
            className="rounded-md border border-border bg-card-bg px-2 py-2 text-text"
            value={start}
            onChange={(event) => setStart(event.target.value)}
            rows={3}
            placeholder="例如：pnpm dev"
          />
        </label>
        <label className="flex flex-col gap-1.5 text-[13px] text-secondary-text">
          <span>停止命令（可选）</span>
          <textarea
            className="rounded-md border border-border bg-card-bg px-2 py-2 text-text"
            value={stop}
            onChange={(event) => setStop(event.target.value)}
            rows={2}
            placeholder="留空则发送 Ctrl+C"
          />
        </label>
        {error ? <div className="text-fs-caption text-error">{error}</div> : null}
        <div className="flex justify-end gap-2">
          <button type="button" className="btn" onClick={onClose}>
            取消
          </button>
          <button type="button" className="btn btn-primary" onClick={handleSubmit}>
            确定
          </button>
        </div>
      </div>
    </div>
  );
}
