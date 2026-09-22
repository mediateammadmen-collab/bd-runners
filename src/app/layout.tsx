import type { Metadata } from "next";
import { Manrope, Noto_Sans_Bengali } from "next/font/google";
import "./globals.css";
import { SupabaseProvider } from "@/components/providers/supabase-provider";

const manrope = Manrope({
  subsets: ["latin"],
  variable: "--font-manrope",
  weight: ["400", "500", "600", "700", "800"],
});

const notoBengali = Noto_Sans_Bengali({
  subsets: ["bengali"],
  variable: "--font-noto-bengali",
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "Bd Runner — Bangladesh's Running Community",
  description:
    "Join nationwide running challenges, log every kilometre from any tracker, and turn points into cashback, ice cream, and flight tickets.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={`${manrope.variable} ${notoBengali.variable} antialiased`}>
        <SupabaseProvider>{children}</SupabaseProvider>
      </body>
    </html>
  );
}
