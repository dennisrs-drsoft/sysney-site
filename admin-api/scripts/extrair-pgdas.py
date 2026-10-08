"""Leitura local de declarações oficiais; saída em JSON para o importador privado."""
import sys, json, re, hashlib
from pathlib import Path
from decimal import Decimal
from pypdf import PdfReader

def centavos(s):
    return int(Decimal(s.replace('.', '').replace(',', '.')) * 100)

rows = []
for path in sorted(Path(sys.argv[1]).glob('PGDASD-DECLARACAO-*.pdf')):
    text = '\n'.join(p.extract_text() for p in PdfReader(path).pages)
    if 'CNPJ Matriz: 57.767.099/0001-79' not in text:
        continue
    if 'Declaração Original' not in text:
        raise ValueError('Retificação exige conferência da versão vigente')
    declaration = re.search(r'Nº da Declaração: (\d+)', text).group(1)
    month, year = re.search(r'Período de Apuração: \d{2}/(\d{2})/(\d{4})', text).groups()
    summary = text.split('2.6) Resumo da Declaração')[1].split('2.7)')[0]
    pairs = re.findall(r'^([\d.]+,\d{2})\s+([\d.]+,\d{2})\s*$', summary, re.M)
    if len(pairs) != 1:
        raise ValueError('Resumo ambíguo: ' + path.name)
    rbt = re.search(r'ao PA \(RBT12\) ([\d.,]+)', text).group(1)
    proportional = re.search(r'ao PA proporcionalizada \(RBT12p\) ([\d.,]+)', text)
    activity = 'Anexo III · sem fator R · ISS próprio' if 'pelo Anexo III, sem retenção/substituição tributária de ISS' in text else 'Sem atividade / conferir documento'
    rows.append(dict(mes=f'{year}-{month}', declaracao=declaration,
        receita=centavos(pairs[0][0]), debito=centavos(pairs[0][1]), rbt12=centavos(rbt),
        rbt12p=centavos(proportional.group(1)) if proportional else None,
        regime=re.search(r'Regime de Apuração: ([^\n]+)', text).group(1), atividade=activity,
        arquivo=str(path.resolve()), sha256=hashlib.sha256(path.read_bytes()).hexdigest()))
if not rows or len({r['mes'] for r in rows}) != len(rows):
    raise ValueError('Nenhuma declaração ou versões duplicadas')
print(json.dumps(rows, ensure_ascii=True))
