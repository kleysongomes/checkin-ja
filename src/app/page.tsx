"use client";

import { useState, useEffect, useMemo } from "react";
import { db } from "@/lib/firebase";
import { 
  collection, addDoc, getDocs, query, updateDoc, doc, 
  increment, serverTimestamp, arrayUnion, Timestamp 
} from "firebase/firestore";
import { Search, Trophy, Check, Plus, X, Loader2 } from "lucide-react";
import toast from "react-hot-toast";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import { cn } from "@/lib/utils";

interface Aluno {
  id: string;
  nome: string;
  presencas: number;
  ultimoCheckin: Timestamp | null;
}

export default function HomePage() {
  const [mounted, setMounted] = useState(false);
  const [alunos, setAlunos] = useState<Aluno[]>([]);
  const [busca, setBusca] = useState("");
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [novoNome, setNovoNome] = useState("");

  useEffect(() => {
    setMounted(true);
    async function fetchAlunos() {
      try {
        const q = query(collection(db, "alunos"));
        const snapshot = await getDocs(q);
        const data = snapshot.docs.map(d => ({ id: d.id, ...d.data() })) as Aluno[];
        setAlunos(data.sort((a, b) => a.nome.localeCompare(b.nome)));
      } catch (e) {
        toast.error("Erro ao carregar dados");
      } finally {
        setLoading(false);
      }
    }
    fetchAlunos();
  }, []);

  // --- Lógica de Validação e Filtro ---
  const jaMarcouHoje = (ultimo: Timestamp | null) => {
    if (!ultimo) return false;
    const d = ultimo.toDate();
    const agora = new Date();
    return d.getDate() === agora.getDate() && d.getMonth() === agora.getMonth() && d.getFullYear() === agora.getFullYear();
  };

  const listaFiltrada = useMemo(() => {
    return alunos.filter(a => a.nome.toLowerCase().includes(busca.toLowerCase()))
      .sort((a, b) => {
        const aFeito = jaMarcouHoje(a.ultimoCheckin);
        const bFeito = jaMarcouHoje(b.ultimoCheckin);
        if (aFeito === bFeito) return a.nome.localeCompare(b.nome);
        return aFeito ? 1 : -1; // Pendentes no topo
      });
  }, [alunos, busca]);

  const progresso = useMemo(() => {
    if (alunos.length === 0) return 0;
    const presentes = alunos.filter(a => jaMarcouHoje(a.ultimoCheckin)).length;
    return (presentes / alunos.length) * 100;
  }, [alunos]);

  // --- Ações com Optimistic UI ---
  const handleCheckin = async (aluno: Aluno) => {
    if (jaMarcouHoje(aluno.ultimoCheckin)) return;

    // 1. Update Local (Instantâneo)
    const backup = [...alunos];
    setAlunos(prev => prev.map(a => 
      a.id === aluno.id ? { ...a, presencas: a.presencas + 1, ultimoCheckin: Timestamp.now() } : a
    ));
    toast.success(`Check-in confirmado!`, { icon: '✨' });

    // 2. Update Firebase (Background)
    try {
      await updateDoc(doc(db, "alunos", aluno.id), {
        presencas: increment(1),
        ultimoCheckin: serverTimestamp(),
        historico: arrayUnion(new Date())
      });
    } catch (e) {
      setAlunos(backup); // Rollback se falhar
      toast.error("Erro ao sincronizar");
    }
  };

  const handleNovoAluno = async () => {
    if (!novoNome.trim()) return;
    setIsModalOpen(false);
    const toastId = toast.loading("Cadastrando...");

    try {
      const docRef = await addDoc(collection(db, "alunos"), {
        nome: novoNome,
        presencas: 1,
        ultimoCheckin: serverTimestamp(),
        historico: [new Date()]
      });
      const novo: Aluno = { id: docRef.id, nome: novoNome, presencas: 1, ultimoCheckin: Timestamp.now() };
      setAlunos(prev => [...prev, novo].sort((a,b) => a.nome.localeCompare(b.nome)));
      setNovoNome("");
      toast.success("Bem-vindo(a)!", { id: toastId });
    } catch (e) {
      toast.error("Erro ao cadastrar", { id: toastId });
    }
  };

  if (!mounted) return null;

  return (
    <main className="flex-1 flex flex-col no-scrollbar overflow-y-auto">
      {/* HEADER GLASSMORPHISM */}
      <header className="sticky top-0 z-40 glass px-6 pt-12 pb-4">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">Check-in Escola Sabatina - JA</h1>
            <p className="text-slate-500 text-xs font-medium uppercase tracking-widest mt-0.5">
              {new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })}
            </p>
          </div>
          <Link href="/ranking" className="p-3 bg-slate-100 rounded-2xl hover:bg-indigo-50 text-slate-600 hover:text-indigo-600 transition-all active:scale-90 shadow-sm border border-slate-200">
            <Trophy size={22} />
          </Link>
        </div>

        {/* BUSCA ESTILO APPLE */}
        <div className="relative group">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-500 transition-colors" size={18} />
          <input 
            type="text"
            placeholder="Buscar aluno..."
            className="w-full pl-11 pr-4 py-3.5 bg-slate-100 border-none rounded-2xl text-slate-800 placeholder:text-slate-400 focus:ring-4 focus:ring-indigo-500/10 focus:bg-white transition-all outline-none font-medium"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
          />
        </div>

        {/* PROGRESS BAR SUTIL */}
        <div className="absolute bottom-0 left-0 h-[2px] bg-slate-100 w-full overflow-hidden">
          <motion.div 
            initial={{ width: 0 }} 
            animate={{ width: `${progresso}%` }} 
            className="h-full bg-gradient-to-r from-indigo-500 to-blue-500" 
          />
        </div>
      </header>

      {/* LISTA DE ALUNOS */}
      <div className="px-5 py-6 space-y-3 pb-32">
        {loading ? (
          <div className="flex justify-center py-20"><Loader2 className="animate-spin text-slate-300" size={32} /></div>
        ) : (
          <AnimatePresence mode="popLayout">
            {listaFiltrada.map((aluno) => (
              <StudentCard 
                key={aluno.id} 
                aluno={aluno} 
                feito={jaMarcouHoje(aluno.ultimoCheckin)} 
                onClick={() => handleCheckin(aluno)} 
              />
            ))}
            {listaFiltrada.length === 0 && busca.length > 0 && (
              <motion.button
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                onClick={() => setIsModalOpen(true)}
                className="w-full p-4 rounded-3xl border-2 border-dashed border-slate-200 text-slate-400 font-bold flex flex-col items-center gap-2 hover:bg-slate-50 transition-colors"
              >
                <Plus size={24} />
                <span>Cadastrar "{busca}"</span>
              </motion.button>
            )}
          </AnimatePresence>
        )}
      </div>

      {/* BOTÃO FLUTUANTE ADICIONAR */}
      <div className="fixed bottom-8 left-0 right-0 px-6 flex justify-center pointer-events-none">
        <button 
          onClick={() => setIsModalOpen(true)}
          className="pointer-events-auto bg-slate-900 text-white px-8 py-4 rounded-full shadow-2xl flex items-center gap-3 active:scale-95 transition-transform"
        >
          <Plus size={20} strokeWidth={3} />
          <span className="font-bold text-sm tracking-tight">Novo Aluno</span>
        </button>
      </div>

      {/* MODAL DE CADASTRO */}
      <AnimatePresence>
        {isModalOpen && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setIsModalOpen(false)} className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50" />
            <motion.div initial={{ y: 100 }} animate={{ y: 0 }} exit={{ y: 100 }} className="fixed bottom-6 left-6 right-6 bg-white p-8 rounded-[2.5rem] shadow-2xl z-50">
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-xl font-bold text-slate-900 tracking-tight">Novo Perfil</h3>
                <button onClick={() => setIsModalOpen(false)} className="text-slate-400"><X size={24}/></button>
              </div>
              <input 
                autoFocus
                placeholder="Nome completo..." 
                className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl p-5 text-lg font-bold outline-none focus:border-indigo-500 transition-colors mb-6" 
                value={novoNome} 
                onChange={(e) => setNovoNome(e.target.value)} 
              />
              <button onClick={handleNovoAluno} className="w-full bg-indigo-600 text-white py-5 rounded-2xl font-black text-lg shadow-lg shadow-indigo-200">Confirmar</button>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </main>
  );
}

function StudentCard({ aluno, feito, onClick }: { aluno: Aluno, feito: boolean, onClick: () => void }) {
  const iniciais = aluno.nome.split(" ").map(n => n[0]).join("").substring(0,2).toUpperCase();
  
  return (
    <motion.button
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      onClick={onClick}
      disabled={feito}
      className={cn(
        "w-full flex items-center justify-between p-4 rounded-3xl border-2 transition-all active:scale-[0.98]",
        feito ? "bg-white/50 border-emerald-100 opacity-60" : "bg-white border-transparent shadow-sm shadow-slate-200/50 hover:border-indigo-100"
      )}
    >
      <div className="flex items-center gap-4 text-left">
        <div className={cn(
          "w-12 h-12 rounded-2xl flex items-center justify-center font-bold text-sm",
          feito ? "bg-emerald-500 text-white" : "bg-indigo-50 text-indigo-500"
        )}>
          {feito ? <Check size={20} strokeWidth={3} /> : iniciais}
        </div>
        <div>
          <h3 className={cn("font-bold tracking-tight", feito ? "text-slate-400 line-through" : "text-slate-800")}>{aluno.nome}</h3>
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
            {feito ? "Presença marcada" : `${aluno.presencas} Presenças`}
          </p>
        </div>
      </div>
      {!feito && (
        <div className="h-8 w-8 rounded-full bg-slate-50 flex items-center justify-center text-slate-300 group-hover:bg-indigo-50 group-hover:text-indigo-500 transition-colors">
          <Plus size={16} strokeWidth={3} />
        </div>
      )}
    </motion.button>
  );
}