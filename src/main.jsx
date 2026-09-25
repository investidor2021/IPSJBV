import React, { useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import { AlertTriangle, CalendarRange, CheckCircle2, CircleDollarSign, Download, FileText, Gauge, Landmark, ListFilter, Menu, PiggyBank, RotateCcw, Search, ShieldCheck, TableProperties, TrendingDown, TrendingUp, Users, WalletCards, X } from "lucide-react";
import { Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import "./styles.css";
import "./previdencia.css";

const brl = new Intl.NumberFormat("pt-BR", { style:"currency", currency:"BRL", maximumFractionDigits:0 });
const brl2 = new Intl.NumberFormat("pt-BR", { style:"currency", currency:"BRL", minimumFractionDigits:2, maximumFractionDigits:2 });
const compact = new Intl.NumberFormat("pt-BR", { notation:"compact", maximumFractionDigits:1 });
const pct = v => v===null||!isFinite(v) ? "—" : `${v>0?"+":""}${v.toFixed(1).replace(".",",")}%`;
const share = (v,t) => t ? `${(v/t*100).toFixed(1).replace(".",",")}%` : "—";
const MESES = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];
const CORES_ANO = { 2024:"#aebbb5", 2025:"#d6aa45", 2026:"#147967" };
const corAno = ano => CORES_ANO[ano] || "#6a8e83";
const semAcento = t => (t||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toUpperCase();

// Grupos da receita pelo código da alínea (classificação da receita pública)
const GRUPOS_RECEITA = [
  {id:"servidor", nome:"Contribuição dos servidores", cor:"#147967", teste:c=>c.startsWith("1215")},
  {id:"patronal", nome:"Contribuição patronal", cor:"#2f9c7f", teste:c=>c.startsWith("7215")},
  {id:"outrasContrib", nome:"Demais contribuições intra", cor:"#7cc3a9", teste:c=>c.startsWith("72")},
  {id:"aportes", nome:"Aportes para déficit atuarial", cor:"#d6aa45", teste:c=>c.startsWith("7999")},
  {id:"rendimentos", nome:"Rendimentos de aplicações", cor:"#3f6fa8", teste:c=>c.startsWith("1321")},
  {id:"comprev", nome:"Compensação previdenciária (COMPREV)", cor:"#9a6fb0", teste:c=>c.startsWith("199903")},
  {id:"outras", nome:"Outras receitas", cor:"#aebbb5", teste:()=>true},
];
const grupoReceita = alinea => { const c=(alinea||"").split(" ")[0]; return GRUPOS_RECEITA.find(g=>g.teste(c)).nome; };

// A API do TCE-SP não informa o elemento de despesa; o grupo é inferido pelo credor
const GRUPOS_DESPESA = [
  {nome:"Folha de benefícios e pessoal", cor:"#147967", teste:(n)=>n.includes("INST PREV")},
  {nome:"Depósitos judiciais (TJ-SP)", cor:"#d55d49", teste:(n)=>n.includes("TRIBUNAL DE JUSTICA")},
  {nome:"Órgãos federais", cor:"#3f6fa8", teste:(n)=>/MINISTERIO|RECEITA FEDERAL|DATAPREV|INSS/.test(n)},
  {nome:"Pagamentos a pessoas físicas", cor:"#d6aa45", teste:(n,id)=>id.startsWith("PESSOA F")},
  {nome:"Serviços e despesas administrativas", cor:"#aebbb5", teste:()=>true},
];
const grupoDespesa = (nome,id) => GRUPOS_DESPESA.find(g=>g.teste(semAcento(nome),semAcento(id))).nome;
const corGrupo = nome => [...GRUPOS_RECEITA,...GRUPOS_DESPESA].find(g=>g.nome===nome)?.cor || "#6a8e83";

const soma = rows => rows.reduce((a,r)=>a+r.valor,0);
function somarPor(rows, chave){ const m=new Map(); for(const r of rows){const k=chave(r); m.set(k,(m.get(k)||0)+r.valor);} return m; }
function execucao(rows){
  const t={Empenhado:0,Reforço:0,Anulação:0,Liquidado:0,Pago:0};
  for(const r of rows) t[r.evento]=(t[r.evento]||0)+r.valor;
  return {empenhado:t.Empenhado+t.Reforço-t.Anulação, liquidado:t.Liquidado, pago:t.Pago, anulado:t.Anulação};
}
const temDados = (dados,ano,mes) => (dados.mesesComDados[ano]||[]).includes(mes);
const opcoes = (rows,campo) => [...new Set(rows.map(r=>r[campo]).filter(Boolean))].sort((a,b)=>a.localeCompare(b,"pt-BR"));

function App(){
  const [dados,setDados]=useState(null); const [erro,setErro]=useState("");
  const [tab,setTab]=useState("visao"); const [drawer,setDrawer]=useState(false);
  const [anos,setAnos]=useState([]); const [meses,setMeses]=useState([]);

  // O index.html gerado no build já traz os dados embutidos, para abrir com dois cliques (file://),
  // onde o navegador bloqueia o fetch; no npm run dev os dados vêm do arquivo JSON.
  useEffect(()=>{(window.__IPSJBV_DATA__?Promise.resolve(window.__IPSJBV_DATA__):fetch(`${import.meta.env.BASE_URL}data/ipsjbv.json`).then(r=>r.json())).then(raw=>{
    const receitas=raw.receitas.map(([ano,mes,fonte,aplicacao,alinea,subalinea,valor])=>({ano,mes,fonte,aplicacao,alinea,subalinea,valor,grupo:grupoReceita(alinea)}));
    const despesas=raw.despesas.map(([ano,mes,evento,empenho,idFornecedor,fornecedor,data,valor])=>({ano,mes,evento,empenho,idFornecedor,fornecedor,data,valor,grupo:grupoDespesa(fornecedor,idFornecedor),pessoa:semAcento(idFornecedor).startsWith("PESSOA F")?"Pessoa física":"Pessoa jurídica"}));
    const anosDisp=Object.keys(raw.mesesComDados).map(Number).sort();
    setDados({...raw,receitas,despesas,anosDisp}); setAnos(anosDisp); setMeses(MESES.map((_,i)=>i+1));
  }).catch(e=>setErro(String(e)))},[]);

  const ultimoAno=dados?.anosDisp.at(-1); const ultimoMes=dados?.mesesComDados[ultimoAno]?.at(-1);
  const filtro=useMemo(()=>{ if(!dados) return null; const ok=r=>anos.includes(r.ano)&&meses.includes(r.mes);
    return {receitas:dados.receitas.filter(ok), despesas:dados.despesas.filter(ok)} },[dados,anos,meses]);

  const nav=[["visao","Visão executiva",Gauge],["receitas","Receitas",CircleDollarSign],["despesas","Despesas & execução",WalletCards],["credores","Credores",Users],["lancamentos","Lançamentos",TableProperties],["fontes","Fontes & método",FileText]];
  const title=nav.find(n=>n[0]===tab)?.[1];
  if(erro) return <div className="empty"><AlertTriangle/><h2>Não foi possível carregar os dados</h2><p>{erro}</p></div>;
  if(!dados) return <div className="empty"><PiggyBank/><h2>Carregando dados do TCE-SP...</h2></div>;
  const filtros={dados,anos,setAnos,meses,setMeses,ultimoAno};

  return <div className="app"><aside className={`sidebar ${drawer?"open":""}`}><button className="close" onClick={()=>setDrawer(false)}><X/></button>
    <div className="brand"><div className="brandmark"><Landmark/></div><div><strong>GovFinance</strong><span>Inteligência previdenciária</span></div></div>
    <div className="municipality"><span>Instituto analisado</span><strong>IPSJBV · São João da Boa Vista</strong><small>SP · RPPS · {dados.anosDisp[0]}–{ultimoAno}</small></div>
    <nav>{nav.map(([id,label,Icon])=><button key={id} className={tab===id?"active":""} onClick={()=>{setTab(id);setDrawer(false)}}><Icon/>{label}</button>)}</nav>
    <div className="base-note"><CheckCircle2/><span><strong>{(dados.receitas.length+dados.despesas.length).toLocaleString("pt-BR")} lançamentos AUDESP</strong><small>Coletado em {new Date(dados.geradoEm).toLocaleDateString("pt-BR")}</small></span></div></aside>
    <main><header><button className="menu" onClick={()=>setDrawer(true)}><Menu/></button><div><p>GOVFINANCE · PREVIDÊNCIA DE SÃO JOÃO DA BOA VISTA/SP</p><h1>{title}</h1></div><div className="head-actions"><span><i/> Dados até {MESES[ultimoMes-1]?.toLowerCase()}/{ultimoAno}</span><button onClick={()=>window.print()}><Download/> Exportar</button></div></header>
    {tab==="visao"&&<Overview f={filtro} filtros={filtros} go={setTab}/>}
    {tab==="receitas"&&<Revenues f={filtro} filtros={filtros}/>}
    {tab==="despesas"&&<Expenses f={filtro} filtros={filtros}/>}
    {tab==="credores"&&<Creditors f={filtro} filtros={filtros}/>}
    {tab==="lancamentos"&&<Entries f={filtro} filtros={filtros}/>}
    {tab==="fontes"&&<Sources dados={dados}/>}
    </main></div>;
}

function PeriodFilter({dados,anos,setAnos,meses,setMeses,ultimoAno}){
  const toggleAno=a=>setAnos(v=>v.includes(a)?(v.length>1?v.filter(x=>x!==a):v):[...v,a].sort());
  const toggleMes=m=>setMeses(v=>v.includes(m)?(v.length>1?v.filter(x=>x!==m):v):[...v,m].sort((a,b)=>a-b));
  const periodoUltimo=dados.mesesComDados[ultimoAno]||[];
  const mesmoPeriodo=meses.length===periodoUltimo.length&&periodoUltimo.every(m=>meses.includes(m));
  return <div className="filterbar"><div className="chips"><span><CalendarRange/> Exercícios</span>{dados.anosDisp.map(a=><button key={a} className={anos.includes(a)?"on":""} onClick={()=>toggleAno(a)}>{a}</button>)}</div>
    <div className="chips months"><span>Meses</span><button className={meses.length===12?"on":""} onClick={()=>setMeses(MESES.map((_,i)=>i+1))}>Todos</button>{MESES.map((m,i)=><button key={m} className={meses.includes(i+1)?"on":""} onClick={()=>toggleMes(i+1)}>{m}</button>)}</div>
    <button className={`same-period ${mesmoPeriodo?"on":""}`} onClick={()=>setMeses(periodoUltimo)} title="Compara todos os anos no mesmo intervalo de meses já disponível no último exercício">Mesmo período de {ultimoAno} (jan–{MESES[periodoUltimo.at(-1)-1]?.toLowerCase()})</button></div>;
}
function SelectFilter({label,value,set,options,all="Todos"}){return <label className="select-filter"><span>{label}</span><select value={value} onChange={e=>set(e.target.value)}><option value="">{all}</option>{options.map(o=><option key={o} value={o}>{o}</option>)}</select></label>}
function SearchFilter({value,set,placeholder}){return <label className="search inline"><Search/><input value={value} onChange={e=>set(e.target.value)} placeholder={placeholder}/>{value&&<button onClick={()=>set("")}><X/></button>}</label>}

function Overview({f,filtros,go}){
  const {anos}=filtros; const rec=soma(f.receitas); const ex=execucao(f.despesas); const resultado=rec-ex.liquidado;
  const porAno=anos.map(a=>{const e=execucao(f.despesas.filter(r=>r.ano===a)); return {ano:String(a),Receita:soma(f.receitas.filter(r=>r.ano===a)),Liquidado:e.liquidado,Pago:e.pago}});
  const mensal=[]; for(const a of anos) for(const m of filtros.meses){const r=soma(f.receitas.filter(x=>x.ano===a&&x.mes===m)); const d=execucao(f.despesas.filter(x=>x.ano===a&&x.mes===m)); if(r||d.liquidado) mensal.push({mes:`${MESES[m-1]}/${String(a).slice(2)}`,Receita:r,Liquidado:d.liquidado});}
  const compRec=[...somarPor(f.receitas,r=>r.grupo)].map(([name,value])=>({name,value})).filter(x=>x.value>0).sort((a,b)=>b.value-a.value);
  const pagos=f.despesas.filter(r=>r.evento==="Pago"); const compDesp=[...somarPor(pagos,r=>r.grupo)].map(([name,value])=>({name,value})).sort((a,b)=>b.value-a.value);
  const contrib=f.receitas.filter(r=>/servidores|patronal|intra/.test(r.grupo)).reduce((a,r)=>a+r.valor,0);
  const folha=soma(pagos.filter(r=>r.grupo==="Folha de benefícios e pessoal"));
  const rend=f.receitas.filter(r=>r.grupo==="Rendimentos de aplicações"); const mesesNeg=[...somarPor(rend,r=>`${r.ano}-${r.mes}`)].filter(([,v])=>v<0).length;
  return <Page><PeriodFilter {...filtros}/>
    <div className="hero"><div><span>PANORAMA DO REGIME PRÓPRIO</span><h2>{resultado>=0?"Receitas superam a despesa liquidada no período":"Despesa liquidada supera as receitas no período"}</h2><p>Instituto de Previdência dos Servidores Públicos Municipais de São João da Boa Vista, com dados enviados ao AUDESP/TCE-SP em {anos.join(", ")}.</p></div><button onClick={()=>go("receitas")}>Detalhar receitas <TrendingUp/></button></div>
    <div className="kpis"><Kpi icon={CircleDollarSign} label="Receita arrecadada" value={brl.format(rec)} note={`${f.receitas.length} lançamentos no filtro`} tone="green"/><Kpi icon={WalletCards} label="Despesa liquidada" value={brl.format(ex.liquidado)} note={`Empenhado líquido ${brl.format(ex.empenhado)}`}/><Kpi icon={resultado>=0?TrendingUp:TrendingDown} label="Resultado (receita − liquidado)" value={brl.format(resultado)} note={resultado>=0?"Superávit no período filtrado":"Déficit no período filtrado"} tone={resultado>=0?"green":"red"}/><Kpi icon={ShieldCheck} label="Despesa paga" value={brl.format(ex.pago)} note={`${share(ex.pago,ex.liquidado)} do liquidado`} tone="gold"/></div>
    <div className="grid two"><Card title="Receita × despesa por exercício" subtitle="Meses selecionados no filtro"><ResponsiveContainer width="100%" height={290}><BarChart data={porAno}><CartesianGrid stroke="#e7ece8" vertical={false}/><XAxis dataKey="ano" axisLine={false} tickLine={false}/><YAxis tickFormatter={compact.format} axisLine={false} tickLine={false}/><Tooltip formatter={v=>brl.format(v)}/><Legend/><Bar dataKey="Receita" fill="#147967" radius={[4,4,0,0]}/><Bar dataKey="Liquidado" fill="#d6aa45" radius={[4,4,0,0]}/><Bar dataKey="Pago" fill="#aebbb5" radius={[4,4,0,0]}/></BarChart></ResponsiveContainer></Card>
      <Card title="Leitura executiva" subtitle="Calculada automaticamente sobre o filtro"><div className="executive-list">
        <Insight tone={resultado>=0?"good":"risk"} title="Resultado do período" text={`Receitas de ${brl.format(rec)} contra ${brl.format(ex.liquidado)} de despesa liquidada.`}/>
        <Insight tone={contrib>=folha?"good":"warn"} title="Contribuições × folha" text={`As contribuições (servidor + patronal) somam ${brl.format(contrib)} e cobrem ${share(contrib,folha)} dos pagamentos da folha de benefícios e pessoal (${brl.format(folha)}).`}/>
        <Insight tone={compRec[0]?"good":"warn"} title="Principal fonte de receita" text={compRec[0]?`${compRec[0].name}: ${share(compRec[0].value,rec)} da arrecadação.`:"Sem receitas no filtro."}/>
        <Insight tone={mesesNeg?"risk":"good"} title="Rendimentos das aplicações" text={mesesNeg?`${mesesNeg} mês(es) com rendimento negativo no período — acompanhar a política de investimentos.`:`Nenhum mês com rendimento negativo; total de ${brl.format(soma(rend))}.`}/></div></Card></div>
    <Card title="Evolução mensal" subtitle="Receita arrecadada × despesa liquidada, mês a mês"><ResponsiveContainer width="100%" height={280}><BarChart data={mensal}><CartesianGrid stroke="#e7ece8" vertical={false}/><XAxis dataKey="mes" axisLine={false} tickLine={false} interval="preserveStartEnd"/><YAxis tickFormatter={compact.format} axisLine={false} tickLine={false}/><Tooltip formatter={v=>brl.format(v)}/><Legend/><Bar dataKey="Receita" fill="#147967" radius={[3,3,0,0]}/><Bar dataKey="Liquidado" fill="#d6aa45" radius={[3,3,0,0]}/></BarChart></ResponsiveContainer></Card>
    <div className="grid halves"><Donut title="Composição da receita" subtitle="Por natureza da receita" data={compRec}/><Donut title="Composição da despesa paga" subtitle="Grupos inferidos pelo credor" data={compDesp}/></div>
    {filtros.anos.includes(filtros.ultimoAno)&&filtros.meses.length===12&&<div className="notice gold"><AlertTriangle/><div><strong>{filtros.ultimoAno} ainda está em andamento</strong><p>O exercício de {filtros.ultimoAno} só tem dados até {MESES[(filtros.dados.mesesComDados[filtros.ultimoAno]||[]).at(-1)-1]?.toLowerCase()}. Para comparar os anos de forma justa, use o botão “Mesmo período de {filtros.ultimoAno}” no filtro acima.</p></div></div>}
  </Page>;
}

function Revenues({f,filtros}){
  const [grupo,setGrupo]=useState(""); const [alinea,setAlinea]=useState(""); const [aplic,setAplic]=useState(""); const [fonte,setFonte]=useState(""); const [busca,setBusca]=useState("");
  const rows=f.receitas.filter(r=>(!grupo||r.grupo===grupo)&&(!alinea||r.alinea===alinea)&&(!aplic||r.aplicacao===aplic)&&(!fonte||r.fonte===fonte)&&(!busca||semAcento(`${r.alinea} ${r.subalinea} ${r.aplicacao}`).includes(semAcento(busca))));
  const {anos}=filtros; const total=soma(rows); const grupos=[...new Set(rows.map(r=>r.grupo))];
  const porGrupo=somarPor(rows,r=>r.grupo);
  const porAno=anos.map(a=>{const o={ano:String(a)}; for(const g of grupos) o[g]=soma(rows.filter(r=>r.ano===a&&r.grupo===g)); return o;});
  const mensal=filtros.meses.map(m=>{const o={mes:MESES[m-1]}; for(const a of anos) o[a]=temDados(filtros.dados,a,m)?soma(rows.filter(r=>r.ano===a&&r.mes===m)):null; return o;});
  const tabela=[...somarPor(rows,r=>r.alinea)].map(([nome])=>{const rs=rows.filter(r=>r.alinea===nome); const o={nome,grupo:rs[0].grupo,total:soma(rs)}; for(const a of anos) o[a]=soma(rs.filter(r=>r.ano===a)); return o;}).sort((a,b)=>b.total-a.total);
  const [a1,a2]=anos.slice(-2);
  const mesesUltimo=filtros.dados.mesesComDados[a2]||[]; const parcial=a2&&filtros.meses.some(m=>!mesesUltimo.includes(m));
  const limpar=()=>{setGrupo("");setAlinea("");setAplic("");setFonte("");setBusca("")};
  return <Page><PeriodFilter {...filtros}/>
    <div className="page-head"><div><span>ARRECADAÇÃO DO RPPS</span><h2>Receitas previdenciárias</h2><p>Contribuições, aportes, rendimentos de aplicações e compensação previdenciária.</p></div></div>
    <div className="field-filters"><ListFilter/><SelectFilter label="Natureza" value={grupo} set={setGrupo} options={GRUPOS_RECEITA.map(g=>g.nome).filter(n=>f.receitas.some(r=>r.grupo===n))} all="Todas"/><SelectFilter label="Alínea" value={alinea} set={setAlinea} options={opcoes(f.receitas,"alinea")} all="Todas"/><SelectFilter label="Código de aplicação" value={aplic} set={setAplic} options={opcoes(f.receitas,"aplicacao")}/><SelectFilter label="Fonte de recurso" value={fonte} set={setFonte} options={opcoes(f.receitas,"fonte")} all="Todas"/><SearchFilter value={busca} set={setBusca} placeholder="Buscar receita..."/><button className="reset" onClick={limpar}><RotateCcw/> Limpar</button></div>
    <div className="kpis"><Kpi icon={CircleDollarSign} label="Total arrecadado" value={brl.format(total)} note={`${rows.length} lançamentos`} tone="green"/>{[...porGrupo].sort((a,b)=>b[1]-a[1]).slice(0,3).map(([g,v])=><Kpi key={g} label={g} value={brl.format(v)} note={`${share(v,total)} do total`}/>)}</div>
    <div className="grid two"><Card title="Receita por exercício e natureza" subtitle="Barras empilhadas por natureza da receita"><ResponsiveContainer width="100%" height={320}><BarChart data={porAno}><CartesianGrid stroke="#e7ece8" vertical={false}/><XAxis dataKey="ano" axisLine={false} tickLine={false}/><YAxis tickFormatter={compact.format} axisLine={false} tickLine={false}/><Tooltip formatter={v=>brl.format(v)}/><Legend wrapperStyle={{fontSize:10}}/>{grupos.map(g=><Bar key={g} dataKey={g} stackId="a" fill={corGrupo(g)}/>)}</BarChart></ResponsiveContainer></Card>
      <Card title="Sazonalidade mensal" subtitle="Cada linha é um exercício"><ResponsiveContainer width="100%" height={320}><LineChart data={mensal}><CartesianGrid stroke="#e7ece8" vertical={false}/><XAxis dataKey="mes" axisLine={false} tickLine={false}/><YAxis tickFormatter={compact.format} axisLine={false} tickLine={false}/><Tooltip formatter={v=>brl.format(v)}/><Legend/>{anos.map(a=><Line key={a} type="monotone" dataKey={a} stroke={corAno(a)} strokeWidth={3} dot={false}/>)}</LineChart></ResponsiveContainer></Card></div>
    <Card title="Receitas por alínea" subtitle="Valores arrecadados nos meses selecionados"><div className="table-wrap"><table><thead><tr><th>Alínea</th><th>Natureza</th>{anos.map(a=><th key={a}>{a}</th>)}<th>Total</th>{a2&&<th>Var. {a1}→{a2}</th>}</tr></thead><tbody>{tabela.map(t=>{const v=a2&&t[a1]?(t[a2]/t[a1]-1)*100:null; return <tr key={t.nome}><td className="wrap"><strong>{t.nome}</strong></td><td><span className="pill">{t.grupo}</span></td>{anos.map(a=><td key={a}>{brl.format(t[a])}</td>)}<td><strong>{brl.format(t.total)}</strong></td>{a2&&<td className={v<0?"negative":"positive"}>{pct(v)}</td>}</tr>})}</tbody><tfoot><tr><td colSpan="2"><strong>Total</strong></td>{anos.map(a=><td key={a}><strong>{brl.format(soma(rows.filter(r=>r.ano===a)))}</strong></td>)}<td><strong>{brl.format(total)}</strong></td>{a2&&<td/>}</tr></tfoot></table></div>{parcial&&<div className="notice gold table-note"><AlertTriangle/><div><strong>{a2} ainda está incompleto</strong><p>A variação compara {a1} inteiro com {a2} até {MESES[mesesUltimo.at(-1)-1]?.toLowerCase()}. Clique em “Mesmo período de {a2}” no filtro para comparar meses equivalentes.</p></div></div>}</Card>
  </Page>;
}

function Expenses({f,filtros}){
  const [evento,setEvento]=useState("Pago"); const [grupo,setGrupo]=useState(""); const [pessoa,setPessoa]=useState(""); const [busca,setBusca]=useState("");
  const base=f.despesas.filter(r=>(!grupo||r.grupo===grupo)&&(!pessoa||r.pessoa===pessoa)&&(!busca||semAcento(`${r.fornecedor} ${r.idFornecedor} ${r.empenho}`).includes(semAcento(busca))));
  const rows=base.filter(r=>r.evento===evento); const {anos}=filtros; const ex=execucao(base);
  const porAno=anos.map(a=>{const e=execucao(base.filter(r=>r.ano===a)); return {ano:String(a),"Empenhado líquido":e.empenhado,Liquidado:e.liquidado,Pago:e.pago}});
  const porGrupo=[...somarPor(rows,r=>r.grupo)].map(([name,value])=>({name,value})).sort((a,b)=>b.value-a.value);
  const mensal=filtros.meses.map(m=>{const o={mes:MESES[m-1]}; for(const a of anos) o[a]=temDados(filtros.dados,a,m)?soma(rows.filter(r=>r.ano===a&&r.mes===m)):null; return o;});
  const tabela=GRUPOS_DESPESA.map(g=>g.nome).filter(g=>base.some(r=>r.grupo===g)).map(g=>{const e=execucao(base.filter(r=>r.grupo===g)); return {g,...e}});
  const limpar=()=>{setGrupo("");setPessoa("");setBusca("")};
  return <Page><PeriodFilter {...filtros}/>
    <div className="page-head"><div><span>EXECUÇÃO ORÇAMENTÁRIA</span><h2>Despesas do instituto</h2><p>Empenho, liquidação e pagamento dos benefícios e das despesas administrativas.</p></div><Segment options={["Empenhado","Liquidado","Pago","Anulação"]} value={evento} set={setEvento}/></div>
    <div className="field-filters"><ListFilter/><SelectFilter label="Grupo de despesa" value={grupo} set={setGrupo} options={GRUPOS_DESPESA.map(g=>g.nome)}/><SelectFilter label="Tipo de credor" value={pessoa} set={setPessoa} options={["Pessoa jurídica","Pessoa física"]}/><SearchFilter value={busca} set={setBusca} placeholder="Buscar credor, CNPJ ou empenho..."/><button className="reset" onClick={limpar}><RotateCcw/> Limpar</button></div>
    <div className="kpis"><Kpi label="Empenhado líquido" value={brl.format(ex.empenhado)} note={`Anulações de ${brl.format(ex.anulado)}`}/><Kpi label="Liquidado" value={brl.format(ex.liquidado)} note={`${share(ex.liquidado,ex.empenhado)} do empenhado`} tone="green"/><Kpi label="Pago" value={brl.format(ex.pago)} note={`${share(ex.pago,ex.liquidado)} do liquidado`} tone="green"/><Kpi label="A pagar (liquidado − pago)" value={brl.format(ex.liquidado-ex.pago)} note="Diferença no período filtrado" tone="gold"/></div>
    <div className="grid two"><Card title="Execução por exercício" subtitle="Empenhado líquido = empenhos + reforços − anulações"><ResponsiveContainer width="100%" height={300}><BarChart data={porAno}><CartesianGrid stroke="#e7ece8" vertical={false}/><XAxis dataKey="ano" axisLine={false} tickLine={false}/><YAxis tickFormatter={compact.format} axisLine={false} tickLine={false}/><Tooltip formatter={v=>brl.format(v)}/><Legend/><Bar dataKey="Empenhado líquido" fill="#aebbb5" radius={[4,4,0,0]}/><Bar dataKey="Liquidado" fill="#d6aa45" radius={[4,4,0,0]}/><Bar dataKey="Pago" fill="#147967" radius={[4,4,0,0]}/></BarChart></ResponsiveContainer></Card>
      <Donut title={`${evento} por grupo`} subtitle="Grupos inferidos pelo nome do credor" data={porGrupo}/></div>
    <Card title={`${evento} mês a mês`} subtitle="Cada linha é um exercício"><ResponsiveContainer width="100%" height={280}><LineChart data={mensal}><CartesianGrid stroke="#e7ece8" vertical={false}/><XAxis dataKey="mes" axisLine={false} tickLine={false}/><YAxis tickFormatter={compact.format} axisLine={false} tickLine={false}/><Tooltip formatter={v=>brl.format(v)}/><Legend/>{anos.map(a=><Line key={a} type="monotone" dataKey={a} stroke={corAno(a)} strokeWidth={3} dot={false}/>)}</LineChart></ResponsiveContainer></Card>
    <Card title="Execução por grupo de despesa" subtitle="Todas as fases, no período filtrado"><div className="table-wrap"><table><thead><tr><th></th><th>Grupo</th><th>Empenhado líquido</th><th>Liquidado</th><th>Pago</th><th>Anulado</th><th>Participação no pago</th></tr></thead><tbody>{tabela.map(t=><tr key={t.g}><td><i className="dot" style={{background:corGrupo(t.g)}}/></td><td><strong>{t.g}</strong></td><td>{brl.format(t.empenhado)}</td><td>{brl.format(t.liquidado)}</td><td><strong>{brl.format(t.pago)}</strong></td><td>{brl.format(t.anulado)}</td><td>{share(t.pago,ex.pago)}</td></tr>)}</tbody></table></div></Card>
    <div className="notice gold"><AlertTriangle/><div><strong>Grupos de despesa são indicativos</strong><p>A API do TCE-SP não informa o elemento de despesa de cada lançamento. Os grupos foram deduzidos pelo nome do credor: pagamentos ao próprio instituto correspondem à folha (aposentadorias, pensões e pessoal), e os lançamentos ao TJ-SP correspondem a depósitos judiciais.</p></div></div>
  </Page>;
}

function Creditors({f,filtros}){
  const [evento,setEvento]=useState("Pago"); const [grupo,setGrupo]=useState(""); const [pessoa,setPessoa]=useState(""); const [busca,setBusca]=useState(""); const [limite,setLimite]=useState(50);
  const rows=f.despesas.filter(r=>r.evento===evento&&(!grupo||r.grupo===grupo)&&(!pessoa||r.pessoa===pessoa)&&(!busca||semAcento(`${r.fornecedor} ${r.idFornecedor}`).includes(semAcento(busca))));
  const {anos}=filtros; const total=soma(rows);
  // agrupa pelo CNPJ/CPF: o mesmo credor aparece com grafias diferentes do nome ao longo dos anos
  const mapa=new Map(); for(const r of rows){const k=r.idFornecedor||semAcento(r.fornecedor); const o=mapa.get(k)||{nome:r.fornecedor,id:r.idFornecedor,grupo:r.grupo,qtd:0,total:0,...Object.fromEntries(anos.map(a=>[a,0]))}; o.qtd++; o.total+=r.valor; o[r.ano]=(o[r.ano]||0)+r.valor; mapa.set(k,o);}
  const ranking=[...mapa.values()].sort((a,b)=>b.total-a.total);
  const top=ranking.slice(0,10).map(r=>({name:r.nome.length>34?r.nome.slice(0,32)+"…":r.nome,value:r.total}));
  return <Page><PeriodFilter {...filtros}/>
    <div className="page-head"><div><span>CREDORES</span><h2>Quem recebeu do instituto</h2><p>Ranking de credores por fase da despesa, com busca por nome ou documento.</p></div><Segment options={["Empenhado","Liquidado","Pago","Anulação"]} value={evento} set={setEvento}/></div>
    <div className="field-filters"><ListFilter/><SelectFilter label="Grupo de despesa" value={grupo} set={setGrupo} options={GRUPOS_DESPESA.map(g=>g.nome)}/><SelectFilter label="Tipo de credor" value={pessoa} set={setPessoa} options={["Pessoa jurídica","Pessoa física"]}/><SearchFilter value={busca} set={setBusca} placeholder="Buscar credor ou CNPJ..."/></div>
    <div className="kpis three"><Kpi icon={Users} label="Credores" value={ranking.length.toLocaleString("pt-BR")} note={`${rows.length} lançamentos`}/><Kpi label={`Total ${evento.toLowerCase()}`} value={brl.format(total)} note="No filtro atual" tone="green"/><Kpi label="Maior credor" value={ranking[0]?share(ranking[0].total,total):"—"} note={ranking[0]?.nome||"—"} tone="gold"/></div>
    <Card title="10 maiores credores" subtitle={`${evento} no período filtrado`}><ResponsiveContainer width="100%" height={330}><BarChart data={top} layout="vertical" margin={{left:30}}><CartesianGrid stroke="#e7ece8" horizontal={false}/><XAxis type="number" tickFormatter={compact.format} axisLine={false} tickLine={false}/><YAxis dataKey="name" type="category" width={230} axisLine={false} tickLine={false} tick={{fontSize:9}}/><Tooltip formatter={v=>brl.format(v)}/><Bar dataKey="value" name={evento} fill="#147967" radius={[0,4,4,0]}/></BarChart></ResponsiveContainer></Card>
    <Card title="Ranking completo" subtitle={`${ranking.length} credores`}><div className="table-wrap"><table><thead><tr><th>#</th><th>Credor</th><th>Grupo</th>{anos.map(a=><th key={a}>{a}</th>)}<th>Total</th><th>Lançamentos</th><th>Part.</th></tr></thead><tbody>{ranking.slice(0,limite).map((r,i)=><tr key={r.nome+i}><td>{i+1}</td><td><strong>{r.nome}</strong><small>{r.id}</small></td><td><span className="pill">{r.grupo}</span></td>{anos.map(a=><td key={a}>{brl.format(r[a]||0)}</td>)}<td><strong>{brl.format(r.total)}</strong></td><td>{r.qtd}</td><td>{share(r.total,total)}</td></tr>)}</tbody></table></div>{ranking.length>limite&&<button className="more" onClick={()=>setLimite(l=>l+50)}>Mostrar mais 50</button>}</Card>
  </Page>;
}

function Entries({f,filtros}){
  const [tipo,setTipo]=useState("Despesas"); const [evento,setEvento]=useState(""); const [grupo,setGrupo]=useState(""); const [busca,setBusca]=useState(""); const [ordem,setOrdem]=useState("data"); const [pagina,setPagina]=useState(0);
  const porPagina=50; const isDesp=tipo==="Despesas";
  useEffect(()=>setPagina(0),[tipo,evento,grupo,busca,ordem,filtros.anos,filtros.meses]);
  const fonte=isDesp?f.despesas:f.receitas;
  const texto=r=>isDesp?`${r.fornecedor} ${r.idFornecedor} ${r.empenho} ${r.data}`:`${r.alinea} ${r.subalinea} ${r.aplicacao} ${r.fonte}`;
  const rows=fonte.filter(r=>(!isDesp||!evento||r.evento===evento)&&(!grupo||r.grupo===grupo)&&(!busca||semAcento(texto(r)).includes(semAcento(busca))))
    .sort(ordem==="valor"?(a,b)=>b.valor-a.valor:(a,b)=>b.ano-a.ano||b.mes-a.mes);
  const paginas=Math.max(1,Math.ceil(rows.length/porPagina)); const visiveis=rows.slice(pagina*porPagina,(pagina+1)*porPagina);
  const exportarCsv=()=>{const header=isDesp?["Ano","Mês","Evento","Empenho","Documento credor","Credor","Grupo","Data","Valor"]:["Ano","Mês","Fonte","Aplicação","Alínea","Subalínea","Natureza","Valor"];
    const body=rows.map(r=>isDesp?[r.ano,r.mes,r.evento,r.empenho,r.idFornecedor,r.fornecedor,r.grupo,r.data,r.valor.toFixed(2).replace(".",",")]:[r.ano,r.mes,r.fonte,r.aplicacao,r.alinea,r.subalinea,r.grupo,r.valor.toFixed(2).replace(".",",")]);
    const csv=[header,...body].map(l=>l.map(v=>`"${String(v??"").replaceAll('"','""')}"`).join(";")).join("\n");
    const url=URL.createObjectURL(new Blob(["﻿"+csv],{type:"text/csv;charset=utf-8"})); const a=document.createElement("a"); a.href=url; a.download=`ipsjbv-${tipo.toLowerCase()}.csv`; a.click(); URL.revokeObjectURL(url);};
  return <Page><PeriodFilter {...filtros}/>
    <div className="page-head"><div><span>DADOS BRUTOS</span><h2>Lançamentos AUDESP</h2><p>Cada linha enviada ao TCE-SP, com filtros, ordenação e exportação para Excel (CSV).</p></div><Segment options={["Despesas","Receitas"]} value={tipo} set={t=>{setTipo(t);setGrupo("");setEvento("")}}/></div>
    <div className="field-filters"><ListFilter/>{isDesp&&<SelectFilter label="Evento" value={evento} set={setEvento} options={["Empenhado","Reforço","Anulação","Liquidado","Pago"].filter(e=>f.despesas.some(r=>r.evento===e))}/>}<SelectFilter label={isDesp?"Grupo de despesa":"Natureza"} value={grupo} set={setGrupo} options={(isDesp?GRUPOS_DESPESA:GRUPOS_RECEITA).map(g=>g.nome)} all="Todos"/><SearchFilter value={busca} set={setBusca} placeholder={isDesp?"Credor, CNPJ, empenho ou data...":"Alínea, aplicação ou fonte..."}/><label className="select-filter"><span>Ordenar por</span><select value={ordem} onChange={e=>setOrdem(e.target.value)}><option value="data">Mais recentes</option><option value="valor">Maior valor</option></select></label><button className="reset primary" onClick={exportarCsv}><Download/> Exportar CSV</button></div>
    <Card title={`${rows.length.toLocaleString("pt-BR")} lançamentos`} subtitle={`Soma: ${brl2.format(soma(rows))}`}><div className="table-wrap"><table><thead>{isDesp?<tr><th>Mês</th><th>Credor</th><th>Evento</th><th>Empenho</th><th>Data</th><th>Grupo</th><th>Valor</th></tr>:<tr><th>Mês</th><th>Alínea</th><th>Aplicação</th><th>Fonte</th><th>Natureza</th><th>Valor</th></tr>}</thead>
      <tbody>{visiveis.map((r,i)=>isDesp?<tr key={i}><td>{MESES[r.mes-1]}/{r.ano}</td><td><strong>{r.fornecedor}</strong><small>{r.idFornecedor}</small></td><td><span className="pill">{r.evento}</span></td><td>{r.empenho}</td><td>{r.data}</td><td>{r.grupo}</td><td><strong>{brl2.format(r.valor)}</strong></td></tr>
        :<tr key={i}><td>{MESES[r.mes-1]}/{r.ano}</td><td><strong>{r.alinea}</strong>{r.subalinea&&<small>{r.subalinea}</small>}</td><td>{r.aplicacao}</td><td>{r.fonte}</td><td><span className="pill">{r.grupo}</span></td><td className={r.valor<0?"negative":""}><strong>{brl2.format(r.valor)}</strong></td></tr>)}</tbody></table></div>
      <div className="pager"><button disabled={pagina===0} onClick={()=>setPagina(p=>p-1)}>Anterior</button><span>Página {pagina+1} de {paginas}</span><button disabled={pagina>=paginas-1} onClick={()=>setPagina(p=>p+1)}>Próxima</button></div></Card>
  </Page>;
}

function Sources({dados}){
  const anos=Object.entries(dados.mesesComDados).map(([a,m])=>`${a}: ${MESES[m[0]-1].toLowerCase()} a ${MESES[m.at(-1)-1].toLowerCase()}`);
  return <Page><div className="page-head"><div><span>TRANSPARÊNCIA</span><h2>Fontes e método</h2><p>De onde vêm os números e como foram tratados.</p></div></div>
    <div className="grid two"><Card title="Fonte dos dados" subtitle="API pública de transparência do TCE-SP (AUDESP)"><div className="source-list">
      <div><FileText/><span><strong>Despesas</strong><small>transparencia.tce.sp.gov.br/api/json/despesas/sao-joao-da-boa-vista/ano/mês</small></span><CheckCircle2/></div>
      <div><FileText/><span><strong>Receitas</strong><small>transparencia.tce.sp.gov.br/api/json/receitas/sao-joao-da-boa-vista/ano/mês</small></span><CheckCircle2/></div>
      <div><Landmark/><span><strong>Órgão filtrado</strong><small>{dados.orgao}</small></span><CheckCircle2/></div>
      <div><CalendarRange/><span><strong>Meses disponíveis</strong><small>{anos.join(" · ")}</small></span><CheckCircle2/></div>
      <div><Download/><span><strong>Coleta</strong><small>{new Date(dados.geradoEm).toLocaleString("pt-BR")} · {dados.receitas.length} receitas e {dados.despesas.length} despesas</small></span><CheckCircle2/></div></div></Card>
    <Card title="Método" subtitle="Regras aplicadas aos lançamentos"><ol className="method">
      <li><strong>Receita arrecadada</strong><span>Soma de vl_arrecadacao. Valores negativos (perdas de aplicações, estornos) são mantidos.</span></li>
      <li><strong>Empenhado líquido</strong><span>Empenhos + reforços − anulações.</span></li>
      <li><strong>Resultado</strong><span>Receita arrecadada − despesa liquidada, nos meses filtrados.</span></li>
      <li><strong>Natureza da receita</strong><span>Pelo código da alínea: 1215 servidor, 7215 patronal, 7999 aportes, 1321 rendimentos, 199903 COMPREV.</span></li>
      <li><strong>Grupo da despesa</strong><span>Inferido pelo credor, pois a API não traz o elemento de despesa.</span></li></ol></Card></div>
    <div className="notice green"><RotateCcw/><div><strong>Como atualizar os dados</strong><p>Na pasta do projeto, rode <code>npm run dados</code> (ou <code>python scripts/coletar_audesp.py</code>). O coletor consulta a API mês a mês e regrava public/data/ipsjbv.json; depois rode <code>npm run build</code> ou envie ao GitHub para publicar.</p></div></div>
  </Page>;
}

function Donut({title,subtitle,data}){const total=data.reduce((a,d)=>a+d.value,0); return <Card title={title} subtitle={subtitle}><div className="donut-row"><ResponsiveContainer width="45%" height={240}><PieChart><Pie data={data} dataKey="value" nameKey="name" innerRadius={60} outerRadius={92} paddingAngle={2}>{data.map(d=><Cell key={d.name} fill={corGrupo(d.name)}/>)}</Pie><Tooltip formatter={v=>brl.format(v)}/></PieChart></ResponsiveContainer><div className="legend-block">{data.map(d=><div key={d.name}><i style={{background:corGrupo(d.name)}}/><strong>{d.name}</strong><span>{brl.format(d.value)} · {share(d.value,total)}</span></div>)}</div></div></Card>}
function Page({children}){return <div className="page">{children}</div>}
function Card({title,subtitle,children}){return <section className="card"><div className="card-title"><div><h3>{title}</h3><p>{subtitle}</p></div></div>{children}</section>}
function Kpi({icon:Icon,label,value,note,tone=""}){return <div className={`kpi ${tone}`}><div>{Icon&&<Icon/>}<span>{label}</span></div><strong>{value}</strong><p>{note}</p></div>}
function Insight({tone,title,text}){return <div className={`insight ${tone}`}><i/><div><strong>{title}</strong><p>{text}</p></div></div>}
function Segment({options,value,set}){return <div className="segment">{options.map(o=><button className={value===o?"active":""} onClick={()=>set(o)} key={o}>{o}</button>)}</div>}

createRoot(document.getElementById("root")).render(<App/>);
