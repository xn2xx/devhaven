export const TAG_PRESET_COLORS = [
  { name: "无颜色", color: "#4DABF7" },
  { name: "红色", color: "#FF6B6B" },
  { name: "橙色", color: "#FFA94D" },
  { name: "黄色", color: "#FFD43B" },
  { name: "绿色", color: "#69DB7C" },
  { name: "蓝色", color: "#4DABF7" },
  { name: "紫色", color: "#DA77F2" },
  { name: "灰色", color: "#9E9E9E" },
];

/** 基于标签文本生成稳定的展示颜色。 */
export function pickColorForTag(tag: string) {
  const index = Math.abs(hashString(tag)) % TAG_PRESET_COLORS.length;
  return TAG_PRESET_COLORS[index].color;
}

/** 生成稳定的字符串哈希，用于颜色分配。 */
function hashString(value: string) {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash << 5) - hash + value.charCodeAt(i);
    hash |= 0;
  }
  return hash;
}
