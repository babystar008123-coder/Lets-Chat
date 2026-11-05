import './globals.css';
import { Inter } from 'next/font/google';

const inter = Inter({ subsets: ['latin'] });

export const metadata = {
  title: 'Lets Chat | Real-time Messenger',
  description: 'Cyber Love & Friends Chat',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="h-[100dvh] w-full overflow-hidden bg-black">
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover" />
      </head>
      <body className="${inter.className} fixed inset-0 h-[100dvh] w-full overflow-hidden bg-black m-0 p-0 text-slate-100 select-none">
        {children}
      </body>
    </html>
  );
}
