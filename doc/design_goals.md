# DevCmd Design Goals

## Launcher / CLI Tool Is Optional
1. User scripts shall be easily callable (e.g. via yarn) without having `devcmd-cli` installed globally.
2. The optional `devcmd-cli` tool can be installed globally, and it shall try to find project-local `devcmd` lib and load it from there. (Similar to how `gulp-cli` finds and uses a project-local `gulp` installation.)


## It Does What You Mean
1. Users shall be able to invoke DevCmd user scripts from any directory of their project.
2. DevCmd shall run user scripts with a consistent and predictable working directory, so that references to paths in user scripts don't need to be so flexible.


## Project Directory Layout Scenarios

_These are examples and not an exhaustive list._

1. Only one `package.json` in project root (this also means: no `package.json` in the `dev_cmds` dir).
2. Multiple independent `package.json`s in subdirs (no yarn workspace). Idea: we don't want to require a root `package.json` just for DevCmd.
3. Yarn Workspaces
4. No "project-native" `package.json`, i.e. the project doesn't use JS / NPM for anything but DevCmd.

**Detailed project tree examples:**

In these sample project trees, the user scripts in `/dev_cmds` shall be callable by invoking DevCmd in the root or any subdir of the project tree.

1. Simple project: only single `package.json`
    ```
    |
    +-- dev_cmds/
    | +-- build.ts
    | \-- ... *.ts
    +-- node_modules/
    +-- src/
    \-- package.json <-- has devcmd dependency
    ```

2. Multiple `package.json`s
    ```
    |
    +-- dev_cmds/
    | +-- node_modules/
    | +-- build.ts
    | \-- package.json <-- has devcmd dependency
    +-- node_modules/
    +-- subproject_a/
    | +-- ...
    | \-- package.json
    +-- subproject_b/
    | +-- ...
    | \-- package.json
    \-- package.json <-- optional
    ```


## Bootstrapping -- how to get going when newly checking out a repo

* `yarn install` needs to happen on the right level (i.e. where the `devcmd` dependency is specified)
  * this is easy if it is required in the root `package.json` or with yarn workspaces (because a `yarn install` in the repo root will get it)
  * it's inconvenient if it's required in a subdir, because you have to manually go into the requiring dir and do yarn install there
* for now, this inconvenience is accepted; we can solve this later (due to the different possible constellations, we might not want to do that by convention though, and use a config file instead)


## Don't Fixate on Yarn

While we currently prefer using `yarn` over `npm`, DevCmd shall be usable with `npm` just as well.


# Implementation Idea

We try using Node's resolution.

* First, we find the `dev_cmds` dir
* Then, we `require("devcmd")` inside that dir.
  * Here, we can either passing it the user's args and start the execution directly, 
  * or we emit its path (e.g. with `require.resolve`) and then invoke it in a second step.

# Nice-To-Haves
- Namespacing in command names
- Yarn 2 compatibility: we expect that invocations of Node need to be adjusted for pnpify