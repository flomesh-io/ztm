# ZTM Chat Channel Plugin for OpenClaw

This plugin integrates OpenClaw with ZTM (Zero Trust Mesh) Chat, enabling decentralized P2P messaging through the ZTM network.

## Architecture

```mermaid
flowchart TB
    subgraph ZTM["ZTM Network"]
        User["ZTM User"]
        Mesh["P2P Mesh"]
    end

    subgraph OpenClaw["OpenClaw Gateway"]
        Plugin["ztm-chat Plugin"]
        Agent["AI Agent"]
    end

    User -->|"Message"| Mesh
    Mesh -->|"Storage API"| Plugin
    Plugin -->|"Route"| Agent
```

### Direct Storage Access (MVP)

This plugin uses **direct ZTM Mesh storage access** for messaging:

| Feature | Implementation |
|---------|---------------|
| Send Messages | `POST /api/setFileData/shared/{bot}/publish/peers/{peer}/messages/{id}` |
| Receive Messages | `GET /api/allFiles/shared/{peer}/publish/peers/{bot}/messages/` |
| User Discovery | `GET /api/allFiles/shared/*/publish/` |
| Real-Time Updates | Polling with configurable interval |

This approach provides full functionality via storage APIs, suitable for headless Gateway deployments.

- **Peer-to-Peer Messaging**: Send and receive messages with other ZTM users
- **Remote Connection**: Connect to ZTM Agent from anywhere via HTTP API
- **Secure**: Supports mTLS authentication with ZTM certificates
- **Decentralized**: Messages flow through the ZTM P2P network
- **Multi-Account**: Support for multiple ZTM bot accounts with isolated state
- **User Discovery**: Browse and discover other users in your ZTM mesh
- **Real-Time Updates**: Watch mechanism with polling fallback
- **Message Deduplication**: Prevents duplicate message processing
- **Structured Logging**: Context-aware logger with sensitive data filtering
- **Interactive Wizard**: CLI-guided configuration setup

## Quick Start

### Step 1: Install the Plugin

```bash
# Install from local source (development)
openclaw plugins install -l ./extensions/ztm-chat

# Or install from npm (when published)
# npm install -g @ztm/openclaw-ztm-chat
# openclaw plugins install @ztm/openclaw-ztm-chat
```

### Step 2: Run the Wizard (Recommended)

```bash
# After plugin is installed, run the wizard
npx ztm-chat-wizard

# Follow the on-screen prompts:
# 1. ZTM Agent URL
# 2. Mesh name
# 3. Bot username
# 4. mTLS configuration (optional)
# 5. Security settings
```

### Alternative: Manual Configuration

```bash
# 1. Create bot account on ZTM
ztm user add openclaw-bot

# 2. Create config file
cat > ~/.openclaw/channels/ztm-chat.json << 'EOF'
{
  "agentUrl": "https://your-ztm-agent.example.com:7777",
  "meshName": "your-mesh-name",
  "username": "openclaw-bot",
  "certificate": "${ZTM_CERTIFICATE}",
  "privateKey": "${ZTM_PRIVATE_KEY}",
  "enableGroups": false,
  "autoReply": true,
  "messagePath": "/shared"
}
EOF

# 3. Restart OpenClaw
openclaw restart
```

> **Note**: The wizard command `npx ztm-chat-wizard` only works after the plugin is installed.

## Prerequisites

1. ZTM Agent running (`ztm agent start`)
2. A dedicated ZTM user account for the bot
3. OpenClaw gateway installed (version 2026.1+ recommended)

## Interactive Wizard Guide

### Running the Wizard

The wizard is available after the plugin is installed:

```bash
# From OpenClaw's plugin directory
cd ~/.openclaw/plugins/ztm-chat
npx ztm-chat-wizard

# Or install globally (when published to npm)
npm install -g @ztm/openclaw-ztm-chat
ztm-chat-wizard
```

> **Note**: The wizard command requires the plugin to be installed first.

### Wizard Steps

The wizard guides you through 5 configuration steps:

| Step | Description | Options |
|------|-------------|---------|
| 1 | ZTM Agent URL | Default: `https://localhost:7777` |
| 2 | Mesh Name | Required, alphanumeric + `-_` |
| 3 | Bot Username | Default: `openclaw-bot` |
| 4 | mTLS Authentication | Y/N, loads cert/key from files |
| 5 | Security Settings | DM policy, allowFrom list |

### Example Session

```
🤖 ZTM Chat Setup Wizard
========================================

Step 1: ZTM Agent Connection
----------------------------
ZTM Agent URL [https://localhost:7777]: https://my-ztm-agent.company.com:7777

Testing connection...
✓ Connected to https://my-ztm-agent.company.com:7777

Step 2: Mesh Selection
----------------------
Mesh name: production-mesh

Step 3: Bot Username
-------------------
Bot username [openclaw-bot]: my-bot

Step 4: mTLS Authentication
----------------------------
Use mTLS authentication? (y/N): y
Certificate file path [~/ztm/cert.pem]: ~/ztm/bot-cert.pem
Private key file path [~/ztm/key.pem]: ~/ztm/bot-key.pem

✓ mTLS certificates loaded successfully

Step 5: Security Settings
------------------------
Direct Message Policy:
  [1] Allow messages from all users
  [2] Deny messages from all users
  [3] Require explicit pairing
Select: 1

Allow messages from (comma-separated, * for all) [*]: alice, bob, dev-team

Configuration Summary
--------------------
  Agent URL: https://my-ztm-agent.company.com:7777
  Mesh Name: production-mesh
  Username: my-bot
  mTLS: Enabled
  Auto Reply: true

Save this configuration? (Y/n):
Save to file [/home/user/.openclaw/channels/ztm-chat.json]:

✓ Configuration saved to /home/user/.openclaw/channels/ztm-chat.json
✓ ZTM Chat channel configured successfully!

Next steps:
  1. Restart OpenClaw: openclaw restart
  2. Check status: openclaw channels status ztm-chat
```

### Auto-Discovery

Discover existing ZTM configuration without running the wizard:

```bash
npx ztm-chat-discover

# Output:
📡 Discovered ZTM Configuration:
   Agent URL: https://ztm-agent.example.com:7777
   Mesh: production-mesh
   Username: my-bot

💡 To use this configuration, run: npx ztm-chat-wizard
```

### First-Run Detection

When you first install and register the plugin with OpenClaw, you'll see:

```
══════════════════════════════════════════════════════════════
  🤖 ZTM Chat - First Time Setup
══════════════════════════════════════════════════════════════

  To configure ZTM Chat, you have two options:

  1️⃣  Interactive Wizard (recommended)
     Run: npx ztm-chat-wizard

  2️⃣  Manual Configuration
     Edit: ~/.openclaw/channels/ztm-chat.json

  💡 Tip: Set CI=true to skip this message in CI/CD pipelines
══════════════════════════════════════════════════════════════
```

### Silent Mode (CI/CD)

Skip the first-run banner in automated environments:

```bash
# Skip banner during registration
CI=true openclaw restart

# Or set environment variable
export CI=true
openclaw restart
```

This is useful for Docker containers, CI/CD pipelines, and headless servers.

## CLI Commands

> **Note**: These commands require the plugin to be installed first.

### Plugin Commands

```bash
# Setup wizard (after plugin is installed)
npx ztm-chat-wizard
npx ztm-wizard  # Short alias

# Auto-discover existing configuration
npx ztm-chat-discover
npx ztm-discover  # Short alias
```

### OpenClaw Commands

```bash
# Check channel status
openclaw channels status ztm-chat

# List connected peers
openclaw channels directory ztm-chat peers

# View configuration
openclaw channels describe ztm-chat

# Probe connection
openclaw channels status ztm-chat --probe

# Enable/disable channel
openclaw channels disable ztm-chat
openclaw channels enable ztm-chat

# Pairing mode commands (when dmPolicy is "pairing")
openclaw channels approve ztm-chat <username>   # Approve a user
openclaw channels deny ztm-chat <username>     # Deny a pairing request
```

## Configuration Options

### Required Options

| Option | Type | Description |
|--------|------|-------------|
| `agentUrl` | string | ZTM Agent API URL (e.g., `https://ztm-agent.example.com:7777`) |
| `meshName` | string | Name of your ZTM mesh (alphanumeric + `-_`) |
| `username` | string | Bot's ZTM username (alphanumeric + `-_`) |

### Optional Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `certificate` | string | - | ZTM certificate (PEM format) for mTLS |
| `privateKey` | string | - | ZTM private key (PEM format) for mTLS |
| `enableGroups` | boolean | `false` | Enable group chat support |
| `autoReply` | boolean | `true` | Automatically reply to messages via AI agent |
| `messagePath` | string | `/shared` | Custom message path prefix |

### Security Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `dmPolicy` | string | `"pairing"` | DM policy: `"allow"`, `"deny"`, `"pairing"` |
| `allowFrom` | string[] | `[]` | List of approved usernames (whitelist) |

### Advanced Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `pollingInterval` | number | `2000` | Polling interval in ms (fallback mode) |

## Environment Variables

| Variable | Description |
|----------|-------------|
| `ZTM_CHAT_LOG_LEVEL` | Logging level: `debug`, `info`, `warn`, `error` |
| `ZTM_CERTIFICATE` | ZTM agent certificate (PEM format) |
| `ZTM_PRIVATE_KEY` | ZTM private key (PEM format) |
| `CI` | Set to `true` to skip first-run wizard banner |

## Configuration File Location

The wizard saves configuration to:
```
~/.openclaw/channels/ztm-chat.json
```

Example configuration:
```json
{
  "agentUrl": "https://ztm-agent.example.com:7777",
  "meshName": "production-mesh",
  "username": "my-bot",
  "certificate": "-----BEGIN CERTIFICATE-----...",
  "privateKey": "-----BEGIN PRIVATE KEY-----...",
  "enableGroups": false,
  "autoReply": true,
  "messagePath": "/shared",
  "dmPolicy": "pairing",
  "allowFrom": ["alice", "trusted-team"]
}
```

## Usage

### Sending a Message

From any ZTM user, send a message to your bot:

```
Hello! Can you help me with something?
```

The bot will respond through OpenClaw's AI agent.

### Pairing Mode

By default, the bot uses **pairing mode** (`dmPolicy: "pairing"`). This means:

1. **New users** must be approved before they can send messages
2. When an unapproved user sends a message, the bot sends them a pairing request
3. You approve users using the OpenClaw CLI

#### Approve a User

```bash
# Approve a specific user
openclaw channels approve ztm-chat alice

# After approval, restart to apply
openclaw restart
```

#### Deny a Pairing Request

```bash
# Deny a pairing request
openclaw channels deny ztm-chat bob
```

#### Check Status

```bash
# Basic status
openclaw channels status ztm-chat

# Detailed probe
openclaw channels status ztm-chat --probe

# View logs
openclaw logs --level debug --channel ztm-chat
```

#### Pairing Mode Policies

| Policy | Behavior |
|--------|----------|
| `allow` | Accept messages from all users (no approval needed) |
| `deny` | Reject messages from all users (except allowFrom list) |
| `pairing` | Require explicit approval for new users (recommended) |

To change the policy, edit `~/.openclaw/channels/ztm-chat.json`:

```json
{
  "dmPolicy": "pairing",
  "allowFrom": ["alice", "trusted-team"]
}
```

### Directory Operations

```bash
# List all peers
openclaw channels directory ztm-chat peers

# List groups (if enabled)
openclaw channels directory ztm-chat groups
```

## Message Flow

```mermaid
sequenceDiagram
    participant U as ZTM User
    participant M as ZTM Mesh
    participant P as Plugin
    participant A as AI Agent

    U->>M: 1. Send message
    M->>M: 2. Store to /shared/{peer}/publish/...
    P->>M: 3. Poll/watch for new messages
    M->>P: Return new messages
    P->>A: 4. Route message
    A->>P: 5. Generate response
    P->>M: 6. Store response to /shared/{bot}/publish/...
    M->>U: 7. Deliver to recipient
```

## API Endpoints

1. User sends message via ZTM
2. Message stored to mesh storage (`/shared/{peer}/publish/peers/{bot}/...`)
3. Plugin polls/watches for new messages via storage API
4. Message routed to OpenClaw agent
5. AI generates response
6. Response stored via storage API (`/shared/{bot}/publish/peers/{peer}/...`)
7. Recipient receives message via ZTM

## API Endpoints

The plugin uses these ZTM Agent API endpoints:

### Storage API (Direct Access)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/meshes/{meshName}` | Get mesh connection status |
| GET | `/api/allFiles{path}` | List files in a directory |
| POST | `/api/setFileData{path}` | Write data to a file |
| GET | `/api/getFileData{path}` | Read file contents |
| GET | `/api/watch{prefix}` | Watch for path changes |

### Message Paths

| Direction | Path Pattern | Description |
|-----------|-------------|-------------|
| Send | `/shared/{bot}/publish/peers/{peer}/messages/{time}-{sender}.json` | Bot publishes to peer |
| Receive | `/shared/{peer}/publish/peers/{bot}/messages/*.json` | Peers publish to bot |
| Discovery | `/shared/*/publish/` | Scan for active users |

### Filtering

When receiving messages, filtering is applied client-side:

| Parameter | Description |
|-----------|-------------|
| `since` | Only return messages after this timestamp |
| `before` | Only return messages before this timestamp |

## Troubleshooting

### Connection Failed

1. Verify ZTM Agent is running:
   ```bash
   curl https://your-ztm-agent.example.com:7777/api/meshes
   ```

2. Check mesh name matches:
   ```bash
   ztm get mesh
   ```

3. Verify credentials:
   ```bash
   echo "$ZTM_CERTIFICATE" | head -1
   ```

4. Check plugin logs:
   ```bash
   openclaw logs --level debug --channel ztm-chat
   ```

### No Messages Received

1. Check bot username is correct in configuration
2. Verify ZTM Agent is running and connected to the mesh:
   ```bash
   curl https://your-ztm-agent:7777/api/meshes
   ```

3. Check mesh connectivity:
   ```bash
   openclaw channels status ztm-chat --probe
   ```

4. Verify your mesh has other endpoints:
   ```bash
   curl https://your-ztm-agent:7777/api/meshes/your-mesh
   ```

### Certificate Errors (mTLS)

1. Verify certificate is not expired:
   ```bash
   openssl x509 -in <(echo "$ZTM_CERTIFICATE") -noout -dates
   ```

2. Check certificate matches the private key:
   ```bash
   openssl x509 -noout -modulus -in <(echo "$ZTM_CERTIFICATE") | openssl md5
   openssl rsa -noout -modulus -in <(echo "$ZTM_PRIVATE_KEY") | openssl md5
   ```

## Security Best Practices

1. **Use mTLS in production**: Configure `certificate` and `privateKey` for production deployments
2. **Restrict allowFrom**: Limit which ZTM users can trigger the bot
3. **Use environment variables**: Never commit credentials to version control
4. **Regular certificate rotation**: Rotate certificates periodically

### Storage Access Model

The plugin uses ZTM's shared storage (`/shared/*`) for messaging:

- `/shared/*` paths are **open by default** to all mesh members
- The plugin does **not** set ACLs on messages
- This is a trade-off: enables operation without additional apps, but means any mesh member could potentially access these paths

**Current Mitigations**:
- ZTM transport-layer authentication (mTLS)
- `allowFrom` whitelist in plugin configuration
- `dmPolicy: "pairing"` mode for explicit user approval

### Known Limitation: Message Signature Verification

**Status**: ⚠️ Not Implemented

ZTM is a peer-to-peer network where messages may pass through multiple relay nodes:

```
Alice → [Node A] → [Node B] → [Node C] → Bot
```

The plugin does **not** currently verify message signatures at the application layer.

**Risk Assessment**: **Low** for typical internal/network deployments (assuming trusted mesh members).

## Feature Status

### Completed Features

| Feature | Status | Description |
|---------|--------|-------------|
| Peer-to-Peer Messaging | ✅ Done | Send/receive messages with ZTM users |
| Remote Connection | ✅ Done | HTTP API connection to ZTM Agent |
| mTLS Authentication | ✅ Done | Certificate-based mutual TLS auth |
| Interactive Wizard | ✅ Done | CLI-guided 5-step configuration |
| Message Deduplication | ✅ Done | Automatic duplicate prevention |
| Structured Logging | ✅ Done | Context-aware logging with redaction |
| Real-Time Updates | ✅ Done | Watch mechanism with polling fallback |
| First-Run Detection | ✅ Done | Auto-show welcome banner on install |
| CI/CD Silent Mode | ✅ Done | Skip banner with `CI=true` |
| Mock ZTM Agent | ✅ Done | Test infrastructure for development |
| Configuration Discovery | ✅ Done | Auto-detect existing ZTM setup |
| User Discovery | ✅ Done | Browse mesh users via API |
| Direct Storage Access | ✅ Done | Uses `/api/allFiles` and `/api/setFileData` for messaging |

### Planned Features

| Feature | Status | Description |
|---------|--------|-------------|
| Group Chat Support | 🔜 Planned | Enable `enableGroups` for group messages |
| Message Signatures | ⚠️ Planned | Application-layer signature verification |
| DM Policy Enforcement | 🔜 Planned | Full `dmPolicy` implementation |
| Webhook Integration | 🔜 Planned | HTTP callbacks for events |
| Rich Media Messages | 🔜 Planned | Support images, files, etc. |
| Message Encryption | ⚠️ Planned | End-to-end encrypted messages |

### Legend

- ✅ **Done**: Fully implemented and tested
- 🔜 **Planned**: On the roadmap, partial or coming soon
- ⚠️ **Known Limitation**: Identified but not yet implemented

## Development

### Running Tests

```bash
cd extensions/ztm-chat
npm install
npm test          # Run all tests (182 tests)
npm test:watch    # Watch mode for development
```

### Testing Infrastructure

The plugin includes a mock ZTM Agent server for testing:

```typescript
import { MockZTMClient, createMockConfig } from "./mocks/ztm-client.js";

const client = new MockZTMClient(createMockConfig());
await client.start();

// Simulate storage API calls
const messages = await fetch(`${client.url}/api/allFiles/shared/alice/publish/peers/bot/messages/`);

await client.stop();
```

### Test Coverage

```
Test Files  7 passed (7)
      Tests  182 passed (182)

覆盖率:
- ZTM API Client: 40 tests
- Configuration: 56 tests
- Channel Plugin: 23 tests
- Wizard: 15 tests
- Logger: 15 tests
- Runtime: 17 tests
- Index: 16 tests
```

### Debug Logging

```bash
ZTM_CHAT_LOG_LEVEL=debug openclaw restart
```

### Project Structure

```
ztm-chat/
├── index.ts              # Plugin entry point with CLI commands (190 lines)
├── index.test.ts         # Index.ts tests (16 tests)
├── package.json          # NPM package config
├── README.md             # This file
└── src/
    ├── channel.ts        # Main channel adapter (917 lines)
    ├── config.ts         # Configuration schema & validation (TypeBox)
    ├── ztm-api.ts       # ZTM Agent API client (481 lines)
    ├── logger.ts         # Structured logging
    ├── runtime.ts        # Runtime management
    ├── wizard.ts         # Interactive setup wizard (520 lines)
    ├── mocks/
    │   └── ztm-client.ts # Mock ZTM Agent for testing (282 lines)
    └── *.test.ts         # Unit & integration tests (182 tests total)
```
                index.test.ts
```

## License

MIT
