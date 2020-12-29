import { ProcessExecutor } from ".";
import { ConsoleLike } from "./ProcessExecutor";

describe("ProcessExecutor", () => {
  describe("exec()", () => {
    test("process that successfully exits works (with console)", async () => {
      await new ProcessExecutor(nullConsole).exec({ command: "node", args: ["--version"] });
    });

    test("process that successfully exits works (with no console)", async () => {
      await new ProcessExecutor(null as any).exec({ command: "node", args: ["--version"] });
    });

    test("unknown executable throws", async () => {
      expect.assertions(1);
      const execPromise = new ProcessExecutor(nullConsole).exec({ command: "unknown_executable" });
      await expect(execPromise).rejects.toThrowError("spawn unknown_executable ENOENT");
    });

    test("failing executable throws", async () => {
      expect.assertions(1);
      const execPromise = new ProcessExecutor(nullConsole).exec({ command: "node", args: ["-e", "process.exit(2)"] });
      await expect(execPromise).rejects.toThrowError("exited with status code 2");
    });
  });

  describe("execParallel()", () => {
    test("succeeding processes by name works (with console)", async () => {
      await new ProcessExecutor(nullConsole).execParallel({
        node: { command: "node", args: ["--version"] },
        npm: { command: withCmdOnWin("npm"), args: ["--version"] },
      });
    });

    test("succeeding processes by name works (with no console)", async () => {
      await new ProcessExecutor(undefined as any).execParallel({
        node: { command: "node", args: ["--version"] },
        npm: { command: withCmdOnWin("npm"), args: ["--version"] },
      });
    });

    test("succeeding processes by index works", async () => {
      await new ProcessExecutor(nullConsole).execParallel({
        1: { command: "node", args: ["--version"] },
        2: { command: withCmdOnWin("npm"), args: ["--version"] },
      });
    });

    test("single failing process throws", async () => {
      expect.assertions(1);
      await expect(
        new ProcessExecutor(nullConsole).execParallel({
          node: { command: "node", args: ["-e", "process.exit(2)"] },
          npm: { command: withCmdOnWin("npm"), args: ["--version"] },
        })
      ).rejects.toThrowError();
    });

    test("multiple failing process throws", async () => {
      expect.assertions(1);
      await expect(
        new ProcessExecutor(nullConsole).execParallel({
          node: { command: "node", args: ["-e", "process.exit(2)"] },
          unknown_executable: { command: "unknown_executable" },
        })
      ).rejects.toThrowError();
    });
  });
});

const nullConsole: ConsoleLike = {
  log() {},
  error() {},
};

interface LogLine {
  message?: any;
  optionalParams?: any[];
}

class CapturingConsole implements ConsoleLike {
  private readonly _logLines: LogLine[] = [];
  private readonly _errorLines: LogLine[] = [];
  get logLines(): readonly LogLine[] {
    return this._logLines;
  }
  get errorLines(): readonly LogLine[] {
    return this._errorLines;
  }
  log(message?: any, ...optionalParams: any[]): void {
    this._logLines.push({ message, optionalParams });
  }
  error(message?: any, ...optionalParams: any[]): void {
    this._errorLines.push({ message, optionalParams });
  }
}

function isWindows(): boolean {
  return process.platform === "win32";
}

function withCmdOnWin(baseCmd: string): string {
  return isWindows() ? `${baseCmd}.cmd` : baseCmd;
}
