import { exec as execPiped } from "devcmd";
import { blue, cyan, dim, green, yellow } from "kleur/colors";
import fs from "fs-extra";
import path from "path";
import prompts from "prompts";
import { YARN_COMMAND } from "./utils/commands";
import {
  devcmdCliPackageDir,
  devcmdPackageDir,
  multiplePackageJsonsExampleDir,
  repoRoot,
  singlePackageJsonExampleDir,
} from "./utils/paths";
import { runAsyncMain } from "./utils/run_utils";

async function main(args: string[]) {
  const packageInfo = await selectPackage();
  console.log();

  await packageInfo.f();

  console.log();
  console.log(yellow("You should commit these changes."));
  console.log();
}

async function selectPackage(): Promise<PackageInfo> {
  const response = await prompts(
    {
      type: "select",
      name: "package",
      message: "Choose package whose version to bump",
      choices: packageInfos.map((pi) => ({ title: pi.package, value: pi })),
    },
    { onCancel: promptCanceled }
  );
  return response.package;
}

interface PackageInfo {
  package: string;
  f: () => Promise<void>;
}

const PACKAGE_JSON_FILENAME = "package.json";

const devcmdPackageName = "devcmd";
const devcmdCliPackageName = "devcmd-cli";
const packageInfos: PackageInfo[] = [
  { package: devcmdCliPackageName, f: bumpVersionDevcmdCli },
  { package: devcmdPackageName, f: bumpVersionDevcmd },
];

async function bumpVersionDevcmd() {
  const devcmdPackageJsonPath = path.resolve(devcmdPackageDir, PACKAGE_JSON_FILENAME);

  const { newVersion } = await updatePackageJson(devcmdPackageJsonPath, devcmdPackageName, async (packageJson) => {
    const oldVersion = packageJson["version"];
    const { newVersion } = await getNewVersion(devcmdPackageName, oldVersion);
    console.log();
    printPackageJsonFieldUpdate(devcmdPackageJsonPath, ["version"], oldVersion, newVersion);
    packageJson["version"] = newVersion;
    return [packageJson, { newVersion }];
  });

  const newDependencyVersion = `^${newVersion}`;

  const singlePJPackageJsonPath = path.resolve(singlePackageJsonExampleDir, PACKAGE_JSON_FILENAME);
  await updatePackageJson(singlePJPackageJsonPath, "devcmd-examples_single-package-json", async (packageJson) => {
    console.log();
    printPackageJsonFieldUpdate(
      singlePJPackageJsonPath,
      ["devDependencies", devcmdPackageName],
      packageJson["devDependencies"][devcmdPackageName],
      newDependencyVersion
    );
    packageJson["devDependencies"][devcmdPackageName] = newDependencyVersion;
    return packageJson;
  });

  const multiplePJsPackageJsonPath = path.resolve(multiplePackageJsonsExampleDir, "dev_cmds", PACKAGE_JSON_FILENAME);
  await updatePackageJson(
    multiplePJsPackageJsonPath,
    "devcmd-examples_multiple-package-jsons_dev-cmds",
    async (packageJson) => {
      console.log();
      printPackageJsonFieldUpdate(
        multiplePJsPackageJsonPath,
        ["devDependencies", devcmdPackageName],
        packageJson["devDependencies"][devcmdPackageName],
        newDependencyVersion
      );
      packageJson["devDependencies"][devcmdPackageName] = newDependencyVersion;
      return packageJson;
    }
  );
}

async function bumpVersionDevcmdCli() {
  const devcmdCliPackageJsonPath = path.resolve(devcmdCliPackageDir, PACKAGE_JSON_FILENAME);

  const { newVersion } = await updatePackageJson(
    devcmdCliPackageJsonPath,
    devcmdCliPackageName,
    async (packageJson) => {
      const oldVersion = packageJson["version"];
      const { newVersion } = await getNewVersion(devcmdCliPackageName, oldVersion);
      console.log();
      printPackageJsonFieldUpdate(devcmdCliPackageJsonPath, ["version"], oldVersion, newVersion);
      packageJson["version"] = newVersion;
      return [packageJson, { newVersion }];
    }
  );

  const newDependencyVersion = `^${newVersion}`;
  const devcmdPackageJsonPath = path.resolve(devcmdPackageDir, PACKAGE_JSON_FILENAME);
  await updatePackageJson(devcmdPackageJsonPath, devcmdPackageName, async (packageJson) => {
    console.log();
    printPackageJsonFieldUpdate(
      devcmdPackageJsonPath,
      ["dependencies", devcmdCliPackageName],
      packageJson["dependencies"][devcmdCliPackageName],
      newDependencyVersion
    );
    packageJson["dependencies"][devcmdCliPackageName] = newDependencyVersion;
    return packageJson;
  });
}

function printPackageJsonFieldUpdate(
  packageJsonPath: string,
  propertyPath: string[],
  oldValue: string,
  newValue: string
) {
  const packageJsonRelativePath = path.relative(repoRoot, packageJsonPath);
  const formattedPropertyPath = propertyPath.map((s) => ` > ${cyan(s)}`).join("");
  console.log(
    `Updating ${blue(packageJsonRelativePath)}${formattedPropertyPath}: ${green(dim(oldValue))} => ${green(newValue)}`
  );
}

async function getNewVersion(packageName: string, oldVersion: string): Promise<{ newVersion: string }> {
  console.log(`Package ${cyan(packageName)} is currently at version ${green(oldVersion)}`);
  const versionParts = oldVersion.split(".");
  const [major, minor, patch] = versionParts;
  const newPatch = parseInt(patch) + 1;
  const suggestedVersion = [major, minor, newPatch].join(".");

  const response = await prompts(
    {
      type: "text",
      name: "newVersion",
      message: "Enter new version:",
      initial: suggestedVersion,
      validate: (userInput) =>
        (typeof userInput === "string" && userInput.split(".").length === 3) ||
        "Please enter a valid semver version string",
    },
    { onCancel: promptCanceled }
  );
  const newVersion: string = response.newVersion;
  return { newVersion };
}

type PackageJson = { [prop: string]: any };

async function updatePackageJson<R = undefined>(
  packageJsonPath: string,
  expectedPackageName: string,
  updater: (old: PackageJson) => Promise<R extends undefined ? PackageJson : [PackageJson, R]>
): Promise<R> {
  const packageJson: PackageJson = await fs.readJson(packageJsonPath);
  if (packageJson.name !== expectedPackageName) {
    throw new Error(
      `Expected package name "${expectedPackageName}" but found "${packageJson.name}" in file ${packageJsonPath}`
    );
  }

  const updated = await updater(packageJson);
  const [newPackageJson, result] = Array.isArray(updated) ? updated : [updated, undefined];

  await fs.writeJson(packageJsonPath, newPackageJson);
  await formatFile(packageJsonPath);

  return result;
}

async function formatFile(absolutePath: string) {
  await execPiped({
    command: YARN_COMMAND,
    args: ["prettier", "--write", absolutePath],
    options: { cwd: repoRoot },
  });
}

function getPackageJsonInfo(dir: string): { name: string; version: string } {
  const packageJson = require(path.resolve(dir, "package.json"));
  const { name, version } = packageJson;
  return { name, version };
}

function promptCanceled() {
  console.log(yellow("Aborting as requested."));
  process.exit();
}

runAsyncMain(main);
