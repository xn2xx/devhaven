import { useEffect, useMemo, useState } from "react";

import type { TagData } from "../models/types";
import { TAG_PRESET_COLORS } from "../utils/tagColors";

export type TagEditDialogProps = {
  title: string;
  isOpen: boolean;
  existingTags: TagData[];
  initialName?: string;
  initialColor?: string;
  onClose: () => void;
  onSubmit: (name: string, colorHex: string) => void;
};

/** 标签编辑弹窗，负责校验名称与颜色选择。 */
export default function TagEditDialog({
  title,
  isOpen,
  existingTags,
  initialName = "",
  initialColor,
  onClose,
  onSubmit,
}: TagEditDialogProps) {
  const [name, setName] = useState(initialName);
  const [color, setColor] = useState(initialColor ?? TAG_PRESET_COLORS[0].color);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!isOpen) {
      return;
    }
    setName(initialName);
    setColor(initialColor ?? TAG_PRESET_COLORS[0].color);
    setError("");
  }, [initialName, initialColor, isOpen]);

  const normalizedExisting = useMemo(
    () => new Set(existingTags.map((tag) => tag.name)),
    [existingTags],
  );

  if (!isOpen) {
    return null;
  }

  /** 提交前校验名称与重名情况。 */
  const handleSubmit = () => {
    const trimmed = name.trim();
    if (!trimmed) {
      setError("标签名称不能为空");
      return;
    }
    if (trimmed !== initialName && normalizedExisting.has(trimmed)) {
      setError("标签名称已存在");
      return;
    }
    onSubmit(trimmed, color);
  };

  return (
    <div className="modal-overlay" role="dialog" aria-modal>
      <div className="modal-panel">
        <div className="text-[16px] font-semibold">{title}</div>
        <label className="flex flex-col gap-1.5 text-[13px] text-secondary-text">
          <span>标签名称</span>
          <input
            className="rounded-md border border-border bg-card-bg px-2 py-2 text-text"
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
        </label>
        <label className="flex flex-col gap-1.5 text-[13px] text-secondary-text">
          <span>标签颜色</span>
          <input
            className="rounded-md border border-border bg-card-bg px-2 py-2 text-text"
            type="color"
            value={color}
            onChange={(event) => setColor(event.target.value)}
          />
        </label>
        <div className="flex flex-wrap gap-1.5">
          {TAG_PRESET_COLORS.map((option) => (
            <button
              key={option.name}
              className={`h-5 w-5 rounded-full border-2 border-transparent ${
                color === option.color ? "border-white" : ""
              }`}
              style={{ background: option.color }}
              onClick={() => setColor(option.color)}
              title={option.name}
            />
          ))}
        </div>
        {error ? <div className="text-fs-caption text-error">{error}</div> : null}
        {name ? (
          <div className="inline-flex rounded-md px-2.5 py-1.5 text-fs-caption" style={{ background: `${color}33`, color }}>
            {name}
          </div>
        ) : null}
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
