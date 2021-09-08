import { bold, green } from "kleur/colors";
import { reset } from "kleur";

export async function helpCmd(): Promise<void> {
  console.log(bold(green("Usage:")), reset("devcmd <task>"));
  console.log("Use", green("devcmd --list"), "to show available tasks.");
}
