import { exec } from "devcmd";
import { YARN_COMMAND } from "./utils/commands";
import { repoRoot } from "./utils/paths";
import { runAsyncMain } from "./utils/run_utils";

async function main() {
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
}

runAsyncMain(main);
