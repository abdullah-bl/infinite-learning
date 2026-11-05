import { defineComponents } from "onebase/components";
import { actionCache } from "onebase/components/action-cache";
import { DAY, HOUR, MINUTE, rateLimiter } from "onebase/components/rate-limiter";

// There are no accounts, so these limits are what stop one visitor from using up the
// free OpenRouter quota for everyone.
export default defineComponents({
  limiter: rateLimiter({
    rates: {
      // A visitor can start a few courses in a burst, then one every 12 minutes.
      course: { kind: "token bucket", rate: 5, period: HOUR },
      quiz: { kind: "token bucket", rate: 20, period: HOUR },
      // Every visitor together.
      courseAll: { kind: "fixed window", rate: 400, period: DAY },
      quizAll: { kind: "fixed window", rate: 1200, period: DAY },
      // looking for similar courses while someone types
      suggest: { kind: "token bucket", rate: 40, period: MINUTE },
      // reading older courses for their key ideas, for the knowledge map
      concepts: { kind: "token bucket", rate: 15, period: HOUR },
    },
  }),
  // The same words typed again (or by someone else) reuse their embedding instead of a new call.
  cache: actionCache({ ttl: 7 * DAY }),
});
