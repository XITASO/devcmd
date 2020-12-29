import { ProcessExecutor } from "./ProcessExecutor";

export const { exec, execInTty, execParallel, execToString } = new ProcessExecutor(console);
export { ProcessExecutor, ProcessInfo } from "./ProcessExecutor";
