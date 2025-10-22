# Orçamentos Backend (Node.js)

API organizada, segura e simples para orçamentos: autenticação JWT, CRUD (clientes/peças/serviços/orçamentos), upload de imagens e geração/baixa de PDFs.

## Estrutura de pastas

```
backend/
    ├─ prisma/                 # schema e migrações do banco (MySQL)
  │   └─ schema.prisma
  ├─ uploads/               # estáticos gerados/armazenados
  │   ├─ images/            # imagens enviadas (logos, etc.)
  │   └─ pdf/               # PDFs gerados de orçamentos
  └─ src/
      ├─ server.js          # bootstrap do servidor Express
      ├─ config/            # (reservado p/ configs futuras)
      ├─ db/
      │   └─ prisma.js      # cliente Prisma
      ├─ middlewares/
      │   └─ auth.js        # autenticação por JWT
      ├─ controllers/       # lógica de cada recurso
      │   ├─ auth.controller.js
      │   ├─ clientes.controller.js
      │   ├─ pecas.controller.js
      │   ├─ servicos.controller.js
      │   └─ orcamentos.controller.js
      ├─ routes/
      │   ├─ index.js       # roteador principal /api
      │   └─ v1/            # rotas versionadas
      │       ├─ auth.js
      │       ├─ clientes.js
      │       ├─ pecas.js
      │       ├─ servicos.js
      │       └─ orcamentos.js
      └─ utils/
          ├─ paths.js       # criação de diretórios
          └─ pdf/
              └─ generate.js # utilitário para gerar PDFs
```

## Endpoints principais (v1)
- Auth: `POST /api/v1/auth/login`, `GET /api/v1/auth/me`
- Clientes: `GET/POST /api/v1/clientes`, `DELETE /api/v1/clientes/:id`
- Peças: `GET/POST /api/v1/pecas`, `DELETE /api/v1/pecas/:id`
- Serviços: `GET/POST /api/v1/servicos`, `DELETE /api/v1/servicos/:id`
- Orçamentos: `GET/POST /api/v1/orcamentos`, `PATCH /api/v1/orcamentos/:id/status`, `DELETE /api/v1/orcamentos/:id`, `GET /api/v1/orcamentos/:id/pdf`
- Uploads: `POST /api/v1/files/image` (form-data: image)

## Segurança
- Helmet, CORS restrito por `CORS_ORIGIN`.
- JWT com expiração (configurável via `JWT_EXPIRES_IN`).
- Rate limit básico em `/api`.
- Validação com Zod.

## Variáveis de ambiente
Veja `.env.example`.

## Banco
- Prisma + MySQL. Funciona em local, Railway, etc. Configure `DATABASE_URL` e rode:

```
npm run prisma:generate
npm run prisma:push   # cria tabelas conforme schema
```

## Desenvolvimento
- Node >= 18
- Instalar e rodar:

```
npm install
npm run dev
```

API sobe em `http://localhost:3001`.

### Railway (MySQL)
1. Defina `DATABASE_URL` no arquivo `.env` com a URL do Railway.
2. Execute a configuração uma vez (criação de tabelas + seed admin):

```
npm run db:setup-railway
```

3. Opcional: para ver dados/estrutura:

```
node scripts/consultar-banco.js
node scripts/consultar-estrutura.js clientes
```

Você pode remover o arquivo `scripts/setup-railway.js` após a configuração inicial.
