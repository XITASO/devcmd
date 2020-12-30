export function getDevcmdVersion(): string {
  const packageJson = require("../../package.json");
  return packageJson["version"];
}
