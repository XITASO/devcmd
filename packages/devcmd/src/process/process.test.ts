import { ProcessExecutor } from ".";
import { ConsoleLike } from "./ProcessExecutor";

describe("ProcessExecutor", () => {
  describe("execInTty()", () => {
    test("process that successfully exits works (with console)", async () => {
      const execInTty = new ProcessExecutor(nullConsole).execInTty;
      await execInTty({ command: "node", args: ["--version"] });
    });

    test("process that successfully exits works (with no console)", async () => {
      const execInTty = new ProcessExecutor(null as any).execInTty;
      await execInTty({ command: "node", args: ["--version"] });
    });

    test("unknown executable throws", async () => {
      expect.assertions(1);
      const execInTty = new ProcessExecutor(nullConsole).execInTty;
      const execPromise = execInTty({ command: "unknown_executable" });
      await expect(execPromise).rejects.toThrowError("spawn unknown_executable ENOENT");
    });

    test("failing executable throws", async () => {
      expect.assertions(1);
      const execInTty = new ProcessExecutor(nullConsole).execInTty;
      const execPromise = execInTty({ command: "node", args: ["-e", "process.exit(2)"] });
      await expect(execPromise).rejects.toThrowError("exited with status code 2");
    });
  });

  describe("execPiped()", () => {
    test("process that successfully exits works (with console)", async () => {
      const execPiped = new ProcessExecutor(nullConsole).execPiped;
      await execPiped({ command: "node", args: ["--version"] });
    });

    test("process that successfully exits works (with no console)", async () => {
      const execPiped = new ProcessExecutor(null as any).execPiped;
      await execPiped({ command: "node", args: ["--version"] });
    });

    test("unknown executable throws", async () => {
      expect.assertions(1);
      const execPiped = new ProcessExecutor(nullConsole).execPiped;
      const execPromise = execPiped({ command: "unknown_executable" });
      await expect(execPromise).rejects.toThrowError("spawn unknown_executable ENOENT");
    });

    test("failing executable throws", async () => {
      expect.assertions(1);
      const execPiped = new ProcessExecutor(nullConsole).execPiped;
      const execPromise = execPiped({
        command: "node",
        args: ["-e", "process.exit(2)"],
      });
      await expect(execPromise).rejects.toThrowError("exited with status code 2");
    });
  });

  describe("execPipedParallel()", () => {
    test("succeeding processes by name works (with console)", async () => {
      const execPipedParallel = new ProcessExecutor(nullConsole).execPipedParallel;
      await execPipedParallel({
        node: { command: "node", args: ["--version"] },
        npm: { command: withCmdOnWin("npm"), args: ["--version"] },
      });
    });

    test("succeeding processes by name works (with no console)", async () => {
      const execPipedParallel = new ProcessExecutor(undefined as any).execPipedParallel;
      await execPipedParallel({
        node: { command: "node", args: ["--version"] },
        npm: { command: withCmdOnWin("npm"), args: ["--version"] },
      });
    });

    test("succeeding processes by index works", async () => {
      const execPipedParallel = new ProcessExecutor(nullConsole).execPipedParallel;
      await execPipedParallel({
        1: { command: "node", args: ["--version"] },
        2: { command: withCmdOnWin("npm"), args: ["--version"] },
      });
    });

    test("single failing process throws", async () => {
      expect.assertions(1);
      const execPipedParallel = new ProcessExecutor(nullConsole).execPipedParallel;
      await expect(
        execPipedParallel({
          node: { command: "node", args: ["-e", "process.exit(2)"] },
          npm: { command: withCmdOnWin("npm"), args: ["--version"] },
        })
      ).rejects.toThrowError();
    });

    test("multiple failing process throws", async () => {
      expect.assertions(1);
      const execPipedParallel = new ProcessExecutor(nullConsole).execPipedParallel;
      await expect(
        execPipedParallel({
          node: { command: "node", args: ["-e", "process.exit(2)"] },
          unknown_executable: { command: "unknown_executable" },
        })
      ).rejects.toThrowError();
    });
  });

  describe("execToString()", () => {
    test("process that successfully exits works (with console)", async () => {
      const execToString = new ProcessExecutor(nullConsole).execToString;
      const { stdout, stderr } = await execToString({ command: "node", args: ["--version"] });
      expect(stderr).toBe("");
      expect(stdout).toMatch(/v\d+\.\d+\.\d+/);
    });

    test("process that successfully exits works (with no console)", async () => {
      const execToString = new ProcessExecutor(undefined as any).execToString;
      const { stdout, stderr } = await execToString({ command: "node", args: ["--version"] });
      expect(stderr).toBe("");
      expect(stdout).toMatch(/v\d+\.\d+\.\d+/);
    });

    test("unknown executable throws", async () => {
      expect.assertions(1);
      const execToString = new ProcessExecutor(nullConsole).execToString;
      const execPromise = execToString({ command: "unknown_executable" });
      await expect(execPromise).rejects.toThrowError("spawn unknown_executable ENOENT");
    });

    test("failing executable throws", async () => {
      expect.assertions(1);
      const execToString = new ProcessExecutor(nullConsole).execToString;
      const execPromise = execToString({ command: "node", args: ["-e", "process.exit(2)"] });
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
