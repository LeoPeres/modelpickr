import type { Metadata } from "next";
import { Geist, Instrument_Serif } from "next/font/google";
import { Shell } from "@/components/shell";
import { getCatalog } from "@/lib/catalog/server";
import "./globals.css";
const sans = Geist({ subsets: ["latin"], variable: "--font-sans" });
const display = Instrument_Serif({
  subsets: ["latin"],
  weight: "400",
  style: ["normal", "italic"],
  variable: "--font-display",
});
export const metadata: Metadata = {
  title: "ModelPickr",
  description:
    "Compare preço e inteligência dos principais modelos de IA com dados públicos e atualizados.",
};
export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const catalog = await getCatalog();
  return (
    <html
      lang="pt-BR"
      className={`${sans.variable} ${display.variable}`}
      suppressHydrationWarning
    >
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){var t=null;try{t=localStorage.getItem('modelpickr:theme')}catch(e){}document.documentElement.dataset.theme=t==='dark'||t==='light'?t:window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light'})()`,
          }}
        />
      </head>
      <body>
        <Shell catalog={catalog}>{children}</Shell>
      </body>
    </html>
  );
}
