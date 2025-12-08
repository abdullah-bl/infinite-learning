import { useNavigate } from 'react-router-dom';
import { useStore } from '../store';
import { TopicInput } from '../components/TopicInput';
import { Sparkles, BookOpen, ArrowRight, CheckCircle, Clock } from 'lucide-react';
import { Button } from '../components/ui/button';

interface HomePageProps {
    onGenerate: (topic: string) => Promise<number | null>;
}

export function HomePage({ onGenerate }: HomePageProps) {
    const { courses } = useStore();
    const navigate = useNavigate();

    const handleGenerate = async (topic: string) => {
        const index = await onGenerate(topic);
        if (index !== null) {
            navigate(`/course/${index}`);
        }
    };

    return (
        <div className="space-y-16 pb-20">
            {/* Hero Section */}
            <section className="relative pt-20 pb-0 md:pt-32 text-center space-y-8 animate-in fade-in slide-in-from-bottom-8 duration-700">
                <div className="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-primary/10 via-background to-background opacity-50" />

                <div className="space-y-4 max-w-3xl mx-auto px-4">
                    <div className="inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 border-transparent bg-primary/10 text-primary hover:bg-primary/20 backdrop-blur-sm">
                        <Sparkles className="w-3 h-3 mr-1" />
                        AI-Powered Learning
                    </div>
                    <h1 className="text-4xl font-extrabold tracking-tight lg:text-6xl bg-gradient-to-br from-foreground to-foreground/60 bg-clip-text text-transparent pb-2">
                        Master Any Topic in <br className="hidden md:block" />
                        <span className="text-primary relative">
                            Minutes
                            <svg className="absolute w-full h-3 -bottom-1 left-0 text-primary/20 -z-10" viewBox="0 0 100 10" preserveAspectRatio="none">
                                <path d="M0 5 Q 50 10 100 5 L 100 0 Q 50 5 0 0 Z" fill="currentColor" />
                            </svg>
                        </span>
                    </h1>
                    <p className="text-xl text-muted-foreground max-w-[600px] mx-auto leading-relaxed">
                        Infinite Learning uses advanced AI to generate personalized micro-courses tailored to your interests. Just type a topic and start learning.
                    </p>
                </div>

                <div className="px-4 relative z-10">
                    <TopicInput onGenerateCourse={handleGenerate} />
                </div>
            </section>

            {/* Knowledge Base Section */}
            {courses.length > 0 && (
                <section className="container mx-auto px-4 max-w-6xl animate-in fade-in slide-in-from-bottom-8 duration-700 delay-200">
                    <div className="flex items-center justify-between mb-8">
                        <div>
                            <h2 className="text-2xl font-bold tracking-tight">Your Knowledge Base</h2>
                            <p className="text-muted-foreground text-sm mt-1">
                                Continue where you left off
                            </p>
                        </div>
                        <Button variant="ghost" className="hidden sm:flex" disabled>
                            View All <ArrowRight className="w-4 h-4 ml-2" />
                        </Button>
                    </div>

                    <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                        {courses.map((course, index) => (
                            <div
                                key={index}
                                className="group relative flex flex-col justify-between overflow-hidden rounded-2xl border bg-card text-card-foreground shadow-sm transition-all hover:shadow-xl hover:shadow-primary/5 hover:border-primary/20 cursor-pointer bg-white/50 dark:bg-zinc-900/50 backdrop-blur-sm"
                                onClick={() => navigate(`/course/${index}`)}
                            >
                                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-primary/50 to-transparent scale-x-0 group-hover:scale-x-100 transition-transform duration-500" />

                                <div className="p-6 space-y-4">
                                    <div className="flex items-start justify-between">
                                        <div className="p-2.5 bg-primary/10 rounded-xl group-hover:scale-110 transition-transform duration-300">
                                            <BookOpen className="w-5 h-5 text-primary" />
                                        </div>
                                        {course.lessons.every(l => l.completed) && (
                                            <div className="bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 p-1.5 rounded-full" title="Completed">
                                                <CheckCircle className="w-4 h-4" />
                                            </div>
                                        )}
                                    </div>

                                    <div>
                                        <h3 className="font-bold text-lg leading-tight mb-2 group-hover:text-primary transition-colors line-clamp-1">
                                            {course.title}
                                        </h3>
                                        <p className="text-sm text-muted-foreground line-clamp-2 leading-relaxed">
                                            {course.description}
                                        </p>
                                    </div>
                                </div>

                                <div className="p-6 pt-0 mt-auto">
                                    <div className="flex items-center justify-between text-xs text-muted-foreground mb-3">
                                        <div className="flex items-center gap-1">
                                            <Clock className="w-3 h-3" />
                                            <span>{Math.max(1, Math.round(course.lessons.length * 5))} min</span>
                                        </div>
                                        <span>{course.lessons.filter(l => l.completed).length} / {course.lessons.length} Lessons</span>
                                    </div>
                                    <div className="h-1.5 w-full bg-secondary rounded-full overflow-hidden">
                                        <div
                                            className="h-full bg-primary transition-all duration-500 ease-in-out"
                                            style={{ width: `${(course.lessons.filter(l => l.completed).length / course.lessons.length) * 100}%` }}
                                        />
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </section>
            )}
        </div>
    );
}
