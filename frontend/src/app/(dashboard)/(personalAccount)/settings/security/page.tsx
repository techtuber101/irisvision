'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { 
  Shield, 
  Key, 
  Smartphone, 
  Eye, 
  EyeOff,
  CheckCircle2,
  XCircle,
  Clock,
  Monitor,
  MapPin
} from 'lucide-react';

export default function SecurityPage() {
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [twoFactorEnabled, setTwoFactorEnabled] = useState(false);

  const activeSessions = [
    {
      device: 'MacBook Pro',
      location: 'New York, US',
      ipAddress: '192.168.1.1',
      lastActive: '2 minutes ago',
      current: true,
    },
    {
      device: 'iPhone 15 Pro',
      location: 'New York, US',
      ipAddress: '192.168.1.2',
      lastActive: '1 hour ago',
      current: false,
    },
    {
      device: 'Chrome on Windows',
      location: 'Boston, US',
      ipAddress: '203.0.113.42',
      lastActive: '2 days ago',
      current: false,
    },
  ];

  return (
    <div className="p-6 space-y-8">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 mb-2">
          <Shield className="h-5 w-5 text-primary" />
          <h2 className="text-xl font-semibold">Security</h2>
        </div>
        <p className="text-sm text-muted-foreground">
          Manage your password, authentication, and active sessions
        </p>
      </div>

      {/* Change Password */}
      <div className="space-y-4 pb-6 border-b border-border/50">
        <div className="flex items-center gap-2">
          <Key className="h-4 w-4 text-muted-foreground" />
          <Label className="text-base">Change Password</Label>
        </div>

        <div className="space-y-4 max-w-md">
          <div className="space-y-2">
            <Label htmlFor="current-password">Current Password</Label>
            <div className="relative">
              <Input 
                id="current-password" 
                type={showCurrentPassword ? 'text' : 'password'}
                placeholder="Enter current password"
              />
              <button
                type="button"
                onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {showCurrentPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="new-password">New Password</Label>
            <div className="relative">
              <Input 
                id="new-password" 
                type={showNewPassword ? 'text' : 'password'}
                placeholder="Enter new password"
              />
              <button
                type="button"
                onClick={() => setShowNewPassword(!showNewPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {showNewPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="confirm-password">Confirm New Password</Label>
            <Input 
              id="confirm-password" 
              type="password"
              placeholder="Confirm new password"
            />
          </div>

          <div className="space-y-2 p-3 bg-muted/50 rounded-lg">
            <p className="text-xs font-medium">Password Requirements:</p>
            <ul className="space-y-1 text-xs text-muted-foreground">
              <li className="flex items-center gap-2">
                <CheckCircle2 className="h-3 w-3 text-green-500" />
                At least 8 characters
              </li>
              <li className="flex items-center gap-2">
                <XCircle className="h-3 w-3 text-muted-foreground" />
                Contains uppercase and lowercase letters
              </li>
              <li className="flex items-center gap-2">
                <XCircle className="h-3 w-3 text-muted-foreground" />
                Contains at least one number
              </li>
              <li className="flex items-center gap-2">
                <XCircle className="h-3 w-3 text-muted-foreground" />
                Contains at least one special character
              </li>
            </ul>
          </div>

          <Button>Update Password</Button>
        </div>
      </div>

      {/* Two-Factor Authentication */}
      <div className="space-y-4 pb-6 border-b border-border/50">
        <div className="flex items-center gap-2">
          <Smartphone className="h-4 w-4 text-muted-foreground" />
          <Label className="text-base">Two-Factor Authentication</Label>
        </div>

        <div className="flex items-center justify-between p-4 bg-accent/30 border border-border/50 rounded-lg">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <h3 className="font-medium">Authenticator App</h3>
              {twoFactorEnabled && (
                <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-green-500/10 text-green-600 dark:text-green-400">
                  Enabled
                </span>
              )}
            </div>
            <p className="text-sm text-muted-foreground">
              Use an authenticator app to generate verification codes
            </p>
          </div>
          <Switch 
            checked={twoFactorEnabled}
            onCheckedChange={setTwoFactorEnabled}
          />
        </div>

        {twoFactorEnabled && (
          <div className="p-4 bg-primary/5 border border-primary/20 rounded-lg space-y-3">
            <div className="flex items-start gap-3">
              <CheckCircle2 className="h-5 w-5 text-green-500 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-medium text-sm">Two-Factor Authentication is Active</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Your account is protected with an additional layer of security.
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              <Button size="sm" variant="outline">View Backup Codes</Button>
              <Button size="sm" variant="outline">Reconfigure</Button>
            </div>
          </div>
        )}

        {!twoFactorEnabled && (
          <div className="p-4 bg-muted/50 rounded-lg">
            <p className="text-sm text-muted-foreground">
              Enable two-factor authentication to add an extra layer of security to your account.
            </p>
            <Button size="sm" className="mt-3">Set Up 2FA</Button>
          </div>
        )}
      </div>

      {/* Active Sessions */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Monitor className="h-4 w-4 text-muted-foreground" />
            <Label className="text-base">Active Sessions</Label>
          </div>
          <Button variant="outline" size="sm" className="text-destructive hover:text-destructive">
            Sign Out All Devices
          </Button>
        </div>

        <div className="space-y-3">
          {activeSessions.map((session, index) => (
            <div 
              key={index}
              className="p-4 border border-border/50 rounded-lg hover:bg-accent/30 transition-colors"
            >
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-3 flex-1">
                  <Monitor className="h-5 w-5 text-muted-foreground mt-0.5" />
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-medium text-sm">{session.device}</h3>
                      {session.current && (
                        <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-green-500/10 text-green-600 dark:text-green-400">
                          Current
                        </span>
                      )}
                    </div>
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <MapPin className="h-3 w-3" />
                        <span>{session.location}</span>
                        <span>•</span>
                        <span>{session.ipAddress}</span>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Clock className="h-3 w-3" />
                        <span>Last active {session.lastActive}</span>
                      </div>
                    </div>
                  </div>
                </div>
                {!session.current && (
                  <Button 
                    variant="ghost" 
                    size="sm"
                    className="text-destructive hover:text-destructive"
                  >
                    Sign Out
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

