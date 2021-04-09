# DevCmd Integration Tests

DevCmd has an integration test suite to allow comprehensive testing of important functionality.

The integration tests are run in Docker containers to ensure appropriate isolation from the configuration and NPM package installation state of the development machine.

## Overall Process

The dev_cmd `run-integration-test` roughly does the following:

- (re-)build and package the DevCmds packages locally (on the host system)
- install the packages into a [Verdaccio](https://verdaccio.org/) NPM registry in a Docker container
- create an image from the Verdaccio container with the packages installed
- run each integration test group in its own container of this newly created image
- show summary of all tests

## Test Groups and Test Cases

Integration test cases are collected into _test groups_. Each test group is run in a newly created Docker container, i.e. starting with a clean environment.

The test cases in each group are run in sequence, and if one test case fails or has an error, all subsequent cases in that test group are skipped. Subsequent test groups will continue either way.

Neither test cases nor test groups can currently be run in parallel.

## How to add a new test group

Each test group should be defined in its own file. For examples, see `single-package-json-example.ts` and `multiple-package-jsons-example.ts` in this directory.

A test group is defined by a factory function returning a `TestGroup`, which contains the name of the group and the list of test cases.

When you add a new test group file, remember to add the factory function to the list in `integration-test-group-factories.ts`. This is used by the `run-integration-test` command.

## How to add a new test case to an existing test group

Each `TestGroup` contains a list of `TestCase`s, each of which consists of a name and a `TestFunction` to execute the test case.

A test case should return a `TestResult` (or more precisely, a Promise resolving to a `TestResult`) indicating success or failure.

If an error is thrown out of a `TestFunction` the test harness automatically catches it and marks the test cases as having errored.
