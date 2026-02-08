import type { OpenClawPluginApi, ChannelPlugin } from "openclaw/plugin-sdk";
import { emptyPluginConfigSchema } from "openclaw/plugin-sdk";
import * as fs from "fs";
import * as path from "path";
import { ztmChatPlugin } from "./src/channel.js";
import { setZTMRuntime } from "./src/runtime.js";

// Wizard exports
export {
  ZTMChatWizard,
  ConsolePrompts,
  runWizard,
  discoverConfig,
  type WizardResult,
  type WizardPrompts,
} from "./src/wizard.js";

// Plugin configuration path
function getConfigPath(): string {
  return path.join(process.env.HOME || "", ".openclaw", "channels", "ztm-chat.json");
}

// Check if this is first-time installation
function isFirstInstall(): boolean {
  const configPath = getConfigPath();
  return !fs.existsSync(configPath);
}

// Show first-time setup banner
function showFirstTimeBanner(): void {
  console.log("");
  console.log("═".repeat(60));
  console.log("  🤖 ZTM Chat - First Time Setup");
  console.log("═".repeat(60));
  console.log("");
  console.log("  To configure ZTM Chat, you have two options:");
  console.log("");
  console.log("  1️⃣  Interactive Wizard (recommended)");
  console.log("     Run: npx ztm-chat-wizard");
  console.log("");
  console.log("  2️⃣  Manual Configuration");
  console.log("     Edit: ~/.openclaw/channels/ztm-chat.json");
  console.log("");
  console.log("  For documentation, see:");
  console.log("  https://github.com/flomesh-io/ztm/tree/main/extensions/ztm-chat");
  console.log("");
  console.log("  💡 Tip: Set CI=true to skip this message in CI/CD pipelines");
  console.log("");
  console.log("═".repeat(60));
}

// Check if wizard should run
function shouldRunWizard(): boolean {
  // Skip in CI/CD environments
  if (process.env.CI === "true") {
    return false;
  }

  // Skip if not a TTY (not interactive)
  if (!process.stdout.isTTY) {
    return false;
  }

  // Skip if already configured
  if (!isFirstInstall()) {
    return false;
  }

  return true;
}

const plugin: ChannelPlugin = {
  id: "ztm-chat",
  name: "ZTM Chat",
  description: "ZTM (Zero Trust Mesh) Chat channel plugin - Connect OpenClaw to the ZTM P2P network",
  configSchema: emptyPluginConfigSchema(),
  register(api: OpenClawPluginApi) {
    // Set runtime for the plugin
    setZTMRuntime(api.runtime);

    // Register the channel
    api.registerChannel({ plugin: ztmChatPlugin });

    // Check for first-time installation
    if (shouldRunWizard()) {
      showFirstTimeBanner();

      // Suggest running the wizard
      api.logger?.info("ZTM Chat first-time setup detected");
      api.logger?.info("Run 'npx ztm-chat-wizard' to configure");
    }
  },

  // CLI commands exposed by this plugin
  commands: [
    {
      name: "ztm-chat-wizard",
      description: "Run the ZTM Chat interactive setup wizard",
      alias: "ztm-wizard",
      action: async () => {
        const { runWizard } = await import("./src/wizard.js");
        const result = await runWizard();
        if (result) {
          console.log("\n✅ Configuration complete!");
          console.log(`📁 Saved to: ${result.savePath || "memory only"}`);
          console.log("\nNext steps:");
          console.log("  1. Restart OpenClaw: openclaw restart");
          console.log("  2. Check status: openclaw channels status ztm-chat");
        }
      },
    },
    {
      name: "ztm-chat-discover",
      description: "Auto-discover ZTM configuration from existing setup",
      alias: "ztm-discover",
      action: async () => {
        const { discoverConfig } = await import("./src/wizard.js");
        const discovered = await discoverConfig();
        if (discovered) {
          console.log("\n📡 Discovered ZTM Configuration:");
          console.log(`   Agent URL: ${discovered.agentUrl}`);
          console.log(`   Mesh: ${discovered.meshName}`);
          console.log(`   Username: ${discovered.username}`);
          console.log("\n💡 To use this configuration, run: npx ztm-chat-wizard");
        } else {
          console.log("\n⚠️  No existing ZTM configuration found.");
          console.log("   Run 'npx ztm-chat-wizard' to set up.");
        }
      },
    },
  ],
};

export default plugin;
