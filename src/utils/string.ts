/**
 * Truncates a string to maxLength and returns the result.
 * @param value - String to truncate
 * @param maxLength - Maximum length
 * @returns Truncated string
 */
export function truncate(value: string, maxLength: number): string {
  if (value.length <= maxLength) return value;
  return value.slice(0, maxLength);
}

/**
 * Pads a number with leading zeros to the given length.
 * @param num - Number to pad
 * @param length - Target length
 */
export function padStart(num: number, length: number): string {
  return String(num).padStart(length, '0');
}
