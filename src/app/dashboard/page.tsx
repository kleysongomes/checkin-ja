"use client";

import { useState, useEffect, useMemo } from "react";
import { db } from "@/lib/firebase";
import { collection, getDocs, query, Timestamp } from "firebase/firestore";
import { ArrowLeft, BookOpen, Users, GraduationCap, Flame, CalendarDays, History, FileText, Loader2, X, Calendar, Lock } from "lucide-react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import toast from "react-hot-toast";

// SENHA DE ACESSO AO RELATÓRIO
const SENHA_RELATORIO = "jovens1997@";

interface Estatistica {
  alunoId: string;
  nome: string;
  licao: boolean;
  pg: boolean;
  estudo: boolean;
  missao: boolean;
  classe: string;
  data: Timestamp;
}

interface Aluno {
  id: string;
  nome: string;
  presencas: number;
  historico: Timestamp[];
  classe: string;
}

type ReportType = 'semanal' | 'anual';

export default function Dashboard() {
  const [data, setData] = useState<Estatistica[]>([]);
  const [loading, setLoading] = useState(true);
  const [classeNome, setClasseNome] = useState("");
  const [classeId, setClasseId] = useState("");
  
  // Estados para Relatório e Autenticação
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [passwordInput, setPasswordInput] = useState("");
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
  
  const [reportDate, setReportDate] = useState(new Date().toISOString().split('T')[0]);
  const [reportType, setReportType] = useState<ReportType>('semanal');
  const [generatingPdf, setGeneratingPdf] = useState(false);

  useEffect(() => {
    const storedId = localStorage.getItem("checkin_classe_pref");
    if (!storedId) { window.location.href = "/"; return; }
    
    setClasseId(storedId);
    setClasseNome(storedId === 'jovens' ? 'Classe de Jovens' : 'Classe de Juvenis');

    async function fetchData() {
      try {
        const q = query(collection(db, "estatisticas"));
        const snapshot = await getDocs(q);
        const docs = snapshot.docs.map(d => {
          const dados = d.data();
          // Fallback para dados antigos sem classe
          return { ...dados, classe: dados.classe || "jovens" } as Estatistica;
        });
        setData(docs.filter(item => item.classe === storedId));
      } catch (e) { console.error(e); } finally { setLoading(false); }
    }
    fetchData();
  }, []);

  //LÓGICA DE AUTENTICAÇÃO
  const handleVerifyPassword = () => {
    if (passwordInput === SENHA_RELATORIO) {
      toast.success("Acesso autorizado!");
      setIsAuthModalOpen(false);
      setPasswordInput("");
      setIsReportModalOpen(true);
    } else {
      toast.error("Senha incorreta");
      setPasswordInput("");
    }
  };

  //LÓGICA DO DASHBOARD (VISUAL)
  const statsAgrupadas = useMemo(() => {
    const agora = new Date();
    const mesesMap: { [key: string]: any } = {};
    const statsSemana = { licao: 0, pg: 0, estudo: 0, missao: 0, total: 0 };

    const getWeekNumber = (date: Date) => {
      const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
      const dayNum = d.getUTCDay() || 7;
      d.setUTCDate(d.getUTCDate() + 4 - dayNum);
      const yearStart = new Date(Date.UTC(d.getUTCFullYear(),0,1));
      return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1)/7);
    };

    data.forEach(item => {
      const d = item.data.toDate();
      const mesKey = `${d.getFullYear()}-${d.getMonth()}`;
      const nomeMes = d.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });

      if (!mesesMap[mesKey]) mesesMap[mesKey] = { nome: nomeMes, licao: 0, pg: 0, estudo: 0, missao: 0, total: 0, timestamp: d.getTime() };

      mesesMap[mesKey].total++;
      if (item.licao) mesesMap[mesKey].licao++;
      if (item.pg) mesesMap[mesKey].pg++;
      if (item.estudo) mesesMap[mesKey].estudo++;
      if (item.missao) mesesMap[mesKey].missao++;

      if (getWeekNumber(d) === getWeekNumber(agora) && d.getFullYear() === agora.getFullYear()) {
        statsSemana.total++;
        if (item.licao) statsSemana.licao++;
        if (item.pg) statsSemana.pg++;
        if (item.estudo) statsSemana.estudo++;
        if (item.missao) statsSemana.missao++;
      }
    });

    return { statsSemana, historicoMensal: Object.values(mesesMap).sort((a:any, b:any) => b.timestamp - a.timestamp) };
  }, [data]);

  //GERADOR DE PDF
  const handleGeneratePDF = async () => {
    setGeneratingPdf(true);
    try {
      // 1. CORREÇÃO DE DATA (FUSO HORÁRIO)
      const [anoStr, mesStr, diaStr] = reportDate.split('-').map(Number);
      const refDate = new Date(anoStr, mesStr - 1, diaStr, 12, 0, 0); 
      
      const anoRef = refDate.getFullYear();
      const mesRef = refDate.getMonth();

      const getWeekNumber = (date: Date) => {
        const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
        const dayNum = d.getUTCDay() || 7;
        d.setUTCDate(d.getUTCDate() + 4 - dayNum);
        const yearStart = new Date(Date.UTC(d.getUTCFullYear(),0,1));
        return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1)/7);
      };
      
      const semanaRef = getWeekNumber(refDate);

      // 2. BUSCAR DADOS
      const qAlunos = query(collection(db, "alunos"));
      const snapAlunos = await getDocs(qAlunos);
      const alunosRaw = snapAlunos.docs.map(d => ({ id: d.id, ...d.data(), classe: d.data().classe || "jovens" })) as Aluno[];
      const alunosDaClasse = alunosRaw.filter(a => a.classe === classeId).sort((a,b) => a.nome.localeCompare(b.nome));

      // 3. FILTRAR DADOS
      let statsFiltradas: Estatistica[] = [];
      let sabadosEsperados = 0;
      let tituloRelatorio = "";
      let subTitulo = "";

      if (reportType === 'semanal') {
        tituloRelatorio = "Relatório Semanal de Inteligência";
        subTitulo = `Semana ${semanaRef} - ${refDate.toLocaleDateString('pt-BR', { day: 'numeric', month: 'long', year: 'numeric' })}`;
        
        statsFiltradas = data.filter(stat => {
          const d = stat.data.toDate();
          return getWeekNumber(d) === semanaRef && d.getFullYear() === anoRef;
        });

        // Sábados no mês (Lógica Mensal)
        const ultimoDiaDoMes = new Date(anoRef, mesRef + 1, 0).getDate();
        const hoje = new Date();
        for (let dia = 1; dia <= ultimoDiaDoMes; dia++) {
          const currentDay = new Date(anoRef, mesRef, dia);
          if (currentDay.getDay() === 6) {
             if (anoRef < hoje.getFullYear() || (anoRef === hoje.getFullYear() && mesRef < hoje.getMonth())) {
               sabadosEsperados++; 
             } else if (currentDay <= hoje) {
               sabadosEsperados++; 
             }
          }
        }
      } else {
        // Anual
        tituloRelatorio = "Relatório Anual Consolidado";
        subTitulo = `Exercício de ${anoRef}`;
        statsFiltradas = data.filter(stat => stat.data.toDate().getFullYear() === anoRef);
        const hoje = new Date();
        const dataFinal = (anoRef === hoje.getFullYear()) ? hoje : new Date(anoRef, 11, 31);
        let diaLoop = new Date(anoRef, 0, 1);
        while (diaLoop <= dataFinal) {
          if (diaLoop.getDay() === 6) sabadosEsperados++;
          diaLoop.setDate(diaLoop.getDate() + 1);
        }
      }

      // 4. DETALHAMENTO DE ALUNOS
      const dadosDetalhados = alunosDaClasse.map(aluno => {
        const statSemana = reportType === 'semanal' ? statsFiltradas.find(s => s.alunoId === aluno.id) : null;
        
        const presencasPeriodo = aluno.historico?.filter(ts => {
          const data = ts.toDate();
          if (reportType === 'semanal') {
            return data.getMonth() === mesRef && data.getFullYear() === anoRef;
          } else {
            return data.getFullYear() === anoRef;
          }
        }).length || 0;

        const faltas = Math.max(0, sabadosEsperados - presencasPeriodo);
        const frequenciaPerc = sabadosEsperados > 0 ? (presencasPeriodo / sabadosEsperados) * 100 : 0;

        return {
          nome: aluno.nome,
          licao: statSemana?.licao ? "SIM" : "NÃO",
          pg: statSemana?.pg ? "SIM" : "NÃO",
          estudo: statSemana?.estudo ? "SIM" : "NÃO",
          missao: statSemana?.missao ? "SIM" : "NÃO",
          presenteNaSemana: !!statSemana,
          presencasPeriodo,
          presencasTotal: aluno.presencas,
          faltas,
          frequenciaPerc
        };
      });

      // Insights e Ranking
      const top10 = [...dadosDetalhados].sort((a,b) => b.presencasTotal - a.presencasTotal).slice(0, 10);
      const totalRegistros = statsFiltradas.length;
      const totais = statsFiltradas.reduce((acc, curr) => ({
        Licao: acc.Licao + (curr.licao ? 1 : 0),
        PG: acc.PG + (curr.pg ? 1 : 0),
        Estudo: acc.Estudo + (curr.estudo ? 1 : 0),
        Missao: acc.Missao + (curr.missao ? 1 : 0)
      }), { Licao: 0, PG: 0, Estudo: 0, Missao: 0 });

      const analiseOrdenada = Object.entries(totais).sort(([,a], [,b]) => b - a);
      const pontoForte = totalRegistros > 0 ? analiseOrdenada[0] : ["Nenhum", 0];
      const pontoFraco = totalRegistros > 0 ? analiseOrdenada[3] : ["Nenhum", 0];
      const percForte = totalRegistros > 0 ? Math.round((Number(pontoForte[1]) / totalRegistros) * 100) : 0;
      const percFraco = totalRegistros > 0 ? Math.round((Number(pontoFraco[1]) / totalRegistros) * 100) : 0;

      // 5. CONSTRUÇÃO DO PDF
      const doc = new jsPDF();
      const pageWidth = doc.internal.pageSize.width;
      const primaryColor = reportType === 'semanal' ? "#4f46e5" : "#0f172a";

      // HEADER
      doc.setFillColor(primaryColor);
      doc.rect(0, 0, pageWidth, 45, "F");
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(24);
      doc.setFont("helvetica", "bold");
      doc.text(tituloRelatorio, 14, 20);
      doc.setFontSize(12);
      doc.setFont("helvetica", "normal");
      doc.text(`${classeNome} | JA Escola Sabatina`, 14, 30);
      doc.setFontSize(10);
      doc.text(subTitulo, 14, 38);

      let finalY = 55;

      // SEÇÃO 1: INSIGHTS
      doc.setTextColor(0, 0, 0);
      doc.setFontSize(14);
      doc.setFont("helvetica", "bold");
      doc.text("1. Análise de Dados", 14, finalY);

      doc.setDrawColor(200);
      doc.setFillColor(245, 245, 255);
      doc.roundedRect(14, finalY + 5, pageWidth - 28, 25, 3, 3, "F");
      
      doc.setFontSize(10);
      doc.setTextColor(60);
      doc.text("MAIOR ADESÃO", 20, finalY + 14);
      doc.text("MENOR ADESÃO", pageWidth / 2 + 10, finalY + 14);

      doc.setFontSize(14);
      doc.setTextColor(22, 163, 74); 
      doc.setFont("helvetica", "bold");
      doc.text(`${pontoForte[0]} (${percForte}%)`, 20, finalY + 22);

      doc.setTextColor(220, 38, 38); 
      doc.text(`${pontoFraco[0]} (${percFraco}%)`, pageWidth / 2 + 10, finalY + 22);

      finalY += 40;

      // SEÇÃO 2: TOP 10
      doc.setTextColor(0, 0, 0);
      doc.text("2. Ranking de Assiduidade (Top 10)", 14, finalY);
      autoTable(doc, {
        startY: finalY + 5,
        head: [['#', 'Nome', 'Presenças Acumuladas']],
        body: top10.map((r, i) => [i + 1, r.nome, r.presencasTotal]),
        theme: 'striped',
        headStyles: { fillColor: primaryColor },
        columnStyles: { 0: { cellWidth: 20, halign: 'center' }, 2: { halign: 'center', fontStyle: 'bold' } }
      });

      finalY = (doc as any).lastAutoTable.finalY + 15;

      // SEÇÃO 3: DETALHAMENTO (CONDICIONAL)
      if (reportType === 'semanal') {
        doc.text("3. Matriz de Respostas (Semana)", 14, finalY);
        autoTable(doc, {
          startY: finalY + 5,
          head: [['Nome', 'Lição', 'PG', 'Estudo', 'Missão']],
          body: dadosDetalhados.map(d => {
            if (!d.presenteNaSemana) return [d.nome, '-', '-', '-', '-'];
            return [d.nome, d.licao, d.pg, d.estudo, d.missao];
          }),
          theme: 'grid',
          headStyles: { fillColor: [100, 100, 100] },
          styles: { fontSize: 9 },
          didParseCell: function(data) {
            // CORREÇÃO TYPESCRIPT: (data.row.raw as any)
            if (data.section === 'body' && (data.row.raw as any)[1] === '-') {
              data.cell.styles.textColor = [180, 180, 180];
            }
          }
        });
      } else {
        // Anual: Performance Mensal
        doc.text("3. Performance Mensal (Visão Macro)", 14, finalY);
        const performanceMensal = statsAgrupadas.historicoMensal.filter((h:any) => new Date(h.timestamp).getFullYear() === anoRef);
        autoTable(doc, {
          startY: finalY + 5,
          head: [['Mês', 'Total Check-ins', 'Lição (%)', 'PG (%)', 'Missão (%)']],
          body: performanceMensal.map((m: any) => [
            m.nome,
            m.total,
            Math.round((m.licao / m.total) * 100) + '%',
            Math.round((m.pg / m.total) * 100) + '%',
            Math.round((m.missao / m.total) * 100) + '%'
          ]),
          theme: 'striped',
          headStyles: { fillColor: [15, 23, 42] }
        });
      }

      finalY = (doc as any).lastAutoTable.finalY + 15;

      // SEÇÃO 4: FREQUÊNCIA
      if (finalY > 200) { doc.addPage(); finalY = 20; }
      const labelPeriodo = reportType === 'semanal' 
        ? `Mensal (${refDate.toLocaleDateString('pt-BR', { month: 'long' })})` 
        : `Anual (${anoRef})`;
      
      doc.setFontSize(14);
      doc.text(`4. Controle de Frequência ${labelPeriodo}`, 14, finalY);
      doc.setFontSize(10);
      doc.setTextColor(100);
      doc.text(`Total de Sábados computados no período: ${sabadosEsperados}`, 14, finalY + 5);
      
      autoTable(doc, {
        startY: finalY + 10,
        head: [['Nome', 'Presenças', reportType === 'semanal' ? 'Faltas' : 'Freq. %', 'Status']],
        body: dadosDetalhados.map(a => {
          let status = "Regular";
          if (reportType === 'semanal') {
            if (a.faltas === 0) status = "Excelente";
            else if (a.faltas >= 3) status = "CRÍTICO";
            else if (a.faltas >= 2) status = "ATENÇÃO";
            return [a.nome, a.presencasPeriodo, a.faltas, status];
          } else {
            const perc = Math.round(a.frequenciaPerc);
            if (perc >= 85) status = "Excelente";
            else if (perc < 50) status = "CRÍTICO";
            else if (perc < 75) status = "ATENÇÃO";
            return [a.nome, a.presencasPeriodo, `${perc}%`, status];
          }
        }),
        headStyles: { fillColor: reportType === 'semanal' ? [185, 28, 28] : [15, 23, 42] },
        didParseCell: function(data) {
          if (data.section === 'body' && data.column.index === 3) {
             const statusVal = data.cell.raw as string; // CORREÇÃO TYPESCRIPT
             if (statusVal === 'CRÍTICO') { data.cell.styles.textColor = [220, 38, 38]; data.cell.styles.fontStyle = 'bold'; }
             else if (statusVal === 'ATENÇÃO') data.cell.styles.textColor = [234, 179, 8];
             else if (statusVal === 'Excelente') data.cell.styles.textColor = [22, 163, 74];
          }
        }
      });

      finalY = (doc as any).lastAutoTable.finalY + 20;

      // SEÇÃO 5: PLANO DE AÇÃO
      if (finalY > 220) { doc.addPage(); finalY = 20; }
      doc.setFontSize(14);
      doc.setTextColor(0,0,0);
      doc.text("5. Plano de Ação", 14, finalY);
      doc.setDrawColor(150);
      doc.rect(14, finalY + 5, pageWidth - 28, 60);
      doc.setFontSize(9);
      doc.setTextColor(150);
      doc.text("Espaço para anotações estratégicas e ações de resgate.", 16, finalY + 12);

      // Rodapé
      const totalPages = (doc as any).internal.getNumberOfPages();
      for (let i = 1; i <= totalPages; i++) {
        doc.setPage(i);
        doc.setFontSize(8);
        doc.setTextColor(150);
        doc.text(`Gerado via Check-in JA - Página ${i} de ${totalPages}`, pageWidth - 70, doc.internal.pageSize.height - 10);
      }

      doc.save(`Relatorio_${reportType}_${classeNome.replace(" ", "")}_${anoRef}.pdf`);
      setIsReportModalOpen(false);

    } catch (e) {
      console.error(e);
      alert("Erro ao gerar PDF");
    } finally {
      setGeneratingPdf(false);
    }
  };

  return (
    <main className="flex-1 flex flex-col no-scrollbar overflow-y-auto bg-slate-50">
      <header className="sticky top-0 z-40 glass px-6 pt-12 pb-6 flex items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Link href="/" className="p-2 -ml-2 rounded-full hover:bg-slate-100 text-slate-600 transition-all active:scale-90">
            <ArrowLeft size={24} />
          </Link>
          <div>
            <h1 className="text-xl font-bold text-slate-900 tracking-tight">Dashboard</h1>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1">
              {classeNome}
            </p>
          </div>
        </div>
        
        {/* BOTÃO QUE INICIA O FLUXO DE SENHA */}
        <button onClick={() => setIsAuthModalOpen(true)} className="p-3 bg-indigo-600 text-white rounded-2xl shadow-lg shadow-indigo-200 active:scale-90 transition-all">
          <FileText size={22} />
        </button>
      </header>

      <div className="p-6 space-y-8 pb-20">
        {loading ? (
          <div className="flex flex-col items-center py-20 gap-4">
            <div className="w-10 h-10 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
            <p className="text-slate-400 font-bold animate-pulse">Carregando...</p>
          </div>
        ) : (
          <>
            <section>
              <SectionTitle title="Nesta Semana" icon={<Flame className="text-orange-500" size={16} />} />
              <div className="grid grid-cols-2 gap-4">
                <StatCard label="Lição" value={statsAgrupadas.statsSemana.licao} total={statsAgrupadas.statsSemana.total} icon={<BookOpen size={20}/>} color="bg-blue-500" />
                <StatCard label="Pequeno Grupo" value={statsAgrupadas.statsSemana.pg} total={statsAgrupadas.statsSemana.total} icon={<Users size={20}/>} color="bg-emerald-500" />
                <StatCard label="Dando Estudo" value={statsAgrupadas.statsSemana.estudo} total={statsAgrupadas.statsSemana.total} icon={<GraduationCap size={20}/>} color="bg-indigo-500" />
                <StatCard label="Ativ. Missão" value={statsAgrupadas.statsSemana.missao} total={statsAgrupadas.statsSemana.total} icon={<CalendarDays size={20}/>} color="bg-violet-500" />
              </div>
            </section>
            <section>
              <SectionTitle title="Histórico Mensal" icon={<History className="text-indigo-500" size={16} />} />
              <div className="space-y-6">
                {statsAgrupadas.historicoMensal.length > 0 ? (
                  statsAgrupadas.historicoMensal.map((mes: any, idx: number) => (
                    <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: idx * 0.1 }} key={mes.nome} className="bg-white rounded-[2.5rem] p-6 shadow-sm border border-slate-100 space-y-5">
                      <div className="flex justify-between items-center mb-2">
                        <h3 className="font-black text-slate-800 capitalize">{mes.nome}</h3>
                        <span className="text-[10px] font-black bg-slate-100 text-slate-400 px-3 py-1 rounded-full uppercase tracking-tighter">{mes.total} Check-ins</span>
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
                  <div className="text-center py-10 bg-white rounded-[2.5rem] border border-dashed border-slate-200"><p className="text-slate-400 font-medium">Sem dados históricos.</p></div>
                )}
              </div>
            </section>
          </>
        )}
      </div>

      {/* MODAL 1: AUTENTICAÇÃO */}
      <AnimatePresence>
        {isAuthModalOpen && (
           <>
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setIsAuthModalOpen(false)} className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50" />
              <motion.div initial={{ y: 50, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 50, opacity: 0 }} className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[90%] max-w-sm bg-white p-6 rounded-[2rem] shadow-2xl z-50">
                <div className="flex flex-col items-center mb-6">
                  <div className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center text-slate-400 mb-3">
                    <Lock size={20} />
                  </div>
                  <h3 className="text-lg font-bold text-slate-900">Acesso Restrito</h3>
                  <p className="text-sm text-slate-500">Digite a senha para gerar o relatório.</p>
                </div>

                <input 
                  type="password"
                  autoFocus
                  value={passwordInput}
                  onChange={(e) => setPasswordInput(e.target.value)}
                  placeholder="Senha..."
                  className="w-full bg-slate-50 border-2 border-slate-100 rounded-xl p-4 text-center font-bold text-lg outline-none mb-6 focus:border-indigo-500 transition-all"
                />

                <div className="flex gap-2">
                  <button onClick={() => setIsAuthModalOpen(false)} className="flex-1 py-3 text-slate-400 font-bold hover:bg-slate-50 rounded-xl">Cancelar</button>
                  <button onClick={handleVerifyPassword} className="flex-1 bg-indigo-600 text-white py-3 rounded-xl font-bold shadow-lg shadow-indigo-200">Acessar</button>
                </div>
              </motion.div>
           </>
        )}
      </AnimatePresence>

      {/* MODAL 2: CONFIGURAÇÃO DO RELATÓRIO */}
      <AnimatePresence>
        {isReportModalOpen && (
          <>
             <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setIsReportModalOpen(false)} className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50" />
             <motion.div initial={{ y: 100, scale: 0.9 }} animate={{ y: 0, scale: 1 }} exit={{ y: 100, scale: 0.9 }} className="fixed bottom-6 left-6 right-6 md:left-auto md:right-auto md:w-[400px] md:bottom-auto md:top-1/2 md:-translate-y-1/2 md:translate-x-1/2 bg-white p-6 rounded-[2.5rem] shadow-2xl z-50">
               <div className="flex justify-between items-center mb-6">
                 <h3 className="text-lg font-bold text-slate-900">Gerar Relatório</h3>
                 <button onClick={() => setIsReportModalOpen(false)} className="text-slate-400"><X size={20}/></button>
               </div>
               
               <div className="flex gap-2 mb-6">
                 <button onClick={() => setReportType('semanal')} className={cn("flex-1 py-3 rounded-xl text-sm font-bold transition-all", reportType === 'semanal' ? "bg-indigo-600 text-white shadow-lg shadow-indigo-200" : "bg-slate-100 text-slate-400")}>Semanal</button>
                 <button onClick={() => setReportType('anual')} className={cn("flex-1 py-3 rounded-xl text-sm font-bold transition-all", reportType === 'anual' ? "bg-slate-800 text-white shadow-lg" : "bg-slate-100 text-slate-400")}>Anual</button>
               </div>

               <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 flex items-center gap-3 mb-6">
                 <Calendar className={cn("transition-colors", reportType === 'semanal' ? "text-indigo-500" : "text-slate-500")} size={24} />
                 <input type="date" value={reportDate} onChange={(e) => setReportDate(e.target.value)} className="bg-transparent font-bold text-slate-700 outline-none w-full" />
               </div>
               
               <p className="text-xs text-slate-400 mb-4 text-center">
                 {reportType === 'semanal' ? "Analisa a semana da data escolhida." : "Analisa o ano completo da data escolhida."}
               </p>

               <button onClick={handleGeneratePDF} disabled={generatingPdf} className={cn("w-full text-white py-4 rounded-2xl font-black text-lg shadow-lg active:scale-95 transition-all flex items-center justify-center gap-2 disabled:opacity-70", reportType === 'semanal' ? "bg-indigo-600" : "bg-slate-800")}>
                 {generatingPdf ? <Loader2 className="animate-spin" /> : <FileText />}
                 {generatingPdf ? "Gerando..." : "Baixar PDF"}
               </button>
             </motion.div>
          </>
        )}
      </AnimatePresence>
    </main>
  );
}

// SUB-COMPONENTES
function SectionTitle({ title, icon }: { title: string, icon: React.ReactNode }) { return <div className="flex items-center gap-2 mb-4 ml-2">{icon}<h2 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">{title}</h2></div>; }
function StatCard({ label, value, total, icon, color }: any) { const percent = total > 0 ? Math.round((value / total) * 100) : 0; return (<div className="bg-white p-5 rounded-[2rem] shadow-sm border border-slate-100 flex flex-col gap-4"><div className={cn("w-10 h-10 rounded-2xl flex items-center justify-center text-white shadow-lg", color)}>{icon}</div><div><p className="text-[10px] font-black uppercase text-slate-400 tracking-tight leading-none mb-1">{label}</p><h4 className="text-xl font-black text-slate-900">{value} <span className="text-[10px] text-slate-300 font-bold">/ {total}</span></h4><div className="flex items-center gap-1 mt-1"><div className="h-1 w-8 bg-slate-100 rounded-full overflow-hidden"><div className={cn("h-full", color)} style={{ width: `${percent}%` }} /></div><span className="text-[9px] font-bold text-slate-400">{percent}%</span></div></div></div>); }
function MonthRow({ label, current, total, color }: any) { const percent = total > 0 ? (current / total) * 100 : 0; return (<div className="space-y-1.5"><div className="flex justify-between items-end px-1"><span className="text-[11px] font-bold text-slate-500">{label}</span><span className="text-[10px] font-black text-slate-900">{Math.round(percent)}%</span></div><div className="h-2 w-full bg-slate-50 rounded-full overflow-hidden"><motion.div initial={{ width: 0 }} whileInView={{ width: `${percent}%` }} viewport={{ once: true }} transition={{ duration: 1, ease: "easeOut" }} className={cn("h-full rounded-full", color)} /></div></div>); }