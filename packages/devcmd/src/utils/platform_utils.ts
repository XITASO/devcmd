function isWindows(): boolean {
  return process.platform === "win32";
}

/**
 * Returns `${baseCmd}.cmd` in Windows, or just baseCmd otherwise.
 *
 * Many script-based external commands (e.g. bin scripts included with npm packages)
 * are .cmd files on Windows but extensionless executable files on other platforms.
 */
export function withCmdOnWin(baseCmd: string): string {
  return isWindows() ? `${baseCmd}.cmd` : baseCmd;
}
