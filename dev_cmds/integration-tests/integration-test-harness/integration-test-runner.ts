import { execPiped } from "devcmd";
import { red, green, bgGreen, bgRed, cyan, inverse } from "kleur/colors";
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

export async function runIntegrationTests(
  tempImageName: string,
  testGroups: ReadonlyArray<TestGroup>
): Promise<ReadonlyArray<TestGroupResultInfo>> {
  const results: TestGroupResultInfo[] = [];
  for (const testGroup of testGroups) {
    const testGroupLabel = `Test group: ${testGroup.name}`;
    console.log();
    console.log(sectionStart(testGroupLabel));
    console.log();
    const result = await runTestGroupWithDevcmdContainer(tempImageName, testGroup);
    console.log("\n" + formatTestGroupResult(result));
    console.log(sectionEnd());
    console.log();
    results.push(result);
  }

  return results;
}

export function printTestReport(results: ReadonlyArray<TestGroupResultInfo>) {
  console.log();
  console.log(sectionStart("Integration test results:"));
  console.log();
  for (const groupResult of results) {
    console.log(formatTestGroupResult(groupResult));

    for (const testResult of groupResult.testResults) {
      console.log(formatTestCaseResult(testResult));
    }
  }
  console.log(sectionEnd());
}

function formatTestCaseResult(testCaseResult: TestResultInfo): string {
  const label = testResultToStatusLabel(testCaseResult.result);
  return `    ${label} ${testCaseResult.name}`;
}

function formatTestGroupResult(testGroupResult: TestGroupResultInfo): string {
  const groupSuccess: TestResult = testGroupResult.testResults.every((r) => r.result === "success")
    ? "success"
    : "fail";
  const label = testResultToStatusLabel(groupSuccess);
  return `  ${label} Test group: ${testGroupResult.name}`;
}

function testResultToStatusLabel(testResult: TestResult): string {
  switch (testResult) {
    case "success":
      return inverse(green("  OK  "));
    case "fail":
      return inverse(red(" FAIL "));
    case "error":
      return inverse(red(" ERR  "));
    case "skipped":
      return inverse(" SKIP ");
    default:
      throw new Error(`Unhandled test result kind '${testResult}'`);
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
      let result: TestResult;
      if (skipTheRest) {
        result = "skipped";
      } else {
        result = await runCatchingErrors(name, fn, containerName);

        if (result === "error") {
          skipTheRest = true;
        }
      }
      const testCaseResult = { name, result };
      testResults.push(testCaseResult);
      console.log(`\n${formatTestCaseResult(testCaseResult)}\n`);
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

const HORIZONTAL_SEPARATOR_WIDTH = 80;
const SEPARATOR_CHAR = "#";

function sep(count: number): string {
  return Array.from({ length: count })
    .map(() => SEPARATOR_CHAR)
    .join("");
}

function horizontalSeparator(): string {
  return sep(HORIZONTAL_SEPARATOR_WIDTH);
}

const sectionColorizer = cyan;

function sectionStart(label?: string): string {
  const labelLine = typeof label !== "undefined" ? "\n" + sectionColorizer(`${sep(2)}  ${label}`) : "";
  return `\n${sectionColorizer(horizontalSeparator())}${labelLine}`;
}

function sectionEnd(label?: string, skipEndOfPrefix: boolean = false): string {
  let labelLine = "";
  if (typeof label !== "undefined") {
    labelLine = "\n" + sectionColorizer(`${sep(2)}  ${skipEndOfPrefix ? "" : "End of "}${label}`);
  }
  return `${labelLine}\n${sectionColorizer(horizontalSeparator())}`;
}
