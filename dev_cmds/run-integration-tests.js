"use strict";

/**
 * This script runs the integration tests for devcmd (and devcmd-cli). Currently,
 * this means mostly: building the package (not included yet), publishing to a local
 * npm repository, installing devcmd-cli, and installing devcmd in the examples.
 *
 * Some possible next steps:
 * - build the packages at the start
 * - actually run some dev_cmds in the tests
 * - use a test framework (e.g. jest) to wrap the tests (for reporting etc.)
 * - extract some common functionality
 */

const { exec } = require("devcmd");
const path = require("path");
const fs = require("fs-extra");
const { DOCKER_COMMAND, NPM_COMMAND } = require("./utils/commands");
const { repoRoot } = require("./utils/directories");
const { runAsyncMain } = require("./utils/run_utils");

const VERDACCIO_CONTAINER_NAME = "devcmd_verdaccio";
const VERDACCIO_STORAGE_VOLUME_NAME = "devcmd_verdaccio_storage";
const LOCAL_REGISTRY_URL = "http://0.0.0.0:4873";

const packagesDir = path.resolve(repoRoot, "packages");
const devcmdCliPackageDir = path.resolve(packagesDir, "devcmd-cli");
const devcmdPackageDir = path.resolve(packagesDir, "devcmd");

const verdaccioConfigDir = path.resolve(repoRoot, "verdaccio");
const dockerMountDir = path.resolve(repoRoot, "docker-mount");

async function main() {
  await fs.remove(dockerMountDir);

  const packedDevcmdCli = await npmPack(devcmdCliPackageDir);
  const packedDevcmd = await npmPack(devcmdPackageDir);

  console.log("preparing docker mount");
  await fs.mkdirp(dockerMountDir);
  await fs.copy(packedDevcmdCli.packedFilePath, path.join(dockerMountDir, packedDevcmdCli.packedFileName));
  await fs.copy(packedDevcmd.packedFilePath, path.join(dockerMountDir, packedDevcmd.packedFileName));

  console.log("cleaning up container and volume");
  try {
    await exec({
      command: DOCKER_COMMAND,
      args: ["rm", "--force", VERDACCIO_CONTAINER_NAME],
    });
  } catch {}

  try {
    await exec({
      command: DOCKER_COMMAND,
      args: ["volume", "rm", "--force", VERDACCIO_STORAGE_VOLUME_NAME],
    });
  } catch {}

  await exec({
    command: DOCKER_COMMAND,
    args: ["volume", "create", VERDACCIO_STORAGE_VOLUME_NAME],
  });

  await exec({
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

  await exec({
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

  await exec({
    command: DOCKER_COMMAND,
    args: ["stop", VERDACCIO_CONTAINER_NAME],
  });

  const tempImageName = `devcmd_${Date.now()}`;
  await exec({
    command: DOCKER_COMMAND,
    args: ["commit", VERDACCIO_CONTAINER_NAME, tempImageName],
  });

  await testGlobalDevcmdInstallation(tempImageName, packedDevcmdCli, packedDevcmd);
  await testSinglePackageJsonExample(tempImageName, packedDevcmdCli, packedDevcmd);
  await testMultiplePackageJsonsExample(tempImageName, packedDevcmdCli, packedDevcmd);
}

async function runWithDevcmdContainer(tempImageName, actions) {
  const containerName = `devcmd_test_${Date.now()}`;

  try {
    await exec({
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
      await exec({
        command: DOCKER_COMMAND,
        args: ["rm", "--force", containerName],
      });
    } catch {}
  }
}

async function testGlobalDevcmdInstallation(tempImageName, devcmdCliInfo, devcmdInfo) {
  await runWithDevcmdContainer(tempImageName, async (containerName) => {
    await exec({
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
  });
}

async function testSinglePackageJsonExample(tempImageName) {
  await runWithDevcmdContainer(tempImageName, async (containerName) => {
    await exec({
      command: DOCKER_COMMAND,
      args: ["exec", containerName, "sh", "-c", ["mkdir /tmp/devcmd_test"].join(" && ")],
    });

    await exec({
      command: DOCKER_COMMAND,
      args: ["cp", path.resolve(repoRoot, "examples/single-package-json"), `${containerName}:/tmp/devcmd_test`],
    });

    await exec({
      command: DOCKER_COMMAND,
      args: ["exec", "--user", "root", containerName, "chown", "-R", "verdaccio", "/tmp/devcmd_test"],
    });

    await exec({
      command: DOCKER_COMMAND,
      args: [
        "exec",
        containerName,
        "sh",
        "-c",
        ["cd /tmp/devcmd_test/single-package-json", `npm --registry ${LOCAL_REGISTRY_URL} install`].join(" && "),
      ],
    });
  });
}

async function testMultiplePackageJsonsExample(tempImageName) {
  await runWithDevcmdContainer(tempImageName, async (containerName) => {
    await exec({
      command: DOCKER_COMMAND,
      args: ["exec", containerName, "sh", "-c", ["mkdir /tmp/devcmd_test"].join(" && ")],
    });

    await exec({
      command: DOCKER_COMMAND,
      args: ["cp", path.resolve(repoRoot, "examples/multiple-package-jsons"), `${containerName}:/tmp/devcmd_test`],
    });

    await exec({
      command: DOCKER_COMMAND,
      args: ["exec", "--user", "root", containerName, "chown", "-R", "verdaccio", "/tmp/devcmd_test"],
    });

    await exec({
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
  });
}

/**
 * @param {number} ms time to delay in milliseconds
 * @returns {Promise<void>}
 */
function delay(ms) {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve();
    }, ms);
  });
}

/**
 *
 * @param {string} packageDir path of dir containing package.json
 * @returns {Promise<{name: string, version: string, packedFileName: string, packedFilePath: string}>}
 */
async function npmPack(packageDir) {
  const packageJson = await require(path.resolve(packageDir, "package.json"));
  const name = packageJson["name"];
  const version = packageJson["version"];

  await exec({ command: NPM_COMMAND, args: ["pack"], options: { cwd: packageDir } });

  const packedFileName = `${name}-${version}.tgz`;
  const packedFilePath = path.join(packageDir, packedFileName);
  if (!(await isFile(packedFilePath)))
    throw new Error(`'npm pack' did not produce expected file '${packedFileName}' in dir ${packageDir}`);

  return { name, version, packedFileName, packedFilePath };
}

/**
 * @param {string} path
 * @returns {Promise<boolean>}
 */
async function isFile(path) {
  try {
    const info = await fs.stat(path);
    return info.isFile();
  } catch (error) {
    if (error.code === "ENOENT") return false; // TODO double-check code and comparison value
    throw error;
  }
}

runAsyncMain(main);
