import { useCallback, useEffect, useRef, useState } from 'react'
import { toast, Toaster } from 'sonner'
import { useStore } from './store'
import { Footer } from './components/footer'
import { WebWorkerMLCEngine, prebuiltAppConfig } from '@mlc-ai/web-llm'
import { validatedCourse, } from './components/validate'
import { generateCoursePrompt, systemPrompt, generateQuizPrompt } from './lib/prompt'
import { WebGPUCheck } from './components/WebGPUCheck'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { HomePage } from './pages/HomePage'
import { CoursePage } from './pages/CoursePage'
import { SettingsPage } from './pages/SettingsPage'
import { Button } from './components/ui/button'
import { Settings as SettingsIcon } from 'lucide-react'
import { useNavigate } from 'react-router-dom'

function AppContent() {
  const navigate = useNavigate();
  const [, setGeneratingTopic] = useState<string>('')
  const { courses, setTopic, settings, addCourse, updateCourse, addLessonQuestions, setIsGenerating } = useStore()
  const engineRef = useRef<WebWorkerMLCEngine | null>(null);

  useEffect(() => {
    async function init() {
      // Create a web worker for the engine to keep the UI responsive
      // We use a relative path to the worker script
      const engine = new WebWorkerMLCEngine(
        new Worker(
          new URL('./worker.ts', import.meta.url),
          { type: 'module' }
        ),
        { appConfig: prebuiltAppConfig }
      );

      // Reload model if settings change (simplified logic, in real app might need more robust handling)
      engine.setInitProgressCallback((report) => {
        // You can update a progress store here if you want global model loading progress
        console.log('Init:', report.text);
      });

      await engine.reload(settings.defaultModel);
      engineRef.current = engine;
      console.log('Engine ready');
    }

    // Only init if not already (simple check)
    if (!engineRef.current) {
      init().catch(err => console.error('Engine Init Error:', err));
    }
  }, [settings.defaultModel]);


  const handleGenerateCourse = useCallback(async (topicInput: string): Promise<number | null> => {
    setTopic(topicInput);
    setIsGenerating(true);

    if (!engineRef.current) {
      toast.error('AI Engine not ready yet. Please wait.');
      setIsGenerating(false);
      return null;
    }

    // 1. Create Draft Course & Redirect Immediately
    const draftIndex = courses.length;
    addCourse({
      title: `${topicInput} Course`,
      description: `Generating comprehensive course about ${topicInput}...`,
      progress: 0,
      score: 0,
      lessons: [],
      status: 'generating'
    });

    toast.info('Starting course generation...', { duration: 2000 });

    // Return index immediately for navigation
    // API/LLM call happens in background
    (async () => {
      try {
        const response = await engineRef.current!.chat.completions.create({
          messages: [
            { role: 'system', content: systemPrompt(settings.language) },
            { role: 'user', content: generateCoursePrompt(topicInput) }
          ],
          max_tokens: settings.maxTokens,
          temperature: settings.temperature,
          response_format: { type: 'json_object' }
        });

        const responseText = response.choices[0]?.message?.content?.trim();
        const courseData = validatedCourse(responseText as string, topicInput);

        if (courseData) {
          updateCourse(draftIndex, { ...courseData, status: 'ready' });
          toast.success('Course content generated!');
        } else {
          updateCourse(draftIndex, { status: 'error', description: 'Failed to generate content.' });
          toast.error('Failed to generate valid course content.');
        }
      } catch (error) {
        console.error(error);
        updateCourse(draftIndex, { status: 'error', description: 'Error occurred during generation.' });
        toast.error('Error generating course.');
      } finally {
        setIsGenerating(false);
        setGeneratingTopic('');
      }
    })();

    return draftIndex;
  }, [settings, addCourse, updateCourse, setIsGenerating, setGeneratingTopic, courses.length, setTopic]);

  const handleGenerateQuiz = useCallback(async (courseIndex: number, lessonIndex: number) => {
    const course = courses[courseIndex];
    const lesson = course?.lessons[lessonIndex];

    if (!course || !lesson || !engineRef.current) return;

    toast.info('Generating quiz...');
    try {
      const response = await engineRef.current.chat.completions.create({
        messages: [
          { role: 'system', content: systemPrompt(settings.language) },
          { role: 'user', content: generateQuizPrompt(course.title, lesson.title, lesson.content) }
        ],
        temperature: 0.5, // Lower temp for quiz accuracy
        response_format: { type: 'json_object' }
      });

      const text = response.choices[0]?.message?.content || '';
      // Simple parsing (add robust validation in real app similar to courses)
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      const cleanJson = jsonMatch ? jsonMatch[0] : text;
      const data = JSON.parse(cleanJson);

      if (data.questions && Array.isArray(data.questions)) {
        addLessonQuestions(courseIndex, lessonIndex, data.questions);
        toast.success('Quiz generated!');
      } else {
        throw new Error('Invalid quiz format');
      }

    } catch (error) {
      console.error("Quiz generation error:", error);
      toast.error('Failed to generate quiz.');
    }
  }, [courses, settings, addLessonQuestions]);

  return (
    <div className="min-h-screen bg-neutral-50 dark:bg-neutral-950 font-sans text-foreground flex flex-col">
      <WebGPUCheck />

      {/* Floating Settings Button */}
      <Button
        variant="ghost"
        size="icon"
        className="fixed top-4 right-4 z-50 bg-background/50 backdrop-blur-md rounded-full hover:bg-background/80 shadow-sm border"
        onClick={() => navigate('/settings')}
      >
        <SettingsIcon className="w-5 h-5" />
      </Button>

      <div className="flex-1">
        <Routes>
          <Route path="/" element={<HomePage onGenerate={handleGenerateCourse} />} />
          <Route path="/course/:id" element={<CoursePage onGenerateQuiz={handleGenerateQuiz} />} />
          <Route path="/course/:id/lesson/:lessonId" element={<CoursePage onGenerateQuiz={handleGenerateQuiz} />} />
          <Route path="/course/:id/lesson/:lessonId/quiz/:quizId" element={<CoursePage onGenerateQuiz={handleGenerateQuiz} />} />

          <Route path="/settings" element={<SettingsPage />} />
          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
      </div>

      <Toaster position="top-right" />
      <Footer />
    </div>
  )
}

function App() {
  return (
    <BrowserRouter>
      <AppContent />
    </BrowserRouter>
  )
}

export default App
