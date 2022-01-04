import { execToString } from "devcmd";
import { red } from "kleur/colors";
import { inShellInContainer } from "../utils/docker-utils";
import { NpmPackResult } from "../utils/npm-utils";
import { multiplePackageJsonsExampleDir } from "../utils/paths";
import { installDevcmdCliGlobally, setupExampleProject, TestFunction, TestGroup } from "./integration-test-harness";

export function createMultiplePackageJsonsExampleTestGroup(): TestGroup {
  const setup: TestFunction = async (containerName: string, devcmdCliInfo: NpmPackResult) => {
    await installDevcmdCliGlobally(containerName, devcmdCliInfo);
    await setupExampleProject(containerName, multiplePackageJsonsExampleDir, "multiple-package-jsons/dev_cmds");
    return "success";
  };

  const runExampleCmd: TestFunction = async (containerName: string) => {
    const { stdout, stderr } = await execToString(
      inShellInContainer(containerName, [
        "export PATH=~/.npm-global/bin:$PATH",
        "cd /tmp/devcmd_test/multiple-package-jsons",
        `devcmd example_cmd`,
      ])
    );

    if (!stdout.includes("Example command for multiple-package-jsons example")) {
      console.log(red("multiple-package-jsons didn't print expected output."));
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

  return { name: "multiple-package-json", testCases };
}
