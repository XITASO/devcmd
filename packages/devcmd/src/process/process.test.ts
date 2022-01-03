import path from "path";
import { isString } from "../utils/type_utils";
import { ProcessExecutor } from ".";
import { ConsoleLike } from "./ProcessExecutor";

const ansiFormat = `(?:\\x1b\\[\\d+m)`;

describe("ProcessExecutor", () => {
  describe("execInTty()", () => {
    describe("with default options", () => {
      test("process that successfully exits works (with console, prints notices)", async () => {
        const capturingConsole = new CapturingConsole();
        const execInTty = new ProcessExecutor(capturingConsole).execInTty;
        await execInTty({ command: "node", args: ["--version"] });
        const consoleErrLines = CapturingConsole.extractMessageStrings(capturingConsole.errorLines);
        expect(consoleErrLines).toHaveLength(2);
        expect(stripAnsiColorSequences(consoleErrLines[0])).toMatch(/^Starting process/);
        expect(stripAnsiColorSequences(consoleErrLines[1])).toMatch(/^Process "node" exited successfully/);
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

      test("failing executable prints and throws", async () => {
        expect.assertions(3);
        const capturingConsole = new CapturingConsole();
        const execInTty = new ProcessExecutor(capturingConsole).execInTty;
        const execPromise = execInTty({ command: "node", args: ["-e", "process.exit(2)"] });
        await expect(execPromise).rejects.toThrowError("exited with status code 2");
        expect(capturingConsole.errorLines).toHaveLength(2);
        expect(capturingConsole.errorLines[1].message).toMatch(
          new RegExp(`^${ansiFormat}?Process "${ansiFormat}?node${ansiFormat}?" exited with status code 2`)
        );
      });
    });

    describe("with option nonZeroExitCodeHandling=printNoticeAndReturn", () => {
      test("unknown executable throws", async () => {
        expect.assertions(1);
        const execInTty = new ProcessExecutor(nullConsole).execInTty;
        const execPromise = execInTty({
          command: "unknown_executable",
          options: { nonZeroExitCodeHandling: "printNoticeAndReturn" },
        });
        await expect(execPromise).rejects.toThrowError("spawn unknown_executable ENOENT");
      });

      test("failing executable prints and returns without throwing", async () => {
        const capturingConsole = new CapturingConsole();
        const execInTty = new ProcessExecutor(capturingConsole).execInTty;
        const result = await execInTty({
          command: "node",
          args: ["-e", "process.exit(2)"],
          options: { nonZeroExitCodeHandling: "printNoticeAndReturn" },
        });
        expect(result.exitCode).toBe(2);
        expect(capturingConsole.errorLines).toHaveLength(2);
        expect(capturingConsole.errorLines[1].message).toMatch(
          new RegExp(`^${ansiFormat}?Process "${ansiFormat}?node${ansiFormat}?" exited with status code 2`)
        );
      });
    });

    describe("with option suppressNotices=true", () => {
      test("process that successfully exits works (and prints no notices)", async () => {
        const capturingConsole = new CapturingConsole();
        const execInTty = new ProcessExecutor(capturingConsole).execInTty;
        await execInTty({
          command: "node",
          args: ["--version"],
          options: { suppressNotices: true },
        });
        expect(capturingConsole.errorLines).toHaveLength(0);
      });

      test("failing executable prints and throws", async () => {
        expect.assertions(3);
        const capturingConsole = new CapturingConsole();
        const execInTty = new ProcessExecutor(capturingConsole).execInTty;
        const execPromise = execInTty({
          command: "node",
          args: ["-e", "process.exit(2)"],
          options: { suppressNotices: true },
        });
        await expect(execPromise).rejects.toThrowError("exited with status code 2");
        const consoleErrLines = CapturingConsole.extractMessageStrings(capturingConsole.errorLines);
        expect(consoleErrLines).toHaveLength(1);
        expect(stripAnsiColorSequences(consoleErrLines[0])).toMatch(/^Process "node" exited with status code 2/);
      });
    });
  });

  describe("execPiped()", () => {
    describe("with default options", () => {
      test("process that successfully exits works (with console, prints notices)", async () => {
        const capturingConsole = new CapturingConsole();
        const execPiped = new ProcessExecutor(capturingConsole).execPiped;
        await execPiped({ command: "node", args: ["--version"] });
        const consoleErrLines = CapturingConsole.extractMessageStrings(capturingConsole.errorLines);
        expect(consoleErrLines).toHaveLength(2);
        expect(stripAnsiColorSequences(consoleErrLines[0])).toMatch(/^Starting process/);
        expect(stripAnsiColorSequences(consoleErrLines[1])).toMatch(/^Process "node" exited successfully/);
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

      test("failing process prints and throws", async () => {
        expect.assertions(3);
        const capturingConsole = new CapturingConsole();
        const execPiped = new ProcessExecutor(capturingConsole).execPiped;
        const execPromise = execPiped({ command: "node", args: ["-e", "process.exit(2)"] });
        await expect(execPromise).rejects.toThrowError("exited with status code 2");
        expect(capturingConsole.errorLines).toHaveLength(2);
        expect(capturingConsole.errorLines[1].message).toMatch(
          new RegExp(`^${ansiFormat}?Process "${ansiFormat}?node${ansiFormat}?" exited with status code 2`)
        );
      });
    });

    describe("with option nonZeroExitCodeHandling=printNoticeAndReturn", () => {
      test("unknown executable throws", async () => {
        expect.assertions(1);
        const execPiped = new ProcessExecutor(nullConsole).execPiped;
        const execPromise = execPiped({
          command: "unknown_executable",
          options: { nonZeroExitCodeHandling: "printNoticeAndReturn" },
        });
        await expect(execPromise).rejects.toThrowError("spawn unknown_executable ENOENT");
      });

      test("failing executable prints and returns without throwing", async () => {
        const capturingConsole = new CapturingConsole();
        const execPiped = new ProcessExecutor(capturingConsole).execPiped;
        const result = await execPiped({
          command: "node",
          args: ["-e", "console.log('still works'); process.exit(2)"],
          options: { nonZeroExitCodeHandling: "printNoticeAndReturn" },
        });
        expect(result.exitCode).toBe(2);
        expect(capturingConsole.logLines).toHaveLength(1);
        expect(capturingConsole.logLines[0].message).toBe("still works");
        expect(capturingConsole.errorLines).toHaveLength(2);
        expect(capturingConsole.errorLines[1].message).toMatch(
          new RegExp(`^${ansiFormat}?Process "${ansiFormat}?node${ansiFormat}?" exited with status code 2`)
        );
      });
    });

    describe("with option suppressNotices=true", () => {
      test("process that successfully exits works (and prints no notices)", async () => {
        const capturingConsole = new CapturingConsole();
        const execPiped = new ProcessExecutor(capturingConsole).execPiped;
        await execPiped({
          command: "node",
          args: ["--version"],
          options: { suppressNotices: true },
        });
        expect(capturingConsole.errorLines).toHaveLength(0);
      });

      test("failing executable prints and throws", async () => {
        expect.assertions(3);
        const capturingConsole = new CapturingConsole();
        const execPiped = new ProcessExecutor(capturingConsole).execPiped;
        const execPromise = execPiped({
          command: "node",
          args: ["-e", "process.exit(2)"],
          options: { suppressNotices: true },
        });
        await expect(execPromise).rejects.toThrowError("exited with status code 2");
        const consoleErrLines = CapturingConsole.extractMessageStrings(capturingConsole.errorLines);
        expect(consoleErrLines).toHaveLength(1);
        expect(stripAnsiColorSequences(consoleErrLines[0])).toMatch(/^Process "node" exited with status code 2/);
      });
    });

    test("setting 'cwd' option changes process's CWD", async () => {
      const capturingConsole = new CapturingConsole();
      const execPiped = new ProcessExecutor(capturingConsole).execPiped;
      const childProcessCwd = path.dirname(path.normalize(process.cwd()));
      const outputPrefix = "cpcwd=";
      await execPiped({
        command: "node",
        args: ["-e", `console.log('${outputPrefix}' + process.cwd());`],
        options: { cwd: childProcessCwd },
      });
      const outputLines = capturingConsole.logLines.filter(
        (l) => isString(l.message) && l.message.startsWith(outputPrefix)
      );
      expect(outputLines).toHaveLength(1);
      expect(outputLines[0].message).toEqual(`${outputPrefix}${childProcessCwd}`);
    });
  });

  describe("execPipedParallel()", () => {
    describe("with default options", () => {
      test("succeeding processes by name works (with console, prints notices)", async () => {
        const capturingConsole = new CapturingConsole();
        const execPipedParallel = new ProcessExecutor(capturingConsole).execPipedParallel;
        await execPipedParallel({
          node: { command: "node", args: ["--version"] },
          node2: { command: "node", args: ["-e", "console.log('The other node process');"] },
        });
        const consoleErrLines = CapturingConsole.extractMessageStrings(capturingConsole.errorLines).map(
          stripAnsiColorSequences
        );
        expect(consoleErrLines).toHaveLength(6);
        expect(consoleErrLines.filter((s) => s.includes("Starting process"))).toHaveLength(2);
        expect(consoleErrLines.filter((s) => s.includes(`exited successfully`))).toHaveLength(2);
      });

      test("succeeding processes by name works (with no console)", async () => {
        const execPipedParallel = new ProcessExecutor(undefined as any).execPipedParallel;
        await execPipedParallel({
          node: { command: "node", args: ["--version"] },
          node2: { command: "node", args: ["-e", "console.log('The other node process');"] },
        });
      });

      test("succeeding processes by index works", async () => {
        const execPipedParallel = new ProcessExecutor(nullConsole).execPipedParallel;
        await execPipedParallel({
          1: { command: "node", args: ["--version"] },
          2: { command: "node", args: ["-e", "console.log('The other node process');"] },
        });
      });

      test("succeeding processes as array works", async () => {
        const execPipedParallel = new ProcessExecutor(nullConsole).execPipedParallel;
        await execPipedParallel([
          { command: "node", args: ["--version"] },
          { command: "node", args: ["-e", "console.log('The other node process');"] },
        ]);
      });

      test("single failing process prints and throws", async () => {
        expect.assertions(3);
        const capturingConsole = new CapturingConsole();
        const execPipedParallel = new ProcessExecutor(capturingConsole).execPipedParallel;
        const execPromise = execPipedParallel({
          node: { command: "node", args: ["-e", "process.exit(2)"] },
          node2: { command: "node", args: ["-e", "console.log('The other node process');"] },
        });
        await expect(execPromise).rejects.toThrowError("exited with status code 2");
        const consoleErrLines = CapturingConsole.extractMessageStrings(capturingConsole.errorLines).map(
          stripAnsiColorSequences
        );
        expect(consoleErrLines).toHaveLength(6);
        const errorLine = consoleErrLines.filter((l) =>
          l.startsWith(`<node> Process "node" exited with status code 2`)
        );
        expect(errorLine).toHaveLength(1);
      });

      test("multiple failing processes throws", async () => {
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

    describe("with option nonZeroExitCodeHandling=printNoticeAndReturn", () => {
      test("single failing process prints and returns without throwing", async () => {
        const capturingConsole = new CapturingConsole();
        const execPipedParallel = new ProcessExecutor(capturingConsole).execPipedParallel;
        const results = await execPipedParallel({
          node: {
            command: "node",
            args: ["-e", "process.exit(2)"],
            options: { nonZeroExitCodeHandling: "printNoticeAndReturn" },
          },
          node2: { command: "node", args: ["-e", "console.log('The other node process');"] },
        });
        expect(results.node.exitCode).toBe(2);
        expect(capturingConsole.errorLines).toHaveLength(6);
        const errorLine = capturingConsole.errorLines.filter(
          (l) => isString(l.message) && l.message.includes("exited with status code")
        );
        expect(errorLine).toHaveLength(1);
        expect(errorLine[0].message).toMatch(
          new RegExp(
            `^${ansiFormat}?<node> ${ansiFormat}?${ansiFormat}?Process "${ansiFormat}?node${ansiFormat}?" exited with status code 2`
          )
        );
      });

      test("multiple failing processes prints and returns without throwing", async () => {
        const capturingConsole = new CapturingConsole();
        const execPipedParallel = new ProcessExecutor(capturingConsole).execPipedParallel;
        const results = await execPipedParallel([
          {
            command: "node",
            args: ["-e", "process.exit(2)"],
            options: { nonZeroExitCodeHandling: "printNoticeAndReturn" },
          },
          {
            command: "node",
            args: ["-e", "process.exit(5)"],
            options: { nonZeroExitCodeHandling: "printNoticeAndReturn" },
          },
        ]);
        expect(results[0].exitCode).toBe(2);
        expect(results[1].exitCode).toBe(5);
        expect(capturingConsole.errorLines).toHaveLength(6);
        const errorLine = capturingConsole.errorLines.filter(
          (l) => isString(l.message) && l.message.includes("exited with status code")
        );
        expect(errorLine).toHaveLength(2);
      });
    });

    describe("with option suppressNotices=true on call", () => {
      test("succeeding processes by name works (and prints no notices)", async () => {
        const capturingConsole = new CapturingConsole();
        const execPipedParallel = new ProcessExecutor(capturingConsole).execPipedParallel;
        await execPipedParallel(
          {
            node: { command: "node", args: ["--version"] },
            node2: { command: "node", args: ["-e", "console.log('The other node process');"] },
          },
          { suppressNotices: true }
        );
        const consoleErrLines = CapturingConsole.extractMessageStrings(capturingConsole.errorLines).map(
          stripAnsiColorSequences
        );
        expect(consoleErrLines).toHaveLength(0);
      });
    });
    describe("with option suppressNotices=true on single process", () => {
      test("succeeding processes by name works (and prints other notices)", async () => {
        const capturingConsole = new CapturingConsole();
        const execPipedParallel = new ProcessExecutor(capturingConsole).execPipedParallel;
        await execPipedParallel({
          node1: { command: "node", args: ["--version"], options: { suppressNotices: true } },
          node2: { command: "node", args: ["-e", "console.log('The other node process');"] },
        });
        const consoleErrLines = CapturingConsole.extractMessageStrings(capturingConsole.errorLines).map(
          stripAnsiColorSequences
        );
        expect(consoleErrLines).toHaveLength(4);
        expect(consoleErrLines.filter((s) => s.includes("node1"))).toHaveLength(0);
      });
    });
  });

  describe("execToString()", () => {
    describe("with default options", () => {
      test("process that successfully exits works (with console, prints notices)", async () => {
        const capturingConsole = new CapturingConsole();
        const execToString = new ProcessExecutor(capturingConsole).execToString;
        const { stdout, stderr } = await execToString({ command: "node", args: ["--version"] });
        expect(stderr).toBe("");
        expect(stdout).toMatch(/v\d+\.\d+\.\d+/);
        const consoleErrLines = CapturingConsole.extractMessageStrings(capturingConsole.errorLines);
        expect(consoleErrLines).toHaveLength(2);
        expect(stripAnsiColorSequences(consoleErrLines[0])).toMatch(/^Starting process/);
        expect(stripAnsiColorSequences(consoleErrLines[1])).toMatch(/^Process "node" exited successfully/);
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

      test("failing executable prints and throws", async () => {
        expect.assertions(3);
        const capturingConsole = new CapturingConsole();
        const execToString = new ProcessExecutor(capturingConsole).execToString;
        const execPromise = execToString({ command: "node", args: ["-e", "process.exit(2)"] });
        await expect(execPromise).rejects.toThrowError("exited with status code 2");
        expect(capturingConsole.errorLines).toHaveLength(2);
        expect(capturingConsole.errorLines[1].message).toMatch(
          new RegExp(`^${ansiFormat}?Process "${ansiFormat}?node${ansiFormat}?" exited with status code 2`)
        );
      });
    });

    describe("with option nonZeroExitCodeHandling=printNoticeAndReturn", () => {
      test("unknown executable throws", async () => {
        expect.assertions(1);
        const execToString = new ProcessExecutor(nullConsole).execToString;
        const execPromise = execToString({
          command: "unknown_executable",
          options: { nonZeroExitCodeHandling: "printNoticeAndReturn" },
        });
        await expect(execPromise).rejects.toThrowError("spawn unknown_executable ENOENT");
      });

      test("failing process prints and returns without throwing", async () => {
        const capturingConsole = new CapturingConsole();
        const execToString = new ProcessExecutor(capturingConsole).execToString;
        const result = await execToString({
          command: "node",
          args: ["-e", "console.log('still works'); process.exit(2)"],
          options: { nonZeroExitCodeHandling: "printNoticeAndReturn" },
        });
        expect(result.exitCode).toBe(2);
        expect(result.stdout).toBe("still works\n");
        expect(capturingConsole.errorLines).toHaveLength(2);
        expect(capturingConsole.errorLines[1].message).toMatch(
          new RegExp(`^${ansiFormat}?Process "${ansiFormat}?node${ansiFormat}?" exited with status code 2`)
        );
      });
    });

    describe("with option suppressNotices=true", () => {
      test("process that successfully exits works (and prints no notices)", async () => {
        const capturingConsole = new CapturingConsole();
        const execToString = new ProcessExecutor(capturingConsole).execToString;
        const { stdout, stderr } = await execToString({
          command: "node",
          args: ["--version"],
          options: { suppressNotices: true },
        });
        expect(stderr).toBe("");
        expect(stdout).toMatch(/v\d+\.\d+\.\d+/);
        expect(capturingConsole.errorLines).toHaveLength(0);
      });

      test("failing executable prints and throws", async () => {
        expect.assertions(3);
        const capturingConsole = new CapturingConsole();
        const execToString = new ProcessExecutor(capturingConsole).execToString;
        const execPromise = execToString({
          command: "node",
          args: ["-e", "process.exit(2)"],
          options: { suppressNotices: true },
        });
        await expect(execPromise).rejects.toThrowError("exited with status code 2");
        const consoleErrLines = CapturingConsole.extractMessageStrings(capturingConsole.errorLines);
        expect(consoleErrLines).toHaveLength(1);
        expect(stripAnsiColorSequences(consoleErrLines[0])).toMatch(/^Process "node" exited with status code 2/);
      });
    });

    test("setting 'cwd' option changes process's CWD", async () => {
      const execToString = new ProcessExecutor(nullConsole).execToString;
      const cwd = process.cwd();
      const childProcessCwd = path.dirname(path.normalize(cwd));
      const outputPrefix = "cpcwd=";
      const { stdout } = await execToString({
        command: "node",
        args: ["-e", `console.log('${outputPrefix}' + process.cwd());`],
        options: { cwd: childProcessCwd },
      });
      expect(stdout).not.toContain(cwd);
      expect(stdout).toContain(`${outputPrefix}${childProcessCwd}`);
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

  static extractMessageStrings(logLines: readonly LogLine[]): string[] {
    return logLines.map(({ message }) => message?.toString() ?? "");
  }
}

function stripAnsiColorSequences(s: string): string {
  return s.replace(new RegExp(ansiFormat, "g"), "");
}
