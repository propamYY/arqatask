import os from "node:os";
import path from "node:path";

// Isolate each test run from the dev database and from other workers.
process.env.SHIFT_DB_PATH = path.join(
  os.tmpdir(),
  `arqatask-test-${process.pid}-${Date.now()}.db`,
);
