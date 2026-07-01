import "./globals.css";
import { Be_Vietnam_Pro } from "next/font/google";
import { AuthProvider } from "@/features/auth/auth-context";

const beVietnamPro = Be_Vietnam_Pro({
  subsets: ["latin", "vietnamese"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-be-vietnam-pro",
  display: "swap",
});

export const metadata = {
  title: "Học Mà Chơi",
  description: "Trình tạo trò chơi học tập · AI",
  icons: {
    icon: "/icon.svg",
    shortcut: "/icon.svg",
    apple: "/apple-icon.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="vi" className="light" style={{ colorScheme: "light" }}>
      <body
        className={beVietnamPro.variable}
        style={{ background: "#f9fafb", color: "#111827", fontFamily: "'Be Vietnam Pro', sans-serif", margin: 0 }}
      >
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
