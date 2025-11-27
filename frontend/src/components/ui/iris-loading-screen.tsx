'use client';

import Image from 'next/image';

export function IrisLoadingScreen() {
  return (
    <div className="flex items-center justify-center min-h-screen bg-background dark:bg-[#070b13]">
      <div className="flex flex-col items-center gap-4">
        <div className="relative w-16 h-16 animate-pulse">
          <Image
            src="/irissymbolwhite.png"
            alt="Iris"
            width={64}
            height={64}
            className="object-contain dark:block hidden"
            priority
          />
          <Image
            src="/irissymbolblack.png"
            alt="Iris"
            width={64}
            height={64}
            className="object-contain dark:hidden block"
            priority
          />
        </div>
      </div>
    </div>
  );
}

