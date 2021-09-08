import { helpCmd } from "./help";
import { listCmd } from "./list";

type CommandFn = () => Promise<void>;

const CommandMapping: Record<string, CommandFn> = {
  list: listCmd,
  help: helpCmd,
};

export const reservedCommands = Object.freeze(Object.keys(CommandMapping));

export function getReservedCommand(cmdName: string) {
  return CommandMapping[cmdName];
}
