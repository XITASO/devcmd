import { exec } from "devcmd";
import { YARN_COMMAND } from "./utils/commands";
import { repoRoot } from "./utils/directories";
import { runAsyncMain } from "./utils/run_utils";

async function main() {
  await exec({
    command: YARN_COMMAND,
    args: ["workspace", "devcmd", "jest"],
    options: {
      cwd: repoRoot,
    },
  });
}

runAsyncMain(main);
