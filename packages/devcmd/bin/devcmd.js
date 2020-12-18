#!/usr/bin/env node

"use strict";

const { devcmdCli } = require("devcmd-cli");

devcmdCli().catch((err) => {
  console.error("Uncaught promise rejection:", err);
  process.exit(1);
});
