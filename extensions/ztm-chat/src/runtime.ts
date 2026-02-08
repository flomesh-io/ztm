// ZTM Runtime - Manages ZTM network connection and message handling

import type { PluginRuntime } from "openclaw/plugin-sdk";

let runtime: PluginRuntime | null = null;

export function setZTMRuntime(next: PluginRuntime) {
  runtime = next;
}

export function getZTMRuntime(): PluginRuntime {
  if (!runtime) {
    throw new Error("ZTM runtime not initialized");
  }
  return runtime;
}

// Get ZTM Chat runtime with additional state
export interface ZTMChatRuntimeState {
  pendingPairings: Map<string, Date>;
}

export async function getZTMChatRuntime(): Promise<ZTMChatRuntimeState | null> {
  try {
    const rt = getZTMRuntime();
    // Access pending pairings through the channel-specific state
    // This is a simplified interface - in production, use proper state management
    return {
      pendingPairings: new Map(),
    };
  } catch {
    return null;
  }
}
