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

async function main() {
  const packagesDir = path.resolve(repoRoot, "packages");
  const devcmdCliPackageDir = path.resolve(packagesDir, "devcmd-cli");
  const devcmdPackageDir = path.resolve(packagesDir, "devcmd");

  const verdaccioConfigDir = path.resolve(repoRoot, "verdaccio");
  const dockerMountDir = path.resolve(repoRoot, "docker-mount");
  await fs.remove(dockerMountDir);

  await exec({
    command: NPM_COMMAND,
    args: ["pack"],
    options: { cwd: devcmdCliPackageDir },
  });
  await exec({
    command: NPM_COMMAND,
    args: ["pack"],
    options: { cwd: devcmdPackageDir },
  });

  await fs.mkdirp(dockerMountDir);
  await fs.copy(
    path.resolve(repoRoot, "packages/devcmd-cli/devcmd-cli-0.0.1.tgz"), // TODO: flexibly find the tgz files
    dockerMountDir + "/devcmd-cli-0.0.1.tgz"
  );
  await fs.copy(path.resolve(repoRoot, "packages/devcmd/devcmd-0.0.1.tgz"), dockerMountDir + "/devcmd-0.0.1.tgz");

  try {
    await exec({
      command: DOCKER_COMMAND,
      args: ["rm", "--force", VERDACCIO_CONTAINER_NAME],
    });
  } catch {}

  await exec({
    command: DOCKER_COMMAND,
    args: [
      "run",
      "-d",
      ...["-v", `${dockerMountDir}:/devcmd_install`],
      ...["-v", `${verdaccioConfigDir}:/verdaccio/conf`],
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
        "export LOCAL_REGISTRY='http://0.0.0.0:4873'",
        "npx npm-auth-to-token -u test -p test -e test@test.com -r $LOCAL_REGISTRY", // TODO: do we want to keep using npm-auth-to-token?
        "npm --registry $LOCAL_REGISTRY publish devcmd-cli-0.0.1.tgz",
        "npm --registry $LOCAL_REGISTRY publish devcmd-0.0.1.tgz",
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

  await testGlobalDevcmdInstallation(tempImageName);
  await testSinglePackageJsonExample(tempImageName);
  await testMultiplePackageJsonsExample(tempImageName);
}

async function testGlobalDevcmdInstallation(tempImageName) {
  const containerName = `devcmd_test_${Date.now()}`;

  try {
    await exec({
      command: DOCKER_COMMAND,
      args: ["run", "-d", "--name", containerName, tempImageName],
    });

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
          "npm install -g devcmd-cli",
        ].join(" && "),
      ],
    });
  } finally {
    try {
      await exec({
        command: DOCKER_COMMAND,
        args: ["rm", "--force", containerName],
      });
    } catch {}
  }
}

async function testSinglePackageJsonExample(tempImageName) {
  const containerName = `devcmd_test_${Date.now()}`;

  try {
    await exec({
      command: DOCKER_COMMAND,
      args: ["run", "-d", "--name", containerName, tempImageName],
    });

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
        ["cd /tmp/devcmd_test/single-package-json", "npm install"].join(" && "),
      ],
    });
  } finally {
    try {
      await exec({
        command: DOCKER_COMMAND,
        args: ["rm", "--force", containerName],
      });
    } catch {}
  }
}

async function testMultiplePackageJsonsExample(tempImageName) {
  const containerName = `devcmd_test_${Date.now()}`;

  try {
    await exec({
      command: DOCKER_COMMAND,
      args: ["run", "-d", "--name", containerName, tempImageName],
    });

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
        ["cd /tmp/devcmd_test/multiple-package-jsons/dev_cmds", "npm install"].join(" && "),
      ],
    });
  } finally {
    try {
      await exec({
        command: DOCKER_COMMAND,
        args: ["rm", "--force", containerName],
      });
    } catch {}
  }
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

runAsyncMain(main);
