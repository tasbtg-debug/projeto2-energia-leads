# Projeto 2 — Captação de leads de energia

Projeto independente do formulário de seguros (Projeto 1). Formulário de 7 perguntas + revisão, API serverless Netlify Functions e persistência Supabase. WhatsApp destino padrão: +55 31 98491-9022 (alterável em `public/index.html`, variável `destination`).

## Publicação
1. Crie um **novo** site na Netlify (não publique sobre o Projeto 1). Faça deploy por repositório GitHub ou Netlify CLI; upload estático por arrastar pasta **não garante instalação da função API**.
2. Conecte o repositório com esta pasta na raiz. Netlify lê `netlify.toml` e instala as dependências de `package.json`.
3. No Supabase, escolha um projeto separado (recomendado) ou utilize o existente com a tabela separada. No SQL Editor execute `schema.sql`.
4. Em Netlify → Site configuration → Environment variables configure `SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY` (a chave **secret/service_role** fica SOMENTE no servidor, nunca no frontend). Faça novo deploy após configurar.
5. Abra `https://SEU-NOVO-SITE.netlify.app/.netlify/functions/leads` em GET: deve retornar `Método não permitido` (405), indicando que a função foi publicada.
6. Teste uma cotação fictícia e confira em Supabase → Table Editor → `energy_leads` se o registro foi salvo. Ao concluir, WhatsApp abre com a mensagem pronta; o cliente precisa apertar Enviar. Teste em celular e computador.
7. Edite `public/privacidade.html` com a identificação do controlador e contato antes de uso público. Obtenha consentimento apropriado e revise LGPD.

## Segurança
- A tabela não tem política pública de leitura ou escrita. A API usa service_role exclusivamente no ambiente serverless.
- Para produção, recomenda-se adicionar limitação de taxa e CAPTCHA/Turnstile no endpoint público, além de retenção e controle de acesso para administração.
- Não há painel administrativo incluído nesta primeira versão; os leads podem ser consultados por usuário autorizado no Supabase.
- Não há integração de envio automático pelo WhatsApp. É o próprio visitante quem confirma o envio na conversa aberta.

## Observações
O botão de conclusão primeiro tenta gravar na API e depois abre o WhatsApp, oferecendo link alternativo caso o redirecionamento seja bloqueado. Se a API falhar, o usuário será informado de que o registro não foi confirmado, mas poderá enviar pelo WhatsApp.
