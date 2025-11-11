'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { 
  AlertTriangle,
  Trash2,
  Download,
  AlertCircle
} from 'lucide-react';

export default function DangerPage() {
  const [confirmText, setConfirmText] = useState('');
  const [acknowledgedConsequences, setAcknowledgedConsequences] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  const isDeleteEnabled = confirmText === 'DELETE MY ACCOUNT' && acknowledgedConsequences;

  return (
    <div className="p-6 space-y-8">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 mb-2">
          <AlertTriangle className="h-5 w-5 text-destructive" />
          <h2 className="text-xl font-semibold text-destructive">Danger Zone</h2>
        </div>
        <p className="text-sm text-muted-foreground">
          Irreversible actions that permanently affect your account
        </p>
      </div>

      {/* Warning Banner */}
      <div className="p-4 bg-destructive/10 border-2 border-destructive/20 rounded-lg">
        <div className="flex items-start gap-3">
          <AlertCircle className="h-5 w-5 text-destructive flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold text-sm text-destructive mb-1">
              Please read carefully
            </p>
            <p className="text-sm text-muted-foreground">
              The actions on this page are permanent and cannot be undone. Make sure you understand the consequences before proceeding.
            </p>
          </div>
        </div>
      </div>

      {/* Export Data First */}
      <div className="p-5 border border-border/50 rounded-lg space-y-4">
        <div className="flex items-start gap-4">
          <div className="p-2 rounded-lg bg-primary/10">
            <Download className="h-5 w-5 text-primary" />
          </div>
          <div className="flex-1">
            <h3 className="font-semibold mb-1">Export Your Data First</h3>
            <p className="text-sm text-muted-foreground mb-3">
              Before deleting your account, we recommend downloading a copy of your data. This includes all conversations, files, and settings.
            </p>
            <Button variant="outline" size="sm" className="gap-2">
              <Download className="h-4 w-4" />
              Export All Data
            </Button>
          </div>
        </div>
      </div>

      {/* Delete Account Section */}
      <div className="p-6 border-2 border-destructive/30 bg-destructive/5 rounded-lg space-y-6">
        <div className="flex items-start gap-4">
          <div className="p-2 rounded-lg bg-destructive/10">
            <Trash2 className="h-6 w-6 text-destructive" />
          </div>
          <div className="flex-1">
            <h3 className="font-semibold text-lg mb-2">Delete Account</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Once you delete your account, there is no going back. This will permanently delete:
            </p>
            <ul className="space-y-2 text-sm text-muted-foreground mb-6">
              <li className="flex items-start gap-2">
                <span className="text-destructive">•</span>
                <span>All your conversations and chat history</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-destructive">•</span>
                <span>Generated files, code, and content</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-destructive">•</span>
                <span>Your profile, settings, and preferences</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-destructive">•</span>
                <span>All integrations and connected accounts</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-destructive">•</span>
                <span>Any remaining credits or subscription</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-destructive">•</span>
                <span>Your account and all associated data</span>
              </li>
            </ul>

            {!showDeleteDialog ? (
              <Button 
                variant="destructive" 
                onClick={() => setShowDeleteDialog(true)}
                className="gap-2"
              >
                <Trash2 className="h-4 w-4" />
                I Want to Delete My Account
              </Button>
            ) : (
              <div className="space-y-4 p-5 bg-background border border-destructive/30 rounded-lg">
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="confirm-text" className="font-medium">
                      Type "DELETE MY ACCOUNT" to confirm
                    </Label>
                    <Input 
                      id="confirm-text"
                      value={confirmText}
                      onChange={(e) => setConfirmText(e.target.value)}
                      placeholder="DELETE MY ACCOUNT"
                      className="font-mono"
                    />
                  </div>

                  <div className="flex items-start space-x-3">
                    <Checkbox 
                      id="acknowledge"
                      checked={acknowledgedConsequences}
                      onCheckedChange={(checked) => setAcknowledgedConsequences(checked as boolean)}
                    />
                    <Label 
                      htmlFor="acknowledge" 
                      className="text-sm font-normal cursor-pointer leading-relaxed"
                    >
                      I understand that this action is permanent and cannot be undone. All my data will be permanently deleted and I will not be able to recover it.
                    </Label>
                  </div>
                </div>

                <div className="flex gap-3 pt-4">
                  <Button 
                    variant="outline" 
                    onClick={() => {
                      setShowDeleteDialog(false);
                      setConfirmText('');
                      setAcknowledgedConsequences(false);
                    }}
                  >
                    Cancel
                  </Button>
                  <Button 
                    variant="destructive"
                    disabled={!isDeleteEnabled}
                    className="gap-2"
                  >
                    <Trash2 className="h-4 w-4" />
                    Permanently Delete Account
                  </Button>
                </div>

                {!isDeleteEnabled && (
                  <p className="text-xs text-muted-foreground">
                    Complete both steps above to enable account deletion
                  </p>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Support Contact */}
      <div className="p-4 bg-muted/50 rounded-lg">
        <p className="text-xs text-muted-foreground">
          <strong>Need help instead?</strong> If you're having issues with your account or want to provide feedback, 
          please contact our support team at <a href="mailto:support@iris.ai" className="text-primary hover:underline">support@iris.ai</a> before deleting your account.
        </p>
      </div>
    </div>
  );
}

