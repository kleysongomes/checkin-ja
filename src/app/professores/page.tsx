"use client";

import { useState, useEffect } from "react";
import { db } from "@/lib/firebase";
import { collection, getDocs, query, Timestamp } from "firebase/firestore";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { motion } from "framer-motion";

// Lista independente da blacklist do ranking.
// Adicione aqui qualquer professor/líder que deva aparecer nesta tela,
// mesmo que ele ainda compita no ranking geral.
const PROFESSORES_IDS = [
  "M4ialQNzQrB72gNJCYfF", // Kleyson
  // "9JIoC3V8UD49mhw0ZOII", // Nanda
  "FtXEvoTMnhCaUs02WwKc", // Degley
  "YspNbmYvpK3ylOC7MnJn", // Navit
  "4av584SLA0CbsAK2N0UZ", // Esther Artuanne
  "806Kb6ZfsBFIsUY8GdYd", // Jarlean
  "G4b2wQKTHnzND4aBtyWg", // Pietra
  // "mUivx4Ms9w6p3mPOmbNx", // Ingryd
];

interface Professor {
  id: string;
  nome: string;
  presencas: number;
  ultimoCheckin: Timestamp | null;
}

function iniciais(nome: string) {
  const partes = nome.trim().split(" ");
  if (partes.length === 1) return partes[0].substring(0, 2).toUpperCase();
  return (partes[0][0] + partes[partes.length - 1][0]).toUpperCase();
}

export default function ProfessoresPage() {
  const [mounted, setMounted] = useState(false);
  const [professores, setProfessores] = useState<Professor[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setMounted(true);
    async function fetchDados() {
      try {
        const snap = await getDocs(query(collection(db, "alunos")));

        const lista: Professor[] = snap.docs
          .filter(d => PROFESSORES_IDS.includes(d.id))
          .map(d => {
            const dados = d.data();
            return {
              id: d.id,
              nome: dados.nome as string,
              presencas: (dados.presencas as number) ?? 0,
              ultimoCheckin: dados.ultimoCheckin as Timestamp | null,
            };
          })
          .sort((a, b) => {
            if (b.presencas !== a.presencas) return b.presencas - a.presencas;
            const timeA = a.ultimoCheckin?.seconds ?? Infinity;
            const timeB = b.ultimoCheckin?.seconds ?? Infinity;
            return timeA - timeB;
          });

        setProfessores(lista);
      } catch (e) {
        console.error("Erro ao carregar professores", e);
      } finally {
        setLoading(false);
      }
    }
    fetchDados();
  }, []);

  if (!mounted) return null;

  return (
    <main className="flex-1 flex flex-col no-scrollbar overflow-y-auto bg-white min-h-screen">
      <header className="sticky top-0 z-40 glass px-6 pt-12 pb-4 flex items-center gap-4">
        <Link
          href="/ranking"
          className="p-2 -ml-2 rounded-full hover:bg-slate-100 text-slate-600 transition-all active:scale-90"
        >
          <ArrowLeft size={24} />
        </Link>
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">Professores Jovens</h1>
          <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Como anda meu professor</p>
        </div>
      </header>

      <div className="flex-1 px-6 pt-6 pb-12 space-y-3">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-4">
            <div className="w-12 h-12 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
            <p className="text-slate-400 font-medium animate-pulse">Carregando professores...</p>
          </div>
        ) : professores.length === 0 ? (
          <div className="text-center py-20 opacity-50">
            <p className="text-slate-400 font-medium">Nenhum professor encontrado.</p>
          </div>
        ) : (
          professores.map((prof, i) => (
            <motion.div
              key={prof.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.07 * i }}
              className="flex items-center gap-4 bg-white border border-slate-100 rounded-3xl p-5 shadow-sm"
            >
              <div className="w-10 h-10 rounded-2xl bg-indigo-600 flex items-center justify-center font-black text-white text-xs shrink-0">
                {iniciais(prof.nome)}
              </div>
              <p className="flex-1 font-bold text-slate-900 truncate">{prof.nome}</p>
              <div className="text-right shrink-0">
                <p className="font-black text-2xl text-indigo-600 leading-none">{prof.presencas}</p>
                <p className="text-[10px] text-slate-400 uppercase tracking-wide">presenças</p>
              </div>
            </motion.div>
          ))
        )}
      </div>
    </main>
  );
}
