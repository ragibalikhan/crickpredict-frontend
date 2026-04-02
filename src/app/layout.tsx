import type { Metadata } from 'next';
import './globals.css';
import Navbar from '../components/Navbar';

export const metadata: Metadata = {
  title: 'CrickPredict',
  description: 'Real-time IPL skill gaming platform',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="bg-gray-900 text-white min-h-screen pt-16 selection:bg-indigo-500/30">
        <Navbar />
        {children}
      </body>
    </html>
  );
}
