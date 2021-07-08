# DevCmd - Development Commands in Node.js and TypeScript

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
    import { execPiped, execPipedParallel, runAsyncMain } from "devcmd";

    export async function example() {
      console.log("Example command for single-package-json example");

      await execPiped({
        command: "node",
        args: ["-v"],
      });

      await execPipedParallel({
        nodeVersion: {
          command: "node",
          args: ["-v"],
        },
        npmVersion: {
          command: "npm",
          args: ["--version"],
        },
      });
    }

    runAsyncMain(example);
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

- If you don't want to type `yarn`/`npx` every time, you can globally install `devcmd-cli` (see below).

## Using the Global Launcher: `devcmd-cli`

`devcmd-cli` is a command line utility to launch your dev commands that is intended to be installed globally:

```sh
$ yarn global add devcmd-cli
# - or -
$ npm install --global devcmd-cli
```

Once installed, running `devcmd` looks for the closest _"dev_cmds"_ directory and starts command you entered _with the locally installed `devcmd` package there_. This way, you don't have to synchronize the versions of DevCmd you are using in different projects, and you can use the global launcher with a wide range of `devcmd` versions.

Going back to the example "build" command from above, you can now run it from the project directory or any subdirectories with:

```sh
$ devcmd build
```

## Setting up a local development setup

Since both the `devcmd` and the `devcmd-cli` packages use local installations within __node_modules__ folders,
developing and especially testing devcmd locally can be challenging. In order to setup a local development
environment, you can use the script `setup-dev`, which intializes a `dev`-folder, that contains the required `devcmd`-package
as a yarn symlink. It is recommended to use the Remote-Containers extension for Visual Studio Code for this.

```sh
$ yarn devcmd setup-dev
# - or -
$ npx devcmd setup-dev
```

You can now change the `devcmd` and the `devcmd-cli` packages. In order to test your changes, build the packages and run
devcmd in the generated dev folder.

```sh
# Build all packages
$ yarn devcmd build-all
# - or -
$ npx devcmd build-all

# You can also build a package seperately
$ yarn workspace <package> build

# Run devcmd in the dev environment using the utility script in the package.json
$ yarn dev [PARAMS]
# - or -
$ npm run dev [PARAMS]

# Alternatively you can run devcmd from within the dev folder
$ cd dev
/dev $ yarn devcmd [PARAMS]
# - or -
/dev $ npx devcmd [PARAMS]
```

To properly cleanup the folder and the symlinks, use the devcmd `clean-dev`.

```sh
$ yarn devcmd clean-dev
# - or -
$ npx devcmd clean-dev
```