"use client";

import { useState, useEffect, useMemo } from "react";
import { db } from "@/lib/firebase";
import { 
  collection, addDoc, getDocs, query, updateDoc, doc, 
  increment, serverTimestamp, arrayUnion, Timestamp 
} from "firebase/firestore";
import { Search, Trophy, Check, Plus, X, Loader2, CalendarClock, LayoutDashboard, ChevronRight, Beaker, Users, UserCheck, ArrowLeft, Info, Gift } from "lucide-react";
import toast from "react-hot-toast";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import { cn } from "@/lib/utils";

// CONFIGURAÇÃO DO EVENTO (PROPAGANDA & REGRAS)
const URL_IMAGEM_EVENTO = "/evento.jpg"; 
const EVENTO_TITULO = "Premiação ES Jovens";

const EVENTO_SECOES = [
  {
    tipo: "geral",
    titulo: "Regras Gerais",
    itens: [
      "1. O Vencedor se dará por quantidade de presença.",
      "2. O Check-in só pode ser feito presencialmente na IASDCE.",
      "3. Todo resultado será anunciado via boletim informativo ou aviso JA.",
      "4. O ranking web é para o prêmio Trimestral. O resultado Semestral será informado no dia 20/06."
    ]
  },
  {
    tipo: "secundario",
    titulo: "Prêmio Trimestral",
    itens: [
      "🎁 1 Camisa Jovem IPROMOVE/SIMILLAR"
    ]
  },
  {
    tipo: "principal",
    titulo: "Prêmio Semestral (Together)",
    premios: [
      "🥇 1º - Inscrição completa do Together",
      "🥈 2º - Somente inscrição do Together",
      "🥉 3º - Big Cozinha (ou o valor de R$120)"
    ],
    condicoesTitulo: "Condições Obrigatórias:",
    itens: [
      "• No período informado, o candidato(a) deve ter, sem falta, praticado, pelo menos uma vez, as ações: Missionárias, Estudo da Lição e PG.",
      "• Para critério de desempate, quando coincidir a quantidade de presença, deve ser utilizado 1pt para cada ação. Totalizando novos resultados.",
      "• O Prêmio é transferível, dado que 'o que é meu eu faço o que quiser'.",
      "• Caso o candidato tenha feito a inscrição do evento antes da premiação, será feito pagamento via PIX do valor referente."
    ]
  }
];

// CONFIGURAÇÃO DE CLASSES
const CLASSES_DISPONIVEIS = [
  { id: "jovens", nome: "Classe de Jovens", icon: Users, color: "bg-indigo-600", light: "bg-indigo-50", text: "text-indigo-600" },
  { id: "juvenis", nome: "Classe de Juvenis", icon: UserCheck, color: "bg-emerald-600", light: "bg-emerald-50", text: "text-emerald-600" }
];

const MODO_TESTE = false; 

interface Aluno {
  id: string;
  nome: string;
  presencas: number;
  ultimoCheckin: Timestamp | null;
  classe: string;
}

// GERENCIADOR PRINCIPAL
export default function AppManager() {
  const [classeSelecionada, setClasseSelecionada] = useState<string | null>(null);
  const [verificandoCache, setVerificandoCache] = useState(true);

  useEffect(() => {
    const classeSalva = localStorage.getItem("checkin_classe_pref");
    if (classeSalva) setClasseSelecionada(classeSalva);
    setVerificandoCache(false);
  }, []);

  const handleSelecionarClasse = (id: string) => {
    localStorage.setItem("checkin_classe_pref", id);
    setClasseSelecionada(id);
  };

  const handleTrocarClasse = () => {
    localStorage.removeItem("checkin_classe_pref");
    setClasseSelecionada(null);
  };

  if (verificandoCache) return null; 

  if (!classeSelecionada) {
    return <ClassSelectionScreen onSelect={handleSelecionarClasse} />;
  }

  return (
    <HomePage 
      classeAtual={CLASSES_DISPONIVEIS.find(c => c.id === classeSelecionada)!} 
      onVoltar={handleTrocarClasse} 
    />
  );
}

// TELA DE SELEÇÃO
function ClassSelectionScreen({ onSelect }: { onSelect: (id: string) => void }) {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-6 bg-slate-50 relative overflow-hidden">
      <div className="absolute top-[-10%] right-[-10%] w-64 h-64 bg-indigo-200 rounded-full blur-3xl opacity-30" />
      <div className="w-full max-w-md space-y-8 z-10">
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-black text-slate-900 tracking-tight">Bem-vindo(a)!</h1>
          <p className="text-slate-500 text-lg">Selecione sua classe para continuar</p>
        </div>
        <div className="grid gap-4">
          {CLASSES_DISPONIVEIS.map((classe) => (
            <motion.button
              key={classe.id}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => onSelect(classe.id)}
              className="bg-white p-6 rounded-[2rem] shadow-xl shadow-slate-200/50 border border-slate-100 flex items-center gap-5 group transition-all hover:border-indigo-200"
            >
              <div className={cn("w-16 h-16 rounded-2xl flex items-center justify-center shadow-sm transition-colors", classe.light, classe.text)}>
                <classe.icon size={32} strokeWidth={2.5} />
              </div>
              <div className="text-left">
                <h3 className="text-xl font-bold text-slate-800 group-hover:text-indigo-600 transition-colors">{classe.nome}</h3>
                <p className="text-sm text-slate-400 font-medium">Toque para acessar</p>
              </div>
              <div className="ml-auto text-slate-300 group-hover:translate-x-1 transition-transform"><ChevronRight size={24} /></div>
            </motion.button>
          ))}
        </div>
      </div>
    </main>
  );
}

// TELA DE CHECK-IN
function HomePage({ classeAtual, onVoltar }: { classeAtual: typeof CLASSES_DISPONIVEIS[0], onVoltar: () => void }) {
  const [mounted, setMounted] = useState(false);
  const [alunos, setAlunos] = useState<Aluno[]>([]);
  const [busca, setBusca] = useState("");
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isStatsModalOpen, setIsStatsModalOpen] = useState(false);
  const [isAdModalOpen, setIsAdModalOpen] = useState(false); 
  const [isEventRulesModalOpen, setIsEventRulesModalOpen] = useState(false); 
  
  const [selectedAluno, setSelectedAluno] = useState<Aluno | null>(null);
  const [novoNome, setNovoNome] = useState("");

  const [missaoStats, setMissaoStats] = useState({ licao: false, pg: false, estudo: false, missao: false });
  const [pendingNovoNome, setPendingNovoNome] = useState("");

  // CARREGAMENTO COM FALLBACK PARA CLASSE DE JOVENS
  useEffect(() => {
    setMounted(true);
    async function fetchAlunos() {
      try {
        // 1. Busca TODOS os alunos (sem filtro no banco)
        const q = query(collection(db, "alunos"));
        const snapshot = await getDocs(q);
        
        // 2. Processa os dados tratando campos vazios
        const todosAlunos = snapshot.docs.map(d => {
          const dados = d.data();
          return { 
            id: d.id, 
            ...dados,
            // SE NÃO TIVER CLASSE, ASSUME "JOVENS"
            classe: dados.classe || "jovens" 
          };
        }) as Aluno[];

        // 3. Filtra apenas os da classe atual
        const alunosDaClasse = todosAlunos.filter(a => a.classe === classeAtual.id);
        
        setAlunos(alunosDaClasse.sort((a, b) => a.nome.localeCompare(b.nome)));
      } catch (e) {
        toast.error("Erro ao carregar dados");
      } finally {
        setLoading(false);
      }
    }
    fetchAlunos();
  }, [classeAtual.id]);

  const validarRegrasCheckin = (ultimo: Timestamp | null) => {
    if (MODO_TESTE) return true;
    const agora = new Date();
    const diaSemana = agora.getDay(); 
    const hora = agora.getHours();

    if (diaSemana !== 6) { toast.error("Check-in só aos Sábados.", { id: 'regra-dia' }); return false; }
    if (hora >= 12) { toast.error("Horário encerrado (até 12:00h).", { id: 'regra-hora' }); return false; }
    if (ultimo) {
      const d = ultimo.toDate();
      if (d.getDate() === agora.getDate() && d.getMonth() === agora.getMonth() && d.getFullYear() === agora.getFullYear()) {
        toast("Presença já garantida!", { icon: '✅', id: 'regra-dup' });
        return false;
      }
    }
    return true;
  };

  const jaMarcouHoje = (ultimo: Timestamp | null) => {
    if (MODO_TESTE) return false;
    if (!ultimo) return false;
    const d = ultimo.toDate();
    const agora = new Date();
    return d.getDate() === agora.getDate() && d.getMonth() === agora.getMonth() && d.getFullYear() === agora.getFullYear();
  };

  const handleCheckinStart = (aluno: Aluno) => {
    if (!validarRegrasCheckin(aluno.ultimoCheckin)) return;
    setSelectedAluno(aluno);
    setPendingNovoNome("");
    setMissaoStats({ licao: false, pg: false, estudo: false, missao: false });
    setIsStatsModalOpen(true);
  };

  const handleCancelarCheckin = () => {
    setIsStatsModalOpen(false);
    setSelectedAluno(null);
    setPendingNovoNome("");
  };

  const handleFinalizarCheckin = async () => {
    setIsStatsModalOpen(false);
    const toastId = toast.loading("Salvando...");

    try {
      if (selectedAluno) {
        // Fluxo aluno existente
        await addDoc(collection(db, "estatisticas"), {
          alunoId: selectedAluno.id,
          nome: selectedAluno.nome,
          classe: classeAtual.id,
          data: serverTimestamp(),
          ...missaoStats
        });
        await updateDoc(doc(db, "alunos", selectedAluno.id), {
          presencas: increment(1),
          ultimoCheckin: serverTimestamp(),
          historico: arrayUnion(new Date()),
          classe: classeAtual.id
        });
        setAlunos(prev => prev.map(a =>
          a.id === selectedAluno.id ? { ...a, presencas: a.presencas + 1, ultimoCheckin: Timestamp.now() } : a
        ));
        setSelectedAluno(null);
        toast.success("Check-in realizado!", { id: toastId });

      } else if (pendingNovoNome) {
        // Fluxo novo aluno: cria perfil + salva estatísticas
        const agora = new Date();
        const eHorarioValido = (agora.getDay() === 6 && agora.getHours() < 12) || MODO_TESTE;
        const dados = {
          nome: pendingNovoNome,
          classe: classeAtual.id,
          presencas: eHorarioValido ? 1 : 0,
          ultimoCheckin: eHorarioValido ? serverTimestamp() : null,
          historico: eHorarioValido ? [new Date()] : []
        };
        const docRef = await addDoc(collection(db, "alunos"), dados);
        if (eHorarioValido) {
          await addDoc(collection(db, "estatisticas"), {
            alunoId: docRef.id,
            nome: pendingNovoNome,
            classe: classeAtual.id,
            data: serverTimestamp(),
            ...missaoStats
          });
        }
        const novo: Aluno = {
          id: docRef.id,
          nome: pendingNovoNome,
          classe: classeAtual.id,
          presencas: dados.presencas,
          ultimoCheckin: eHorarioValido ? Timestamp.now() : null
        };
        setAlunos(prev => [...prev, novo].sort((a, b) => a.nome.localeCompare(b.nome)));
        setPendingNovoNome("");
        toast.success(`Bem-vindo(a) à ${classeAtual.nome}!`, { id: toastId });
      }

      setTimeout(() => setIsAdModalOpen(true), 300);

    } catch (e) {
      toast.error("Erro ao salvar", { id: toastId });
      setPendingNovoNome("");
    }
  };

  const handleNovoAluno = () => {
    if (!novoNome.trim()) return;
    setPendingNovoNome(novoNome.trim());
    setNovoNome("");
    setIsModalOpen(false);
    setMissaoStats({ licao: false, pg: false, estudo: false, missao: false });
    setIsStatsModalOpen(true);
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
      {MODO_TESTE && (
        <div className="bg-orange-500 text-white text-[10px] font-black py-1 px-4 text-center uppercase tracking-widest flex items-center justify-center gap-2">
          <Beaker size={12} /> MODO TESTE
        </div>
      )}
      <header className="sticky top-0 z-40 glass px-6 pt-12 pb-4">
        <div className="flex justify-between items-start mb-6">
          <div className="flex flex-col">
            <button onClick={onVoltar} className="flex items-center gap-1 text-slate-400 text-xs font-bold uppercase tracking-wider mb-2 hover:text-indigo-600 transition-colors">
              <ArrowLeft size={14} /> Trocar Classe
            </button>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 leading-tight">{classeAtual.nome}</h1>
            <p className="text-slate-500 text-[10px] font-bold uppercase tracking-widest mt-1">
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
            placeholder={`Buscar em ${classeAtual.nome}...`}
            className="w-full pl-11 pr-4 py-3.5 bg-slate-100 border-none rounded-2xl text-slate-800 placeholder-slate-400 focus:ring-4 focus:ring-indigo-500/10 focus:bg-white transition-all outline-none font-medium"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
          />
        </div>
        <div className="absolute bottom-0 left-0 h-[2px] bg-slate-100 w-full overflow-hidden">
          <motion.div initial={{ width: 0 }} animate={{ width: `${progresso}%` }} className="h-full bg-gradient-to-r from-indigo-500 to-blue-500" />
        </div>
      </header>

      {listaFiltrada.length === 0 && !loading && (
        <div className="flex flex-col items-center justify-center py-20 px-6 text-center opacity-60">
          <div className={cn("w-20 h-20 rounded-full flex items-center justify-center mb-4", classeAtual.light, classeAtual.text)}>
            <classeAtual.icon size={40} />
          </div>
          <p className="text-slate-500 font-medium">Nenhum aluno encontrado.</p>
          <p className="text-xs text-slate-400 mt-1">Alunos antigos aparecerão na Classe de Jovens.</p>
        </div>
      )}

      <div className="px-5 py-6 space-y-3 pb-32">
        {loading ? (
          <div className="flex justify-center py-20"><Loader2 className="animate-spin text-slate-300" size={32} /></div>
        ) : (
          <AnimatePresence mode="popLayout">
            {listaFiltrada.map((aluno) => (
              <StudentCard key={aluno.id} aluno={aluno} feito={jaMarcouHoje(aluno.ultimoCheckin)} onClick={() => handleCheckinStart(aluno)} />
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

      <div className="fixed bottom-8 left-0 right-0 px-6 flex justify-center pointer-events-none">
        <button onClick={() => setIsModalOpen(true)} className="pointer-events-auto bg-slate-900 text-white px-8 py-4 rounded-full shadow-2xl flex items-center gap-3 active:scale-95 transition-transform">
          <Plus size={20} strokeWidth={3} />
          <span className="font-bold text-sm tracking-tight">Não estou na lista</span>
        </button>
      </div>

      {/* MODAL 1: PERGUNTAS MISSIONÁRIAS */}
      <AnimatePresence>
        {isStatsModalOpen && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={handleCancelarCheckin} className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50" />
            <motion.div initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }} className="fixed bottom-0 left-0 right-0 md:w-[480px] bg-white p-8 rounded-t-[2.5rem] shadow-2xl z-50">
              <div className="flex justify-between items-center mb-6">
                <div>
                  <h3 className="text-xl font-bold text-slate-900 tracking-tight">
                    Check-in: {(selectedAluno?.nome || pendingNovoNome).split(" ")[0]}
                  </h3>
                  <p className="text-slate-500 text-xs font-bold uppercase">Termômetro Missionário</p>
                </div>
                <button onClick={handleCancelarCheckin} className="text-slate-400"><X size={24}/></button>
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

      {/* MODAL 2: CRIAÇÃO DE PERFIL */}
      <AnimatePresence>
        {isModalOpen && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setIsModalOpen(false)} className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50" />
            <motion.div initial={{ y: 100 }} animate={{ y: 0 }} exit={{ y: 100 }} className="fixed bottom-6 left-6 right-6 bg-white p-8 rounded-[2.5rem] shadow-2xl z-50">
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-xl font-bold text-slate-900 tracking-tight">Adicionando na lista</h3>
                <button onClick={() => setIsModalOpen(false)} className="text-slate-400"><X size={24}/></button>
              </div>
              <input autoFocus placeholder="Nome ou Apelido" className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl p-5 text-lg font-bold outline-none mb-6" value={novoNome} onChange={(e) => setNovoNome(e.target.value)} onKeyDown={(e) => e.key === "Enter" && handleNovoAluno()} />
              <button onClick={handleNovoAluno} className="w-full bg-indigo-600 text-white py-5 rounded-2xl font-black text-lg flex items-center justify-center gap-2">
                Continuar <ChevronRight size={20} strokeWidth={3} />
              </button>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* MODAL 3: PROPAGANDA/EVENTO */}
      <AnimatePresence>
        {isAdModalOpen && (
          <>
            <motion.div 
              initial={{ opacity: 0 }} 
              animate={{ opacity: 1 }} 
              exit={{ opacity: 0 }} 
              onClick={() => setIsAdModalOpen(false)} 
              className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm z-[60]" 
            />
            <motion.div 
              initial={{ scale: 0.9, opacity: 0, y: "-50%", x: "-50%" }} 
              animate={{ scale: 1, opacity: 1, y: "-50%", x: "-50%" }} 
              exit={{ scale: 0.95, opacity: 0, y: "-50%", x: "-50%" }} 
              className="fixed top-1/2 left-1/2 z-[60] w-[90%] max-w-sm flex flex-col items-center gap-4"
            >
              <div className="relative w-full bg-transparent rounded-3xl overflow-hidden shadow-2xl">
                <button 
                  onClick={() => setIsAdModalOpen(false)} 
                  className="absolute top-3 right-3 bg-black/60 backdrop-blur-md text-white p-2 rounded-full hover:bg-black/80 transition-colors z-10"
                >
                  <X size={20} strokeWidth={3} />
                </button>
                <img 
                  src={URL_IMAGEM_EVENTO} 
                  alt="Aviso do Evento" 
                  className="w-full h-auto object-contain max-h-[70vh] rounded-3xl pointer-events-none bg-white" 
                />
              </div>
              
              {/* BOTÃO SAIBA MAIS */}
              <button 
                onClick={() => {
                  setIsAdModalOpen(false);
                  setIsEventRulesModalOpen(true);
                }} 
                className="w-full bg-indigo-600 text-white py-4 rounded-3xl font-black text-lg shadow-xl shadow-indigo-900/20 active:scale-95 transition-transform flex items-center justify-center gap-2"
              >
                <Info size={22} />
                Clica aqui, vai!
              </button>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* MODAL 4: REGRAS DO EVENTO */}
      <AnimatePresence>
        {isEventRulesModalOpen && (
          <>
            <motion.div 
              initial={{ opacity: 0 }} 
              animate={{ opacity: 1 }} 
              exit={{ opacity: 0 }} 
              onClick={() => setIsEventRulesModalOpen(false)} 
              className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm z-[70]" 
            />
            <motion.div 
              initial={{ y: 100, opacity: 0 }} 
              animate={{ y: 0, opacity: 1 }} 
              exit={{ y: 100, opacity: 0 }} 
              className="fixed bottom-6 left-6 right-6 md:left-auto md:right-auto md:w-[480px] md:bottom-auto md:top-1/2 md:-translate-y-1/2 md:translate-x-1/2 bg-white p-8 rounded-[2.5rem] shadow-2xl z-[70] max-h-[85vh] flex flex-col"
            >
              <div className="flex justify-between items-start mb-6 shrink-0">
                <div className="flex items-center gap-3">
                  <div className="bg-orange-100 p-3 rounded-2xl text-orange-600"><Gift size={24} /></div>
                  <div>
                    <h3 className="text-xl font-black text-slate-900 tracking-tight leading-tight">{EVENTO_TITULO}</h3>
                    <p className="text-slate-500 text-[10px] font-bold uppercase tracking-widest mt-1">Regras & Requisitos</p>
                  </div>
                </div>
                <button onClick={() => setIsEventRulesModalOpen(false)} className="text-slate-400 bg-slate-100 p-2 rounded-full hover:bg-slate-200 transition-colors"><X size={20}/></button>
              </div>
              
              {/* ÁREA DE SCROLL COM AS SEÇÕES ESTRUTURADAS */}
              <div className="overflow-y-auto no-scrollbar space-y-4 mb-6 flex-1 pr-1">
                {EVENTO_SECOES.map((secao, idx) => (
                  <div key={idx} className={cn(
                    "p-5 rounded-[1.5rem] border",
                    secao.tipo === 'geral' ? "bg-slate-50 border-slate-200" :
                    secao.tipo === 'secundario' ? "bg-indigo-50 border-indigo-100" :
                    "bg-emerald-50 border-emerald-200 shadow-sm"
                  )}>
                    {/* Título da Seção */}
                    <h4 className={cn(
                      "font-black text-[11px] uppercase tracking-widest mb-3",
                      secao.tipo === 'geral' ? "text-slate-500" :
                      secao.tipo === 'secundario' ? "text-indigo-600" :
                      "text-emerald-700 flex items-center gap-1"
                    )}>
                      {secao.tipo === 'principal' && <Trophy size={14} />} {secao.titulo}
                    </h4>

                    {/* Prêmios (Se houver) */}
                    {secao.premios && (
                      <div className="mb-4 space-y-2">
                        {secao.premios.map((premio, i) => (
                          <div key={i} className="font-bold text-slate-800 text-sm bg-white/60 p-2 rounded-xl border border-emerald-100/50">
                            {premio}
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Condições Título (Se houver) */}
                    {secao.condicoesTitulo && (
                      <h5 className="font-bold text-[10px] text-emerald-600/80 mb-2 uppercase tracking-wider">
                        {secao.condicoesTitulo}
                      </h5>
                    )}

                    {/* Itens/Regras */}
                    <div className="space-y-2.5">
                      {secao.itens.map((item, i) => (
                        <p key={i} className={cn(
                          "text-sm font-medium leading-relaxed",
                          secao.tipo === 'geral' ? "text-slate-600" : "text-slate-700"
                        )}>
                          {item}
                        </p>
                      ))}
                    </div>
                  </div>
                ))}
              </div>

              <button onClick={() => setIsEventRulesModalOpen(false)} className="w-full bg-slate-900 text-white py-4 rounded-2xl font-black text-lg active:scale-95 transition-transform shrink-0">
                Entendi as Regras!
              </button>
            </motion.div>
          </>
        )}
      </AnimatePresence>

    </main>
  );
}

// SUB-COMPONENTES
function StatToggle({ label, active, onClick }: { label: string, active: boolean, onClick: () => void }) {
  return (
    <div className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100">
      <span className="text-sm font-bold text-slate-700 pr-2">{label}</span>
      <button onClick={onClick} className={cn("px-4 py-2 rounded-xl text-xs font-black transition-all", active ? "bg-emerald-500 text-white" : "bg-slate-200 text-slate-400")}>{active ? "SIM" : "NÃO"}</button>
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