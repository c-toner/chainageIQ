import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = {
  title: "ChainageIQ · Infrastructure, in focus",
  description:
    "Chainage, defects and quality assurance for civil infrastructure projects.",
};
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en-AU">
      <body>{children}</body>
    </html>
  );
}
