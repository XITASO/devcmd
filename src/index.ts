export { exec, execParallel } from "./process";

export function devcmd(...args: string[]) {
  console.log("running actual devcmd");
  console.log("args are:", args);
}
