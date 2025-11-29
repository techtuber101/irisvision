export const dynamic = 'force-static';

export async function GET() {
  // Disabled - Vercel Edge Config not available
  return Response.json({ enabled: false });
}