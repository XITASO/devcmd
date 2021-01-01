import { exec as execPiped } from "devcmd";
import { blue, cyan, dim, green, yellow } from "kleur/colors";
import fs from "fs-extra";
import path from "path";
import prompts from "prompts";
import { GIT_COMMAND, YARN_COMMAND } from "./utils/commands";
import {
  devcmdCliPackageDir,
  devcmdPackageDir,
  multiplePackageJsonsExampleDir,
  repoRoot,
  singlePackageJsonExampleDir,
} from "./utils/paths";
import { runAsyncMain } from "./utils/run_utils";
import { execToString } from "./utils/exec_process";

async function main(args: string[]) {
  const packageInfo = await selectPackage();
  console.log();

  const { newVersion, updatedFiles } = await packageInfo.f();

  await commitChanges(packageInfo.package, updatedFiles, newVersion);
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
  f: () => Promise<{ updatedFiles: string[]; newVersion: string }>;
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

  return { updatedFiles: [devcmdPackageJsonPath, singlePJPackageJsonPath, multiplePJsPackageJsonPath], newVersion };
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

  return { updatedFiles: [devcmdCliPackageJsonPath, devcmdPackageJsonPath], newVersion };
}

async function commitChanges(packageName: string, updatedFiles: string[], newVersion: string) {
  console.log();
  console.log("The following files were updated:");
  for (const filepath of updatedFiles) {
    console.log(`    ${filepath}`);
  }
  console.log(yellow("You should commit these changes."));
  console.log();

  const gitBranch = await getGitBranch();
  const gitHash = await getGitHash();
  console.log(`You are on branch ${cyan(gitBranch)} (at ${cyan(dim(gitHash.substring(0, 8)))}).`);

  const commitMessage = `Bump package ${packageName} to v${newVersion}`;
  const tagName = `${packageName}/v${newVersion}`;
  console.log(
    `This script can automatically commit these files with comment ` +
      `"${cyan(commitMessage)}" and tag it as ${blue(tagName)}.`
  );
  console.log("Or you can commit it manually.");
  console.log();

  const response = await prompts({
    type: "confirm",
    name: "shouldCommit",
    initial: true,
    message: "Commit and tag now?",
  });
  console.log();

  if (!response.shouldCommit) {
    console.log(yellow("Doing nothing."));
  } else {
    console.log("Committing and tagging...");

    await execPiped({ command: GIT_COMMAND, args: ["add", ...updatedFiles] });
    await execPiped({ command: GIT_COMMAND, args: ["commit", "-m", commitMessage] });
    await execPiped({ command: GIT_COMMAND, args: ["tag", tagName] });

    const newGitHash = await getGitHash();
    console.log();
    console.log(
      green("Success. ") + `Created new commit ${cyan(newGitHash.substring(0, 8))} and tagged it as ${blue(tagName)}`
    );
    console.log();
  }
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

function promptCanceled() {
  console.log(yellow("Aborting as requested."));
  process.exit();
}

async function getGitHash(): Promise<string> {
  const { stdout } = await execToString({ command: GIT_COMMAND, args: ["rev-parse", "HEAD"] });
  return stdout.trim();
}

async function getGitBranch(): Promise<string> {
  const { stdout } = await execToString({ command: GIT_COMMAND, args: ["branch", "--show-current"] });
  return stdout.trim();
}

runAsyncMain(main);
