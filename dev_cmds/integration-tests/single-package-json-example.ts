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
      console.log(red("single-package-json didn't print expected output."));
      console.log(red("Actual stdout was:"));
      console.log(red(stdout));
      console.log(red("Stderr was:"));
      console.log(red(stderr));

      return "fail";
    } else {
      return "success";
    }
  };
  const testCases = [
    { name: "Setup", fn: setup },
    { name: "Run example_cmd", fn: runExampleCmd },
  ];
  return { name: "single-package-json", testCases };
}
