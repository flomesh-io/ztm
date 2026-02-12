import type { ConfigValidationError, ValidationErrorReason } from "../types/config.js";

/**
 * Create a validation error for a specific field
 */
export function validationError(
  field: string,
  reason: ValidationErrorReason,
  value: unknown,
  message: string
): ConfigValidationError {
  return { field, reason, value, message };
}

/**
 * Validate a URL string and return whether it's valid
 */
export function isValidUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

/**
 * Validate a URL string and return a Result
 */
export function validateUrl(
  url: string
): { valid: true; value: string } | { valid: false; error: ConfigValidationError } {
  try {
    new URL(url);
    return { valid: true, value: url };
  } catch {
    return {
      valid: false,
      error: validationError("url", "invalid_format", url, "Invalid URL format"),
    };
  }
}

/**
 * Validate a URL must start with http:// or https://
 */
export function validateHttpsUrl(
  url: string
): { valid: true; value: string } | { valid: false; error: ConfigValidationError } {
  if (!url.startsWith("https://") && !url.startsWith("http://")) {
    return {
      valid: false,
      error: validationError(
        "url",
        "invalid_format",
        url,
        "URL must start with https:// or http://"
      ),
    };
  }
  return validateUrl(url);
}
