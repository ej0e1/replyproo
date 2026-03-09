# ReplyPro Docker Stack

Fail yang telah disediakan:

- `docker-compose.yml`
- `.env.example`
- `nginx/nginx.conf`
- `frontend/Dockerfile`
- `backend/Dockerfile`
- `worker/Dockerfile`

Langkah seterusnya:

1. Salin `.env.example` kepada `.env`
2. Tambah source code sebenar dalam `frontend/`, `backend/`, dan `worker/`
3. Pastikan setiap app ada `package.json`
4. Jalankan `docker compose up -d --build`

Nota:

- `frontend`, `backend`, dan `worker` belum ada source code, jadi build akan gagal selagi `package.json` dan app files belum dimasukkan.
- Stack ini disediakan sebagai production-style baseline architecture.
