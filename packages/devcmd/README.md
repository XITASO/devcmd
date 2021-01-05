# devcmd

Development Commands in Node.js and TypeScript

<p align="center">

[![NPM version][npm-image]][npm-url]

</p>

## What is DevCmd?

- **Automation**: Improve your development life, speed up recurring tasks, and reduce errors by automating your development tasks like building, running tests, or bumping versions.
- **Library**: DevCmd gives you the tools to make automation simpler, such as easily running external programs (in series or in parallel) or composing smaller commands into more powerful ones.
- **Launcher**: With the included `devcmd` launcher, you can easily start your commands with `yarn devcmd` or `npx devcmd`. Additionally, you can globally install `devcmd-cli` to use the launcher directly and from anywhere.
- **TypeScript & JavaScript**: Benefit from the power of the npm ecosystem. Use the safety and abstraction of TypeScript where it helps you. Drop to plain JavaScript when you want to.

## Getting Started

- Install the `devcmd` package in your workspace:

  ```sh
  $ yarn add -D devcmd
  # - or -
  $ npm install -D devcmd
  ```

- If you want to write commands in TypeScript, you also need `typescript` and `ts-node`. If you don't already have these installed, do so now:

  ```sh
  $ yarn add -D typescript ts-node
  # - or -
  $ npm install -D typescript ts-node
  ```

- Create a directory named "_dev_cmds_" in your workspace (this name is required).

- Create your commands in this "_dev_cmds_" directory.

  - The file name (without the extension) is the command name.

  - Each command is run as a standalone script, so top-level statements are permissible. When you want to use Promises (`async`/`await`), you need to take care of top-level Promise rejections as well.

  - For example, to create a "build" command, add a file "_dev_cmds/build.ts_" with the following content (or "_dev_cmds/build.js_" and drop the type definitions):

    ```ts
    // TypeScript
    import { execPiped, execPipedParallel } from "devcmd";

    (async () => {
      console.log("My first Dev Command!");

      await execPiped({
        command: "node",
        args: ["-v"],
      });

      await execPipedParallel({
        nodeVersion: { command: "npm", args: ["build", "--prod"] },
        npmVersion: { command: "npm", args: ["test"] },
      });
    })().catch((e) => {
      console.error(e);
      process.exit(1);
    });
    ```

- You can now run your commands with the locally installed `devcmd` CLI. We recommend using `yarn` or `npx` to invoke it:

  ```sh
  $ yarn devcmd <script name> [<args of you scripts>...]
  # - or -
  $ npx devcmd <script name> [<args of you scripts>...]
  ```

  - For example, to run the "build" command from above:

    ```sh
    $ yarn devcmd build
    # - or -
    $ npx devcmd build
    ```

- If you don't want to type `yarn`/`npx` every time, you can install the global launcher tool `devcmd-cli`. See the [package README][devcmd-cli-readme] or the [DevCmd project README][devcmd-project-readme] for more info.

[npm-url]: https://www.npmjs.com/package/devcmd
[npm-image]: https://img.shields.io/npm/v/devcmd.svg
[devcmd-cli-readme]: https://github.com/XITASO/devcmd/blob/master/packages/devcmd-cli/README.md
[devcmd-project-readme]: https://github.com/XITASO/devcmd/blob/master/README.md
