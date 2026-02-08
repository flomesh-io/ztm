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
