import { ChildProcess, spawn } from "child_process";
import { Readable } from "stream";
import { createInterface } from "readline";
import { gray, red, reset, dim, bold, cyan, $ as kleur$ } from "kleur/colors";
import { formatCommandArgs, formatCommandName, Styler } from "../utils/format_utils";

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
    this.execInTty = this.execInTty.bind(this);
    this.execPiped = this.execPiped.bind(this);
    this.execPipedParallel = this.execPipedParallel.bind(this);
    this.execToString = this.execToString.bind(this);
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
  async execPipedParallel(processMap: { [id: string]: ProcessInfo } | { [id: number]: ProcessInfo }): Promise<void> {
    const processEntries = Object.entries(processMap);
    this.printNotice(`Beginning parallel execution of ${processEntries.length} processes...`);
    try {
      unwrapResults(
        await Promise.all([
          ...processEntries.map(([id, processInfo]) =>
            wrapResult(() => this.execPipedInternal(processInfo, cyan(`<${id}> `)))
          ),
        ])
      );
    } finally {
      this.printNotice("Finished parallel execution.");
    }
  }

  private printNotice(message?: any, ...optionalParams: any[]): void {
    this.consoleLike.error(noticeStyled(message), ...optionalParams);
  }

  private printError(message?: any, ...optionalParams: any[]): void {
    this.consoleLike.error(red(message), ...optionalParams);
  }

  private async execPipedInternal(processInfo: ProcessInfo, logPrefix: string): Promise<void> {
    const withPrefix = (line: string) => `${logPrefix}${line}`;
    const consoleLog = (line: string, ...params: any[]) => this.consoleLike.log(withPrefix(line), ...params);
    const consoleError = (line: string, ...params: any[]) => this.consoleLike.error(withPrefix(line), ...params);

    consoleError(noticeStyled(`Starting process: ${formatProcessInvocation(processInfo)}`));

    const options = processInfo.options ?? {};

    const childProcess = spawn(processInfo.command, processInfo.args ?? [], {
      cwd: options.cwd,
      env: {
        // Pass kleur's color support down to the child process
        FORCE_COLOR: kleur$.enabled ? "1" : "0",

        ...(options.env ?? process.env),
      },
    });

    const [code] = await Promise.all([
      childProcessCompletion(childProcess),
      logStream(childProcess.stdout, consoleLog),
      logStream(childProcess.stderr, consoleError),
    ]);

    if (code !== 0) {
      const commandName = formatProcessCommand(processInfo, identity, bold);
      const message = `Process ${commandName} exited with status code ${code}`;
      consoleError(red(message));
      throw new Error(message);
    }

    consoleError(noticeStyled(`Process ${formatProcessCommand(processInfo)} exited successfully.`));
  }

  async execInTty(processInfo: ProcessInfo): Promise<void> {
    this.printNotice(`Starting process: ${formatProcessInvocation(processInfo)} attached to TTY`);
    const options = processInfo.options ?? {};

    const childProcess = spawn(processInfo.command, processInfo.args ?? [], {
      cwd: options.cwd,
      stdio: "inherit",
      env: {
        ...(options.env ?? process.env),
      },
    });

    const code = await childProcessCompletion(childProcess);

    if (code !== 0) {
      const commandName = formatProcessCommand(processInfo, identity, bold);
      const message = `Process ${commandName} exited with status code ${code}`;
      this.printError(message);
      throw new Error(message);
    }

    this.printNotice(`Process ${formatProcessCommand(processInfo)} exited successfully.`);
  }

  async execToString(processInfo: ProcessInfo): Promise<{ stdout: string; stderr: string }> {
    this.printNotice(`Starting process: ${formatProcessInvocation(processInfo)} and capturing output`);
    const options = processInfo.options ?? {};

    let childStdout: string = "";
    let childStderr: string = "";

    const childProcess = spawn(processInfo.command, processInfo.args ?? [], {
      cwd: options.cwd,
      env: {
        ...(options.env ?? process.env),
      },
    });

    const processCompletion = childProcessCompletion(childProcess);

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
      this.printError(message);
      throw new Error(message);
    }

    this.printNotice(`Process ${formatProcessCommand(processInfo)} exited successfully.`);

    return { stdout: childStdout, stderr: childStderr };
  }
}

function childProcessCompletion(childProcess: ChildProcess): Promise<number | null> {
  return new Promise<number | null>((resolve, reject) => {
    childProcess.on("error", (err) => reject(err));
    childProcess.on("exit", (code) => resolve(code));
  });
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

function formatProcessCommand(
  processInfo: ProcessInfo,
  baseStyler: Styler = noticeStyled,
  highlightStyler: Styler = noticeHighlightStyled
): string {
  return formatCommandName(processInfo.command, baseStyler, highlightStyler);
}

function formatProcessInvocation(
  processInfo: ProcessInfo,
  baseStyler: Styler = noticeStyled,
  highlightStyler: Styler = noticeHighlightStyled
): string {
  return formatProcessCommand(processInfo) + " " + formatCommandArgs(processInfo.args, baseStyler, highlightStyler);
}

function identity<T>(x: T): T {
  return x;
}

function noticeStyled(s: string): string {
  return gray(s);
}

function noticeHighlightStyled(s: string): string {
  return reset(dim(bold(s)));
}
