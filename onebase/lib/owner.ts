import { ConvexError } from "onebase/values";

/** The owner key is a random id made in the browser; refuse anything too short to be one. */
export function assertOwner(owner: string) {
  if (owner.length < 24 || owner.length > 80) throw new ConvexError({ code: "device" });
}

export const MAX_TOPIC_LENGTH = 120;

export function cleanTopic(topic: string) {
  const clean = topic.replace(/\s+/g, " ").trim();
  if (clean.length < 2) throw new ConvexError({ code: "topic_short" });
  if (clean.length > MAX_TOPIC_LENGTH) throw new ConvexError({ code: "topic_long", max: MAX_TOPIC_LENGTH });
  return clean;
}
