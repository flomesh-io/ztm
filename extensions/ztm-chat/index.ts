import type { OpenClawPluginApi, ChannelPlugin } from "openclaw/plugin-sdk";
import type { ResolvedZTMChatAccount } from "./src/channel/index.js";
import { ztmChatPlugin, disposeMessageStateStore } from "./src/channel/index.js";
import { setZTMRuntime } from "./src/runtime/index.js";
import { runWizard, discoverConfig } from "./src/onboarding/index.js";

// Set up global unhandled rejection handler in non-test environments
// This ensures async errors are logged instead of being silently swallowed
if (process.env.NODE_ENV !== "test") {
  process.on("unhandledRejection", (reason: unknown) => {
    console.error("[ztm-chat] Unhandled Promise rejection:", reason);
  });
}

export {
  ZTMChatWizard,
  ConsolePrompts,
  runWizard,
  discoverConfig,
  type WizardResult,
  type WizardPrompts,
} from "./src/onboarding/index.js";

// Re-export dispose function for plugin cleanup (from channel/index.js)
export { disposeMessageStateStore } from "./src/channel/index.js";

// Plugin registration function
export function registerPlugin(api: OpenClawPluginApi): void {
  // Set runtime for the plugin
  setZTMRuntime(api.runtime);

  // Register the channel
  api.registerChannel({ plugin: ztmChatPlugin });

  // Register CLI commands
  api.registerCli(
    ({ program }) => {
      program
        .command("ztm-chat-wizard")
        .description("Run the ZTM Chat interactive setup wizard")
        .action(async () => {
          const result = await runWizard();
          if (result) {
            console.log("\n✅ Configuration complete!");
            console.log(`📁 Saved to: ${result.savePath || "memory only"}`);
            console.log("\nNext steps:");
            console.log("  1. Restart OpenClaw: openclaw gateway restart");
            console.log("  2. Check status: openclaw channels status");
          }
        });

      program
        .command("ztm-chat-discover")
        .description("Auto-discover ZTM configuration from existing setup")
        .action(async () => {
          const discovered = await discoverConfig();
          if (discovered) {
            console.log("\n📡 Discovered ZTM Configuration:");
            console.log(`   Agent URL: ${discovered.agentUrl}`);
            console.log(`   Mesh: ${discovered.meshName}`);
            console.log(`   Username: ${discovered.username}`);
            console.log("\n💡 To use this configuration, run: openclaw ztm-chat-wizard");
          } else {
            console.log("\n⚠️  No existing ZTM configuration found.");
            console.log("   Run 'openclaw ztm-chat-wizard' to set up.");
          }
        });
    },
    { commands: ["ztm-chat-wizard", "ztm-chat-discover"] },
  );
}

// Plugin type definition extending ChannelPlugin with dispose support
interface ZtmChatPluginDefinition extends ChannelPlugin<ResolvedZTMChatAccount> {
  dispose?: () => void;
}

// Export plugin as default (ES module format)
const plugin: ZtmChatPluginDefinition = {
  ...ztmChatPlugin,
  dispose: disposeMessageStateStore,
};

// Pairing commands are handled by OpenClaw core:
// - openclaw pairing list ztm-chat
// - openclaw pairing approve ztm-chat <code>

// Export registerPlugin as default (OpenClaw requires a register/activate export)
export default registerPlugin;

export { plugin };
