'use client';

import Image from 'next/image';

interface IrisLogoProps {
  size?: number;
}
export function IrisLogo({ size = 30 }: IrisLogoProps) {
  const cacheBuster = '?v=2';
  return (
    <>
      <Image
        src={`/irissymbolblack.png${cacheBuster}`}
        alt="Iris"
        width={size}
        height={size}
        className="flex-shrink-0 dark:hidden"
        style={{ width: size, height: size, minWidth: size, minHeight: size }}
      />
      <Image
        src={`/irissymbolwhite.png${cacheBuster}`}
        alt="Iris"
        width={size}
        height={size}
        className="flex-shrink-0 hidden dark:block"
        style={{ width: size, height: size, minWidth: size, minHeight: size }}
      />
    </>
  );
}
