"use client";

import { useState } from "react";
import { db } from "@/lib/firebase";
import { collection, getDocs, query } from "firebase/firestore";
import { X, CalendarDays, Loader2, BookA } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import jsPDF from "jspdf";
import toast from "react-hot-toast";

interface CartaoModalProps {
  isOpen: boolean;
  onClose: () => void;
  classeId: string;
  classeNome: string;
}

export function CartaoRegistroModal({ isOpen, onClose, classeId, classeNome }: CartaoModalProps) {
  const dataAtual = new Date();
  const [ano, setAno] = useState(dataAtual.getFullYear().toString());
  const [trimestre, setTrimestre] = useState(() => {
    const mes = dataAtual.getMonth() + 1;
    if (mes <= 3) return "1";
    if (mes <= 6) return "2";
    if (mes <= 9) return "3";
    return "4";
  });
  const [isGenerating, setIsGenerating] = useState(false);

  const handleGerarCartao = async () => {
    setIsGenerating(true);
    const toastId = toast.loading("Desenhando cartão...");

    try {
      const anoNum = parseInt(ano);
      const trimNum = parseInt(trimestre);
      const mesInicio = (trimNum - 1) * 3;
      const dataInicio = new Date(anoNum, mesInicio, 1);
      const dataFim = new Date(anoNum, mesInicio + 3, 0);

      const sabados: Date[] = [];
      let diaLoop = new Date(dataInicio);
      while (diaLoop <= dataFim) {
        if (diaLoop.getDay() === 6) sabados.push(new Date(diaLoop));
        diaLoop.setDate(diaLoop.getDate() + 1);
      }

      const qAlunos = query(collection(db, "alunos"));
      const snapAlunos = await getDocs(qAlunos);
      const todosAlunos = snapAlunos.docs.map(d => ({
        id: d.id, ...d.data(), classe: d.data().classe || "jovens"
      })) as any[];
      const alunosClasse = todosAlunos
        .filter(a => a.classe === classeId)
        .sort((a, b) => a.nome.localeCompare(b.nome));

      const qStats = query(collection(db, "estatisticas"));
      const snapStats = await getDocs(qStats);
      const todasStats = snapStats.docs.map(d => ({
        ...d.data(), classe: d.data().classe || "jovens", dataTimestamp: d.data().data
      })) as any[];

      const statsTrimestre = todasStats.filter(s => {
        if (s.classe !== classeId || !s.dataTimestamp) return false;
        const d = s.dataTimestamp.toDate();
        return d >= dataInicio && d <= dataFim;
      });

      const totaisSemanas = sabados.map(() => ({
        presentes: 0, licao: 0, pg: 0, estudo: 0, missao: 0
      }));

      alunosClasse.forEach(aluno => {
        const maxSabs = Math.min(sabados.length, 14);
        for (let i = 0; i < maxSabs; i++) {
          const sabado = sabados[i];
          const presenca = aluno.historico?.find((t: any) => {
            const d = t.toDate();
            return (
              d.getDate() === sabado.getDate() &&
              d.getMonth() === sabado.getMonth() &&
              d.getFullYear() === sabado.getFullYear()
            );
          });

          if (presenca) {
            totaisSemanas[i].presentes++;
            const statAlunoDia = statsTrimestre.find(s => {
              if (s.alunoId !== aluno.id) return false;
              const sd = s.dataTimestamp.toDate();
              return (
                sd.getDate() === sabado.getDate() &&
                sd.getMonth() === sabado.getMonth()
              );
            });
            if (statAlunoDia) {
              if (statAlunoDia.licao)  totaisSemanas[i].licao++;
              if (statAlunoDia.pg)     totaisSemanas[i].pg++;
              if (statAlunoDia.estudo) totaisSemanas[i].estudo++;
              if (statAlunoDia.missao) totaisSemanas[i].missao++;
            }
          }
        }
      });

      // ── PDF ──────────────────────────────────────────────────────────────
      const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });

      doc.setFont("helvetica", "normal");

      doc.setTextColor(15, 30, 160);

      // ── PÁGINA 1 — FRENTE ──────────────────────────────────────────────────
      try { doc.addImage("/cartao-frente.jpg", "JPEG", 0, 0, 297, 210); } catch {}

      doc.setFontSize(11);
      doc.text(ano, 203, 62);   // Campo Ano

      // X no checkbox do trimestre correto
      const TRIM_X = [230, 249, 263, 276];
      doc.text("X", TRIM_X[trimNum - 1], 62);

      // Nome da Unidade/Pequeno Grupo
      doc.text(classeNome, 232, 75);

      // Baselines das 16 linhas de alunos (em mm)
      const LINHAS_Y = [
        30.94, 39.00, 47.22, 55.44, 63.66, 71.88,
        79.94, 88.16, 96.22, 104.44, 112.66, 120.87,
        129.26, 137.64, 146.02, 154.40
      ];

      // Centros das 14 colunas de sábado (em mm) — começa na coluna 1º, após Telefone/Nascimento/Batismo
      const SAB_X = [
        131.5, 136.0, 140.5, 145.0, 149.5, 154.0,
        158.5, 163.0, 167.5, 172.0, 176.5, 181.0,
        185.5, 190.0
      ];

      // Rodapé (5 linhas: presentes, lição, pg, estudo, missão)
      const RODAPE_Y = [160.5, 168.8, 177.1, 185.4, 193.7];

      const NOME_X = 14;
      const ALUNOS_POR_PAG = 16;

      const paginas: any[][] = [];
      for (let i = 0; i < alunosClasse.length; i += ALUNOS_POR_PAG)
        paginas.push(alunosClasse.slice(i, i + ALUNOS_POR_PAG));
      if (paginas.length === 0) paginas.push([]);

      paginas.forEach((chunk) => {
        doc.addPage();
        try { doc.addImage("/cartao-verso.jpg", "JPEG", 0, 0, 297, 210); } catch {}

        // Nomes e presenças
        doc.setFontSize(8.5);
        chunk.forEach((aluno, idx) => {
          const y = LINHAS_Y[idx];
          doc.text(aluno.nome.substring(0, 30), NOME_X, y);

          const maxSabs = Math.min(sabados.length, 14);
          for (let i = 0; i < maxSabs; i++) {
            const sabado = sabados[i];
            const presenca = aluno.historico?.find((t: any) => {
              const d = t.toDate();
              return d.getDate() === sabado.getDate() &&
                     d.getMonth() === sabado.getMonth() &&
                     d.getFullYear() === sabado.getFullYear();
            });
            if (presenca) {
              const pw = doc.getTextWidth("P");
              doc.text("P", SAB_X[i] - pw / 2, y);
            }
          }
        });

        // Rodapé — totais por sábado
        doc.setFontSize(8);
        const maxSabs = Math.min(totaisSemanas.length, 14);
        for (let i = 0; i < maxSabs; i++) {
          const t = totaisSemanas[i];
          const x = SAB_X[i];
          const cx = (s: string) => x - doc.getTextWidth(s) / 2;
          if (t.presentes > 0) doc.text(String(t.presentes), cx(String(t.presentes)), RODAPE_Y[0]);
          if (t.licao     > 0) doc.text(String(t.licao),     cx(String(t.licao)),     RODAPE_Y[1]);
          if (t.pg        > 0) doc.text(String(t.pg),        cx(String(t.pg)),        RODAPE_Y[2]);
          if (t.estudo    > 0) doc.text(String(t.estudo),    cx(String(t.estudo)),    RODAPE_Y[3]);
          if (t.missao    > 0) doc.text(String(t.missao),    cx(String(t.missao)),    RODAPE_Y[4]);
        }
      });

      doc.save(`Cartao_${classeNome.replace(/\s/g, "")}_T${trimestre}_${ano}.pdf`);
      toast.success("Cartão gerado com sucesso!", { id: toastId });
      onClose();

    } catch (error) {
      console.error(error);
      toast.error("Erro ao gerar cartão.", { id: toastId });
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50"
          />
          <motion.div
            initial={{ y: 50, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 50, opacity: 0 }}
            className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[90%] max-w-sm bg-white p-6 rounded-[2rem] shadow-2xl z-50"
          >
            <div className="flex justify-between items-center mb-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-indigo-50 rounded-xl flex items-center justify-center text-indigo-600">
                  <BookA size={20} />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900">Cartão de Registro</h3>
                  <p className="text-xs text-slate-400">Exportação Oficial</p>
                </div>
              </div>
              <button onClick={onClose} className="text-slate-400"><X size={20}/></button>
            </div>

            <div className="space-y-4 mb-6">
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase ml-1">Ano Letivo</label>
                <div className="bg-slate-50 border border-slate-100 rounded-xl flex items-center mt-1 px-4 py-3">
                  <CalendarDays size={18} className="text-slate-400 mr-3" />
                  <input
                    type="number" value={ano}
                    onChange={e => setAno(e.target.value)}
                    className="bg-transparent outline-none w-full font-bold text-slate-700"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-500 uppercase ml-1">Trimestre</label>
                <div className="grid grid-cols-4 gap-2 mt-1">
                  {[1, 2, 3, 4].map(t => (
                    <button
                      key={t} onClick={() => setTrimestre(t.toString())}
                      className={`py-3 rounded-xl font-black text-sm transition-all border ${
                        trimestre === t.toString()
                          ? "bg-indigo-600 text-white border-indigo-600 shadow-md shadow-indigo-200"
                          : "bg-slate-50 text-slate-400 border-slate-100 hover:bg-slate-100"
                      }`}
                    >
                      {t}º
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <button
              onClick={handleGerarCartao} disabled={isGenerating}
              className="w-full bg-slate-900 text-white py-4 rounded-2xl font-black text-lg shadow-xl active:scale-95 transition-all flex justify-center items-center gap-2"
            >
              {isGenerating ? <Loader2 className="animate-spin" /> : null}
              {isGenerating ? "Preenchendo..." : "Gerar Cartão PDF"}
            </button>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}