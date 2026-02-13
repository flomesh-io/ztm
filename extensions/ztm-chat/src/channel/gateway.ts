// ZTM Chat Gateway Implementation
// Gateway methods for starting, stopping, and managing accounts

import * as path from "node:path";
import * as fs from "fs";
import type {
  ChannelAccountSnapshot as BaseChannelAccountSnapshot,
  OpenClawConfig,
} from "openclaw/plugin-sdk";
import type {
  ZTMChatConfig,
  ZTMChatConfigValidation,
} from "../types/config.js";
import type { ZTMApiClient, ZTMMeshInfo, ZTMMessage } from "../api/ztm-api.js";
import type { AccountRuntimeState } from "../runtime/state.js";
import type { ZTMChatMessage } from "../messaging/inbound.js";
import {
  resolveZTMChatConfig,
  validateZTMChatConfig,
} from "../config/index.js";
import { isConfigMinimallyValid } from "../config/validation.js";
import { createZTMApiClient } from "../api/ztm-api.js";
import { isSuccess } from "../types/common.js";
import { logger } from "../utils/logger.js";
import {
  getAllAccountStates,
  initializeRuntime,
  stopRuntime,
  removeAccountState,
} from "../runtime/state.js";
import { startMessageWatcher } from "../messaging/inbound.js";
import { sendZTMMessage, generateMessageId } from "../messaging/outbound.js";
import { checkPortOpen, getPublicKeyFromIdentity, joinMesh } from "../connectivity/mesh.js";
import { requestPermit, savePermitData } from "../connectivity/permit.js";
import { getZTMRuntime } from "../runtime/index.js";
import {
  resolveZTMChatAccount,
} from "./config.js";

// ============================================================================
// Local Types
// ============================================================================

interface ChannelAccountSnapshot extends BaseChannelAccountSnapshot {
  meshConnected?: boolean;
  peerCount?: number;
}

interface ChannelStatusIssue {
  channel: string;
  accountId: string;
  kind: "config" | "intent" | "permissions" | "auth" | "runtime";
  level?: "error" | "warn" | "info";
  message: string;
}

// ============================================================================
// Inbound Context Builder
// ============================================================================

/**
 * Create inbound context payload for AI agent dispatch.
 * Centralized context construction to avoid code duplication.
 */
function createInboundContext(params: {
  rt: ReturnType<typeof getZTMRuntime>;
  msg: ZTMChatMessage;
  config: ZTMChatConfig;
  accountId: string;
  cfg?: Record<string, unknown>;
}) {
  const { rt, msg, config, accountId, cfg = {} } = params;

  const route = rt.channel.routing.resolveAgentRoute({
    channel: "ztm-chat",
    accountId,
    peer: { kind: "direct" as const, id: msg.sender },
    cfg,
  });

  return {
    ctxPayload: rt.channel.reply.finalizeInboundContext({
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
    }),
    matchedBy: route.matchedBy,
    agentId: route.agentId,
  };
}

// ============================================================================
// Status Issues
// ============================================================================

/**
 * Collect status issues for configured accounts
 */
export function collectStatusIssues(
  accounts: ChannelAccountSnapshot[],
): ChannelStatusIssue[] {
  if (!accounts || accounts.length === 0) {
    return [];
  }

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
}

// ============================================================================
// Probe Account
// ============================================================================

/**
 * Probe an account to check connectivity
 */
export async function probeAccountGateway({
  account,
  timeoutMs = 10000,
}: {
  account: { config: ZTMChatConfig };
  timeoutMs?: number;
}): Promise<{
  ok: boolean;
  error: string | null;
  meshInfo?: ZTMMeshInfo;
}> {
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
}

// ============================================================================
// Send Text Gateway
// ============================================================================

/**
 * Send text message gateway
 */
export async function sendTextGateway({
  to,
  text,
  accountId,
}: {
  to: string;
  text: string;
  accountId?: string;
}): Promise<{
  channel: string;
  ok: boolean;
  messageId: string;
  error?: string;
}> {
  const accountKey = accountId ?? "default";
  const accountStates = getAllAccountStates();
  const state = accountStates.get(accountKey);

  if (!state) {
    return {
      channel: "ztm-chat",
      ok: false,
      messageId: "",
      error: "Account not initialized",
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
}

// ============================================================================
// Start Account Gateway
// ============================================================================

/**
 * Handle inbound message dispatch to AI agent
 * Extracted from messageCallback to reduce nesting complexity
 */
async function handleInboundMessage(
  state: AccountRuntimeState,
  rt: ReturnType<typeof getZTMRuntime>,
  cfg: Record<string, unknown>,
  config: ZTMChatConfig,
  accountId: string,
  ctx: { log?: { info?: (...args: unknown[]) => void; error?: (...args: unknown[]) => void } },
  msg: ZTMChatMessage,
): Promise<void> {
  try {
    const { ctxPayload, matchedBy, agentId } = createInboundContext({ rt, msg, config, accountId, cfg });

    ctx.log?.info(
      `[${accountId}] Dispatching message from ${msg.sender} to AI agent (route: ${matchedBy})`,
    );

    const { queuedFinal } =
      await rt.channel.reply.dispatchReplyWithBufferedBlockDispatcher({
        ctx: ctxPayload,
        cfg,
        dispatcherOptions: {
          humanDelay: rt.channel.reply.resolveHumanDelayConfig(
            cfg,
            agentId,
          ),
          deliver: async (payload: { text?: string; mediaUrl?: string }) => {
            const replyText = payload.text ?? "";
            if (!replyText) return;
            const groupInfo = msg.isGroup && msg.groupName && msg.groupCreator
              ? { creator: msg.groupCreator, group: msg.groupName }
              : undefined;
            await sendZTMMessage(state, msg.sender, replyText, groupInfo);
            ctx.log?.info(
              `[${accountId}] Sent reply to ${msg.sender}: ${replyText.substring(0, 100)}${replyText.length > 100 ? "..." : ""}`,
            );
          },
          onError: (err: unknown) => {
            ctx.log?.error?.(
              `[${accountId}] Reply delivery failed for ${msg.sender}: ${String(err)}`,
            );
          },
        },
      });

    if (!queuedFinal) {
      ctx.log?.info(
        `[${accountId}] No response generated for message from ${msg.sender}`,
      );
    }
  } catch (error) {
    ctx.log?.error?.(
      `[${accountId}] Failed to dispatch message from ${msg.sender}: ${String(error)}`,
    );
  }
}

// ============================================================================

/**
 * Start account gateway implementation
 */
export async function startAccountGateway(
  ctx: { account: { config: ZTMChatConfig; accountId: string }; log?: { info?: (...args: unknown[]) => void; error?: (...args: unknown[]) => void }; cfg?: Record<string, unknown> },
): Promise<() => Promise<void>> {
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
    const portStr =
      agentUrlObj.port ||
      (agentUrlObj.protocol === "https:" ? "443" : "80");
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
      config.username,
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
    ctx.log?.info(
      `Already connected to mesh ${config.meshName}, skipping join`,
    );
  } else {
    ctx.log?.info(`Joining mesh ${config.meshName} as ${endpointName}...`);
    const joinSuccess = await joinMesh(
      config.meshName,
      endpointName,
      permitPath,
    );
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
    `[${account.accountId}] Connected to ZTM mesh "${config.meshName}" as ${config.username}`,
  );

  if (config.dmPolicy === "pairing") {
    const allowFrom = config.allowFrom ?? [];
    if (allowFrom.length === 0) {
      ctx.log?.info(
        `[${account.accountId}] Pairing mode active - no approved users. ` +
          `Users must send a message to initiate pairing. ` +
          `Approve users with: openclaw pairing approve ztm-chat <username>`,
      );
    } else {
      ctx.log?.info(
        `[${account.accountId}] Pairing mode active - ${allowFrom.length} approved user(s)`,
      );
    }
  }

  // Dispatch inbound messages to the AI agent via OpenClaw's reply pipeline
  const messageCallback = (msg: ZTMChatMessage) => {
    ctx.log?.info(
      `[${account.accountId}] Received message from ${msg.sender}: ${msg.content.substring(0, 100)}${msg.content.length > 100 ? "..." : ""}`,
    );

    void handleInboundMessage(state, rt, cfg, config, account.accountId, ctx, msg);
  };

  state.messageCallbacks.add(messageCallback);
  await startMessageWatcher(state);

  return async () => {
    state.messageCallbacks.delete(messageCallback);
    await stopRuntime(account.accountId);
  };
}

// ============================================================================
// Logout Account Gateway
// ============================================================================

/**
 * Logout account gateway implementation
 */
export async function logoutAccountGateway({
  accountId,
  cfg,
}: {
  accountId: string;
  cfg?: OpenClawConfig;
}): Promise<{ cleared: boolean }> {
  await stopRuntime(accountId);
  removeAccountState(accountId);
  return { cleared: true };
}

// ============================================================================
// Message Callback Builder
// ============================================================================

/**
 * Build message callback for account startup
 */
export function buildMessageCallback(
  state: AccountRuntimeState,
  accountId: string,
  config: ZTMChatConfig,
): (msg: ZTMChatMessage) => void {
  const rt = getZTMRuntime();

  return (msg: ZTMChatMessage) => {
    const handleInbound = async (): Promise<void> => {
      try {
        const { ctxPayload, matchedBy, agentId } = createInboundContext({ rt, msg, config, accountId });

        logger.info?.(
          `[${accountId}] Dispatching message from ${msg.sender} to AI agent (route: ${matchedBy})`,
        );

        const { queuedFinal } =
          await rt.channel.reply.dispatchReplyWithBufferedBlockDispatcher({
            ctx: ctxPayload,
            cfg: {},
            dispatcherOptions: {
              humanDelay: rt.channel.reply.resolveHumanDelayConfig(
                {},
                agentId,
              ),
              deliver: async (payload: {
                text?: string;
                mediaUrl?: string;
              }) => {
                const replyText = payload.text ?? "";
                if (!replyText) return;
                const groupInfo = msg.isGroup && msg.groupName && msg.groupCreator
                  ? { creator: msg.groupCreator, group: msg.groupName }
                  : undefined;
                await sendZTMMessage(state, msg.sender, replyText, groupInfo);
              },
              onError: (err: unknown) => {
                logger.error?.(
                  `[${accountId}] Reply delivery failed for ${msg.sender}: ${String(err)}`,
                );
              },
            },
          });

        if (!queuedFinal) {
          logger.info?.(
            `[${accountId}] No response generated for message from ${msg.sender}`,
          );
        }
      } catch (error) {
        logger.error?.(
          `[${accountId}] Failed to dispatch message from ${msg.sender}: ${String(error)}`,
        );
      }
    };

    void handleInbound();
  };
}
