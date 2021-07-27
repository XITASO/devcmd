import { execPiped, runAsyncMain } from "devcmd";
import { YARN_COMMAND } from "./utils/commands";
import { devcmdPackageDir, devDir, singlePackageJsonExampleDir } from "./utils/paths";
import fs from "fs-extra";

async function main() {
  if (await fs.pathExists(devDir)) {
    throw new Error(`A development folder already exists at ${devDir}!`);
  }

  try {
    await fs.copy(singlePackageJsonExampleDir, devDir, {
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
        cwd: devDir,
      },
    });

    await execPiped({
      command: YARN_COMMAND,
      args: ["install"],
      options: {
        cwd: devDir,
      },
    });
  } catch (e) {
    throw new Error(`Could not setup the dev environment! ${e}`);
  }
}

runAsyncMain(main);
