# Arhitectura aplicației Task Tracker

Documentul descrie cum e construită aplicația și **de ce** am ales fiecare soluție.
Modelul de bază e Jira: proiecte, board Scrum sau Kanban, sprinturi, workflow de statusuri
și permisiuni pe roluri.

---

## 1. Principiul de bază: totul e configurabil prin date, nu prin cod

Cerința principală a fost ca aplicația să funcționeze și când **adaugi un utilizator nou,
un rol nou sau un task nou**. De aici a rezultat decizia centrală:

> **Rolurile, permisiunile și workflow-ul (statusurile) sunt date în baza de date, nu `if`-uri
> în cod.** Codul nu verifică niciodată numele unui rol (`if role === 'Developer'`). Verifică doar
> *permisiuni* (`task.transition`), iar rolul e doar o listă de permisiuni.

| Adaugi... | Ce trebuie făcut | Cod nou? |
|---|---|---|
| Utilizator nou | `POST /auth/register` sau, de către admin, `POST /users` | Nu |
| Rol nou (ex. „Tech Lead”) | Adminul face `POST /roles` cu lista de grant-uri | Nu |
| Status nou (ex. „Blocked”) | PM face `POST /projects/:id/workflow/statuses` și adaugă tranzițiile | Nu |
| Proiect nou | Adminul face `POST /projects`; workflow-ul implicit se creează automat | Nu |
| Task nou | `POST /projects/:id/tasks` primește automat cheia `WEB-1`, `WEB-2`... | Nu |
| *Un tip nou de acțiune* (ex. „poate exporta”) | Se adaugă o valoare în enum-ul `Permission` | Da (singurul caz) |

Testul e2e demonstrează asta: creează rolul „Tech Lead” și statusul „BLOCKED” prin API, iar
regulile se aplică imediat.

---

## 2. Stack tehnic

| Componentă | Alegere | De ce |
|---|---|---|
| Framework | **NestJS 11** | Cerut. Modulele, DI-ul, guard-urile și pipe-urile se potrivesc cu o aplicație cu multe reguli de acces. |
| Bază de date | **PostgreSQL 16** | Datele sunt puternic relaționale (proiect → membri → rol, task → status → workflow). Aveam nevoie de chei străine, tranzacții, constrângeri unique și de un **index unic parțial** („un singur sprint activ pe proiect”). Mongo nu garantează nimic din acestea la nivel de bază de date. |
| ORM | **TypeORM 0.3** + **migrații** | Integrare nativă cu Nest. Folosesc migrații, nu `synchronize: true`, ca schema să fie versionată și sigură în producție. |
| Auth | **JWT** (passport-jwt) + **bcrypt** | API stateless. Parolele sunt stocate doar ca hash. |
| Validare | **class-validator** + `ValidationPipe` global | Validare declarativă pe DTO-uri. |
| Docs API | **Swagger** la `/api/docs` | Documentația API se generează automat din cod. |
| Teste | **Jest**: unit + e2e pe Postgres real | Logica de permisiuni e testată izolat, iar fluxurile complete pe baza de date reală. |

---

## 3. Structura modulelor

```
src/
├── config/          încărcarea și validarea variabilelor de mediu
├── database/        DataSource, migrații, strategia de denumire snake_case
├── common/          guard-uri globale, decoratori (@Public, @AdminOnly, @CurrentUser), filtre de erori
├── access/          ★ MOTORUL DE PERMISIUNI (Permission, grant-evaluator, ProjectAccess, AccessControlService)
├── auth/            register / login / strategia JWT
├── users/           utilizatori + gestionarea lor de către admin
├── roles/           roluri (CRUD admin) + rolurile de sistem predefinite
├── projects/        proiecte + membri (user ↔ proiect ↔ rol)
├── workflow/        statusuri (coloanele board-ului) + tranziții permise
├── sprints/         sprinturi (doar în proiectele SCRUM)
├── tasks/           task-uri, board, backlog, tranziții, asignare
├── comments/        comentarii/notițe la task-uri
└── bootstrap/       seed idempotent: roluri de sistem + primul admin
```

Fiecare modul are aceeași structură: `entity` → `service` (logica de business) → `controller`
(doar rutare HTTP) → `dto` (validare).

---

## 4. Modelul de date

```mermaid
erDiagram
    USER ||--o{ PROJECT_MEMBER : "e membru în"
    ROLE ||--o{ PROJECT_MEMBER : "rolul în proiect"
    PROJECT ||--o{ PROJECT_MEMBER : ""
    PROJECT ||--o{ WORKFLOW_STATUS : "coloane"
    PROJECT ||--o{ WORKFLOW_TRANSITION : ""
    WORKFLOW_STATUS ||--o{ WORKFLOW_TRANSITION : "from / to"
    PROJECT ||--o{ SPRINT : ""
    PROJECT ||--o{ TASK : ""
    WORKFLOW_STATUS ||--o{ TASK : "status"
    SPRINT |o--o{ TASK : "null = backlog"
    USER |o--o{ TASK : "assignee / reporter"
    TASK ||--o{ COMMENT : ""
    USER ||--o{ COMMENT : "author"

    USER { uuid id; string email; enum systemRole "ADMIN|USER"; bool isActive }
    ROLE { uuid id; string name; jsonb grants; bool isSystem; bool isDefault }
    PROJECT { uuid id; string key "WEB"; enum boardType "SCRUM|KANBAN"; int taskCounter }
    WORKFLOW_STATUS { uuid id; string key "IN_QA"; enum category "TODO|IN_PROGRESS|DONE"; int position }
    SPRINT { uuid id; enum state "PLANNED|ACTIVE|CLOSED"; date startDate; date endDate }
    TASK { uuid id; string key "WEB-12"; string title; text description; text[] labels; enum type; enum priority; int storyPoints }
```

Decizii la nivel de model:

- **Două niveluri de roluri, ca în Jira.**
  - *Rolul global* (`systemRole`): doar `ADMIN` sau `USER`. Adminul gestionează utilizatorii, rolurile
    și proiectele.
  - *Rolul de proiect* (`ProjectMember.role`): același om poate fi **PM într-un proiect și Developer
    în altul**. Un singur rol global nu ar putea exprima asta.
- **Fiecare proiect are workflow-ul lui** (statusuri + tranziții), ca în Jira. Statusurile au o
  *categorie* (`TODO / IN_PROGRESS / DONE`) folosită de logică (de exemplu la închiderea sprintului:
  „ce nu e DONE se mută”), astfel încât nu depindem de numele statusurilor.
- **Backlog = task cu `sprintId = null`.** Nu există un tabel separat pentru backlog.
- **Cheile task-urilor (`WEB-12`)** sunt generate dintr-un contor pe proiect, incrementat atomic
  (`UPDATE … SET task_counter = task_counter + 1 RETURNING`). Așa nu apar duplicate la cereri
  simultane și numerele nu se refolosesc după ștergere.
- **Labels** sunt un `text[]` în Postgres, normalizate (lowercase, fără duplicate). Am ales asta în locul
  unui tabel separat fiindcă e suficient pentru filtrare (`?label=auth`) și mai simplu.
- **Comentariile** sunt o entitate separată (autor, dată, editare), nu un câmp text pe task.
- **Constrângeri în baza de date, nu doar în cod:** `email` unic, `project.key` unic, `(project, user)`
  unic la membri, `(project, status.key)` unic și **un singur sprint ACTIVE per proiect** (index unic
  parțial `WHERE state = 'ACTIVE'`). Chiar dacă două cereri trec simultan de verificarea din service,
  baza de date tot nu permite starea invalidă.

---

## 5. Autentificare și înregistrare

- `POST /api/auth/register` și `POST /api/auth/login` returnează `{ accessToken, user }`.
- Toate celelalte rute cer `Authorization: Bearer <token>`. Am pus **guard-ul JWT global**, ca
  rutele să fie protejate implicit: o rută nouă e protejată automat, iar pentru excepții se pune
  explicit `@Public()`. Așa nu poți uita să protejezi un endpoint.
- **Token-ul conține doar `sub` (id-ul utilizatorului).** La fiecare request utilizatorul se reîncarcă
  din DB. Dacă adminul dezactivează pe cineva sau îi schimbă rolul, efectul e **imediat**, nu abia
  când expiră token-ul.
- La login greșit mesajul e același pentru „email inexistent” și „parolă greșită”, ca să nu se poată
  afla ce email-uri există în sistem.

**Cum se creează conturile (cerința „NU alege utilizatorul”):**
- La înregistrare nu poți trimite un rol. Câmpurile necunoscute (`role`, `systemRole`) sunt
  **respinse cu 400** (`forbidNonWhitelisted`).
- Un cont nou primește **accesul minim**: `systemRole = USER` și **niciun proiect**. Nu vede nimic
  până când un PM sau admin nu îl adaugă într-un proiect.
- Când e adăugat într-un proiect fără un rol specificat, primește rolul marcat `isDefault`
  (**Viewer**, doar citire).
- Variabila `REGISTRATION_ENABLED=false` dezactivează complet înregistrarea. Atunci conturile le
  creează doar adminul (`POST /api/users`). Ambele variante cerute sunt suportate.
- **Primul admin** e creat automat la pornire din `ADMIN_EMAIL` / `ADMIN_PASSWORD`, doar dacă nu
  există încă niciun admin. Ultimul admin activ nu poate fi retrogradat sau dezactivat, ca să nu
  rămână sistemul fără administrator.

---

## 6. Motorul de permisiuni (RBAC cu condiții)

### 6.1 Concepte

```
Rol = listă de GRANT-uri
GRANT = { permission, scope?, statuses? }

permission : ce acțiune      (ex. task.transition)
scope      : al cui e task-ul ANY (oricare) | ASSIGNEE (asignat mie) | REPORTER (creat de mine)
statuses   : în ce status trebuie să fie task-ul acum (ex. ["IN_QA"]); gol = oricare
```

**Reguli de evaluare:**
- Între grant-uri se aplică **SAU**: dacă *oricare* grant se potrivește, acțiunea e permisă.
- Condițiile dintr-un grant se combină cu **ȘI**: scope **și** status trebuie să fie îndeplinite.
- **Adminul** (rol global) trece de toate verificările de proiect.
- Grant-urile cu condiții sunt acceptate doar pe permisiunile care țin de un task (`task.update`,
  `task.transition`, `task.assign`, `task.delete`). Altfel ar fi grant-uri care nu se potrivesc niciodată,
  așa că API-ul le respinge cu 400.

Cu aceste două operații (SAU între grant-uri, ȘI în interiorul unui grant) se pot exprima toate
regulile din cerință fără cod special:

| Cerință | Grant-uri |
|---|---|
| Developer nu schimbă statusul decât la task-urile lui | `{task.transition, scope: ASSIGNEE}` |
| QA modifică doar task-uri în QA **și** asignate lui | `{task.transition, scope: ASSIGNEE, statuses: [IN_QA]}` |
| (variantă) QA modifică task-uri în QA **sau** asignate lui | două grant-uri: `{…, statuses:[IN_QA]}` + `{…, scope: ASSIGNEE}` |
| PM modifică tot | toate permisiunile fără condiții |

> Am interpretat cerința pentru QA în varianta strictă (în status QA **și** asignat lui). Dacă
> se dorește varianta permisivă (SAU), adminul schimbă grant-urile rolului QA prin API, fără
> modificări de cod.

### 6.2 Catalogul de permisiuni

| Permisiune | Ce permite |
|---|---|
| `project.view` | să vadă proiectul, board-ul, task-urile, comentariile |
| `project.update` | setările proiectului + workflow-ul |
| `project.members.manage` | adăugare/scoatere membri, schimbarea rolurilor |
| `sprint.manage` | creare/start/închidere sprinturi, mutarea task-urilor între sprint și backlog |
| `task.create` | creare task |
| `task.update` | editare câmpuri (titlu, descriere, labels, prioritate...) |
| `task.transition` | schimbare status |
| `task.assign` | schimbare assignee |
| `task.assignable` | utilizatorul **poate primi** task-uri (ex. Viewer nu poate) |
| `task.delete` | ștergere task |
| `comment.create` | adăugare comentarii |
| `comment.manage` | editare/ștergere comentariile altora (autorul poate oricând modifica ale lui) |

`GET /api/roles/permissions` returnează catalogul, util pentru un UI de administrare a rolurilor.

### 6.3 Rolurile predefinite (seed)

| Rol | Ce poate |
|---|---|
| **Project Manager** | tot |
| **Developer** | vede, creează task-uri, comentează, poate primi task-uri; **editează** task-urile asignate lui sau create de el; **schimbă statusul** și **reasignează** doar task-urile asignate lui |
| **QA** | vede, creează task-uri (bug-uri), comentează, poate primi task-uri; **editează / schimbă statusul / reasignează** doar task-urile **în `IN_QA` și asignate lui** |
| **Viewer** *(implicit)* | doar citire |

Rolurile de sistem nu pot fi șterse sau redenumite, dar grant-urile lor pot fi editate de admin.
Seed-ul **nu suprascrie** rolurile existente la repornire, deci modificările adminului se păstrează.

### 6.4 Unde se face verificarea și de ce

```
Request ─► JwtAuthGuard (global) ─► AdminGuard (@AdminOnly) ─► ValidationPipe (DTO)
        ─► Controller ─► Service:
              access = acl.forProject(user, projectId)   // 404 dacă nu e membru
              access.assert(Permission.TASK_TRANSITION, task)  // 403 cu motivul
              + regulile de workflow (tranziție permisă?)      // 400
```

- **Verificarea se face în service, nu într-un guard generic.** Multe reguli depind de **starea
  task-ului** (cui e asignat, în ce status e). Un guard ar trebui să încarce task-ul înainte de
  controller, apoi service-ul l-ar reîncărca. În plus, rutele găsesc proiectul în moduri diferite
  (`/projects/:id/...` sau `/tasks/WEB-12`).
  Clasa `ProjectAccess` concentrează toată logica într-un singur loc, iar funcția pură
  `grantsAllow()` e testată unitar separat.
- **404 pentru cei care nu sunt membri, 403 pentru membrii fără drept.** Un utilizator din afară nu
  află nici măcar că proiectul sau task-ul există, în timp ce un membru primește un mesaj care explică
  ce îi lipsește, de exemplu:
  `Role 'QA' is not allowed to perform 'task.transition' on this task (allowed only when: the task is assigned to you AND the task is in status IN_QA)`.
- **Permisiunea și workflow-ul sunt două verificări separate.** Permisiunea decide *cine* poate muta
  task-ul, iar workflow-ul decide *unde* poate fi mutat (`TODO → DONE` e respins pentru toți,
  inclusiv pentru PM, cu lista de tranziții permise). Pentru un UI, `GET /tasks/:key/transitions`
  returnează doar mutările pe care utilizatorul curent le poate face efectiv (ca butoanele din Jira).
- **Endpoint-uri separate pentru acțiuni cu permisiuni diferite:** `PATCH /tasks/:id` (câmpuri),
  `POST /tasks/:id/transitions` (status), `PUT /tasks/:id/assignee`, `PUT /tasks/:id/sprint`.
  Dacă trimiți `status` prin `PATCH` primești 400. Fiecare acțiune are o singură permisiune, deci
  regulile nu se pot ocoli trimițând alte câmpuri.
- **„Assignable”:** nu poți asigna un task cuiva care nu e membru activ al proiectului sau al cărui rol
  nu are `task.assignable`. La scoaterea unui membru din proiect, task-urile lui sunt automat dezasignate.

---

## 7. Sprint vs. Kanban

Fiecare proiect are `boardType`:

- **SCRUM**
  - Task-urile stau în **backlog** (`sprintId = null`) sau într-un **sprint**.
  - Ciclul sprintului: `PLANNED → (start) → ACTIVE → (complete) → CLOSED`.
  - Poate exista **un singur sprint activ** pe proiect (verificat în service și garantat de index în DB).
  - La **complete**, task-urile neterminate (categoria ≠ DONE) se mută în backlog sau într-un sprint
    PLANNED ales. Cele terminate rămân în sprintul închis, ca istoric.
  - **Board-ul** (`GET /projects/:id/board`) afișează sprintul activ, grupat pe coloane (statusuri).
- **KANBAN**
  - Nu există sprinturi (API-ul răspunde cu 400 la încercarea de a crea unul).
  - Board-ul afișează toate task-urile, grupate pe statusuri.

Board-ul e construit din **statusurile workflow-ului**, deci un status nou devine automat o coloană nouă.

---

## 8. Validarea request-urilor

- `ValidationPipe` global cu:
  - `whitelist`: elimină câmpurile necunoscute;
  - `forbidNonWhitelisted`: le respinge cu 400, ca un client să nu poată strecura `systemRole` sau `reporterId`;
  - `transform`: convertește query string-urile în numere sau boolean.
- Reguli concrete: email valid; parolă de 8–72 caractere cu literă mare, literă mică și cifră; cheie de
  proiect `^[A-Z][A-Z0-9]{1,9}$`; cheie de status `UPPER_SNAKE_CASE`; labels de maxim 30 de caractere
  (maxim 20 pe task); story points între 0 și 100; UUID-uri valide (`ParseUUIDPipe`); paginare cu
  `limit ≤ 100`.
- Validarea de business (date de sprint, tranziții, assignee valid etc.) se face în service și
  întoarce 400 sau 409 cu mesaje clare.
- Un **filtru global pentru erorile de DB** transformă violările de unicitate sau de cheie străină în 409,
  în loc de 500, pentru cazurile de race condition.

---

## 9. Răspunsuri HTTP

| Cod | Când |
|---|---|
| 400 | date invalide, tranziție interzisă de workflow, regulă de business încălcată |
| 401 | lipsește token-ul sau e invalid, ori contul e dezactivat |
| 403 | membru fără permisiunea necesară (mesajul explică de ce) / rută doar pentru admin |
| 404 | resursa nu există **sau** utilizatorul nu e membru al proiectului |
| 409 | duplicat (email, cheie de proiect, membru), al doilea sprint activ, rol sau status încă folosit |

---

## 10. Ce aș adăuga în continuare

- Istoric de activitate pe task (cine a schimbat ce și când), ca „History” din Jira.
- Refresh tokens și revocarea sesiunilor.
- Ordonare manuală (rank) a task-urilor în backlog și pe board.
- Sub-task-uri și epic-uri (relații părinte–copil între task-uri).
- Notificări (email sau websocket) la asignare și schimbare de status.
- Rate limiting pe `/auth/*`.
