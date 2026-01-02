"use client";

import { useState, useEffect, useMemo } from "react";
import { db } from "@/lib/firebase";
import { 
  collection, addDoc, getDocs, query, updateDoc, doc, 
  increment, serverTimestamp, arrayUnion, Timestamp 
} from "firebase/firestore";
import { Search, Trophy, Check, Plus, X, Loader2, CalendarClock, LayoutDashboard, ChevronRight, Beaker } from "lucide-react";
import toast from "react-hot-toast";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import { cn } from "@/lib/utils";

// ==========================================
// CONFIGURAÇÃO DE TESTE - FORÇADA
const MODO_TESTE = false; 
// ==========================================

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
  const [isStatsModalOpen, setIsStatsModalOpen] = useState(false);
  const [selectedAluno, setSelectedAluno] = useState<Aluno | null>(null);
  const [novoNome, setNovoNome] = useState("");

  const [missaoStats, setMissaoStats] = useState({
    licao: false, pg: false, estudo: false, missao: false
  });

  useEffect(() => {
    setMounted(true);
    if (MODO_TESTE) console.log("🛠️ MODO TESTE ATIVO: Regras de Sábado suspensas.");
    
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

  // --- LÓGICA DE VALIDAÇÃO (REGRAS DE NEGÓCIO) ---
  const validarRegrasCheckin = (ultimo: Timestamp | null) => {
    if (MODO_TESTE) return true; // Bypass total imediato

    const agora = new Date();
    const diaSemana = agora.getDay(); // 0: Domingo, 6: Sábado
    const hora = agora.getHours();

    // 1. REGRA: Apenas Sábados (dia 6)
    if (diaSemana !== 6) {
      toast.error("O check-in só é permitido aos Sábados.", { id: 'regra-dia' });
      return false;
    }

    // 2. REGRA: Até 12:00h
    if (hora >= 12) {
      toast.error("Horário encerrado (disponível até às 12:00h).", { id: 'regra-hora' });
      return false;
    }

    // 3. REGRA: Apenas uma vez por dia (Prevenção de duplicidade)
    if (ultimo) {
      const d = ultimo.toDate();
      if (d.getDate() === agora.getDate() && d.getMonth() === agora.getMonth() && d.getFullYear() === agora.getFullYear()) {
        toast("Você já garantiu sua presença hoje!", { icon: '✅', id: 'regra-duplicidade' });
        return false;
      }
    }
    return true;
  };

  const jaMarcouHoje = (ultimo: Timestamp | null) => {
    // No modo teste, o botão NUNCA deve aparecer como "feito" (desabilitado)
    if (MODO_TESTE) return false;

    if (!ultimo) return false;
    const d = ultimo.toDate();
    const agora = new Date();
    return d.getDate() === agora.getDate() && d.getMonth() === agora.getMonth() && d.getFullYear() === agora.getFullYear();
  };

  const handleCheckinStart = (aluno: Aluno) => {
    if (!validarRegrasCheckin(aluno.ultimoCheckin)) return;
    setSelectedAluno(aluno);
    setMissaoStats({ licao: false, pg: false, estudo: false, missao: false });
    setIsStatsModalOpen(true);
  };

  const handleFinalizarCheckin = async () => {
    if (!selectedAluno) return;
    setIsStatsModalOpen(false);
    const toastId = toast.loading("Finalizando...");

    try {
      await addDoc(collection(db, "estatisticas"), {
        alunoId: selectedAluno.id,
        nome: selectedAluno.nome,
        data: serverTimestamp(),
        ...missaoStats
      });

      await updateDoc(doc(db, "alunos", selectedAluno.id), {
        presencas: increment(1),
        ultimoCheckin: serverTimestamp(),
        historico: arrayUnion(new Date())
      });

      setAlunos(prev => prev.map(a => 
        a.id === selectedAluno.id ? { ...a, presencas: a.presencas + 1, ultimoCheckin: Timestamp.now() } : a
      ));

      toast.success("Check-in realizado!", { id: toastId });
    } catch (e) {
      toast.error("Erro ao salvar", { id: toastId });
    }
  };

  const handleNovoAluno = async () => {
    if (!novoNome.trim()) return;

    const agora = new Date();
    // No modo teste, sempre permite cadastrar com 1 presença imediata se quiser
    const eHorarioValido = (agora.getDay() === 6 && agora.getHours() < 12) || MODO_TESTE;

    setIsModalOpen(false);
    const toastId = toast.loading("Cadastrando...");

    try {
      const dadosNovoAluno = {
        nome: novoNome,
        presencas: eHorarioValido ? 1 : 0,
        ultimoCheckin: eHorarioValido ? serverTimestamp() : null,
        historico: eHorarioValido ? [new Date()] : []
      };

      const docRef = await addDoc(collection(db, "alunos"), dadosNovoAluno);
      const novo: Aluno = { 
        id: docRef.id, 
        nome: novoNome, 
        presencas: dadosNovoAluno.presencas, 
        ultimoCheckin: eHorarioValido ? Timestamp.now() : null 
      };

      setAlunos(prev => [...prev, novo].sort((a,b) => a.nome.localeCompare(b.nome)));
      setNovoNome("");
      toast.success("Perfil criado!", { id: toastId });
    } catch (e) { toast.error("Erro ao cadastrar", { id: toastId }); }
  };

  const listaFiltrada = useMemo(() => {
    return alunos.filter(a => a.nome.toLowerCase().includes(busca.toLowerCase()))
      .sort((a, b) => {
        const aFeito = jaMarcouHoje(a.ultimoCheckin);
        const bFeito = jaMarcouHoje(b.ultimoCheckin);
        if (aFeito === bFeito) return a.nome.localeCompare(b.nome);
        return aFeito ? 1 : -1;
      });
  }, [alunos, busca]);

  const progresso = useMemo(() => {
    if (alunos.length === 0) return 0;
    const presentes = alunos.filter(a => jaMarcouHoje(a.ultimoCheckin)).length;
    return (presentes / alunos.length) * 100;
  }, [alunos]);

  if (!mounted) return null;

  return (
    <main className="flex-1 flex flex-col no-scrollbar overflow-y-auto">
      
      {/* INDICADOR VISUAL DE TESTE */}
      {MODO_TESTE && (
        <div className="bg-orange-500 text-white text-[10px] font-black py-1 px-4 text-center uppercase tracking-widest flex items-center justify-center gap-2">
          <Beaker size={12} /> MODO DE TESTE ATIVO
        </div>
      )}

      <header className="sticky top-0 z-40 glass px-6 pt-12 pb-4">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">Check-in Escola Sabatina - JA</h1>
            <p className="text-slate-500 text-[10px] font-bold uppercase tracking-widest mt-0.5">
              {new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })}
            </p>
          </div>
          <Link href="/ranking" className="p-3 bg-slate-100 rounded-2xl hover:bg-indigo-50 text-slate-600 shadow-sm border border-slate-200">
            <Trophy size={22} />
          </Link>
        </div>

        <div className="relative group">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-500 transition-colors" size={18} />
          <input 
            type="text"
            placeholder="Buscar seu nome..."
            className="w-full pl-11 pr-4 py-3.5 bg-slate-100 border-none rounded-2xl text-slate-800 placeholder-slate-400 focus:ring-4 focus:ring-indigo-500/10 focus:bg-white transition-all outline-none font-medium"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
          />
        </div>

        <div className="absolute bottom-0 left-0 h-[2px] bg-slate-100 w-full overflow-hidden">
          <motion.div initial={{ width: 0 }} animate={{ width: `${progresso}%` }} className="h-full bg-gradient-to-r from-indigo-500 to-blue-500" />
        </div>
      </header>

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
                onClick={() => handleCheckinStart(aluno)} 
              />
            ))}
            
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="pt-8">
              <Link href="/dashboard" className="w-full flex items-center justify-between p-5 bg-indigo-600 rounded-[2rem] text-white shadow-lg active:scale-[0.98] transition-all">
                <div className="flex items-center gap-3">
                  <div className="bg-white/20 p-2 rounded-xl"><LayoutDashboard size={20} /></div>
                  <span className="font-bold tracking-tight text-sm">Dashboard Missionário</span>
                </div>
                <ChevronRight size={20} />
              </Link>
            </motion.div>
          </AnimatePresence>
        )}
      </div>

      {/* FAB ADICIONAR */}
      <div className="fixed bottom-8 left-0 right-0 px-6 flex justify-center pointer-events-none">
        <button onClick={() => setIsModalOpen(true)} className="pointer-events-auto bg-slate-900 text-white px-8 py-4 rounded-full shadow-2xl flex items-center gap-3 active:scale-95 transition-transform">
          <Plus size={20} strokeWidth={3} />
          <span className="font-bold text-sm tracking-tight">Não estou na lista</span>
        </button>
      </div>

      {/* MODAL MISSIONÁRIO */}
      <AnimatePresence>
        {isStatsModalOpen && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setIsStatsModalOpen(false)} className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50" />
            <motion.div initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }} className="fixed bottom-0 left-0 right-0 md:w-[480px] bg-white p-8 rounded-t-[2.5rem] shadow-2xl z-50">
              <div className="flex justify-between items-center mb-6">
                <div>
                  <h3 className="text-xl font-bold text-slate-900 tracking-tight">Check-in de {selectedAluno?.nome.split(" ")[0]}</h3>
                  <p className="text-slate-500 text-xs font-bold uppercase">Esta semana você:</p>
                </div>
                <button onClick={() => setIsStatsModalOpen(false)} className="text-slate-400"><X size={24}/></button>
              </div>
              
              <div className="space-y-4 mb-8">
                <StatToggle label="Estudou a lição diariamente?" active={missaoStats.licao} onClick={() => setMissaoStats({...missaoStats, licao: !missaoStats.licao})} />
                <StatToggle label="Participa de Pequeno Grupo (PG)?" active={missaoStats.pg} onClick={() => setMissaoStats({...missaoStats, pg: !missaoStats.pg})} />
                <StatToggle label="Está dando algum Estudo Bíblico?" active={missaoStats.estudo} onClick={() => setMissaoStats({...missaoStats, estudo: !missaoStats.estudo})} />
                <StatToggle label="Realizou Atividade Missionária?" active={missaoStats.missao} onClick={() => setMissaoStats({...missaoStats, missao: !missaoStats.missao})} />
              </div>

              <button onClick={handleFinalizarCheckin} className="w-full bg-indigo-600 text-white py-5 rounded-2xl font-black text-lg shadow-lg active:scale-95 transition-transform">Finalizar Check-in</button>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* MODAL PERFIL */}
      <AnimatePresence>
        {isModalOpen && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setIsModalOpen(false)} className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50" />
            <motion.div initial={{ y: 100 }} animate={{ y: 0 }} exit={{ y: 100 }} className="fixed bottom-6 left-6 right-6 bg-white p-8 rounded-[2.5rem] shadow-2xl z-50">
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-xl font-bold text-slate-900 tracking-tight">Perfil</h3>
                <button onClick={() => setIsModalOpen(false)} className="text-slate-400"><X size={24}/></button>
              </div>
              <input autoFocus placeholder="Nome completo..." className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl p-5 text-lg font-bold outline-none mb-6" value={novoNome} onChange={(e) => setNovoNome(e.target.value)} />
              <button onClick={handleNovoAluno} className="w-full bg-indigo-600 text-white py-5 rounded-2xl font-black text-lg">Criar Perfil</button>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </main>
  );
}

// Sub-componentes
function StatToggle({ label, active, onClick }: { label: string, active: boolean, onClick: () => void }) {
  return (
    <div className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100">
      <span className="text-sm font-bold text-slate-700 pr-2">{label}</span>
      <button onClick={onClick} className={cn("px-4 py-2 rounded-xl text-xs font-black transition-all", active ? "bg-emerald-500 text-white" : "bg-slate-200 text-slate-400")}>
        {active ? "SIM" : "NÃO"}
      </button>
    </div>
  );
}

function StudentCard({ aluno, feito, onClick }: { aluno: Aluno, feito: boolean, onClick: () => void }) {
  const iniciais = aluno.nome.split(" ").map(n => n[0]).join("").substring(0,2).toUpperCase();
  return (
    <motion.button layout onClick={onClick} disabled={feito} className={cn("w-full flex items-center justify-between p-4 rounded-[2rem] border-2 transition-all active:scale-[0.98]", feito ? "bg-white/50 border-emerald-100 opacity-60" : "bg-white border-transparent shadow-sm shadow-slate-200/50 hover:border-indigo-100")}>
      <div className="flex items-center gap-4 text-left">
        <div className={cn("w-12 h-12 rounded-2xl flex items-center justify-center font-bold text-sm", feito ? "bg-emerald-500 text-white" : "bg-indigo-50 text-indigo-500")}>
          {feito ? <Check size={20} strokeWidth={3} /> : iniciais}
        </div>
        <div>
          <h3 className={cn("font-bold tracking-tight text-sm", feito ? "text-slate-400 line-through" : "text-slate-800")}>{aluno.nome}</h3>
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">{feito ? "Confirmado" : `${aluno.presencas} Presenças`}</p>
        </div>
      </div>
      {!feito && <div className="h-8 w-8 rounded-full border-2 border-slate-100 flex items-center justify-center text-slate-300"><Plus size={14} strokeWidth={3} /></div>}
    </motion.button>
  );
}