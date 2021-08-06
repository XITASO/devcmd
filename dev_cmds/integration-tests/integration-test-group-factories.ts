import { createMultiplePackageJsonsExampleTestGroup } from "./multiple-package-jsons-example";
import { createReservedCommandsTestGroup } from "./reserved-commands";
import { createSinglePackageJsonExampleTestGroup } from "./single-package-json-example";
import { createTsNodeAvailabilityTestGroup } from "./ts-node-availability";

export const integrationTestGroupFactories = [
  createSinglePackageJsonExampleTestGroup,
  createMultiplePackageJsonsExampleTestGroup,
  createTsNodeAvailabilityTestGroup,
  createReservedCommandsTestGroup,
];
