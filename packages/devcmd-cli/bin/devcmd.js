#!/usr/bin/env node

"use strict";

const { devcmdCli } = require("../");

devcmdCli().catch((err) => {
  console.error("Uncaught promise rejection:", err);
  process.exit(1);
});
