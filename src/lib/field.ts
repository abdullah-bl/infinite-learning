// The page is a row of flat colour fields. Lessons take them in turn so each chapter has its own.
export type Field = "f1" | "f2" | "f3" | "f4";
const chapters: Field[] = ["f3", "f4", "f2", "f3", "f4", "f2"];
export const chapterField = (i: number): Field => chapters[i % chapters.length];
