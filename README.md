# Task Tracker (NestJS + PostgreSQL + React)

Aplicație de tip Jira: proiecte cu board **Scrum** (sprinturi + backlog) sau **Kanban**, task-uri
(titlu, descriere, status, labels, comentarii, assignee), workflow configurabil, **permisiuni pe
roluri** (Admin, Project Manager, Developer, QA, Viewer, plus orice rol nou creat de admin), board
și backlog **live** (WebSocket) și un frontend React complet (nu doar API).

**Arhitectura și deciziile (inclusiv de ce s-a schimbat ceva) sunt explicate în
[`docs/ARHITECTURA.md`](docs/ARHITECTURA.md).**

## Pornire rapidă

### Varianta 1: Docker (backend + Postgres)

```bash
docker compose up --build
```

Pornește doar backend-ul + baza de date. Frontend-ul se pornește separat (vezi mai jos).

### Varianta 2: local

Necesită Node 22+ și PostgreSQL 14+.

**Backend:**

```bash
cp .env.example .env
npm install
npm run start:dev
```

Migrațiile rulează automat la pornire (`DB_MIGRATIONS_RUN=true`), iar la prima pornire se creează
rolurile de sistem și adminul din `.env`.

- API: `http://localhost:3000/api`
- Swagger: `http://localhost:3000/api/docs`
- Admin implicit: `admin@tracker.local` / `Admin123!` (schimbă-l în `.env`)

**Frontend** (în alt terminal, din `frontend/`):

```bash
cd frontend
npm install
npm run dev
```

- Interfață: `http://localhost:5173` (proxy automat către backend pe `3000`, inclusiv WebSocket)

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

1. **Admin** se loghează și creează un proiect Company-managed, sau orice utilizator creează unul
   Team-managed și devine automat PM pe el: `POST /api/projects { key: "WEB", name, boardType: "SCRUM" }`.
2. Utilizatorii se înregistrează (`POST /api/auth/register`) și nu au acces la nimic, până când:
   - **PM/admin** îi adaugă direct: `POST /api/projects/:id/members { userId, roleId }`, sau
   - **PM/admin** îi invită, iar ei acceptă/refuză: `POST /api/projects/:id/invites` → `POST /api/invites/:id/accept`, sau
   - **ei cer** acces (sau alt rol, dacă sunt deja membri): `POST /api/join-requests`, iar admin aprobă/respinge.
3. Se creează task-uri (`WEB-1`, `WEB-2`, ...), se asignează și se mută prin workflow:
   `POST /api/tasks/WEB-1/transitions { status: "IN_PROGRESS" }`.
4. PM planifică sprintul: `POST .../sprints`, `PUT /api/tasks/WEB-1/sprint`, `POST .../sprints/:id/start`.
5. Board: `GET /api/projects/:id/board` — se actualizează live (WebSocket) la orice schimbare.

## Endpoint-uri principale

| Zonă | Endpoint-uri |
|---|---|
| Config | `GET /config/public` *(fără autentificare)* — feature flags pentru client |
| Auth | `POST /auth/register`, `POST /auth/login`, `POST /auth/refresh` *(rotește refresh token-ul)*, `POST /auth/logout`, `POST /auth/logout-all`, `GET /auth/sessions`, `DELETE /auth/sessions/:id` |
| Users | `GET/PATCH /users/me`, `GET /users`, `GET /users/:id`, `POST /users` *(admin)*, `PATCH /users/:id` *(admin)*, `DELETE /users/:id` *(admin; fails if they authored tasks/comments — deactivate instead)* |
| Roles | `GET /roles`, `GET /roles/permissions`, `POST/PATCH/DELETE /roles/:id` *(admin)* |
| Projects | `POST /projects` *(admin: orice tip; altfel: doar Team-managed, devii PM)*, `GET /projects`, `GET /projects/directory` *(toate proiectele, pentru cereri de acces)*, `GET/PATCH /projects/:id`, `DELETE /projects/:id` *(admin)* |
| Members | `GET/POST /projects/:id/members`, `PATCH/DELETE /projects/:id/members/:userId` |
| Join requests | `POST /join-requests` *(acces nou sau schimbare de rol dacă ești deja membru)*, `GET /join-requests/mine`, `GET /join-requests` *(admin: toate; PM: doar proiectele lui)*, `POST /join-requests/:id/approve\|reject` *(admin sau PM cu `project.members.manage`)* |
| Invites | `POST /projects/:id/invites`, `GET /projects/:id/invites`, `GET /invites/mine`, `POST /invites/:id/accept\|decline` |
| Workflow | `GET /projects/:id/workflow`, `POST/PATCH/DELETE .../workflow/statuses[/:id]`, `POST/DELETE .../workflow/transitions[/:id]` |
| Sprints | `GET/POST /projects/:id/sprints`, `GET/PATCH/DELETE .../sprints/:sid`, `POST .../sprints/:sid/start`, `POST .../sprints/:sid/complete` |
| Tasks | `POST/GET /projects/:id/tasks` (filtre: `status, assignee=me|unassigned|<id>, label, sprintId, epicId, parentId, backlog, type, priority, q, sort`), `GET /projects/:id/board` *(fără epice/sub-task-uri)*, `GET /projects/:id/epics` *(epice + `taskCount`/`doneCount`)*, `GET/PATCH/DELETE /tasks/:idOrKey`, `GET/POST /tasks/:idOrKey/transitions`, `PUT /tasks/:idOrKey/assignee`, `PUT /tasks/:idOrKey/sprint` |
| Comments | `GET/POST /tasks/:idOrKey/comments`, `PATCH/DELETE /comments/:id` |
| Activity | `GET /tasks/:idOrKey/activity` *(istoric: cine a schimbat ce și când)*, `GET /activity` *(admin; peste toate proiectele, filtrabil `projectId`/`actorId`)* |

Toate rutele au prefixul `/api`. Pe lângă REST, serverul expune și un canal **WebSocket**
(Socket.IO, `/socket.io`) pentru actualizări live — vezi `docs/ARHITECTURA.md` §12.

## Configurare (`.env`)

| Variabilă | Implicit | Descriere |
|---|---|---|
| `DB_HOST/PORT/USER/PASSWORD/NAME` | `localhost/5432/postgres/postgres/task_tracker` | conexiunea Postgres |
| `DB_MIGRATIONS_RUN` | `true` | rulează migrațiile la pornire |
| `JWT_SECRET` | *(obligatoriu, min. 16 caractere)* | cheia de semnare JWT |
| `JWT_ACCESS_EXPIRES_IN` | `15m` | valabilitatea access token-ului (`JWT_EXPIRES_IN` e acceptat ca alias vechi) |
| `JWT_REFRESH_EXPIRES_IN` | `30d` | valabilitatea refresh token-ului |
| `REGISTRATION_ENABLED` | `true` | `false` = doar adminul creează conturi |
| `TEAM_PROJECTS_ENABLED` | `true` | `false` = doar adminul creează proiecte (niciun Team-managed self-service) |
| `ADMIN_EMAIL/PASSWORD/NAME` | – | primul admin, creat dacă nu există niciun admin |

## Migrații

```bash
npm run migration:generate -- src/database/migrations/NumeMigrare
```

```bash
npm run migration:run
```
