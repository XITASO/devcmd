import { NpmPackResult } from "../../utils/npm-utils";

export type TestResult = "success" | "fail" | "error" | "skipped";

export interface TestResultInfo {
  readonly name: string;
  readonly result: TestResult;
}

export interface TestGroupResultInfo {
  readonly name: string;
  readonly testResults: ReadonlyArray<TestResultInfo>;
}

export type TestFunction = (containerName: string) => Promise<TestResult>;

export interface TestCase {
  readonly name: string;
  readonly fn: TestFunction;
}

export interface TestGroup {
  readonly name: string;
  readonly testCases: ReadonlyArray<TestCase>;
}

export type TestGroupFactory = (devcmdCliInfo: NpmPackResult) => TestGroup;
