import { useEffect, useMemo, useState } from "react";
import { getVersion } from "@tauri-apps/api/app";
import { openUrl } from "@tauri-apps/plugin-opener";

import type { AppSettings, GitIdentity, Project } from "../models/types";
import { openInTerminal } from "../services/system";
import { checkForUpdates } from "../services/update";
import { normalizeGitIdentities } from "../utils/gitIdentity";
import { IconX } from "./Icons";

type UpdateState =
  | { status: "idle" }
  | { status: "checking" }
  | { status: "latest"; currentVersion: string; latestVersion: string; url?: string }
  | { status: "update"; currentVersion: string; latestVersion: string; url?: string }
  | { status: "error"; message: string; currentVersion?: string };

type TerminalPreset = {
  id: string;
  label: string;
  commandPath: string;
  arguments: string[];
};

const TERMINAL_PRESETS: TerminalPreset[] = [
  { id: "system", label: "系统默认终端", commandPath: "", arguments: [] },
  { id: "terminal", label: "Terminal.app", commandPath: "/usr/bin/open", arguments: ["-a", "Terminal"] },
  { id: "iterm", label: "iTerm2", commandPath: "/usr/bin/open", arguments: ["-a", "iTerm"] },
  { id: "ghostty", label: "Ghostty", commandPath: "/usr/bin/open", arguments: ["-a", "Ghostty"] },
  { id: "warp", label: "Warp", commandPath: "/usr/bin/open", arguments: ["-a", "Warp"] },
  { id: "wezterm", label: "WezTerm", commandPath: "/usr/bin/open", arguments: ["-a", "WezTerm"] },
];

const CUSTOM_TERMINAL_ID = "custom";

const normalizeArgs = (args: string[]) => args.map((arg) => arg.trim()).filter(Boolean);

const isSameArguments = (left: string[], right: string[]) => {
  if (left.length !== right.length) {
    return false;
  }
  return left.every((item, index) => item === right[index]);
};

const isSameIdentities = (left: GitIdentity[], right: GitIdentity[]) => {
  if (left.length !== right.length) {
    return false;
  }
  return left.every((item, index) => item.name === right[index].name && item.email === right[index].email);
};

const resolveTerminalPresetId = (commandPath: string, argumentsList: string[]) => {
  const normalizedPath = commandPath.trim();
  const normalizedArguments = normalizeArgs(argumentsList);
  const matched = TERMINAL_PRESETS.find(
    (preset) => preset.commandPath === normalizedPath && isSameArguments(normalizeArgs(preset.arguments), normalizedArguments),
  );
  return matched?.id ?? CUSTOM_TERMINAL_ID;
};

export type SettingsModalProps = {
  settings: AppSettings;
  projects: Project[];
  onClose: () => void;
  onSaveSettings: (settings: AppSettings) => Promise<void>;
  onPreviewTerminalRenderer: (enabled: boolean) => void;
};

/** 设置弹窗，提供更新检查、终端工具与 Git 身份配置。 */
export default function SettingsModal({
  settings,
  projects,
  onClose,
  onSaveSettings,
  onPreviewTerminalRenderer,
}: SettingsModalProps) {
  const [terminalCommandPath, setTerminalCommandPath] = useState(settings.terminalOpenTool.commandPath);
  const [terminalArgumentsText, setTerminalArgumentsText] = useState(
    settings.terminalOpenTool.arguments.join("\n"),
  );
  const [terminalPresetId, setTerminalPresetId] = useState(() =>
    resolveTerminalPresetId(settings.terminalOpenTool.commandPath, settings.terminalOpenTool.arguments),
  );
  const [gitIdentities, setGitIdentities] = useState<GitIdentity[]>(settings.gitIdentities);
  const [useWebglRenderer, setUseWebglRenderer] = useState(settings.terminalUseWebglRenderer);
  const [showMonitorWindow, setShowMonitorWindow] = useState(settings.showMonitorWindow);
  const [versionLabel, setVersionLabel] = useState("");
  const [updateState, setUpdateState] = useState<UpdateState>({ status: "idle" });
  const [isSaving, setIsSaving] = useState(false);

  const parsedTerminalArguments = useMemo(() => normalizeArgs(terminalArgumentsText.split("\n")), [terminalArgumentsText]);
  const normalizedGitIdentities = useMemo(() => normalizeGitIdentities(gitIdentities), [gitIdentities]);
  const nextSettings = useMemo<AppSettings>(
    () => ({
      ...settings,
      terminalOpenTool: {
        commandPath: terminalCommandPath.trim(),
        arguments: parsedTerminalArguments,
      },
      terminalUseWebglRenderer: useWebglRenderer,
      showMonitorWindow,
      gitIdentities: normalizedGitIdentities,
    }),
    [normalizedGitIdentities, parsedTerminalArguments, settings, terminalCommandPath, useWebglRenderer, showMonitorWindow],
  );
  const isDirty = useMemo(() => {
    const currentTerminalArguments = normalizeArgs(settings.terminalOpenTool.arguments);
    const normalizedStoredIdentities = normalizeGitIdentities(settings.gitIdentities);
    return !(
      nextSettings.terminalOpenTool.commandPath === settings.terminalOpenTool.commandPath &&
      isSameArguments(nextSettings.terminalOpenTool.arguments, currentTerminalArguments) &&
      isSameIdentities(nextSettings.gitIdentities, normalizedStoredIdentities) &&
      nextSettings.terminalUseWebglRenderer === settings.terminalUseWebglRenderer &&
      nextSettings.showMonitorWindow === settings.showMonitorWindow
    );
  }, [nextSettings, settings]);

  const terminalCommandPreview = useMemo(() => {
    const command = terminalCommandPath.trim();
    if (!command) {
      return terminalPresetId === CUSTOM_TERMINAL_ID ? "尚未配置命令" : "使用系统默认终端";
    }
    return [command, ...parsedTerminalArguments].join(" ");
  }, [terminalCommandPath, parsedTerminalArguments, terminalPresetId]);

  const testPath = projects[0]?.path ?? "";
  const canTestTerminal = Boolean(testPath);

  useEffect(() => {
    setTerminalCommandPath(settings.terminalOpenTool.commandPath);
    setTerminalArgumentsText(settings.terminalOpenTool.arguments.join("\n"));
    setTerminalPresetId(resolveTerminalPresetId(settings.terminalOpenTool.commandPath, settings.terminalOpenTool.arguments));
    setGitIdentities(settings.gitIdentities);
    setUseWebglRenderer(settings.terminalUseWebglRenderer);
    setShowMonitorWindow(settings.showMonitorWindow);
  }, [
    settings.terminalOpenTool.arguments,
    settings.terminalOpenTool.commandPath,
    settings.gitIdentities,
    settings.terminalUseWebglRenderer,
    settings.showMonitorWindow,
  ]);

  const handleTerminalPresetChange = (nextPresetId: string) => {
    setTerminalPresetId(nextPresetId);
    if (nextPresetId === CUSTOM_TERMINAL_ID) {
      return;
    }
    const preset = TERMINAL_PRESETS.find((item) => item.id === nextPresetId);
    if (!preset) {
      return;
    }
    setTerminalCommandPath(preset.commandPath);
    setTerminalArgumentsText(preset.arguments.join("\n"));
  };

  const handleAddGitIdentity = () => {
    setGitIdentities((prev) => [...prev, { name: "", email: "" }]);
  };

  const handleUpdateGitIdentity = (index: number, field: "name" | "email", value: string) => {
    setGitIdentities((prev) =>
      prev.map((item, currentIndex) =>
        currentIndex === index ? { ...item, [field]: value } : item,
      ),
    );
  };

  const handleRemoveGitIdentity = (index: number) => {
    setGitIdentities((prev) => prev.filter((_, currentIndex) => currentIndex !== index));
  };

  const handleToggleWebglRenderer = (enabled: boolean) => {
    setUseWebglRenderer(enabled);
    onPreviewTerminalRenderer(enabled);
  };

  const handleToggleMonitorWindow = (enabled: boolean) => {
    setShowMonitorWindow(enabled);
  };

  useEffect(() => {
    let active = true;
    getVersion()
      .then((version) => {
        if (active) {
          setVersionLabel(version);
        }
      })
      .catch(() => {
        if (active) {
          setVersionLabel("");
        }
      });
    return () => {
      active = false;
    };
  }, []);

  const handleClose = async () => {
    if (isSaving) {
      return;
    }
    if (isDirty) {
      setIsSaving(true);
      try {
        await onSaveSettings(nextSettings);
      } finally {
        setIsSaving(false);
      }
    }
    onClose();
  };

  const handleCheckUpdate = async () => {
    if (updateState.status === "checking") {
      return;
    }
    setUpdateState({ status: "checking" });
    const result = await checkForUpdates();
    if (result.status === "error") {
      setUpdateState({ status: "error", message: result.message, currentVersion: result.currentVersion });
      return;
    }
    if (result.status === "update") {
      setUpdateState({
        status: "update",
        currentVersion: result.currentVersion,
        latestVersion: result.latestVersion,
        url: result.url,
      });
      return;
    }
    setUpdateState({
      status: "latest",
      currentVersion: result.currentVersion,
      latestVersion: result.latestVersion,
      url: result.url,
    });
  };

  const handleOpenRelease = async () => {
    if (updateState.status !== "update" && updateState.status !== "latest") {
      return;
    }
    if (!updateState.url) {
      return;
    }
    try {
      await openUrl(updateState.url);
    } catch (error) {
      console.error("打开发布页面失败。", error);
    }
  };

  const handleTestTerminalOpen = async () => {
    if (!canTestTerminal) {
      return;
    }
    const commandPath = terminalCommandPath.trim();
    const argumentsList = parsedTerminalArguments;
    try {
      await openInTerminal({
        path: testPath,
        command_path: commandPath.length > 0 ? commandPath : null,
        arguments: commandPath.length > 0 && argumentsList.length > 0 ? argumentsList : null,
      });
    } catch (error) {
      console.error("终端测试打开失败。", error);
    }
  };

  return (
    <div className="modal-overlay" role="dialog" aria-modal>
      <div className="modal-panel min-w-[600px] w-[min(760px,92vw)] max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between gap-4">
          <div>
            <div className="text-[16px] font-semibold">设置</div>
            <div className="text-fs-caption text-secondary-text">
              调整更新检查、终端打开方式与 Git 身份（关闭窗口后保存）
            </div>
          </div>
          <button className="icon-btn" onClick={() => void handleClose()} aria-label="关闭" disabled={isSaving}>
            <IconX size={14} />
          </button>
        </div>

        <section className="flex flex-col gap-3 rounded-xl border border-border bg-card-bg p-3">
          <div className="text-[13px] font-semibold">更新与版本</div>
          <div className="flex flex-wrap items-center gap-2.5">
            <div className="rounded-full bg-button-bg px-2.5 py-1 text-fs-caption">当前版本：{versionLabel || "--"}</div>
            <button className="btn btn-outline" onClick={() => void handleCheckUpdate()}>
              {updateState.status === "checking" ? "检查中..." : "检查更新"}
            </button>
            {updateState.status === "update" || updateState.status === "latest" ? (
              <button className="btn" onClick={() => void handleOpenRelease()} disabled={!updateState.url}>
                查看发布
              </button>
            ) : null}
          </div>
          <UpdateStatusLine state={updateState} />
        </section>

        <section className="flex flex-col gap-3 rounded-xl border border-border bg-card-bg p-3">
          <div className="text-[13px] font-semibold">终端渲染</div>
          <label className="flex items-center gap-2 text-text">
            <input
              className="h-3.5 w-3.5"
              type="checkbox"
              checked={useWebglRenderer}
              onChange={(event) => handleToggleWebglRenderer(event.target.checked)}
            />
            <span>启用 WebGL 渲染（更流畅，可能受驱动影响）</span>
          </label>
          <div className="text-fs-caption text-secondary-text">切换后立即生效，关闭窗口后保存。</div>
        </section>

        <section className="flex flex-col gap-3 rounded-xl border border-border bg-card-bg p-3">
          <div className="text-[13px] font-semibold">悬浮窗</div>
          <label className="flex items-center gap-2 text-text">
            <input
              className="h-3.5 w-3.5"
              type="checkbox"
              checked={showMonitorWindow}
              onChange={(event) => handleToggleMonitorWindow(event.target.checked)}
            />
            <span>显示 CLI 悬浮监控窗（只读）</span>
          </label>
          <div className="text-fs-caption text-secondary-text">
            关闭设置窗口后生效，手动关闭悬浮窗不会修改开关状态。
          </div>
        </section>

        <section className="flex flex-col gap-3 rounded-xl border border-border bg-card-bg p-3">
          <div className="mb-1 flex items-center justify-between gap-3">
            <div className="text-[13px] font-semibold">Git 身份（热力图过滤）</div>
            {isSaving && (
              <div className="rounded-md bg-[rgba(69,59,231,0.1)] px-2 py-1 text-[11px] text-accent animate-pulse">
                保存中...
              </div>
            )}
          </div>
          {gitIdentities.length === 0 ? (
            <div className="text-fs-caption text-secondary-text">尚未配置身份，将统计所有提交。</div>
          ) : null}
          <div className="flex flex-col gap-2">
            {gitIdentities.map((identity, index) => (
              <div
                key={`git-identity-${index}`}
                className="grid grid-cols-[minmax(140px,1fr)_minmax(180px,1fr)_auto] items-center gap-2"
              >
                <input
                  className="rounded-md border border-border bg-card-bg px-2 py-2 text-text focus:outline-2 focus:outline-accent focus:outline-offset-[-1px]"
                  value={identity.name}
                  onChange={(event) => handleUpdateGitIdentity(index, "name", event.target.value)}
                  placeholder="用户名"
                  aria-label={`Git 用户名 ${index + 1}`}
                />
                <input
                  type="email"
                  className="rounded-md border border-border bg-card-bg px-2 py-2 text-text focus:outline-2 focus:outline-accent focus:outline-offset-[-1px]"
                  value={identity.email}
                  onChange={(event) => handleUpdateGitIdentity(index, "email", event.target.value)}
                  placeholder="邮箱"
                  aria-label={`Git 邮箱 ${index + 1}`}
                />
                <button
                  className="btn btn-outline whitespace-nowrap"
                  onClick={() => handleRemoveGitIdentity(index)}
                >
                  移除
                </button>
              </div>
            ))}
          </div>
          <div className="flex items-center justify-end gap-2">
            <button className="btn btn-outline" onClick={handleAddGitIdentity}>
              添加身份
            </button>
          </div>
          <div className="bg-secondary-background text-fs-caption text-secondary-text">
            <div className="flex flex-col gap-1.5 text-fs-caption text-secondary-text">
              <span>用于热力图统计过滤，不会修改 Git 配置。</span>
              <span>支持配置多个身份，按用户名或邮箱（大小写不敏感）精确匹配。</span>
              <span>修改将在关闭设置窗口时保存。</span>
            </div>
          </div>
        </section>

        <section className="flex flex-col gap-3 rounded-xl border border-border bg-card-bg p-3">
          <div className="mb-1 flex items-center justify-between gap-3">
            <div className="text-[13px] font-semibold">终端打开工具</div>
            {isSaving && (
              <div className="rounded-md bg-[rgba(69,59,231,0.1)] px-2 py-1 text-[11px] text-accent animate-pulse">
                保存中...
              </div>
            )}
          </div>
          <div className="grid grid-cols-[repeat(auto-fit,minmax(240px,1fr))] gap-3">
            <label className="flex flex-col gap-1.5 text-[13px] text-secondary-text">
              <span>终端工具</span>
              <select
                className="rounded-md border border-border bg-card-bg px-2 py-2 text-text"
                value={terminalPresetId}
                onChange={(event) => handleTerminalPresetChange(event.target.value)}
              >
                {TERMINAL_PRESETS.map((preset) => (
                  <option key={preset.id} value={preset.id}>
                    {preset.label}
                  </option>
                ))}
                <option value={CUSTOM_TERMINAL_ID}>自定义命令</option>
              </select>
            </label>
            {terminalPresetId === CUSTOM_TERMINAL_ID ? (
              <label className="flex flex-col gap-1.5 text-[13px] text-secondary-text">
                <span>命令行路径</span>
                <input
                  className="rounded-md border border-border bg-card-bg px-2 py-2 text-text"
                  value={terminalCommandPath}
                  onChange={(event) => setTerminalCommandPath(event.target.value)}
                  placeholder="例如：/usr/bin/open 或 ghostty"
                />
              </label>
            ) : null}
            <label className="flex flex-col gap-1.5 text-[13px] text-secondary-text">
              <span>
                参数（每行一个）
                {terminalPresetId !== CUSTOM_TERMINAL_ID && (
                  <span className="ml-1.5 text-[11px] font-normal text-secondary-text opacity-80">
                    （预设模式下不可编辑）
                  </span>
                )}
              </span>
              <textarea
                className="rounded-md border border-border bg-card-bg px-2 py-2 text-text"
                rows={4}
                value={terminalArgumentsText}
                onChange={(event) => setTerminalArgumentsText(event.target.value)}
                disabled={terminalPresetId !== CUSTOM_TERMINAL_ID}
                placeholder="例如：-a iTerm\n--working-directory={path}"
              />
            </label>
          </div>
          <div className="flex flex-col gap-1.5 rounded-lg border border-border bg-secondary-background p-2.5">
            <div className="text-[11px] font-semibold uppercase tracking-[0.5px] text-secondary-text">命令预览</div>
            <code className="rounded-md bg-[rgba(0,0,0,0.2)] p-2 text-[12px] text-text font-mono whitespace-pre-wrap break-all overflow-x-auto">
              {terminalCommandPreview}
            </code>
          </div>
          <div className="flex items-center justify-end gap-2">
            <button
              className="btn btn-outline"
              onClick={() => void handleTestTerminalOpen()}
              disabled={!canTestTerminal}
            >
              {testPath ? "测试打开首个项目" : "暂无可测试项目"}
            </button>
          </div>
        </section>
      </div>
    </div>
  );
}

type UpdateStatusLineProps = {
  state: UpdateState;
};

function UpdateStatusLine({ state }: UpdateStatusLineProps) {
  if (state.status === "idle") {
    return <div className="text-fs-caption text-secondary-text">点击检查更新以获取最新版本信息。</div>;
  }
  if (state.status === "checking") {
    return <div className="text-fs-caption text-secondary-text">正在连接更新服务，请稍候...</div>;
  }
  if (state.status === "error") {
    return <div className="text-fs-caption text-error">检查失败：{state.message}</div>;
  }
  if (state.status === "update") {
    return (
      <div className="text-fs-caption text-warning">
        发现新版本 {state.latestVersion}，当前 {state.currentVersion}
      </div>
    );
  }
  return <div className="text-fs-caption text-success">已是最新版本 {state.latestVersion}</div>;
}
