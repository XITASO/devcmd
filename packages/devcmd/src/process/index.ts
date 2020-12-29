import { ProcessExecutor } from "./ProcessExecutor";

export const { execInTty, execPiped, execPipedParallel, execToString } = new ProcessExecutor(console);
export { ProcessExecutor, ProcessInfo } from "./ProcessExecutor";
