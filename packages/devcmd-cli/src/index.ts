import { promises as fs } from "fs";
import path from "path";
import { execFileSync } from "child_process";

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
  abort(
    `No ${devCmdsDirName} directory found in CWD or any parent directories.`
  );
}

function abort(message: string, exitCode: number = 1): never {
  console.error(message);
  process.exit(exitCode);
}

function* iterateAncestorDirsToRoot(
  startDir: string
): IterableIterator<string> {
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

// Note: if launching a node subprocess for the resolution should turn out to be a problem,
//   we could also use the npm module "resolve" to find the path ourselves (and e.g. require it in-process).
//   See https://yarnpkg.com/package/resolve
async function runInDevCmdsDir(dirPath: string) {
  const [, , ...args] = process.argv;
  const argString = args.map((s) => `"${s}"`).join(",");

  // TODO: use spawn or so instead
  execFileSync("node", ["-e", `require('devcmd').devcmd(${argString})`], {
    cwd: dirPath,
    stdio: "inherit",
  });
}
