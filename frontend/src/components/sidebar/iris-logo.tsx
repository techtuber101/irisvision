'use client';

import Image from 'next/image';

interface IrisLogoProps {
  size?: number;
}
export function IrisLogo({ size = 24 }: IrisLogoProps) {
  return (
    <>
      <Image
        src="/irissymbolblack.png"
        alt="Iris"
        width={size}
        height={size}
        className="flex-shrink-0 dark:hidden"
        style={{ width: size, height: size, minWidth: size, minHeight: size }}
      />
      <Image
        src="/irissymbolwhite.png"
        alt="Iris"
        width={size}
        height={size}
        className="flex-shrink-0 hidden dark:block"
        style={{ width: size, height: size, minWidth: size, minHeight: size }}
      />
    </>
  );
}
