import "../styles/globals.css";

export const metadata = {
  title: "Veridoc",
  description: "Faithful paper-to-proposal frontend workspace",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
