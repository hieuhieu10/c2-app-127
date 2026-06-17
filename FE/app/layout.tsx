import "./globals.css";
import { AuthProvider } from "@/features/auth/auth-context";

export const metadata = {
  title: "LearnGame",
  description: "AI-assisted learning game generator",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
