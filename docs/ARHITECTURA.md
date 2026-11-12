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
| Proiect nou | `POST /projects` — adminul creează orice tip; oricine altcineva creează unul Team-managed (§14) — workflow-ul implicit se creează automat | Nu |
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
├── join-requests/   cereri „vreau acces/alt rol la acest proiect” + aprobare de admin (§13)
├── invites/         invitații directe către un cont, acesta acceptă/refuză (§14)
├── realtime/         gateway WebSocket: board/backlog/sprinturi live (§12)
└── bootstrap/       seed idempotent: roluri de sistem + primul admin
```

Lângă `src/` (backend) există și `frontend/` — aplicația React descrisă în §11. Sunt două proiecte
separate cu `package.json` propriu, care comunică doar prin API-ul HTTP + WebSocket de mai jos.

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
    TASK |o--o{ TASK : "epic -> task-uri legate"

    USER { uuid id; string email; enum systemRole "ADMIN|USER"; bool isActive }
    ROLE { uuid id; string name; jsonb grants; bool isSystem; bool isDefault }
    PROJECT { uuid id; string key "WEB"; enum boardType "SCRUM|KANBAN"; enum management "COMPANY|TEAM"; int taskCounter }
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

- `POST /api/auth/register` și `POST /api/auth/login` returnează `{ accessToken, refreshToken, user }`
  — vezi §19 pentru ce face al doilea token.
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

> **Notă (schimbare ulterioară): ștergere reală de cont, nu doar dezactivare.** Inițial admin putea
> doar dezactiva un cont (`isActive = false`) — nu exista `DELETE /users/:id`. Cerința a fost explicit
> „nu poți să ștergi conturi”, deci am adăugat ștergerea efectivă (`UsersService.remove`), cu aceleași
> protecții ca la retrogradare: nu te poți șterge pe tine însuți, nu poți șterge ultimul admin activ.
> **Ștergerea eșuează cu 409** dacă utilizatorul a creat task-uri sau comentarii (`reporterId` /
> `authorId` sunt `RESTRICT` în schema — §4) — intenționat, ca istoricul proiectului să nu dispară
> tăcut; dacă ai nevoie să elimini accesul fără să pierzi istoricul, dezactivarea rămâne calea corectă.
> Apartenențele la proiecte (`ProjectMember`) sunt `CASCADE`, deci acelea se șterg automat.

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
| `sprint.manage` | creare/start/închidere sprinturi, **mutarea unui task existent** între sprint și backlog |
| `task.create` | creare task — **inclusiv direct într-un sprint** (vezi nota de mai jos) |
| `task.update` | editare câmpuri (titlu, descriere, labels, prioritate...) |
| `task.transition` | schimbare status |
| `task.assign` | schimbare assignee |
| `task.assignable` | utilizatorul **poate primi** task-uri (ex. Viewer nu poate) |
| `task.delete` | ștergere task |
| `comment.create` | adăugare comentarii |
| `comment.manage` | editare/ștergere comentariile altora (autorul poate oricând modifica ale lui) |

`GET /api/roles/permissions` returnează catalogul, util pentru un UI de administrare a rolurilor.

> **Notă (schimbare ulterioară):** inițial, a pune un task nou direct într-un sprint cerea
> `sprint.manage`, la fel ca mutarea unui task existent. Testând aplicația, un Developer nu putea
> crea un task din Board (care îl pune automat în sprintul activ) — cererea pica cu 403 și, din
> interfață, părea doar că „task-ul nu apare”. Am decis că e o distincție prea strictă: oricine are
> voie să creeze task-uri ar trebui să poată adăuga propriul task direct în sprintul la care deja
> lucrează echipa, fără să aibă nevoie de dreptul de a *planifica* sprinturi. Așa că `create()`
> (`TasksService`) nu mai cere `sprint.manage` când primește `sprintId` — doar `task.create`.
> **`moveToSprint` (mutarea unui task deja existent între sprint și backlog) rămâne gated de
> `sprint.manage`**, fiindcă aia e în continuare o decizie de planificare, nu de creare.

> **Notă (schimbare ulterioară): poziția unui status se poate schimba din UI.** `WorkflowService.
> updateStatus()` accepta deja `position` în `UpdateStatusDto` și reordona corect toate statusurile
> (renumerotare contiguă) — backend-ul suporta asta de la început, dar pagina Workflow nu expunea
> nicio cale să trimiți acel câmp. Cerut explicit. Adăugate doar săgeți ▲/▼ pe rândul fiecărui status
> în `WorkflowPage.tsx`, care calculează noua poziție (`index ± 1`) și cheamă `PATCH .../statuses/:id`
> deja existent — fără cod nou pe backend, fără librărie de drag-and-drop pentru o listă scurtă.

> **Notă (schimbare ulterioară): oricine poate să-și dea singur assignee pe un task.** Cerut
> explicit — „un utilizator simplu ar trebui să poată să-și dea assignee la task-uri”. Cauza reală nu
> era un bug, ci o consecință a scope-ului `ASSIGNEE` de la §6.1: rolurile IC (Developer, Backend/
> Frontend Developer, QA, DevOps, UI/UX Designer) au `task.assign` cu `scope: ASSIGNEE`, adică grant-ul
> se aplică doar dacă task-ul **este deja** asignat ție — pentru un task neasignat condiția e mereu
> falsă, deci niciun rol IC nu putea prelua un task liber, nici măcar pe al lui. Prima variantă
> implementată a fost un flux cerere → aprobare de către PM (simetric cu cererile de acces, §13), dar
> **a fost înlocuită** la cerere explicită ulterioară cu auto-asignare directă, fără pas de aprobare:
> `TasksService.assign()` sare peste verificarea `task.assign` **doar atunci când assignee-ul cerut
> ești chiar tu** — condiție verificată separat de restul logicii, care rămâne neschimbată — și se bazează
> în schimb exclusiv pe `task.assignable` (deja verificat prin `assertAssignable`, indiferent cine e
> assignee-ul). Asignarea **altcuiva** (sau preluarea unui task deja asignat altcuiva, către tine)
> tot cere `task.assign` complet, neschimbat — doar „dă-mi mie” a devenit liber, nu „dă oricui”.
> Aceeași excepție se aplică deja și la crearea unui task nou cu `assigneeId` = creatorul însuși.
> Frontend: în `TaskDrawer`, câmpul Assignee arată un buton „Asignează-mi mie” (sau „Dezasignează-mă”
> dacă ești deja assignee) pentru oricine are `task.assignable` dar nu și `task.assign` complet.

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
  task-ul, iar workflow-ul decide *unde* poate fi mutat — dacă o tranziție nu există în graful de
  tranziții al proiectului, e respinsă cu 400 pentru toți, inclusiv pentru PM, cu lista de tranziții
  permise din acel status. Pentru un UI, `GET /tasks/:key/transitions` returnează doar mutările pe
  care utilizatorul curent le poate face efectiv (ca butoanele din Jira).
  > **Notă (schimbare ulterioară): workflow-ul implicit pornește complet deschis.** Inițial
  > `DEFAULT_TRANSITIONS` era un lanț restrâns (`TODO → IN_PROGRESS → IN_REVIEW → IN_QA → DONE`,
  > plus câteva mutări înapoi) — un `TODO → DONE` direct era respins chiar și pentru un proiect nou,
  > nemodificat încă de nimeni. Cerut explicit: un proiect nou trebuie să pornească **cu toate
  > tranzițiile posibile** între toate statusurile („să-l poți muta cum vrei și de unde vrei”), iar
  > PM-ul își restrânge fluxul ulterior, dacă vrea unul mai strict, din tab-ul Workflow (ștergere de
  > tranziții, deja exista acolo — §11). `DEFAULT_TRANSITIONS` (`src/workflow/default-workflow.ts`)
  > e acum generat automat ca graf complet (fiecare status → fiecare alt status), nu mai listat de
  > mână — nu mai poate scăpa o pereche la adăugarea unui status nou implicit.
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

## 11. Frontend (React + Vite)

Backend-ul inițial nu avea interfață — doar API + Swagger. Am construit un frontend separat
(`frontend/`) ca aplicația să fie efectiv utilizabilă, nu doar testabilă prin `curl`.

| Alegere | De ce |
|---|---|
| **React + TypeScript + Vite**, fără alte dependențe grele (nu Redux, nu React Query, nu Tailwind) | Aplicația are stare simplă (date per-pagină, reîncărcate la nevoie) — o librărie de state management ar fi complexitate fără beneficiu. Mai puține dependențe = `npm install` mai rapid și mai puține lucruri care se pot rupe. |
| Client API: un `fetch` wrapper subțire (`lib/api.ts`), nu axios | Un singur loc care adaugă header-ul `Authorization`, normalizează erorile (`ApiError`) și declanșează logout la 401. Nu aveam nevoie de interceptors/retry complexe. |
| Proxy Vite (`/api` → `localhost:3000`) în loc de CORS pe backend | Evită să ating configurarea backend-ului doar ca să rulez un dev server separat; `fetch('/api/...')` arată ca same-origin din perspectiva browser-ului. |
| Tipuri TypeScript care oglindesc manual DTO-urile/entitățile din NestJS (`lib/types.ts`) | Nu există (încă) generare automată de tipuri din Swagger; proiectul fiind mic, ținerea sincronă manuală e mai simplă decât un pas de codegen. |
| Un singur context de acces per proiect (`ProjectAccessProvider`) care expune `can(permission)` | Fiecare pagină (Board, Backlog, Sprinturi, Membri, Workflow) are nevoie de aceleași verificări de permisiuni ca să arate/ascundă butoane — centralizat într-un singur loc, la fel ca `ProjectAccess` pe backend. |
| Detaliile unui task se deschid într-un **drawer** (panou lateral), nu pe o pagină separată | Păstrează contextul board-ului/backlog-ului vizibil; e controlat prin query string (`?task=WEB-12`), deci e și linkuibil. |
| Drag-and-drop pe Board (HTML5 nativ, fără librărie) | La drop se apelează tranziția de status existentă; dacă workflow-ul n-o permite, cardul revine pe loc cu eroare. Nu am adăugat o librărie de DnD pentru o singură interacțiune. |

> **Notă (bug găsit la verificare): niciun card nu era draggable pentru Developer.** `canDrag` era
> calculat o singură dată pentru tot board-ul cu `can(Permission.TASK_TRANSITION)` — care verifică
> doar grant-uri **necondiționate** (fără task, un grant cu `scope: ASSIGNEE` ca al Developer-ului nu
> se potrivește niciodată, exact comportamentul din §6.1 „fără task, doar grant-urile necondiționate
> se aplică”). Rezultatul: `canDrag` era `false` pentru orice rol ale cărui tranziții depind de task
> (Developer, QA). Fix: draggability calculată **per card** — `can(TASK_TRANSITION) ||
> task.assigneeId === eu` — nu încearcă să reproducă exact scope-ul din grant (ex. restricția de
> status a QA pe `IN_QA`), ci doar aproximează „merită încercat”; dacă backend-ul tot respinge
> mutarea (ex. QA pe un task care nu e în `IN_QA`), UI-ul deja revine cardul pe loc cu eroare —
> mecanismul de revert exista deja, doar că majoritatea cardurilor nu ajungeau niciodată până acolo.
> (Presupunerea inițială că butoanele „→ Status” din drawer scăpau de acest bug fiindcă citesc
> tranzițiile reale de la backend s-a dovedit greșită — vezi nota de mai jos din §11, găsită abia
> mai târziu: un gate separat, `canTransition`, bloca aceleași butoane din același motiv.)

> **Notă (bug găsit la verificare): clic în afara drawer-ului de task nu îl închidea.** `Drawer.tsx`
> avea un backdrop semi-transparent ca `<div>` SEPARAT, suprapus peste containerul care purta
> handler-ul de închidere; acela verifica `e.target === e.currentTarget` ca să nu se închidă la clic
> pe conținutul din interior — dar orice clic vizibil pe fundalul întunecat lovea de fapt backdrop-ul
> (alt element), nu containerul însuși, deci condiția nu era niciodată adevărată și `onClose()` nu se
> declanșa — utilizatorul rămânea „blocat” în task, obligat să apese „✕”. Fix: handler-ul s-a mutat
> direct pe backdrop (clic pe el oricând închide; clic pe cardul din interior nu-l atinge, fiind
> element frate, nu descendent, deci nu se propagă prin el). Adăugat și `Escape` pentru închidere,
> ca la `Modal.tsx` (care nu avea acest bug — fundalul lui e pe același element cu handler-ul).

> **Notă (bug găsit la verificare): câmpurile unui task asignat ție (tip, prioritate, story points,
> descriere, etichete) apăreau needitabile în drawer, deși backend-ul permitea editarea.** Exact
> același bug ca la draggability pe Board (nota de mai sus): `canUpdate` era calculat doar cu
> `can(Permission.TASK_UPDATE)`, care ignoră grant-urile condiționate — rolurile IC au `task.update`
> cu `scope: ASSIGNEE` (plus `REPORTER` la majoritatea, dar nu la QA), deci `can()` fără task întoarce
> mereu `false` pentru ele, indiferent dacă task-ul chiar e al lor. Fix, aceeași aproximare ca la
> draggability: `canUpdate = can(TASK_UPDATE) || task.assigneeId === eu || task.reporterId === eu`.
> **Separat, un al doilea gate pe aceleași butoane „→ Status” despre care nota de mai sus presupunea
> greșit că n-au problema:** `canTransition` (tot `can()` fără task) se adăuga *în plus* peste lista
> de tranziții deja calculată corect per-task de backend (`GET /tasks/:id/transitions`), ascunzând
> butoanele chiar și când acea listă venea populată. Eliminat complet — `transitions.length > 0` e
> deja precis (vine din backend, ia în calcul statusul curent și scope-ul exact al rolului), nu mai
> are nevoie de o aproximare suplimentară pe frontend ca la `canUpdate`/`canDrag`.

> **Notă (schimbare ulterioară): simbol vizual per tip de task.** Pe board/backlog, singura diferență
> vizibilă dintre un story, un task, un bug și un sub-task era un caracter unicode mic și monocrom
> (`typeIcon(type)`) lângă cheie — greu de distins dintr-o privire rapidă pe un board plin. Cerut
> explicit, cu captură arătând boardul Jira real al utilizatorului, unde fiecare tip are propria
> iconiță colorată. Soluție: componentă nouă `<TypeIcon type=.../>` (`components/TypeIcon.tsx`) care
> afișează același caracter, dar într-un chip mic cu fundal „soft” + text saturat — **reutilizând
> exact pattern-ul deja existent la `.pill-done`/`.pill-critical`/`.pill-high`/`.pill-todo`** (fundal
> pal, text în aceeași nuanță dar mai saturată), nu un fundal solid + text alb inventat separat —
> astfel rămâne vizual consecvent cu restul paletei de stări/priorități și funcționează automat în
> ambele teme (light/dark), fără CSS nou per temă. Mapare semantică: story → `--good` (verde, ca
> „finalizat”), task → `--info` (albastru), bug → `--danger` (roșu), sub-task → neutru
> (`--surface-sunken` + bordură), epic → un token nou `--epic`/`--epic-soft` (singurul tip fără o
> culoare semantică deja existentă de reutilizat). `<TypeIcon>` înlocuiește `typeIcon()` brut pe
> `TaskCard`, `BacklogPage`, `EpicsPage` și lista de sub-task-uri din `TaskDrawer`; `typeIcon()` brut
> rămâne folosit doar acolo unde nu poate apărea HTML, adică opțiunile unui `<select>` nativ (dropdown-ul
> „Tip” din formularele de creare/editare).

> **Notă (schimbare ulterioară): navigare din bară laterală, stil Jira, în loc de tab-uri sus.**
> Inițial, proiectele erau doar o pagină (`/projects`) la care te întorceai ca să schimbi proiectul.
> Cerut explicit: o bară fixă în stânga (`components/Sidebar.tsx`) cu toate proiectele tale, fiecare
> cu un pătrat colorat derivat determinist din cheia proiectului (hash simplu → nuanță HSL), plus o
> secțiune „Admin” separată printr-un divizor. Bara de sus a rămas doar pentru profil/logout — nu mai
> are nevoie de taburi de navigare, acelea au trecut în sidebar. Pagina `/projects` a rămas accesibilă
> din „Toate proiectele” — acolo stau în continuare creare/cereri/invitații, care n-ar încăpea firesc
> într-o bară laterală îngustă. Ștergerea unui proiect (admin) e tot în sidebar — o iconiță de coș de
> gunoi care apare la hover pe rândul proiectului, nu un „✕” pe card — ca să poți șterge din orice
> pagină, fără să navighezi înapoi la listă.
>
> **Scris și butoane mai mari:** am mărit corpul de text (14→15px), padding-ul butoanelor/input-urilor
> și titlurile (`h1`–`h3`) — fuseseră dimensionate pentru densitate maximă de informație, dar citeau ca
> prea mici pentru utilizare prelungită.

### Sesiunea: `sessionStorage`, nu `localStorage`

**Important, fiindcă a fost o greșeală inițială găsită în test:** token-ul JWT era ținut în
`localStorage`. `localStorage` e **partajat între toate tab-urile aceluiași site** — logarea cu alt
cont într-un tab schimba instant sesiunea în *toate* celelalte tab-uri deschise, inclusiv cele ale
altor persoane care testau aplicația în același browser. Am mutat token-ul în `sessionStorage`
(`lib/api.ts`), care e izolat per-tab: fiecare tab nou pornește cu propria sesiune, independent de
celelalte, dar tot rămâi logat la refresh în același tab. Efect secundar acceptat: sesiunile scrise
sub codul vechi s-au pierdut o singură dată la tranziție (necesită o relogare).

---

## 12. Actualizări live (WebSocket)

Inițial, board-ul/backlog-ul se reîncărcau doar la refresh manual — dacă două persoane lucrau pe
același proiect, nu se vedeau reciproc fără să apese F5. Am adăugat un canal live cu
**Socket.IO** (`@nestjs/websockets` + `@nestjs/platform-socket.io`, modulul `src/realtime/`).

**Cum funcționează:**
1. Clientul se conectează cu **același JWT** folosit la API (`handshake.auth.token`); gateway-ul îl
   validează identic cu `JwtStrategy` (decodare + `UsersService.findById` + cont activ).
2. Clientul cere să se alăture camerei unui proiect (`socket.emit('join', { projectId })`).
   Gateway-ul verifică **aceeași** `AccessControlService.forProject()` ca la REST — un user fără
   acces la proiect nu primește niciodată evenimentele lui, chiar dacă ghicește id-ul.
3. Serviciile de business (`TasksService`, `SprintsService`, `WorkflowService`, `ProjectsService`
   pentru membri) apelează `RealtimeGateway.broadcast(projectId)` după fiecare mutație relevantă
   (task creat/mutat/șters, sprint pornit/închis, status/tranziție modificate, membru
   adăugat/schimbat).
4. Clientul primește un singur eveniment, generic: `changed`. **Nu trimitem payload-ul cu diff-ul**
   — clientul pur și simplu reapelează GET-ul paginii curente (`useProjectRealtime` în
   `lib/realtime.ts`).

> **De ce „reîncarcă tot” și nu un payload cu delta:** sincronizarea granulară (patch-uri parțiale,
> rezolvare de conflicte) ar fi mult mai multă complexitate pentru un câștig mic la scara aplicației
> (o echipă mică, nu mii de task-uri). Serverul rămâne singura sursă de adevăr; clientul doar știe
> *când* să-l întrebe din nou, în loc de un timer de polling.

---

## 13. Cereri de acces la proiect (join requests)

**Problema:** un utilizator nou înregistrat are, intenționat, acces zero (§5) — dar înainte nu exista
nicio cale pentru el să *ceară* acces; trebuia să roage pe cineva în afara aplicației să-l adauge
manual ca membru. Am adăugat un flux de cerere → aprobare, modulul `src/join-requests/`.

- **Entitate nouă `JoinRequest`**: `{ projectId, userId, roleId, message, status: PENDING|APPROVED|REJECTED, decidedById, decidedAt }`.
  Rolul e ales de **utilizator** la cerere (nu de admin la aprobare) — aprobarea e strict
  accept/respinge, ca să rămână un singur pas simplu pentru admin, conform cerinței „adminul doar
  să accepte”.
- **Un singur index unic parțial** `(projectId, userId) WHERE status = 'PENDING'` — exact ca la
  „un singur sprint activ” (§4): un utilizator nu poate avea două cereri în așteptare pentru același
  proiect, garantat de baza de date, nu doar verificat în service.
- **`GET /api/projects/directory`** — endpoint nou, simplu (`id`, `key`, `name`, `boardType`),
  accesibil oricărui utilizator autentificat (nu doar membrilor). Fără el, un user nou nu ar ști ce
  proiecte există ca să ceară acces — `GET /projects` îi arată doar proiectele la care *deja* are
  acces, deci listă goală.
- **Aprobarea** (`POST /join-requests/:id/approve`) apelează direct `ProjectsService.addMember()`
  — adaugă membrul cu rolul exact cerut, fără cod duplicat.

> **Notă (schimbare ulterioară): cererea funcționează și pentru schimbarea rolului, nu doar pentru
> alăturare.** Cerința inițială era doar „vreau acces la acest proiect”, dar un membru existent
> (ex. Viewer) nu avea nicio cale să ceară să devină Developer — doar admin/PM îi putea schimba
> rolul direct, fără ca el să inițieze nimic. Am relaxat `JoinRequestsService.create()`: dacă ești
> deja membru, poți tot trimite o cerere (cu alt rol decât cel curent), iar `approve()` detectează
> automat cazul și apelează `changeRole()` în loc de `addMember()`. Am ales să **nu** creez o entitate
> separată pentru asta — e aceeași formă de date (`{ project, rol dorit, mesaj }`) și aceeași coadă
> de aprobare, doar efectul diferă în funcție de apartenența existentă.

> **Notă (schimbare ulterioară): aprobarea nu mai e doar a adminului — și PM-ul proiectului poate
> decide.** Inițial `pending()`/`approve()`/`reject()` erau `@AdminOnly()`. Cerut explicit ca
> PM-ul proiectului respectiv (orice rol cu `project.members.manage`, nu neapărat admin) să poată
> decide singur cererile pentru *proiectul lui*, fără să treacă prin admin de fiecare dată. Am scos
> `@AdminOnly()` și am mutat verificarea în service: `getPending()` cere `acl.forProject(actor,
> req.projectId).assert('project.members.manage')` — admin trece automat (bypass-ul existent din
> §6), un PM trece dacă rolul lui are acel grant, oricine altcineva ia 403 (sau 404 dacă nici măcar
> nu e membru al proiectului — nu-i dezvăluim că proiectul există). `listPending()` filtrează la
> fel: un admin vede toate cererile din sistem, un PM doar pe cele din proiectele unde are
> `project.members.manage` (`AccessControlService.projectIdsWithPermission()`, nou), restul
> utilizatorilor văd o listă goală — aceeași rută `GET /join-requests`, niciun endpoint nou.
> Pagina `/admin/join-requests` din frontend a rămas la aceeași adresă, dar nu mai e în spatele
> `AdminRoute` — linkul „Cereri” din sidebar e acum vizibil pentru toată lumea, nu doar pentru admin.

---

## 14. Tipuri de proiect: Company-managed vs. Team-managed

**Cerința:** în Jira real, un admin de sistem creează proiecte „Company-managed” (standard,
organizațional), dar orice membru al echipei poate crea un proiect „Team-managed”, pe care îl
gestionează singur — cu excepția cazului în care adminul a dezactivat global opțiunea asta.

- **`Project.management: COMPANY | TEAM`**, coloană nouă pe entitate (`ProjectManagement` enum).
- **Adminul** poate crea orice tip de proiect și poate alege un `leadId` oricare (ca înainte).
- **Oricine altcineva** poate crea **doar** un proiect `TEAM` — dacă încearcă `COMPANY`, primește
  403. Devine automat **Project Manager** pe el (nu poate alege alt lead — nu are sens să creezi un
  proiect și să nu-l conduci tu).
- **Comutator global** `TEAM_PROJECTS_ENABLED` (env var, implicit `true`, același tipar ca
  `REGISTRATION_ENABLED`): dacă adminul îl pune pe `false`, crearea de proiecte redevine strict
  admin-only, exact ca înainte de această schimbare.
- **`GET /api/config/public`** (`@Public()`) expune `{ registrationEnabled, teamProjectsEnabled }` —
  frontend-ul are nevoie de el *înainte* de autentificare (sau chiar din pagina de proiecte) ca să
  decidă dacă arată butonul „+ Proiect nou” oricui, nu doar adminului.
- **N-am adăugat workflow-uri sau permisiuni diferite pe tip de proiect.** În Jira real, Team-managed
  înseamnă și un model de permisiuni mai simplu, specific echipei. Aici fiecare proiect are oricum
  propriul workflow și propriile roluri de membru (§4, §6) — distincția `management` e doar despre
  **cine are voie să-l creeze**, nu o altă arhitectură de permisiuni în plus.

---

## 15. Invitații directe către un cont

**Cerința:** pe lângă cererea inițiată de utilizator (§13), cineva cu drept de a gestiona membrii
trebuie să poată **invita direct un cont existent** la un rol anume, iar acela acceptă sau refuză —
sensul invers față de join request (acolo utilizatorul cere, adminul decide; aici PM-ul oferă,
utilizatorul decide).

- **Entitate nouă `ProjectInvite`** (modulul `src/invites/`): `{ projectId, userId, roleId,
  invitedById, status: PENDING|ACCEPTED|DECLINED, respondedAt }`. Același tipar de index unic
  parțial ca la `JoinRequest` și `Sprint` (§4, §13): un singur invite `PENDING` per
  `(projectId, userId)`.
- **Cine invită:** oricine are `project.members.manage` pe acel proiect (PM sau admin) —
  `POST /projects/:id/invites`.
- **Cine răspunde:** doar invitatul (`invite.userId === currentUser.id`), altfel 403 —
  `POST /invites/:id/accept` / `POST /invites/:id/decline`.
- **Acceptarea** apelează `ProjectsService.addMember()`, la fel ca aprobarea unui join request —
  tot codul care adaugă efectiv un membru e într-un singur loc.
- Invitațiile și cererile de acces **coexistă independent**: pot exista simultan un invite către
  userul X pentru rolul Y și o cerere a lui X pentru rolul Z — nu se blochează reciproc, fiindcă sunt
  două tabele diferite cu intenții diferite (oferă vs. cere).

> **Notă (schimbare ulterioară): totul legat de acces s-a mutat pe o singură pagină, „Cereri”.**
> Inițial invitațiile primite și cererile proprii trimise apăreau doar pe `/projects`, separat de
> pagina de decizie a adminului/PM-ului (`/admin/join-requests`) — trei surse de adevăr pentru
> „ce așteaptă răspunsul meu”, fiecare vizibilă doar dacă știai unde să te uiți. Cerut explicit:
> toate trei (invitațiile tale, cererile tale, cererile de decis dacă ai `project.members.manage`
> undeva) pe **aceeași pagină** `AdminJoinRequestsPage`. `ProjectsPage` a rămas doar pentru
> răsfoit/creat proiecte.
>
> **Notificare + live update fără refresh.** Un contor roșu pe linkul „Cereri” din sidebar (numărul
> de invitații în așteptare + cereri de decis) — altfel utilizatorul n-ar afla niciodată că are ceva
> de răspuns decât dând din întâmplare peste pagină. Problema: invitațiile/cererile sunt
> cross-proiect, deci canalul WebSocket existent (cameră `project:<id>`, §12) nu le poate acoperi —
> nu există UN proiect de care să asculți. Soluție minimală, fără a extinde gateway-ul WebSocket cu
> camere per-utilizator: contorul din `Sidebar` se reîmprospătează (a) la fiecare 20s (polling), (b)
> la orice schimbare de rută, și (c) instant, prin un `CustomEvent` pe `window`
> (`lib/events.ts` — `notifyAccessChanged()`/`onAccessChanged()`) pe care pagina „Cereri” îl emite
> după ce userul acceptă un invite sau decide o cerere. **Lista de proiecte din sidebar ascultă
> același eveniment** — de-asta, imediat ce accepți un invite, proiectul apare în sidebar fără
> reload: nu e push real de pe server, ci reacție imediată în tab-ul curent la propria acțiune a
> userului. (Dacă adminul aprobă cererea cuiva ALTCUIVA, persoana respectivă tot are nevoie să
> navigheze sau să aștepte polling-ul de 20s în propriul ei tab — nu era cerut push cross-sesiune,
> doar ca acțiunea proprie să se vadă instant.)

---

## 16. Epice

**Cerința:** gruparea task-urilor înrudite sub un „epic”, ca în Jira.

- **Un epic e doar un `Task` cu `type = EPIC`**, nu o entitate separată. Alte task-uri se leagă de el
  prin `Task.epicId` (auto-FK, `ON DELETE SET NULL` — ștergerea epicului nu șterge task-urile, doar le
  desface). Am ales asta (nu un modul `epics/` separat) fiindcă un epic are nevoie de exact aceleași
  lucruri ca un task: titlu, descriere, status, reporter — reutilizarea întregii infrastructuri
  existente (creare, permisiuni, workflow) e mult mai simplă decât un al doilea model paralel.
- **Reguli, impuse în `TasksService`:**
  - un epic nu poate fi pus într-un sprint (`type=EPIC` + `sprintId` → 400) — planificarea pe sprint
    se face la nivel de task/poveste, nu la nivel de epic;
  - un epic nu se poate lega de alt epic (`epicId` către un task cu `type≠EPIC` → 400) — nu există
    imbricare, un singur nivel de grupare;
  - epicele **nu apar pe board** (`board()` exclude explicit `type=EPIC`) — board-ul e pentru munca
    efectivă (story/task/bug), epicele sunt browsabile separat, pe tab-ul lor.
- **`GET /projects/:id/epics`** returnează fiecare epic cu `taskCount`/`doneCount` calculate
  (`COUNT(*) FILTER (WHERE status.category = 'DONE')`) — suficient pentru o bară de progres în UI,
  fără să încarce toate task-urile legate doar ca să le numere.
- Frontend: un tab nou „Epice” per proiect, cu un chip colorat (culoare derivată determinist din
  cheia epicului, ca la pătratele proiectelor din sidebar — §11) afișat pe cardurile de task/rândurile
  de backlog care au un epic asociat.
- **Pagina „Epice" e un arbore expandabil** (ca „Timeline" din Jira Cloud), nu o listă de carduri:
  fiecare epic e un rând cu un chevron; click pe chevron încarcă (lazy, o singură dată) task-urile
  legate prin `GET /projects/:id/tasks?epicId=<id>` și le afișează indentate dedesubt, fiecare cu
  propriul status, assignee și titlu tăiat-cu-linie dacă e „Done". Am ales lazy-load la expand (nu
  totul deodată la încărcarea paginii) fiindcă un proiect cu multe epice n-ar trebui să tragă toate
  task-urile din proiect doar ca să arate o listă de epice; costul se plătește doar când utilizatorul
  chiar vrea să vadă detaliile unui epic anume. Rândul de epic și rândul de task-copil sunt butoane
  separate (nu un `<button>` în interiorul altui `<button>`, HTML invalid) — unul pentru toggle,
  unul pentru deschiderea drawer-ului de task.

  > **Notă (schimbare ulterioară):** varianta inițială a paginii era o listă plată de carduri, cu bara
  > de progres dar fără acces direct la task-urile din epic. Cerut explicit, pe baza unui screenshot
  > din Jira Cloud real al utilizatorului, să arate ca un arbore ierarhic expandabil.

  > **Notă (schimbare ulterioară): culoare personalizabilă per epic.** Culoarea unui epic era doar
  > `hueFromKey(epic.key)` — un hash determinist al cheii (`GIG-1`, `GIG-2`...) transformat în nuanță
  > HSL. Funcționa ca „fiecare epic are o culoare stabilă”, dar nu garanta că epicele *vecine* arată
  > diferit — cu 8 epice, hash-ul a produs mai multe nuanțe de verde apropiate, greu de distins dintr-o
  > privire pe board/backlog. Cerut explicit, cu captură din aplicația reală arătând exact acest
  > cluster de verzuri. Soluție: `Task` are acum o coloană opțională `hue` (`smallint`, 0–359,
  > `null` implicit). Când e setată, `epicHue(epic)` o folosește în loc de `hueFromKey`; `null`
  > păstrează comportamentul vechi (fallback automat pe hash). Restricții impuse în `TasksService`,
  > atât la creare cât și la actualizare: `hue` poate fi setat doar pe `type=EPIC` (altfel 400) — nu
  > are sens pe o poveste/task/bug/sub-task, care-și iau culoarea de la epicul-părinte prin
  > `EpicChip`, nu au propria lor. Ales un **set fix de 12 nuanțe presetate** (`HUE_PRESETS` în
  > `TaskDrawer`) în loc de un color-picker complet (hex/RGB liber), din două motive: (1) orice
  > nuanță liberă tot trece prin aceeași formulă `hsl(hue, saturație-fixă, luminozitate-fixă)` ca
  > restul paletei de culori a aplicației — un hex arbitrar ar putea produce un contrast prost cu
  > textul alb de pe chip în modul întunecat sau invers; (2) 12 opțiuni e suficient să distingi 8
  > epice clar, fără complexitatea unui `<input type="color">` + logică de conversie hex→HSL. Un
  > buton „Auto” separat resetează la `null` (revine la hash), nu doar la prima presetare din listă —
  > altfel n-ar mai exista nicio cale să te întorci la comportamentul automat din UI. `hue` e exclus
  > deliberat din înregistrarea de activitate (§18) — e o preferință cosmetică, nu o schimbare care
  > merită să aglomereze istoricul unui task.

---

## 17. Sub-task-uri

**Cerința:** „relații părinte–copil mai fine, în interiorul unei povești/task” — diferit de epice
(§16), care grupează la un nivel mai sus (mai multe povești/task-uri sub un epic). Un sub-task
descompune UN task/poveste/bug în bucăți mai mici, nu grupează mai multe task-uri distincte.

- **Același truc ca la epice: `Task` cu `type = SUBTASK`**, nu o entitate separată — reutilizează
  statusul, workflow-ul, permisiunile, comentariile, istoricul de activitate, totul. Leagă-l de
  părinte prin `Task.parentId` (auto-FK).
- **Spre deosebire de `epicId`, `parentId` e `ON DELETE CASCADE`, nu `SET NULL`.** Un epic șters
  lasă task-urile lui în picioare (doar nu mai sunt grupate); un sub-task fără părinte n-are sens
  deloc — dacă dispare task-ul descompus, dispar și bucățile lui.
- **Reguli, impuse în `TasksService` (atât la `create`, cât și la `update`):**
  - `type=SUBTASK` **necesită** `parentId` (spre deosebire de `epicId`, care e opțional la epice) —
    un sub-task orfan nu are sens;
  - `parentId` doar pe `type=SUBTASK` — un task normal nu poate avea părinte;
  - părintele nu poate fi un epic (sub-task-urile se agață de poveste/task/bug, nu direct de epic —
    la fel ca în Jira) și nu poate fi alt sub-task (un singur nivel de imbricare, ca la epice);
  - un sub-task **nu are propriul epic** — îl moștenește implicit din părinte, deci `epicId` pe un
    sub-task e respins cu 400;
  - un sub-task **nu poate fi pus singur într-un sprint** — nici la creare, nici ulterior prin
    `PUT /tasks/:id/sprint` (verificare adăugată și acolo, ca regula să nu poată fi ocolită creând
    un sub-task simplu și mutându-l apoi direct în sprint).
  - sub-task-urile **nu apar pe board** (excluse alături de epice — `t.type NOT IN (EPIC, SUBTASK)`)
    — se văd doar imbricate sub părinte, în drawer-ul lui.
- **Niciun endpoint nou pentru listare** — la fel ca la copiii unui epic, sub-task-urile unui task
  se obțin cu același `GET /projects/:id/tasks?parentId=<id>` deja existent (am adăugat doar filtrul
  `parentId` la `ListTasksQueryDto`), nu un `GET /tasks/:id/subtasks` separat.
- Frontend: secțiunea „Sub-task-uri” din `TaskDrawer` (vizibilă doar pe story/task/bug, nu pe epic
  și nu pe un sub-task însuși) listează sub-task-urile cu un progres `(x/y)`, plus un câmp rapid
  „+ Sub-task nou”. Un sub-task deschis în drawer arată un chip clicabil către părinte (reutilizează
  `EpicChip`, aceeași formă de date `{id, key, title}`), iar un click pe un rând de sub-task
  înlocuiește task-ul curent din drawer cu acel sub-task — fără să deschidă un al doilea drawer, ci
  schimbând parametrul `?task=` din URL (același `useSearchParams` din pagină), ceea ce păstrează
  un singur drawer deschis oricât ai naviga între părinte și copii.

  > **Notă (bug găsit la implementare):** câmpul „Story points” din drawer folosea un `<input
  > defaultValue=...>` necontrolat — la schimbarea task-ului afișat (din click pe un rând de
  > sub-task sau pe chip-ul de părinte, fără să se demonteze componenta `TaskDrawer`), valoarea
  > rămânea cea a task-ului anterior. Fixat adăugând `key={task.id}` pe acel input, ca React să-l
  > remonteze la fiecare schimbare de task — același bug ar fi afectat deja navigarea epic → copil
  > din §16, doar că nu fusese observat până acum.

---

## 18. Istoric de activitate (jurnal)

**Cerința:** să se vadă cine a schimbat ce și când pe un task, ca tab-ul „History” din Jira — plus
o privire de ansamblu pentru admin, peste toate proiectele.

- **O linie pe câmp schimbat**, nu un singur blob JSON cu tot diff-ul: tabelul `task_activities` are
  `field` / `fromValue` / `toValue` ca text simplu, deja formatat pentru afișare (ex. la `status`,
  `fromValue` e numele statusului — „To Do” — nu id-ul lui). Motivul: citirea istoricului nu trebuie
  să mai facă join-uri către status/sprint/epic/assignee ca să arate ceva inteligibil, iar valorile
  rămân corecte chiar dacă acel status/sprint e redenumit sau șters mai târziu.
- **`actorName` e un snapshot**, nu doar `actorId` + join: dacă admin rescrie numele cuiva (sau
  contul e dezactivat), istoricul vechi tot arată numele de atunci. `actorId` rămâne totuși o FK
  obișnuită (`RESTRICT`, la fel ca `reporterId`/`authorId` pe task-uri/comentarii) — ștergerea unui
  cont care a lăsat urme în istoric e blocată, dezactivarea rămâne calea corectă (§5).
- **Mai multe câmpuri schimbate într-un singur request (`PATCH /tasks/:id`) primesc exact același
  `createdAt`**, setat o singură dată în `ActivityService.record()` înainte de insert — altfel
  fiecare rând ar primi propriul timestamp și frontend-ul nu ar putea ști sigur că title+priority
  s-au schimbat „în același moment”, ca o singură intrare Jira cu mai multe linii dedesubt.
- Înregistrarea se face direct în `TasksService` (`update`/`transition`/`assign`/`moveToSprint`),
  comparând starea dinainte (deja încărcată de `load()`) cu starea de după (`reload()`); un helper
  `diff(field, from, to)` întoarce `[]` dacă valoarea nu s-a schimbat de fapt, ca liniile "Nothing to
  update" să nu genereze zgomot în istoric.
- **Două suprafețe de citire:** `GET /tasks/:idOrKey/activity` (orice membru al proiectului, ca la
  comentarii — nicio permisiune suplimentară) pentru tab-ul „Istoric” din drawer-ul unui task; și
  `GET /activity` (admin-only, paginat, filtrabil după proiect/utilizator) pentru o pagină nouă
  „Jurnal” din secțiunea Admin a sidebar-ului, cu fiecare rând legat înapoi la task-ul lui.

> **Notă (schimbare ulterioară): selector de proiect pe pagina „Jurnal”.** Filtrul `projectId` pe
> `GET /activity` exista deja de la început (vezi bulletul de mai sus) — doar pagina `AdminActivityPage`
> nu expunea nicio cale să-l trimiți, arăta mereu toate proiectele amestecate. Cerut explicit. Adăugat
> un `<select>` cu lista de proiecte (`GET /projects`, care pentru un admin le întoarce pe toate,
> fără filtrul de apartenență aplicat non-adminilor — §14), legat de query string-ul paginii
> (`?project=<id>`) prin `useSearchParams`, nu doar stare locală React — ca selecția să supraviețuiască
> unui refresh și să poată fi distribuită ca link direct către jurnalul unui singur proiect. Schimbarea
> proiectului resetează și pagina la 1 (un filtru nou nu ar trebui să păstreze un număr de pagină
> rămas de la rezultatul anterior, posibil mai mare decât există acum). Niciun cod nou pe backend.

---

## 19. Refresh tokens și revocarea sesiunilor

**Cerința:** un access token care nu mai stă valabil o zi întreagă (risc dacă e furat/logat undeva),
dar fără să oblige utilizatorul să se relogheze din 15 în 15 minute — plus o cale reală de a
revoca o sesiune (dacă bănuiești că ți s-a compromis contul de pe un dispozitiv).

- **Access token scurt (`JWT_ACCESS_EXPIRES_IN`, implicit `15m`) + refresh token lung
  (`JWT_REFRESH_EXPIRES_IN`, implicit `30d`).** Access token-ul rămâne exact ce era (JWT stateless,
  doar `sub`, verificat de `JwtStrategy` — §5); refresh token-ul e o valoare aleatoare opacă, cu
  rândul lui propriu în `refresh_tokens`, deci **poate fi revocat** — lucru imposibil pentru un JWT
  obișnuit fără o listă neagră separată, care e oricum ce construim aici.
- **Doar hash-ul e stocat** (`sha256`, coloana `tokenHash`, unică), niciodată valoarea brută — un
  dump al bazei de date nu poate fi reluat ca sesiune validă. `actorId`-ul echivalent aici,
  `userId`, e `CASCADE` (nu `RESTRICT` ca la `reporterId`/`authorId` — §4): o sesiune nu e istoric
  de păstrat, la ștergerea contului dispare automat odată cu el.
- **Rotație la fiecare refresh:** `POST /auth/refresh` revocă rândul folosit și creează unul nou —
  un refresh token nu poate fi refolosit de două ori. Dacă totuși e refolosit (cineva a furat un
  token vechi dintr-un loc nesigur și îl joacă după ce proprietarul de drept l-a rotit deja),
  asta e tratat ca semnal de compromitere: **se revocă toate sesiunile acelui utilizator**, nu doar
  cererea curentă — genul clasic de „refresh token reuse detection”.
- **`GET /auth/sessions` / `DELETE /auth/sessions/:id` / `POST /auth/logout-all`** — o pagină
  „Sesiuni active” în Profil, ca utilizatorul să-și vadă și să-și revoce singur sesiunile (cu
  `userAgent` salvat la creare, ca să recunoască „ăla e telefonul meu” / „asta nu sunt eu”).
- **Pe frontend, `lib/api.ts` reîncearcă silențios la un 401:** cere un access token nou via
  refresh token (o singură cerere de refresh în zbor, chiar dacă mai multe request-uri lovesc 401
  simultan) și reia cererea originală o singură dată; doar dacă refresh-ul eșuează și el se ajunge
  la delogare reală. Utilizatorul nu simte expirarea la 15 minute — doar dacă refresh token-ul
  însuși a fost revocat (din Profil, sau prin „Delogează peste tot”) ajunge efectiv pe `/login`.

---

## 20. Rate limiting pe `/auth/*`

**Cerința:** protecție la brute-force pe rutele de autentificare.

- `@nestjs/throttler`, `ThrottlerGuard` aplicat pe întregul `AuthController` (nu global — restul
  API-ului nu are nevoie de limitare de rată, doar rutele de credențiale/token-uri). Limita e per
  IP: **20 cereri/minut** pe fiecare rută din controller (`login`, `register`, `refresh` incluse).
  > **Notă:** 20/minut e generos față de o limită „de manual” tipică (5/minut), ca să nu pice
  > teste e2e sau utilizare normală care retrimite cereri rapid; tot oprește eficient un atac
  > automatizat, care are nevoie de mult mai mult de 20 încercări/minut ca să fie util împotriva
  > unei parole bcrypt-hash-uite.
- Testat explicit în e2e: un burst de 25 cereri paralele pe `/auth/sessions` (rută nefolosită
  altundeva în suite, ca să nu consume accidental bugetul altui test) întoarce atât `200` cât și
  cel puțin un `429`.

---

## 21. Ce aș adăuga în continuare

- Ordonare manuală (rank) a task-urilor în backlog și pe board.
- Notificare (in-app sau email) când primești un invite sau ți se decide o cerere, în loc să trebuiască
  să verifici pagina.

---

## 22. Jurnal de modificări

Pe scurt, în ordine cronologică, ce s-a schimbat după versiunea inițială și de ce (detaliile, mai
sus, în secțiunea corespunzătoare):

| Schimbare | De ce |
|---|---|
| Frontend React nou (§11) | Backend-ul nu avea nicio interfață de folosit efectiv. |
| Sesiune mutată din `localStorage` în `sessionStorage` (§11) | Logarea cu alt cont într-un tab schimba sesiunea în toate tab-urile deschise. |
| Drag-and-drop pe Board (§11) | Mutarea unui task doar din meniul dropdown era greoaie față de un board Jira obișnuit. |
| Actualizări live prin WebSocket (§12) | Board-ul nu se actualiza dacă altcineva muta un task, decât la refresh manual. |
| Cereri de acces la proiect (§13) | Un utilizator nou nu avea nicio cale să ceară acces la un proiect existent. |
| `task.create` nu mai cere `sprint.manage` pentru a pune task-ul direct într-un sprint (§6.2) | Un Developer nu putea adăuga task-uri în sprintul activ din Board; părea un bug („nu apare”), de fapt era o permisiune prea strictă. |
| Backlog redesenat: grupare pe sprint + backlog, colapsabil, cu puncte de poveste și acțiuni de sprint inline | Aliniere cu fluxul standard Jira de planificare a backlog-ului, cerut explicit. |
| Proiecte Company-managed vs. Team-managed (§14); oricine poate crea un proiect Team-managed | Jira real permite echipelor să-și creeze singure proiecte, nu doar adminului; cerut explicit, cu comutator global pentru a putea fi dezactivat. |
| Invitații directe către un cont, cu accept/refuz (§15) | Pe lângă cererea inițiată de utilizator, cineva cu drept de gestionare a membrilor trebuie să poată oferi acces direct unui cont anume. |
| Cererile de acces funcționează și pentru schimbarea rolului unui membru existent (§13) | Un membru existent (ex. Viewer) nu avea nicio cale să ceară un alt rol, doar admin/PM îl putea schimba din proprie inițiativă. |
| Polish vizual general (§11): avatar „neasignat” cu contur punctat în loc de „?”, umbră/elevație la hover pe cardurile de task, coloane goale pe board ca drop-zone punctat, separatoare și hover în navigare | Interfața funcționa corect, dar câteva detalii vizuale citeau ca neintenționate sau plate (ex. „?” pe un avatar arăta ca o eroare), nu ca o decizie de design. |
| Navigare mutată într-un sidebar fix, stil Jira, cu proiecte colorate distinct (§11); scris și butoane mărite | Cerut explicit; tab-urile de sus pentru proiecte nu scalau bine cu mai multe proiecte, iar textul/butoanele erau prea mici pentru utilizare prelungită. |
| `DELETE /users/:id`: ștergere reală de cont, nu doar dezactivare (§5) | Cerut explicit („nu poți să ștergi conturi”); blocat totuși dacă userul a creat task-uri/comentarii, ca istoricul proiectului să nu dispară — dezactivarea rămâne calea pentru acel caz. |
| Buton de ștergere proiect mutat pe rândul din sidebar (icoană coș de gunoi, la hover), nu un „✕” pe cardul din `/projects` | Cerut explicit; și mai practic — ștergi direct din sidebar, din orice pagină, fără să navighezi înapoi la „Toate proiectele”. |
| Epice (§16): grupare de task-uri sub un epic, tab nou „Epice”, chip colorat pe carduri/rânduri | Cerut explicit; implementat ca `Task` cu `type=EPIC` + `epicId` pe celelalte task-uri, nu ca entitate separată, ca să refolosească toată infrastructura existentă. |
| Pagina „Epice” rescrisă ca arbore expandabil (§16): chevron pe fiecare epic, task-urile legate apar indentate dedesubt la expand (lazy-load) | Cerut explicit, pe baza unui screenshot din Jira Cloud real („Timeline”); varianta anterioară (listă de carduri) nu permitea accesul direct la task-urile unui epic. |
| Istoric de activitate pe task (§17): tab „Istoric” în drawer, plus pagină „Jurnal” pentru admin peste toate proiectele | Cerut explicit, ca tab-ul „History” din Jira; clarificat că „backlogul pentru admin” din cerere însemna de fapt jurnalul cine-a-făcut-ce, nu un backlog agregat. |
| Refresh tokens + revocarea sesiunilor (§19): access token scurt (15m), refresh token revocabil (30d) cu rotație și detecție de refolosire, pagină „Sesiuni active” în Profil | Cerut explicit, de pe lista „ce aș adăuga”; access token-ul de 1 zi fără nicio cale de revocare era un risc real dacă un token ar fi fost furat. |
| Rate limiting pe `/auth/*` (§20): `ThrottlerGuard` pe `AuthController`, 20 cereri/minut per IP | Cerut explicit, de pe lista „ce aș adăuga”; nicio rută de autentificare nu avea protecție la brute-force. |
| PM-ul proiectului poate aproba/respinge cereri de acces (§13), nu doar admin | Cerut explicit, de pe lista „ce aș adăuga”; linkul „Cereri” din sidebar e acum vizibil pentru toată lumea, filtrat de backend după `project.members.manage`. |
| Sub-task-uri (§17): `Task` cu `type=SUBTASK` + `parentId` (CASCADE), secțiune „Sub-task-uri” în drawer, excluse din board/backlog | Cerut explicit, de pe lista „ce aș adăuga”; a scos la iveală un bug de `defaultValue` necontrolat pe câmpul Story points la schimbarea task-ului afișat în același drawer (fixat cu `key={task.id}`). |
| Fix: titlul unui task era tăiat/ilizibil în `TaskDrawer` | Semnalat cu un screenshot. Cauza reală: textarea-ul titlului e copil direct al coloanei flex (scrollabile) din drawer; `minHeight: 0` de pe el (necesar ca să poată fi mai mic decât `min-height: 72px` al clasei `.textarea`, comună cu descrierea) elimină și protecția normală a flexbox-ului împotriva micșorării sub înălțimea conținutului, iar coloana oricum depășește spațiul vizibil (e scrollabilă) — rezultat: browserul comprima acel câmp aproape la zero, indiferent de `rows` sau `height` explicit. Fix cu două părți: `flexShrink: 0` (anulează micșorarea), plus auto-creștere pe înălțime măsurată cu `useLayoutEffect`/`scrollHeight` ținută în state React (nu scrisă direct pe DOM) — ca să supraviețuiască re-randărilor ulterioare din drawer (comentarii/istoric/sub-task-uri încărcate async), care altfel ar fi resetat orice înălțime scrisă doar imperativ. |
| Workflow implicit complet deschis la crearea unui proiect (§6.4): fiecare status → fiecare alt status, nu doar un lanț restrâns | Cerut explicit — „orice workflow trebuie să înceapă cu toate accesele de mutare, să-l poți muta cum vrei și de unde vrei”; PM-ul restrânge ulterior din tab-ul Workflow, funcționalitate care exista deja. |
| Fix: niciun task nu era draggable pe Board pentru rolul Developer (§11) | Semnalat direct de utilizator testând ca Developer. `canDrag` folosea `can(TASK_TRANSITION)` fără task, care nu vede grant-urile condiționate (`scope: ASSIGNEE`) — exact scope-ul rolului Developer. Calculat acum per card: `can(...) \|\| task.assigneeId === eu`. |
| Invitațiile tale + cererile tale consolidate pe pagina „Cereri” (§15), cu notificare (contor roșu în sidebar) și update live fără refresh la accept | Cerut explicit; erau împrăștiate pe `/projects`, fără nicio indicație că ai ceva de răspuns. `lib/events.ts` (`CustomEvent` pe `window`) sincronizează sidebar-ul (listă proiecte + contor) instant cu acțiunea proprie a userului. |
| Fix: clic în afara drawer-ului de task nu îl închidea (§11) | Semnalat direct de utilizator. Backdrop-ul era un `<div>` separat peste containerul cu handler-ul `onClose`, deci `e.target === e.currentTarget` nu era niciodată adevărat la clic pe fundal. Handler-ul mutat direct pe backdrop; adăugat și `Escape`. |
| Culoare personalizabilă per epic (§16): coloană `hue` pe `Task`, picker cu 12 nuanțe presetate + „Auto” în `TaskDrawer` | Cerut explicit, cu captură arătând epice cu nuanțe de verde prea apropiate (hash-ul determinist din cheie nu garanta distincție vizuală între epice vecine). `hue` permis doar pe `type=EPIC`; `null` = revine la `hueFromKey` automat. |
| Simbol vizual colorat per tip de task (§11): `<TypeIcon>`, folosit pe Board/Backlog/Epice/sub-task-uri | Cerut explicit, cu captură din Jira real. Reutilizează pattern-ul fundal-pal + text-saturat deja existent la pastilele de status/prioritate, în loc de un stil nou; un singur token nou (`--epic`/`--epic-soft`) pentru epic, singurul tip fără culoare semantică de reutilizat. |
| Poziția unui status din workflow se poate schimba din UI (§6.2): săgeți ▲/▼ în `WorkflowPage.tsx` | Cerut explicit. Backend-ul (`position` în `UpdateStatusDto`) suporta deja reordonarea de la început — doar pagina Workflow nu expunea nicio cale să trimiți acel câmp; niciun cod nou pe backend. |
| Oricine își poate da singur assignee pe un task (§6.2): `TasksService.assign()` sare peste `task.assign` când ținta ești tu însuți, bazându-se doar pe `task.assignable` | Cerut explicit. Scope-ul `ASSIGNEE` al rolurilor IC cerea să fii *deja* assignee ca să devii assignee — imposibil pentru un task liber. Prima variantă (cerere → aprobare de PM, simetrică cu §13) a fost înlocuită la cerere ulterioară cu auto-asignare directă, fără pas de aprobare; modulul de cereri a fost eliminat complet. |
| Selector de proiect pe pagina „Jurnal” (§18), legat de `?project=<id>` în URL | Cerut explicit. `GET /activity` suporta deja `projectId` ca filtru de la început — doar pagina nu expunea nicio cale să-l trimiți, arăta mereu toate proiectele amestecate; niciun cod nou pe backend. |
| Fix: câmpurile unui task (tip, prioritate, story points, descriere) apăreau needitabile în drawer pentru assignee/reporter cu grant-uri condiționate (§11) | Semnalat direct de utilizator. `canUpdate` folosea `can(TASK_UPDATE)` fără task, exact același bug ca la draggability pe Board. Fix: `|| task.assigneeId === eu || task.reporterId === eu`. A scos la iveală și un al doilea gate (`canTransition`) care bloca inutil butoanele „→ Status”, deși lista de tranziții era deja corectă; eliminat complet. |
