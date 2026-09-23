# Chá dos Noivos — Daniel e Núbia

Site completo em Node.js para convite, confirmação de presença, PIX e lista de presentes.

## Principais funções

- Topo do site usando exatamente a arte/referência aprovada por Daniel e Núbia.
- Lista de presentes com foto, categoria, descrição e link exato para compra.
- Botões **Ver presente desejado** e **Quero presentear**.
- Cada presente aceita uma **quantidade desejada** de 1 a 100 unidades.
  - Exemplo: ao cadastrar “Kit de toalhas” com quantidade 5, até 5 pessoas diferentes podem reservar 1 unidade cada.
  - O site mostra quantas unidades ainda estão disponíveis.
- Confirmação de presença apenas com nomes completos.
  - Uma família pode adicionar vários nomes na mesma confirmação.
- PIX fixo, sempre disponível e sem limite de contribuições pelo site.
- Data, horário e local configuráveis.
- Área dos Noivos protegida por senha.
- Painel administrativo separado por unidades disponíveis, reservadas e entregues.
- No painel é possível ver quem reservou cada unidade, liberar uma reserva e marcar uma unidade como entregue.
- Layout responsivo para celular e computador.

## Área dos Noivos

Acesse:

`/admin`

### Senha inicial desta versão

`DanielNubia@2026`

Antes de colocar o site em uso definitivo, é recomendado trocar a senha no Render usando a variável `ADMIN_PASSWORD`.

## Variáveis de ambiente no Render

```env
ADMIN_PASSWORD=coloque-uma-senha-forte
ADMIN_SECRET=coloque-uma-chave-longa-e-aleatoria
NODE_ENV=production
```

O Render fornece a variável `PORT` automaticamente.

## Rodar localmente

Requer Node.js 18 ou superior.

```bash
npm start
```

Por padrão o servidor abre na porta 3000.

## Quantidade dos presentes

Na Área dos Noivos, ao cadastrar um presente existe o campo **Quantidade desejada**.

Também é possível alterar essa quantidade depois. A quantidade nunca pode ser reduzida para menos do que o número de unidades que já estão reservadas ou entregues.

## Persistência dos dados

Os dados ficam em `data/db.json`.

Em hospedagens com armazenamento efêmero, um novo deploy ou reinício pode apagar alterações feitas durante o uso. Para uso definitivo, utilize armazenamento persistente ou banco de dados.
