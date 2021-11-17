import { bold, green, red } from "kleur/colors";
import { promises as fs } from "fs";
import { extname, parse } from "path";

const ALLOWED_FILE_TYPES = [".js", ".ts"];

export async function listCmd(): Promise<void> {
  const cwd = process.cwd();

  try {
    const files = (await fs.readdir(cwd)).filter((f) => ALLOWED_FILE_TYPES.includes(extname(f).toLowerCase()));

    if (files.length > 0) {
      console.log(bold(green(`Available tasks in ${cwd}:`)));

      files
        .map((f) => parse(f).name)
        .sort()
        .forEach((f) => console.log(f));
    } else {
      console.log(bold(red(`No tasks found in ${cwd}.`)));
    }
  } catch {
    console.log("Failed to list available tasks!");
    process.exit(1);
  }
}
