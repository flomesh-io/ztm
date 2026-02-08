// ZTM Chat Channel Adapter for OpenClaw
// Implements ChannelPlugin interface with multi-account support

import {
  buildChannelConfigSchema,
  type ChannelPlugin,
  type ChannelStatusIssue,
  type OpenClawConfig,
  type ResolvedZTMChatAccount,
} from "openclaw/plugin-sdk";
import { getZTMRuntime } from "./runtime.js";
import {
  resolveZTMChatConfig,
  validateZTMChatConfig,
  ZTMChatConfigSchema,
  type ZTMChatConfig,
  isConfigMinimallyValid,
} from "./config.js";
import {
  createZTMApiClient,
  buildPeerMessagePath,
  type ZTMApiClient,
  type ZTMMeshInfo,
  type ZTMMessage,
  type ZTMUserInfo,
} from "./ztm-api.js";

// Import logger
import { logger } from "./logger.js";

// Local type definition for ZTM chat messages (normalized)
interface ZTMChatMessage {
  id: string;
  content: string;
  sender: string;
  senderId: string;
  timestamp: Date;
  peer: string;
  thread?: string;
}

// Runtime state per account
interface AccountRuntimeState {
  accountId: string;
  config: ZTMChatConfig;
  apiClient: ZTMApiClient | null;
  connected: boolean;
  meshConnected: boolean;
  lastError: string | null;
  lastStartAt: Date | null;
  lastStopAt: Date | null;
  lastInboundAt: Date | null;
  lastOutboundAt: Date | null;
  peerCount: number;
  messageCallbacks: Set<(message: ZTMChatMessage) => void>;
  watchInterval: ReturnType<typeof setInterval> | null;
  watchErrorCount: number;
}

// Multi-account state management
const accountStates = new Map<string, AccountRuntimeState>();

// Meta information for the channel
const meta = {
  id: "ztm-chat" as const,
  label: "ZTM Chat",
  selectionLabel: "ZTM Chat (P2P)",
  docsPath: "/channels/ztm-chat",
  blurb: "Decentralized P2P messaging via ZTM (Zero Trust Mesh) network",
  aliases: ["ztm", "ztmp2p"] as const,
  preferOver: undefined as const | undefined,
  detailLabel: undefined as const | undefined,
  systemImage: undefined as const | undefined,
};

// Message deduplication with LRU-like behavior
interface DedupeEntry {
  sender: string;
  time: number;
  contentHash: string;
}

class MessageDeduplicator {
  private cache: Map<string, DedupeEntry>;
  private maxSize: number;
  private trimRatio: number;

  constructor(maxSize: number = 10000, trimRatio: number = 0.5) {
    this.cache = new Map();
    this.maxSize = maxSize;
    this.trimRatio = trimRatio;
  }

  private generateKey(sender: string, time: number, content: string): string {
    return `${sender}-${time}-${content.substring(0, 32)}`;
  }

  isDuplicate(sender: string, time: number, content: string): boolean {
    const key = this.generateKey(sender, time, content);

    if (this.cache.has(key)) {
      return true;
    }

    // Add new entry
    this.cache.set(key, { sender, time, contentHash: content });
    this.trimIfNeeded();
    return false;
  }

  private trimIfNeeded(): void {
    if (this.cache.size <= this.maxSize) return;

    const targetSize = Math.floor(this.maxSize * (1 - this.trimRatio));
    const entries = Array.from(this.cache.entries());

    // Remove oldest entries
    entries.sort((a, b) => {
      // Simple LRU: remove entries that were added earlier
      return 0;
    });

    for (let i = 0; i < entries.length - targetSize; i++) {
      this.cache.delete(entries[i][0]);
    }
  }

  clear(): void {
    this.cache.clear();
  }

  size(): number {
    return this.cache.size;
  }
}

// Global deduplicator instance
const messageDeduplicator = new MessageDeduplicator();

// Helper to generate unique message ID
function generateMessageId(): string {
  return `ztm-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

// Helper to hash message content for deduplication
function hashContent(content: string): string {
  let hash = 0;
  for (let i = 0; i < content.length; i++) {
    const char = content.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(36);
}

// Get or create account state
function getOrCreateAccountState(accountId: string): AccountRuntimeState {
  let state = accountStates.get(accountId);
  if (!state) {
    state = {
      accountId,
      config: {} as ZTMChatConfig,
      apiClient: null,
      connected: false,
      meshConnected: false,
      lastError: null,
      lastStartAt: null,
      lastStopAt: null,
      lastInboundAt: null,
      lastOutboundAt: null,
      peerCount: 0,
      messageCallbacks: new Set(),
      watchInterval: null,
      watchErrorCount: 0,
    };
    accountStates.set(accountId, state);
  }
  return state;
}

// Remove account state
function removeAccountState(accountId: string): void {
  const state = accountStates.get(accountId);
  if (state) {
    if (state.watchInterval) {
      clearInterval(state.watchInterval);
    }
    state.messageCallbacks.clear();
    accountStates.delete(accountId);
  }
}

// Build channel config schema with UI hints
function buildChannelConfigSchemaWithHints(
  schema: ReturnType<typeof ZTMChatConfigSchema>
) {
  return {
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
      certificate: {
        label: "Certificate",
        sensitive: true,
        help: "ZTM agent certificate (PEM format) for mTLS authentication",
        placeholder: "-----BEGIN CERTIFICATE-----...",
        validation: {
          pattern: "-----BEGIN CERTIFICATE-----",
          message: "Must be a valid PEM certificate",
        },
      },
      privateKey: {
        label: "Private Key",
        sensitive: true,
        help: "ZTM private key (PEM format) for mTLS authentication",
        placeholder: "-----BEGIN PRIVATE KEY-----...",
        validation: {
          pattern: "-----BEGIN (RSA|EC|PRIVATE) KEY-----",
          message: "Must be a valid PEM private key",
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

// Account ID resolution helpers
function listZTMChatAccountIds(cfg: OpenClawConfig): string[] {
  const accounts = cfg.channels?.["ztm-chat"]?.accounts;
  if (!accounts) return [];
  return Object.keys(accounts);
}

function resolveZTMChatAccount({
  cfg,
  accountId,
}: {
  cfg: OpenClawConfig;
  accountId?: string;
}): ResolvedZTMChatAccount {
  const channelConfig = cfg.channels?.["ztm-chat"];
  const accountKey = accountId ?? "default";

  if (!channelConfig) {
    return {
      accountId: accountKey,
      username: "",
      enabled: false,
      config: {},
    };
  }

  const account = channelConfig.accounts?.[accountKey];
  const defaultAccount = channelConfig.accounts?.default;

  const resolved = account ?? defaultAccount ?? {};

  return {
    accountId: accountKey,
    username: resolved.username ?? accountKey,
    enabled: resolved.enabled ?? channelConfig.enabled ?? true,
    config: resolved,
  };
}

// Message processing
function processIncomingMessage(
  msg: { time: number; message: string; sender: string }
): ZTMChatMessage | null {
  if (messageDeduplicator.isDuplicate(msg.sender, msg.time, msg.message)) {
    logger.debug(`Skipping duplicate message from ${msg.sender}`);
    return null;
  }

  return {
    id: `${msg.time}-${msg.sender}`,
    content: msg.message,
    sender: msg.sender,
    senderId: msg.sender,
    timestamp: new Date(msg.time),
    peer: msg.sender,
  };
}

// Start message watcher with Watch mechanism
async function startMessageWatcher(
  state: AccountRuntimeState
): Promise<void> {
  const { config, apiClient } = state;
  if (!apiClient) return;

  const messagePath = `/shared/${config.username}/publish/peers/*/messages/`;

  // Initial read of all messages
  try {
    const chats = await apiClient.getChats();
    for (const chat of chats) {
      if (chat.peer && chat.latest) {
        const normalized = processIncomingMessage({
          time: chat.latest.time,
          message: chat.latest.message,
          sender: chat.peer,
        });
        if (normalized) {
          notifyMessageCallbacks(state, normalized);
        }
      }
    }
    logger.info(`[${state.accountId}] Initial sync: ${chats.length} chats`);
  } catch (error) {
    logger.warn(`[${state.accountId}] Initial read failed: ${error}`);
  }

  // Start watching for changes
  const watchLoop = async (): Promise<void> => {
    if (!state.apiClient || !state.config) return;

    try {
      const changedPaths = await state.apiClient.watchChanges(messagePath);

      if (changedPaths.length > 0) {
        logger.debug(`[${state.accountId}] Watch detected changes: ${changedPaths.length} paths`);
      }

      for (const path of changedPaths) {
        // Parse path to get peer name
        const match = path.match(
          /\/shared\/[^/]+\/publish\/peers\/([^/]+)\/messages/
        );
        if (match) {
          const peer = match[1];
          try {
            const messages = await state.apiClient!.getPeerMessages(peer);
            if (messages) {
              for (const msg of messages) {
                const normalized = processIncomingMessage(msg);
                if (normalized) {
                  notifyMessageCallbacks(state, normalized);
                }
              }
            }
          } catch (error) {
            logger.warn(`[${state.accountId}] Failed to read messages from ${peer}: ${error}`);
          }
        }
      }

      state.watchErrorCount = 0;
    } catch (error) {
      state.watchErrorCount++;
      logger.warn(
        `[${state.accountId}] Watch error (${state.watchErrorCount}): ${error}`
      );

      // Fall back to polling if watch fails repeatedly
      if (state.watchErrorCount > 5) {
        logger.warn(`[${state.accountId}] Too many watch errors, falling back to polling`);
        await startPollingWatcher(state);
        return;
      }
    }

    // Continue watching
    watchLoop();
  };

  watchLoop();
}

// Fallback polling watcher (when watch is unavailable)
async function startPollingWatcher(state: AccountRuntimeState): Promise<void> {
  const { config, apiClient } = state;
  if (!apiClient) return;

  const pollingInterval = Math.max(
    config.pollingInterval ?? 2000,
    1000
  );

  logger.info(`[${state.accountId}] Starting polling watcher (${pollingInterval}ms)`);

  state.watchInterval = setInterval(async () => {
    if (!state.apiClient || !state.config) return;

    try {
      const chats = await state.apiClient.getChats();
      for (const chat of chats) {
        if (chat.peer && chat.latest) {
          const normalized = processIncomingMessage({
            time: chat.latest.time,
            message: chat.latest.message,
            sender: chat.peer,
          });
          if (normalized) {
            notifyMessageCallbacks(state, normalized);
          }
        }
      }
    } catch (error) {
      logger.debug(`[${state.accountId}] Polling error: ${error}`);
    }
  }, pollingInterval);
}

// Notify all message callbacks
function notifyMessageCallbacks(
  state: AccountRuntimeState,
  message: ZTMChatMessage
): void {
  state.lastInboundAt = new Date();
  for (const callback of state.messageCallbacks) {
    try {
      callback(message);
    } catch (error) {
      logger.error(`[${state.accountId}] Callback error: ${error}`);
    }
  }
}

// Send message to peer
async function sendZTMMessage(
  state: AccountRuntimeState,
  peer: string,
  content: string
): Promise<boolean> {
  if (!state.config || !state.apiClient) {
    state.lastError = "Runtime not initialized";
    return false;
  }

  const message: ZTMMessage = {
    time: Date.now(),
    message: content,
    sender: state.config.username,
  };

  try {
    const success = await state.apiClient.sendPeerMessage(peer, message);

    if (success) {
      state.lastOutboundAt = new Date();
      logger.info(`[${state.accountId}] Message sent to ${peer}: ${content.substring(0, 50)}...`);
    }

    return success;
  } catch (error) {
    state.lastError = error instanceof Error ? error.message : String(error);
    logger.error(`[${state.accountId}] Send failed: ${state.lastError}`);
    return false;
  }
}

// Initialize runtime for an account
async function initializeRuntime(
  config: ZTMChatConfig,
  accountId: string
): Promise<boolean> {
  const state = getOrCreateAccountState(accountId);
  state.config = config;

  try {
    const apiClient = createZTMApiClient(config);
    const meshInfo = await apiClient.getMeshInfo();

    state.apiClient = apiClient;
    state.connected = true;
    state.meshConnected = meshInfo.connected;
    state.peerCount = meshInfo.endpoints;
    state.lastError = meshInfo.connected ? null : "Not connected to ZTM mesh";

    logger.info(
      `[${accountId}] Connected: mesh=${config.meshName}, peers=${meshInfo.endpoints}`
    );

    if (meshInfo.connected) {
      await startMessageWatcher(state);
    }

    return meshInfo.connected;
  } catch (error) {
    state.lastError = error instanceof Error ? error.message : String(error);
    state.connected = false;
    state.meshConnected = false;
    logger.error(`[${accountId}] Initialization failed: ${state.lastError}`);
    return false;
  }
}

// Stop runtime for an account
async function stopRuntime(accountId: string): Promise<void> {
  const state = accountStates.get(accountId);
  if (!state) return;

  if (state.watchInterval) {
    clearInterval(state.watchInterval);
    state.watchInterval = null;
  }

  state.messageCallbacks.clear();
  state.apiClient = null;
  state.connected = false;
  state.meshConnected = false;
  state.lastStopAt = new Date();

  logger.info(`[${accountId}] Stopped`);
}

// Channel plugin definition
export const ztmChatPlugin: ChannelPlugin<ResolvedZTMChatAccount> = {
  id: "ztm-chat",
  meta: {
    ...meta,
    quickstartAllowFrom: true,
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
      allowFrom
        .map((entry) => String(entry).trim())
        .filter(Boolean)
        .map((entry) => entry.toLowerCase()),
  },
  security: {
    resolveDmPolicy: ({ cfg, accountId, account }) => {
      const resolvedAccountId = accountId ?? account.accountId ?? "default";
      const config = account.config as ZTMChatConfig;
      const useAccountPath = Boolean(
        cfg.channels?.["ztm-chat"]?.accounts?.[resolvedAccountId]
      );
      const basePath = useAccountPath
        ? `channels.ztm-chat.accounts.${resolvedAccountId}.`
        : "channels.ztm-chat.";

      return {
        policy: config?.dmPolicy ?? "allow",
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

      if (!config?.certificate || !config?.privateKey) {
        warnings.push(
          "No mTLS credentials configured - API requests will use no authentication"
        );
      }

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
        const meshInfo = await apiClient.getMeshInfo();

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
    resolveRequireMention: async () => false,
    resolveToolPolicy: async () => "allow",
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
      const state = accountStates.get(accountKey);

      if (!state) {
        return {
          channel: "ztm-chat",
          ok: false,
          error: "Account not initialized",
        };
      }

      const success = await sendZTMMessage(state, to, text);
      return {
        channel: "ztm-chat",
        ok: success,
        messageId: success ? generateMessageId() : undefined,
        error: success ? undefined : state.lastError,
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
    },
    collectStatusIssues: async ({ cfg, accountId }): Promise<ChannelStatusIssue[]> => {
      const issues: ChannelStatusIssue[] = [];
      const account = resolveZTMChatAccount({ cfg, accountId });
      const config = account.config as ZTMChatConfig;

      // Check config validity
      if (!isConfigMinimallyValid(config)) {
        issues.push({
          level: "error",
          message: "Missing required configuration (agentUrl, meshName, or username)",
        });
        return issues;
      }

      // Probe the connection
      try {
        const probeConfig = resolveZTMChatConfig(config);
        const apiClient = createZTMApiClient(probeConfig);
        const meshInfo = await apiClient.getMeshInfo();

        if (!meshInfo.connected) {
          issues.push({
            level: "error",
            message: "Not connected to ZTM mesh",
          });
        }
        if (meshInfo.endpoints < 1) {
          issues.push({
            level: "warn",
            message: "No other endpoints in mesh - messages may not be deliverable",
          });
        }
        if (meshInfo.errors && meshInfo.errors.length > 0) {
          issues.push({
            level: "error",
            message: `ZTM Agent error: ${meshInfo.errors[0].message}`,
          });
        }
      } catch (error) {
        issues.push({
          level: "error",
          message: `Failed to connect to ZTM Agent: ${error}`,
        });
      }

      return issues;
    },
    buildChannelSummary: ({ snapshot }) => ({
      configured: snapshot.configured ?? false,
      running: snapshot.running ?? false,
      connected: snapshot.meshConnected ?? false,
      lastStartAt: snapshot.lastStartAt ?? null,
      lastStopAt: snapshot.lastStopAt ?? null,
      lastError: snapshot.lastError ?? null,
      lastInboundAt: snapshot.lastInboundAt ?? null,
      lastOutboundAt: snapshot.lastOutboundAt ?? null,
      peerCount: snapshot.peerCount ?? 0,
    }),
    probeAccount: async ({ account, timeoutMs = 10000 }) => {
      const config = account.config as ZTMChatConfig;

      if (!config?.agentUrl) {
        return {
          ok: false,
          error: "No agent URL configured",
        };
      }

      try {
        const probeConfig = resolveZTMChatConfig(config);
        const apiClient = createZTMApiClient(probeConfig);
        const meshInfo = await apiClient.getMeshInfo();

        return {
          ok: meshInfo.connected,
          error: meshInfo.connected
            ? null
            : "ZTM Agent is not connected to mesh",
          meshInfo,
        };
      } catch (error) {
        return {
          ok: false,
          error:
            error instanceof Error
              ? error.message
              : String(error),
        };
      }
    },
    buildAccountSnapshot: ({ account }) => {
      const state = accountStates.get(account.accountId);

      return {
        accountId: account.accountId,
        name: account.username,
        enabled: account.enabled,
        configured: isConfigMinimallyValid(account.config as ZTMChatConfig),
        running: state?.connected ?? false,
        meshConnected: state?.meshConnected ?? false,
        lastStartAt: state?.lastStartAt ?? null,
        lastStopAt: state?.lastStopAt ?? null,
        lastError: state?.lastError ?? null,
        lastInboundAt: state?.lastInboundAt ?? null,
        lastOutboundAt: state?.lastOutboundAt ?? null,
        peerCount: state?.peerCount ?? 0,
      };
    },
  },
  directory: {
    self: async ({ account }) => {
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
    listPeers: async ({ account, cfg }) => {
      const config = account.config as ZTMChatConfig;
      const apiClient = createZTMApiClient(resolveZTMChatConfig(config));

      try {
        const users = await apiClient.discoverUsers();
        return users.map((user) => ({
          kind: "user" as const,
          id: user.username,
          name: user.username,
          raw: user,
        }));
      } catch (error) {
        logger.error(`Failed to list peers: ${error}`);
        return [];
      }
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

      const initialized = await initializeRuntime(config, account.accountId);

      if (!initialized) {
        const state = accountStates.get(account.accountId);
        throw new Error(state?.lastError ?? "Failed to initialize ZTM connection");
      }

      const state = accountStates.get(account.accountId)!;
      state.lastStartAt = new Date();

      // Subscribe to messages
      const rt = getZTMRuntime();
      const unsubscribe = rt.onMessage((message) => {
        ctx.router.route({
          channel: "ztm-chat",
          sender: {
            id: message.sender.id,
            name: message.sender.name,
          },
          content: message.content,
          timestamp: message.timestamp,
          thread: message.thread?.id,
          id: message.id,
        });
      });

      ctx.log?.info(
        `[${account.accountId}] Connected to ZTM mesh "${config.meshName}" as ${config.username}`
      );

      // Add message callback
      const messageCallback = (msg: ZTMChatMessage) => {
        ctx.router.route({
          channel: "ztm-chat",
          sender: {
            id: msg.sender,
            name: msg.sender,
          },
          content: msg.content,
          timestamp: msg.timestamp,
          id: msg.id,
        });
      };

      state.messageCallbacks.add(messageCallback);

      // Return cleanup function
      return async () => {
        unsubscribe();
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
