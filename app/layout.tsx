import './globals.css';
import { Inter } from 'next/font/google';
import NotificationProvider from '@/components/NotificationProvider';

const inter = Inter({ subsets: ['latin'] });

export const metadata = {
  title: 'Lets Chat | Connect with Heart',
  description: 'A massive UI chat app for friends and lovers',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=0"/>
      </head>
      <body className={`${inter.className} bg-gradient-to-br from-rose-100 to-indigo-100 min-h-screen`}>
        <NotificationProvider>
          {children}
        </NotificationProvider>
      </body>
    </html>
  );
}
