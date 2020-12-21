import { exec, execParallel } from "devcmd";

(async () => {
  console.log("Example command for multiple-package-jsons example");

  await exec({
    command: "node",
    args: ["-v"],
  });

  await execParallel({
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
