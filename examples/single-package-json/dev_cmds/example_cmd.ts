import { execPiped, execPipedParallel, runAsyncMain } from "devcmd";

export async function example() {
  console.log("Example command for single-package-json example");

  await execPiped({
    command: "node",
    args: ["-v"],
  });

  await execPipedParallel({
    nodeVersion: {
      command: "node",
      args: ["-v"],
    },
    npmVersion: {
      command: "npm",
      args: ["--version"],
    },
  });
}

runAsyncMain(example);
