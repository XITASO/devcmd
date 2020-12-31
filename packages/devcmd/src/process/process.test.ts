import { ProcessExecutor } from ".";
import { ConsoleLike } from "./ProcessExecutor";

describe("ProcessExecutor", () => {
  describe("execInTty()", () => {
    test("process that successfully exits works (with console)", async () => {
      await new ProcessExecutor(nullConsole).execInTty({ command: "node", args: ["--version"] });
    });

    test("process that successfully exits works (with no console)", async () => {
      await new ProcessExecutor(null as any).execInTty({ command: "node", args: ["--version"] });
    });

    test("unknown executable throws", async () => {
      expect.assertions(1);
      const execPromise = new ProcessExecutor(nullConsole).execInTty({ command: "unknown_executable" });
      await expect(execPromise).rejects.toThrowError("spawn unknown_executable ENOENT");
    });

    test("failing executable throws", async () => {
      expect.assertions(1);
      const execPromise = new ProcessExecutor(nullConsole).execInTty({
        command: "node",
        args: ["-e", "process.exit(2)"],
      });
      await expect(execPromise).rejects.toThrowError("exited with status code 2");
    });
  });

  describe("execPiped()", () => {
    test("process that successfully exits works (with console)", async () => {
      await new ProcessExecutor(nullConsole).execPiped({ command: "node", args: ["--version"] });
    });

    test("process that successfully exits works (with no console)", async () => {
      await new ProcessExecutor(null as any).execPiped({ command: "node", args: ["--version"] });
    });

    test("unknown executable throws", async () => {
      expect.assertions(1);
      const execPromise = new ProcessExecutor(nullConsole).execPiped({ command: "unknown_executable" });
      await expect(execPromise).rejects.toThrowError("spawn unknown_executable ENOENT");
    });

    test("failing executable throws", async () => {
      expect.assertions(1);
      const execPromise = new ProcessExecutor(nullConsole).execPiped({
        command: "node",
        args: ["-e", "process.exit(2)"],
      });
      await expect(execPromise).rejects.toThrowError("exited with status code 2");
    });
  });

  describe("execPipedParallel()", () => {
    test("succeeding processes by name works (with console)", async () => {
      await new ProcessExecutor(nullConsole).execPipedParallel({
        node: { command: "node", args: ["--version"] },
        npm: { command: withCmdOnWin("npm"), args: ["--version"] },
      });
    });

    test("succeeding processes by name works (with no console)", async () => {
      await new ProcessExecutor(undefined as any).execPipedParallel({
        node: { command: "node", args: ["--version"] },
        npm: { command: withCmdOnWin("npm"), args: ["--version"] },
      });
    });

    test("succeeding processes by index works", async () => {
      await new ProcessExecutor(nullConsole).execPipedParallel({
        1: { command: "node", args: ["--version"] },
        2: { command: withCmdOnWin("npm"), args: ["--version"] },
      });
    });

    test("single failing process throws", async () => {
      expect.assertions(1);
      await expect(
        new ProcessExecutor(nullConsole).execPipedParallel({
          node: { command: "node", args: ["-e", "process.exit(2)"] },
          npm: { command: withCmdOnWin("npm"), args: ["--version"] },
        })
      ).rejects.toThrowError();
    });

    test("multiple failing process throws", async () => {
      expect.assertions(1);
      await expect(
        new ProcessExecutor(nullConsole).execPipedParallel({
          node: { command: "node", args: ["-e", "process.exit(2)"] },
          unknown_executable: { command: "unknown_executable" },
        })
      ).rejects.toThrowError();
    });
  });

  describe("execToString()", () => {
    test("process that successfully exits works (with console)", async () => {
      const { stdout, stderr } = await new ProcessExecutor(nullConsole).execToString({
        command: "node",
        args: ["--version"],
      });
      expect(stderr).toBe("");
      expect(stdout).toMatch(/v\d+\.\d+\.\d+/);
    });

    test("process that successfully exits works (with no console)", async () => {
      const { stdout, stderr } = await new ProcessExecutor(undefined as any).execToString({
        command: "node",
        args: ["--version"],
      });
      expect(stderr).toBe("");
      expect(stdout).toMatch(/v\d+\.\d+\.\d+/);
    });

    test("unknown executable throws", async () => {
      expect.assertions(1);
      const execPromise = new ProcessExecutor(nullConsole).execToString({ command: "unknown_executable" });
      await expect(execPromise).rejects.toThrowError("spawn unknown_executable ENOENT");
    });

    test("failing executable throws", async () => {
      expect.assertions(1);
      const execPromise = new ProcessExecutor(nullConsole).execToString({
        command: "node",
        args: ["-e", "process.exit(2)"],
      });
      await expect(execPromise).rejects.toThrowError("exited with status code 2");
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
