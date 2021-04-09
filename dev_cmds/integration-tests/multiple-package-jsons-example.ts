import { execPiped, execToString } from "devcmd";
import { red, green, inverse } from "kleur/colors";
import { DOCKER_COMMAND } from "../utils/commands";
import { NpmPackResult } from "../utils/npm-utils";
import { multiplePackageJsonsExampleDir } from "../utils/paths";
import { installDevcmdCliGlobally, LOCAL_REGISTRY_URL, TestFunction, TestGroup } from "./integration-test-harness";

export function createMultiplePackageJsonsExampleTestGroup(devcmdCliInfo: NpmPackResult): TestGroup {
  const setup: TestFunction = async (containerName: string) => {
    await installDevcmdCliGlobally(containerName, devcmdCliInfo);

    await execPiped({
      command: DOCKER_COMMAND,
      args: ["exec", containerName, "sh", "-c", "mkdir /tmp/devcmd_test"],
    });

    await execPiped({
      command: DOCKER_COMMAND,
      args: ["cp", multiplePackageJsonsExampleDir, `${containerName}:/tmp/devcmd_test`],
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
        ["cd /tmp/devcmd_test/multiple-package-jsons/dev_cmds", `npm --registry ${LOCAL_REGISTRY_URL} install`].join(
          " && "
        ),
      ],
    });

    return "success";
  };

  const runExampleCmd: TestFunction = async (containerName: string) => {
    const { stdout, stderr } = await execToString({
      command: DOCKER_COMMAND,
      args: [
        "exec",
        containerName,
        "sh",
        "-c",
        [
          "export PATH=~/.npm-global/bin:$PATH",
          "cd /tmp/devcmd_test/multiple-package-jsons",
          `devcmd example_cmd`,
        ].join(" && "),
      ],
    });

    if (!stdout.includes("Example command for multiple-package-jsons example")) {
      console.log(red("multiple-package-jsons didn't print expected output."));
      console.log(red("Actual stdout was:"));
      console.log(red(stdout));
      console.log(red("Stderr was:"));
      console.log(red(stderr));

      return "fail";
    } else {
      console.log();
      console.log(green(inverse(" OK ") + " multiple-package-jsons"));
      console.log();
      return "success";
    }
  };

  const testCases = [
    { name: "Setup", fn: setup },
    { name: "Run example_cmd", fn: runExampleCmd },
  ];

  return { name: "multiple-package-json", testCases };
}
