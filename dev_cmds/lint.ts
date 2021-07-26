import { execPiped, runAsyncMain } from "devcmd";
import { YARN_COMMAND } from "./utils/commands";
import { repoRoot } from "./utils/paths";

async function main() {
  await execPiped({
    command: YARN_COMMAND,
    args: ["prettier", "--check", "."],
    options: {
      cwd: repoRoot,
    },
  });
}

runAsyncMain(main);
