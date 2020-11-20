"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const child_process_1 = require("child_process");
const fs_1 = require("fs");
const path_1 = __importDefault(require("path"));
const devCmdsDirName = "dev_cmds";
function devcmd(...args) {
    assertInDevCmdsDir();
    if (!args || args.length === 0) {
        abort("No script specified.");
    }
    const [scriptName, ...scriptArgs] = args;
    findAndRunScript(process.cwd(), scriptName, scriptArgs).catch((reason) => {
        const message = reason instanceof Error ? reason.message : `${reason}`;
        abort(message);
    });
}
exports.devcmd = devcmd;
function assertInDevCmdsDir() {
    const cwd = process.cwd();
    if (path_1.default.basename(cwd) !== devCmdsDirName) {
        const message = `The devcmd function must be run inside the ${devCmdsDirName} directory, but CWD is: ${cwd}`;
        abort(message);
    }
}
function abort(message, exitCode = 1) {
    console.error(message);
    process.exit(exitCode);
}
async function isDir(path) {
    try {
        const info = await fs_1.promises.stat(path);
        return info.isDirectory();
    }
    catch (error) {
        if (error.code === "ENOENT")
            return false; // TODO double-check code and comparison value
        throw error;
    }
}
async function isFile(path) {
    try {
        const info = await fs_1.promises.stat(path);
        return info.isFile();
    }
    catch (error) {
        if (error.code === "ENOENT")
            return false; // TODO double-check code and comparison value
        throw error;
    }
}
async function findAndRunScript(devCmdsDir, commandName, commandArgs) {
    const scriptFilepathJs = path_1.default.join(devCmdsDir, `${commandName}.js`);
    const scriptFilepathTs = path_1.default.join(devCmdsDir, `${commandName}.ts`);
    if (await isFile(scriptFilepathJs)) {
        // TODO: use spawn or so instead
        child_process_1.execFileSync("node", [scriptFilepathJs, ...commandArgs], { stdio: "inherit" });
    }
    else if (await isFile(scriptFilepathTs)) {
        // TODO: use spawn or so instead
        const executable = process.platform === "win32" ? "ts-node.cmd" : "ts-node";
        child_process_1.execFileSync(executable, [scriptFilepathTs, ...commandArgs], { stdio: "inherit" });
    }
    else {
        const message = `No script file found for command ${commandName}`;
        throw new Error(message);
    }
}
//# sourceMappingURL=devcmd.js.map