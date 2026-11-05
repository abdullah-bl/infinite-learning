// What counts as "the same course": the same topic, typed with any case, spacing, punctuation
// or Arabic letter variants, in the same language, at the same level and length.

/** Folds the differences people don't mean: case, accents, punctuation, extra spaces, Arabic
 *  diacritics and tatweel, and the alef, yaa and taa marbuta variants. */
export function normalise(text: string) {
  return text
    .normalize("NFKD")
    .toLowerCase()
    .replace(/[̀-ͯ]/g, "") // Latin accents
    .replace(/[ً-ٰٟـ]/g, "") // Arabic diacritics and tatweel
    .replace(/[أإآٱ]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ة/g, "ه")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

export const courseKey = (topic: string, language: string, level: string, lessons: number) =>
  `${normalise(topic)}|${language.toLowerCase()}|${level}|${lessons}`;
