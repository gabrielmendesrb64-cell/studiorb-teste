# Chá dos Noivos — Daniel & Núbia

Site responsivo em verde oliva e creme com:

- convite com **data, horário e local** editáveis;
- **confirmação de presença** com nome, telefone, resposta e recado;
- lista de presentes com categorias;
- cadastro, na Área dos Noivos, do **link exato de onde comprar**;
- tentativa automática de capturar a **foto do produto** a partir do link da loja (Open Graph/Twitter Card), com campo de imagem manual como alternativa;
- botão **Onde comprar** para o convidado abrir a loja;
- reserva do presente por nome e telefone;
- item reservado fica indisponível para outras pessoas;
- Área dos Noivos com presentes separados em **Disponíveis**, **Reservados para entregar no chá** e **Já presenteados / Entregues**;
- lista separada das confirmações de presença;
- ilustração de Daniel e Núbia na capa.

## Rodar

Requer Node.js 18 ou superior.

```bash
npm start
```

Acesse `http://localhost:3000`.

Área dos Noivos: `http://localhost:3000/admin`

## Senha da Área dos Noivos

Antes de publicar, configure as variáveis de ambiente:

```env
PORT=3000
ADMIN_PASSWORD=coloque-uma-senha-forte
ADMIN_SECRET=coloque-uma-chave-longa-e-aleatoria
```

O arquivo `.env.example` serve apenas como referência. Este projeto não carrega `.env` automaticamente; em Render/Railway/etc., cadastre as variáveis pelo painel da hospedagem.

## Foto automática do produto

Ao colar o link de uma loja, o servidor tenta ler a imagem informada nos metadados públicos da página (`og:image` ou `twitter:image`). Algumas lojas bloqueiam esse tipo de leitura. Quando isso acontecer, cole no campo opcional o link direto da foto do produto.

## Dados do evento

Entre na Área dos Noivos e preencha data, horário e local reais do chá. O site já exibe esses dados no convite e recebe confirmações dos convidados.
