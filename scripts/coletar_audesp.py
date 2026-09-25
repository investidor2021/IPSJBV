"""
Coleta receitas e despesas do Instituto de Previdência de São João da Boa Vista (IPSJBV)
na API pública do TCE-SP (AUDESP) e grava em public/data/ipsjbv.json.

A API exige uma chamada por município/ano/mês e devolve todos os órgãos do município
(Prefeitura, Câmara, FAE, IPSJBV); aqui guardamos só as linhas do instituto.

Uso:
    python scripts/coletar_audesp.py              # 2024, 2025 e 2026
    python scripts/coletar_audesp.py 2025 2026    # só os anos informados
"""
import json
import sys
import time
import unicodedata
import urllib.request
from concurrent.futures import ThreadPoolExecutor
from datetime import date, datetime
from decimal import Decimal, InvalidOperation
from pathlib import Path

TCE_BASE = "https://transparencia.tce.sp.gov.br/api/json"
MUNICIPIO = "sao-joao-da-boa-vista"
ORGAO_CHAVE = "IPSJBV"
ANOS_PADRAO = [2024, 2025, 2026]
SAIDA = Path(__file__).resolve().parent.parent / "public" / "data" / "ipsjbv.json"


def get_json(url):
    ultimo_erro = None
    for tentativa in range(4):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": "Previdencia-SJBV/1.0"})
            with urllib.request.urlopen(req, timeout=120) as resp:
                dados = json.loads(resp.read().decode("utf-8"))
                return dados if isinstance(dados, list) else []
        except Exception as exc:
            ultimo_erro = exc
            time.sleep(1.5 * (tentativa + 1))
    raise RuntimeError(f"Falha ao consultar {url}: {ultimo_erro}")


def valor_br(texto):
    if texto in (None, ""):
        return 0.0
    limpo = str(texto).replace("R$", "").replace(" ", "").replace(".", "").replace(",", ".")
    try:
        return float(Decimal(limpo))
    except InvalidOperation:
        return 0.0


def normalizar_evento(texto):
    t = unicodedata.normalize("NFKD", texto or "").encode("ascii", "ignore").decode().lower()
    if "liquid" in t:
        return "Liquidado"
    if "pago" in t or "pagamento" in t:
        return "Pago"
    if "anula" in t:
        return "Anulação"
    if "refor" in t:
        return "Reforço"
    if "empenh" in t:
        return "Empenhado"
    return (texto or "").strip() or "Outro"


def eh_instituto(linha):
    return ORGAO_CHAVE in (linha.get("orgao") or "").upper()


def coletar_mes(ano, mes):
    despesas = [r for r in get_json(f"{TCE_BASE}/despesas/{MUNICIPIO}/{ano}/{mes}") if eh_instituto(r)]
    receitas = [r for r in get_json(f"{TCE_BASE}/receitas/{MUNICIPIO}/{ano}/{mes}") if eh_instituto(r)]
    return ano, mes, despesas, receitas


def main():
    anos = [int(a) for a in sys.argv[1:]] or ANOS_PADRAO
    hoje = date.today()
    alvos = [(ano, mes) for ano in anos for mes in range(1, 13)
             if (ano, mes) <= (hoje.year, hoje.month)]

    print(f"Consultando {len(alvos)} meses na API do TCE-SP...")
    orgao_nome = ""
    receitas, despesas, meses_com_dados = [], [], {}
    with ThreadPoolExecutor(max_workers=4) as pool:
        for ano, mes, desp, rec in pool.map(lambda am: coletar_mes(*am), alvos):
            print(f"  {mes:02d}/{ano}: {len(desp)} despesas, {len(rec)} receitas")
            if desp or rec:
                meses_com_dados.setdefault(str(ano), []).append(mes)
            for r in desp:
                orgao_nome = orgao_nome or r.get("orgao", "")
                despesas.append([ano, mes, normalizar_evento(r.get("evento")), r.get("nr_empenho") or "",
                                 r.get("id_fornecedor") or "", (r.get("nm_fornecedor") or "").strip(),
                                 r.get("dt_emissao_despesa") or "", valor_br(r.get("vl_despesa"))])
            for r in rec:
                orgao_nome = orgao_nome or r.get("orgao", "")
                receitas.append([ano, mes, (r.get("ds_fonte_recurso") or "").strip(),
                                 (r.get("ds_cd_aplicacao_fixo") or "").strip(), (r.get("ds_alinea") or "").strip(),
                                 (r.get("ds_subalinea") or "").strip(), valor_br(r.get("vl_arrecadacao"))])

    resultado = {
        "municipio": "São João da Boa Vista",
        "orgao": orgao_nome,
        "fonte": f"{TCE_BASE}/{{despesas|receitas}}/{MUNICIPIO}/{{ano}}/{{mes}}",
        "geradoEm": datetime.now().isoformat(timespec="seconds"),
        "anos": anos,
        "mesesComDados": {k: sorted(v) for k, v in meses_com_dados.items()},
        "colunasReceitas": ["ano", "mes", "fonte", "aplicacao", "alinea", "subalinea", "valor"],
        "colunasDespesas": ["ano", "mes", "evento", "empenho", "idFornecedor", "fornecedor", "data", "valor"],
        "receitas": receitas,
        "despesas": despesas,
    }
    SAIDA.parent.mkdir(parents=True, exist_ok=True)
    SAIDA.write_text(json.dumps(resultado, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    print(f"\nGravado em {SAIDA}: {len(receitas)} receitas e {len(despesas)} despesas.")


if __name__ == "__main__":
    main()
