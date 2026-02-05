export function detectLanguage(filePath: string): string {
  const normalized = filePath.replace(/\\/g, "/");
  const baseName = (normalized.split("/").pop() ?? normalized).toLowerCase();

  // Special filenames without extension.
  if (baseName === "dockerfile") {
    return "dockerfile";
  }
  if (baseName === "makefile") {
    return "makefile";
  }

  const ext = baseName.split(".").pop() ?? "";
  const languageMap: Record<string, string> = {
    // JavaScript/TypeScript
    ts: "typescript",
    tsx: "typescript",
    js: "javascript",
    jsx: "javascript",
    mjs: "javascript",
    cjs: "javascript",

    // Web
    html: "html",
    htm: "html",
    css: "css",
    scss: "scss",
    less: "less",

    // Data formats
    json: "json",
    yaml: "yaml",
    yml: "yaml",
    xml: "xml",
    toml: "toml",

    // Markdown/Docs
    md: "markdown",
    mdx: "markdown",

    // Shell
    sh: "shell",
    bash: "shell",
    zsh: "shell",
    fish: "shell",

    // Other languages
    py: "python",
    rb: "ruby",
    go: "go",
    rs: "rust",
    java: "java",
    kt: "kotlin",
    swift: "swift",
    c: "c",
    cpp: "cpp",
    h: "c",
    hpp: "cpp",
    cs: "csharp",
    php: "php",
    sql: "sql",
    graphql: "graphql",
    gql: "graphql",
  };

  return languageMap[ext] || "plaintext";
}

