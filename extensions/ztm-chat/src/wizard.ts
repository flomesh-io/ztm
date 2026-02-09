// ZTM Chat Onboarding Wizard
// Interactive CLI wizard for configuring the ZTM Chat channel

import * as readline from "readline";
import * as fs from "fs";
import * as path from "path";
import type { ZTMChatConfig, DMPolicy } from "./config.js";

// Extended config with wizard-specific fields
interface WizardConfig extends Partial<ZTMChatConfig> {
  messagePath?: string;
  enableGroups?: boolean;
  autoReply?: boolean;
  allowFrom?: string[];
  dmPolicy?: DMPolicy;
  permitUrl?: string;
}

/**
 * Interactive prompts for user input
 */
export interface WizardPrompts {
  ask(question: string, defaultValue?: string): Promise<string>;
  confirm(question: string, defaultYes?: boolean): Promise<boolean>;
  select<T>(question: string, options: readonly T[], labels: string[]): Promise<T>;
  password(question: string): Promise<string>;
  separator(): void;
  heading(text: string): void;
  success(text: string): void;
  info(text: string): void;
  warning(text: string): void;
  error(text: string): void;
  close(): void;
}

/**
 * Console-based prompts implementation
 */
export class ConsolePrompts implements WizardPrompts {
  private rl: readline.Interface;

  constructor() {
    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });
  }

  close(): void {
    this.rl.close();
  }

  private async _ask(question: string, defaultValue?: string, isPassword = false): Promise<string> {
    const prompt = defaultValue
      ? `${question} [${defaultValue}]: `
      : `${question}: `;

    return new Promise((resolve, reject) => {
      this.rl.question(prompt, (answer) => {
        if (answer.trim() === "") {
          resolve(defaultValue || "");
        } else {
          resolve(isPassword ? answer : answer.trim());
        }
      });
    });
  }

  async ask(question: string, defaultValue?: string): Promise<string> {
    return this._ask(question, defaultValue, false);
  }

  async password(question: string): Promise<string> {
    return this._ask(question, undefined, true);
  }

  async confirm(question: string, defaultYes = false): Promise<boolean> {
    const suffix = defaultYes ? " (Y/n): " : " (y/N): ";
    const answer = await this._ask(question + suffix, defaultYes ? "y" : "n");
    return answer.toLowerCase().startsWith("y");
  }

  async select<T>(question: string, options: readonly T[], labels: string[]): Promise<T> {
    this.separator();
    this.heading(question);

    for (let i = 0; i < options.length; i++) {
      console.log(`  [${i + 1}] ${labels[i] || String(options[i])}`);
    }
    console.log("  [0] Cancel");

    const answer = await this._ask("Select", "1");

    const index = parseInt(answer, 10) - 1;
    if (index === -1) {
      throw new Error("Cancelled");
    }
    if (index < 0 || index >= options.length) {
      throw new Error("Invalid selection");
    }

    return options[index];
  }

  separator(): void {
    console.log("");
  }

  heading(text: string): void {
    console.log(`\x1b[1m${text}\x1b[0m`);
  }

  success(text: string): void {
    console.log(`\x1b[32m✓\x1b[0m ${text}`);
  }

  warning(text: string): void {
    console.log(`\x1b[33m⚠\x1b[0m ${text}`);
  }

  error(text: string): void {
    console.log(`\x1b[31m✗\x1b[0m ${text}`);
  }

  info(text: string): void {
    console.log(`\x1b[36mℹ\x1b[0m ${text}`);
  }
}

/**
 * Wizard result configuration
 */
export interface WizardResult {
  config: ZTMChatConfig & { allowFrom?: string[] };
  accountId: string;
  savePath?: string;
}

/**
 * ZTM Chat Onboarding Wizard
 */
export class ZTMChatWizard {
  private prompts: WizardPrompts;
  private config: WizardConfig;

  constructor(prompts?: WizardPrompts) {
    this.prompts = prompts || new ConsolePrompts();
    this.config = {
      messagePath: "/shared",
      enableGroups: false,
      autoReply: true,
      allowFrom: undefined,
      dmPolicy: "pairing",
      permitUrl: "https://ztm-portal.flomesh.io:7779/permit",
    };
  }

  /**
   * Run the complete onboarding wizard
   */
  async run(): Promise<WizardResult | null> {
    try {
      this.prompts.separator();
      this.prompts.heading("🤖 ZTM Chat Setup Wizard");
      this.prompts.heading("=".repeat(40));
      this.prompts.separator();

      // Step 1: Agent URL
      await this.stepAgentUrl();

      // Step 2: Permit Server URL
      await this.stepPermitServer();

      // Step 3: User Selection
      await this.stepUserSelection();

      // Step 4: Security Settings
      await this.stepSecuritySettings();

      // Step 5: Summary
      const result = await this.summary();

      this.prompts.close();
      return result;
    } catch (error) {
      if (error instanceof Error && error.message === "Cancelled") {
        this.prompts.warning("Wizard cancelled.");
      } else {
        this.prompts.error(`Wizard failed: ${error}`);
      }
      this.prompts.close();
      return null;
    }
  }

  /**
   * Step 1: Configure Agent URL
   */
  private async stepAgentUrl(): Promise<void> {
    this.prompts.heading("Step 1: ZTM Agent URL (Required)");
    this.prompts.separator();

    const agentUrl = await this.prompts.ask(
      "ZTM Agent URL",
      "http://localhost:7777"
    );

    // Validate URL format (only format, not connectivity - that's handled by gateway lifecycle)
    try {
      new URL(agentUrl);
      this.config.agentUrl = agentUrl;
      this.prompts.success(`URL validated: ${agentUrl}`);
    } catch {
      this.prompts.error(`Invalid URL format: ${agentUrl}`);
      throw new Error("Invalid URL format");
    }
  }

  /**
   * Step 2: Permit Server URL
   */
  private async stepPermitServer(): Promise<void> {
    this.prompts.separator();
    this.prompts.heading("Step 2: Permit Server URL (Required)");
    this.prompts.separator();

    const permitUrl = await this.prompts.ask(
      "Permit Server URL",
      "https://ztm-portal.flomesh.io:7779/permit"
    );

    // Validate URL format (only format, not connectivity - that's handled by gateway lifecycle)
    try {
      new URL(permitUrl);
      this.config.permitUrl = permitUrl;
      this.prompts.success(`URL validated: ${permitUrl}`);
    } catch {
      this.prompts.error(`Invalid URL format: ${permitUrl}`);
      throw new Error("Invalid URL format");
    }
  }

  /**
   * Step 3: Select Bot Username
   */
  private async stepUserSelection(): Promise<void> {
    this.prompts.separator();
    this.prompts.heading("Step 2: Bot Username (Required)");
    this.prompts.separator();

    const username = await this.prompts.ask(
      "Bot username",
      "openclaw-bot"
    );

    if (!username.trim()) {
      this.prompts.error("Username is required");
      throw new Error("Username is required");
    }

    // Validate username format
    if (!/^[a-zA-Z0-9_-]+$/.test(username)) {
      this.prompts.error(
        "Username must contain only letters, numbers, hyphens, and underscores"
      );
      throw new Error("Invalid username format");
    }

    this.config.username = username;
    this.prompts.success(`Bot username configured: ${username}`);
  }

  /**
   * Step 4: Security Settings
   */
  private async stepSecuritySettings(): Promise<void> {
    this.prompts.separator();
    this.prompts.heading("Step 4: Security Settings");
    this.prompts.separator();

    // DM Policy - pairing is the default
    const policies = ["pairing", "allow", "deny"] as const;
    const policyLabels = [
      "Require explicit pairing (approval needed)",
      "Allow messages from all users",
      "Deny messages from all users",
    ];

    const policy = await this.prompts.select<DMPolicy>(
      "Direct Message Policy",
      policies,
      policyLabels
    );

    this.config.dmPolicy = policy;
    this.prompts.success(`DM Policy set to: ${policy}`);

    // Allow list (only used if policy is deny or pairing, or for whitelisting)
    const allowFrom = await this.prompts.ask(
      "Allow messages from (comma-separated usernames, * for all users)",
      "*"
    );

    if (allowFrom !== "*") {
      this.config.allowFrom = allowFrom
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
    }
  }

  /**
   * Step 5: Summary and Save
   */
  private async summary(): Promise<WizardResult> {
    this.prompts.separator();
    this.prompts.heading("Configuration Summary");
    this.prompts.separator();

    console.log("  Agent URL:", this.config.agentUrl);
    console.log("  Permit Server URL:", this.config.permitUrl);
    console.log("  Username:", this.config.username);
    console.log("  Message Path:", this.config.messagePath);
    console.log("  Auto Reply:", this.config.autoReply);
    console.log("  DM Policy:", this.config.dmPolicy);
    console.log("  Allow From:", this.config.allowFrom?.join(", ") || "* (all users)");

    this.prompts.separator();

    const save = await this.prompts.confirm(
      "Save this configuration?",
      true
    );

    let savePath: string | undefined;
    if (save) {
      const defaultPath = path.join(
        process.env.HOME || "",
        ".openclaw",
        "channels",
        "ztm-chat.json"
      );

      savePath = await this.prompts.ask(
        "Save to file",
        defaultPath
      );

      try {
        const config = this.buildConfig();
        const dir = path.dirname(savePath);
        if (!fs.existsSync(dir)) {
          fs.mkdirSync(dir, { recursive: true });
        }
        fs.writeFileSync(savePath, JSON.stringify(config, null, 2));
        this.prompts.success(`Configuration saved to ${savePath}`);

        // Show pairing mode info
        if (this.config.dmPolicy === "pairing") {
          this.prompts.separator();
          this.prompts.heading("🔒 Pairing Mode Enabled");
          this.prompts.warning("Your bot is in pairing mode.");
          this.prompts.info("To allow users to message you:");
          console.log("   1. Users send a message to your bot");
          this.prompts.info("   2. The bot will send them a pairing request");
          console.log("   3. You approve them: openclaw channels approve ztm-chat <username>");
          this.prompts.info("   4. After approval, their messages will be accepted");
        }
      } catch (error) {
        this.prompts.error(`Failed to save: ${error}`);
      }
    }

    return {
      config: this.buildConfig(),
      accountId: this.config.username || "default",
      savePath,
    };
  }

  /**
   * Build final configuration object
   */
  private buildConfig(): ZTMChatConfig & { allowFrom?: string[] } {
    return {
      agentUrl: this.config.agentUrl || "http://localhost:7777",
      permitUrl: this.config.permitUrl || "https://ztm-portal.flomesh.io:7779/permit",
      meshName: this.config.meshName || "openclaw-mesh",
      username: this.config.username || "openclaw-bot",
      enableGroups: this.config.enableGroups ?? false,
      autoReply: this.config.autoReply ?? true,
      messagePath: this.config.messagePath || "/shared",
      dmPolicy: this.config.dmPolicy ?? "pairing",
      allowFrom: this.config.allowFrom,
    };
  }
}

/**
 * Create wizard and run it
 */
export async function runWizard(): Promise<WizardResult | null> {
  const wizard = new ZTMChatWizard();
  return wizard.run();
}

/**
 * Silent configuration discovery - auto-detect settings
 */
export interface DiscoveredConfig {
  agentUrl: string;
  meshName: string;
  username: string;
}

/**
 * Attempt to auto-discover ZTM configuration
 */
export async function discoverConfig(): Promise<DiscoveredConfig | null> {
  // Check environment variables
  const agentUrl = process.env.ZTM_AGENT_URL || "http://localhost:7777";

  // Try to read from existing config
  const configPaths = [
    path.join(process.env.HOME || "", ".ztm", "config.json"),
    path.join(process.env.HOME || "", ".openclaw", "channels", "ztm-chat.json"),
  ];

  for (const configPath of configPaths) {
    if (fs.existsSync(configPath)) {
      try {
        const content = fs.readFileSync(configPath, "utf-8");
        const config = JSON.parse(content);

        return {
          agentUrl: config.agentUrl || agentUrl,
          meshName: config.meshName || "",
          username: config.username || "",
        };
      } catch {
        // Ignore parse errors
      }
    }
  }

  return null;
}
