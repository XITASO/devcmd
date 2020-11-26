"use strict";

const { exec } = require("devcmd");
const { YARN_COMMAND } = require("./utils/commands");
const { repoRoot } = require("./utils/directories");

(async () => {
  try {
    await exec({
      command: YARN_COMMAND,
      args: ["workspace", "devcmd-cli", "build"],
      options: {
        cwd: repoRoot,
      },
    });

    await exec({
      command: YARN_COMMAND,
      args: ["workspace", "devcmd", "build"],
      options: {
        cwd: repoRoot,
      },
    });
  } catch (e) {
    console.error(e);
    process.exit(1);
  }
})();
