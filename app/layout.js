import './globals.css';

export const metadata = {
  title: 'Patel Institute Dongargaon | PID — Best Coaching in Dongargaon',
  description: 'Patel Institute Dongargaon (PID) — Class 2nd to 12th, B.Sc., Navodaya, Prayas, JEE, NEET coaching. CG, CBSE, ICSE Board. Hindi & English Medium. 13+ years of excellence. Admissions Open!',
  keywords: 'Patel Institute Dongargaon, PID, coaching Dongargaon, tuition Dongargaon, class 10 coaching, class 12 coaching, JEE NEET coaching Rajnandgaon, Chhattisgarh coaching',
  icons: {
    icon: '/pid_logo.png',
    apple: '/pid_logo.png',
  },
  openGraph: {
    title: 'Patel Institute Dongargaon | PID',
    description: 'Best coaching institute in Dongargaon — Class 2 to 12, Competitive Exams, All Boards.',
    images: ['/pid_logo.png'],
    type: 'website',
  },
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.0/css/all.min.css" />
        {/* Preconnect to fonts to improve loading speed */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      </head>
      <body>
        {children}
      </body>
    </html>
  );
}