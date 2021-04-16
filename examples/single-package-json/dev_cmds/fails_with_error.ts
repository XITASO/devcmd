import { runAsyncMain } from "devcmd";

export async function example() {
  console.log("This test command is about to fail by throwing an error");
  throw new Error("This error should cause a non-zero exit code");
}

runAsyncMain(example);
