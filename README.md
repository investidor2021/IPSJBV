# GovFinance · Previdência de São João da Boa Vista

Painel do Instituto de Previdência dos Servidores Públicos Municipais de São João da Boa Vista (IPSJBV), com receitas e despesas de 2024, 2025 e 2026 enviadas ao AUDESP/TCE-SP.

Segue o mesmo modelo do painel de São Sebastião da Grama (React + Vite + Recharts), mas os números vêm da API pública do TCE-SP em vez de valores digitados.

## Abas
- **Visão executiva:** receita, despesa liquidada, resultado, composição e leitura automática.
- **Receitas:** por natureza (contribuição do servidor, patronal, aportes, rendimentos, COMPREV), por alínea e mês a mês.
- **Despesas & execução:** empenhado líquido, liquidado, pago e anulado, por exercício e por grupo.
- **Credores:** ranking por CNPJ/CPF, com busca.
- **Lançamentos:** todas as linhas do AUDESP, com filtros e exportação CSV.
- **Fontes & método:** origem dos dados e regras de cálculo.

Todas as abas têm filtro de exercícios e meses. O botão "Mesmo período" compara os anos nos mesmos meses do último exercício.

## Atualizar os dados
```powershell
npm run dados      # ou: python scripts/coletar_audesp.py
npm run build
```
O coletor consulta `transparencia.tce.sp.gov.br/api/json/{despesas|receitas}/sao-joao-da-boa-vista/{ano}/{mes}`, guarda só o órgão IPSJBV e regrava `public/data/ipsjbv.json`. Para outros anos: `python scripts/coletar_audesp.py 2023 2024`.

## Rodar
```powershell
npm install
npm run dev        # desenvolvimento
```
Depois do `npm run build`, a pasta `dist` roda sozinha com dois cliques em `Iniciar GovFinance.bat`, sem precisar de Node.

## Publicar
O workflow `.github/workflows/deploy.yml` publica no GitHub Pages a cada push na branch `main`, como no projeto de São Sebastião da Grama.

## Limitação
A API do TCE-SP não informa o elemento de despesa. Os grupos de despesa (folha de benefícios, TJ-SP, pessoas físicas, serviços administrativos) são deduzidos pelo nome do credor.
