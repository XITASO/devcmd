import fs from "fs-extra";

export async function isFile(path: string): Promise<boolean> {
  try {
    const info = await fs.stat(path);
    return info.isFile();
  } catch (error) {
    if (isNoSuchFileOrDirError(error)) return false;
    throw error;
  }
}

function isNoSuchFileOrDirError(error: unknown): error is Error {
  // error code as per https://nodejs.org/docs/latest-v12.x/api/errors.html#errors_common_system_errors
  return error instanceof Error && (error as NodeJS.ErrnoException).code === "ENOENT";
}
