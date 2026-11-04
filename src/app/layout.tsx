import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono, Instrument_Serif } from "next/font/google";
import { APP_NAME } from "@/config";
import { skyTable } from "@/domain/sky";
import "./globals.css";

const geist = Geist({ variable: "--font-geist", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });
const instrument = Instrument_Serif({
  variable: "--font-instrument",
  subsets: ["latin"],
  weight: "400",
  style: ["normal", "italic"],
});

export const metadata: Metadata = {
  title: { default: APP_NAME, template: `%s · ${APP_NAME}` },
  description: "A purpose-aware task manager that keeps your life direction in front of you.",
  appleWebApp: { capable: true, statusBarStyle: "black-translucent", title: APP_NAME },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#6aa4dc",
};

/**
 * Paints the correct sky before first paint (no flash), from local time,
 * the `?at=HH:MM` review override, and the saved theme. SkyProvider takes over after hydration.
 */
const skyScript = `(function(){try{var T=${JSON.stringify(skyTable(15))};var q=new URLSearchParams(location.search),at=q.get('at'),m;if(at&&/^\\d{1,2}:\\d{2}$/.test(at)){var p=at.split(':');m=(+p[0])*60+(+p[1])}else{var d=new Date();m=d.getHours()*60+d.getMinutes()}var th=null;try{th=localStorage.getItem('dhl:theme')}catch(e){}if(th==='light')m=720;if(th==='dark')m=1350;var r=T[Math.floor(m/15)%T.length],e=document.documentElement,s=e.style;s.setProperty('--sky-top',r[0]);s.setProperty('--sky-mid',r[1]);s.setProperty('--sky-bottom',r[2]);e.dataset.ink=r[3]?'light':'dark'}catch(e){}})();`;

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      data-ink="dark"
      suppressHydrationWarning
      className={`${geist.variable} ${geistMono.variable} ${instrument.variable} antialiased`}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: skyScript }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
