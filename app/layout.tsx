import type { Metadata } from "next";
import { fontVariables } from "@/lib/fonts";
import "./globals.css";

export const metadata: Metadata = {
  title: "Carousel Studio — карусели для Instagram",
  description: "Генерация Instagram-каруселей: тексты и изображения через OpenAI, экспорт PNG 1080×1350",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru" className={fontVariables}>
      <body>{children}</body>
    </html>
  );
}
