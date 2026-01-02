import "./globals.css";
import { Inter } from "next/font/google";
import { Toaster } from "react-hot-toast";
import { cn } from "@/lib/utils";

const inter = Inter({ 
  subsets: ["latin"],
  variable: "--font-inter",
});

export const metadata = {
  title: "Check-in Escola Sabatina - JA",
  description: "Ministério Jovem - Escola Sabatina",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      {/* Aplicamos bg-slate-100 e antialiased aqui diretamente */}
      <body className={cn(
        inter.variable,
        "font-sans min-h-screen flex justify-center bg-slate-200 antialiased text-slate-900"
      )}>
        {/* Container Mobile Premium */}
        <div className="w-full max-w-[480px] bg-slate-50 min-h-screen shadow-2xl relative flex flex-col border-x border-slate-300/20">
          {children}
          <Toaster 
            position="top-center"
            toastOptions={{
              className: 'font-medium rounded-2xl shadow-xl border border-slate-100',
            }}
          />
        </div>
      </body>
    </html>
  );
}