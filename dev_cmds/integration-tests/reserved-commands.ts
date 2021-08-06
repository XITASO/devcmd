import { execToString } from "devcmd";
import { red } from "kleur/colors";
import { DOCKER_COMMAND } from "../utils/commands";
import { NpmPackResult } from "../utils/npm-utils";
import { singlePackageJsonExampleDir } from "../utils/paths";
import { TestGroup, TestFunction, installDevcmdCliGlobally, LOCAL_REGISTRY_URL } from "./integration-test-harness";

export function createReservedCommandsTestGroup(): TestGroup {
  const setup: TestFunction = async (containerName: string, devcmdCliInfo: NpmPackResult) => {
    await installDevcmdCliGlobally(containerName, devcmdCliInfo);

    await execToString({
      command: DOCKER_COMMAND,
      args: ["exec", containerName, "sh", "-c", "mkdir /tmp/devcmd_test"],
    });

    await execToString({
      command: DOCKER_COMMAND,
      args: ["cp", singlePackageJsonExampleDir, `${containerName}:/tmp/devcmd_test`],
    });

    await execToString({
      command: DOCKER_COMMAND,
      args: ["exec", "--user", "root", containerName, "chown", "-R", "verdaccio", "/tmp/devcmd_test"],
    });

    await execToString({
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

  const listLogsAvailableCommands: TestFunction = async (containerName: string) => {
    const { stdout, stderr } = await execToString({
      command: DOCKER_COMMAND,
      args: [
        "exec",
        containerName,
        "sh",
        "-c",
        ["cd /tmp/devcmd_test/single-package-json", `npx devcmd --list`].join(" && "),
      ],
    });

    const expectedCmds = ["example_cmd", "fails_with_error", "parameter_example_cmd"];

    expectedCmds.forEach((cmd) => {
      if (!stdout.includes(cmd)) return "fail";
    });

    return "success";
  };

  const helpLogsHelpInformation: TestFunction = async (containerName: string) => {
    const { stdout, stderr } = await execToString({
      command: DOCKER_COMMAND,
      args: [
        "exec",
        containerName,
        "sh",
        "-c",
        ["cd /tmp/devcmd_test/single-package-json", `npx devcmd --help`].join(" && "),
      ],
    });

    const part1OfHelpOutput = "Usage: devcmd <task>";
    const part2OfHelpOutput = "Use devcmd --list to show available tasks.";

    if (!stdout.includes(part1OfHelpOutput) || !stdout.includes(part2OfHelpOutput)) {
      console.log(red("--help didn't print expected output."));
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
    { name: "List available commands", fn: listLogsAvailableCommands },
    { name: "Devcmd Help", fn: helpLogsHelpInformation },
  ];
  return { name: "ts-node-availability", testCases };
}
