import { redirect } from 'next/navigation';

// Redirect /dashboard to / (root) - dashboard is now at root
export default async function DashboardPage() {
  redirect('/');
}