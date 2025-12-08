import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { BookOpen, CheckCircle, PlayCircle, ArrowLeft, Trophy, Sparkles, Loader2 } from 'lucide-react';
import { useStore } from '../store';
import { Quiz } from './Quiz';
import Markdown from 'react-markdown';
import { Skeleton } from '@/components/ui/skeleton';

interface Course {
    title: string;
    description: string;
    progress: number;
    score: number;
    status?: 'generating' | 'ready' | 'error';
    lessons: {
        title: string;
        content: string;
        completed: boolean;
        questions?: {
            question: string;
            options: string[];
            correct: number;
            userAnswer: number | null;
        }[];
    }[];
}

interface CourseContentProps {
    course: Course;
    courseIndex: number;
    activeLessonIndex?: number;
    initialViewMode: ViewMode;
    onBack: () => void;
    onGenerateQuiz: (courseIndex: number, lessonIndex: number) => Promise<void>;
}

type ViewMode = 'overview' | 'lesson' | 'quiz';

export function CourseContent({ course, courseIndex, activeLessonIndex, initialViewMode, onBack, onGenerateQuiz }: CourseContentProps) {
    const navigate = useNavigate();
    const [isQuizGenerating, setIsQuizGenerating] = useState(false);
    const { updateLessonProgress, courses } = useStore();

    // Get the latest course data from store
    const latestCourse = courses[courseIndex] || course;

    // Derive current lesson from props or default to 0 (though only used if in lesson/quiz mode)
    const currentLessonIndex = activeLessonIndex !== undefined ? activeLessonIndex : 0;
    const currentLesson = latestCourse.lessons?.[currentLessonIndex];

    // Use props to determine view mode
    const viewMode = initialViewMode;

    // Skeleton UI for Generating State
    if (latestCourse.status === 'generating') {
        return (
            <div className="space-y-8 animate-in fade-in duration-500">
                <div className="flex items-center gap-2 mb-4">
                    <Loader2 className="w-5 h-5 animate-spin text-primary" />
                    <span className="text-muted-foreground font-medium">Generating your personalized course...</span>
                </div>

                <div className="w-full max-w-4xl mx-auto border-none bg-white/80 backdrop-blur-md dark:bg-zinc-900/80">
                    <div className="text-center pb-8 pt-10 px-8 border-b border-border/50 bg-muted/10">
                        <Skeleton className="w-16 h-16 rounded-full mx-auto mb-4" />
                        <Skeleton className="h-10 w-3/4 mx-auto mb-4" />
                        <Skeleton className="h-6 w-1/2 mx-auto" />
                    </div>
                    <div className="space-y-8 p-8">
                        <div className="space-y-4">
                            {[1, 2, 3].map((i) => (
                                <div key={i} className="flex items-center gap-4 p-4 rounded-xl border bg-card">
                                    <Skeleton className="w-12 h-12 rounded-full" />
                                    <div className="flex-1 space-y-2">
                                        <Skeleton className="h-6 w-1/3" />
                                        <Skeleton className="h-4 w-1/4" />
                                    </div>
                                    <Skeleton className="h-10 w-20" />
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    const completedLessons = latestCourse.lessons.filter(lesson => lesson.completed).length;
    const progressPercentage = (completedLessons / latestCourse.lessons.length) * 100;

    const handleStartLesson = (lessonIndex: number) => {
        navigate(`/course/${courseIndex}/lesson/${lessonIndex}`);
    };

    const handleStartQuiz = async () => {
        if (!currentLesson.questions || currentLesson.questions.length === 0) {
            setIsQuizGenerating(true);
            try {
                await onGenerateQuiz(courseIndex, currentLessonIndex);
                navigate(`/course/${courseIndex}/lesson/${currentLessonIndex}/quiz/1`);
            } finally {
                setIsQuizGenerating(false);
            }
        } else {
            navigate(`/course/${courseIndex}/lesson/${currentLessonIndex}/quiz/1`);
        }
    };

    const handleQuizComplete = () => {
        updateLessonProgress(courseIndex, currentLessonIndex, true);
        navigate(`/course/${courseIndex}`);
    };

    const handleBackToOverview = () => {
        navigate(`/course/${courseIndex}`);
    };

    if (viewMode === 'quiz' && currentLesson.questions) {
        return (
            <div className="space-y-6">
                <Button variant="ghost" onClick={handleBackToOverview} className="mb-4">
                    <ArrowLeft className="w-4 h-4 mr-2" />
                    Back to Course
                </Button>
                <Quiz
                    questions={currentLesson.questions}
                    courseIndex={courseIndex}
                    lessonIndex={currentLessonIndex}
                    onComplete={handleQuizComplete}
                />
            </div>
        );
    }

    if (viewMode === 'lesson' && currentLesson) {
        return (
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                <Button variant="ghost" onClick={handleBackToOverview} className="mb-4 hover:bg-white/50">
                    <ArrowLeft className="w-4 h-4 mr-2" />
                    Back to Course
                </Button>

                <div className="w-full p-4 rounded-lg max-w-4xl mx-auto border bg-white/50 backdrop-blur-sm dark:bg-zinc-900/50">
                    <div className="border-b border-border/50 bg-muted/20">
                        <div className="flex items-start justify-between">
                            <div className="space-y-1">
                                <h2 className="flex items-center gap-2 text-2xl">
                                    <BookOpen className="w-6 h-6 text-primary" />
                                    {currentLesson.title}
                                </h2>
                                <p className="text-sm font-medium text-muted-foreground ml-8">
                                    Lesson {currentLessonIndex + 1} of {latestCourse.lessons.length}
                                </p>
                            </div>
                            {currentLesson.completed && (
                                <Badge variant="secondary" className="bg-green-100 text-green-700 hover:bg-green-100 px-3 py-1">
                                    <CheckCircle className="w-3 h-3 mr-1" />
                                    Completed
                                </Badge>
                            )}
                        </div>
                    </div>
                    <div className="space-y-8 p-8">
                        <div className="prose prose-lg prose-zinc dark:prose-invert max-w-none prose-headings:font-bold prose-h1:text-3xl prose-p:leading-loose prose-li:leading-relaxed text-foreground">
                            <Markdown>
                                {currentLesson.content}
                            </Markdown>
                        </div>

                        <div className="border-t border-border/50 pt-8 mt-8">
                            <div className="bg-primary/5 rounded-2xl p-6 border-none border-primary/10">
                                <div className="flex items-center justify-between mb-4">
                                    <div className="space-y-1">
                                        <h3 className="text-lg font-semibold flex items-center gap-2">
                                            <Sparkles className="w-5 h-5 text-primary" />
                                            Knowledge Check
                                        </h3>
                                        <p className="text-zinc-700 text-sm">
                                            {currentLesson.questions && currentLesson.questions.length > 0
                                                ? "Test your understanding of this lesson with a short quiz."
                                                : "Generate a quiz to test your understanding."}
                                        </p>
                                    </div>
                                    <Badge variant="outline" className="bg-background">
                                        {currentLesson.questions?.length || 0} questions
                                    </Badge>
                                </div>
                                <Button
                                    size="lg"
                                    onClick={handleStartQuiz}
                                    disabled={isQuizGenerating}
                                    className="w-full sm:w-auto shadow-lg shadow-primary/20"
                                >
                                    {isQuizGenerating ? (
                                        <>
                                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                            Generating Quiz...
                                        </>
                                    ) : (
                                        <>
                                            <PlayCircle className="w-4 h-4 mr-2" />
                                            {currentLesson.questions && currentLesson.questions.length > 0 ? "Start Quiz" : "Generate Quiz"}
                                        </>
                                    )}
                                </Button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <Button variant="ghost" onClick={onBack} className="mb-4 hover:bg-white/50">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Generate New Course
            </Button>

            <Card className="w-full max-w-4xl mx-auto border-none bg-white/80 backdrop-blur-md dark:bg-zinc-900/80 overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500" />
                <CardHeader className="pb-8 pt-10 px-8 text-center border-b border-border/50 bg-muted/10">
                    <CardTitle className="flex flex-col items-center gap-4 text-4xl font-bold tracking-tight">
                        <div className="p-4 bg-background rounded-full border">
                            <BookOpen className="w-10 h-10 text-primary" />
                        </div>
                        {latestCourse.title}
                    </CardTitle>
                    <p className="text-xl text-muted-foreground max-w-2xl mx-auto mt-4 leading-relaxed">
                        {latestCourse.description}
                    </p>
                </CardHeader>
                <CardContent className="space-y-8 p-8">
                    <div className="space-y-3 bg-muted/30 p-6 rounded-2xl border border-border/50">
                        <div className="flex items-center justify-between text-sm font-medium">
                            <span className="text-muted-foreground">Course Progress</span>
                            <span className="text-primary">{Math.round(progressPercentage)}%</span>
                        </div>
                        <Progress value={progressPercentage} className="h-3 rounded-full" />
                        <div className="flex justify-between text-xs text-muted-foreground">
                            <span>{completedLessons} completed</span>
                            <span>{latestCourse.lessons.length} total lessons</span>
                        </div>
                    </div>

                    {progressPercentage === 100 && (
                        <div className="bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 border border-green-200 dark:border-green-800 rounded-2xl p-8 text-center animate-in zoom-in-95 duration-500">
                            <div className="w-16 h-16 bg-green-100 dark:bg-green-900/50 rounded-full flex items-center justify-center mx-auto mb-4">
                                <Trophy className="w-8 h-8 text-green-600 dark:text-green-400" />
                            </div>
                            <h3 className="text-2xl font-bold text-green-800 dark:text-green-300 mb-2">Course Completed!</h3>
                            <p className="text-green-700 dark:text-green-400">
                                You've mastered {latestCourse.title}. Great job!
                            </p>
                        </div>
                    )}

                    <div className="space-y-6">
                        <h3 className="text-xl font-bold flex items-center gap-2">
                            Your Learning Path
                        </h3>
                        <div className="grid gap-4">
                            {latestCourse.lessons.map((lesson, index) => (
                                <div
                                    key={index}
                                    className={`group flex items-center gap-4 p-4 rounded-xl border transition-all duration-300 ${lesson.completed
                                        ? 'bg-green-50/50 border-green-100 dark:bg-green-900/10 dark:border-green-900/30'
                                        : 'bg-card border-border hover:border-primary/30 hover:shadow-md'
                                        }`}
                                >
                                    <div className={`
                                        w-12 h-12 rounded-full flex items-center justify-center text-lg font-bold transition-colors shadow-sm
                                        ${lesson.completed
                                            ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                                            : 'bg-muted text-muted-foreground group-hover:bg-primary/10 group-hover:text-primary'}
                                    `}>
                                        {lesson.completed ? <CheckCircle className="w-6 h-6" /> : index + 1}
                                    </div>

                                    <div className="flex-1 min-w-0">
                                        <h4 className={`font-semibold text-lg truncate ${lesson.completed ? 'text-green-900 dark:text-green-300' : ''}`}>
                                            {lesson.title}
                                        </h4>
                                        <div className="flex items-center gap-4 mt-1">
                                            <span className="text-xs text-muted-foreground flex items-center gap-1">
                                                <Sparkles className="w-3 h-3" />
                                                {lesson.questions?.length || 0} questions
                                            </span>
                                            {lesson.completed && (
                                                <span className="text-xs font-medium text-green-600 dark:text-green-400">
                                                    Completed
                                                </span>
                                            )}
                                        </div>
                                    </div>

                                    <Button
                                        onClick={() => handleStartLesson(index)}
                                        variant={lesson.completed ? "outline" : "default"}
                                        className={lesson.completed ? "border-green-200 text-green-700 hover:bg-green-50 hover:text-green-800" : "shadow-lg shadow-primary/10"}
                                    >
                                        {lesson.completed ? 'Review' : 'Start'}
                                    </Button>
                                </div>
                            ))}
                        </div>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
