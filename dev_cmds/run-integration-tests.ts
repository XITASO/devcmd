/**
 * This script runs the integration tests for devcmd (and devcmd-cli). Currently,
 * this means mostly: building the package, publishing to a local
 * npm repository, installing devcmd-cli, and installing devcmd in the examples.
 *
 * Some possible next steps:
 * - use a test framework (e.g. jest) to wrap the tests (for reporting etc.)
 * - extract some common functionality
 */

import { execPiped, execToString, runAsyncMain } from "devcmd";
import { red, green, inverse, bgGreen, bgRed } from "kleur/colors";
import fs from "fs-extra";
import path from "path";
import { DEVCMD_COMMAND, DOCKER_COMMAND, NPM_COMMAND } from "./utils/commands";
import {
  devcmdCliPackageDir,
  devcmdPackageDir,
  multiplePackageJsonsExampleDir,
  repoRoot,
  singlePackageJsonExampleDir,
} from "./utils/paths";

const VERDACCIO_CONTAINER_NAME = "devcmd_verdaccio";
const VERDACCIO_STORAGE_VOLUME_NAME = "devcmd_verdaccio_storage";
const LOCAL_REGISTRY_URL = "http://0.0.0.0:4873";

const verdaccioConfigDir = path.resolve(repoRoot, "verdaccio");
const dockerMountDir = path.resolve(repoRoot, "docker-mount");

async function main(): Promise<void> {
  await execPiped({ command: DEVCMD_COMMAND, args: ["build-all"] });
  const packedDevcmdCli = await npmPack(devcmdCliPackageDir);
  const packedDevcmd = await npmPack(devcmdPackageDir);

  const { tempImageName } = await createIntegrationTestBaseImage(packedDevcmd, packedDevcmdCli);

  const testGroupFactories = [createSinglePackageJsonExampleTestGroup, createMultiplePackageJsonsExampleTestGroup];
  const testGroups = createIntegrationTestGroups(packedDevcmdCli, testGroupFactories);
  await runIntegrationTests(tempImageName, testGroups);
}

type TestGroupFactory = (devcmdCliInfo: NpmPackResult) => TestGroup;

function createIntegrationTestGroups(
  packedDevcmdCli: NpmPackResult,
  testGroupFactories: ReadonlyArray<TestGroupFactory>
): ReadonlyArray<TestGroup> {
  return testGroupFactories.map((f) => f(packedDevcmdCli));
}

async function runIntegrationTests(tempImageName: string, testGroups: ReadonlyArray<TestGroup>) {
  const results: TestGroupResultInfo[] = [];
  for (const testGroup of testGroups) {
    const result = await runTestGroupWithDevcmdContainer(tempImageName, testGroup);
    results.push(result);
  }

  console.log("\n\n");
  console.log("Test results:\n");
  for (const groupResult of results) {
    const groupSuccess = groupResult.testResults.every((r) => r.result === "success");

    if (groupSuccess) {
      console.log(`  ${bgGreen("  OK  ")} ${green(groupResult.name)}`);
    } else {
      console.log(`  ${bgRed(" FAIL ")} ${red(groupResult.name)}`);
    }

    for (const testResult of groupResult.testResults) {
      switch (testResult.result) {
        case "success":
          console.log(`    ${bgGreen("  OK  ")} ${green(testResult.name)}`);
          break;
        case "fail":
          console.log(`    ${bgRed(" FAIL ")} ${red(testResult.name)}`);
          break;
        case "error":
          console.log(`    ${bgRed(" ERR  ")} ${red(testResult.name)}`);
          break;
        default:
          throw new Error(`Unhandled test result kind '${testResult.result}'`);
      }
    }
  }
}

async function createIntegrationTestBaseImage(
  packedDevcmd: NpmPackResult,
  packedDevcmdCli: NpmPackResult
): Promise<{ tempImageName: string }> {
  await fs.remove(dockerMountDir);

  await fs.mkdirp(dockerMountDir);
  await fs.chmod(dockerMountDir, "777");
  await fs.copy(packedDevcmdCli.packedFilePath, path.join(dockerMountDir, packedDevcmdCli.packedFileName));
  await fs.copy(packedDevcmd.packedFilePath, path.join(dockerMountDir, packedDevcmd.packedFileName));

  try {
    await execPiped({ command: DOCKER_COMMAND, args: ["rm", "--force", VERDACCIO_CONTAINER_NAME] });
  } catch {}

  try {
    await execPiped({ command: DOCKER_COMMAND, args: ["volume", "rm", "--force", VERDACCIO_STORAGE_VOLUME_NAME] });
  } catch {}

  await execPiped({ command: DOCKER_COMMAND, args: ["volume", "create", VERDACCIO_STORAGE_VOLUME_NAME] });

  await execPiped({
    command: DOCKER_COMMAND,
    args: [
      "run",
      "-d",
      ...["-v", `${dockerMountDir}:/devcmd_install`],
      ...["-v", `${verdaccioConfigDir}:/verdaccio/conf`],
      ...["-v", `${VERDACCIO_STORAGE_VOLUME_NAME}:/verdaccio/storage`],
      ...["--name", VERDACCIO_CONTAINER_NAME],
      "verdaccio/verdaccio:4",
    ],
  });

  await delay(2000);

  await execPiped({
    command: DOCKER_COMMAND,
    args: [
      "exec",
      VERDACCIO_CONTAINER_NAME,
      "sh",
      "-c",
      [
        "cd /devcmd_install",
        `npx npm-auth-to-token -u test -p test -e test@test.com -r ${LOCAL_REGISTRY_URL}`,
        `npm --registry ${LOCAL_REGISTRY_URL} publish ${packedDevcmdCli.packedFileName}`,
        `npm --registry ${LOCAL_REGISTRY_URL} publish ${packedDevcmd.packedFileName}`,
      ].join(" && "),
    ],
  });

  await execPiped({ command: DOCKER_COMMAND, args: ["stop", VERDACCIO_CONTAINER_NAME] });

  const tempImageName = `devcmd_${Date.now()}`;
  await execPiped({ command: DOCKER_COMMAND, args: ["commit", VERDACCIO_CONTAINER_NAME, tempImageName] });
  return { tempImageName };
}

async function runWithDevcmdContainer<R>(
  tempImageName: string,
  actions: (containerName: string) => Promise<R>
): Promise<R> {
  const containerName = `devcmd_test_${Date.now()}`;

  try {
    await execPiped({
      command: DOCKER_COMMAND,
      args: [
        "run",
        "-d",
        ...["-v", `${verdaccioConfigDir}:/verdaccio/conf`],
        ...["-v", `${VERDACCIO_STORAGE_VOLUME_NAME}:/verdaccio/storage`],
        ...["--name", containerName],
        tempImageName,
      ],
    });

    await delay(5000);

    return await actions(containerName);
  } finally {
    try {
      await execPiped({ command: DOCKER_COMMAND, args: ["rm", "--force", containerName] });
    } catch {}
  }
}

async function installDevcmdCliGlobally(containerName: string, devcmdCliInfo: NpmPackResult) {
  await execPiped({
    command: DOCKER_COMMAND,
    args: [
      "exec",
      containerName,
      "sh",
      "-c",
      [
        "mkdir ~/.npm-global",
        "npm config set prefix '~/.npm-global'",
        "export PATH=~/.npm-global/bin:$PATH",
        `npm --registry ${LOCAL_REGISTRY_URL} install -g ${devcmdCliInfo.name}@${devcmdCliInfo.version}`,
      ].join(" && "),
    ],
  });
}

type TestResult = "success" | "fail" | "error" | "skipped";

interface TestResultInfo {
  readonly name: string;
  readonly result: TestResult;
}

interface TestGroupResultInfo {
  readonly name: string;
  readonly testResults: ReadonlyArray<TestResultInfo>;
}

interface TestCase {
  readonly name: string;
  readonly fn: TestFunction;
}

interface TestGroup {
  readonly name: string;
  readonly testCases: ReadonlyArray<TestCase>;
}

type TestFunction = (containerName: string) => Promise<TestResult>;

async function runCatchingErrors(
  testName: string,
  testFunction: TestFunction,
  containerName: string
): Promise<TestResult> {
  try {
    return await testFunction(containerName);
  } catch (e) {
    console.error(`Error while running test ${testName}`);
    return "error";
  }
}

async function runTestGroupWithDevcmdContainer(
  tempImageName: string,
  testGroup: TestGroup
): Promise<TestGroupResultInfo> {
  return await runWithDevcmdContainer(tempImageName, async (containerName) => {
    const testResults: TestResultInfo[] = [];
    let skipTheRest = false;
    for (const { name, fn } of testGroup.testCases) {
      if (skipTheRest) {
        testResults.push({ name, result: "skipped" });
      } else {
        const result = await runCatchingErrors(name, fn, containerName);

        testResults.push({ name, result });
        if (result === "error") {
          skipTheRest = true;
        }
      }
    }

    return {
      name: testGroup.name,
      testResults,
    };
  });
}

function createSinglePackageJsonExampleTestGroup(devcmdCliInfo: NpmPackResult): TestGroup {
  const setup: TestFunction = async (containerName: string) => {
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
      console.log();
      console.log(green(inverse(" OK ") + " single-package-json"));
      console.log();
      return "success";
    }
  };
  const testCases = [
    { name: "Setup", fn: setup },
    { name: "Run example_cmd", fn: runExampleCmd },
  ];
  return { name: "single-package-json", testCases };
}

function createMultiplePackageJsonsExampleTestGroup(devcmdCliInfo: NpmPackResult): TestGroup {
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

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve();
    }, ms);
  });
}

interface NpmPackResult {
  name: string;
  version: string;
  packedFileName: string;
  packedFilePath: string;
}

async function npmPack(packageDir: string): Promise<NpmPackResult> {
  const packageJson = await require(path.resolve(packageDir, "package.json"));
  const name = packageJson["name"];
  const version = packageJson["version"];

  await execPiped({ command: NPM_COMMAND, args: ["pack"], options: { cwd: packageDir } });

  const packedFileName = `${name}-${version}.tgz`;
  const packedFilePath = path.join(packageDir, packedFileName);
  if (!(await isFile(packedFilePath)))
    throw new Error(`'npm pack' did not produce expected file '${packedFileName}' in dir ${packageDir}`);

  return { name, version, packedFileName, packedFilePath };
}

async function isFile(path: string): Promise<boolean> {
  try {
    const info = await fs.stat(path);
    return info.isFile();
  } catch (error) {
    if (error.code === "ENOENT") return false; // TODO double-check code and comparison value
    throw error;
  }
}

runAsyncMain(main);
