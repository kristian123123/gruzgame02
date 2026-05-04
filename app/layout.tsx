import type { Metadata } from "next";
import { Inter, Source_Code_Pro } from "next/font/google";
import { SafeArea } from "./components/SafeArea";
import { farcasterConfig } from "../farcaster.config";
import { Providers } from "./providers";
import "./globals.css";

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: farcasterConfig.miniapp.name,
    description: farcasterConfig.miniapp.description,
    other: {
      "fc:frame": JSON.stringify({
        version: farcasterConfig.miniapp.version,
        imageUrl: farcasterConfig.miniapp.heroImageUrl,
        button: {
          title: "Open Robo Tapper",
          action: {
            name: "Launch Game",
            type: "launch_frame",
          },
        },
      }),
      "base:app_id": "69f88553879b4ae3fa1c7163",
      "talentapp:project_verification":
        "a03c59a4a7fb11bb3fbf23c3dc371b184a89b47b1313e17ba66d2fdb3dc3524c24d6cf5db86b3ead4dab1cb81618fd3873eb1ea07cbdeeeee5e76f2aff4c9cc5",
    },
  };
}

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const sourceCodePro = Source_Code_Pro({
  variable: "--font-source-code-pro",
  subsets: ["latin"],
});

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${inter.variable} ${sourceCodePro.variable}`} suppressHydrationWarning>
        <Providers>
          <SafeArea>{children}</SafeArea>
        </Providers>
      </body>
    </html>
  );
}
