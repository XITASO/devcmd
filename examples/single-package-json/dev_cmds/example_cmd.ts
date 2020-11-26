import { devcmd } from "devcmd";

(async () => {
  console.log("Example command for multiple-package-jsons example");

  await devcmd.exec({
    command: "node",
    args: ["-v"],
  });

  await devcmd.execParallel({
    nodeVersion: {
      command: "node",
      args: ["-v"],
    },
    gitVersion: {
      command: "git",
      args: ["--version"],
    },
  });
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
