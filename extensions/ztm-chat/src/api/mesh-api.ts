// Mesh operations API for ZTM Chat

import type { ZTMChatConfig } from "../types/config.js";
import type { ZTMUserInfo, ZTMPeer, ZTMMeshInfo } from "../types/api.js";
import { success, failure, isSuccess, type Result } from "../types/common.js";
import {
  ZtmDiscoveryError,
  ZtmApiError,
  ZtmTimeoutError,
} from "../types/errors.js";
import type { ZtmLogger, RequestHandler } from "./request.js";

/**
 * Create mesh operations API
 */
export function createMeshApi(
  config: ZTMChatConfig,
  request: RequestHandler,
  logger: ZtmLogger
) {
  const CHAT_API_BASE = `/api/meshes/${config.meshName}/apps/ztm/chat/api`;

  async function getMeshInfo(): Promise<Result<ZTMMeshInfo, ZtmApiError | ZtmTimeoutError>> {
    return request<ZTMMeshInfo>("GET", `/api/meshes/${config.meshName}`);
  }

  async function listUsers(): Promise<Result<ZTMUserInfo[], ZtmDiscoveryError>> {
    logger.debug?.(`[ZTM API] Discovering users via Chat App API`);

    const result = await request<string[]>("GET", `${CHAT_API_BASE}/users`);

    if (!result.ok) {
      logger.error?.(`[ZTM API] Failed to list users: ${result.error?.message ?? "Unknown error"}`);
      return failure(new ZtmDiscoveryError({
        operation: "discoverUsers",
        source: "ChatAppAPI",
        cause: result.error ?? new Error("Unknown error"),
      }));
    }

    const users = (result.value ?? []).map(username => ({ username }));
    logger.debug?.(`[ZTM API] Discovered ${users.length} users`);
    return success(users);
  }

  async function discoverUsers(): Promise<Result<ZTMUserInfo[], ZtmDiscoveryError>> {
    return listUsers();
  }

  async function discoverPeers(): Promise<Result<ZTMPeer[], ZtmDiscoveryError>> {
    const usersResult = await listUsers();
    const usersError = usersResult.error;
    if (isSuccess(usersResult) && usersResult.value) {
      return success(usersResult.value.map(u => ({ username: u.username })));
    }
    const error = usersError ?? new ZtmDiscoveryError({ operation: "discoverPeers", source: "ChatAppAPI", cause: new Error("Failed to discover peers") });
    return failure(error);
  }

  return {
    getMeshInfo,
    listUsers,
    discoverUsers,
    discoverPeers,
  };
}
