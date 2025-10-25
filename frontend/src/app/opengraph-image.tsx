import { ImageResponse } from 'next/og';

// Configuration exports
export const alt = 'Iris';
export const size = {
  width: 1200,
  height: 568,
};
export const contentType = 'image/png';
export const dynamic = 'force-static';

export default async function Image() {
  try {
    return new ImageResponse(
      (
        <div
          style={{
            height: '100%',
            width: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'black',
            fontSize: 48,
            fontWeight: 'bold',
            color: 'white',
          }}
        >
          Iris - Open Source AI Assistant
        </div>
      ),
      { ...size },
    );
  } catch (error) {
    console.error('Error generating OpenGraph image:', error);
    return new Response(`Failed to generate image`, { status: 500 });
  }
}
