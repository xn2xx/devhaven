export type FsEntryKind = "file" | "dir";

export type FsFailureReason =
  | "too-large"
  | "binary"
  | "outside-project"
  | "symlink-escape"
  | "not-found"
  | "not-a-directory"
  | "not-a-file"
  | "io-error"
  | "invalid-path";

export type FsEntry = {
  name: string;
  relativePath: string;
  kind: FsEntryKind;
  size?: number | null;
};

export type FsListResponse = {
  ok: boolean;
  relativePath: string;
  entries: FsEntry[];
  reason?: FsFailureReason | null;
  message?: string | null;
};

export type FsReadResponse = {
  ok: boolean;
  relativePath: string;
  content?: string | null;
  size: number;
  maxSize: number;
  reason?: FsFailureReason | null;
  message?: string | null;
};

export type FsWriteResponse = {
  ok: boolean;
  relativePath: string;
  size: number;
  maxSize: number;
  reason?: FsFailureReason | null;
  message?: string | null;
};
