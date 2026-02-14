// Group Policy Types for ZTM Chat
// Defines types for group permissions and policy enforcement

/**
 * Group policy types
 */
export type GroupPolicy = 'open' | 'disabled' | 'allowlist';

/**
 * Tool policy for a group
 */
export interface GroupToolPolicy {
  /** Allowed tools (if specified, only these tools are allowed) */
  allow?: string[];
  /** Denied tools (if specified, these tools are explicitly denied) */
  deny?: string[];
}

/**
 * Per-sender tool policy overrides
 */
export interface GroupToolPolicyBySender {
  [sender: string]: {
    /** Additional tools to allow for this sender */
    alsoAllow?: string[];
    /** Explicitly denied tools for this sender */
    deny?: string[];
  };
}

/**
 * Group permissions configuration
 */
export interface GroupPermissions {
  /** Group creator (always has full access) */
  creator: string;
  /** Group ID */
  group: string;
  /** Group policy: open, disabled, or allowlist */
  groupPolicy: GroupPolicy;
  /** Whether @mention is required to trigger response */
  requireMention: boolean;
  /** Whitelist of allowed senders */
  allowFrom: string[];
  /** Tool restrictions for this group */
  tools?: GroupToolPolicy;
  /** Per-sender tool restrictions */
  toolsBySender?: GroupToolPolicyBySender;
}

/**
 * Result of group policy check
 */
export interface GroupMessageCheckResult {
  /** Whether the message is allowed to be processed */
  allowed: boolean;
  /** Reason for the result */
  reason: 'allowed' | 'denied' | 'whitelisted' | 'mention_required';
  /** Recommended action */
  action: 'process' | 'ignore';
  /** Whether the message contained a @mention */
  wasMentioned?: boolean;
}
