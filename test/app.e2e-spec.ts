/**
 * End-to-end scenario against a real PostgreSQL database (DB_NAME, default task_tracker_test).
 * The schema is dropped and re-created from migrations on every run.
 */
process.env.DB_NAME = process.env.DB_TEST_NAME ?? 'task_tracker_test';
process.env.DB_DROP_SCHEMA = 'true';
process.env.DB_MIGRATIONS_RUN = 'true';
process.env.JWT_SECRET = 'e2e-test-secret-at-least-16-chars';
process.env.ADMIN_EMAIL = 'admin@test.local';
process.env.ADMIN_PASSWORD = 'Admin123!';
process.env.REGISTRATION_ENABLED = 'true';

import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { setupApp } from '../src/setup-app';

describe('Task Tracker (e2e)', () => {
  let app: INestApplication;
  let http: ReturnType<typeof request>;
  const tok: Record<string, string> = {};
  const ids: Record<string, string> = {};
  const roles: Record<string, string> = {};
  let projectId: string;

  const as = (who: string) => ({
    get: (url: string) => http.get(url).set('Authorization', `Bearer ${tok[who]}`),
    post: (url: string) => http.post(url).set('Authorization', `Bearer ${tok[who]}`),
    patch: (url: string) => http.patch(url).set('Authorization', `Bearer ${tok[who]}`),
    put: (url: string) => http.put(url).set('Authorization', `Bearer ${tok[who]}`),
    delete: (url: string) => http.delete(url).set('Authorization', `Bearer ${tok[who]}`),
  });

  beforeAll(async () => {
    const mod = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = mod.createNestApplication();
    setupApp(app);
    await app.init();
    http = request(app.getHttpServer()) as any;
  });

  afterAll(async () => app?.close());

  // ---------------- auth ----------------

  it('logs in the bootstrap admin', async () => {
    const res = await http.post('/api/auth/login').send({ email: 'admin@test.local', password: 'Admin123!' }).expect(200);
    tok.admin = res.body.accessToken;
    expect(res.body.user.systemRole).toBe('ADMIN');
    expect(res.body.user.passwordHash).toBeUndefined();
  });

  it('rejects requests without a token', () => http.get('/api/projects').expect(401));

  it('rejects wrong credentials with a generic message', async () => {
    const res = await http.post('/api/auth/login').send({ email: 'admin@test.local', password: 'nope' }).expect(401);
    expect(res.body.message).toBe('Invalid e-mail or password');
  });

  it('refresh tokens rotate, reused ones revoke every session, and sessions can be listed/revoked', async () => {
    const login = await http.post('/api/auth/login').send({ email: 'admin@test.local', password: 'Admin123!' }).expect(200);
    expect(login.body.refreshToken).toBeDefined();
    const firstRefresh = login.body.refreshToken;
    const firstAccess = login.body.accessToken;

    const rotated = await http.post('/api/auth/refresh').send({ refreshToken: firstRefresh }).expect(200);
    expect(rotated.body.refreshToken).not.toBe(firstRefresh);

    // Reusing an already-rotated refresh token looks like theft: it revokes every session for that user.
    await http.post('/api/auth/refresh').send({ refreshToken: firstRefresh }).expect(401);
    await http.post('/api/auth/refresh').send({ refreshToken: rotated.body.refreshToken }).expect(401);

    // The old access token issued at login is untouched by refresh-token revocation (still valid until it expires).
    await http.get('/api/users/me').set('Authorization', `Bearer ${firstAccess}`).expect(200);

    const fresh = await http.post('/api/auth/login').send({ email: 'admin@test.local', password: 'Admin123!' }).expect(200);
    const sessions = await http.get('/api/auth/sessions').set('Authorization', `Bearer ${fresh.body.accessToken}`).expect(200);
    expect(sessions.body.length).toBeGreaterThan(0);

    await http
      .delete(`/api/auth/sessions/${sessions.body[0].id}`)
      .set('Authorization', `Bearer ${fresh.body.accessToken}`)
      .expect(204);
    await http.post('/api/auth/refresh').send({ refreshToken: fresh.body.refreshToken }).expect(401);

    const another = await http.post('/api/auth/login').send({ email: 'admin@test.local', password: 'Admin123!' }).expect(200);
    await http.post('/api/auth/logout').send({ refreshToken: another.body.refreshToken }).expect(204);
    await http.post('/api/auth/refresh').send({ refreshToken: another.body.refreshToken }).expect(401);

    await http.post('/api/auth/logout').send({ refreshToken: 'not-a-real-token' }).expect(204); // never leaks existence
  });

  it('validates registration payload and forbids choosing a role', async () => {
    const res = await http
      .post('/api/auth/register')
      .send({ email: 'x', password: 'short', fullName: 'A', systemRole: 'ADMIN' })
      .expect(400);
    expect(res.body.message).toEqual(expect.arrayContaining(['property systemRole should not exist']));
  });

  it('self-registered users get the lowest access', async () => {
    for (const who of ['pm', 'dev', 'dev2', 'qa', 'outsider']) {
      const res = await http
        .post('/api/auth/register')
        .send({ email: `${who}@test.local`, password: 'Passw0rd!', fullName: `User ${who}` })
        .expect(201);
      tok[who] = res.body.accessToken;
      ids[who] = res.body.user.id;
      expect(res.body.user.systemRole).toBe('USER');
    }
    await http
      .post('/api/auth/register')
      .send({ email: 'PM@test.local', password: 'Passw0rd!', fullName: 'Dup' })
      .expect(409);
    const projects = await as('outsider').get('/api/projects').expect(200);
    expect(projects.body).toEqual([]);
  });

  it('non-admins can only self-serve a Team-managed project (and lead it); only admins manage users', async () => {
    const res = await as('pm').post('/api/projects').send({ key: 'SELF', name: 'Self Serve' }).expect(201);
    expect(res.body.management).toBe('TEAM');
    const members = await as('pm').get(`/api/projects/${res.body.id}/members`).expect(200);
    expect(members.body).toHaveLength(1);
    expect(members.body[0].userId).toBe(ids.pm);
    expect(members.body[0].role.name).toBe('Project Manager');

    await as('pm').post('/api/projects').send({ key: 'NOPE', name: 'Nope', management: 'COMPANY' }).expect(403);
    await as('pm').post('/api/users').send({ email: 'a@b.cd', password: 'Passw0rd!', fullName: 'X' }).expect(403);
  });

  // ---------------- project & members ----------------

  it('admin creates a scrum project with a lead (Project Manager)', async () => {
    const res = await as('admin')
      .post('/api/projects')
      .send({ key: 'web', name: 'Website', boardType: 'SCRUM', leadId: ids.pm })
      .expect(201);
    projectId = res.body.id;
    expect(res.body.key).toBe('WEB');

    const wf = await as('pm').get(`/api/projects/${projectId}/workflow`).expect(200);
    expect(wf.body.statuses.map((s: any) => s.key)).toEqual(['TODO', 'IN_PROGRESS', 'IN_REVIEW', 'IN_QA', 'DONE']);

    const list = await as('admin').get('/api/roles').expect(200);
    for (const r of list.body) roles[r.name] = r.id;
  });

  it('non-members get 404 for the project', () =>
    as('outsider').get(`/api/projects/${projectId}`).expect(404));

  it('PM adds members with roles; default role is Viewer', async () => {
    await as('pm').post(`/api/projects/${projectId}/members`).send({ userId: ids.dev, roleId: roles.Developer }).expect(201);
    await as('pm').post(`/api/projects/${projectId}/members`).send({ userId: ids.dev2, roleId: roles.Developer }).expect(201);
    await as('pm').post(`/api/projects/${projectId}/members`).send({ userId: ids.qa, roleId: roles.QA }).expect(201);
    const viewer = await as('pm').post(`/api/projects/${projectId}/members`).send({ userId: ids.outsider }).expect(201);
    expect(viewer.body.role.name).toBe('Viewer');
    await as('pm').post(`/api/projects/${projectId}/members`).send({ userId: ids.dev }).expect(409);
    await as('dev').post(`/api/projects/${projectId}/members`).send({ userId: ids.pm }).expect(403);

    const me = await as('dev').get(`/api/projects/${projectId}`).expect(200);
    expect(me.body.myRole.name).toBe('Developer');
    expect(me.body.myPermissions).toContain('task.create');
    expect(me.body.myPermissions).not.toContain('sprint.manage');
  });

  // ---------------- tasks & RBAC ----------------

  it('creates tasks with sequential keys and validates input', async () => {
    const t1 = await as('pm')
      .post(`/api/projects/${projectId}/tasks`)
      .send({ title: 'Login page', labels: ['Auth', 'auth', 'frontend'], assigneeId: ids.dev, type: 'STORY' })
      .expect(201);
    expect(t1.body.key).toBe('WEB-1');
    expect(t1.body.status.key).toBe('TODO');
    expect(t1.body.labels).toEqual(['auth', 'frontend']);
    ids.t1 = t1.body.id;

    const t2 = await as('dev').post(`/api/projects/${projectId}/tasks`).send({ title: 'Footer links' }).expect(201);
    expect(t2.body.key).toBe('WEB-2');
    ids.t2 = t2.body.id;

    await as('pm').post(`/api/projects/${projectId}/tasks`).send({ title: 'x', priority: 'URGENT' }).expect(400);
    await as('outsider').post(`/api/projects/${projectId}/tasks`).send({ title: 'Viewer task' }).expect(403);
  });

  it('cannot assign to a Viewer (lacks task.assignable)', () =>
    as('pm').put(`/api/tasks/${ids.t2}/assignee`).send({ assigneeId: ids.outsider }).expect(400));

  it('Developer cannot change status of a task not assigned to them', async () => {
    await as('pm').put(`/api/tasks/${ids.t2}/assignee`).send({ assigneeId: ids.dev2 }).expect(200);
    const res = await as('dev').post(`/api/tasks/${ids.t2}/transitions`).send({ status: 'IN_PROGRESS' }).expect(403);
    expect(res.body.message).toContain('assigned to you');
    const available = await as('dev').get(`/api/tasks/${ids.t2}/transitions`).expect(200);
    expect(available.body).toEqual([]);
  });

  it('Developer moves own task through the workflow; illegal jumps are rejected', async () => {
    const opts = await as('dev').get('/api/tasks/WEB-1/transitions').expect(200);
    expect(opts.body.map((s: any) => s.key)).toEqual(['IN_PROGRESS']);
    const bad = await as('dev').post('/api/tasks/WEB-1/transitions').send({ status: 'DONE' }).expect(400);
    expect(bad.body.message).toContain('Allowed: IN_PROGRESS');
    for (const s of ['IN_PROGRESS', 'IN_REVIEW', 'IN_QA']) {
      const r = await as('dev').post('/api/tasks/WEB-1/transitions').send({ status: s }).expect(200);
      expect(r.body.status.key).toBe(s);
    }
  });

  it('Developer can edit own tasks but not others', async () => {
    await as('dev').patch(`/api/tasks/${ids.t2}`).send({ title: 'Footer links (edited by reporter)' }).expect(200);
    const t3 = await as('pm').post(`/api/projects/${projectId}/tasks`).send({ title: 'PM only task' }).expect(201);
    ids.t3 = t3.body.id;
    await as('dev').patch(`/api/tasks/${ids.t3}`).send({ title: 'hijack' }).expect(403);
    await as('dev').patch(`/api/tasks/${ids.t2}`).send({ status: 'DONE' }).expect(400); // not a field here
  });

  it('QA can only act on tasks in IN_QA that are assigned to them', async () => {
    // in IN_QA but assigned to dev -> forbidden
    await as('qa').post('/api/tasks/WEB-1/transitions').send({ status: 'DONE' }).expect(403);
    // developer hands the task over to QA
    await as('dev').put('/api/tasks/WEB-1/assignee').send({ assigneeId: ids.qa }).expect(200);
    // assigned to QA but task WEB-3 is TODO -> forbidden
    await as('pm').put(`/api/tasks/${ids.t3}/assignee`).send({ assigneeId: ids.qa }).expect(200);
    await as('qa').post(`/api/tasks/${ids.t3}/transitions`).send({ status: 'IN_PROGRESS' }).expect(403);
    await as('qa').patch(`/api/tasks/${ids.t3}`).send({ priority: 'HIGH' }).expect(403);
    // in IN_QA and assigned to QA -> allowed
    await as('qa').patch('/api/tasks/WEB-1').send({ labels: ['auth', 'verified'] }).expect(200);
    const done = await as('qa').post('/api/tasks/WEB-1/transitions').send({ status: 'DONE' }).expect(200);
    expect(done.body.status.key).toBe('DONE');
    // once DONE, QA can no longer touch it
    await as('qa').post('/api/tasks/WEB-1/transitions').send({ status: 'IN_PROGRESS' }).expect(403);
  });

  it('Project Manager can modify everything', async () => {
    await as('pm').post(`/api/tasks/${ids.t2}/transitions`).send({ status: 'IN_PROGRESS' }).expect(200);
    await as('pm').patch(`/api/tasks/${ids.t2}`).send({ priority: 'CRITICAL', storyPoints: 5 }).expect(200);
    await as('pm').post('/api/tasks/WEB-1/transitions').send({ status: 'IN_PROGRESS' }).expect(200);
  });

  it('comments: members comment, only author or comment.manage can edit/delete', async () => {
    const c = await as('dev').post('/api/tasks/WEB-1/comments').send({ body: 'Looks good' }).expect(201);
    await as('outsider').post('/api/tasks/WEB-1/comments').send({ body: 'hi' }).expect(403);
    await as('qa').patch(`/api/comments/${c.body.id}`).send({ body: 'edited by qa' }).expect(403);
    await as('dev').patch(`/api/comments/${c.body.id}`).send({ body: 'Looks great' }).expect(200);
    const list = await as('outsider').get('/api/tasks/WEB-1/comments').expect(200);
    expect(list.body).toHaveLength(1);
    expect(list.body[0].author.email).toBe('dev@test.local');
    await as('pm').delete(`/api/comments/${c.body.id}`).expect(204);
  });

  // ---------------- sprints & board ----------------

  it('scrum flow: plan sprint, start, board, complete', async () => {
    await as('dev').post(`/api/projects/${projectId}/sprints`).send({ name: 'S1' }).expect(403);
    const s1 = await as('pm').post(`/api/projects/${projectId}/sprints`).send({ name: 'Sprint 1', goal: 'MVP' }).expect(201);
    const s2 = await as('pm').post(`/api/projects/${projectId}/sprints`).send({ name: 'Sprint 2' }).expect(201);

    for (const t of ['WEB-1', 'WEB-2']) {
      await as('pm').put(`/api/tasks/${t}/sprint`).send({ sprintId: s1.body.id }).expect(200);
    }
    const backlog = await as('dev').get(`/api/projects/${projectId}/tasks?backlog=true`).expect(200);
    expect(backlog.body.items.map((t: any) => t.key)).toEqual(['WEB-3']);

    const end = new Date(Date.now() + 14 * 864e5).toISOString();
    await as('pm').post(`/api/projects/${projectId}/sprints/${s1.body.id}/start`).send({ endDate: end }).expect(200);
    await as('pm').post(`/api/projects/${projectId}/sprints/${s2.body.id}/start`).send({ endDate: end }).expect(409);

    const board = await as('dev').get(`/api/projects/${projectId}/board`).expect(200);
    expect(board.body.sprint.name).toBe('Sprint 1');
    const inProgress = board.body.columns.find((c: any) => c.status.key === 'IN_PROGRESS');
    expect(inProgress.tasks.map((t: any) => t.key).sort()).toEqual(['WEB-1', 'WEB-2']);

    // finish WEB-1 so only WEB-2 is carried over
    for (const s of ['IN_REVIEW', 'IN_QA', 'DONE']) {
      await as('pm').post('/api/tasks/WEB-1/transitions').send({ status: s }).expect(200);
    }
    const done = await as('pm')
      .post(`/api/projects/${projectId}/sprints/${s1.body.id}/complete`)
      .send({ moveOpenTasksToSprintId: s2.body.id })
      .expect(200);
    expect(done.body.movedTasks).toBe(1);
    expect(done.body.completedTasks).toBe(1);
    const t2 = await as('pm').get('/api/tasks/WEB-2').expect(200);
    expect(t2.body.sprint.name).toBe('Sprint 2');
  });

  it('kanban project has no sprints and shows all tasks on the board', async () => {
    const k = await as('admin').post('/api/projects').send({ key: 'OPS', name: 'Ops', boardType: 'KANBAN' }).expect(201);
    await as('admin').post(`/api/projects/${k.body.id}/tasks`).send({ title: 'Rotate keys' }).expect(201);
    await as('admin').post(`/api/projects/${k.body.id}/sprints`).send({ name: 'S' }).expect(400);
    const board = await as('admin').get(`/api/projects/${k.body.id}/board`).expect(200);
    expect(board.body.columns[0].tasks[0].key).toBe('OPS-1');
  });

  it('epics group tasks, cannot nest or be sprinted, and never show up on the board', async () => {
    const epic = await as('pm')
      .post(`/api/projects/${projectId}/tasks`)
      .send({ title: 'Launch v2', type: 'EPIC' })
      .expect(201);
    expect(epic.body.type).toBe('EPIC');
    expect(epic.body.sprintId).toBeNull();

    const sprints = await as('pm').get(`/api/projects/${projectId}/sprints`).expect(200);
    await as('pm')
      .post(`/api/projects/${projectId}/tasks`)
      .send({ title: 'Another epic', type: 'EPIC', sprintId: sprints.body[0].id })
      .expect(400);

    const child = await as('pm')
      .post(`/api/projects/${projectId}/tasks`)
      .send({ title: 'Child of the epic', epicId: epic.body.id })
      .expect(201);
    expect(child.body.epic.id).toBe(epic.body.id);

    const otherEpic = await as('pm').post(`/api/projects/${projectId}/tasks`).send({ title: 'Other epic', type: 'EPIC' }).expect(201);
    await as('pm').patch(`/api/tasks/${otherEpic.body.key}`).send({ epicId: epic.body.id }).expect(400);

    const epics = await as('pm').get(`/api/projects/${projectId}/epics`).expect(200);
    const found = epics.body.find((e: any) => e.id === epic.body.id);
    expect(found.taskCount).toBe(1);
    expect(found.doneCount).toBe(0);
    expect(found.status.category).toBeDefined(); // relation must be loaded for the UI to render a status pill

    const board = await as('pm').get(`/api/projects/${projectId}/board`).expect(200);
    const allBoardKeys = board.body.columns.flatMap((c: any) => c.tasks.map((t: any) => t.key));
    expect(allBoardKeys).not.toContain(epic.body.key);
  });

  it('records task activity (who changed what) and exposes it per-task and system-wide for admins', async () => {
    const task = await as('pm').post(`/api/projects/${projectId}/tasks`).send({ title: 'Track me' }).expect(201);
    const key = task.body.key;

    await as('pm').patch(`/api/tasks/${key}`).send({ title: 'Tracked indeed', priority: 'HIGH' }).expect(200);
    await as('pm').post(`/api/tasks/${key}/transitions`).send({ status: 'IN_PROGRESS' }).expect(200);
    await as('pm').put(`/api/tasks/${key}/assignee`).send({ assigneeId: ids.dev }).expect(200);

    const history = await as('dev').get(`/api/tasks/${key}/activity`).expect(200);
    const fields = history.body.map((e: any) => e.field);
    expect(fields).toEqual(expect.arrayContaining(['title', 'priority', 'status', 'assignee']));
    const statusEntry = history.body.find((e: any) => e.field === 'status');
    expect(statusEntry.fromValue).toBe('To Do');
    expect(statusEntry.toValue).toBe('In Progress');
    expect(statusEntry.actorName).toBeDefined();

    // Updating two fields in the same request shares one timestamp (one "moment" in the history).
    const titleEntry = history.body.find((e: any) => e.field === 'title');
    const priorityEntry = history.body.find((e: any) => e.field === 'priority');
    expect(titleEntry.createdAt).toBe(priorityEntry.createdAt);

    await as('dev').get('/api/activity').expect(403);
    const all = await as('admin').get('/api/activity').expect(200);
    expect(all.body.items.some((e: any) => e.taskId === task.body.id)).toBe(true);
  });

  // ---------------- extensibility ----------------

  it('a new role created by the admin works without code changes', async () => {
    await as('pm')
      .post('/api/roles')
      .send({ name: 'Tech Lead', grants: [{ permission: 'project.view' }] })
      .expect(403);
    await as('admin')
      .post('/api/roles')
      .send({ name: 'Bad', grants: [{ permission: 'sprint.manage', scope: 'ASSIGNEE' }] })
      .expect(400);
    const role = await as('admin')
      .post('/api/roles')
      .send({
        name: 'Tech Lead',
        grants: [
          { permission: 'project.view' },
          { permission: 'task.transition', statuses: ['IN_REVIEW'] },
          { permission: 'comment.create' },
        ],
      })
      .expect(201);
    await as('pm').patch(`/api/projects/${projectId}/members/${ids.dev2}`).send({ roleId: role.body.id }).expect(200);

    // WEB-2 is IN_PROGRESS, not IN_REVIEW -> forbidden; PM moves it to review -> tech lead may move it on
    await as('dev2').post('/api/tasks/WEB-2/transitions').send({ status: 'IN_REVIEW' }).expect(403);
    await as('pm').post('/api/tasks/WEB-2/transitions').send({ status: 'IN_REVIEW' }).expect(200);
    await as('dev2').post('/api/tasks/WEB-2/transitions').send({ status: 'IN_QA' }).expect(200);

    await as('admin').delete(`/api/roles/${role.body.id}`).expect(409); // in use
    await as('admin').delete(`/api/roles/${roles.Developer}`).expect(400); // system role
  });

  it('a new workflow status can be added and wired with transitions', async () => {
    const blocked = await as('pm')
      .post(`/api/projects/${projectId}/workflow/statuses`)
      .send({ key: 'blocked', name: 'Blocked', category: 'IN_PROGRESS', position: 2 })
      .expect(201);
    expect(blocked.body.key).toBe('BLOCKED');
    const wf = await as('pm').get(`/api/projects/${projectId}/workflow`).expect(200);
    expect(wf.body.statuses.map((s: any) => s.key)).toEqual(['TODO', 'IN_PROGRESS', 'BLOCKED', 'IN_REVIEW', 'IN_QA', 'DONE']);
    const inProgress = wf.body.statuses.find((s: any) => s.key === 'IN_PROGRESS');
    await as('dev')
      .post(`/api/projects/${projectId}/workflow/transitions`)
      .send({ fromStatusId: inProgress.id, toStatusId: blocked.body.id })
      .expect(403);
    await as('pm')
      .post(`/api/projects/${projectId}/workflow/transitions`)
      .send({ fromStatusId: inProgress.id, toStatusId: blocked.body.id })
      .expect(201);
    await as('pm').post(`/api/tasks/${ids.t3}/transitions`).send({ status: 'IN_PROGRESS' }).expect(200);
    await as('pm').post(`/api/tasks/${ids.t3}/transitions`).send({ status: 'BLOCKED' }).expect(200);
    await as('pm').delete(`/api/projects/${projectId}/workflow/statuses/${blocked.body.id}`).expect(409); // in use
  });

  // ---------------- admin user management ----------------

  it('admin can deactivate users; their tokens stop working immediately', async () => {
    await as('admin').patch(`/api/users/${ids.outsider}`).send({ isActive: false }).expect(200);
    await as('outsider').get('/api/users/me').expect(401);
    await http.post('/api/auth/login').send({ email: 'outsider@test.local', password: 'Passw0rd!' }).expect(401);
  });

  it('the last admin cannot be demoted', async () => {
    const me = await as('admin').get('/api/users/me').expect(200);
    await as('admin').patch(`/api/users/${me.body.id}`).send({ systemRole: 'USER' }).expect(400);
  });

  it('admin can delete a user with no authored tasks/comments; cannot delete self or the last admin', async () => {
    const me = await as('admin').get('/api/users/me').expect(200);
    await as('admin').delete(`/api/users/${me.body.id}`).expect(400);

    await as('admin').delete(`/api/users/${ids.outsider}`).expect(204);
    await as('admin').get(`/api/users/${ids.outsider}`).expect(404);
  });

  it('removing a member unassigns their tasks', async () => {
    await as('pm').delete(`/api/projects/${projectId}/members/${ids.qa}`).expect(204);
    const t3 = await as('pm').get(`/api/tasks/${ids.t3}`).expect(200);
    expect(t3.body.assigneeId).toBeNull();
    await as('qa').get(`/api/tasks/${ids.t3}`).expect(404);
  });

  // Last test on purpose: it deliberately exhausts this route's rate-limit budget for the
  // current minute, which would make any later test on the same route fail with 429.
  it('throttles rapid-fire requests to /auth/* (brute-force protection)', async () => {
    const bursts = Array.from({ length: 25 }, () => as('admin').get('/api/auth/sessions'));
    const results = await Promise.all(bursts);
    expect(results.some((r) => r.status === 200)).toBe(true);
    expect(results.some((r) => r.status === 429)).toBe(true);
  });
});
