import { execPiped, runAsyncMain } from "devcmd";
import { YARN_COMMAND } from "./utils/commands";
import { devcmdPackageDir, devDir } from "./utils/paths";
import fs from "fs-extra";

async function main() {
  if (!(await fs.pathExists(devDir))) {
    throw new Error("No development folder found!");
  }

  try {
    await execPiped({
      command: YARN_COMMAND,
      args: ["unlink", "devcmd"],
      options: {
        cwd: devDir,
      },
    });
  } catch {
    console.warn("Could not unlink devcmd from the development folder!");
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
    console.warn("Could not unlink the devcmd package!");
  }

  try {
    await fs.remove(devDir);
  } catch {
    console.warn("Could not remove the devlopment folder!");
  }
}

runAsyncMain(main);
