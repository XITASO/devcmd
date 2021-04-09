import { execPiped } from "devcmd";
import { red, green, bgGreen, bgRed } from "kleur/colors";
import { DOCKER_COMMAND } from "../../utils/commands";
import { delay } from "../../utils/delay";
import { NpmPackResult } from "../../utils/npm-utils";
import { verdaccioConfigDir } from "../../utils/paths";
import { VERDACCIO_STORAGE_VOLUME_NAME } from "./constants";
import { TestFunction, TestGroup, TestGroupFactory, TestGroupResultInfo, TestResult, TestResultInfo } from "./types";

export function createIntegrationTestGroups(
  packedDevcmdCli: NpmPackResult,
  testGroupFactories: ReadonlyArray<TestGroupFactory>
): ReadonlyArray<TestGroup> {
  return testGroupFactories.map((f) => f(packedDevcmdCli));
}

export async function runIntegrationTests(tempImageName: string, testGroups: ReadonlyArray<TestGroup>) {
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
