import { execPiped, runAsyncMain } from "devcmd";
import { YARN_COMMAND } from "./utils/commands";
import { devcmdPackageDir, devPath } from "./utils/paths";
import fs from "fs-extra";

async function main() {
  if (!(await fs.pathExists(devPath))) {
    throw new Error("No development folder found!\n");
  }

  try {
    await execPiped({
      command: YARN_COMMAND,
      args: ["unlink", "devcmd"],
      options: {
        cwd: devPath,
      },
    });
  } catch {
    process.stdout.write("Could not unlink devcmd from the development folder!\n");
  }

  try {
    await execPiped({
      command: YARN_COMMAND,
      args: ["unlink"],
      options: {
        cwd: devcmdPackageDir,
      },
    });
  } catch {
    process.stdout.write("Could not unlink the devcmd package!\n");
  }

  try {
    await fs.remove(devPath);
  } catch {
    process.stdout.write("Could not remove the devlopment folder!\n");
  }
}

runAsyncMain(main);
