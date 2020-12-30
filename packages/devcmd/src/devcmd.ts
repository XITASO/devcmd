import { promises as fs } from "fs";
import { gray, bold, red } from "kleur/colors";
import { spawnSync } from "npm-run";
import path from "path";
import { withCmdOnWin } from "./utils/platform_utils";
import { getDevcmdVersion } from "./utils/version_utils";

const devCmdsDirName = "dev_cmds";

export function devcmd(...args: string[]) {
  printDevcmdHeader();
  assertInDevCmdsDir();
  assertArgsValid(args);

  const [scriptName, ...scriptArgs] = args;
  printScriptHeader(scriptName, scriptArgs);
  findAndRunScript(process.cwd(), scriptName, scriptArgs).catch((reason) => {
    const message = reason instanceof Error ? reason.message : `${reason}`;
    abort(message);
  });
}

function printDevcmdHeader() {
  process.stdout.write(gray(bold(`devcmd v${getDevcmdVersion()}`)));
}

function assertInDevCmdsDir() {
  const cwd = process.cwd();

  if (path.basename(cwd) !== devCmdsDirName) {
    const message = `\nThe devcmd function must be run inside the ${devCmdsDirName} directory, but CWD is: ${cwd}`;
    abort(message);
  }
}

function assertArgsValid(args: string[]): args is string[] {
  if (!args || args.length === 0) {
    abort("\nNo script specified.");
  }
  return true;
}

function printScriptHeader(scriptName: string, scriptArgs: string[]) {
  let argsString = "";
  if (!!scriptArgs && scriptArgs.length > 0) {
    argsString += gray(" with args [");
    argsString += (scriptArgs || []).map((a) => gray('"') + a + gray('"')).join(",");
    argsString += gray("]");
  }
  console.log(`${gray(": cmd")} ${scriptName}${argsString}`);
}

function abort(message: string, exitCode: number = 1): never {
  console.error(red(message));
  process.exit(exitCode);
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

const scriptRunners = [
  { extension: "ts", launcher: "ts-node" },
  { extension: "js", launcher: "node" },
];

async function findAndRunScript(devCmdsDir: string, commandName: string, commandArgs: string[]): Promise<void> {
  for (const { extension, launcher } of scriptRunners) {
    const scriptFilepath = path.join(devCmdsDir, `${commandName}.${extension}`);
    if (await isFile(scriptFilepath)) {
      // TODO: use spawn or so instead
      spawnSync(withCmdOnWin(launcher), [scriptFilepath, ...commandArgs], { stdio: "inherit" });

      return;
    }
  }

  const scriptFileCandidates = scriptRunners.map(({ extension }) => `${commandName}.${extension}`);
  const message = `No script file found for command '${commandName}'.
    ${devCmdsDirName} dir path: ${devCmdsDir}
    Script files tried: ${scriptFileCandidates.join(", ")}`;
  throw new Error(message);
}
