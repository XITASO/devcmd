import fs from "fs-extra";

export async function isFile(path: string): Promise<boolean> {
  try {
    const info = await fs.stat(path);
    return info.isFile();
  } catch (error) {
    // error code as per https://nodejs.org/docs/latest-v12.x/api/errors.html#errors_common_system_errors
    if (isNodeError(error) && error.code === "ENOENT") return false;
    throw error;
  }
}

function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error;
}
