import { create } from "zustand";
import { persist } from "zustand/middleware";

interface Settings {
    defaultModel: string;
    temperature: number;
    maxTokens: number;
    language: string;
    theme: 'light' | 'dark' | 'system';
}

interface Lesson {
    title: string;
    content: string;
    completed: boolean;
    questions?: {
        question: string;
        options: string[];
        correct: number;
        userAnswer: number | null;
    }[];
}

interface Course {
    title: string;
    description: string;
    progress: number;
    lessons: Lesson[];
    score: number;
    status?: 'generating' | 'ready' | 'error';
}

interface InfiniteLearning {
    topic: string;
    courses: Course[];
    settings: Settings;
}

interface Store extends InfiniteLearning {
    setTopic: (topic: string) => void;
    setCourses: (courses: InfiniteLearning["courses"]) => void;
    addCourse: (course: Course) => void;
    updateCourse: (index: number, courseData: Partial<Course>) => void;
    updateLessonProgress: (courseIndex: number, lessonIndex: number, completed: boolean) => void;
    updateQuizAnswer: (courseIndex: number, lessonIndex: number, questionIndex: number, answer: number) => void;
    addLessonQuestions: (courseIndex: number, lessonIndex: number, questions: Lesson['questions']) => void;
    isGenerating: boolean;
    setIsGenerating: (generating: boolean) => void;
    updateSettings: (settings: Partial<Settings>) => void;
    resetSettings: () => void;
}

const defaultSettings: Settings = {
    defaultModel: 'gemma-2-2b-it-q4f32_1-MLC',
    temperature: 0.7,
    maxTokens: 2000,
    language: 'auto',
    theme: 'system'
};

export const useStore = create<Store>()(
    persist(
        (set) => ({
            topic: "",
            courses: [],
            isGenerating: false,
            settings: defaultSettings,
            setTopic: (topic: string) => set({ topic }),
            setCourses: (courses: InfiniteLearning["courses"]) => set({ courses }),
            addCourse: (course: Course) =>
                set((state) => ({ courses: [...state.courses, course] })),
            updateCourse: (index: number, courseData: Partial<Course>) =>
                set((state) => {
                    const newCourses = [...state.courses];
                    if (newCourses[index]) {
                        newCourses[index] = { ...newCourses[index], ...courseData };
                    }
                    return { courses: newCourses };
                }),
            setIsGenerating: (isGenerating: boolean) => set({ isGenerating }),
            updateLessonProgress: (courseIndex: number, lessonIndex: number, completed: boolean) =>
                set((state) => {
                    const newCourses = state.courses.map((course, cIndex) => {
                        if (cIndex !== courseIndex) return course;
                        const newLessons = course.lessons.map((lesson, lIndex) => {
                            if (lIndex !== lessonIndex) return lesson;
                            return { ...lesson, completed };
                        });
                        return { ...course, lessons: newLessons };
                    });
                    return { courses: newCourses };
                }),
            updateQuizAnswer: (courseIndex: number, lessonIndex: number, questionIndex: number, answer: number) =>
                set((state) => {
                    const newCourses = state.courses.map((course, cIndex) => {
                        if (cIndex !== courseIndex) return course;
                        const newLessons = course.lessons.map((lesson, lIndex) => {
                            if (lIndex !== lessonIndex) return lesson;
                            // Ensure questions exist before mapping
                            if (!lesson.questions) return lesson;

                            const newQuestions = lesson.questions.map((question, qIndex) => {
                                if (qIndex !== questionIndex) return question;
                                return { ...question, userAnswer: answer };
                            });
                            return { ...lesson, questions: newQuestions };
                        });
                        return { ...course, lessons: newLessons };
                    });
                    return { courses: newCourses };
                }),
            addLessonQuestions: (courseIndex: number, lessonIndex: number, questions: Lesson['questions']) =>
                set((state) => {
                    if (!questions) return state;
                    const newCourses = state.courses.map((course, cIndex) => {
                        if (cIndex !== courseIndex) return course;
                        const newLessons = course.lessons.map((lesson, lIndex) => {
                            if (lIndex !== lessonIndex) return lesson;
                            return { ...lesson, questions };
                        });
                        return { ...course, lessons: newLessons };
                    });
                    return { courses: newCourses };
                }),
            updateSettings: (newSettings: Partial<Settings>) =>
                set((state) => ({
                    settings: { ...state.settings, ...newSettings }
                })),
            resetSettings: () => set({ settings: defaultSettings }),
        }),
        {
            name: 'infinite-learning-storage',
            partialize: (state) => ({
                courses: state.courses,
                settings: state.settings
            })
        }
    )
);