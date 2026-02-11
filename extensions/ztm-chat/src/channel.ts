// ZTM Chat Channel Adapter for OpenClaw
// Implements ChannelPlugin interface with multi-account support

import * as fs from "fs";
import * as path from "node:path";
import { type TSchema } from "@sinclair/typebox";
import type {
  buildChannelConfigSchema,
  ChannelPlugin,
  ChannelStatusIssue as BaseChannelStatusIssue,
  ChannelAccountSnapshot as BaseChannelAccountSnapshot,
  OpenClawConfig,
} from "openclaw/plugin-sdk";
import { getZTMRuntime } from "./runtime.js";

// Import from refactored modules
import {
  resolveZTMChatConfig,
  validateZTMChatConfig,
  ZTMChatConfigSchema,
  type ZTMChatConfig,
  isConfigMinimallyValid,
  getDefaultConfig,
  mergeAccountConfig,
} from './config/index.js';
import {
  createZTMApiClient,
  type ZTMMeshInfo,
  type ZTMMessage,
} from "./api/ztm-api.js";
import { isSuccess } from "./types/common.js";
import { logger } from "./utils/logger.js";
import { getMessageStateStore, disposeMessageStateStore } from "./runtime/store.js";
import {
  getOrCreateAccountState,
  removeAccountState,
  getAllAccountStates,
  initializeRuntime,
  stopRuntime,
} from "./runtime/state.js";
import {
  startMessageWatcher,
  processIncomingMessage,
  notifyMessageCallbacks,
  checkDmPolicy,
  type ZTMChatMessage,
} from "./messaging/inbound.js";
import { sendZTMMessage, generateMessageId } from "./messaging/outbound.js";
import { checkPortOpen, getPublicKeyFromIdentity, joinMesh } from "./connectivity/mesh.js";
import { requestPermit, savePermitData, handlePairingRequest } from "./connectivity/permit.js";

// Local type extension for ChannelStatusIssue with level property
interface ChannelStatusIssue extends BaseChannelStatusIssue {
  level?: "error" | "warn" | "info";
  message: string;
}

// Local type extension for ChannelAccountSnapshot with additional properties
interface ChannelAccountSnapshot extends BaseChannelAccountSnapshot {
  meshConnected?: boolean;
  peerCount?: number;
}

// Local type for resolved ZTM chat account
export interface ResolvedZTMChatAccount {
  accountId: string;
  username: string;
  enabled: boolean;
  config: ZTMChatConfig;
}

// Meta information for the channel
const meta = {
  id: "ztm-chat",
  label: "ZTM Chat",
  selectionLabel: "ZTM Chat (P2P)",
  docsPath: "/channels/ztm-chat",
  blurb: "Decentralized P2P messaging via ZTM (Zero Trust Mesh) network",
  aliases: ["ztm", "ztmp2p"],
  preferOver: undefined,
  detailLabel: undefined,
  systemImage: undefined,
};

// Build channel config schema with UI hints
function buildChannelConfigSchemaWithHints(
  _schema: TSchema
) {
  return {
    schema: {},
    parse(value: unknown) {
      return resolveZTMChatConfig(value);
    },
    uiHints: {
      agentUrl: {
        label: "ZTM Agent URL",
        placeholder: "https://ztm-agent.example.com:7777",
        help: "URL of your ZTM Agent API server",
        required: true,
        validation: {
          pattern: "^https?://",
          message: "Must start with http:// or https://",
        },
      },
      meshName: {
        label: "Mesh Name",
        placeholder: "my-mesh",
        help: "Name of your ZTM mesh network",
        required: true,
        validation: {
          pattern: "^[a-zA-Z0-9_-]+$",
          message: "Only letters, numbers, hyphens, and underscores",
        },
      },
      username: {
        label: "Bot Username",
        placeholder: "openclaw-bot",
        help: "Username for the bot account in ZTM",
        required: true,
        validation: {
          pattern: "^[a-zA-Z0-9_-]+$",
          message: "Only letters, numbers, hyphens, and underscores",
        },
      },
      enableGroups: {
        label: "Enable Groups",
        help: "Enable group chat support (future feature)",
        advanced: true,
      },
      autoReply: {
        label: "Auto Reply",
        help: "Automatically reply to messages using AI agent",
        default: true,
      },
      messagePath: {
        label: "Message Path",
        help: "Custom message path prefix (advanced)",
        placeholder: "/shared",
        advanced: true,
      },
    },
  };
}

// Read channel config from external file (~/.openclaw/ztm/config.json)
function readExternalChannelConfig(): Record<string, unknown> | null {
  try {
    const configPath = path.join(
      process.env.HOME || "",
      ".openclaw",
      "ztm",
      "config.json",
    );
    if (fs.existsSync(configPath)) {
      const content = fs.readFileSync(configPath, "utf-8");
      return JSON.parse(content);
    }
  } catch {
    // Ignore read/parse errors
  }
  return null;
}

// Get effective channel config: cfg.channels["ztm-chat"] or external file fallback
function getEffectiveChannelConfig(cfg?: OpenClawConfig): Record<string, unknown> | null {
  const inlineConfig = (cfg?.channels?.["ztm-chat"] as Record<string, unknown>);
  if (inlineConfig && typeof inlineConfig === "object" && Object.keys(inlineConfig).length > 0) {
    return inlineConfig;
  }
  return readExternalChannelConfig();
}

// Account ID resolution helpers
function listZTMChatAccountIds(cfg?: OpenClawConfig): string[] {
  const channelConfig = getEffectiveChannelConfig(cfg);
  const accounts = channelConfig?.accounts as Record<string, unknown> | undefined;
  if (accounts && typeof accounts === "object") {
    const ids = Object.keys(accounts);
    if (ids.length > 0) return ids;
  }
  // Fallback: return ["default"] so the channel appears in channels status
  return ["default"];
}

function resolveZTMChatAccount({
  cfg,
  accountId,
}: {
  cfg?: OpenClawConfig;
  accountId?: string;
}): ResolvedZTMChatAccount {
  const channelConfig = getEffectiveChannelConfig(cfg);
  const accountKey = accountId ?? "default";

  if (!channelConfig) {
    return {
      accountId: accountKey,
      username: "",
      enabled: false,
      config: getDefaultConfig(),
    };
  }

  const accounts = channelConfig.accounts as Record<string, unknown> | undefined;
  const account = (accounts?.[accountKey] ?? accounts?.default ?? {}) as Record<string, unknown>;

  // Merge base config with account-level overrides (account takes precedence)
  const merged = mergeAccountConfig(channelConfig, account);

  const config = resolveZTMChatConfig(merged);

  return {
    accountId: accountKey,
    username: (merged.username as string) ?? accountKey,
    enabled: (merged.enabled as boolean) ?? (channelConfig.enabled as boolean) ?? true,
    config,
  };
}

// Export dispose function for plugin cleanup
export { disposeMessageStateStore };

// Channel plugin definition
export const ztmChatPlugin: ChannelPlugin<ResolvedZTMChatAccount> = {
  id: "ztm-chat",
  meta: {
    id: meta.id,
    label: meta.label,
    selectionLabel: meta.selectionLabel,
    docsPath: meta.docsPath,
    blurb: meta.blurb,
    aliases: [...meta.aliases], // Convert readonly array to mutable
    quickstartAllowFrom: true,
  },
  pairing: {
    idLabel: "username",
    normalizeAllowEntry: (entry) => entry.trim().toLowerCase(),
    notifyApproval: async ({ cfg, id }) => {
      const account = resolveZTMChatAccount({ cfg });
      const config = account.config as ZTMChatConfig;
      const apiClient = createZTMApiClient(config);
      const message: ZTMMessage = {
        time: Date.now(),
        message: `✅ Pairing approved! You can now send messages to this bot.`,
        sender: config.username,
      };
      const result = await apiClient.sendPeerMessage(id, message);
      if (!result.ok) {
        logger.warn?.(`[ZTM] Failed to send pairing approval message to ${id}: ${result.error?.message}`);
      }
    },
  },
  capabilities: {
    chatTypes: ["direct"],
    reactions: false,
    threads: false,
    media: false,
    nativeCommands: false,
    blockStreaming: true,
  },
  reload: { configPrefixes: ["channels.ztm-chat"] },
  configSchema: buildChannelConfigSchemaWithHints(ZTMChatConfigSchema),
  config: {
    listAccountIds: (cfg) => listZTMChatAccountIds(cfg),
    resolveAccount: (cfg, accountId) =>
      resolveZTMChatAccount({ cfg, accountId }),
    defaultAccountId: (cfg) =>
      listZTMChatAccountIds(cfg)[0] ?? "default",
    isConfigured: (account) => isConfigMinimallyValid(account.config as ZTMChatConfig),
    describeAccount: (account) => ({
      accountId: account.accountId,
      name: account.username,
      enabled: account.enabled,
      configured: isConfigMinimallyValid(account.config as ZTMChatConfig),
      agentUrl: (account.config as ZTMChatConfig)?.agentUrl,
      meshName: (account.config as ZTMChatConfig)?.meshName,
    }),
    resolveAllowFrom: ({ cfg, accountId }) => {
      const account = resolveZTMChatAccount({ cfg, accountId });
      return ((account.config as ZTMChatConfig)?.allowFrom ?? []).map((entry) =>
        String(entry)
      );
    },
    formatAllowFrom: ({ allowFrom }) =>
      (allowFrom ?? [])
        .map((entry) => String(entry).trim())
        .filter(Boolean)
        .map((entry) => entry.toLowerCase()),
  },
  security: {
    resolveDmPolicy: ({ cfg, accountId, account }) => {
      const resolvedAccountId = accountId ?? account.accountId ?? "default";
      const config = account.config as ZTMChatConfig;
      const channelsConfig = (cfg || {}) as { channels?: { "ztm-chat"?: { accounts?: Record<string, unknown> } } };
      const useAccountPath = Boolean(
        channelsConfig.channels?.["ztm-chat"]?.accounts?.[resolvedAccountId]
      );
      const basePath = useAccountPath
        ? `channels.ztm-chat.accounts.${resolvedAccountId}.`
        : "channels.ztm-chat.";

      return {
        policy: config?.dmPolicy ?? "pairing",
        allowFrom: config?.allowFrom ?? [],
        policyPath: `${basePath}dmPolicy`,
        allowFromPath: `${basePath}allowFrom`,
        approveHint: undefined,
        normalizeEntry: (raw) => raw.trim().toLowerCase(),
      };
    },
    collectWarnings: async ({ cfg, accountId }) => {
      const warnings: string[] = [];
      const account = resolveZTMChatAccount({ cfg, accountId });
      const config = account.config as ZTMChatConfig;

      const allowFrom = config?.allowFrom ?? [];
      if (!allowFrom.length) {
        warnings.push(
          "No allowFrom configured - accepting messages from any ZTM user"
        );
      }

      // Try to probe the connection
      try {
        const probeConfig = resolveZTMChatConfig(config);
        const apiClient = createZTMApiClient(probeConfig);
        const meshResult = await apiClient.getMeshInfo();

        if (!meshResult.ok) {
          // Silently ignore probe errors - don't add to warnings
          return warnings;
        }

        const meshInfo = meshResult.value;
        if (!meshInfo.connected) {
          warnings.push("ZTM Agent is not connected to the mesh network");
        }
        if (meshInfo.errors && meshInfo.errors.length > 0) {
          warnings.push(
            `ZTM Agent has ${meshInfo.errors.length} error(s): ${meshInfo.errors[0].message}`
          );
        }
      } catch {
        // Silently ignore probe errors
      }

      return warnings;
    },
  },
  groups: {
    resolveRequireMention: () => false,
    resolveToolPolicy: () => ({ allow: ["ztm-chat"] }),
  },
  messaging: {
    normalizeTarget: (target) => target.trim().toLowerCase(),
    targetResolver: {
      looksLikeId: (target) => Boolean(target && target.length > 0),
      hint: "<username>",
    },
  },
  outbound: {
    deliveryMode: "direct",
    sendText: async ({ to, text, accountId }) => {
      const accountKey = accountId ?? "default";
      const accountStates = getAllAccountStates();
      const state = accountStates.get(accountKey);

      if (!state) {
        return {
          channel: "ztm-chat",
          ok: false,
          error: "Account not initialized",
          messageId: "",
        };
      }

      const peer = to.replace(/^ztm-chat:/, "");
      const result = await sendZTMMessage(state, peer, text);

      return {
        channel: "ztm-chat",
        ok: result.ok,
        messageId: result.ok ? generateMessageId() : "",
        error: result.ok ? undefined : result.error?.message ?? state.lastError,
      };
    },
  },
  status: {
    defaultRuntime: {
      accountId: "default",
      running: false,
      connected: false,
      meshConnected: false,
      lastStartAt: null,
      lastStopAt: null,
      lastError: null,
      lastInboundAt: null,
      lastOutboundAt: null,
      peerCount: 0,
    } as ChannelAccountSnapshot,
    collectStatusIssues: (accounts: ChannelAccountSnapshot[]): ChannelStatusIssue[] => {
      // Extract cfg and accountId from the accounts array context
      const snapshot = accounts[0];
      const cfg = (snapshot as ChannelAccountSnapshot & { cfg?: OpenClawConfig }).cfg;
      const accountId = snapshot?.accountId;

      const issues: ChannelStatusIssue[] = [];
      const account = resolveZTMChatAccount({ cfg, accountId });
      const config = account.config as ZTMChatConfig;

      // Check config validity
      if (!isConfigMinimallyValid(config)) {
        issues.push({
          channel: "ztm-chat",
          accountId: accountId || "default",
          kind: "config",
          level: "error",
          message: "Missing required configuration (agentUrl or username)",
        });
        return issues;
      }

      return issues;
    },
    buildChannelSummary: ({ snapshot }) => {
      const extendedSnapshot = snapshot as ChannelAccountSnapshot;
      return {
        configured: snapshot.configured ?? false,
        running: snapshot.running ?? false,
        connected: extendedSnapshot.meshConnected ?? false,
        lastStartAt: snapshot.lastStartAt ?? null,
        lastStopAt: snapshot.lastStopAt ?? null,
        lastError: snapshot.lastError ?? null,
        lastInboundAt: snapshot.lastInboundAt ?? null,
        lastOutboundAt: snapshot.lastOutboundAt ?? null,
        peerCount: extendedSnapshot.peerCount ?? 0,
      };
    },
    probeAccount: async ({ account, timeoutMs = 10000 }) => {
      const config = account.config as ZTMChatConfig;

      if (!config?.agentUrl) {
        return {
          ok: false,
          error: "No agent URL configured",
        };
      }

      const probeConfig = resolveZTMChatConfig(config);
      const apiClient = createZTMApiClient(probeConfig);
      const meshResult = await apiClient.getMeshInfo();

      if (!meshResult.ok) {
        return {
          ok: false,
          error: meshResult.error.message,
        };
      }

      const meshInfo = meshResult.value;
      return {
        ok: meshInfo.connected,
        error: meshInfo.connected
          ? null
          : "ZTM Agent is not connected to mesh",
        meshInfo,
      };
    },
    buildAccountSnapshot: ({ account }) => {
      const accountStates = getAllAccountStates();
      const state = accountStates.get(account.accountId);

      return {
        accountId: account.accountId,
        name: account.username,
        enabled: account.enabled,
        configured: isConfigMinimallyValid(account.config as ZTMChatConfig),
        running: state?.connected ?? false,
        connected: state?.meshConnected ?? false,
        meshConnected: state?.meshConnected ?? false,
        lastStartAt: state?.lastStartAt ? Number(state.lastStartAt) : null,
        lastStopAt: state?.lastStopAt ? Number(state.lastStopAt) : null,
        lastError: state?.lastError ?? null,
        lastInboundAt: state?.lastInboundAt ? Number(state.lastInboundAt) : null,
        lastOutboundAt: state?.lastOutboundAt ? Number(state.lastOutboundAt) : null,
        peerCount: state?.peerCount ?? 0,
      };
    },
  },
  directory: {
    self: async ({ cfg, accountId }) => {
      const account = resolveZTMChatAccount({ cfg, accountId });
      const config = account.config as ZTMChatConfig;
      return {
        kind: "user" as const,
        id: account.username,
        name: account.username,
        raw: {
          username: account.username,
          meshName: config?.meshName,
        },
      };
    },
    listPeers: async ({ cfg, accountId }) => {
      const account = resolveZTMChatAccount({ cfg, accountId });
      const config = account.config as ZTMChatConfig;
      const apiClient = createZTMApiClient(resolveZTMChatConfig(config));

      const usersResult = await apiClient.discoverUsers();
      if (!usersResult.ok) {
        logger.warn?.(`Failed to list peers: ${usersResult.error.message}`);
        return [];
      }

      return usersResult.value.map((user) => ({
        kind: "user" as const,
        id: user.username,
        name: user.username,
        raw: user,
      }));
    },
    listGroups: async () => {
      // Group chat support is future feature
      return [];
    },
  },
  gateway: {
    startAccount: async (ctx) => {
      const account = ctx.account;
      const config = resolveZTMChatConfig(account.config);
      const validation = validateZTMChatConfig(config);

      if (!validation.valid) {
        throw new Error(validation.errors.join("; "));
      }

      const homeDir = process.env.HOME || "";
      const permitPath = path.join(homeDir, ".openclaw", "ztm", "permit.json");
      const endpointName = `${config.username}-ep`;

      // Step 1: Validate connectivity for agent URL
      try {
        const agentUrlObj = new URL(config.agentUrl);
        const portStr = agentUrlObj.port || (agentUrlObj.protocol === "https:" ? "443" : "80");
        const agentPort = parseInt(portStr, 10);
        const agentConnected = await checkPortOpen(agentUrlObj.hostname, agentPort);
        if (!agentConnected) {
          throw new Error(`Cannot connect to ZTM agent at ${config.agentUrl}`);
        }
      } catch (error) {
        if (error instanceof Error && error.message.includes("Cannot connect")) {
          throw error;
        }
        throw new Error(`Invalid ZTM agent URL: ${config.agentUrl}`);
      }

      // Step 2: Check if permit.json exists
      const permitExists = fs.existsSync(permitPath);

      if (!permitExists) {
        // Step 3: Get public key from ztm identity
        ctx.log?.info("Getting public key from ztm identity...");
        const publicKey = await getPublicKeyFromIdentity();
        if (!publicKey) {
          throw new Error("Failed to get public key from ztm identity");
        }

        // Step 4: Request permit from permit server
        ctx.log?.info("Requesting permit from permit server...");
        const permitData = await requestPermit(
          config.permitUrl,
          publicKey,
          config.username
        );

        if (!permitData) {
          throw new Error("Failed to request permit from permit server");
        }

        // Step 5: Save permit data
        if (!savePermitData(permitData, permitPath)) {
          throw new Error("Failed to save permit data");
        }
      }

      // Step 6: Join mesh (skip if already connected)
      const preCheckClient = createZTMApiClient(config);
      let alreadyConnected = false;
      const preCheckResult = await preCheckClient.getMeshInfo();
      if (isSuccess(preCheckResult)) {
        alreadyConnected = preCheckResult.value.connected;
      }

      if (alreadyConnected) {
        ctx.log?.info(`Already connected to mesh ${config.meshName}, skipping join`);
      } else {
        ctx.log?.info(`Joining mesh ${config.meshName} as ${endpointName}...`);
        const joinSuccess = await joinMesh(config.meshName, endpointName, permitPath);
        if (!joinSuccess) {
          throw new Error("Failed to join mesh");
        }
      }

      // Step 7: Initialize runtime (original flow)
      const initialized = await initializeRuntime(config, account.accountId);

      if (!initialized) {
        const accountStates = getAllAccountStates();
        const state = accountStates.get(account.accountId);
        throw new Error(state?.lastError ?? "Failed to initialize ZTM connection");
      }

      const accountStates = getAllAccountStates();
      const state = accountStates.get(account.accountId)!;
      state.lastStartAt = new Date();

      const rt = getZTMRuntime();
      const cfg = ctx.cfg;

      ctx.log?.info(
        `[${account.accountId}] Connected to ZTM mesh "${config.meshName}" as ${config.username}`
      );

      if (config.dmPolicy === "pairing") {
        const allowFrom = config.allowFrom ?? [];
        if (allowFrom.length === 0) {
          ctx.log?.info(
            `[${account.accountId}] Pairing mode active - no approved users. ` +
            `Users must send a message to initiate pairing. ` +
            `Approve users with: openclaw pairing approve ztm-chat <username>`
          );
        } else {
          ctx.log?.info(
            `[${account.accountId}] Pairing mode active - ${allowFrom.length} approved user(s)`
          );
        }
      }

      // Dispatch inbound messages to the AI agent via OpenClaw's reply pipeline
      const messageCallback = (msg: ZTMChatMessage) => {
        const handleInbound = async (): Promise<void> => {
          try {
            const route = rt.channel.routing.resolveAgentRoute({
              channel: "ztm-chat",
              accountId: account.accountId,
              peer: { kind: "dm", id: msg.sender },
              cfg,
            });

            const ctxPayload = rt.channel.reply.finalizeInboundContext({
              Body: msg.content,
              RawBody: msg.content,
              CommandBody: msg.content,
              From: `ztm-chat:${msg.sender}`,
              To: `ztm-chat:${config.username}`,
              SessionKey: route.sessionKey,
              AccountId: route.accountId,
              ChatType: "direct" as const,
              ConversationLabel: msg.sender,
              SenderName: msg.sender,
              SenderId: msg.sender,
              Provider: "ztm-chat",
              Surface: "ztm-chat",
              MessageSid: msg.id,
              Timestamp: msg.timestamp,
              OriginatingChannel: "ztm-chat",
              OriginatingTo: `ztm-chat:${msg.sender}`,
            });

            ctx.log?.info(
              `[${account.accountId}] Dispatching message from ${msg.sender} to AI agent (route: ${route.matchedBy})`
            );

            const { queuedFinal } = await rt.channel.reply.dispatchReplyWithBufferedBlockDispatcher({
              ctx: ctxPayload,
              cfg,
              dispatcherOptions: {
                humanDelay: rt.channel.reply.resolveHumanDelayConfig(cfg, route.agentId),
                deliver: async (payload: { text?: string; mediaUrl?: string }) => {
                  const replyText = payload.text ?? "";
                  if (!replyText) return;
                  await sendZTMMessage(state, msg.sender, replyText);
                },
                onError: (err: unknown) => {
                  ctx.log?.error?.(
                    `[${account.accountId}] Reply delivery failed for ${msg.sender}: ${String(err)}`
                  );
                },
              },
            });

            if (!queuedFinal) {
              ctx.log?.info(
                `[${account.accountId}] No response generated for message from ${msg.sender}`
              );
            }
          } catch (error) {
            ctx.log?.error?.(
              `[${account.accountId}] Failed to dispatch message from ${msg.sender}: ${String(error)}`
            );
            throw error;
          }
        };

        // Handle inbound asynchronously, errors are logged and will be caught by global handler
        void handleInbound();
      };

      state.messageCallbacks.add(messageCallback);
      await startMessageWatcher(state);

      return async () => {
        state.messageCallbacks.delete(messageCallback);
        await stopRuntime(account.accountId);
      };
    },
    logoutAccount: async ({ accountId, cfg }) => {
      await stopRuntime(accountId);
      removeAccountState(accountId);
      return { cleared: true };
    },
  },
};
