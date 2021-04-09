import { execPiped, runAsyncMain } from "devcmd";
import path from "path";
import fs from "fs-extra";
import { DEVCMD_COMMAND, DOCKER_COMMAND } from "./utils/commands";
import { devcmdCliPackageDir, devcmdPackageDir, dockerMountDir, verdaccioConfigDir } from "./utils/paths";
import { npmPack, NpmPackResult } from "./utils/npm-utils";
import {
  createIntegrationTestGroups,
  LOCAL_REGISTRY_URL,
  runIntegrationTests,
  VERDACCIO_CONTAINER_NAME,
  VERDACCIO_STORAGE_VOLUME_NAME,
} from "./integration-tests/integration-test-harness";
import { delay } from "./utils/delay";
import { integrationTestGroupFactories } from "./integration-tests/integration-test-group-factories";

async function main(): Promise<void> {
  await execPiped({ command: DEVCMD_COMMAND, args: ["build-all"] });
  const packedDevcmdCli = await npmPack(devcmdCliPackageDir);
  const packedDevcmd = await npmPack(devcmdPackageDir);

  const { tempImageName } = await createIntegrationTestBaseImage(packedDevcmd, packedDevcmdCli);

  /*
   * Wondering how to add integration test cases or groups?
   *
   * See integration-tests/README.md
   */

  const testGroups = createIntegrationTestGroups(packedDevcmdCli, integrationTestGroupFactories);
  await runIntegrationTests(tempImageName, testGroups);
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

runAsyncMain(main);
