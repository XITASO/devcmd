import { promises as fs } from "fs";
import * as path from "path";

// TODO: this WIP code was moved over from the devcmd-cli part

const devCmdsDirName = "dev_cmds";

// export async function devcmd(): Promise<void> {
//   const devCmdsDir = await findClosestDevCmdsDir(process.cwd());

//   const [_, __, scriptName, ...scriptArgs] = process.argv;
//   // TODO: validate args (e.g. missing scriptName etc.)
//   await findAndRunScript(devCmdsDir, scriptName, scriptArgs);
// }

async function findClosestDevCmdsDir(startDir: string): Promise<string> {
  for (const dir of iterateAncestorDirsToRoot(startDir)) {
    const candidate = path.resolve(dir, devCmdsDirName);
    if (await isDir(candidate)) return candidate;
  }
  throw new Error(
    `No ${devCmdsDirName} directory found in CWD or any parent directories! (CWD=${process.cwd()})`
  );
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

async function isFile(path: string): Promise<boolean> {
  try {
    const info = await fs.stat(path);
    return info.isFile();
  } catch (error) {
    if (error.code === "ENOENT") return false; // TODO double-check code and comparison value
    throw error;
  }
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

async function findAndRunScript(
  devCmdsDir: string,
  scriptName: string,
  scriptArgs: string[]
): Promise<void> {
  {
    const scriptFilepath = path.join(devCmdsDir, `${scriptName}.js`);
    if (await isFile(scriptFilepath)) {
      // TODO run `node scriptFilepath ...scriptArgs`
    }
  }
}
