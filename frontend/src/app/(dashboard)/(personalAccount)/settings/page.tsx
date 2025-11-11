'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import { Camera, Mail, User as UserIcon } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

export default function PersonalAccountSettingsPage() {
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [user, setUser] = useState<{
    name: string;
    email: string;
    avatar: string;
    bio: string;
    timezone: string;
    language: string;
  } | null>(null);

  useEffect(() => {
    const fetchUserData = async () => {
      setIsLoading(true);
      const supabase = createClient();
      const { data } = await supabase.auth.getUser();
      
      // Detect browser timezone
      const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
      const language = navigator.language || 'en-US';
      
      if (data.user) {
        setUser({
          name: data.user.user_metadata?.name || data.user.email?.split('@')[0] || 'User',
          email: data.user.email || '',
          avatar: data.user.user_metadata?.avatar_url || '',
          bio: data.user.user_metadata?.bio || '',
          timezone: data.user.user_metadata?.timezone || timezone,
          language: data.user.user_metadata?.language || language,
        });
      }
      setIsLoading(false);
    };

    fetchUserData();
  }, []);

  const handleSave = async () => {
    setIsSaving(true);
    // TODO: Implement save functionality
    await new Promise(resolve => setTimeout(resolve, 1000));
    setIsSaving(false);
    setIsEditing(false);
  };

  if (isLoading) {
    return (
      <div className="p-6 space-y-8">
        <div>
          <Skeleton className="h-6 w-32" />
          <Skeleton className="h-4 w-64 mt-2" />
        </div>
        <div className="flex items-start gap-6">
          <Skeleton className="h-20 w-20 rounded-full" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-3 w-48" />
            <Skeleton className="h-8 w-24" />
          </div>
        </div>
        <div className="space-y-4">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-24 w-full" />
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="p-6">
        <p className="text-muted-foreground">Failed to load user data.</p>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-8">
      {/* Header */}
      <div>
        <h2 className="text-xl font-semibold">Profile</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Manage your personal information and account details
        </p>
      </div>

      {/* Avatar Section */}
      <div className="flex items-start gap-6 pb-6 border-b border-border/50">
        <div className="relative group">
          <Avatar className="h-20 w-20">
            <AvatarImage src={user.avatar} alt={user.name} />
            <AvatarFallback>
              {user.name.split(' ').map(n => n[0]).join('').toUpperCase() || <UserIcon className="h-8 w-8" />}
            </AvatarFallback>
          </Avatar>
          <button className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-full opacity-0 group-hover:opacity-100 transition-opacity">
            <Camera className="h-5 w-5 text-white" />
          </button>
        </div>
        <div className="flex-1">
          <h3 className="text-sm font-medium">Profile Picture</h3>
          <p className="text-xs text-muted-foreground mt-1 mb-3">
            JPG, PNG or GIF. Max size 2MB.
          </p>
          <div className="flex gap-2">
            <Button size="sm" variant="outline">
              Upload New
            </Button>
            <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive">
              Remove
            </Button>
          </div>
        </div>
      </div>

      {/* Personal Information */}
      <div className="space-y-6">
        <h3 className="text-sm font-semibold">Personal Information</h3>
        
        <div className="grid gap-6 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="fullName">Full Name</Label>
            <Input 
              id="fullName" 
              defaultValue={user.name} 
              disabled={!isEditing}
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="email">Email Address</Label>
            <div className="relative">
              <Input 
                id="email" 
                type="email" 
                defaultValue={user.email} 
                disabled={!isEditing}
                className="pr-10"
              />
              <Mail className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            </div>
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="bio">Let Iris know you better</Label>
          <Textarea 
            id="bio" 
            placeholder="Tell us a bit about yourself..." 
            disabled={!isEditing}
            rows={4}
            defaultValue={user.bio}
          />
          <p className="text-xs text-muted-foreground">
            Brief description for your profile. Max 200 characters.
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="timezone">Timezone</Label>
            <Input 
              id="timezone" 
              defaultValue={user.timezone} 
              disabled={!isEditing}
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="language">Language</Label>
            <Input 
              id="language" 
              defaultValue={user.language} 
              disabled={!isEditing}
            />
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex justify-end gap-3 pt-6 border-t border-border/50">
        {isEditing ? (
          <>
            <Button 
              variant="outline" 
              onClick={() => setIsEditing(false)}
              disabled={isSaving}
            >
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={isSaving}>
              {isSaving ? 'Saving...' : 'Save Changes'}
            </Button>
          </>
        ) : (
          <Button onClick={() => setIsEditing(true)}>
            Edit Profile
          </Button>
        )}
      </div>
    </div>
  );
}
