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

> **Notă (schimbare ulterioară): navigare din bară laterală, stil Jira, în loc de tab-uri sus.**
> Inițial, proiectele erau doar o pagină (`/projects`) la care te întorceai ca să schimbi proiectul.
> Cerut explicit: o bară fixă în stânga (`components/Sidebar.tsx`) cu toate proiectele tale, fiecare
> cu un pătrat colorat derivat determinist din cheia proiectului (hash simplu → nuanță HSL), plus o
> secțiune „Admin” separată printr-un divizor. Bara de sus a rămas doar pentru profil/logout — nu mai
> are nevoie de taburi de navigare, acelea au trecut în sidebar. Pagina `/projects` a rămas accesibilă
> din „Toate proiectele” — acolo stau în continuare creare/cereri/invitații, care n-ar încăpea firesc
> într-o bară laterală îngustă.
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
- Am ales **adminul ca aprobator unic** (nu și PM-ul proiectului respectiv), ca să rămână simplu de
  văzut unde se decide — o singură coadă, o singură pagină de admin (`/admin/join-requests`).

> **Notă (schimbare ulterioară): cererea funcționează și pentru schimbarea rolului, nu doar pentru
> alăturare.** Cerința inițială era doar „vreau acces la acest proiect”, dar un membru existent
> (ex. Viewer) nu avea nicio cale să ceară să devină Developer — doar admin/PM îi putea schimba
> rolul direct, fără ca el să inițieze nimic. Am relaxat `JoinRequestsService.create()`: dacă ești
> deja membru, poți tot trimite o cerere (cu alt rol decât cel curent), iar `approve()` detectează
> automat cazul și apelează `changeRole()` în loc de `addMember()`. Am ales să **nu** creez o entitate
> separată pentru asta — e aceeași formă de date (`{ project, rol dorit, mesaj }`) și aceeași coadă
> de aprobare a adminului, doar efectul diferă în funcție de apartenența existentă.

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

---

## 17. Ce aș adăuga în continuare

- Istoric de activitate pe task (cine a schimbat ce și când), ca „History” din Jira.
- Refresh tokens și revocarea sesiunilor.
- Ordonare manuală (rank) a task-urilor în backlog și pe board.
- Sub-task-uri (relații părinte–copil mai fine, în interiorul unei povești/task — diferit de epice,
  care grupează la un nivel mai sus; vezi §16).
- Rate limiting pe `/auth/*`.
- Aprobare de către PM-ul proiectului, nu doar admin, pentru cererile de acces (§13).
- Notificare (in-app sau email) când primești un invite sau ți se decide o cerere, în loc să trebuiască
  să verifici pagina.

---

## 18. Jurnal de modificări

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
| Buton de ștergere proiect adăugat pe `/projects` (admin) | Endpoint-ul `DELETE /projects/:id` exista deja pe backend, dar nu avea nicio interfață — nu era un bug de permisiuni, doar un control lipsă. |
| Epice (§16): grupare de task-uri sub un epic, tab nou „Epice”, chip colorat pe carduri/rânduri | Cerut explicit; implementat ca `Task` cu `type=EPIC` + `epicId` pe celelalte task-uri, nu ca entitate separată, ca să refolosească toată infrastructura existentă. |
