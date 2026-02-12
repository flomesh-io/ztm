// ZTM Permit management

import * as fs from "fs";
import * as path from "path";
import { logger } from "../utils/logger.js";
import { getZTMRuntime } from "../runtime.js";
import type { ZTMMessage, ZTMApiClient } from "../api/ztm-api.js";
import type { AccountRuntimeState } from "../runtime/state.js";

// Request permit from permit server
export async function requestPermit(
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
export function savePermitData(permitData: unknown, permitPath: string): boolean {
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

// Handle pairing request - send a pairing request message to the peer
export async function handlePairingRequest(
  state: AccountRuntimeState,
  peer: string,
  context: string,
  storeAllowFrom: string[] = []
): Promise<void> {
  const { config, apiClient } = state;
  if (!apiClient) return;

  const normalizedPeer = peer.trim().toLowerCase();

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
  }

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
