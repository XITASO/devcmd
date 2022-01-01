import { ChildProcess, spawn } from "child_process";
import { Readable } from "stream";
import { createInterface } from "readline";
import { gray, red, reset, dim, bold, cyan, $ as kleur$ } from "kleur/colors";
import { formatCommandArgs, formatCommandName, Styler } from "../utils/format_utils";

/**
 * Handling of non-zero exit codes of executed processes.
 *
 * * `"printErrorAndThrow"`: Emit a message about the non-zero exit code as an
 *   error to the console, and throw the same message as an `Error`.
 * * `"printNoticeAndReturn"`: Emit a message about the non-zero exit code as a
 *   notice to the console and return the non-zero exit code. No error is thrown.
 * */
export type NonZeroExitCodeHandling = "printErrorAndThrow" | "printNoticeAndReturn";

/** Information describing how to execute a process. */
export interface ProcessInfo {
  /** Command to execute, usually the executable name. */
  command: string;
  /** Arguments to pass to the command, if any. */
  args?: string[];
  /** Options modifying the way the process is executed. */
  options?: {
    /** Working directory for the process. Defaults to caller's current working directory. */
    cwd?: string;
    /** Dictionary of environment variables. Defaults to caller's environment.
     * If specified, caller's environment is not automatically included, so caller
     * needs to do this if desired. */
    env?: NodeJS.ProcessEnv;
    /** Specifies how to handle a non-zero exit code. */
    nonZeroExitCodeHandling?: NonZeroExitCodeHandling;
  };
}

export type LogFunction = (message?: any, ...optionalParams: any[]) => void;

/**
 * An interface that describes the behavior of a target,
 * that can display log and error messages.
 */
export interface ConsoleLike {
  log: LogFunction;
  error: LogFunction;
}

/**
 * Facilities to execute single or multiple external processes
 * with flexible forwarding of child process output.
 */
export class ProcessExecutor {
  private readonly consoleLike: ConsoleLike;
  private readonly logger: Logger;

  constructor(consoleLike: ConsoleLike) {
    this.consoleLike = new SafeConsoleLike(consoleLike);
    this.logger = new Logger(this.consoleLike.error.bind(this.consoleLike));
    this.execInTty = this.execInTty.bind(this);
    this.execPiped = this.execPiped.bind(this);
    this.execPipedParallel = this.execPipedParallel.bind(this);
    this.execToString = this.execToString.bind(this);
  }

  /**
   * Executes a process and pipes its outputs (stdout/stderr) to the log/error level of
   * this instance's {@link ConsoleLike}.
   *
   * The "nonZeroExitCodeHandling" option of the given {@link ProcessInfo} determines
   * whether this method throws on a non-zero exit code.
   *
   * **Example:** Running a ping against localhost:
   * ```
   * await execPiped({ command: 'ping', args: ['127.0.0.1'] });
   * ```
   *
   * **Example:** Deleting a Docker container and ignoring non-zero exit codes (e.g. when
   * container does not exit):
   * ```
   * await execPiped({
   *   command: 'docker',
   *   args: ['rm', '--force', 'myContainerName'],
   *   options: { nonZeroExitCodeHandling: "printNoticeAndReturn" },
   * });
   * ```
   *
   * @param processInfo Information about the process to execute
   * @returns A promise resolving to an object with exit status info once the process exits
   */
  async execPiped(processInfo: ProcessInfo): Promise<NodeExitInfo> {
    return await this.execPipedInternal(processInfo, "");
  }

  /**
   * Executes multiple processes in parallel and pipes their outputs (stdout/stderr) to the
   * log/error level of this instance's {@link ConsoleLike}.
   *
   * The "nonZeroExitCodeHandling" option of the given {@link ProcessInfo}s determines
   * whether this method throws on a non-zero exit code. This option applies to each process
   * _individually_, so in a single call some processes can ignore non-zero exit codes while
   * others throw an error.
   *
   * **Example:** Printing node and npm version to the console:
   * ```
   * await execPipedParallel({
   *   nodeVersion: { command: "node", args: ["-v"] },
   *   npmVersion: { command: "npm", args: ["--version"] },
   * });
   * ```
   *
   * @param processMap A map of a caller-defined process ID to {@link ProcessInfo} for each
   * process to execute. The given process IDs are used for console output and in the
   * returned map of exit status infos.
   *
   * @returns A promise resolving to a map of the process ID (from `processMap`) to exit
   * status info, once all processes have exited
   */
  async execPipedParallel<T extends { [id: string]: ProcessInfo }>(
    processMap: T
  ): Promise<{ [id in keyof T]: NodeExitInfo }>;

  /**
   * Executes multiple processes in parallel and pipes their outputs (stdout/stderr) to the
   * log/error level of this instance's {@link ConsoleLike}.
   *
   * The "nonZeroExitCodeHandling" option of the given {@link ProcessInfo}s determines
   * whether this method throws on a non-zero exit code. This option applies to each process
   * _individually_, so in a single call some processes can ignore non-zero exit codes while
   * others throw an error.
   *
   * **Example:** Printing node and npm version to the console:
   * ```
   * await execPipedParallel({
   *   nodeVersion: { command: "node", args: ["-v"] },
   *   npmVersion: { command: "npm", args: ["--version"] },
   * });
   * ```
   *
   * @param processList A list of one {@link ProcessInfo} for each process to execute.
   * The indexes in this array are used for console output.
   *
   * @returns A promise resolving to a list of exit status infos, one for each process in
   * the same order as `processList`, once all processes have exited
   */
  async execPipedParallel(processList: ProcessInfo[]): Promise<NodeExitInfo[]>;

  /** Implementation for the two overload signatures above. */
  async execPipedParallel(
    processMapOrList: ProcessInfo[] | { [id: string]: ProcessInfo }
  ): Promise<NodeExitInfo[] | { [id: string]: NodeExitInfo }> {
    const processEntries = Object.entries(processMapOrList);
    this.logger.notice(`Beginning parallel execution of ${processEntries.length} processes...`);
    let results: NodeExitInfo[];
    try {
      results = unwrapResults(
        await Promise.all([
          ...processEntries.map(([id, processInfo]) =>
            wrapResult(() => this.execPipedInternal(processInfo, cyan(`<${id}> `)))
          ),
        ])
      );
    } finally {
      this.logger.notice("Finished parallel execution.");
    }

    if (Array.isArray(processMapOrList)) return results;

    return Object.fromEntries(processEntries.map(([key], idx) => [key, results[idx]]));
  }

  private async execPipedInternal(processInfo: ProcessInfo, logPrefix: string): Promise<NodeExitInfo> {
    const consoleLike = new PrefixingConsoleLike(this.consoleLike, logPrefix);
    const logger = new Logger(consoleLike.error);

    logger.notice(`Starting process: ${formatProcessInvocation(processInfo)}`);

    const options = processInfo.options ?? {};
    const nonZeroExitCodeHandling = options.nonZeroExitCodeHandling ?? "printErrorAndThrow";

    const childProcess = spawn(processInfo.command, processInfo.args ?? [], {
      cwd: options.cwd,
      env: {
        // Pass kleur's color support down to the child process
        FORCE_COLOR: kleur$.enabled ? "1" : "0",

        ...(options.env ?? process.env),
      },
    });

    const [exitInfo] = await Promise.all([
      childProcessCompletion(childProcess),
      logStream(childProcess.stdout, consoleLike.log),
      logStream(childProcess.stderr, consoleLike.error),
    ]);

    this.handleExitInfo(
      exitInfo,
      processInfo,
      nonZeroExitCodeHandling,
      () => formatNonZeroExitCodeMessage(processInfo, exitInfo.exitCode),
      logger
    );

    return exitInfo;
  }

  /**
   * Executes a process attached to the TTY of this process (i.e. the caller). This means
   * that all three of the process's streams (stdin, stdout, stderr) are directly attached
   * to the streams the caller process uses.
   *
   * This way, the user can directly work with an interactive process even though it is
   * launched by DevCmd.
   *
   * The "nonZeroExitCodeHandling" option of the given {@link ProcessInfo} determines
   * whether this method throws on a non-zero exit code.
   *
   * **Example:** Open an interactive SSH session:
   * ```
   * await execInTty({ command: 'ssh', args: ['192.168.9.1'] });
   * ```
   *
   * @param processInfo Information about the process to execute
   *
   * @returns A promise resolving to an object with exit status info once the process exits
   */
  async execInTty(processInfo: ProcessInfo): Promise<NodeExitInfo> {
    this.logger.notice(`Starting process: ${formatProcessInvocation(processInfo)} attached to TTY`);
    const options = processInfo.options ?? {};
    const nonZeroExitCodeHandling = options.nonZeroExitCodeHandling ?? "printErrorAndThrow";

    const childProcess = spawn(processInfo.command, processInfo.args ?? [], {
      cwd: options.cwd,
      stdio: "inherit",
      env: {
        ...(options.env ?? process.env),
      },
    });

    const exitInfo = await childProcessCompletion(childProcess);

    this.handleExitInfo(exitInfo, processInfo, nonZeroExitCodeHandling, () =>
      formatNonZeroExitCodeMessage(processInfo, exitInfo.exitCode)
    );

    return exitInfo;
  }

  /**
   * Executes a process and collects its stdout and stderr streams into strings that are
   * returned once the process exits.
   *
   * The "nonZeroExitCodeHandling" option of the given {@link ProcessInfo} determines
   * whether this method throws on a non-zero exit code.
   *
   * **Example:** Get the commit ID of the Git commit that is currently checked out:
   * ```
   * const { stdout } = await execToString({ command: "git", args: ["rev-parse", "HEAD"] });
   * const gitHash = stdout.trim();
   * console.log(`Currently checked out: ${gitHash}`);
   * ```
   *
   * @param processInfo Information about the process to execute
   *
   * @returns A promise resolving to a result object once the process exits. The result
   * object contains all the stdout and stderr that the process emitted (separately) and
   * process's exit status info.
   */
  async execToString(processInfo: ProcessInfo): Promise<{ stdout: string; stderr: string } & NodeExitInfo> {
    this.logger.notice(`Starting process: ${formatProcessInvocation(processInfo)} and capturing output`);
    const options = processInfo.options ?? {};
    const nonZeroExitCodeHandling = options.nonZeroExitCodeHandling ?? "printErrorAndThrow";

    let childStdout: string = "";
    let childStderr: string = "";

    const childProcess = spawn(processInfo.command, processInfo.args ?? [], {
      cwd: options.cwd,
      env: {
        ...(options.env ?? process.env),
      },
    });

    const processCompletion = childProcessCompletion(childProcess);

    const [exitInfo] = await Promise.all([
      processCompletion,
      logStream(childProcess.stdout, (line) => {
        childStdout += line + "\n";
      }),
      logStream(childProcess.stderr, (line) => {
        childStderr += line + "\n";
      }),
    ]);

    this.handleExitInfo(exitInfo, processInfo, nonZeroExitCodeHandling, () => {
      const nonZeroExitCodeMessage = formatNonZeroExitCodeMessage(processInfo, exitInfo.exitCode);
      return `${nonZeroExitCodeMessage}\n\nSTDOUT WAS:\n${childStdout}\n\nSTDERR WAS:\n${childStderr}\n\n`;
    });

    return { stdout: childStdout, stderr: childStderr, ...exitInfo };
  }

  private handleExitInfo(
    exitInfo: NodeExitInfo,
    processInfo: ProcessInfo,
    nonZeroExitCodeHandling: NonZeroExitCodeHandling,
    nonZeroExitCodeMessageCreator: () => string,
    logger: Logger = this.logger
  ) {
    const { exitCode } = exitInfo;

    if (exitCode !== 0) {
      const message = nonZeroExitCodeMessageCreator();

      switch (nonZeroExitCodeHandling) {
        case "printErrorAndThrow":
          logger.error(message);
          throw new Error(message);
        case "printNoticeAndReturn":
          logger.notice(message);
          break;
        default:
          throw new Error(`Unknown value for option 'nonZeroExitCodeHandling': '${nonZeroExitCodeHandling}'`);
      }
    } else {
      logger.notice(`Process ${formatProcessCommand(processInfo)} exited successfully.`);
    }
  }
}

/**
 * Information about a process's exit status as provided by Node.
 *
 * See Node's documentation on the `exit` event of `ChildProcess`:
 * https://nodejs.org/docs/latest-v12.x/api/child_process.html#child_process_event_exit
 */
export interface NodeExitInfo {
  /**
   * If the process exited on its own, `exitCode` is the final exit code of the process,
   * otherwise `null`. Node's API assures that either this or `exitSignal` is always non-`null`.
   */
  exitCode: number | null;
  /**
   * If the process exited on its own, `exitCode` is the final exit code of the process,
   * otherwise `null`. Node's API assures that either this or `exitSignal` is always non-`null`.
   */
  exitSignal: NodeJS.Signals | null;
}

function childProcessCompletion(childProcess: ChildProcess): Promise<NodeExitInfo> {
  return new Promise<NodeExitInfo>((resolve, reject) => {
    childProcess.on("error", (err) => reject(err));
    childProcess.on("exit", (exitCode, exitSignal) => resolve({ exitCode, exitSignal }));
  });
}

type Ok = { ok: true; exitInfo: NodeExitInfo };
type Err = { err: unknown };

type Result = Ok | Err;

function isErr(r: Result): r is Err {
  return !isOk(r);
}

function isOk(r: Result): r is Ok {
  return "ok" in r && r.ok;
}

/**
 * Executes a promise-returning function and wraps the result for later use with {@link unwrapResults}.
 *
 * @param func The promise-returning function
 * @returns Returns {@link Ok} on success and {@link Err} on error
 */
async function wrapResult(func: () => Promise<NodeExitInfo>): Promise<Result> {
  try {
    const exitInfo = await func();
    return { ok: true, exitInfo };
  } catch (err) {
    return { err };
  }
}

/**
 * Takes an array of results and iterates through the array.
 * Throws the first error that is found within the results.
 *
 * @param results An array of {@link Result}
 */
function unwrapResults(results: Result[]): NodeExitInfo[] {
  const errs = results.filter(isErr).map((r) => r.err);

  // For now, only rethrow the first error to get at least one correct stack trace.
  if (errs.length >= 1) throw errs[0];

  return results.map((r) => (r as Ok).exitInfo);
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

function formatNonZeroExitCodeMessage(processInfo: ProcessInfo, code: number | null) {
  const commandName = formatProcessCommand(processInfo, identity, bold);
  return `Process ${commandName} exited with status code ${code}`;
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

class Logger {
  constructor(private readonly logFunction: LogFunction) {}

  notice(message?: any, ...optionalParams: any[]): void {
    this.logFunction(noticeStyled(message), ...optionalParams);
  }
  error(message?: any, ...optionalParams: any[]): void {
    this.logFunction(red(message), ...optionalParams);
  }
}

class SafeConsoleLike implements ConsoleLike {
  constructor(private readonly consoleLike: ConsoleLike | undefined | null) {
    this.log = this.log.bind(this);
    this.error = this.error.bind(this);
  }

  log(message?: any, ...optionalParams: any[]): void {
    if (this.consoleLike) this.consoleLike.log(message, ...optionalParams);
  }
  error(message?: any, ...optionalParams: any[]): void {
    if (this.consoleLike) this.consoleLike.error(message, ...optionalParams);
  }
}

class PrefixingConsoleLike implements ConsoleLike {
  constructor(private readonly innerConsoleLike: ConsoleLike, private readonly logPrefix: string) {
    this.log = this.log.bind(this);
    this.error = this.error.bind(this);
  }

  log(message?: any, ...optionalParams: any[]): void {
    this.innerConsoleLike.log(this.withPrefix(message), ...optionalParams);
  }
  error(message?: any, ...optionalParams: any[]): void {
    this.innerConsoleLike.error(this.withPrefix(message), ...optionalParams);
  }

  private withPrefix(line: string) {
    return `${this.logPrefix}${line}`;
  }
}
