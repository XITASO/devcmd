import { execPiped } from "devcmd";
import { DOCKER_COMMAND } from "../../utils/commands";
import { NpmPackResult } from "../../utils/npm-utils";
import { LOCAL_REGISTRY_URL } from "./constants";

export async function installDevcmdCliGlobally(containerName: string, devcmdCliInfo: NpmPackResult) {
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
