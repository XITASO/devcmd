/// <reference types="node" />
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
export declare function exec(processInfo: ProcessInfo): Promise<void>;
/**
 * Executes multiple processes in parallel and throws an exception if the exit code is non-zero.
 * Outputs (stdout/stderr) of the process are sent to our stdout/stderr.
 *
 * @param processEntries
 */
export declare function execParallel(processEntries: {
    [id: string]: ProcessInfo;
} | {
    [id: number]: ProcessInfo;
}): Promise<void>;
