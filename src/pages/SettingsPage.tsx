import { useNavigate } from 'react-router-dom';
import { ArrowLeft, RotateCcw } from 'lucide-react';
import { useStore } from '../store';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';
import { prebuiltAppConfig } from '@mlc-ai/web-llm';

// Available models for WebLLM
const AVAILABLE_MODELS = prebuiltAppConfig.model_list.map(model => ({
    value: model.model_id,
    label: model.model_id
}))

const TEMPERATURE_OPTIONS = [
    { value: 0.1, label: '0.1 (Very Focused)' },
    { value: 0.3, label: '0.3 (Focused)' },
    { value: 0.5, label: '0.5 (Balanced)' },
    { value: 0.7, label: '0.7 (Creative)' },
    { value: 0.9, label: '0.9 (Very Creative)' },
    { value: 1.0, label: '1.0 (Maximum Creativity)' },
];

const MAX_TOKENS_OPTIONS = [
    { value: 1000, label: '1000 (Short)' },
    { value: 1500, label: '1500 (Medium)' },
    { value: 2000, label: '2000 (Long)' },
    { value: 3000, label: '3000 (Very Long)' },
    { value: 4000, label: '4000 (Maximum)' },
];

const LANGUAGE_OPTIONS = [
    { value: 'auto', label: 'Auto-detect' },
    { value: 'en', label: 'English' },
    { value: 'es', label: 'Español' },
    { value: 'fr', label: 'Français' },
    { value: 'de', label: 'Deutsch' },
    { value: 'it', label: 'Italiano' },
    { value: 'pt', label: 'Português' },
    { value: 'ru', label: 'Русский' },
    { value: 'ja', label: '日本語' },
    { value: 'ko', label: '한국어' },
    { value: 'zh', label: '中文' },
    { value: 'ar', label: 'العربية' },
];

const THEME_OPTIONS = [
    { value: 'light', label: 'Light' },
    { value: 'dark', label: 'Dark' },
    { value: 'system', label: 'System' },
];

export function SettingsPage() {
    const { settings, updateSettings, resetSettings } = useStore();
    const navigate = useNavigate();

    const handleModelChange = (model: string) => {
        updateSettings({ defaultModel: model });
        toast.success('Default model updated');
    };

    const handleTemperatureChange = (temperature: string) => {
        updateSettings({ temperature: parseFloat(temperature) });
        toast.success('Temperature updated');
    };

    const handleMaxTokensChange = (maxTokens: string) => {
        updateSettings({ maxTokens: parseInt(maxTokens) });
        toast.success('Max tokens updated');
    };

    const handleLanguageChange = (language: string) => {
        updateSettings({ language });
        toast.success('Language preference updated');
    };

    const handleThemeChange = (theme: 'light' | 'dark' | 'system') => {
        updateSettings({ theme });
        toast.success('Theme updated');
    };

    const handleResetSettings = () => {
        resetSettings();
        toast.success('Settings reset to defaults');
    };

    return (
        <div className="container mx-auto px-4 py-8 md:py-12 max-w-3xl animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="flex items-center justify-between mb-8">
                <div className="flex items-center gap-4">
                    <Button variant="ghost" size="icon" onClick={() => navigate('/')}>
                        <ArrowLeft className="h-4 w-4" />
                    </Button>
                    <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
                </div>
                <Button
                    variant="outline"
                    size="sm"
                    onClick={handleResetSettings}
                    className="h-9 px-3"
                >
                    <RotateCcw className="h-4 w-4 mr-2" />
                    Reset Defaults
                </Button>
            </div>

            <div className="space-y-6">
                {/* AI Model Settings */}
                <Card className="border-none shadow-md bg-white/50 backdrop-blur-sm dark:bg-zinc-900/50">
                    <CardHeader>
                        <CardTitle className="text-xl">AI Model</CardTitle>
                        <CardDescription>
                            Configure the AI model behavior and parameters for course generation.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        <div className="space-y-3">
                            <Label htmlFor="model-select" className="text-base">Default Model</Label>
                            <Select value={settings.defaultModel} onValueChange={handleModelChange}>
                                <SelectTrigger id="model-select" className="h-11">
                                    <SelectValue placeholder="Select a model" />
                                </SelectTrigger>
                                <SelectContent>
                                    {AVAILABLE_MODELS.map((model) => (
                                        <SelectItem key={model.value} value={model.value}>
                                            {model.label}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            <p className="text-sm text-muted-foreground">
                                Larger models are more capable but require more memory and load slower.
                            </p>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="space-y-3">
                                <Label htmlFor="temperature-select" className="text-base">Creativity</Label>
                                <Select
                                    value={settings.temperature.toString()}
                                    onValueChange={handleTemperatureChange}
                                >
                                    <SelectTrigger id="temperature-select" className="h-11">
                                        <SelectValue placeholder="Select creativity level" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {TEMPERATURE_OPTIONS.map((option) => (
                                            <SelectItem key={option.value} value={option.value.toString()}>
                                                {option.label}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="space-y-3">
                                <Label htmlFor="tokens-select" className="text-base">Response Length</Label>
                                <Select
                                    value={settings.maxTokens.toString()}
                                    onValueChange={handleMaxTokensChange}
                                >
                                    <SelectTrigger id="tokens-select" className="h-11">
                                        <SelectValue placeholder="Select response length" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {MAX_TOKENS_OPTIONS.map((option) => (
                                            <SelectItem key={option.value} value={option.value.toString()}>
                                                {option.label}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* Language & Interface Settings */}
                <Card className="border-none shadow-md bg-white/50 backdrop-blur-sm dark:bg-zinc-900/50">
                    <CardHeader>
                        <CardTitle className="text-xl">Interface</CardTitle>
                        <CardDescription>
                            Customize the language and visual appearance of the application.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="space-y-3">
                                <Label htmlFor="language-select" className="text-base">Language</Label>
                                <Select value={settings.language} onValueChange={handleLanguageChange}>
                                    <SelectTrigger id="language-select" className="h-11">
                                        <SelectValue placeholder="Select language" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {LANGUAGE_OPTIONS.map((option) => (
                                            <SelectItem key={option.value} value={option.value}>
                                                {option.label}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="space-y-3">
                                <Label htmlFor="theme-select" className="text-base">Theme</Label>
                                <Select value={settings.theme} onValueChange={handleThemeChange}>
                                    <SelectTrigger id="theme-select" className="h-11">
                                        <SelectValue placeholder="Select theme" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {THEME_OPTIONS.map((option) => (
                                            <SelectItem key={option.value} value={option.value}>
                                                {option.label}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
