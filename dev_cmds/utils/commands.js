"use strict";

/**
 * @returns {boolean}
 */
function isWindows() {
  return process.platform === "win32";
}

/**
 *
 * @param {string} baseCmd
 * @returns {string}
 */
function withCmdOnWin(baseCmd) {
  return isWindows() ? `${baseCmd}.cmd` : baseCmd;
}

const DEVCMD_COMMAND = withCmdOnWin("devcmd");
const DOCKER_COMMAND = "docker";
const NPM_COMMAND = withCmdOnWin("npm");
const YARN_COMMAND = withCmdOnWin("yarn");

module.exports = {
  DEVCMD_COMMAND,
  DOCKER_COMMAND,
  NPM_COMMAND,
  YARN_COMMAND,
};
