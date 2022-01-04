import { execToString } from "devcmd";
import { red } from "kleur/colors";
import { inShellInContainer } from "../utils/docker-utils";
import { NpmPackResult } from "../utils/npm-utils";
import { singlePackageJsonExampleDir } from "../utils/paths";
import { TestGroup, TestFunction, installDevcmdCliGlobally, setupExampleProject } from "./integration-test-harness";

export function createReservedCommandsTestGroup(): TestGroup {
  const setup: TestFunction = async (containerName: string, devcmdCliInfo: NpmPackResult) => {
    await installDevcmdCliGlobally(containerName, devcmdCliInfo);
    await setupExampleProject(containerName, singlePackageJsonExampleDir, "single-package-json");
    return "success";
  };

  const listLogsAvailableCommands: TestFunction = async (containerName: string) => {
    const { stdout } = await execToString(
      inShellInContainer(containerName, ["cd /tmp/devcmd_test/single-package-json", `npx devcmd --list`])
    );

    const expectedCmds = ["example_cmd", "fails_with_error", "parameter_example_cmd"];

    expectedCmds.forEach((cmd) => {
      if (!stdout.includes(cmd)) {
        console.log(red("--list didn't print expected output."));
        console.log(red("Actual stdout was:"));
        console.log(red(stdout));
        console.log(red("But stdout was expected to contain the cmd:"));
        console.log(red(cmd));
        return "fail";
      }
    });

    return "success";
  };

  const helpLogsHelpInformation: TestFunction = async (containerName: string) => {
    const { stdout, stderr } = await execToString(
      inShellInContainer(containerName, ["cd /tmp/devcmd_test/single-package-json", `npx devcmd --help`])
    );

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
  return { name: "reserved-commands", testCases };
}
