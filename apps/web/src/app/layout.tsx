import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Racho - Gestão de Despesas & Simplificação de Dívidas',
  description: 'Divida despesas, escaneie notas fiscais com IA e otimize pagamentos entre amigos com precisão financeira em centavos.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR">
      <body className="min-h-screen bg-[#0b0f17] text-gray-100 antialiased">
        {children}
      </body>
    </html>
  );
}
