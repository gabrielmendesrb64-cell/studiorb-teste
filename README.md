# LancheFlow — Sistema de pedidos e entregas

Projeto de servidor Node.js com interface responsiva/PWA, banco SQLite persistente e atualizações via Socket.IO.

## Instalação local

1. Instale **Node.js 20 ou 22**.
2. Copie `.env.example` para `.env`.
3. Troque obrigatoriamente `JWT_SECRET`, `ADMIN_EMAIL` e `ADMIN_PASSWORD` por valores fortes e privados.
4. Execute `npm install` e `npm start`.
5. Acesse `http://localhost:3000`.
6. Entre com o e-mail/senha do administrador cadastrados no `.env`. O administrador pode cadastrar equipe em **Admin > Criar funcionário**.

> Não foi possível executar `npm install` neste ambiente de geração, pois o acesso ao registry do npm não respondeu. O código foi verificado com `node --check`, mas a instalação e os fluxos end-to-end precisam ser testados antes de produção.

## Hospedagem

**Render (Web Service)**: crie um serviço Node, faça upload do repositório para um Git privado, use build command `npm install` e start command `npm start`. Configure `JWT_SECRET`, `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `DATABASE_PATH=/var/data/lanchonete.db` e as demais variáveis em Environment. Monte um **disco persistente em `/var/data`** (necessário para não perder pedidos, clientes e funcionários a cada deploy). Verifique se o plano contratado oferece disco persistente. Configure HTTPS no domínio. A variável `PORT` é fornecida pela hospedagem. Alternativas: VPS com disco e HTTPS ou serviço Docker com volume durável.

**Importante:** não use hospedagem efêmera sem volume persistente para este projeto. Backups consistentes da pasta/banco devem ser planejados. SQLite atende a uma loja com tráfego moderado; multi-instância requer migração para Postgres e sincronização distribuída para WebSocket.

## Contas e operação

- Clientes criam conta em **Criar conta**, escolhem produtos e fazem pedidos.
- Caixa/admin recebem pedidos e aceitam, recusam, registram pagamento e entregam retirada em balcão.
- Cozinha/admin iniciam preparo e marcam pronto.
- Motoboy ativa serviço, aceita corrida e retira com **código fornecido pelo caixa**. O caixa usa o botão `Código retirada` na operação para emitir código novo.
- Cliente acompanha em **Meus pedidos > Acompanhar**, e quando o motoboy estiver a caminho clica em `Gerar código de confirmação de entrega` (mostrar ao motoboy somente após receber o pedido).
- Motoboy finaliza com código fornecido pelo cliente; admin pode resolver exceções com motivo auditável.
- Administrador cadastra empregados, produtos, taxa fixa de entrega, acompanha receita registrada e registra pagamentos de entregadores.

### Recursos implementados

- Backend REST com autenticação por token e permissões por função.
- SQLite com pedidos, itens, categorias, adicionais, auditoria, entregas, pagamentos manuais, sessões de caixa e usuários.
- Atualização via Socket.IO para clientes conectados, painel de equipe e entregadores.
- Códigos de seis dígitos, hashes no servidor, vencimento e bloqueio após tentativas incorretas.
- Atribuição transacional de corridas; uma corrida por motoboy por vez.
- Dashboard simples e exportação de pedidos em CSV.
- PWA instalável via navegador com interface responsiva.
- Link de rota para Google Maps com endereço cadastrado.

### Limitações importantes (não considerar a aplicação pronta para produção comercial sem estes itens)

1. **Pix/cartão**: apenas registro de formas e confirmação MANUAL. Não há cobrança automática, integração com Mercado Pago, confirmação via webhook, nem estorno financeiro real. Os botões de registro de pagamento/estorno pressupõem que a operação aconteceu fora do sistema.
2. **Geolocalização**: gera link de direção pelo Google Maps; NÃO acompanha GPS ao vivo, calcula distâncias ou ETA e não integra com Waze.
3. **Notificações**: tempo real com site aberto; ainda não há Web Push em segundo plano, notificações nativas, alertas sonoros ou envio por WhatsApp.
4. **Financeiro**: relatório diário simples e caixa inicial/final; ainda não há conciliação bancária, turnos financeiros segregados, relatórios semanais/mensais, PDF e planilha Excel nativa.
5. **Administração**: CRUD inicial de produtos e funcionários; falta edição de categorias/adicionais, cupons, zonas por bairro, controle avançado de horários e upload de imagens.
6. **Segurança**: antes de expor a clientes reais, revisar LGPD (política de privacidade, retenção, exclusão), incluir testes automatizados, proteção contra fraudes, backup/restore e logs observáveis.
7. **Cliente**: código de entrega precisa ser gerado explicitamente pelo cliente e é mostrado na tela. Não é enviado via SMS.
8. **Infra**: dependências necessitam instalação online e teste em hospedagem real; nenhuma conta, pagamento ou serviço externo foi configurado.

## Teste funcional recomendado

1. Cadastre contas de caixa, cozinha e motoboy no admin.
2. Crie conta de cliente e faça pedido de entrega.
3. Confirme no caixa → inicie cozinha → marque pronto.
4. Ative motoboy e aceite a corrida.
5. Em caixa/operação gere código de retirada; no celular do motoboy digite o código.
6. Acompanhe como cliente, gere código de entrega; confirme na tela do motoboy.
7. Registre o pagamento manualmente apenas após recebê-lo de verdade.
8. Confira relatório, histórico e repasse do motoboy.
9. Teste rejeições, senha errada, tentativas de código, indisponibilidade e dois motoboys aceitando ao mesmo tempo.

## Arquivos

`server.js`: API, autenticação e banco. `public/app.js`: interface. `public/style.css`: visual. `.env.example`: configurações de produção. `public/sw.js`: cache PWA básico. `public/manifest.webmanifest`: instalabilidade.
