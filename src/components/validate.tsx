import { toast } from "sonner";

export const validatedCourse = (responseText: string, topic: string) => {
    // Try to parse the JSON response with multiple fallback strategies
    let courseData;
    try {
        // Strategy 1: Remove markdown formatting and parse
        let cleanJson = responseText.replace(/```json\n?|\n?```/g, '').trim();

        // Strategy 2: Try to extract JSON from text if it's embedded
        const jsonMatch = cleanJson.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
            cleanJson = jsonMatch[0];
        }

        courseData = JSON.parse(cleanJson);
    } catch (parseError) {
        console.error('Failed to parse JSON:', responseText);
        console.error('Parse error:', parseError);

        // Fallback: Create a basic course structure
        console.warn('Creating fallback course structure due to parsing failure');
        toast.warning('AI response was malformed. Creating a basic course structure for you.');
        courseData = {
            title: `${topic} Course`,
            description: `A comprehensive course about ${topic}`,
            lessons: [
                {
                    title: `Introduction to ${topic}`,
                    content: `This lesson introduces the fundamental concepts of ${topic}. You'll learn the basic principles and key ideas that form the foundation of this subject.`,
                    questions: [
                        {
                            question: `What is the main focus of this ${topic} course?`,
                            options: ['Basic concepts', 'Advanced techniques', 'Practical applications', 'Theoretical foundations'],
                            correct: 0
                        },
                        {
                            question: `Why is understanding ${topic} important?`,
                            options: ['It\'s fundamental', 'It\'s practical', 'It\'s widely used', 'All of the above'],
                            correct: 3
                        }
                    ]
                },
                {
                    title: `Core Concepts of ${topic}`,
                    content: `In this lesson, we dive deeper into the core concepts of ${topic}. You'll explore the main principles and understand how they apply in various contexts.`,
                    questions: [
                        {
                            question: `What are the key principles of ${topic}?`,
                            options: ['Simple rules', 'Complex theories', 'Practical guidelines', 'Fundamental concepts'],
                            correct: 3
                        },
                        {
                            question: `How do these concepts apply in practice?`,
                            options: ['Directly', 'With modifications', 'Contextually', 'Systematically'],
                            correct: 2
                        }
                    ]
                },
                {
                    title: `Practical Applications of ${topic}`,
                    content: `This final lesson focuses on the practical applications of ${topic}. You'll learn how to apply what you've learned in real-world scenarios and understand the broader implications.`,
                    questions: [
                        {
                            question: `What is the best way to apply ${topic} knowledge?`,
                            options: ['Theoretically', 'Practically', 'Systematically', 'Creatively'],
                            correct: 1
                        },
                        {
                            question: `What should you remember most about ${topic}?`,
                            options: ['The details', 'The big picture', 'The applications', 'The fundamentals'],
                            correct: 3
                        }
                    ]
                }
            ]
        };
    }

    // Validate the structure with detailed error messages
    console.log('Raw course data:', courseData);

    if (!courseData || typeof courseData !== 'object') {
        throw new Error('Invalid course structure: Response is not a valid object');
    }

    if (!courseData.title || typeof courseData.title !== 'string') {
        throw new Error('Invalid course structure: Missing or invalid title');
    }

    if (!courseData.lessons || !Array.isArray(courseData.lessons)) {
        throw new Error('Invalid course structure: Missing or invalid lessons array');
    }

    if (courseData.lessons.length === 0) {
        throw new Error('Invalid course structure: No lessons found');
    }

    // Validate each lesson structure
    for (let i = 0; i < courseData.lessons.length; i++) {
        const lesson = courseData.lessons[i];
        if (!lesson || typeof lesson !== 'object') {
            throw new Error(`Invalid course structure: Lesson ${i + 1} is not a valid object`);
        }

        if (!lesson.title || typeof lesson.title !== 'string') {
            console.warn(`Lesson ${i + 1} missing title, will use default`);
        }

        if (!lesson.content || typeof lesson.content !== 'string') {
            console.warn(`Lesson ${i + 1} missing content, will use default`);
        }

        if (!lesson.questions || !Array.isArray(lesson.questions)) {
            console.warn(`Lesson ${i + 1} missing questions, will use empty array`);
        }
    }

    // Ensure proper structure with robust validation and fallbacks
    const validatedCourse = {
        title: courseData.title || `${topic} Course`,
        description: courseData.description || `Learn about ${topic}`,
        progress: 0,
        score: 0,
        lessons: courseData.lessons.map((lesson: any, index: number) => {
            // Ensure each lesson has proper structure
            const validatedLesson = {
                title: lesson.title || `Lesson ${index + 1}`,
                content: lesson.content || `This lesson covers important concepts about ${topic}.`,
                completed: false,
                // Questions are now optional and generated lazily
                questions: undefined
            };

            return validatedLesson;
        }),
        status: 'ready' as const
    };
    return validatedCourse;
}