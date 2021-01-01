function isWindows(): boolean {
  return process.platform === "win32";
}

function withCmdOnWin(baseCmd: string): string {
  return isWindows() ? `${baseCmd}.cmd` : baseCmd;
}

export const DEVCMD_COMMAND = withCmdOnWin("devcmd");
export const DOCKER_COMMAND = "docker";
export const GIT_COMMAND = "git";
export const NPM_COMMAND = withCmdOnWin("npm");
export const YARN_COMMAND = withCmdOnWin("yarn");
