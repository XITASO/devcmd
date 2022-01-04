import { ProcessInfo } from "devcmd";
import { DOCKER_COMMAND } from "./commands";

export function inShellInContainer(containerName: string, commandsInContainer: string[]): ProcessInfo {
  return {
    command: DOCKER_COMMAND,
    args: ["exec", containerName, "sh", "-c", commandsInContainer.join(" && ")],
  };
}
