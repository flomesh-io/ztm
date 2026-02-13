// ZTM Mesh connectivity management

import { spawn } from "child_process";
import * as net from "net";
import { logger } from "../utils/logger.js";

// Check if a TCP port is open
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

// Execute ztm identity command to get public key
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

// Execute ztm join command
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
