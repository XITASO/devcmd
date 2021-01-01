/**
 * This script runs the integration tests for devcmd (and devcmd-cli). Currently,
 * this means mostly: building the package, publishing to a local
 * npm repository, installing devcmd-cli, and installing devcmd in the examples.
 *
 * Some possible next steps:
 * - use a test framework (e.g. jest) to wrap the tests (for reporting etc.)
 * - extract some common functionality
 */

import { execPiped } from "devcmd";
import path from "path";
import fs from "fs-extra";
import { red, green, inverse } from "kleur/colors";
import { DEVCMD_COMMAND, DOCKER_COMMAND, NPM_COMMAND } from "./utils/commands";
import {
  devcmdCliPackageDir,
  devcmdPackageDir,
  multiplePackageJsonsExampleDir,
  repoRoot,
  singlePackageJsonExampleDir,
} from "./utils/paths";
import { runAsyncMain } from "./utils/run_utils";
import { execToString } from "./utils/exec_process";

const VERDACCIO_CONTAINER_NAME = "devcmd_verdaccio";
const VERDACCIO_STORAGE_VOLUME_NAME = "devcmd_verdaccio_storage";
const LOCAL_REGISTRY_URL = "http://0.0.0.0:4873";

const verdaccioConfigDir = path.resolve(repoRoot, "verdaccio");
const dockerMountDir = path.resolve(repoRoot, "docker-mount");

async function main() {
  await execPiped({ command: DEVCMD_COMMAND, args: ["build-all"] });

  await fs.remove(dockerMountDir);

  const packedDevcmdCli = await npmPack(devcmdCliPackageDir);
  const packedDevcmd = await npmPack(devcmdPackageDir);

  await fs.mkdirp(dockerMountDir);
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
        `npx npm-auth-to-token -u test -p test -e test@test.com -r ${LOCAL_REGISTRY_URL}`, // TODO: do we want to keep using npm-auth-to-token?
        `npm --registry ${LOCAL_REGISTRY_URL} publish ${packedDevcmdCli.packedFileName}`,
        `npm --registry ${LOCAL_REGISTRY_URL} publish ${packedDevcmd.packedFileName}`,
      ].join(" && "),
    ],
  });

  await execPiped({ command: DOCKER_COMMAND, args: ["stop", VERDACCIO_CONTAINER_NAME] });

  const tempImageName = `devcmd_${Date.now()}`;
  await execPiped({ command: DOCKER_COMMAND, args: ["commit", VERDACCIO_CONTAINER_NAME, tempImageName] });

  await testSinglePackageJsonExample(tempImageName, packedDevcmdCli);
  await testMultiplePackageJsonsExample(tempImageName, packedDevcmdCli);
}

async function runWithDevcmdContainer(tempImageName: string, actions: (containerName: string) => Promise<void>) {
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

    await delay(2000);

    await actions(containerName);
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

async function testSinglePackageJsonExample(tempImageName: string, devcmdCliInfo: NpmPackResult) {
  await runWithDevcmdContainer(tempImageName, async (containerName) => {
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

    const { stdout, stderr } = await execToString({
      command: DOCKER_COMMAND,
      args: [
        "exec",
        containerName,
        "sh",
        "-c",
        ["cd /tmp/devcmd_test/single-package-json", `npx devcmd example_cmd`].join(" && "),
      ],
    });

    if (!stdout.includes("Example command for single-package-json example")) {
      console.log(red("single-package-json didn't print expected output."));
      console.log(red("Actual stdout was:"));
      console.log(red(stdout));
      console.log(red("Stderr was:"));
      console.log(red(stderr));

      throw new Error("single-package-json didn't print expected output (see log above)");
    } else {
      console.log();
      console.log(green(inverse(" OK ") + " single-package-json"));
      console.log();
    }
  });
}

async function testMultiplePackageJsonsExample(tempImageName: string, devcmdCliInfo: NpmPackResult) {
  await runWithDevcmdContainer(tempImageName, async (containerName) => {
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

      throw new Error("multiple-package-jsons didn't print expected output (see log above)");
    } else {
      console.log();
      console.log(green(inverse(" OK ") + " multiple-package-jsons"));
      console.log();
    }
  });
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
