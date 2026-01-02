"use client";

import { useState, useEffect, useMemo } from "react";
import { db } from "@/lib/firebase";
import { collection, getDocs, query, Timestamp } from "firebase/firestore";
import { ArrowLeft, BookOpen, Users, GraduationCap, Flame, CalendarDays, ChevronRight, History } from "lucide-react";
import Link from "next/link";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

interface Estatistica {
  licao: boolean;
  pg: boolean;
  estudo: boolean;
  missao: boolean;
  data: Timestamp;
}

export default function Dashboard() {
  const [data, setData] = useState<Estatistica[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      try {
        const q = query(collection(db, "estatisticas"));
        const snapshot = await getDocs(q);
        const docs = snapshot.docs.map(d => d.data() as Estatistica);
        setData(docs);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  // --- LÓGICA DE AGRUPAMENTO COMPLETA ---
  const statsAgrupadas = useMemo(() => {
    const agora = new Date();
    const mesesMap: { [key: string]: any } = {};
    
    // Dados da Semana Atual (Apenas para o destaque do topo)
    const statsSemana = { licao: 0, pg: 0, estudo: 0, missao: 0, total: 0 };

    const getWeekNumber = (date: Date) => {
      const firstDay = new Date(date.getFullYear(), 0, 1);
      const pastDays = (date.getTime() - firstDay.getTime()) / 86400000;
      return Math.ceil((pastDays + firstDay.getDay() + 1) / 7);
    };

    data.forEach(item => {
      const d = item.data.toDate();
      const mesKey = `${d.getFullYear()}-${d.getMonth()}`; // Chave única por Mês/Ano
      const nomeMes = d.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });

      // Inicializa o mês no mapa se não existir
      if (!mesesMap[mesKey]) {
        mesesMap[mesKey] = { 
          nome: nomeMes, 
          licao: 0, pg: 0, estudo: 0, missao: 0, total: 0,
          timestamp: d.getTime() 
        };
      }

      // Incrementa Estatísticas do Mês
      mesesMap[mesKey].total++;
      if (item.licao) mesesMap[mesKey].licao++;
      if (item.pg) mesesMap[mesKey].pg++;
      if (item.estudo) mesesMap[mesKey].estudo++;
      if (item.missao) mesesMap[mesKey].missao++;

      // Incrementa Semana Atual
      if (getWeekNumber(d) === getWeekNumber(agora) && d.getFullYear() === agora.getFullYear()) {
        statsSemana.total++;
        if (item.licao) statsSemana.licao++;
        if (item.pg) statsSemana.pg++;
        if (item.estudo) statsSemana.estudo++;
        if (item.missao) statsSemana.missao++;
      }
    });

    // Converte o mapa em array ordenado pelo mais recente
    const historicoMensal = Object.values(mesesMap).sort((a, b) => b.timestamp - a.timestamp);

    return { statsSemana, historicoMensal };
  }, [data]);

  return (
    <main className="flex-1 flex flex-col no-scrollbar overflow-y-auto bg-slate-50">
      <header className="sticky top-0 z-40 glass px-6 pt-12 pb-6 flex items-center gap-4">
        <Link href="/" className="p-2 -ml-2 rounded-full hover:bg-slate-100 text-slate-600 transition-all active:scale-90">
          <ArrowLeft size={24} />
        </Link>
        <h1 className="text-xl font-bold text-slate-900 tracking-tight">Dashboard Missionário</h1>
      </header>

      <div className="p-6 space-y-8 pb-20">
        {loading ? (
          <div className="flex flex-col items-center py-20 gap-4">
            <div className="w-10 h-10 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
            <p className="text-slate-400 font-bold animate-pulse">Agrupando Histórico...</p>
          </div>
        ) : (
          <>
            {/* 1. DESTAQUE: SEMANA ATUAL */}
            <section>
              <SectionTitle title="Nesta Semana" icon={<Flame className="text-orange-500" size={16} />} />
              <div className="grid grid-cols-2 gap-4">
                <StatCard label="Lição" value={statsAgrupadas.statsSemana.licao} total={statsAgrupadas.statsSemana.total} icon={<BookOpen size={20}/>} color="bg-blue-500" />
                <StatCard label="Pequeno Grupo" value={statsAgrupadas.statsSemana.pg} total={statsAgrupadas.statsSemana.total} icon={<Users size={20}/>} color="bg-emerald-500" />
                <StatCard label="Dando Estudo" value={statsAgrupadas.statsSemana.estudo} total={statsAgrupadas.statsSemana.total} icon={<GraduationCap size={20}/>} color="bg-indigo-500" />
                <StatCard label="Ativ. Missão" value={statsAgrupadas.statsSemana.missao} total={statsAgrupadas.statsSemana.total} icon={<CalendarDays size={20}/>} color="bg-violet-500" />
              </div>
            </section>

            {/* 2. HISTÓRICO COMPLETO POR MÊS */}
            <section>
              <SectionTitle title="Histórico Mensal" icon={<History className="text-indigo-500" size={16} />} />
              <div className="space-y-6">
                {statsAgrupadas.historicoMensal.length > 0 ? (
                  statsAgrupadas.historicoMensal.map((mes: any, idx: number) => (
                    <motion.div 
                      initial={{ opacity: 0, y: 20 }}
                      whileInView={{ opacity: 1, y: 0 }}
                      viewport={{ once: true }}
                      transition={{ delay: idx * 0.1 }}
                      key={mes.nome} 
                      className="bg-white rounded-[2.5rem] p-6 shadow-sm border border-slate-100 space-y-5"
                    >
                      <div className="flex justify-between items-center mb-2">
                        <h3 className="font-black text-slate-800 capitalize">{mes.nome}</h3>
                        <span className="text-[10px] font-black bg-slate-100 text-slate-400 px-3 py-1 rounded-full uppercase tracking-tighter">
                          {mes.total} Check-ins
                        </span>
                      </div>
                      
                      <div className="space-y-4">
                        <MonthRow label="Lição Diária" current={mes.licao} total={mes.total} color="bg-blue-500" />
                        <MonthRow label="Participação PG" current={mes.pg} total={mes.total} color="bg-emerald-500" />
                        <MonthRow label="Estudos Bíblicos" current={mes.estudo} total={mes.total} color="bg-indigo-500" />
                        <MonthRow label="Ações Missionárias" current={mes.missao} total={mes.total} color="bg-violet-500" />
                      </div>
                    </motion.div>
                  ))
                ) : (
                  <div className="text-center py-10 bg-white rounded-[2.5rem] border border-dashed border-slate-200">
                    <p className="text-slate-400 font-medium">Ainda não há dados históricos.</p>
                  </div>
                )}
              </div>
            </section>
          </>
        )}
      </div>
    </main>
  );
}

// --- SUB-COMPONENTES ---

function SectionTitle({ title, icon }: { title: string, icon: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2 mb-4 ml-2">
      {icon}
      <h2 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">{title}</h2>
    </div>
  );
}

function StatCard({ label, value, total, icon, color }: any) {
  const percent = total > 0 ? Math.round((value / total) * 100) : 0;
  return (
    <div className="bg-white p-5 rounded-[2rem] shadow-sm border border-slate-100 flex flex-col gap-4">
      <div className={cn("w-10 h-10 rounded-2xl flex items-center justify-center text-white shadow-lg", color)}>{icon}</div>
      <div>
        <p className="text-[10px] font-black uppercase text-slate-400 tracking-tight leading-none mb-1">{label}</p>
        <h4 className="text-xl font-black text-slate-900">{value} <span className="text-[10px] text-slate-300 font-bold">/ {total}</span></h4>
        <div className="flex items-center gap-1 mt-1">
          <div className="h-1 w-8 bg-slate-100 rounded-full overflow-hidden">
             <div className={cn("h-full", color)} style={{ width: `${percent}%` }} />
          </div>
          <span className="text-[9px] font-bold text-slate-400">{percent}%</span>
        </div>
      </div>
    </div>
  );
}

function MonthRow({ label, current, total, color }: any) {
  const percent = total > 0 ? (current / total) * 100 : 0;
  return (
    <div className="space-y-1.5">
      <div className="flex justify-between items-end px-1">
        <span className="text-[11px] font-bold text-slate-500">{label}</span>
        <span className="text-[10px] font-black text-slate-900">{Math.round(percent)}%</span>
      </div>
      <div className="h-2 w-full bg-slate-50 rounded-full overflow-hidden">
        <motion.div 
          initial={{ width: 0 }}
          whileInView={{ width: `${percent}%` }}
          viewport={{ once: true }}
          transition={{ duration: 1, ease: "easeOut" }}
          className={cn("h-full rounded-full", color)} 
        />
      </div>
    </div>
  );
}