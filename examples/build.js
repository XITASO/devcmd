const devcmd = require("devcmd");

(async () => {
  await devcmd.exec({
    command: "node",
    args: ["-v"]
  });

  await devcmd.execParallel({
    nodeVersion: {
      command: "node",
      args: ["-v"]
    },
    gitVersion: {
      command: "git",
      args: ["--version"]
    }
  });
})();
