import { spawn } from "child_process";
import { Readable } from "stream";
import { createInterface } from "readline";
import chalk from "chalk";

export interface ProcessInfo {
  command: string;
  args?: string[];
  options?: {
    cwd?: string;
    env?: NodeJS.ProcessEnv;
  };
}

/**
 * /**
 * Executes a process and throws an exception if the exit code is non-zero.
 * Outputs (stdout/stderr) of the process are sent to our stdout/stderr.
 *
 * @param processInfo
 */
export async function exec(processInfo: ProcessInfo): Promise<void> {
  await execInternal(processInfo, "");
}

/**
 * Executes multiple processes in parallel and throws an exception if the exit code is non-zero.
 * Outputs (stdout/stderr) of the process are sent to our stdout/stderr.
 *
 * @param processEntries
 */
export async function execParallel(
  processEntries:
    | {
        [id: string]: ProcessInfo;
      }
    | { [id: number]: ProcessInfo }
): Promise<void> {
  console.log("Beginning parallel execution...");
  try {
    unwrapResults(
      await Promise.all([
        ...Object.entries(processEntries).map(([id, processInfo]) =>
          wrapResult(() => execInternal(processInfo, chalk.cyan(`<${id}> `)))
        ),
      ])
    );
  } finally {
    console.log("Finished parallel execution.");
  }
}

type Result = { ok: true } | { err: unknown };

function isErr(r: Result): r is { err: unknown } {
  return !isOk(r);
}

function isOk(r: Result): r is { ok: true } {
  return "ok" in r && r.ok;
}

async function wrapResult(func: () => Promise<void>): Promise<Result> {
  try {
    await func();
    return { ok: true };
  } catch (err) {
    return { err };
  }
}

function unwrapResults(results: Result[]): void {
  const errs = results.filter(isErr).map((r) => r.err);

  // For now, only rethrow the first error to get at least one correct stack trace.
  if (errs.length >= 1) throw errs[0];
}

async function execInternal(processInfo: ProcessInfo, logPrefix: string): Promise<void> {
  const withPrefix = (line: string) => `${logPrefix}${line}`;
  const consoleLog = (line: string, ...params: any[]) => console.log(withPrefix(line), ...params);
  const consoleError = (line: string, ...params: any[]) => console.error(withPrefix(line), ...params);

  consoleError("Starting process:", processInfo.command, JSON.stringify(processInfo.args));

  const options = processInfo.options ?? {};

  const childProcess = spawn(processInfo.command, processInfo.args ?? [], {
    cwd: options.cwd,
    env: {
      // Pass chalk's color support down to the child process
      FORCE_COLOR: chalk.supportsColor ? chalk.supportsColor.level.toString() : "0",

      ...(options.env ?? process.env),
    },
  });

  await Promise.all([logStream(childProcess.stdout, consoleLog), logStream(childProcess.stderr, consoleError)]);

  const code = await new Promise((resolve, reject) => {
    childProcess.on("error", (err) => reject(err));
    childProcess.on("exit", (code) => resolve(code));
  });

  if (code !== 0) {
    const message = `Process '${processInfo.command}' exited with status code ${code}`;
    consoleError(message);
    throw new Error(message);
  }

  consoleError(`Process '${processInfo.command}' exited successfully.`);
}

async function logStream(stream: Readable, log: (message: string) => void): Promise<void> {
  const lines = createInterface({
    input: stream,
    crlfDelay: Infinity, // Required to support Windows newlines
  });

  for await (const line of lines) {
    log(line);
  }
}
