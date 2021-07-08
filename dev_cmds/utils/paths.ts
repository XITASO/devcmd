import path, { resolve } from "path";

const repoRoot = resolve(__dirname, "..", "..");

const packagesDir = resolve(repoRoot, "packages");
const devcmdCliPackageDir = resolve(packagesDir, "devcmd-cli");
const devcmdPackageDir = resolve(packagesDir, "devcmd");

const devPath = path.join(repoRoot, 'dev');
const examplesDir = resolve(repoRoot, "examples");
const singlePackageJsonExampleDir = resolve(examplesDir, "single-package-json");
const multiplePackageJsonsExampleDir = resolve(examplesDir, "multiple-package-jsons");

const verdaccioConfigDir = resolve(repoRoot, "verdaccio");
const dockerMountDir = resolve(repoRoot, "docker-mount");

export {
  devcmdCliPackageDir,
  devcmdPackageDir,
  devPath,
  dockerMountDir,
  examplesDir,
  multiplePackageJsonsExampleDir,
  repoRoot,
  singlePackageJsonExampleDir,
  verdaccioConfigDir,
};
