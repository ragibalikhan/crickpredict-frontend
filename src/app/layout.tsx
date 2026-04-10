import type { Metadata, Viewport } from 'next';
import './globals.css';
import Navbar from '../components/Navbar';
import SiteBrandingLoader from '../components/SiteBrandingLoader';
import ToastProvider from '../components/ToastProvider';
import BetSettlementModal from '../components/BetSettlementModal';
import SettlementRecovery from '../components/SettlementRecovery';

export const metadata: Metadata = {
  title: 'CrickPredict',
  description: 'Real-time IPL skill gaming platform',
  icons: {
    icon: '/window.svg',
    shortcut: '/window.svg',
    apple: '/window.svg',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: '#111827',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="bg-gray-900 text-white min-h-screen selection:bg-indigo-500/30">
        <SiteBrandingLoader />
        <Navbar />
        <ToastProvider />
        <BetSettlementModal />
        <SettlementRecovery />
        {children}
      </body>
    </html>
  );
}
