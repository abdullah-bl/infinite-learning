import { useParams, useNavigate } from 'react-router-dom';
import { useStore } from '../store';
import { CourseContent } from '../components/CourseContent';
import { Button } from '../components/ui/button';
import { ArrowLeft } from 'lucide-react';

interface CoursePageProps {
    onGenerateQuiz: (courseIndex: number, lessonIndex: number) => Promise<void>;
}

export function CoursePage({ onGenerateQuiz }: CoursePageProps) {
    const { id, lessonId, quizId } = useParams();
    const navigate = useNavigate();
    const { courses } = useStore();

    // Parse the course index from url params
    const courseIndex = parseInt(id || '0', 10);
    const lessonIndex = lessonId ? parseInt(lessonId, 10) : undefined;
    const course = courses[courseIndex];

    if (!course) {
        return (
            <div className="container mx-auto px-4 py-20 text-center space-y-4">
                <h1 className="text-2xl font-bold">Course Not Found</h1>
                <p className="text-muted-foreground">The course you are looking for does not exist.</p>
                <Button onClick={() => navigate('/')}>
                    <ArrowLeft className="w-4 h-4 mr-2" />
                    Back to Home
                </Button>
            </div>
        );
    }

    // Determine view mode based on URL params
    let viewMode: 'overview' | 'lesson' | 'quiz' = 'overview';
    if (quizId && lessonIndex !== undefined) {
        viewMode = 'quiz';
    } else if (lessonIndex !== undefined) {
        viewMode = 'lesson';
    }

    return (
        <div className="container mx-auto px-4 py-8 md:py-12">
            <CourseContent
                course={course}
                courseIndex={courseIndex}
                activeLessonIndex={lessonIndex}
                initialViewMode={viewMode}
                onBack={() => navigate('/')}
                onGenerateQuiz={onGenerateQuiz}
            />
        </div>
    );
}
