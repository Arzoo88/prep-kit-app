import './globals.css';

export const metadata = { title: 'AI Interview Prep Kit', description: 'Turn a job description into an interview prep kit.' };

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className="min-h-screen">{children}</body>
    </html>
  );
}
