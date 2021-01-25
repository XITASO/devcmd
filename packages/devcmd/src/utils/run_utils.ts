function abort(message: string, exitCode: number = 1): never {
  console.error(message);
  process.exit(exitCode);
}

export function runAsyncMain(main: (...args: string[]) => Promise<void>): void {
  const [, , ...args] = process.argv;
  main(...args || []).catch((reason) => abort(reason));
}
