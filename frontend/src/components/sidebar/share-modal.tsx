"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Copy, Link, Link2Off, Check, Globe, Loader2 } from "lucide-react"
import { toast } from "sonner"
import { useThreadQuery, useUpdateThreadMutation, useUpdateProject } from "@/hooks/react-query"
import type { JSX } from "react"
import { Skeleton } from "../ui/skeleton"

interface SocialShareOption {
  name: string
  icon: JSX.Element
  onClick: () => void
}

interface ShareModalProps {
  isOpen: boolean
  onClose: () => void
  threadId?: string
  projectId?: string
}

const ShareModalSkeleton = () => {
  return (
    <div className="space-y-6">
      <div className="rounded-lg border p-4">
        <div className="flex items-start space-x-2">
          <Skeleton className="h-4 w-4" />
          <div className="space-y-2 flex-1">
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-4 w-full" />
            </div>
          </div>
        </div>
        <div className="space-y-2">
          <Skeleton className="h-4 w-20" />
          <div className="flex space-x-2">
            <Skeleton className="h-9 flex-1" />
            <Skeleton className="h-9 w-9" />
          </div>
        </div>
        <div className="space-y-3">
          <Skeleton className="h-4 w-24" />
          <div className="flex space-x-2">
            <Skeleton className="h-8 w-20" />
            <Skeleton className="h-8 w-16" />
          </div>
        </div>
        <Skeleton className="h-9 w-full" />
    </div>
  )
}

export function ShareModal({ isOpen, onClose, threadId, projectId }: ShareModalProps) {
  const [shareLink, setShareLink] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [isCopying, setIsCopying] = useState(false)

  useEffect(() => {
    if (isOpen) {
      document.body.style.pointerEvents = "auto"
    }
  }, [isOpen])

  const updateThreadMutation = useUpdateThreadMutation()
  const updateProjectMutation = useUpdateProject()

  const { data: threadData, isLoading: isChecking } = useThreadQuery(threadId || "")

  useEffect(() => {
    if (threadData?.is_public) {
      const publicUrl = generateShareLink()
      setShareLink(publicUrl)
    } else {
      setShareLink(null)
    }
  }, [threadData])

  const generateShareLink = () => {
    if (!threadId) return ""
    return `${process.env.NEXT_PUBLIC_URL || window.location.origin}/share/${threadId}`
  }

  const createShareLink = async () => {
    if (!threadId) return

    setIsLoading(true)

    try {
      await updatePublicStatus(true)
      const generatedLink = generateShareLink()
      setShareLink(generatedLink)
      toast.success("Shareable link created successfully")
    } catch (error) {
      console.error("Error creating share link:", error)
      toast.error("Failed to create shareable link")
    } finally {
      setIsLoading(false)
    }
  }

  const removeShareLink = async () => {
    if (!threadId) return

    setIsLoading(true)

    try {
      await updatePublicStatus(false)
      setShareLink(null)
      toast.success("Shareable link removed")
    } catch (error) {
      console.error("Error removing share link:", error)
      toast.error("Failed to remove shareable link")
    } finally {
      setIsLoading(false)
    }
  }

  const updatePublicStatus = async (isPublic: boolean) => {
    if (!threadId || !projectId) return

    await updateProjectMutation.mutateAsync({
      projectId,
      data: { is_public: isPublic },
    })
    await updateThreadMutation.mutateAsync({
      threadId,
      data: { is_public: isPublic },
    })
  }

  const copyToClipboard = () => {
    if (shareLink) {
      setIsCopying(true)
      navigator.clipboard.writeText(shareLink)
      toast.success("Link copied to clipboard")
      setTimeout(() => {
        setIsCopying(false)
      }, 500)
    }
  }

  const socialOptions: SocialShareOption[] = [
    {
      name: "LinkedIn",
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" className="h-4 w-4">
          <path
            fill="currentColor"
            d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"
          />
        </svg>
      ),
      onClick: () => {
        if (shareLink) {
          window.open(
            `https://www.linkedin.com/shareArticle?url=${encodeURIComponent(shareLink)}&text=Shared conversation`,
            "_blank",
          )
        }
      },
    },
    {
      name: "X",
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" className="h-4 w-4">
          <path
            fill="currentColor"
            d="M18.901 1.153h3.68l-8.04 9.19L24 22.846h-7.406l-5.8-7.584-6.638 7.584H.474l8.6-9.83L0 1.154h7.594l5.243 6.932ZM17.61 20.644h2.039L6.486 3.24H4.298Z"
          />
        </svg>
      ),
      onClick: () => {
        if (shareLink) {
          window.open(
            `https://twitter.com/intent/tweet?url=${encodeURIComponent(shareLink)}&text=Shared conversation`,
            "_blank",
          )
        }
      },
    },
  ]

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md border border-white/10 dark:border-white/10 bg-[rgba(10,14,22,0.55)] dark:bg-[rgba(10,14,22,0.55)] backdrop-blur-2xl shadow-[0_20px_60px_-10px_rgba(0,0,0,0.8),inset_0_1px_0_0_rgba(255,255,255,0.06)] light:border-gray-200 light:bg-white light:shadow-[0_20px_60px_-10px_rgba(0,0,0,0.1)] overflow-hidden max-h-[90vh] overflow-y-auto p-0">
        <div className="relative p-6 light:bg-gradient-to-br light:from-white light:via-white light:to-gray-50/50">
          {/* Dark mode gradient rim */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 rounded-2xl dark:opacity-100 opacity-0"
            style={{
              background: 'linear-gradient(180deg, rgba(173,216,255,0.18), rgba(255,255,255,0.04) 30%, rgba(150,160,255,0.14) 85%, rgba(255,255,255,0.06))',
              WebkitMask: 'linear-gradient(#000,#000) content-box, linear-gradient(#000,#000)',
              WebkitMaskComposite: 'xor' as any,
              maskComposite: 'exclude',
              padding: 1,
              borderRadius: 16,
            }}
          />
          
          {/* Dark mode specular streak */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-x-0 top-0 h-16 dark:opacity-100 opacity-0"
            style={{
              background: 'linear-gradient(180deg, rgba(255,255,255,0.22), rgba(255,255,255,0.06) 45%, rgba(255,255,255,0) 100%)',
              filter: 'blur(4px)',
              mixBlendMode: 'screen',
            }}
          />

          {/* Fine noise - dark mode only */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 rounded-2xl opacity-[0.015] dark:opacity-[0.015] light:opacity-0"
            style={{
              backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 400 400' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")`,
            }}
          />

          <DialogHeader className="relative z-10">
            <DialogTitle className="flex items-center gap-2">
              Share Chat
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-6 relative z-10">
          {isChecking ? (
            <ShareModalSkeleton />
          ) : shareLink ? (
            <>
              <Alert className="bg-white/5 dark:bg-white/5 border border-black/10 dark:border-white/10 backdrop-blur-sm light:bg-white/10 light:border-black/15">
                <Globe className="h-4 w-4" />
                <AlertDescription>
                  This chat is publicly accessible. Anyone with the link can view this conversation.
                </AlertDescription>
              </Alert>

              <div className="space-y-2">
                <Label htmlFor="share-link">Share link</Label>
                <div className="flex space-x-2">
                  <Input id="share-link" value={shareLink} readOnly className="font-mono text-sm" />
                  <Button variant="outline" size="icon" onClick={copyToClipboard} disabled={isCopying}>
                    {isCopying ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                    <span className="sr-only">Copy link</span>
                  </Button>
                </div>
              </div>

              <div className="space-y-3">
                <Label>Share on social</Label>
                <div className="flex space-x-2">
                  {socialOptions.map((option, index) => (
                    <Button
                      key={index}
                      variant="outline"
                      size="sm"
                      onClick={option.onClick}
                      className="flex items-center"
                    >
                      {option.icon}
                      <span>{option.name}</span>
                    </Button>
                  ))}
                </div>
              </div>
              <Button
                variant="outline"
                className="w-full text-destructive hover:bg-destructive hover:text-muted"
                onClick={removeShareLink}
                disabled={isLoading}
              >
                <Link2Off className="h-4 w-4" />
                {isLoading ? "Removing..." : "Remove link"}
              </Button>
            </>
          ) : (
            <div className="text-center space-y-4">
              <Button onClick={createShareLink} disabled={isLoading} className="w-full">
                {isLoading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Creating...
                  </>
                ) : (
                  <>
                    <Link className="h-4 w-4" />
                    Create shareable link
                  </>
                )}
              </Button>
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">
                  Generate a public link to share this conversation with others. Anyone with the link will be able to view the full conversation.
                </p>
              </div>
            </div>
          )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
