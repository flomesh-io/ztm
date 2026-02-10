// ZTM Chat Channel Adapter for OpenClaw
// Implements ChannelPlugin interface with multi-account support

import { spawn } from "child_process";
import * as fs from "fs";
import * as net from "net";
import * as path from "path";
import {
  buildChannelConfigSchema,
  type ChannelPlugin,
  type ChannelStatusIssue as BaseChannelStatusIssue,
  type ChannelAccountSnapshot as BaseChannelAccountSnapshot,
  type OpenClawConfig,
} from "openclaw/plugin-sdk";
import { getZTMRuntime } from "./runtime.js";

// Local type extension for ChannelStatusIssue with level property
type ChannelStatusIssue = BaseChannelStatusIssue & {
  level?: "error" | "warn" | "info";
  message: string;
};

// Local type extension for ChannelAccountSnapshot with additional properties
type ChannelAccountSnapshot = BaseChannelAccountSnapshot & {
  meshConnected?: boolean;
  peerCount?: number;
};
import {
  resolveZTMChatConfig,
  validateZTMChatConfig,
  ZTMChatConfigSchema,
  type ZTMChatConfig,
  isConfigMinimallyValid,
  getDefaultConfig,
  type DMPolicy,
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

// Local type for resolved ZTM chat account
export interface ResolvedZTMChatAccount {
  accountId: string;
  username: string;
  enabled: boolean;
  config: Partial<ZTMChatConfig>;
}

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
  // Pairing state for dmPolicy="pairing"
  pendingPairings: Map<string, Date>;
}

// Multi-account state management
const accountStates = new Map<string, AccountRuntimeState>();

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

// Persistent message state store
// Tracks per-account, per-peer watermarks so that already-processed messages
// are skipped across gateway restarts.
interface MessageStateData {
  // Per-account → per-peer → last processed message timestamp
  accounts: Record<string, Record<string, number>>;
  // Per-account → last seen file times (for watchChanges seeding)
  fileTimes: Record<string, Record<string, number>>;
}

class MessageStateStore {
  private statePath: string;
  private data: MessageStateData;
  private dirty = false;
  private flushTimer: ReturnType<typeof setTimeout> | null = null;

  // Maximum number of peers to track per account (prevents unbounded state growth)
  private readonly MAX_PEERS_PER_ACCOUNT = 1000;
  // Maximum number of file paths to track per account
  private readonly MAX_FILES_PER_ACCOUNT = 1000;

  constructor() {
    this.statePath = path.join(
      process.env.HOME || "",
      ".openclaw",
      "ztm",
      "state.json",
    );
    // Ensure the config directory exists on startup to prevent write errors later
    const configDir = path.dirname(this.statePath);
    if (!fs.existsSync(configDir)) {
      fs.mkdirSync(configDir, { recursive: true });
    }
    this.data = { accounts: {}, fileTimes: {} };
    this.load();
  }

  private load(): void {
    try {
      if (fs.existsSync(this.statePath)) {
        const content = fs.readFileSync(this.statePath, "utf-8");
        const parsed = JSON.parse(content);
        if (parsed && typeof parsed === "object") {
          this.data = {
            accounts: parsed.accounts ?? {},
            fileTimes: parsed.fileTimes ?? {},
          };
        }
      }
    } catch {
      // Ignore read/parse errors — start fresh
      logger.warn("Failed to load message state, starting fresh");
    }
  }

  private scheduleSave(): void {
    this.dirty = true;
    if (this.flushTimer) return;
    // Debounce writes to avoid excessive I/O during burst processing
    this.flushTimer = setTimeout(() => {
      this.flushTimer = null;
      this.save();
    }, 1000);
  }

  private save(): void {
    if (!this.dirty) return;
    try {
      const dir = path.dirname(this.statePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(this.statePath, JSON.stringify(this.data, null, 2));
      this.dirty = false;
    } catch {
      logger.warn("Failed to persist message state");
    }
  }

  /** Flush any pending writes immediately (call on shutdown) */
  flush(): void {
    if (this.flushTimer) {
      clearTimeout(this.flushTimer);
      this.flushTimer = null;
    }
    this.save();
  }

  /** Get the last-processed message timestamp for a peer under an account */
  getWatermark(accountId: string, peer: string): number {
    return this.data.accounts[accountId]?.[peer] ?? 0;
  }

  /** Get the global watermark (max across all peers) for an account */
  getGlobalWatermark(accountId: string): number {
    const peers = this.data.accounts[accountId];
    if (!peers) return 0;
    return Math.max(0, ...Object.values(peers));
  }

  /** Update the watermark for a peer (only advances forward) */
  setWatermark(accountId: string, peer: string, time: number): void {
    const current = this.getWatermark(accountId, peer);
    if (time <= current) return;
    if (!this.data.accounts[accountId]) {
      this.data.accounts[accountId] = {};
    }
    this.data.accounts[accountId][peer] = time;
    this.cleanupIfNeeded(accountId);
    this.scheduleSave();
  }

  /** Clean up old entries if limits are exceeded (called after watermark updates) */
  private cleanupIfNeeded(accountId: string): void {
    const peers = this.data.accounts[accountId];
    if (peers && Object.keys(peers).length > this.MAX_PEERS_PER_ACCOUNT) {
      // Keep the most recently active peers (sorted by timestamp descending)
      const sorted = Object.entries(peers)
        .sort(([, t1], [, t2]) => t2 - t1)
        .slice(0, this.MAX_PEERS_PER_ACCOUNT);
      this.data.accounts[accountId] = Object.fromEntries(sorted);
      this.dirty = true;
    }

    // Also cleanup fileTimes if needed
    const fileTimes = this.data.fileTimes[accountId];
    if (fileTimes && Object.keys(fileTimes).length > this.MAX_FILES_PER_ACCOUNT) {
      // Keep the most recently seen files (sorted by timestamp descending)
      const sorted = Object.entries(fileTimes)
        .sort(([, t1], [, t2]) => t2 - t1)
        .slice(0, this.MAX_FILES_PER_ACCOUNT);
      this.data.fileTimes[accountId] = Object.fromEntries(sorted);
      this.dirty = true;
    }
  }

  /** Get all persisted file times for an account (used to seed lastSeenTimes) */
  getFileTimes(accountId: string): Record<string, number> {
    return this.data.fileTimes[accountId] ?? {};
  }

  /** Update a file's last-seen time */
  setFileTime(accountId: string, filePath: string, time: number): void {
    if (!this.data.fileTimes[accountId]) {
      this.data.fileTimes[accountId] = {};
    }
    this.data.fileTimes[accountId][filePath] = time;
    this.scheduleSave();
  }

  /** Bulk-set file times (e.g. after initial scan) */
  setFileTimes(accountId: string, times: Record<string, number>): void {
    if (!this.data.fileTimes[accountId]) {
      this.data.fileTimes[accountId] = {};
    }
    for (const [fp, t] of Object.entries(times)) {
      this.data.fileTimes[accountId][fp] = t;
    }
    this.scheduleSave();
  }

  /** Dispose of resources - call on plugin unload to prevent memory leaks */
  dispose(): void {
    if (this.flushTimer) {
      clearTimeout(this.flushTimer);
      this.flushTimer = null;
    }
    this.save();
  }
}

// Export dispose function for plugin cleanup
export function disposeMessageStateStore(): void {
  messageStateStore.dispose();
}

// Global state store instance
const messageStateStore = new MessageStateStore();

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

  /** Mark a message as seen without checking (used to seed from persisted state) */
  markSeen(sender: string, time: number, content: string): void {
    const key = this.generateKey(sender, time, content);
    this.cache.set(key, { sender, time, contentHash: content });
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
      pendingPairings: new Map(),
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
  schema: any
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
  const inlineConfig = (cfg?.channels?.["ztm-chat"] as any);
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
  // This matches the pattern used by the Telegram SDK
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

  // Merge top-level config with account-level overrides (account takes precedence)
  const { accounts: _ignored, ...baseConfig } = channelConfig;
  const merged = { ...baseConfig, ...account };

  const config = resolveZTMChatConfig(merged);

  return {
    accountId: accountKey,
    username: (merged.username as string) ?? accountKey,
    enabled: (merged.enabled as boolean) ?? (channelConfig.enabled as boolean) ?? true,
    config,
  };
}

// Message processing result
interface MessageCheckResult {
  allowed: boolean;
  reason?: "allowed" | "denied" | "pending" | "whitelisted";
  action?: "process" | "ignore" | "request_pairing";
}

// Check if a sender is allowed to send messages
function checkDmPolicy(
  sender: string,
  config: ZTMChatConfig,
  pendingPairings: Map<string, Date>,
  storeAllowFrom: string[] = []
): MessageCheckResult {
  const normalizedSender = sender.trim().toLowerCase();

  const allowFrom = config.allowFrom ?? [];
  const isWhitelisted = allowFrom.length > 0 &&
    allowFrom.some((entry) => entry.trim().toLowerCase() === normalizedSender);

  if (isWhitelisted) {
    return { allowed: true, reason: "whitelisted", action: "process" };
  }

  const isStoreApproved = storeAllowFrom.length > 0 &&
    storeAllowFrom.some((entry) => entry.trim().toLowerCase() === normalizedSender);

  if (isStoreApproved) {
    return { allowed: true, reason: "whitelisted", action: "process" };
  }

  const policy = config.dmPolicy ?? "pairing";

  switch (policy) {
    case "allow":
      return { allowed: true, reason: "allowed", action: "process" };

    case "deny":
      return { allowed: false, reason: "denied", action: "ignore" };

    case "pairing":
      // Check if already pending
      if (pendingPairings.has(normalizedSender)) {
        return { allowed: false, reason: "pending", action: "ignore" };
      }
      // Request pairing
      return { allowed: false, reason: "pending", action: "request_pairing" };

    default:
      // Default to allow for unknown policy
      return { allowed: true, reason: "allowed", action: "process" };
  }
}

function processIncomingMessage(
  msg: { time: number; message: string; sender: string },
  config: ZTMChatConfig,
  pendingPairings: Map<string, Date>,
  storeAllowFrom: string[] = [],
  accountId: string = "default"
): ZTMChatMessage | null {
  const watermark = messageStateStore.getWatermark(accountId, msg.sender);
  if (msg.time <= watermark) {
    logger.debug(`Skipping already-processed message from ${msg.sender} (time=${msg.time} <= watermark=${watermark})`);
    return null;
  }

  if (messageDeduplicator.isDuplicate(msg.sender, msg.time, msg.message)) {
    logger.debug(`Skipping duplicate message from ${msg.sender}`);
    return null;
  }

  const check = checkDmPolicy(msg.sender, config, pendingPairings, storeAllowFrom);

  if (!check.allowed) {
    if (check.action === "request_pairing") {
      logger.info(`[DM Policy] Pairing request from ${msg.sender}`);
    } else if (check.action === "ignore") {
      logger.debug(`[DM Policy] Ignoring message from ${msg.sender} (${check.reason})`);
    }
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

// Handle pairing request - send a pairing request message to the peer
async function handlePairingRequest(
  state: AccountRuntimeState,
  peer: string,
  context: string,
  storeAllowFrom: string[] = []
): Promise<void> {
  const { config, apiClient } = state;
  if (!apiClient) return;

  const normalizedPeer = peer.trim().toLowerCase();

  // Check if already pending or approved
  if (state.pendingPairings.has(normalizedPeer)) {
    logger.debug(`[${state.accountId}] Pairing request already pending for ${peer}`);
    return;
  }

  const allowFrom = config.allowFrom ?? [];
  if (allowFrom.some((entry) => entry.trim().toLowerCase() === normalizedPeer)) {
    logger.debug(`[${state.accountId}] ${peer} is already approved`);
    return;
  }

  // Check if already approved via pairing store (persisted across restarts)
  if (storeAllowFrom.length > 0 && storeAllowFrom.some((entry) => entry.trim().toLowerCase() === normalizedPeer)) {
    logger.debug(`[${state.accountId}] ${peer} is already approved via pairing store`);
    return;
  }

  // Register pairing request with openclaw's pairing store
  // This makes it visible to `openclaw pairing list ztm-chat` and approvable via `openclaw pairing approve ztm-chat <code>`
  let pairingCode = "";
  let pairingCreated = false;
  try {
    const rt = getZTMRuntime();
    const { code, created } = await rt.channel.pairing.upsertPairingRequest({
      channel: "ztm-chat",
      id: normalizedPeer,
      meta: { name: peer },
    });
    pairingCode = code;
    pairingCreated = created;
    logger.info(`[${state.accountId}] Registered pairing request for ${peer} (code=${code}, created=${created})`);
  } catch (error) {
    logger.warn(`[${state.accountId}] Failed to register pairing request in store for ${peer}: ${error}`);
    // Continue anyway — still add to in-memory pending and notify the peer
  }

  // Add to pending pairings (in-memory tracking)
  state.pendingPairings.set(normalizedPeer, new Date());

  // Build pairing reply message using openclaw's standard format
  let messageText: string;
  if (pairingCode) {
    try {
      const rt = getZTMRuntime();
      messageText = rt.channel.pairing.buildPairingReply({
        channel: "ztm-chat",
        idLine: `Your ZTM Chat username: ${peer}`,
        code: pairingCode,
      });
    } catch {
      // Fallback if buildPairingReply is unavailable
      messageText = `[🤖 PAIRING REQUEST]\n\nUser "${peer}" wants to send messages to your OpenClaw ZTM Chat bot.\n\n` +
        `━━━━━━━━━━━━━━━━━━━━━━\n` +
        `Pairing code: ${pairingCode}\n\n` +
        `To approve this user, run:\n` +
        `  openclaw pairing approve ztm-chat ${pairingCode}\n\n` +
        `To deny this request, run:\n` +
        `  openclaw pairing deny ztm-chat ${pairingCode}\n` +
        `━━━━━━━━━━━━━━━━━━━━━━`;
    }
  } else {
    // No code available (store registration failed)
    messageText = `[🤖 PAIRING REQUEST]\n\nUser "${peer}" wants to send messages to your OpenClaw ZTM Chat bot.\n\n` +
      `━━━━━━━━━━━━━━━━━━━━━━\n` +
      `To approve this user, run:\n` +
      `  openclaw pairing approve ztm-chat ${peer}\n\n` +
      `To deny this request, run:\n` +
      `  openclaw pairing deny ztm-chat ${peer}\n` +
      `━━━━━━━━━━━━━━━━━━━━━━\n\n` +
      `Note: Your bot is in "pairing" mode, which requires explicit approval for new users.`;
  }

  // Only send pairing message to the peer if this is a newly created request
  if (pairingCreated || !pairingCode) {
    const pairingMessage: ZTMMessage = {
      time: Date.now(),
      message: messageText,
      sender: config.username,
    };

    try {
      await apiClient.sendPeerMessage(peer, pairingMessage);
      logger.info(`[${state.accountId}] Sent pairing request to ${peer}`);
    } catch (error) {
      logger.warn(`[${state.accountId}] Failed to send pairing request to ${peer}: ${error}`);
    }
  } else {
    logger.debug(`[${state.accountId}] Pairing request already exists for ${peer} (code=${pairingCode}), not re-sending message`);
  }
}

// Start message watcher with Watch mechanism
// Watches for messages sent TO the bot (stored at /shared/{SENDER}/publish/peers/{BOT}/messages/)
async function startMessageWatcher(
  state: AccountRuntimeState
): Promise<void> {
  const { config, apiClient } = state;
  if (!apiClient) return;

  const messagePath = "/apps/ztm/chat/shared/";

  // Seed the API client's lastSeenTimes from persisted state
  // so that watchChanges doesn't treat all existing files as "new"
  const persistedFileTimes = messageStateStore.getFileTimes(state.accountId);
  if (Object.keys(persistedFileTimes).length > 0) {
    apiClient.seedLastSeenTimes(persistedFileTimes);
    logger.info(`[${state.accountId}] Seeded ${Object.keys(persistedFileTimes).length} file timestamps from persisted state`);
  }

  const rt = getZTMRuntime();
  const storeAllowFrom = await rt.channel.pairing.readAllowFromStore("ztm-chat").catch(() => [] as string[]);

  // Initial read of all messages (watermark check in processIncomingMessage will skip old ones)
  try {
    const chats = await apiClient.getChats();
    for (const chat of chats) {
      if (!chat.peer || chat.peer === config.username) continue;
      if (chat.latest) {
        const normalized = processIncomingMessage(
          {
            time: chat.latest.time,
            message: chat.latest.message,
            sender: chat.peer,
          },
          config,
          state.pendingPairings,
          storeAllowFrom,
          state.accountId
        );
        if (normalized) {
          notifyMessageCallbacks(state, normalized);
        }
      }
    }
    logger.info(`[${state.accountId}] Initial sync: ${chats.length} chats`);
  } catch (error) {
    logger.warn(`[${state.accountId}] Initial read failed: ${error}`);
  }

  // Handle pairing requests for initial chats
  for (const chat of (await apiClient.getChats()) || []) {
    if (chat.peer && chat.peer !== config.username) {
      const check = checkDmPolicy(chat.peer, config, state.pendingPairings, storeAllowFrom);
      if (check.action === "request_pairing") {
        await handlePairingRequest(state, chat.peer, "Initial chat request", storeAllowFrom);
      }
    }
  }

  // Start watching for changes
  const watchLoop = async (): Promise<void> => {
    if (!state.apiClient || !state.config) return;

    try {
      const changedPaths = await state.apiClient.watchChanges(messagePath);

      if (changedPaths.length > 0) {
        logger.debug(`[${state.accountId}] Watch detected changes: ${changedPaths.length} paths`);
      }

      const loopStoreAllowFrom = await rt.channel.pairing.readAllowFromStore("ztm-chat").catch(() => [] as string[]);

      for (const path of changedPaths) {
        const match = path.match(
          /\/apps\/ztm\/chat\/shared\/([^/]+)\/publish\/peers\/.*\/messages/
        );
        if (match) {
          const peer = match[1];
          if (peer === state.config.username) continue;
          try {
            const messages = await state.apiClient!.getPeerMessages(peer);
            if (messages) {
              for (const msg of messages) {
                const normalized = processIncomingMessage(
                  msg,
                  state.config,
                  state.pendingPairings,
                  loopStoreAllowFrom,
                  state.accountId
                );
                if (normalized) {
                  notifyMessageCallbacks(state, normalized);
                }
              }
            }

            const check = checkDmPolicy(peer, state.config, state.pendingPairings, loopStoreAllowFrom);
            if (check.action === "request_pairing") {
              await handlePairingRequest(state, peer, "New message", loopStoreAllowFrom);
            }
          } catch (error) {
            logger.warn(`[${state.accountId}] Failed to read messages from ${peer}: ${error}`);
          }
        }
      }

      if (changedPaths.length > 0 && state.apiClient) {
        messageStateStore.setFileTimes(state.accountId, state.apiClient.exportLastSeenTimes());
      }

      state.watchErrorCount = 0;
    } catch (error) {
      state.watchErrorCount++;
      logger.warn(
        `[${state.accountId}] Watch error (${state.watchErrorCount}): ${error}`
      );

      if (state.watchErrorCount > 5) {
        logger.warn(`[${state.accountId}] Too many watch errors, falling back to polling`);
        await startPollingWatcher(state);
        return;
      }
    }

    setTimeout(watchLoop, 1000);
  };

  watchLoop();
}

// Fallback polling watcher (when watch is unavailable)
async function startPollingWatcher(state: AccountRuntimeState): Promise<void> {
  const { config, apiClient } = state;
  if (!apiClient) return;

  const pollingInterval = Math.max(
    (config as any).pollingInterval ?? 2000,
    1000
  );

  logger.info(`[${state.accountId}] Starting polling watcher (${pollingInterval}ms)`);

  const rt = getZTMRuntime();

  state.watchInterval = setInterval(async () => {
    if (!state.apiClient || !state.config) return;

    try {
      const pollStoreAllowFrom = await rt.channel.pairing.readAllowFromStore("ztm-chat").catch(() => [] as string[]);
      const chats = await state.apiClient.getChats();
      for (const chat of chats) {
        if (!chat.peer || chat.peer === config.username) continue;
        if (chat.latest) {
          const normalized = processIncomingMessage(
            {
              time: chat.latest.time,
              message: chat.latest.message,
              sender: chat.peer,
            },
            config,
            state.pendingPairings,
            pollStoreAllowFrom,
            state.accountId
          );
          if (normalized) {
            notifyMessageCallbacks(state, normalized);
          }

          const check = checkDmPolicy(chat.peer, config, state.pendingPairings, pollStoreAllowFrom);
          if (check.action === "request_pairing") {
            await handlePairingRequest(state, chat.peer, "Polling check", pollStoreAllowFrom);
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
  messageStateStore.setWatermark(state.accountId, message.peer, message.timestamp.getTime());
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

// Check if a TCP port is open
async function checkPortOpen(hostname: string, port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    socket.setTimeout(5000);

    socket.on("connect", () => {
      socket.destroy();
      resolve(true);
    });

    socket.on("timeout", () => {
      socket.destroy();
      resolve(false);
    });

    socket.on("error", () => {
      socket.destroy();
      resolve(false);
    });

    socket.connect(port, hostname);
  });
}

// Execute ztm identity command to get public key
async function getPublicKeyFromIdentity(): Promise<string | null> {
  return new Promise((resolve) => {
    const child = spawn("ztm", ["identity"], {
      timeout: 30000,
    });

    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (data) => {
      stdout += data.toString();
    });

    child.stderr.on("data", (data) => {
      stderr += data.toString();
    });

    child.on("close", (code) => {
      if (code === 0 && stdout.includes("-----BEGIN PUBLIC KEY-----")) {
        // Extract the public key from output
        const match = stdout.match(/-----BEGIN PUBLIC KEY-----[\s\S]+?-----END PUBLIC KEY-----/);
        if (match) {
          resolve(match[0]);
        } else {
          resolve(null);
        }
      } else {
        logger.error(`ztm identity failed: ${stderr}`);
        resolve(null);
      }
    });

    child.on("error", (error) => {
      logger.error(`Failed to execute ztm identity: ${error.message}`);
      resolve(null);
    });
  });
}

// Request permit from permit server
async function requestPermit(
  permitUrl: string,
  publicKey: string,
  username: string
): Promise<unknown> {
  try {
    const response = await fetch(permitUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        PublicKey: publicKey,
        UserName: username,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      logger.error(`Permit request failed: ${response.status} ${errorText}`);
      return null;
    }

    const permitData = await response.json();
    logger.info("Permit request successful");
    return permitData;
  } catch (error) {
    logger.error(`Permit request error: ${error}`);
    return null;
  }
}

// Save permit data to file
function savePermitData(permitData: unknown, permitPath: string): boolean {
  try {
    // Ensure directory exists
    const dir = path.dirname(permitPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(permitPath, JSON.stringify(permitData, null, 2));
    logger.info(`Permit data saved to ${permitPath}`);
    return true;
  } catch (error) {
    logger.error(`Failed to save permit data: ${error}`);
    return false;
  }
}

// Execute ztm join command
async function joinMesh(
  meshName: string,
  endpointName: string,
  permitPath: string
): Promise<boolean> {
  return new Promise((resolve) => {
    const child = spawn(
      "ztm",
      ["join", meshName, "--as", endpointName, "--permit", permitPath],
      { timeout: 60000 }
    );

    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (data) => {
      stdout += data.toString();
    });

    child.stderr.on("data", (data) => {
      stderr += data.toString();
    });

    child.on("close", (code) => {
      if (code === 0) {
        logger.info(`Successfully joined mesh ${meshName} as ${endpointName}`);
        resolve(true);
      } else {
        logger.error(`ztm join failed: ${stderr}`);
        resolve(false);
      }
    });

    child.on("error", (error) => {
      logger.error(`Failed to execute ztm join: ${error.message}`);
      resolve(false);
    });
  });
}

// Initialize runtime for an account
// Retries mesh connectivity check after join (ztm join causes brief disconnect)
async function initializeRuntime(
  config: ZTMChatConfig,
  accountId: string
): Promise<boolean> {
  const state = getOrCreateAccountState(accountId);
  state.config = config;

  try {
    const apiClient = createZTMApiClient(config);

    const MAX_RETRIES = 10;
    const RETRY_DELAY_MS = 2000;
    let meshInfo: ZTMMeshInfo | null = null;

    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      meshInfo = await apiClient.getMeshInfo();
      if (meshInfo.connected) break;
      if (attempt < MAX_RETRIES) {
        logger.info(
          `[${accountId}] Mesh not yet connected (attempt ${attempt}/${MAX_RETRIES}), retrying in ${RETRY_DELAY_MS}ms...`
        );
        await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS));
      }
    }

    state.apiClient = apiClient;
    state.connected = true;
    state.meshConnected = meshInfo!.connected;
    state.peerCount = meshInfo!.endpoints;
    state.lastError = meshInfo!.connected ? null : "Not connected to ZTM mesh";

    logger.info(
      `[${accountId}] Connected: mesh=${config.meshName}, peers=${meshInfo!.endpoints}`
    );

    if (meshInfo!.connected) {
      await startMessageWatcher(state);
    }

    return meshInfo!.connected;
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

  messageStateStore.flush();

  logger.info(`[${accountId}] Stopped`);
}

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
      await apiClient.sendPeerMessage(id, message);
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
      const success = await sendZTMMessage(state, peer, text);
      return {
        channel: "ztm-chat",
        ok: success,
        messageId: success ? generateMessageId() : "",
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
    } as any, // Extended properties not in base ChannelAccountSnapshot type
    collectStatusIssues: (accounts: ChannelAccountSnapshot[]): ChannelStatusIssue[] => {
      // Extract cfg and accountId from the accounts array context
      const firstAccount = accounts[0] as ChannelAccountSnapshot & { cfg?: OpenClawConfig };
      const cfg = firstAccount?.cfg;
      const accountId = firstAccount?.accountId;

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

      // Note: This is a synchronous check based on current state
      // For async probing, the status API would need to support async functions
      return issues;
    },
    buildChannelSummary: ({ snapshot }) => ({
      configured: snapshot.configured ?? false,
      running: snapshot.running ?? false,
      connected: (snapshot as ChannelAccountSnapshot).meshConnected ?? false,
      lastStartAt: snapshot.lastStartAt ?? null,
      lastStopAt: snapshot.lastStopAt ?? null,
      lastError: snapshot.lastError ?? null,
      lastInboundAt: snapshot.lastInboundAt ?? null,
      lastOutboundAt: snapshot.lastOutboundAt ?? null,
      peerCount: (snapshot as ChannelAccountSnapshot).peerCount ?? 0,
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

      const homeDir = process.env.HOME || "";
      const permitPath = `${homeDir}/.openclaw/ztm/permit.json`;
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
      try {
        const preCheck = await preCheckClient.getMeshInfo();
        alreadyConnected = preCheck.connected;
      } catch {
        // Agent reachable but mesh not joined yet
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
        const state = accountStates.get(account.accountId);
        throw new Error(state?.lastError ?? "Failed to initialize ZTM connection");
      }

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
      // (same pattern as Telegram/WhatsApp/iMessage built-in channels)
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
            throw error; // Re-throw so caller can be aware of failures
          }
        };

        // Handle inbound asynchronously, errors are logged and will be caught by global handler
        void handleInbound();
      };

      state.messageCallbacks.add(messageCallback);

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
