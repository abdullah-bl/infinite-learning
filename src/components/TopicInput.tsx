import { useState, useRef, useEffect } from 'react';
import { Button } from './ui/button';
import { Sparkles, ArrowUp } from 'lucide-react';
import { useStore } from '../store';

interface TopicInputProps {
    onGenerateCourse: (topic: string) => void;
}

export function TopicInput({ onGenerateCourse }: TopicInputProps) {
    const [inputTopic, setInputTopic] = useState('');
    const { isGenerating } = useStore();
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    const handleSubmit = (e?: React.FormEvent) => {
        e?.preventDefault();
        if (inputTopic.trim() && !isGenerating) {
            onGenerateCourse(inputTopic);
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSubmit();
        }
    };

    // Auto-resize textarea
    useEffect(() => {
        if (textareaRef.current) {
            textareaRef.current.style.height = 'auto';
            textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 200)}px`;
        }
    }, [inputTopic]);

    const exampleTopics = [
        'Quantum Physics Basics',
        'How does the Blockchain work?',
        'Renaissance Art History',
        'Introduction to Pottery'
    ];

    return (
        <div className="w-full max-w-3xl mx-auto space-y-6">
            <div className="relative group border rounded-xl bg-white dark:bg-neutral-800/50 shadow-sm hover:shadow-md transition-all duration-300 border focus-within:border-primary/20 focus-within:bg-white dark:focus-within:bg-neutral-800 focus-within:shadow-xl">
                <form onSubmit={handleSubmit} className="relative flex flex-col p-4">
                    <textarea
                        ref={textareaRef}
                        value={inputTopic}
                        onChange={(e) => setInputTopic(e.target.value)}
                        onKeyDown={handleKeyDown}
                        placeholder="What do you want to learn today?"
                        className="w-full bg-transparent border-none text-lg placeholder:text-muted-foreground/50 resize-none focus:ring-0 min-h-[60px] max-h-[200px] py-3 pr-12 scrollbar-hide"
                        style={{ height: '60px', outline: 'none' }}
                        disabled={isGenerating}
                        autoFocus
                    />

                    <div className="flex justify-between items-center mt-2 px-1">
                        <div className="text-xs text-muted-foreground hidden sm:block">
                            <span className="opacity-70">Shift + Enter for new line</span>
                        </div>
                        <Button
                            type="submit"
                            size="icon"
                            disabled={!inputTopic.trim() || inputTopic.length < 5 || isGenerating}
                            className={`rounded-full w-10 h-10 ml-auto transition-all duration-300 ${inputTopic.trim()
                                ? 'bg-primary hover:bg-primary/90 shadow-lg scale-100'
                                : 'bg-muted text-muted-foreground scale-95 opacity-50 cursor-not-allowed'
                                }`}
                        >
                            {isGenerating ? (
                                <Sparkles className="w-5 h-5 animate-spin" />
                            ) : (
                                <ArrowUp className="w-6 h-6" />
                            )}
                        </Button>
                    </div>
                </form>
            </div>

            <div className="flex flex-wrap justify-center gap-2">
                {exampleTopics.map((topic) => (
                    <button
                        key={topic}
                        onClick={() => setInputTopic(topic)}
                        disabled={isGenerating}
                        className="px-4 py-2 rounded text-sm bg-white dark:bg-black/20 hover:bg-white/80 dark:hover:bg-black/40 border border-transparent hover:border-black/5 dark:hover:border-white/10 transition-all duration-200 cursor-pointer backdrop-blur-sm"
                    >
                        {topic}
                    </button>
                ))}
            </div>
        </div>
    );
}
