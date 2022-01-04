import { execPiped } from "devcmd";
import { DOCKER_COMMAND } from "../../utils/commands";
import { inShellInContainer } from "../../utils/docker-utils";
import { NpmPackResult } from "../../utils/npm-utils";
import { LOCAL_REGISTRY_URL } from "./constants";
import path from "path";

export async function installDevcmdCliGlobally(containerName: string, devcmdCliInfo: NpmPackResult) {
  await execPiped(
    inShellInContainer(containerName, [
      "mkdir ~/.npm-global",
      "npm config set prefix '~/.npm-global'",
      "export PATH=~/.npm-global/bin:$PATH",
      `npm --registry ${LOCAL_REGISTRY_URL} install -g ${devcmdCliInfo.name}@${devcmdCliInfo.version}`,
    ])
  );
}

export async function setupExampleProject(containerName: string, sourceDir: string, subdirForNpmInstall: string) {
  await execPiped(inShellInContainer(containerName, ["mkdir /tmp/devcmd_test"]));

  await execPiped({
    command: DOCKER_COMMAND,
    args: ["cp", sourceDir, `${containerName}:/tmp/devcmd_test`],
  });

  await execPiped({
    command: DOCKER_COMMAND,
    args: ["exec", "--user", "root", containerName, "chown", "-R", "verdaccio", "/tmp/devcmd_test"],
  });

  const dirForNpmInstall = path.posix.join("/tmp/devcmd_test", subdirForNpmInstall);

  await execPiped(
    inShellInContainer(containerName, [`cd ${dirForNpmInstall}`, `npm --registry ${LOCAL_REGISTRY_URL} install`])
  );
}
