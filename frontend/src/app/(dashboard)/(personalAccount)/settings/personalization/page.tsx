'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Sparkles, Brain, Zap, MessageSquare } from 'lucide-react';

export default function PersonalizationPage() {
  const [creativity, setCreativity] = useState([70]);
  const [verbosity, setVerbosity] = useState([50]);
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async () => {
    setIsSaving(true);
    await new Promise(resolve => setTimeout(resolve, 1000));
    setIsSaving(false);
  };

  return (
    <div className="p-6 space-y-8">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 mb-2">
          <Sparkles className="h-5 w-5 text-primary" />
          <h2 className="text-xl font-semibold">AI Personalization</h2>
        </div>
        <p className="text-sm text-muted-foreground">
          Customize how Iris responds to you and handles tasks
        </p>
      </div>

      {/* Response Tone */}
      <div className="space-y-4 pb-6 border-b border-border/50">
        <div>
          <Label className="text-base">Response Tone</Label>
          <p className="text-sm text-muted-foreground mt-1">
            Choose how Iris communicates with you
          </p>
        </div>
        <RadioGroup defaultValue="professional" className="grid gap-3">
          <div className="flex items-start space-x-3 space-y-0">
            <RadioGroupItem value="concise" id="concise" className="mt-1" />
            <div className="flex-1">
              <Label htmlFor="concise" className="font-medium cursor-pointer">
                Concise
              </Label>
              <p className="text-sm text-muted-foreground">
                Short, direct responses. Gets straight to the point.
              </p>
            </div>
          </div>
          <div className="flex items-start space-x-3 space-y-0">
            <RadioGroupItem value="professional" id="professional" className="mt-1" />
            <div className="flex-1">
              <Label htmlFor="professional" className="font-medium cursor-pointer">
                Professional
              </Label>
              <p className="text-sm text-muted-foreground">
                Balanced tone with clear explanations and context.
              </p>
            </div>
          </div>
          <div className="flex items-start space-x-3 space-y-0">
            <RadioGroupItem value="friendly" id="friendly" className="mt-1" />
            <div className="flex-1">
              <Label htmlFor="friendly" className="font-medium cursor-pointer">
                Friendly
              </Label>
              <p className="text-sm text-muted-foreground">
                Warm and conversational with helpful elaborations.
              </p>
            </div>
          </div>
        </RadioGroup>
      </div>

      {/* Creativity Level */}
      <div className="space-y-4 pb-6 border-b border-border/50">
        <div>
          <div className="flex items-center justify-between mb-2">
            <Label className="text-base">Creativity Level</Label>
            <span className="text-sm font-medium text-primary">{creativity[0]}%</span>
          </div>
          <p className="text-sm text-muted-foreground">
            Control how creative and exploratory Iris should be
          </p>
        </div>
        <div className="space-y-2">
          <Slider 
            value={creativity} 
            onValueChange={setCreativity}
            max={100}
            step={5}
            className="w-full"
          />
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>Focused</span>
            <span>Balanced</span>
            <span>Creative</span>
          </div>
        </div>
      </div>

      {/* Response Length */}
      <div className="space-y-4 pb-6 border-b border-border/50">
        <div>
          <div className="flex items-center justify-between mb-2">
            <Label className="text-base">Response Length</Label>
            <span className="text-sm font-medium text-primary">{verbosity[0]}%</span>
          </div>
          <p className="text-sm text-muted-foreground">
            Adjust how detailed you want responses to be
          </p>
        </div>
        <div className="space-y-2">
          <Slider 
            value={verbosity} 
            onValueChange={setVerbosity}
            max={100}
            step={5}
            className="w-full"
          />
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>Brief</span>
            <span>Moderate</span>
            <span>Detailed</span>
          </div>
        </div>
      </div>

      {/* Thinking Style */}
      <div className="space-y-4 pb-6 border-b border-border/50">
        <div>
          <Label htmlFor="thinking-style" className="text-base">Thinking Style</Label>
          <p className="text-sm text-muted-foreground mt-1">
            How Iris approaches problem-solving
          </p>
        </div>
        <Select defaultValue="balanced">
          <SelectTrigger id="thinking-style">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="analytical">
              <div className="flex items-center gap-2">
                <Brain className="h-4 w-4" />
                <span>Analytical - Step-by-step reasoning</span>
              </div>
            </SelectItem>
            <SelectItem value="balanced">
              <div className="flex items-center gap-2">
                <Zap className="h-4 w-4" />
                <span>Balanced - Mix of speed and depth</span>
              </div>
            </SelectItem>
            <SelectItem value="creative">
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4" />
                <span>Creative - Exploratory and innovative</span>
              </div>
            </SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Advanced Options */}
      <div className="space-y-4">
        <Label className="text-base">Advanced Options</Label>
        
        <div className="flex items-center justify-between py-3">
          <div className="flex-1">
            <Label htmlFor="code-explanations" className="font-medium cursor-pointer">
              Explain Code Changes
            </Label>
            <p className="text-sm text-muted-foreground">
              Include explanations for code modifications
            </p>
          </div>
          <Switch id="code-explanations" defaultChecked />
        </div>

        <div className="flex items-center justify-between py-3">
          <div className="flex-1">
            <Label htmlFor="suggest-alternatives" className="font-medium cursor-pointer">
              Suggest Alternatives
            </Label>
            <p className="text-sm text-muted-foreground">
              Offer multiple approaches to problems
            </p>
          </div>
          <Switch id="suggest-alternatives" defaultChecked />
        </div>

        <div className="flex items-center justify-between py-3">
          <div className="flex-1">
            <Label htmlFor="proactive-suggestions" className="font-medium cursor-pointer">
              Proactive Suggestions
            </Label>
            <p className="text-sm text-muted-foreground">
              Iris suggests improvements without being asked
            </p>
          </div>
          <Switch id="proactive-suggestions" />
        </div>
      </div>

      {/* Actions */}
      <div className="flex justify-end gap-3 pt-6 border-t border-border/50">
        <Button variant="outline">Reset to Defaults</Button>
        <Button onClick={handleSave} disabled={isSaving}>
          {isSaving ? 'Saving...' : 'Save Preferences'}
        </Button>
      </div>
    </div>
  );
}

