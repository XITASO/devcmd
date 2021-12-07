import { ProcessExecutor } from "./ProcessExecutor";

const DefaultProcessExecutor = new ProcessExecutor(console);

/**
 * Executes a process and throws an exception if the exit code is non-zero.
 * Outputs (stdout/stderr) of the process are sent to our stdout/stderr.
 *
 * @param processInfo Information about the process to execute
 * @returns A promise that resolves on success and rejects on error
 *
 * @example
 * <caption>Running ping 127.0.0.1 on localhost</caption>
 * ```
 * try {
 *   await execPiped({
 *     command: 'ping',
 *     args: ['127.0.0.1'],
 *   });
 * } catch {}
 * ```
 */
export const execPiped = DefaultProcessExecutor.execPiped;

/**
 * Executes multiple processes in parallel and throws an exception if the exit code is non-zero.
 * Outputs (stdout/stderr) of the processes are sent to our stdout/stderr. Can also take an array
 * of {@link ProcessInfo}, since arrays are compatible with the object type indexed by integers.
 *
 * @param processMap A map linking process ids to {@link ProcessInfo} instances
 * @returns A promise that resolves on success and rejects on error
 *
 *
 * @example
 * <caption>Printing node and npm version to the console</caption>
 * ```
 * await execPipedParallel({
 *   nodeVersion: {
 *     command: "node",
 *     args: ["-v"],
 *   },
 *   npmVersion: {
 *     command: "npm",
 *     args: ["--version"],
 *   },
 * });
 * ```
 */
export const execPipedParallel = DefaultProcessExecutor.execPipedParallel;

export const execInTty = DefaultProcessExecutor.execInTty;
export const execToString = DefaultProcessExecutor.execToString;

export { ProcessExecutor, ProcessInfo } from "./ProcessExecutor";
