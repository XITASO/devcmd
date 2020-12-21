function abort(message: string, exitCode: number = 1): never {
  console.error(message);
  process.exit(exitCode);
}

export function runAsyncMain(main: () => Promise<void>): void {
  main().catch((reason) => abort(reason));
}
