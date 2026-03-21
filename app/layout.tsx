import type { Metadata } from "next";
import { Providers } from "@/components/providers";
import "./globals.css";

export const metadata: Metadata = {
  title: "五维诊断系统 - 企业组织健康度评估",
  description: "基于 IBM/华为 BLM 模型的企业组织诊断工具，快速评估战略、组织、绩效、薪酬、人才五大维度",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body className="antialiased">
        <Providers>
          {children}
        </Providers>
      </body>
    </html>
  );
}
