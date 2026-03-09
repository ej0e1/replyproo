# ReplyPro Backend Prisma

Prisma telah dihubungkan ke backend NestJS untuk PostgreSQL multi-tenant ReplyPro.

Fail utama:

- `backend/prisma/schema.prisma`
- `backend/src/modules/prisma/prisma.module.ts`
- `backend/src/modules/prisma/prisma.service.ts`
- `backend/src/modules/tenants/tenants.service.ts`
- `backend/src/modules/tenants/tenants.controller.ts`

Command penting:

- `npm run prisma:generate`
- `npm run prisma:push`
- `npm run prisma:migrate`
- `npm run prisma:deploy`
- `npm run prisma:seed`

Cadangan flow tempatan:

1. pastikan `DATABASE_URL` betul
2. jalankan `npm install`
3. jalankan `npm run prisma:generate`
4. untuk initial sync, guna `npm run prisma:push`
5. isi demo data dengan `npm run prisma:seed`
6. selepas schema stabil, tukar ke migration flow dengan `npm run prisma:migrate`

Endpoint contoh untuk semak wiring:

- `GET /api/health`
- `GET /api/tenants`
- `GET /api/tenants/:slug`

Data demo yang dimasukkan:

- 1 tenant: `replypro-demo`
- 2 users: owner dan agent
- 2 channels WhatsApp
- 2 contacts
- 2 conversations
- sample messages, workflow, campaign, dan analytics harian

Kredensial demo selepas seed:

- `owner@replypro.demo` / `ReplyPro123!`
- `agent@replypro.demo` / `ReplyPro123!`
