# ReplyPro Database

Fail `schema.sql` menyediakan schema awal untuk multi-tenant WhatsApp SaaS.

Skop utama:

- tenant dan ahli pasukan
- channel / nombor WhatsApp
- contact, conversation, messages
- workflow automations
- campaigns dan recipients
- analytics harian

Cadangan production:

1. partition `messages` ikut bulan
2. tambah row-level tenant scoping dalam ORM/service layer
3. archive payload webhook mentah ke cold storage jika volume tinggi
4. tambah audit log, billing tables, dan API key tables bila masuk fasa seterusnya
