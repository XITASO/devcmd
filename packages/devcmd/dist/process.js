"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const child_process_1 = require("child_process");
const readline_1 = __importDefault(require("readline"));
const chalk_1 = __importDefault(require("chalk"));
/**
 * /**
 * Executes a process and throws an exception if the exit code is non-zero.
 * Outputs (stdout/stderr) of the process are sent to our stdout/stderr.
 *
 * @param processInfo
 */
async function exec(processInfo) {
    await execInternal(processInfo, "");
}
exports.exec = exec;
/**
 * Executes multiple processes in parallel and throws an exception if the exit code is non-zero.
 * Outputs (stdout/stderr) of the process are sent to our stdout/stderr.
 *
 * @param processEntries
 */
async function execParallel(processEntries) {
    console.log("Beginning parallel execution...");
    try {
        unwrapResults(await Promise.all([
            ...Object.entries(processEntries).map(([id, processInfo]) => wrapResult(() => execInternal(processInfo, chalk_1.default.cyan(`<${id}> `))))
        ]));
    }
    finally {
        console.log("Finished parallel execution.");
    }
}
exports.execParallel = execParallel;
function isErr(r) {
    return !isOk(r);
}
function isOk(r) {
    return "ok" in r && r.ok;
}
async function wrapResult(func) {
    try {
        await func();
        return { ok: true };
    }
    catch (err) {
        return { err };
    }
}
function unwrapResults(results) {
    const errs = results.filter(isErr).map(r => r.err);
    // For now, only rethrow the first error to get at least one correct stack trace.
    if (errs.length >= 1)
        throw errs[0];
}
async function execInternal(processInfo, logPrefix) {
    var _a, _b, _c;
    const withPrefix = (line) => `${logPrefix}${line}`;
    const consoleLog = (line, ...params) => console.log(withPrefix(line), ...params);
    const consoleError = (line, ...params) => console.error(withPrefix(line), ...params);
    consoleError("Starting process:", processInfo.command, JSON.stringify(processInfo.args));
    const options = (_a = processInfo.options) !== null && _a !== void 0 ? _a : {};
    const childProcess = child_process_1.spawn(processInfo.command, (_b = processInfo.args) !== null && _b !== void 0 ? _b : [], {
        cwd: options.cwd,
        env: {
            // Pass chalk's color support down to the child process
            FORCE_COLOR: chalk_1.default.supportsColor
                ? chalk_1.default.supportsColor.level.toString()
                : "0",
            ...((_c = options.env) !== null && _c !== void 0 ? _c : process.env)
        }
    });
    await Promise.all([
        logStream(childProcess.stdout, consoleLog),
        logStream(childProcess.stderr, consoleError)
    ]);
    const code = await new Promise((resolve, reject) => {
        childProcess.on("error", err => reject(err));
        childProcess.on("exit", code => resolve(code));
    });
    if (code !== 0) {
        const message = `Process '${processInfo.command}' exited with status code ${code}`;
        consoleError(message);
        throw new Error(message);
    }
    consoleError(`Process '${processInfo.command}' exited successfully.`);
}
async function logStream(stream, log) {
    const lines = readline_1.default.createInterface({
        input: stream,
        crlfDelay: Infinity // Required to support Windows newlines
    });
    for await (const line of lines) {
        log(line);
    }
}
//# sourceMappingURL=process.js.map