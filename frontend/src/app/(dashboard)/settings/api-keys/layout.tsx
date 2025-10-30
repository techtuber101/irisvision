import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'API Keys | Iris',
  description: 'Manage your API keys for programmatic access to Iris',
  openGraph: {
    title: 'API Keys | Iris',
    description: 'Manage your API keys for programmatic access to Iris',
    type: 'website',
  },
};

export default async function APIKeysLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
