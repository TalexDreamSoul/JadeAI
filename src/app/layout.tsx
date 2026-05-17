import type { Metadata } from 'next';
import './globals.css';

const appName = process.env.APP_NAME || 'TouchResume';

export const metadata: Metadata = {
  title: `${appName} - AI Resume Builder`,
  description: 'AI-powered intelligent resume builder with drag-and-drop editor',
  icons: {
    icon: '/favicon.png',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html suppressHydrationWarning>
      <body className="font-sans antialiased">
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var b=localStorage.getItem('touchresume-brand');if(b==='boss'){b='mint';localStorage.setItem('touchresume-brand','mint');}else if(b==='jade'){b='blue';localStorage.setItem('touchresume-brand','blue');}if(b==='blue'||b==='pink'){document.documentElement.setAttribute('data-brand',b);}}catch(e){}})();`,
          }}
        />
        {children}
      </body>
    </html>
  );
}
