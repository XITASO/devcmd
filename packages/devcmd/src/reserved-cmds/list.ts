import { bold, green, red } from "kleur/colors";
import { promises as fs } from "fs";

const ALLOWED_FILE_TYPES = [".js", ".ts"];

export async function listCmd(): Promise<void> {
  const cwd = process.cwd();

  try {
    const files = await fs.readdir(cwd);

    if (files.length > 0) {
      console.log(bold(green(`Available tasks in ${cwd}:`)));
      files.sort().forEach((f) => {
        const lastDotIndex = f.lastIndexOf(".");

        const fileName = f.slice(0, lastDotIndex);
        const fileType = f.slice(lastDotIndex);

        if (ALLOWED_FILE_TYPES.includes(fileType.toLowerCase())) {
          console.log(fileName);
        }
      });
    } else {
      console.log(bold(red(`No tasks found in ${cwd}.`)));
    }
  } catch {
    console.log("Failed to list available tasks!");
    process.exit(1);
  }
}
