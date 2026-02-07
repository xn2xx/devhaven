import { invoke } from "@tauri-apps/api/core";

export type InteractionLockState = {
  locked: boolean;
  reason?: string | null;
};

export async function getInteractionLockState(): Promise<InteractionLockState> {
  return invoke<InteractionLockState>("get_interaction_lock_state");
}

