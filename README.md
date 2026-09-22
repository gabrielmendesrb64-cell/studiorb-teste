# Daniel & Nubia — Chá de Casa Nova

Site de lista de presentes com reserva por convidado e painel privado.

## Como rodar
1. Instale Node.js 18+
2. Rode `npm install`
3. Rode `npm start`
4. Abra `http://localhost:3000`
5. Painel: `http://localhost:3000/admin`

## Login inicial local
Usuário: `danielnubia`
Senha: `troque-esta-senha`

Em produção, altere ADMIN_USER, ADMIN_PASSWORD e SESSION_SECRET pelas variáveis de ambiente.

## Banco de dados
Sem `DATABASE_URL`, o projeto salva tudo em `data.json` (ótimo para testar localmente).
Em hospedagem como Render, use PostgreSQL e configure `DATABASE_URL`, porque o disco padrão pode ser reiniciado e perder dados locais.

## O que já funciona
- Lista de presentes responsiva
- Categorias e busca
- Quantidade por item (ex.: 6 jogos de toalha)
- Reserva com nome + WhatsApp + confirmação
- Bloqueio automático quando atingir a quantidade
- Painel privado
- Ver convidado, telefone e presente escolhido
- Liberar reserva
- Adicionar, editar e excluir presentes
- Mensagens dos convidados
