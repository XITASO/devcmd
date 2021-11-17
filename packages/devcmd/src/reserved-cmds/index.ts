import { helpCmd } from "./help";
import { listCmd } from "./list";

type CommandFn = () => Promise<void>;

const CommandMapping = Object.freeze({
  list: listCmd,
  help: helpCmd,
});

type ReservedCommand = keyof typeof CommandMapping;

export function getReservedCommand(cmdName: string): CommandFn | null {
  if (cmdName in CommandMapping) return CommandMapping[cmdName as ReservedCommand];
  return null;
}
