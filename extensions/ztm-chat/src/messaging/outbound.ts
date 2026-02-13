// Outbound message sending for ZTM Chat

import { logger } from "../utils/logger.js";
import { type ZTMMessage } from "../api/ztm-api.js";
import type { AccountRuntimeState } from "../runtime/state.js";
import { type Result } from "../types/common.js";
import { ZtmSendError } from "../types/errors.js";
import { handleResult } from "../utils/result.js";

export function generateMessageId(): string {
  return `ztm-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export async function sendZTMMessage(
  state: AccountRuntimeState,
  peer: string,
  content: string,
  groupInfo?: { creator: string; group: string }
): Promise<Result<boolean, ZtmSendError>> {
  if (!state.config || !state.apiClient) {
    const error = new ZtmSendError({
      peer,
      messageTime: Date.now(),
      cause: new Error("Runtime not initialized"),
    });
    state.lastError = error.message;
    return { ok: false, error };
  }

  const message: ZTMMessage = {
    time: Date.now(),
    message: content,
    sender: state.config.username,
  };

  let result: Result<boolean, ZtmSendError>;

  if (groupInfo) {
    result = await state.apiClient.sendGroupMessage(groupInfo.creator, groupInfo.group, message);
    handleResult(result, {
      operation: "sendGroupMessage",
      peer: `${groupInfo.creator}/${groupInfo.group}`,
      logger,
      onSuccess: () => {
        state.lastOutboundAt = new Date();
      },
      onError: (err) => {
        state.lastError = err.message;
      }
    });
  } else {
    result = await state.apiClient.sendPeerMessage(peer, message);
    handleResult(result, {
      operation: "sendPeerMessage",
      peer: state.accountId,
      logger,
      onSuccess: () => {
        state.lastOutboundAt = new Date();
      },
      onError: (err) => {
        state.lastError = err.message;
      }
    });
  }

  return result;
}
