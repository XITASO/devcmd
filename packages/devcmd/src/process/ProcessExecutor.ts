import { spawn } from "child_process";
import { Readable } from "stream";
import { createInterface } from "readline";
import kleur from "kleur";

export interface ProcessInfo {
  command: string;
  args?: string[];
  options?: {
    cwd?: string;
    env?: NodeJS.ProcessEnv;
  };
}

export interface ConsoleLike {
  log(message?: any, ...optionalParams: any[]): void;
  error(message?: any, ...optionalParams: any[]): void;
}

class SafeConsoleLike implements ConsoleLike {
  constructor(private readonly consoleLike: ConsoleLike | undefined | null) {}

  log(message?: any, ...optionalParams: any[]): void {
    if (this.consoleLike) this.consoleLike.log(message, ...optionalParams);
  }
  error(message?: any, ...optionalParams: any[]): void {
    if (this.consoleLike) this.consoleLike.error(message, ...optionalParams);
  }
}

export class ProcessExecutor {
  private readonly consoleLike: ConsoleLike;

  constructor(consoleLike: ConsoleLike) {
    this.consoleLike = new SafeConsoleLike(consoleLike);
    this.execPiped = this.execPiped.bind(this);
    this.execPipedParallel = this.execPipedParallel.bind(this);
  }

  /**
   * Executes a process and throws an exception if the exit code is non-zero.
   * Outputs (stdout/stderr) of the process are sent to our stdout/stderr.
   */
  async execPiped(processInfo: ProcessInfo): Promise<void> {
    await this.execPipedInternal(processInfo, "");
  }

  /**
   * Executes multiple processes in parallel and throws an exception if the exit code is non-zero.
   * Outputs (stdout/stderr) of the processes are sent to our stdout/stderr.
   */
  async execPipedParallel(
    processEntries: { [id: string]: ProcessInfo } | { [id: number]: ProcessInfo }
  ): Promise<void> {
    this.consoleLike.error("Beginning parallel execution...");
    try {
      unwrapResults(
        await Promise.all([
          ...Object.entries(processEntries).map(([id, processInfo]) =>
            wrapResult(() => this.execPipedInternal(processInfo, kleur.cyan(`<${id}> `)))
          ),
        ])
      );
    } finally {
      this.consoleLike.error("Finished parallel execution.");
    }
  }

  private async execPipedInternal(processInfo: ProcessInfo, logPrefix: string): Promise<void> {
    const withPrefix = (line: string) => `${logPrefix}${line}`;
    const consoleLog = (line: string, ...params: any[]) => this.consoleLike.log(withPrefix(line), ...params);
    const consoleError = (line: string, ...params: any[]) => this.consoleLike.error(withPrefix(line), ...params);

    consoleError(
      kleur.gray(
        `Starting process: ${processInfo.command} ${!!processInfo.args ? JSON.stringify(processInfo.args) : ""}`
      )
    );

    const options = processInfo.options ?? {};

    const childProcess = spawn(processInfo.command, processInfo.args ?? [], {
      cwd: options.cwd,
      env: {
        // Pass kleur's color support down to the child process
        FORCE_COLOR: kleur.enabled ? "1" : "0",

        ...(options.env ?? process.env),
      },
    });

    const childStreamsPromise = Promise.all([
      logStream(childProcess.stdout, consoleLog),
      logStream(childProcess.stderr, consoleError),
    ]);

    const code = await new Promise((resolve, reject) => {
      childProcess.on("error", (err) => reject(err));
      childProcess.on("exit", (code) => resolve(code));
    });

    await childStreamsPromise;

    if (code !== 0) {
      const message = `Process '${processInfo.command}' exited with status code ${code}`;
      consoleError(kleur.red(message));
      throw new Error(message);
    }

    consoleError(kleur.gray(`Process '${processInfo.command}' exited successfully.\n`));
  }

  async execInTty(processInfo: ProcessInfo): Promise<void> {
    const options = processInfo.options ?? {};

    const childProcess = spawn(processInfo.command, processInfo.args ?? [], {
      cwd: options.cwd,
      stdio: "inherit",
      env: {
        ...(options.env ?? process.env),
      },
    });

    const code = await new Promise((resolve, reject) => {
      childProcess.on("error", (err) => reject(err));
      childProcess.on("exit", (code) => resolve(code));
    });

    if (code !== 0) {
      const message = `Process '${processInfo.command}' exited with status code ${code}`;
      this.consoleLike.error(kleur.red(message));
      throw new Error(message);
    }
  }

  async execToString(processInfo: ProcessInfo): Promise<{ stdout: string; stderr: string }> {
    const options = processInfo.options ?? {};

    let childStdout: string = "";
    let childStderr: string = "";

    const childProcess = spawn(processInfo.command, processInfo.args ?? [], {
      cwd: options.cwd,
      env: {
        ...(options.env ?? process.env),
      },
    });

    const processCompletion = new Promise<number | null>((resolve, reject) => {
      childProcess.on("error", (err) => reject(err));
      childProcess.on("exit", (code) => resolve(code));
    });

    const [code] = await Promise.all([
      processCompletion,
      logStream(childProcess.stdout, (line) => {
        childStdout += line + "\n";
      }),
      logStream(childProcess.stderr, (line) => {
        childStderr += line + "\n";
      }),
    ]);

    if (code !== 0) {
      const message =
        `Process '${processInfo.command}' exited with status code ${code}\n\n` +
        `STDOUT WAS:\n${childStdout}\n\n` +
        `STDERR WAS:\n${childStderr}\n\n`;
      this.consoleLike.error(kleur.red(message));
      throw new Error(message);
    }

    return { stdout: childStdout, stderr: childStderr };
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

async function logStream(stream: Readable, log: (message: string) => void): Promise<void> {
  const lines = createInterface({
    input: stream,
    crlfDelay: Infinity, // Required to support Windows newlines
  });

  for await (const line of lines) {
    log(line);
  }
}
