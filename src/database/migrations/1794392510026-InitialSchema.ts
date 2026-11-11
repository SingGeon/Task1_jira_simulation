import { MigrationInterface, QueryRunner } from "typeorm";

export class InitialSchema1794392510026 implements MigrationInterface {
    name = 'InitialSchema1794392510026'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TYPE "public"."users_system_role_enum" AS ENUM('ADMIN', 'USER')`);
        await queryRunner.query(`CREATE TABLE "users" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "email" character varying(255) NOT NULL, "password_hash" character varying NOT NULL, "full_name" character varying(120) NOT NULL, "system_role" "public"."users_system_role_enum" NOT NULL DEFAULT 'USER', "is_active" boolean NOT NULL DEFAULT true, CONSTRAINT "PK_a3ffb1c0c8416b9fc6f907b7433" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_97672ac88f789774dd47f7c8be" ON "users" ("email") `);
        await queryRunner.query(`CREATE TABLE "roles" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "name" character varying(60) NOT NULL, "description" text NOT NULL DEFAULT '', "grants" jsonb NOT NULL DEFAULT '[]', "is_system" boolean NOT NULL DEFAULT false, "is_default" boolean NOT NULL DEFAULT false, CONSTRAINT "PK_c1433d71a4838793a49dcad46ab" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_648e3f5447f725579d7d4ffdfb" ON "roles" ("name") `);
        await queryRunner.query(`CREATE TABLE "project_members" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "project_id" uuid NOT NULL, "user_id" uuid NOT NULL, "role_id" uuid NOT NULL, CONSTRAINT "UQ_b3f491d3a3f986106d281d8eb4b" UNIQUE ("project_id", "user_id"), CONSTRAINT "PK_0b2f46f804be4aea9234c78bcc9" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TYPE "public"."projects_board_type_enum" AS ENUM('SCRUM', 'KANBAN')`);
        await queryRunner.query(`CREATE TABLE "projects" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "key" character varying(10) NOT NULL, "name" character varying(120) NOT NULL, "description" text NOT NULL DEFAULT '', "board_type" "public"."projects_board_type_enum" NOT NULL DEFAULT 'SCRUM', "task_counter" integer NOT NULL DEFAULT '0', CONSTRAINT "PK_6271df0a7aed1d6c0691ce6ac50" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_63e67599567b2126cfef14e147" ON "projects" ("key") `);
        await queryRunner.query(`CREATE TYPE "public"."workflow_statuses_category_enum" AS ENUM('TODO', 'IN_PROGRESS', 'DONE')`);
        await queryRunner.query(`CREATE TABLE "workflow_statuses" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "project_id" uuid NOT NULL, "key" character varying(40) NOT NULL, "name" character varying(60) NOT NULL, "category" "public"."workflow_statuses_category_enum" NOT NULL, "position" integer NOT NULL, CONSTRAINT "UQ_ea5814d3a982e0c47628e48f060" UNIQUE ("project_id", "key"), CONSTRAINT "PK_5933af9b773c575a905467543f5" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "workflow_transitions" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "project_id" uuid NOT NULL, "from_status_id" uuid NOT NULL, "to_status_id" uuid NOT NULL, CONSTRAINT "UQ_70376be475aa965d699d6008006" UNIQUE ("from_status_id", "to_status_id"), CONSTRAINT "PK_edda0b5bb7b13fc6681c56764af" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TYPE "public"."sprints_state_enum" AS ENUM('PLANNED', 'ACTIVE', 'CLOSED')`);
        await queryRunner.query(`CREATE TABLE "sprints" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "project_id" uuid NOT NULL, "name" character varying(80) NOT NULL, "goal" text NOT NULL DEFAULT '', "state" "public"."sprints_state_enum" NOT NULL DEFAULT 'PLANNED', "start_date" TIMESTAMP WITH TIME ZONE, "end_date" TIMESTAMP WITH TIME ZONE, "completed_at" TIMESTAMP WITH TIME ZONE, CONSTRAINT "PK_6800aa2e0f508561812c4b9afb4" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE UNIQUE INDEX "uq_sprint_one_active_per_project" ON "sprints" ("project_id") WHERE "state" = 'ACTIVE'`);
        await queryRunner.query(`CREATE TYPE "public"."tasks_type_enum" AS ENUM('STORY', 'TASK', 'BUG')`);
        await queryRunner.query(`CREATE TYPE "public"."tasks_priority_enum" AS ENUM('LOW', 'MEDIUM', 'HIGH', 'CRITICAL')`);
        await queryRunner.query(`CREATE TABLE "tasks" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "project_id" uuid NOT NULL, "key" character varying(24) NOT NULL, "title" character varying(200) NOT NULL, "description" text NOT NULL DEFAULT '', "type" "public"."tasks_type_enum" NOT NULL DEFAULT 'TASK', "priority" "public"."tasks_priority_enum" NOT NULL DEFAULT 'MEDIUM', "labels" text array NOT NULL DEFAULT '{}', "story_points" integer, "status_id" uuid NOT NULL, "assignee_id" uuid, "reporter_id" uuid NOT NULL, "sprint_id" uuid, CONSTRAINT "PK_8d12ff38fcc62aaba2cab748772" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_c0abf6686e93b2a6497e0cdc22" ON "tasks" ("key") `);
        await queryRunner.query(`CREATE INDEX "IDX_e28288969fa7827bd12680cfe1" ON "tasks" ("status_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_855d484825b715c545349212c7" ON "tasks" ("assignee_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_b512d5a489d692f66569978b8a" ON "tasks" ("sprint_id") `);
        await queryRunner.query(`CREATE TABLE "comments" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "task_id" uuid NOT NULL, "author_id" uuid NOT NULL, "body" text NOT NULL, CONSTRAINT "PK_8bf68bc960f2b69e818bdb90dcb" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_18c2493067c11f44efb35ca0e0" ON "comments" ("task_id") `);
        await queryRunner.query(`ALTER TABLE "project_members" ADD CONSTRAINT "FK_b5729113570c20c7e214cf3f58d" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "project_members" ADD CONSTRAINT "FK_e89aae80e010c2faa72e6a49ce8" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "project_members" ADD CONSTRAINT "FK_47b9998e6fef04f3e85e1e60948" FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "workflow_statuses" ADD CONSTRAINT "FK_ea78a26a6c8c25bb65869c6a789" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "workflow_transitions" ADD CONSTRAINT "FK_aaa112d59ba29710dae44b24267" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "workflow_transitions" ADD CONSTRAINT "FK_8cb7034f4257d080e9124e13db7" FOREIGN KEY ("from_status_id") REFERENCES "workflow_statuses"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "workflow_transitions" ADD CONSTRAINT "FK_c9d9c163db11bfafce74e2f7c65" FOREIGN KEY ("to_status_id") REFERENCES "workflow_statuses"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "sprints" ADD CONSTRAINT "FK_82145010051f3f2fc94671c0b35" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "tasks" ADD CONSTRAINT "FK_9eecdb5b1ed8c7c2a1b392c28d4" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "tasks" ADD CONSTRAINT "FK_e28288969fa7827bd12680cfe10" FOREIGN KEY ("status_id") REFERENCES "workflow_statuses"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "tasks" ADD CONSTRAINT "FK_855d484825b715c545349212c7f" FOREIGN KEY ("assignee_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "tasks" ADD CONSTRAINT "FK_87d662c4ff7beec6ad017466fc4" FOREIGN KEY ("reporter_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "tasks" ADD CONSTRAINT "FK_b512d5a489d692f66569978b8a7" FOREIGN KEY ("sprint_id") REFERENCES "sprints"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "comments" ADD CONSTRAINT "FK_18c2493067c11f44efb35ca0e03" FOREIGN KEY ("task_id") REFERENCES "tasks"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "comments" ADD CONSTRAINT "FK_e6d38899c31997c45d128a8973b" FOREIGN KEY ("author_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "comments" DROP CONSTRAINT "FK_e6d38899c31997c45d128a8973b"`);
        await queryRunner.query(`ALTER TABLE "comments" DROP CONSTRAINT "FK_18c2493067c11f44efb35ca0e03"`);
        await queryRunner.query(`ALTER TABLE "tasks" DROP CONSTRAINT "FK_b512d5a489d692f66569978b8a7"`);
        await queryRunner.query(`ALTER TABLE "tasks" DROP CONSTRAINT "FK_87d662c4ff7beec6ad017466fc4"`);
        await queryRunner.query(`ALTER TABLE "tasks" DROP CONSTRAINT "FK_855d484825b715c545349212c7f"`);
        await queryRunner.query(`ALTER TABLE "tasks" DROP CONSTRAINT "FK_e28288969fa7827bd12680cfe10"`);
        await queryRunner.query(`ALTER TABLE "tasks" DROP CONSTRAINT "FK_9eecdb5b1ed8c7c2a1b392c28d4"`);
        await queryRunner.query(`ALTER TABLE "sprints" DROP CONSTRAINT "FK_82145010051f3f2fc94671c0b35"`);
        await queryRunner.query(`ALTER TABLE "workflow_transitions" DROP CONSTRAINT "FK_c9d9c163db11bfafce74e2f7c65"`);
        await queryRunner.query(`ALTER TABLE "workflow_transitions" DROP CONSTRAINT "FK_8cb7034f4257d080e9124e13db7"`);
        await queryRunner.query(`ALTER TABLE "workflow_transitions" DROP CONSTRAINT "FK_aaa112d59ba29710dae44b24267"`);
        await queryRunner.query(`ALTER TABLE "workflow_statuses" DROP CONSTRAINT "FK_ea78a26a6c8c25bb65869c6a789"`);
        await queryRunner.query(`ALTER TABLE "project_members" DROP CONSTRAINT "FK_47b9998e6fef04f3e85e1e60948"`);
        await queryRunner.query(`ALTER TABLE "project_members" DROP CONSTRAINT "FK_e89aae80e010c2faa72e6a49ce8"`);
        await queryRunner.query(`ALTER TABLE "project_members" DROP CONSTRAINT "FK_b5729113570c20c7e214cf3f58d"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_18c2493067c11f44efb35ca0e0"`);
        await queryRunner.query(`DROP TABLE "comments"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_b512d5a489d692f66569978b8a"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_855d484825b715c545349212c7"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_e28288969fa7827bd12680cfe1"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_c0abf6686e93b2a6497e0cdc22"`);
        await queryRunner.query(`DROP TABLE "tasks"`);
        await queryRunner.query(`DROP TYPE "public"."tasks_priority_enum"`);
        await queryRunner.query(`DROP TYPE "public"."tasks_type_enum"`);
        await queryRunner.query(`DROP INDEX "public"."uq_sprint_one_active_per_project"`);
        await queryRunner.query(`DROP TABLE "sprints"`);
        await queryRunner.query(`DROP TYPE "public"."sprints_state_enum"`);
        await queryRunner.query(`DROP TABLE "workflow_transitions"`);
        await queryRunner.query(`DROP TABLE "workflow_statuses"`);
        await queryRunner.query(`DROP TYPE "public"."workflow_statuses_category_enum"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_63e67599567b2126cfef14e147"`);
        await queryRunner.query(`DROP TABLE "projects"`);
        await queryRunner.query(`DROP TYPE "public"."projects_board_type_enum"`);
        await queryRunner.query(`DROP TABLE "project_members"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_648e3f5447f725579d7d4ffdfb"`);
        await queryRunner.query(`DROP TABLE "roles"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_97672ac88f789774dd47f7c8be"`);
        await queryRunner.query(`DROP TABLE "users"`);
        await queryRunner.query(`DROP TYPE "public"."users_system_role_enum"`);
    }

}
