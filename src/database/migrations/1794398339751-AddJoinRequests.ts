import { MigrationInterface, QueryRunner } from "typeorm";

export class AddJoinRequests1794398339751 implements MigrationInterface {
    name = 'AddJoinRequests1794398339751'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TYPE "public"."join_requests_status_enum" AS ENUM('PENDING', 'APPROVED', 'REJECTED')`);
        await queryRunner.query(`CREATE TABLE "join_requests" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "project_id" uuid NOT NULL, "user_id" uuid NOT NULL, "role_id" uuid NOT NULL, "message" text NOT NULL DEFAULT '', "status" "public"."join_requests_status_enum" NOT NULL DEFAULT 'PENDING', "decided_by_id" uuid, "decided_at" TIMESTAMP WITH TIME ZONE, CONSTRAINT "PK_3584a09620923a5aaf7de782f0d" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE UNIQUE INDEX "uq_join_request_one_pending_per_project_user" ON "join_requests" ("project_id", "user_id") WHERE "status" = 'PENDING'`);
        await queryRunner.query(`ALTER TABLE "join_requests" ADD CONSTRAINT "FK_77b007b72761a4cb7028719b938" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "join_requests" ADD CONSTRAINT "FK_b3ed52f33226ac678d4f931943a" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "join_requests" ADD CONSTRAINT "FK_b4141c3c9d8fd35e7d15e0c3807" FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "join_requests" ADD CONSTRAINT "FK_d827ef77fe0320f57456bd64a06" FOREIGN KEY ("decided_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "join_requests" DROP CONSTRAINT "FK_d827ef77fe0320f57456bd64a06"`);
        await queryRunner.query(`ALTER TABLE "join_requests" DROP CONSTRAINT "FK_b4141c3c9d8fd35e7d15e0c3807"`);
        await queryRunner.query(`ALTER TABLE "join_requests" DROP CONSTRAINT "FK_b3ed52f33226ac678d4f931943a"`);
        await queryRunner.query(`ALTER TABLE "join_requests" DROP CONSTRAINT "FK_77b007b72761a4cb7028719b938"`);
        await queryRunner.query(`DROP INDEX "public"."uq_join_request_one_pending_per_project_user"`);
        await queryRunner.query(`DROP TABLE "join_requests"`);
        await queryRunner.query(`DROP TYPE "public"."join_requests_status_enum"`);
    }

}
