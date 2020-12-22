import { ProcessExecutor } from "./ProcessExecutor";

export const { exec, execParallel } = new ProcessExecutor(console);
export { ProcessExecutor, ProcessInfo } from "./ProcessExecutor";
