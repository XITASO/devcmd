import { execPiped, execToString } from "devcmd";
import { red } from "kleur/colors";
import { DOCKER_COMMAND } from "../utils/commands";
import { NpmPackResult } from "../utils/npm-utils";
import { singlePackageJsonExampleDir } from "../utils/paths";
import { TestGroup, TestFunction, installDevcmdCliGlobally, LOCAL_REGISTRY_URL } from "./integration-test-harness";

export function createSinglePackageJsonExampleTestGroup(): TestGroup {
  const setup: TestFunction = async (containerName: string, devcmdCliInfo: NpmPackResult) => {
    await installDevcmdCliGlobally(containerName, devcmdCliInfo);

    await execPiped({
      command: DOCKER_COMMAND,
      args: ["exec", containerName, "sh", "-c", "mkdir /tmp/devcmd_test"],
    });

    await execPiped({
      command: DOCKER_COMMAND,
      args: ["cp", singlePackageJsonExampleDir, `${containerName}:/tmp/devcmd_test`],
    });

    await execPiped({
      command: DOCKER_COMMAND,
      args: ["exec", "--user", "root", containerName, "chown", "-R", "verdaccio", "/tmp/devcmd_test"],
    });

    await execPiped({
      command: DOCKER_COMMAND,
      args: [
        "exec",
        containerName,
        "sh",
        "-c",
        ["cd /tmp/devcmd_test/single-package-json", `npm --registry ${LOCAL_REGISTRY_URL} install`].join(" && "),
      ],
    });

    return "success";
  };

  const runExampleCmd: TestFunction = async (containerName: string) => {
    const exampleCmdCommandLine = `npx devcmd example_cmd`;
    const { stdout, stderr } = await execToString({
      command: DOCKER_COMMAND,
      args: [
        "exec",
        containerName,
        "sh",
        "-c",
        ["cd /tmp/devcmd_test/single-package-json", exampleCmdCommandLine].join(" && "),
      ],
    });

    if (!stdout.includes("Example command for single-package-json example")) {
      console.log(red("example_cmd didn't print expected output."));
      console.log(red("Actual stdout was:"));
      console.log(red(stdout));
      console.log(red("Stderr was:"));
      console.log(red(stderr));

      return "fail";
    } else {
      return "success";
    }
  };

  const runFailsWithErrorCmd: TestFunction = async (containerName: string) => {
    const exampleCmdCommandLine = `npx devcmd fails_with_error`;

    try {
      await execToString({
        command: DOCKER_COMMAND,
        args: [
          "exec",
          containerName,
          "sh",
          "-c",
          ["cd /tmp/devcmd_test/single-package-json", exampleCmdCommandLine].join(" && "),
        ],
      });

      console.log(red("Failure: Command completed successfully but should have errored."));
    } catch (e) {
      if (e instanceof Error && e.message.includes("Process failed with exit code 1")) {
        return "success";
      }

      console.log(red("Failure: Test error didn't contain expected message."));
      console.log(red(`  typeof: ${typeof e}, instanceof Error? ${e instanceof Error}`));
      console.log(red("  Message:"));
      console.log((e instanceof Error && e.message) || "(not an Error)");
      console.log(red("  (End of message)"));
    }

    return "fail";
  };

  const testCases = [
    { name: "Setup", fn: setup },
    { name: "Run example_cmd", fn: runExampleCmd },
    { name: "Run fails_with_error", fn: runFailsWithErrorCmd },
  ];
  return { name: "single-package-json", testCases };
}
