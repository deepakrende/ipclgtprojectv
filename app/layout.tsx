import './globals.css';

export const metadata = {
  title: 'MMN OTT MART — Web Player',
  description: 'Watch your authorized subscription directly in your browser.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <html lang="en"><body>{children}</body></html>;
}
