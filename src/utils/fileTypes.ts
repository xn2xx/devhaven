function getExtension(filePath: string): string {
  const normalized = filePath.replace(/\\/g, "/");
  const baseName = normalized.split("/").pop() ?? normalized;
  const dotIndex = baseName.lastIndexOf(".");
  if (dotIndex <= 0 || dotIndex === baseName.length - 1) {
    return "";
  }
  return baseName.slice(dotIndex + 1).toLowerCase();
}

const MARKDOWN_EXTENSIONS = new Set(["md", "markdown", "mdx"]);
const IMAGE_EXTENSIONS = new Set(["png", "jpg", "jpeg", "gif", "webp", "svg", "bmp", "ico"]);

export function isMarkdownFile(filePath: string): boolean {
  return MARKDOWN_EXTENSIONS.has(getExtension(filePath));
}

export function isImageFile(filePath: string): boolean {
  return IMAGE_EXTENSIONS.has(getExtension(filePath));
}

export function hasRenderedPreview(filePath: string): boolean {
  return isMarkdownFile(filePath) || isImageFile(filePath);
}

