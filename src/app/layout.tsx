import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { AppWrapper } from "@/components/auth/AppWrapper";

const inter = Inter({
  subsets: ["latin"],
  preload: false,
});


export const metadata: Metadata = {
  title: "AgriSense | Smart Farm Monitor",
  description: "Protected Cultivation Aloe Vera Monitor",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "AgriSense",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
        <head>
          <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css" />
          <link rel="manifest" href="/manifest.json" />
          <meta name="theme-color" content="#247845" />
          <meta name="apple-mobile-web-app-capable" content="yes" />
          <meta name="apple-mobile-web-app-status-bar-style" content="default" />
          <meta name="apple-mobile-web-app-title" content="AgriSense" />
          <script
            dangerouslySetInnerHTML={{
              __html: `
                // Service worker registration temporarily disabled to prevent HMR infinite loops
              `,
            }}
          />
        </head>
        <body
          className={`${inter.className} antialiased bg-slate-50 text-slate-900 overflow-x-hidden`}
        >
          <AppWrapper>{children}</AppWrapper>
        </body>
    </html>
  );
}

