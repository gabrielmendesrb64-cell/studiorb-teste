# Chá dos Noivos — Daniel e Núbia

Site completo em Node.js para convite, confirmação de presença e lista de presentes do chá dos noivos.

## O que está incluído

- Visual creme + verde oliva inspirado na referência aprovada.
- Ilustração de Daniel e Núbia integrada ao topo sem ficar gigante.
- Data, horário e local configuráveis pela Área dos Noivos.
- Lista de presentes com foto, categoria, descrição e link exato do produto.
- Dois botões em cada presente: **Ver presente desejado** e **Quero presentear**.
- Ao reservar, o presente fica indisponível para outras pessoas.
- Área dos Noivos separa presentes em Disponíveis, Reservados e Já presenteados/Entregues.
- Confirmação de presença sem telefone: cada família pode adicionar vários nomes completos na mesma confirmação.
- PIX fixo configurável: permanece sempre disponível e cada pessoa escolhe o valor que quiser enviar.
- Área dos Noivos mostra o total de pessoas confirmadas e os nomes enviados por cada família/grupo.
- Layout responsivo para celular e computador.

## Rodar localmente

1. Instale Node.js 18 ou mais recente.
2. Entre na pasta do projeto.
3. Defina uma senha segura para a área dos noivos.
4. Execute:

```bash
npm start
```

O site usa a porta definida por `PORT` ou, por padrão, `3000`.

## Variáveis de ambiente recomendadas no Render

```env
ADMIN_PASSWORD=coloque-uma-senha-forte
ADMIN_SECRET=coloque-uma-chave-longa-e-aleatoria
NODE_ENV=production
```

O Render define `PORT` automaticamente.

## Área dos Noivos

Acesse `/admin`.

Nela é possível:

- cadastrar presentes;
- informar o link do produto;
- buscar a imagem automaticamente quando a loja permite;
- acompanhar quem reservou;
- liberar uma reserva;
- marcar como entregue;
- excluir presentes;
- alterar data, horário, local e textos;
- configurar a chave PIX fixa e o nome do recebedor;
- visualizar e excluir confirmações de presença.

## Persistência

Os dados ficam em `data/db.json`. Em hospedagens com disco efêmero, como configurações padrão de alguns serviços, use um disco persistente ou banco de dados antes de colocar o site em uso definitivo, para evitar perda de dados após redeploy/restart.
