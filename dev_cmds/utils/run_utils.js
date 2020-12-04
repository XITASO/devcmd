"use strict";

/**
 * @param {string} message
 * @param {number} exitCode
 * @returns {never}
 */
function abort(message, exitCode = 1) {
  console.error(message);
  process.exit(exitCode);
}

/**
 * @param {() => Promise<void>} main
 */
function runAsyncMain(main) {
  main().catch((reason) => abort(reason));
}

module.exports = {
  runAsyncMain,
};
