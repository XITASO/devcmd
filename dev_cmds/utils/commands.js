"use strict";

/**
 * @returns {number}
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

const YARN_COMMAND = withCmdOnWin("yarn");

module.exports = {
  YARN_COMMAND,
};
