import { createMultiplePackageJsonsExampleTestGroup } from "./multiple-package-jsons-example";
import { createSinglePackageJsonExampleTestGroup } from "./single-package-json-example";

export const integrationTestGroupFactories = [
  createSinglePackageJsonExampleTestGroup,
  createMultiplePackageJsonsExampleTestGroup,
];
