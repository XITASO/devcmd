import { execPiped, runAsyncMain } from "devcmd";
import { YARN_COMMAND } from "./utils/commands";
import { devcmdPackageDir, devPath, singlePackageJsonExampleDir } from "./utils/paths";
import fs from "fs-extra";

async function main() {
  if (await fs.pathExists(devPath)) {
    throw new Error("A development folder already exists!\n");
  }

  try {
    await fs.copy(singlePackageJsonExampleDir, devPath, {
      // Only copy those files, for which the filter evaluates to true
      filter: (src) => !src.includes("node_modules"),
    });

    await execPiped({
      command: YARN_COMMAND,
      args: ["link"],
      options: {
        cwd: devcmdPackageDir,
      },
    });

    await execPiped({
      command: YARN_COMMAND,
      args: ["link", "devcmd"],
      options: {
        cwd: devPath,
      },
    });

    await execPiped({
      command: YARN_COMMAND,
      args: ["install"],
      options: {
        cwd: devPath,
      },
    });
  } catch {
    throw new Error("Could not setup the dev environment!");
  }
}

runAsyncMain(main);
