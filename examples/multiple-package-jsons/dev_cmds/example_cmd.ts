import { execPiped, execPipedParallel } from "devcmd";

(async () => {
  console.log("Example command for multiple-package-jsons example");

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
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
