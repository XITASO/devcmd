import { execPiped } from "devcmd";
import { YARN_COMMAND } from "./utils/commands";
import { repoRoot } from "./utils/paths";
import { runAsyncMain } from "./utils/run_utils";

async function main() {
  await execPiped({
    command: YARN_COMMAND,
    args: ["workspace", "devcmd", "jest"],
    options: {
      cwd: repoRoot,
    },
  });
}

runAsyncMain(main);
