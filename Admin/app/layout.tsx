import type { Metadata } from "next";
import { Plus_Jakarta_Sans, Be_Vietnam_Pro } from "next/font/google";
import "./globals.css";
import LayoutWrapper from "./layout-wrapper";

const headingFont = Plus_Jakarta_Sans({
  variable: "--font-plus-jakarta",
  subsets: ["latin"],
  weight: ["500", "600", "700", "800"],
});

const bodyFont = Be_Vietnam_Pro({
  variable: "--font-be-vietnam",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "TRTrips Admin Dashboard",
  description: "Admin management panel for TRTrips",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${headingFont.variable} ${bodyFont.variable} h-full antialiased`}
    >
<<<<<<< HEAD
      <body suppressHydrationWarning className="min-h-screen bg-background m-0 p-0">
=======
      <body
        suppressHydrationWarning
        className="min-h-screen bg-slate-50 m-0 p-0"
      >
>>>>>>> e09d3789ef38baf838053502fd4c44d5b127d5a4
        <LayoutWrapper>{children}</LayoutWrapper>
      </body>
    </html>
  );
}
