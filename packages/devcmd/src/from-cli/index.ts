import { promises as fs } from "fs";
import { green } from "kleur";
import { gray, bold, red, reset } from "kleur/colors";
import { spawnSync } from "npm-run";
import path from "path";
import { formatCommandArgs, formatCommandName } from "../utils/format_utils";
import { getReservedCommand, reservedCommands } from "../reserved-cmds/get_reserved_command";
import { checkPackageAvailable } from "../utils/npm_utils";
import { withCmdOnWin } from "../utils/platform_utils";
import { getDevcmdVersion } from "../utils/version_utils";

const devCmdsDirName = "dev_cmds";

export async function run(...args: string[]) {
  printDevcmdHeader();
  assertInDevCmdsDir();
  assertArgsValid(args);

  const [scriptName, ...scriptArgs] = args;

  printScriptHeader(scriptName, scriptArgs);

  if (scriptName.length > 2 && scriptName.indexOf("--") === 0) {
    await runReserved(scriptName.slice(2), ...scriptArgs);
  } else {
    await runDevcmd(scriptName, ...scriptArgs);
  }
}

async function runDevcmd(scriptName: string, ...scriptArgs: string[]) {
  findAndRunScript(process.cwd(), scriptName, scriptArgs).catch((reason) => {
    const message = reason instanceof Error ? reason.message : `${reason}`;
    abort(message);
  });
}

async function runReserved(cmd: string, ...args: string[]) {
  assertReservedCmdExists(cmd);

  try {
    const cmdFn = getReservedCommand(cmd);
    await cmdFn();
  } catch (err) {
    abort(err);
  }
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

function assertReservedCmdExists(cmd: string) {
  if (!reservedCommands.includes(cmd)) {
    abort(`Command ${cmd} not found.`);
  }
}

function assertArgsValid(args: string[]): args is string[] {
  if (!args || args.length === 0) {
    abort(`\nNo script specified. Use ${green("devcmd --list")} to show available tasks.`);
  }
  return true;
}

function printScriptHeader(commandName: string, commandArgs: string[]) {
  const commandString = formatCommandName(commandName, gray, reset);
  const argsString =
    !!commandArgs && commandArgs.length > 0 ? gray(" with args ") + formatCommandArgs(commandArgs, gray, reset) : "";
  console.log(`${gray(": cmd")} ${commandString}${argsString}`);
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
      if (extension === "ts" && !(await checkPackageAvailable(launcher, devCmdsDir))) {
        throw new Error(`No script runner for TypeScript devcmds found. Did you forget to install ${bold(launcher)}?`);
      }

      // TODO: use spawn or so instead
      const { status } = spawnSync(withCmdOnWin(launcher), [scriptFilepath, ...commandArgs], {
        stdio: "inherit",
        cwd: devCmdsDir,
      });

      if (status !== null && status != 0) throw new Error(`Process failed with exit code ${status}`);

      return;
    }
  }

  const scriptFileCandidates = scriptRunners.map(({ extension }) => `${commandName}.${extension}`);
  const message = `No script file found for command '${commandName}'.
    ${devCmdsDirName} dir path: ${devCmdsDir}
    Script files tried: ${scriptFileCandidates.join(", ")}
    
    Use ${green("devcmd --list")} to show available tasks.`;
  throw new Error(message);
}
