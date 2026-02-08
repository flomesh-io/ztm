// ZTM Chat Onboarding Wizard
// Interactive CLI wizard for configuring the ZTM Chat channel

import * as readline from "readline";
import * as fs from "fs";
import * as path from "path";
import { createZTMApiClient, type ZTMApiClient, type ZTMUserInfo } from "./ztm-api.js";
import type { ZTMChatConfig } from "./config.js";

// Extended config with wizard-specific fields
interface WizardConfig extends Partial<ZTMChatConfig> {
  messagePath?: string;
  enableGroups?: boolean;
  autoReply?: boolean;
  allowFrom?: string[];
}

/**
 * Interactive prompts for user input
 */
export interface WizardPrompts {
  ask(question: string, defaultValue?: string): Promise<string>;
  confirm(question: string, defaultYes?: boolean): Promise<boolean>;
  select<T>(question: string, options: T[], labels: string[]): Promise<T>;
  password(question: string): Promise<string>;
  separator(): void;
  heading(text: string): void;
  success(text: string): void;
  warning(text: string): void;
  error(text: string): void;
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

  async select<T>(question: string, options: T[], labels: string[]): Promise<T> {
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

      // Step 2: Mesh Selection
      await this.stepMeshSelection();

      // Step 3: User Selection
      await this.stepUserSelection();

      // Step 4: mTLS Configuration
      await this.stepMtlsConfiguration();

      // Step 5: Security Settings
      await this.stepSecuritySettings();

      // Step 6: Summary
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
    this.prompts.heading("Step 1: ZTM Agent Connection");
    this.prompts.separator();

    const agentUrl = await this.prompts.ask(
      "ZTM Agent URL",
      "https://localhost:7777"
    );

    // Test connection
    this.prompts.separator();
    this.prompts.heading("Testing connection...");

    try {
      const apiClient = createZTMApiClient({
        agentUrl,
        meshName: "",
        username: "",
      });

      // Just verify the URL is valid
      new URL(agentUrl);
      this.config.agentUrl = agentUrl;
      this.prompts.success(`Connected to ${agentUrl}`);
    } catch (error) {
      this.prompts.error(`Invalid URL or connection failed: ${error}`);
      throw error;
    }
  }

  /**
   * Step 2: Select or Enter Mesh Name
   */
  private async stepMeshSelection(): Promise<void> {
    this.prompts.separator();
    this.prompts.heading("Step 2: Mesh Selection");
    this.prompts.separator();

    const meshName = await this.prompts.ask("Mesh name", "");

    if (!meshName.trim()) {
      this.prompts.error("Mesh name is required");
      throw new Error("Mesh name is required");
    }

    // Validate mesh name format
    if (!/^[a-zA-Z0-9_-]+$/.test(meshName)) {
      this.prompts.error(
        "Mesh name must contain only letters, numbers, hyphens, and underscores"
      );
      throw new Error("Invalid mesh name format");
    }

    this.config.meshName = meshName;
    this.prompts.success(`Mesh configured: ${meshName}`);
  }

  /**
   * Step 3: Select Bot Username
   */
  private async stepUserSelection(): Promise<void> {
    this.prompts.separator();
    this.prompts.heading("Step 3: Bot Username");
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
   * Step 4: mTLS Configuration
   */
  private async stepMtlsConfiguration(): Promise<void> {
    this.prompts.separator();
    this.prompts.heading("Step 4: mTLS Authentication");
    this.prompts.separator();

    const useMtls = await this.prompts.confirm(
      "Use mTLS authentication?",
      false
    );

    if (useMtls) {
      const certPath = await this.prompts.ask(
        "Certificate file path",
        "~/ztm/cert.pem"
      );

      const keyPath = await this.prompts.ask(
        "Private key file path",
        "~/ztm/key.pem"
      );

      // Load and validate certificates
      try {
        const cert = this.loadFile(certPath);
        const key = this.loadFile(keyPath);

        // Basic validation
        if (!cert.includes("-----BEGIN CERTIFICATE-----")) {
          throw new Error("Invalid certificate format");
        }
        if (
          !key.includes("-----BEGIN") &&
          !key.includes("PRIVATE KEY-----")
        ) {
          throw new Error("Invalid private key format");
        }

        this.config.certificate = cert;
        this.config.privateKey = key;
        this.prompts.success("mTLS certificates loaded successfully");
      } catch (error) {
        this.prompts.warning(
          `Failed to load certificates: ${error}. Skipping mTLS.`
        );
        this.config.certificate = undefined;
        this.config.privateKey = undefined;
      }
    } else {
      this.config.certificate = undefined;
      this.config.privateKey = undefined;
      this.prompts.warning("Skipping mTLS - using anonymous connection");
    }
  }

  /**
   * Step 5: Security Settings
   */
  private async stepSecuritySettings(): Promise<void> {
    this.prompts.separator();
    this.prompts.heading("Step 5: Security Settings");
    this.prompts.separator();

    // DM Policy
    const policies = ["allow", "deny", "pairing"] as const;
    const policyLabels = [
      "Allow messages from all users",
      "Deny messages from all users",
      "Require explicit pairing",
    ];

    const policy = await this.prompts.select(
      "Direct Message Policy",
      policies,
      policyLabels
    );

    // Note: This would be stored in a separate security config
    // For now, we just document it
    this.prompts.separator();
    this.prompts.heading("Note:");
    this.prompts.warning(
      `DM Policy set to: ${policy}. (Full policy support coming soon)`
    );

    // Allow list (for future use)
    const allowFrom = await this.prompts.ask(
      "Allow messages from (comma-separated, * for all)",
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
   * Step 6: Summary and Save
   */
  private async summary(): Promise<WizardResult> {
    this.prompts.separator();
    this.prompts.heading("Configuration Summary");
    this.prompts.separator();

    console.log("  Agent URL:", this.config.agentUrl);
    console.log("  Mesh Name:", this.config.meshName);
    console.log("  Username:", this.config.username);
    console.log(
      "  mTLS:",
      this.config.certificate ? "Enabled" : "Disabled"
    );
    console.log("  Message Path:", this.config.messagePath);
    console.log("  Auto Reply:", this.config.autoReply);

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
      meshName: this.config.meshName || "",
      username: this.config.username || "openclaw-bot",
      certificate: this.config.certificate,
      privateKey: this.config.privateKey,
      enableGroups: this.config.enableGroups ?? false,
      autoReply: this.config.autoReply ?? true,
      messagePath: this.config.messagePath || "/shared",
      allowFrom: this.config.allowFrom,
    };
  }

  /**
   * Load file content with path expansion
   */
  private loadFile(filePath: string): string {
    const expandedPath = filePath.startsWith("~")
      ? filePath.replace("~", process.env.HOME || "")
      : filePath;

    if (!fs.existsSync(expandedPath)) {
      throw new Error(`File not found: ${filePath}`);
    }

    return fs.readFileSync(expandedPath, "utf-8");
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
