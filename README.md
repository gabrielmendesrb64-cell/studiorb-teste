# Chá dos Noivos — Núbia & Daniel

Site completo para lista de presentes do chá dos noivos, com visual verde oliva, área pública e área reservada para os noivos.

## O que já está pronto

- Página inicial responsiva para celular e computador.
- Lista de presentes por categoria.
- Convidado escolhe um presente, informa nome e telefone e confirma.
- Assim que confirmado, o presente fica indisponível para outras pessoas.
- Aviso claro para levar o presente no dia do chá.
- Aba “Sugestão de presente”.
- Área dos noivos em `/admin`.
- Cadastro e exclusão de presentes.
- Visualização do nome e telefone de quem reservou.
- Botão para liberar uma reserva.
- Botão para marcar presente como recebido.
- Edição da data, horário, local, título e mensagem do evento.
- Proteção da área dos noivos com senha.
- Dados salvos em `data/db.json`.

## Como rodar

1. Instale Node.js 18 ou mais recente.
2. Abra a pasta do projeto no terminal.
3. Não há dependências externas para instalar. Configure as variáveis de ambiente usando `.env.example` como referência. Em hospedagens como Render, coloque `ADMIN_PASSWORD` e `ADMIN_SECRET` diretamente nas variáveis do serviço.
4. Inicie:

```bash
npm start
```

5. Abra `http://localhost:3000`.
6. Área dos noivos: `http://localhost:3000/admin`.

## Importante sobre hospedagem

Este projeto usa um arquivo JSON para salvar as reservas. Em hospedagens onde o disco é apagado ao reiniciar ou fazer deploy, use um disco persistente ou migre os dados para um banco como PostgreSQL/Supabase antes de usar com convidados reais.

## Segurança

Troque obrigatoriamente `ADMIN_PASSWORD` e `ADMIN_SECRET` antes de publicar. O `ADMIN_SECRET` deve ser uma chave longa e difícil de adivinhar.
