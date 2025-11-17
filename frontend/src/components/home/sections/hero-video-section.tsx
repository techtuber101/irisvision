import { HeroVideoDialog } from "@/components/home/ui/hero-video-dialog";

export function HeroVideoSection() {
  return (
    <div id="video" className="relative px-6 mt-10">
      <div className="max-w-4xl mx-auto">
        {/* Section Header */}
        <div className="text-center mb-8">
          <h2 className="text-3xl md:text-4xl font-bold mb-4 bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">
            The Future We're Building
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            A personal message from our founder on what Iris is, why it matters, and where we're headed.
          </p>
        </div>

        {/* Video Container */}
        <div className="relative w-full max-w-3xl mx-auto shadow-xl rounded-2xl overflow-hidden border border-border/50 bg-gradient-to-br from-background to-muted/20">
          <HeroVideoDialog
            className="block dark:hidden"
            animationStyle="from-center"
            videoSrc="https://www.youtube.com/embed/Jnxq0osSg2c?si=k8ddEM8h8lver20s"
            thumbnailSrc="/Comingsoon.png"
            thumbnailAlt="Hero Video"
            youtubeUrl="https://www.youtube.com"
          />
          <HeroVideoDialog
            className="hidden dark:block"
            animationStyle="from-center"
            videoSrc="https://www.youtube.com/embed/Jnxq0osSg2c?si=k8ddEM8h8lver20s"
            thumbnailSrc="/Comingsoon.png"
            thumbnailAlt="Hero Video"
            youtubeUrl="https://www.youtube.com"
          />
        </div>
      </div>
    </div>
  );
}
