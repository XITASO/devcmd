import { helpCmd, listCmd } from "../reserved-cmds";

type CommandFn = () => Promise<void>;

const CommandMapping: Record<string, CommandFn> = {
  list: listCmd,
  help: helpCmd,
};

export const reservedCommands = Object.keys(CommandMapping);

export function getReservedCommand(cmdName: string) {
  return CommandMapping[cmdName];
}
