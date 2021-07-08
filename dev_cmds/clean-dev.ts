import { execPiped, runAsyncMain } from "devcmd";
import { YARN_COMMAND } from "./utils/commands";
import { devcmdPackageDir, devPath } from "./utils/paths";
import fs from "fs-extra";

async function main() {

  if(!await fs.pathExists(devPath)) {
    process.stderr.write('No development folder found!\n')
    process.exit(1)
  }

  try {
    await execPiped({
      command: YARN_COMMAND,
      args: ["unlink", "devcmd"],
      options: {
        cwd: devPath,
      },
    });
  } catch {}

  try {
    await execPiped({
      command: YARN_COMMAND,
      args: ["unlink"],
      options: {
        cwd: devcmdPackageDir,
      },
    });
  } catch {}

  try {
    await fs.remove(
      devPath
    );
  } catch {}
}

runAsyncMain(main);
