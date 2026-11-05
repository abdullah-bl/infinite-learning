// How long a question waits before it comes back, by box: a day after a wrong answer, then
// three days, a week, about two weeks, about a month.
const DAY = 24 * 60 * 60 * 1000;
export const WAITS = [1, 3, 7, 16, 35].map((d) => d * DAY);

/** The box a card moves to after an answer: up one when right, back to the first when wrong.
 *  A first answer that is right starts in the second box, so it waits three days, not one. */
export const nextBox = (box: number | undefined, right: boolean) => (right ? Math.min((box ?? 0) + 1, WAITS.length - 1) : 0);
