


export const generateCoursePrompt = (topic: string) => `Create a comprehensive micro-course about "${topic}". Structure it as a JSON object with the following format:
{
  "title": "Course Title",
  "description": "Brief course description",
  "progress": 0,
  "score": 0,
  "lessons": [
    {
      "title": "Lesson Title",
      "content": "Detailed lesson content (3-5 paragraphs explaining the concept clearly in Markdown)",
      "completed": false
    }
  ]
}
Create exactly 3 lessons. Make the content educational, engaging, and appropriate for beginners. Use Markdown for lesson content to including headings, lists, and emphasis where appropriate.
Return ONLY the JSON object, no additional text.`;

export const generateQuizPrompt = (topic: string, lessonTitle: string, lessonContent: string) => `Create a short quiz for the lesson "${lessonTitle}" about "${topic}".
Lesson Content: "${lessonContent.substring(0, 500)}..."

Return a JSON object with the format:
{
  "questions": [
    {
      "question": "Question text",
      "options": ["Option A", "Option B", "Option C", "Option D"],
      "correct": 0
    }
  ]
}
Create exactly 2 questions that test understanding of the key concepts. Return ONLY the JSON object.`;


export const systemPrompt = (language: string) => `You are an expert educator and curriculum designer known for creating clear, engaging, and highly effective micro-courses. 
Your goal is to explain complex topics in a simple, digestible way.
${language === 'auto' ? 'Detect the language of the topic and respond in that same language.' : `Always respond in ${language} language.`}`;
