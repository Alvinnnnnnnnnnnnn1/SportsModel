import type { Metadata } from "next";
import { AppProvider } from "@/components/app-provider";
import { Shell } from "@/components/shell";
import "./globals.css";
export const metadata: Metadata = {
  title: { default: "EdgeLab · Research workspace", template: "%s · EdgeLab" },
  description:
    "Private sports research and performance analytics. Local demo with clearly labelled synthetic data.",
  robots: { index: false, follow: false },
};
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en-AU">
      <body>
        <AppProvider>
          <Shell>{children}</Shell>
        </AppProvider>
      </body>
    </html>
  );
}
