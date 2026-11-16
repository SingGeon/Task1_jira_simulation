# Task Tracker (NestJS + PostgreSQL)

Aplicație de tip Jira: proiecte cu board **Scrum** (sprinturi + backlog) sau **Kanban**, task-uri
(titlu, descriere, status, labels, comentarii, assignee), workflow configurabil și **permisiuni pe
roluri** (Admin, Project Manager, Developer, QA, Viewer, plus orice rol nou creat de admin).

**Arhitectura și deciziile sunt explicate în [`docs/ARHITECTURA.md`](docs/ARHITECTURA.md).**

## Pornire rapidă

### Varianta 1: Docker (aplicație + Postgres)

```bash
docker compose up --build
```

### Varianta 2: local

Necesită Node 22+ și PostgreSQL 14+.

```bash
cp .env.example .env
```

```bash
npm install
```

```bash
npm run start:dev
```

Migrațiile rulează automat la pornire (`DB_MIGRATIONS_RUN=true`), iar la prima pornire se creează
rolurile de sistem și adminul din `.env`.

- API: `http://localhost:3000/api`
- Swagger: `http://localhost:3000/api/docs`
- Admin implicit: `admin@tracker.local` / `Admin123!` (schimbă-l în `.env`)

## Teste

```bash
npm test
```

```bash
npm run test:e2e
```

Testele e2e folosesc o bază Postgres separată, `task_tracker_test`, care trebuie să existe. Schema
e ștearsă și recreată la fiecare rulare. Ele acoperă tot fluxul: înregistrare cu acces minim,
proiect, membri, regulile Developer/QA/PM, workflow, sprinturi, board Kanban, crearea unui rol nou
și a unui status nou prin API, dezactivarea utilizatorilor.

## Flux tipic

1. **Admin** se loghează și creează proiectul: `POST /api/projects { key: "WEB", name, boardType: "SCRUM", leadId }`.
   `leadId` devine Project Manager.
2. Utilizatorii se înregistrează (`POST /api/auth/register`) și nu au acces la nimic.
3. **PM** îi adaugă în proiect cu un rol: `POST /api/projects/:id/members { userId, roleId }`.
4. Se creează task-uri (`WEB-1`, `WEB-2`, ...), se asignează și se mută prin workflow:
   `POST /api/tasks/WEB-1/transitions { status: "IN_PROGRESS" }`.
5. PM planifică sprintul: `POST .../sprints`, `PUT /api/tasks/WEB-1/sprint`, `POST .../sprints/:id/start`.
6. Board: `GET /api/projects/:id/board`.

## Endpoint-uri principale

| Zonă | Endpoint-uri |
|---|---|
| Auth | `POST /auth/register`, `POST /auth/login` |
| Users | `GET/PATCH /users/me`, `GET /users`, `GET /users/:id`, `POST /users` *(admin)*, `PATCH /users/:id` *(admin)* |
| Roles | `GET /roles`, `GET /roles/permissions`, `POST/PATCH/DELETE /roles/:id` *(admin)* |
| Projects | `POST /projects` *(admin)*, `GET /projects`, `GET/PATCH /projects/:id`, `DELETE /projects/:id` *(admin)* |
| Members | `GET/POST /projects/:id/members`, `PATCH/DELETE /projects/:id/members/:userId` |
| Workflow | `GET /projects/:id/workflow`, `POST/PATCH/DELETE .../workflow/statuses[/:id]`, `POST/DELETE .../workflow/transitions[/:id]` |
| Sprints | `GET/POST /projects/:id/sprints`, `GET/PATCH/DELETE .../sprints/:sid`, `POST .../sprints/:sid/start`, `POST .../sprints/:sid/complete` |
| Tasks | `POST/GET /projects/:id/tasks` (filtre: `status, assignee=me|unassigned|<id>, label, sprintId, backlog, type, priority, q, sort`), `GET /projects/:id/board`, `GET/PATCH/DELETE /tasks/:idOrKey`, `GET/POST /tasks/:idOrKey/transitions`, `PUT /tasks/:idOrKey/assignee`, `PUT /tasks/:idOrKey/sprint` |
| Comments | `GET/POST /tasks/:idOrKey/comments`, `PATCH/DELETE /comments/:id` |

Toate rutele au prefixul `/api`.

## Configurare (`.env`)

| Variabilă | Implicit | Descriere |
|---|---|---|
| `DB_HOST/PORT/USER/PASSWORD/NAME` | `localhost/5432/postgres/postgres/task_tracker` | conexiunea Postgres |
| `DB_MIGRATIONS_RUN` | `true` | rulează migrațiile la pornire |
| `JWT_SECRET` | *(obligatoriu, min. 16 caractere)* | cheia de semnare JWT |
| `JWT_EXPIRES_IN` | `1d` | valabilitatea token-ului |
| `REGISTRATION_ENABLED` | `true` | `false` = doar adminul creează conturi |
| `ADMIN_EMAIL/PASSWORD/NAME` | – | primul admin, creat dacă nu există niciun admin |

## Migrații

```bash
npm run migration:generate -- src/database/migrations/NumeMigrare
```

```bash
npm run migration:run
```
