import { spawn } from "child_process";
import { withCmdOnWin } from "..";

export async function checkPackageAvailable(packageName: string, directory: string): Promise<boolean> {
  return new Promise<boolean>((res) => {
    // `npm ls <package_name>` only exits with status code 0 when <package_name> is available
    const childProcess = spawn(withCmdOnWin("npm"), ["ls", packageName], { cwd: directory });

    childProcess.on("error", (): void => res(false));
    childProcess.on("close", (code: number): void => res(code === 0));
  });
}
