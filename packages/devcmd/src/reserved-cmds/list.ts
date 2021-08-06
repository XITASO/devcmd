import { readdir } from "fs";
import { promisify } from "util";
import { bold, green } from "kleur/colors";
import { red } from "kleur";

const readdirPromise = promisify(readdir);

export async function listCmd(): Promise<void> {
  const cwd = process.cwd();

  try {
    const files = await readdirPromise(cwd);

    if (files.length > 0) {
      console.log(bold(green("Available tasks:")));
      files.sort().forEach((f) => {
        const fileName = f.slice(0, f.lastIndexOf("."));
        console.log(fileName);
      });
    } else {
      console.log(bold(red("No tasks available.")));
    }
  } catch {
    console.log("Failed to list available tasks!");
    process.exit(1);
  }
}
