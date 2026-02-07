const USER_HOME_PREFIX_PATTERNS = [
  /^\/Users\/[^/]+(?=\/|$)/,
  /^\/home\/[^/]+(?=\/|$)/,
  /^[A-Za-z]:\/Users\/[^/]+(?=\/|$)/,
];

/** 将用户目录前缀折叠为 `~`，其余路径保持不变。 */
export function formatPathWithTilde(path: string): string {
  if (!path) {
    return path;
  }

  const normalized = path.replace(/\\/g, "/");
  for (const pattern of USER_HOME_PREFIX_PATTERNS) {
    const matched = normalized.match(pattern);
    if (!matched) {
      continue;
    }
    const suffix = normalized.slice(matched[0].length);
    return `~${suffix}`;
  }

  return normalized;
}
