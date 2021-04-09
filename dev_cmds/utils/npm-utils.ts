import { execPiped } from "devcmd";
import path from "path";
import { NPM_COMMAND } from "./commands";
import { isFile } from "./fs-utils";

export interface NpmPackResult {
  name: string;
  version: string;
  packedFileName: string;
  packedFilePath: string;
}

export async function npmPack(packageDir: string): Promise<NpmPackResult> {
  const packageJson = await require(path.resolve(packageDir, "package.json"));
  const name = packageJson["name"];
  const version = packageJson["version"];

  await execPiped({ command: NPM_COMMAND, args: ["pack"], options: { cwd: packageDir } });

  const packedFileName = `${name}-${version}.tgz`;
  const packedFilePath = path.join(packageDir, packedFileName);
  if (!(await isFile(packedFilePath)))
    throw new Error(`'npm pack' did not produce expected file '${packedFileName}' in dir ${packageDir}`);

  return { name, version, packedFileName, packedFilePath };
}
