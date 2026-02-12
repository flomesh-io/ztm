// ZTM Chat Channel Plugin
// Main plugin definition implementing ChannelPlugin interface

import type {
  ChannelPlugin,
  ChannelAccountSnapshot as BaseChannelAccountSnapshot,
} from "openclaw/plugin-sdk";
import { ZTMChatConfigSchema } from "../config/index.js";
import type { ZTMChatConfig } from "../types/config.js";
import type { ZTMMessage } from "../api/ztm-api.js";
import {
  container,
  DEPENDENCIES,
  createLogger,
  createConfigService,
  createApiClientService,
  createApiClientFactory,
  createRuntimeService,
  type ILogger,
  type IConfig,
  type IApiClient,
  type IApiClientFactory,
  type IRuntime,
} from "../di/index";
import type { ResolvedZTMChatAccount } from "./config.js";

// Local type extension for ChannelAccountSnapshot with additional properties
interface ChannelAccountSnapshot extends BaseChannelAccountSnapshot {
  meshConnected?: boolean;
  peerCount?: number;
}

// Local type for status issues
interface ChannelStatusIssue {
  channel: string;
  accountId: string;
  kind: "config" | "intent" | "permissions" | "auth" | "runtime";
  level?: "error" | "warn" | "info";
  message: string;
}

// ============================================================================
// Meta Information
// ============================================================================

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

// ============================================================================
// DEPENDENCY INJECTION
// ============================================================================
// Initialize services on module load
container.register(DEPENDENCIES.LOGGER, createLogger("ztm-chat"));
container.register(DEPENDENCIES.CONFIG, createConfigService());
container.register(DEPENDENCIES.API_CLIENT, createApiClientService());
container.register(DEPENDENCIES.API_CLIENT_FACTORY, createApiClientFactory());
container.register(DEPENDENCIES.RUNTIME, createRuntimeService());

// ============================================================================
// Resolved Account Type
// ============================================================================

// ============================================================================
// Helper Functions (imported from other modules)
// ============================================================================

// These will be imported from other channel modules
import {
  resolveZTMChatAccount,
  listZTMChatAccountIds,
  getEffectiveChannelConfig,
  buildChannelConfigSchemaWithHints,
} from "./config.js";
import {
  isConfigMinimallyValid,
} from "../config/index.js";
import { isSuccess } from "../types/common.js";
import {
  collectStatusIssues as collectStatusIssuesImpl,
  probeAccountGateway,
  startAccountGateway,
  logoutAccountGateway,
} from "./gateway.js";
import {
  buildAccountSnapshot as buildAccountSnapshotImpl,
} from "./state.js";

// ============================================================================
// Channel Plugin Definition
// ============================================================================

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
      const logger = container.get<ILogger>(DEPENDENCIES.LOGGER);
      const apiClient = container.get<IApiClient>(DEPENDENCIES.API_CLIENT);
      const runtime = container.get<IRuntime>(DEPENDENCIES.RUNTIME);
      const message: ZTMMessage = {
        time: Date.now(),
        message: `Pairing approved! You can now send messages to this bot.`,
        sender: config.username,
      };
      const result = await apiClient.sendPeerMessage(id, message);
      if (!result.ok) {
        logger.warn?.(
          `[ZTM] Failed to send pairing approval message to ${id}: ${result.error?.message}`,
        );
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
    isConfigured: (account) =>
      isConfigMinimallyValid(account.config as ZTMChatConfig),
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
        String(entry),
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
      const channelsConfig = (cfg || {}) as {
        channels?: { "ztm-chat"?: { accounts?: Record<string, unknown> } };
      };
      const useAccountPath = Boolean(
        channelsConfig.channels?.["ztm-chat"]?.accounts?.[resolvedAccountId],
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
          "No allowFrom configured - accepting messages from any ZTM user",
        );
      }

      // Try to probe the connection
      try {
        const logger = container.get<ILogger>(DEPENDENCIES.LOGGER);
        const apiClientFactory = container.get<IApiClientFactory>(DEPENDENCIES.API_CLIENT_FACTORY);
        const probeConfig = resolveZTMChatAccount({ cfg, accountId }).config;
        const apiClient = apiClientFactory(probeConfig, { logger });
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
            `ZTM Agent has ${meshInfo.errors.length} error(s): ${meshInfo.errors[0].message}`,
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
      // Import from gateway module
      const { sendTextGateway } = await import("./gateway.js");
      return sendTextGateway({ to, text, accountId });
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
      return collectStatusIssuesImpl(accounts);
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
      return probeAccountGateway({ account, timeoutMs });
    },
    buildAccountSnapshot: ({ account }) => {
      return buildAccountSnapshotImpl({ account });
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
      const logger = container.get<ILogger>(DEPENDENCIES.LOGGER);
      const apiClientFactory = container.get<IApiClientFactory>(DEPENDENCIES.API_CLIENT_FACTORY);
      const apiClient = apiClientFactory(config, { logger });

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
      return startAccountGateway(ctx);
    },
    logoutAccount: async ({ accountId, cfg }) => {
      return logoutAccountGateway({ accountId, cfg });
    },
  },
};
