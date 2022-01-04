import { execToString } from "devcmd";
import { red } from "kleur/colors";
import { inShellInContainer } from "../utils/docker-utils";
import { NpmPackResult } from "../utils/npm-utils";
import { singlePackageJsonExampleDir } from "../utils/paths";
import { TestGroup, TestFunction, installDevcmdCliGlobally, setupExampleProject } from "./integration-test-harness";

export function createSinglePackageJsonExampleTestGroup(): TestGroup {
  const setup: TestFunction = async (containerName: string, devcmdCliInfo: NpmPackResult) => {
    await installDevcmdCliGlobally(containerName, devcmdCliInfo);
    await setupExampleProject(containerName, singlePackageJsonExampleDir, "single-package-json");
    return "success";
  };

  const runExampleCmd: TestFunction = async (containerName: string) => {
    const { stdout, stderr } = await execToString(
      inShellInContainer(containerName, ["cd /tmp/devcmd_test/single-package-json", `npx devcmd example_cmd`])
    );

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

  const runExampleCmdWithExtension: TestFunction = async (containerName: string) => {
    const { stdout, stderr } = await execToString(
      inShellInContainer(containerName, ["cd /tmp/devcmd_test/single-package-json", `npx devcmd example_cmd.ts`])
    );

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
    try {
      await execToString(
        inShellInContainer(containerName, ["cd /tmp/devcmd_test/single-package-json", `npx devcmd fails_with_error`])
      );

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

  const runMissingCmd: TestFunction = async (containerName: string) => {
    try {
      await execToString(
        inShellInContainer(containerName, ["cd /tmp/devcmd_test/single-package-json", `npx devcmd missing_command`])
      );

      console.log(red("Failure: Command completed successfully but should have errored."));
    } catch (e) {
      if (e instanceof Error && e.message.includes("No script file found for command 'missing_command'.")) {
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
    { name: "Running example_cmd works", fn: runExampleCmd },
    { name: "Running example_cmd.ts (with extension) works", fn: runExampleCmdWithExtension },
    { name: "Running fails_with_error exits with error", fn: runFailsWithErrorCmd },
    { name: "Running a missing command exits with error", fn: runMissingCmd },
  ];
  return { name: "single-package-json", testCases };
}
