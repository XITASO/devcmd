import { spawn } from "child_process";
import { createInterface } from "readline";
import { Readable } from "stream";

export interface ProcessInfo {
  command: string;
  args?: string[];
  options?: {
    cwd?: string;
    env?: NodeJS.ProcessEnv;
  };
}

export async function execInTty(processInfo: ProcessInfo): Promise<void> {
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
    console.error(message);
    throw new Error(message);
  }
}

export async function execToString(processInfo: ProcessInfo): Promise<{ stdout: string; stderr: string }> {
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
      `STDERR WAS:\n${childStderr}`;
    console.error(message);
    throw new Error(message);
  }

  return { stdout: childStdout, stderr: childStderr };
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
