// ZTM Mesh connectivity management
// Handles network connectivity checks and ZTM CLI command execution

import { spawn } from "child_process";
import * as net from "net";
import { logger } from "../utils/logger.js";

/**
 * Check if a TCP port is open and accepting connections.
 *
 * This is a basic connectivity check used to verify if a ZTM agent
 * is reachable at the specified host and port.
 *
 * @param hostname - The hostname or IP address to check
 * @param port - The port number to check
 * @returns Promise resolving to true if port is open, false otherwise
 *
 * @example
 * const isOpen = await checkPortOpen("localhost", 7777);
 * // isOpen: true if agent is running
 */
export async function checkPortOpen(hostname: string, port: number): Promise<boolean> {
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

/**
 * Execute the ZTM CLI identity command to retrieve the public key.
 *
 * This command reads the local ZTM identity from the system and extracts
 * the public key for use in permit requests and mesh authentication.
 *
 * @returns Promise resolving to the public key string if successful, null otherwise
 *
 * @example
 * const pubkey = await getPublicKeyFromIdentity();
 * // pubkey: "-----BEGIN PUBLIC KEY-----\nMIIBIj...\n-----END PUBLIC KEY-----"
 */
export async function getPublicKeyFromIdentity(): Promise<string | null> {
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

/**
 * Execute the ZTM CLI join command to connect to a mesh network.
 *
 * This command registers the bot with a ZTM mesh using the provided
 * permit file for authentication.
 *
 * @param meshName - The name of the mesh to join
 * @param endpointName - The name for this endpoint (usually the bot username)
 * @param permitPath - Path to the permit file for authentication
 * @returns Promise resolving to true if join was successful, false otherwise
 *
 * @example
 * const success = await joinMesh("my-mesh", "bot-1", "/path/to/permit.json");
 * // success: true if successfully joined
 */
export async function joinMesh(
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
