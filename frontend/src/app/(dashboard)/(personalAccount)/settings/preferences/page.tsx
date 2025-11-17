'use client';

import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Settings, Moon, Sun, Globe, Keyboard } from 'lucide-react';

export default function PreferencesPage() {
  return (
    <div className="p-6 space-y-8">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 mb-2">
          <Settings className="h-5 w-5 text-primary" />
          <h2 className="text-xl font-semibold">Preferences</h2>
        </div>
        <p className="text-sm text-muted-foreground">
          Customize your experience and interface settings
        </p>
      </div>

      {/* Appearance */}
      <div className="space-y-4 pb-6 border-b border-border/50">
        <div className="flex items-center gap-2">
          <Moon className="h-4 w-4 text-muted-foreground" />
          <Label className="text-base">Appearance</Label>
        </div>
        
        <div className="space-y-2">
          <Label htmlFor="theme">Theme</Label>
          <Select defaultValue="system">
            <SelectTrigger id="theme">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="light">
                <div className="flex items-center gap-2">
                  <Sun className="h-4 w-4" />
                  <span>Light</span>
                </div>
              </SelectItem>
              <SelectItem value="dark">
                <div className="flex items-center gap-2">
                  <Moon className="h-4 w-4" />
                  <span>Dark</span>
                </div>
              </SelectItem>
              <SelectItem value="system">
                <div className="flex items-center gap-2">
                  <Settings className="h-4 w-4" />
                  <span>System</span>
                </div>
              </SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="color-scheme">Accent Color</Label>
          <Select defaultValue="blue">
            <SelectTrigger id="color-scheme">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="blue">Blue</SelectItem>
              <SelectItem value="purple">Purple</SelectItem>
              <SelectItem value="green">Green</SelectItem>
              <SelectItem value="orange">Orange</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Language & Region */}
      <div className="space-y-4 pb-6 border-b border-border/50">
        <div className="flex items-center gap-2">
          <Globe className="h-4 w-4 text-muted-foreground" />
          <Label className="text-base">Language & Region</Label>
        </div>
        
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="language">Language</Label>
            <Select defaultValue="en-US">
              <SelectTrigger id="language">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="en-US">English (US)</SelectItem>
                <SelectItem value="en-GB">English (UK)</SelectItem>
                <SelectItem value="es">Español</SelectItem>
                <SelectItem value="fr">Français</SelectItem>
                <SelectItem value="de">Deutsch</SelectItem>
                <SelectItem value="ja">日本語</SelectItem>
                <SelectItem value="zh">中文</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="timezone">Timezone</Label>
            <Select defaultValue="america-ny">
              <SelectTrigger id="timezone">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="america-ny">America/New York (EST)</SelectItem>
                <SelectItem value="america-la">America/Los Angeles (PST)</SelectItem>
                <SelectItem value="europe-london">Europe/London (GMT)</SelectItem>
                <SelectItem value="europe-paris">Europe/Paris (CET)</SelectItem>
                <SelectItem value="asia-tokyo">Asia/Tokyo (JST)</SelectItem>
                <SelectItem value="asia-dubai">Asia/Dubai (GST)</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="date-format">Date Format</Label>
          <Select defaultValue="mdy">
            <SelectTrigger id="date-format">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="mdy">MM/DD/YYYY (US)</SelectItem>
              <SelectItem value="dmy">DD/MM/YYYY (EU)</SelectItem>
              <SelectItem value="ymd">YYYY-MM-DD (ISO)</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Editor Settings */}
      <div className="space-y-4 pb-6 border-b border-border/50">
        <div className="flex items-center gap-2">
          <Keyboard className="h-4 w-4 text-muted-foreground" />
          <Label className="text-base">Editor Settings</Label>
        </div>

        <div className="flex items-center justify-between py-3">
          <div className="flex-1">
            <Label htmlFor="line-numbers" className="font-medium cursor-pointer">
              Show Line Numbers
            </Label>
            <p className="text-sm text-muted-foreground">
              Display line numbers in code blocks
            </p>
          </div>
          <Switch id="line-numbers" defaultChecked />
        </div>

        <div className="flex items-center justify-between py-3">
          <div className="flex-1">
            <Label htmlFor="syntax-highlight" className="font-medium cursor-pointer">
              Syntax Highlighting
            </Label>
            <p className="text-sm text-muted-foreground">
              Color code syntax in code blocks
            </p>
          </div>
          <Switch id="syntax-highlight" defaultChecked />
        </div>

        <div className="space-y-2">
          <Label htmlFor="font-size">Font Size</Label>
          <Select defaultValue="medium">
            <SelectTrigger id="font-size">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="small">Small</SelectItem>
              <SelectItem value="medium">Medium</SelectItem>
              <SelectItem value="large">Large</SelectItem>
              <SelectItem value="xlarge">Extra Large</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Accessibility */}
      <div className="space-y-4">
        <Label className="text-base">Accessibility</Label>
        
        <div className="flex items-center justify-between py-3">
          <div className="flex-1">
            <Label htmlFor="reduce-motion" className="font-medium cursor-pointer">
              Reduce Motion
            </Label>
            <p className="text-sm text-muted-foreground">
              Minimize animations and transitions
            </p>
          </div>
          <Switch id="reduce-motion" />
        </div>

        <div className="flex items-center justify-between py-3">
          <div className="flex-1">
            <Label htmlFor="high-contrast" className="font-medium cursor-pointer">
              High Contrast
            </Label>
            <p className="text-sm text-muted-foreground">
              Increase contrast for better visibility
            </p>
          </div>
          <Switch id="high-contrast" />
        </div>

        <div className="flex items-center justify-between py-3">
          <div className="flex-1">
            <Label htmlFor="keyboard-nav" className="font-medium cursor-pointer">
              Keyboard Navigation Hints
            </Label>
            <p className="text-sm text-muted-foreground">
              Show keyboard shortcuts in tooltips
            </p>
          </div>
          <Switch id="keyboard-nav" defaultChecked />
        </div>
      </div>

      {/* Actions */}
      <div className="flex justify-end gap-3 pt-6 border-t border-border/50">
        <Button variant="outline">Reset to Defaults</Button>
        <Button>Save Preferences</Button>
      </div>
    </div>
  );
}

