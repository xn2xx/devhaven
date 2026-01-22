import React, { createContext, useContext } from "react";

import type { DevHavenStore } from "./useDevHaven";
import { useDevHaven } from "./useDevHaven";

const DevHavenContext = createContext<DevHavenStore | null>(null);

/** 提供项目管理状态与操作的上下文。 */
export function DevHavenProvider({ children }: { children: React.ReactNode }) {
  const store = useDevHaven();
  return <DevHavenContext.Provider value={store}>{children}</DevHavenContext.Provider>;
}

/** 获取项目管理上下文，未初始化时抛出错误。 */
export function useDevHavenContext() {
  const context = useContext(DevHavenContext);
  if (!context) {
    throw new Error("DevHavenContext 未初始化");
  }
  return context;
}
