import { runAsyncMain } from "devcmd";

export async function example(firstParameter: string, secondParameter: string) {
  console.log(`first parameter: ${firstParameter}`);
  console.log(`second parameter: ${secondParameter}`);
}

runAsyncMain(example);
