import { execPiped, execToString } from "devcmd";
import { red } from "kleur/colors";
import { inShellInContainer } from "../utils/docker-utils";
import { NpmPackResult } from "../utils/npm-utils";
import { singlePackageJsonExampleDir } from "../utils/paths";
import { TestGroup, TestFunction, installDevcmdCliGlobally, setupExampleProject } from "./integration-test-harness";

export function createTsNodeAvailabilityTestGroup(): TestGroup {
  const setup: TestFunction = async (containerName: string, devcmdCliInfo: NpmPackResult) => {
    await installDevcmdCliGlobally(containerName, devcmdCliInfo);
    await setupExampleProject(containerName, singlePackageJsonExampleDir, "single-package-json");
    return "success";
  };

  const runFailsWithError: TestFunction = async (containerName: string) => {
    try {
      await execPiped(
        inShellInContainer(containerName, ["cd /tmp/devcmd_test/single-package-json", `npm uninstall ts-node`])
      );

      await execToString(
        inShellInContainer(containerName, ["cd /tmp/devcmd_test/single-package-json", `npx devcmd example_cmd`])
      );

      console.log(red("Failure: Command completed successfully but should have errored."));
    } catch (e) {
      if (
        e instanceof Error &&
        e.message.includes("No script runner for TypeScript devcmds found. Did you forget to install ts-node?")
      ) {
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
    { name: "Run example_cmd without ts-node", fn: runFailsWithError },
  ];
  return { name: "ts-node-availability", testCases };
}
