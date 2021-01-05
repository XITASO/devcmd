# devcmd-cli

Development Commands in Node.js and TypeScript -- Global Launcher Tool

<p align="center">

[![NPM version][npm-image]][npm-url]

</p>

## What is DevCmd?

- **Automation**: Improve your development life, speed up recurring tasks, and reduce errors by automating your development tasks like building, running tests, or bumping versions.
- **Library**: DevCmd gives you the tools to make automation simpler, such as easily running external programs (in series or in parallel) or composing smaller commands into more powerful ones.
- **Launcher**: With the included `devcmd` launcher, you can easily start your commands with `yarn devcmd` or `npx devcmd`. Additionally, you can globally install `devcmd-cli` to use the launcher directly and from anywhere.
- **TypeScript & JavaScript**: Benefit from the power of the npm ecosystem. Use the safety and abstraction of TypeScript where it helps you. Drop to plain JavaScript when you want to.

For more info, see the [`devcmd` package][devcmd-npm] and the [project page][devcmd-project-readme].

## Installation

`devcmd-cli` is a command line utility to launch your dev commands that is intended to be installed globally:

```sh
$ yarn global add devcmd-cli
# - or -
$ npm install --global devcmd-cli
```

Once installed, running `devcmd` looks for the closest _"dev_cmds"_ directory and starts command you entered _with the locally installed `devcmd` package there_. This way, you don't have to synchronize the versions of DevCmd you are using in different projects, and you can use the global launcher with a wide range of `devcmd` versions.

[npm-url]: https://www.npmjs.com/package/devcmd-cli
[npm-image]: https://img.shields.io/npm/v/devcmd-cli.svg
[devcmd-npm]: https://www.npmjs.com/package/devcmd
[devcmd-project-readme]: https://github.com/XITASO/devcmd/blob/master/README.md
