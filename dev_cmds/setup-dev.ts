import { execPiped, runAsyncMain } from "devcmd";
import { YARN_COMMAND } from "./utils/commands";
import { devcmdPackageDir, devPath, singlePackageJsonExampleDir } from "./utils/paths";
import fs from "fs-extra";

async function main() {

  if(await fs.pathExists(devPath)) {
    process.stderr.write('A development folder already exists!\n')
    process.exit(1)
  }

  await fs.copy(
    singlePackageJsonExampleDir,
    devPath,
    {
      // Only copy those files, for which the filter evaluates to true
      filter: (src) => !src.includes('node_modules')
    }
  );

  try {
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
    process.stderr.write("Could not setup the dev environment!");
    process.exit(1);
  }
}

runAsyncMain(main);
