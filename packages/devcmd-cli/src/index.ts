import { promises as fs } from "fs";
import path from "path";
import { ChildProcess, spawn } from "child_process";

const devCmdsDirName = "dev_cmds";

export async function devcmdCli(): Promise<void> {
  for (const dir of iterateAncestorDirsToRoot(process.cwd())) {
    const candidate = path.resolve(dir, devCmdsDirName);
    if (await isDir(candidate)) {
      try {
        await runInDevCmdsDir(candidate);
      } catch (error) {
        const message = error instanceof Error ? error.message : `${error}`;
        abort(message);
      }

      return;
    }
  }
  // TODO: proper error handling
  abort(`No ${devCmdsDirName} directory found in CWD or any parent directories.`);
}

function abort(message: string, exitCode: number = 1): never {
  console.error(message);
  process.exit(exitCode);
}

function* iterateAncestorDirsToRoot(startDir: string): IterableIterator<string> {
  let dir = path.normalize(startDir);
  while (true) {
    yield dir;

    const parentDir = path.dirname(dir);
    if (dir === parentDir) break;
    dir = parentDir;
  }
}

async function isDir(path: string): Promise<boolean> {
  try {
    const info = await fs.stat(path);
    return info.isDirectory();
  } catch (error) {
    if (error.code === "ENOENT") return false; // TODO double-check code and comparison value
    throw error;
  }
}

async function startProcess(command: string, args: Array<string>, dirPath: string): Promise<number> {
  return new Promise<number>((resolve, reject) => {
    const processInstance: ChildProcess = spawn(command, args, {
      stdio: "inherit",
      cwd: dirPath,
    });

    processInstance.on("error", (err: Error): void => {
      // The 'error' event gets emitted when the process couldn't be spawned, killed or communicated with
      reject(err);
    });

    processInstance.on("close", (code: number): void => {
      if (code === 0) resolve(code);
      else reject(code);
    });
  });
}

// Note: if launching a node subprocess for the resolution should turn out to be a problem,
//   we could also use the npm module "resolve" to find the path ourselves (and e.g. require it in-process).
//   See https://yarnpkg.com/package/resolve
async function runInDevCmdsDir(dirPath: string): Promise<void> {
  const [, , ...args] = process.argv;

  try {
    await startProcess("node", ["-e", `require('devcmd/from-cli').run(...process.argv.slice(1))`, ...args], dirPath);
  } catch (err) {
    err instanceof Error ? abort(err.stack ?? err.message) : process.exit(1);
  }
}
