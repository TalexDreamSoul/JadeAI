import type { Metadata } from 'next';
import { getLocale } from 'next-intl/server';
import { APP_NAME } from '@/lib/constants';
import './globals.css';

const appName = process.env.APP_NAME || APP_NAME;

export const metadata: Metadata = {
  title: `${appName} - AI Resume Builder`,
  description: 'AI-powered intelligent resume builder with drag-and-drop editor',
  icons: {
    icon: '/favicon.png',
  },
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const locale = await getLocale();

  return (
    <html lang={locale} suppressHydrationWarning>
      <body suppressHydrationWarning className="font-sans antialiased">
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var b=localStorage.getItem('touchresume-brand');if(b==='boss'){b='mint';localStorage.setItem('touchresume-brand','mint');}else if(b==='jade'){b='blue';localStorage.setItem('touchresume-brand','blue');}if(b==='blue'||b==='pink'||b==='orange'||b==='purple'){document.documentElement.setAttribute('data-brand',b);}}catch(e){}})();`,
          }}
        />
        {children}
      </body>
    </html>
  );
}
