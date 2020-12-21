import { exec, execParallel } from ".";

describe("process.ts", () => {
  describe("exec()", () => {
    test("process that successfully exits works", async () => {
      await exec({ command: "node", args: ["--version"] });
    });

    test("unknown executable throws", async () => {
      expect.assertions(1);
      await expect(exec({ command: "unknown_executable" })).rejects.toThrowError();
    });

    test("failing executable throws", async () => {
      expect.assertions(1);
      await expect(exec({ command: "node", args: ["-e", "process.exit(2)"] })).rejects.toThrowError();
    });
  });

  describe("execParallel()", () => {
    test("succeeding processes by name works", async () => {
      await execParallel({
        node: { command: "node", args: ["--version"] },
        npm: { command: "npm", args: ["--version"] },
      });
    });

    test("succeeding processes by index works", async () => {
      await execParallel({
        1: { command: "node", args: ["--version"] },
        2: { command: "npm", args: ["--version"] },
      });
    });

    test("single failing process throws", async () => {
      expect.assertions(1);
      await expect(
        execParallel({
          node: { command: "node", args: ["-e", "process.exit(2)"] },
          npm: { command: "npm", args: ["--version"] },
        })
      ).rejects.toThrowError();
    });

    test("multiple failing process throws", async () => {
      expect.assertions(1);
      await expect(
        execParallel({
          node: { command: "node", args: ["-e", "process.exit(2)"] },
          unknown_executable: { command: "unknown_executable" },
        })
      ).rejects.toThrowError();
    });
  });
});
