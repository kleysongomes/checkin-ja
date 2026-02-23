"use client";

import { useState, useEffect, useMemo } from "react";
import { db } from "@/lib/firebase";
import { collection, getDocs, query, Timestamp } from "firebase/firestore";
import { ArrowLeft, Crown, Star, Users } from "lucide-react";
import Link from "next/link";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

// CONFIGURAÇÃO: BLACKLIST PROFESSORES
const PROFESSORES_IDS = [
  "M4ialQNzQrB72gNJCYfF",//Kleyson
  // "40Al8hIstVIOsykySkFh",//Makel
  // "806Kb6ZfsBFIsUY8GdYd",//Jarlean
  "9JIoC3V8UD49mhw0ZOII",//Nanda
  "FtXEvoTMnhCaUs02WwKc",//Degley
  // "G4b2wQKTHnzND4aBtyWg",//Pietra
  "YspNbmYvpK3ylOC7MnJn",//Navit
  // "mUivx4Ms9w6p3mPOmbNx",//Ingryd
  // "Wwn7VuWSh2OnlnUKWPtO",//Erica juvenis, validar se deixa na regra
  // "jD1dMnQ7ZQOf6ztS7Xvv",//João juvenis, validar se deixa na regra
];

interface Aluno {
  id: string;
  nome: string;
  presencas: number;
  classe: string;
  ultimoCheckin: Timestamp | null;
}

export default function RankingPage() {
  const [mounted, setMounted] = useState(false);
  const [alunos, setAlunos] = useState<Aluno[]>([]);
  const [loading, setLoading] = useState(true);
  const [classeNome, setClasseNome] = useState("");

  useEffect(() => {
    setMounted(true);
    
    // 1. Verifica Classe
    const classeId = localStorage.getItem("checkin_classe_pref");
    if (!classeId) {
      window.location.href = "/";
      return;
    }
    setClasseNome(classeId === 'jovens' ? 'Classe de Jovens' : 'Classe de Juvenis');

    async function fetchRanking() {
      try {
        // 2. Busca TODOS (para tratar quem não tem campo 'classe')
        const q = query(collection(db, "alunos"));
        const snapshot = await getDocs(q);
        
        const todosAlunos = snapshot.docs.map(d => {
          const dados = d.data();
          return { 
            id: d.id, 
            ...dados,
            // Lógica de Fallback: Se não tem classe, é Jovens
            classe: dados.classe || "jovens" 
          };
        }) as Aluno[];

        // 3. Aplica os Filtros (Classe + Blacklist)
        const alunosValidos = todosAlunos
          .filter(a => a.classe === classeId)
          .filter(a => !PROFESSORES_IDS.includes(a.id));

        // 4. Ordenação (Pontos > Tempo)
        const sorted = alunosValidos.sort((a, b) => {
          if (b.presencas !== a.presencas) return b.presencas - a.presencas;
          const timeA = a.ultimoCheckin?.seconds || 0;
          const timeB = b.ultimoCheckin?.seconds || 0;
          return timeA - timeB;
        });
        
        setAlunos(sorted);
      } catch (e) {
        console.error("Erro ao carregar ranking", e);
      } finally {
        setLoading(false);
      }
    }
    fetchRanking();
  }, []);

  const top3 = useMemo(() => alunos.slice(0, 3), [alunos]);
  const resto = useMemo(() => alunos.slice(3), [alunos]);

  if (!mounted) return null;

  return (
    <main className="flex-1 flex flex-col no-scrollbar overflow-y-auto bg-white min-h-screen">
      {/* HEADER NAV (ORIGINAL) */}
      <header className="sticky top-0 z-40 glass px-6 pt-12 pb-4 flex items-center gap-4">
        <Link 
          href="/" 
          className="p-2 -ml-2 rounded-full hover:bg-slate-100 text-slate-600 transition-all active:scale-90"
        >
          <ArrowLeft size={24} />
        </Link>
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">Ranking Geral</h1>
          <p className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1">
            <Users size={10} /> {classeNome}
          </p>
        </div>
      </header>

      <div className="flex-1 px-6 pt-6 pb-12">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-4">
            <div className="w-12 h-12 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
            <p className="text-slate-400 font-medium animate-pulse">Calculando posições...</p>
          </div>
        ) : alunos.length === 0 ? (
           <div className="text-center py-20 opacity-50">
             <p className="text-slate-400 font-medium">Nenhum aluno pontuou nesta classe ainda.</p>
           </div>
        ) : (
          <>
            {/* 1. O PÓDIO (TOP 3)*/}
            <section className="flex items-end justify-center gap-2 mb-12 mt-4 h-56">
              {/* 2º LUGAR */}
              {top3[1] && (
                <PodiumColumn 
                  aluno={top3[1]} 
                  rank={2} 
                  height="h-[70%]" 
                  color="bg-slate-200" 
                  textColor="text-slate-700"
                  delay={0.2}
                />
              )}
              
              {/* 1º LUGAR */}
              {top3[0] && (
                <PodiumColumn 
                  aluno={top3[0]} 
                  rank={1} 
                  height="h-full" 
                  color="bg-indigo-600" 
                  textColor="text-white"
                  isWinner
                  delay={0.1}
                />
              )}

              {/* 3º LUGAR */}
              {top3[2] && (
                <PodiumColumn 
                  aluno={top3[2]} 
                  rank={3} 
                  height="h-[55%]" 
                  color="bg-orange-200" 
                  textColor="text-orange-800"
                  delay={0.3}
                />
              )}
            </section>

            {/* 2. LISTA RESTANTE*/}
            <section className="space-y-2">
              <h2 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4">Mural de Honra</h2>
              {resto.map((aluno, index) => (
                <motion.div
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.1 * index }}
                  key={aluno.id}
                  className="flex items-center justify-between p-4 rounded-2xl bg-slate-50 border border-slate-100 shadow-sm"
                >
                  <div className="flex items-center gap-4">
                    <span className="text-xs font-black text-slate-300 w-5">#{index + 4}</span>
                    <div className="w-10 h-10 rounded-xl bg-white border border-slate-200 flex items-center justify-center font-bold text-slate-500 text-xs">
                      {aluno.nome.substring(0, 2).toUpperCase()}
                    </div>
                    <span className="font-bold text-slate-700 text-sm truncate max-w-[150px]">{aluno.nome}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="font-black text-slate-900">{aluno.presencas}</span>
                    <Star size={12} className="text-indigo-500 fill-indigo-500" />
                  </div>
                </motion.div>
              ))}
            </section>
          </>
        )}
      </div>
    </main>
  );
}

// COMPONENTE AUXILIAR: COLUNA DO PÓDIO
function PodiumColumn({ 
  aluno, rank, height, color, textColor, isWinner, delay 
}: { 
  aluno: Aluno, rank: number, height: string, color: string, textColor: string, isWinner?: boolean, delay: number 
}) {
  return (
    <motion.div 
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, delay, ease: [0.16, 1, 0.3, 1] }}
      className={cn("flex-1 flex flex-col items-center justify-end group", height)}
    >
      <div className="mb-3 text-center px-1">
        {isWinner && <Crown size={24} className="text-yellow-500 fill-yellow-500 mx-auto mb-1 animate-bounce" />}
        <p className="text-[10px] font-black text-slate-900 truncate w-20 uppercase tracking-tighter">
          {aluno.nome.split(" ")[0]}
        </p>
        <p className="text-[10px] font-bold text-slate-400">{aluno.presencas} presenças</p>
      </div>
      <div className={cn(
        "w-full rounded-t-3xl flex flex-col items-center pt-4 shadow-lg transition-all border-x border-t border-white/20",
        color,
        isWinner ? "h-full" : "h-[80%]"
      )}>
        <span className={cn("font-black text-2xl italic", textColor)}>
          {rank}º
        </span>
      </div>
    </motion.div>
  );
}