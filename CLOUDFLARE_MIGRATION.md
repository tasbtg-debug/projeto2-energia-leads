# Migração segura para Cloudflare Pages — Projeto 2

## Situação
- Branch de preparação: `cloudflare-migration`; não modifica `main` nem o site Netlify.
- Frontend estático: `public/`; função Cloudflare: `functions/api/leads.js`.
- API: POST `/api/leads` (não usa a rota da Netlify).
- Persistência: Supabase existente; faturas no bucket privado `energy-bills`.
- WhatsApp: abre conversa com mensagem pré-preenchida; o visitante confirma o envio.

## Pré-requisitos
1. No Supabase, faça backup e confira a existência de `energy_leads`, coluna `ownership`, `protocol`, `bill_path` e bucket `energy-bills`. Se ainda não existirem, **revise** `schema.sql` antes de executar no SQL Editor. Não execute migrações cegamente em produção.
2. Cloudflare Dashboard → Workers & Pages → Create → Pages → Connect to Git → repositório `tasbtg-debug/projeto2-energia-leads`, branch `cloudflare-migration`.
3. Configuração de build: framework `None`, build command vazio, output directory `public`. Functions directory `functions/` na raiz.
4. Configurar Secrets no projeto Cloudflare (Production e Preview, conforme ambiente): `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`. **Nunca** incluir a chave no GitHub ou no HTML.
5. Publicar e verificar: GET `/api/leads` deve retornar 405; POST de teste com dados fictícios deve registrar um lead no Supabase; testar anexo PDF/foto e link assinado; conferir mensagem WhatsApp no desktop e celular.
6. Antes de divulgação, configurar domínio, consentimento/LGPD, política de retenção e proteção antispam (Turnstile + rate limiting). O endpoint atual tem validação e honeypot, mas não inclui proteção de taxa robusta.

## Atenção
- O protocolo só funcionará após configuração SQL; se a coluna não existir, o cadastro falhará.
- Arquivos são enviados como base64 em JSON (máximo 4 MB); em produção de alto tráfego, preferir upload direto com URL assinada.
- Não é envio automático de WhatsApp: o usuário precisa confirmar o envio.
- A branch `main` e a hospedagem Netlify permanecem intactas. Só altere o link público depois de testes completos.
