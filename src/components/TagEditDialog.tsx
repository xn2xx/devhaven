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
      <div className="modal">
        <div className="modal-title">{title}</div>
        <label className="form-field">
          <span>标签名称</span>
          <input value={name} onChange={(event) => setName(event.target.value)} />
        </label>
        <label className="form-field">
          <span>标签颜色</span>
          <input type="color" value={color} onChange={(event) => setColor(event.target.value)} />
        </label>
        <div className="color-palette">
          {TAG_PRESET_COLORS.map((option) => (
            <button
              key={option.name}
              className={`color-swatch${color === option.color ? " is-selected" : ""}`}
              style={{ background: option.color }}
              onClick={() => setColor(option.color)}
              title={option.name}
            />
          ))}
        </div>
        {error ? <div className="form-error">{error}</div> : null}
        {name ? (
          <div className="tag-preview" style={{ background: `${color}33`, color }}>
            {name}
          </div>
        ) : null}
        <div className="modal-actions">
          <button type="button" className="button" onClick={onClose}>
            取消
          </button>
          <button type="button" className="button button-primary" onClick={handleSubmit}>
            确定
          </button>
        </div>
      </div>
    </div>
  );
}
