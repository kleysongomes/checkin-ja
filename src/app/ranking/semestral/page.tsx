"use client";

import { useState, useEffect } from "react";
import { db } from "@/lib/firebase";
import { collection, getDocs, query, where, Timestamp } from "firebase/firestore";
import { ArrowLeft, X, CheckCircle2, XCircle, Users, BookOpen, Compass } from "lucide-react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import Image from "next/image";

const PROFESSORES_IDS = [
  "M4ialQNzQrB72gNJCYfF",
  "9JIoC3V8UD49mhw0ZOII",
  "FtXEvoTMnhCaUs02WwKc",
  "YspNbmYvpK3ylOC7MnJn",
];

const PREMIOS = [
  { pos: 1, emoji: "🥇", label: "Inscrição completa do Together" },
  { pos: 2, emoji: "🥈", label: "Somente inscrição do Together" },
  { pos: 3, emoji: "🥉", label: "Big Cozinha (ou R$120)" },
];

interface Aluno {
  id: string;
  nome: string;
  presencas: number;
  classe: string;
  ultimoCheckin: Timestamp | null;
}

interface Stats {
  licao: number;
  pg: number;
  estudo: number;
  missao: number;
}

interface Candidato extends Aluno {
  stats: Stats;
  pontosTiebreak: number;
  apto: boolean;
  faltando: string[];
}

export default function RankingSemestralPage() {
  const [mounted, setMounted] = useState(false);
  const [candidatos, setCandidatos] = useState<Candidato[]>([]);
  const [loading, setLoading] = useState(true);
  const [classeNome, setClasseNome] = useState("");
  const [selecionado, setSelecionado] = useState<Candidato | null>(null);

  useEffect(() => {
    setMounted(true);
    const classeId = localStorage.getItem("checkin_classe_pref");
    if (!classeId) { window.location.href = "/"; return; }
    setClasseNome(classeId === "jovens" ? "Classe de Jovens" : "Classe de Juvenis");

    async function fetchDados() {
      try {
        const [alunosSnap, statsSnap] = await Promise.all([
          getDocs(query(collection(db, "alunos"))),
          getDocs(query(collection(db, "estatisticas"), where("classe", "==", classeId))),
        ]);

        // Mapa de estatísticas por alunoId
        const statsMap = new Map<string, Stats>();
        statsSnap.docs.forEach(d => {
          const dados = d.data();
          const id = dados.alunoId as string;
          const atual = statsMap.get(id) ?? { licao: 0, pg: 0, estudo: 0, missao: 0 };
          statsMap.set(id, {
            licao:  atual.licao  + (dados.licao  ? 1 : 0),
            pg:     atual.pg     + (dados.pg     ? 1 : 0),
            estudo: atual.estudo + (dados.estudo ? 1 : 0),
            missao: atual.missao + (dados.missao ? 1 : 0),
          });
        });

        const alunos = alunosSnap.docs
          .map(d => ({ id: d.id, ...d.data(), classe: d.data().classe || "jovens" } as Aluno))
          .filter(a => a.classe === classeId && !PROFESSORES_IDS.includes(a.id));

        const lista: Candidato[] = alunos.map(aluno => {
          const s = statsMap.get(aluno.id) ?? { licao: 0, pg: 0, estudo: 0, missao: 0 };
          const faltando: string[] = [];
          if (s.licao  === 0) faltando.push("Lição");
          if (s.pg     === 0) faltando.push("PG");
          if (s.missao === 0) faltando.push("Missão");
          const pontosTiebreak = s.licao + s.pg + s.missao;
          return { ...aluno, stats: s, pontosTiebreak, apto: faltando.length === 0, faltando };
        });

        // Aptos primeiro, depois por presenças desc, depois por tiebreak desc
        lista.sort((a, b) => {
          if (a.apto !== b.apto) return a.apto ? -1 : 1;
          if (b.presencas !== a.presencas) return b.presencas - a.presencas;
          return b.pontosTiebreak - a.pontosTiebreak;
        });

        setCandidatos(lista.filter(c => c.apto));
      } catch (e) {
        console.error("Erro ao carregar ranking semestral", e);
      } finally {
        setLoading(false);
      }
    }
    fetchDados();
  }, []);

  const top5 = candidatos;

  if (!mounted) return null;

  return (
    <main className="flex-1 flex flex-col no-scrollbar overflow-y-auto bg-white min-h-screen">
      {/* HEADER */}
      <header className="sticky top-0 z-40 glass px-6 pt-12 pb-4 flex items-center gap-4">
        <Link
          href="/ranking"
          className="p-2 -ml-2 rounded-full hover:bg-slate-100 text-slate-600 transition-all active:scale-90"
        >
          <ArrowLeft size={24} />
        </Link>
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">Prêmio Semestral</h1>
          <p className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1">
            <Users size={10} /> {classeNome}
          </p>
        </div>
      </header>

      <div className="flex-1 px-6 pt-4 pb-12 space-y-6">
        {/* BANNER TOGETHER */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative w-full rounded-3xl overflow-hidden shadow-lg"
        >
          <Image
            src="/Capa.avif"
            alt="Together"
            width={480}
            height={200}
            className="w-full object-cover object-top max-h-44"
            priority
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent flex items-end px-5 pb-4">
            <div>
              <p className="text-white font-black text-lg leading-tight">Together</p>
              <p className="text-white/70 text-xs">Prêmio Semestral · ES Jovens</p>
            </div>
          </div>
        </motion.div>

        {/* REGRAS */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.15 }}
          className="rounded-3xl bg-indigo-50 border border-indigo-100 p-5 space-y-3"
        >
          <h2 className="text-xs font-black text-indigo-400 uppercase tracking-widest">Condições Obrigatórias</h2>
          <ul className="space-y-2 text-xs text-slate-600 leading-relaxed">
            <li>• No período informado, o candidato(a) deve ter praticado, pelo menos uma vez, as ações: <strong>Missionárias, Estudo da Lição e PG</strong>.</li>
            <li>• Para critério de desempate, é utilizado 1pt para cada ação realizada.</li>
            <li>• O Prêmio é transferível.</li>
            <li>• Caso o candidato já tenha feito a inscrição, será feito pagamento via PIX.</li>
          </ul>
        </motion.div>

        {/* RANKING */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-4">
            <div className="w-12 h-12 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
            <p className="text-slate-400 font-medium animate-pulse">Calculando posições...</p>
          </div>
        ) : top5.length === 0 ? (
          <div className="text-center py-20 opacity-50">
            <p className="text-slate-400 font-medium">Nenhum participante encontrado.</p>
          </div>
        ) : (
          <section className="space-y-3">
            <h2 className="text-xs font-black text-slate-400 uppercase tracking-widest">Classificação</h2>

            {top5.map((c, i) => {
              const pos = i + 1;
              const premio = PREMIOS.find(p => p.pos === pos);
              const isComparacao = pos > 3;

              return (
                <motion.button
                  key={c.id}
                  initial={{ opacity: 0, x: -12 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.08 * i }}
                  onClick={() => setSelecionado(c)}
                  className={cn(
                    "w-full text-left flex items-center gap-4 p-4 rounded-2xl border shadow-sm transition-all active:scale-[0.98]",
                    isComparacao
                      ? "bg-slate-50 border-slate-100 opacity-70"
                      : c.apto
                        ? "bg-white border-indigo-100 hover:border-indigo-300"
                        : "bg-slate-50 border-slate-200 opacity-60"
                  )}
                >
                  {/* Posição */}
                  <div className={cn(
                    "w-9 h-9 rounded-xl flex items-center justify-center font-black text-sm shrink-0",
                    pos === 1 ? "bg-yellow-100 text-yellow-700" :
                    pos === 2 ? "bg-slate-200 text-slate-600" :
                    pos === 3 ? "bg-orange-100 text-orange-700" :
                                "bg-slate-100 text-slate-400"
                  )}>
                    {isComparacao ? `#${pos}` : `${pos}º`}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-slate-800 text-sm truncate">{c.nome}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-xs text-slate-400">{c.presencas} presenças</span>
                      {c.pontosTiebreak > 0 && (
                        <span className="text-xs text-indigo-400">· {c.pontosTiebreak}pts</span>
                      )}
                    </div>
                    {premio && c.apto && (
                      <p className="text-xs text-indigo-600 font-semibold mt-1 truncate">
                        {premio.emoji} {premio.label}
                      </p>
                    )}
                    {!c.apto && (
                      <p className="text-xs text-red-400 font-medium mt-1">Inapto</p>
                    )}
                    {isComparacao && c.apto && pos <= 5 && (
                      <p className="text-xs text-slate-400 mt-1">Para comparação</p>
                    )}
                  </div>

                  {/* Apto badge */}
                  <div className="shrink-0">
                    {c.apto
                      ? <CheckCircle2 size={18} className="text-emerald-500" />
                      : <XCircle size={18} className="text-red-400" />
                    }
                  </div>
                </motion.button>
              );
            })}
          </section>
        )}

      </div>

      {/* MODAL DETALHE DO CANDIDATO */}
      <AnimatePresence>
        {selecionado && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 backdrop-blur-sm p-4"
            onClick={() => setSelecionado(null)}
          >
            <motion.div
              initial={{ y: 60, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 60, opacity: 0 }}
              transition={{ type: "spring", damping: 28, stiffness: 380 }}
              onClick={e => e.stopPropagation()}
              className="w-full max-w-sm bg-white rounded-3xl shadow-2xl overflow-hidden"
            >
              {/* Cabeçalho do modal */}
              <div className={cn(
                "px-6 pt-6 pb-5",
                selecionado.apto ? "bg-indigo-600" : "bg-slate-500"
              )}>
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-white font-black text-lg leading-tight">{selecionado.nome}</p>
                    <p className="text-white/70 text-xs mt-0.5">
                      {selecionado.presencas} presenças · {selecionado.pontosTiebreak} pts desempate
                    </p>
                  </div>
                  <button
                    onClick={() => setSelecionado(null)}
                    className="p-1.5 rounded-full bg-white/20 text-white hover:bg-white/30 transition-all"
                  >
                    <X size={16} />
                  </button>
                </div>
                <div className={cn(
                  "mt-3 inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold",
                  selecionado.apto
                    ? "bg-emerald-400/30 text-emerald-100"
                    : "bg-red-400/30 text-red-100"
                )}>
                  {selecionado.apto
                    ? <><CheckCircle2 size={12} /> Apto para o prêmio</>
                    : <><XCircle size={12} /> Inapto</>
                  }
                </div>
              </div>

              {/* Detalhes das ações */}
              <div className="p-6 space-y-4">
                {selecionado.apto ? (
                  <>
                    <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest">Ações Realizadas</h3>
                    <StatRow
                      icon={<BookOpen size={16} className="text-indigo-500" />}
                      label="Lição Estudada"
                      count={selecionado.stats.licao}
                      obrigatorio
                    />
                    <StatRow
                      icon={<Users size={16} className="text-emerald-500" />}
                      label="Participou de PG"
                      count={selecionado.stats.pg}
                      obrigatorio
                    />
                    <StatRow
                      icon={<Compass size={16} className="text-orange-500" />}
                      label="Ação Missionária"
                      count={selecionado.stats.missao}
                      obrigatorio
                    />
                    <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
                      <span className="text-xs text-slate-400 font-medium">Total pontos de desempate</span>
                      <span className="font-black text-indigo-600 text-lg">{selecionado.pontosTiebreak}</span>
                    </div>
                  </>
                ) : (
                  <div className="flex flex-col items-center justify-center py-6 gap-3 text-center">
                    <XCircle size={32} className="text-slate-300" />
                    <p className="text-sm font-semibold text-slate-400">Dados não disponíveis</p>
                    <p className="text-xs text-slate-300 max-w-[200px] leading-relaxed">
                      Este participante não atende às condições obrigatórias do prêmio.
                    </p>
                  </div>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </main>
  );
}

function StatRow({
  icon, label, count, obrigatorio,
}: {
  icon: React.ReactNode;
  label: string;
  count: number;
  obrigatorio?: boolean;
}) {
  const ok = count > 0;
  return (
    <div className="flex items-center gap-3">
      <div className="w-8 h-8 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-center shrink-0">
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-slate-700 flex items-center gap-1.5">
          {label}
          {obrigatorio && (
            <span className="text-[10px] font-bold text-slate-300 uppercase tracking-wide">obrig.</span>
          )}
        </p>
      </div>
      <div className="flex items-center gap-1.5 shrink-0">
        <span className={cn(
          "font-black text-base",
          ok ? "text-slate-800" : "text-red-400"
        )}>
          {count}×
        </span>
        {ok
          ? <CheckCircle2 size={14} className="text-emerald-500" />
          : obrigatorio && <XCircle size={14} className="text-red-400" />
        }
      </div>
    </div>
  );
}
