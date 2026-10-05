export default function HomePage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-6 text-center">
      <div className="max-w-3xl space-y-6">
        <div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-4 py-1.5 text-sm font-medium text-emerald-400">
          ✨ Gestão de Despesas Inteligente
        </div>
        <h1 className="text-4xl font-extrabold tracking-tight sm:text-6xl text-white">
          Racho <span className="text-emerald-500">.</span>
        </h1>
        <p className="text-lg text-gray-400">
          Divida contas em grupo com precisão absoluta em centavos, escaneie cupons fiscais com IA Multimodal e simplifique dívidas com o número mínimo de transferências.
        </p>
        <div className="flex flex-wrap justify-center gap-4 pt-4">
          <a
            href="/login"
            className="rounded-lg bg-emerald-600 px-6 py-3 font-semibold text-white transition hover:bg-emerald-500 shadow-lg shadow-emerald-600/20"
          >
            Entrar na Plataforma
          </a>
          <a
            href="/register"
            className="rounded-lg border border-gray-700 bg-gray-900/60 px-6 py-3 font-semibold text-gray-300 transition hover:bg-gray-800"
          >
            Criar Conta Grátis
          </a>
        </div>
      </div>
    </main>
  );
}
