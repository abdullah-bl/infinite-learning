import { cronJobs } from "onebase/server";
import { internal } from "./_generated/api";

const crons = cronJobs();
crons.interval("reap stuck courses", { minutes: 5 }, internal.courses.reapStuck);
crons.interval("embed library entries the model missed", { minutes: 5 }, internal.library.reindex);
export default crons;
