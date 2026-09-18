import { cronJobs } from "convex/server";

import { sweepAbandonedRef } from "./maintenance.js";

const crons = cronJobs();
crons.interval("abandon expired and unattended matches", { minutes: 1 }, sweepAbandonedRef, {});

export default crons;
