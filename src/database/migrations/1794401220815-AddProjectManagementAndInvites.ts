import { MigrationInterface, QueryRunner } from "typeorm";

export class AddProjectManagementAndInvites1794401220815 implements MigrationInterface {
    name = 'AddProjectManagementAndInvites1794401220815'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TYPE "public"."project_invites_status_enum" AS ENUM('PENDING', 'ACCEPTED', 'DECLINED')`);
        await queryRunner.query(`CREATE TABLE "project_invites" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "project_id" uuid NOT NULL, "user_id" uuid NOT NULL, "role_id" uuid NOT NULL, "invited_by_id" uuid NOT NULL, "status" "public"."project_invites_status_enum" NOT NULL DEFAULT 'PENDING', "responded_at" TIMESTAMP WITH TIME ZONE, CONSTRAINT "PK_cd5cde76dc930ec3897f3911f16" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE UNIQUE INDEX "uq_invite_one_pending_per_project_user" ON "project_invites" ("project_id", "user_id") WHERE "status" = 'PENDING'`);
        await queryRunner.query(`CREATE TYPE "public"."projects_management_enum" AS ENUM('COMPANY', 'TEAM')`);
        await queryRunner.query(`ALTER TABLE "projects" ADD "management" "public"."projects_management_enum" NOT NULL DEFAULT 'TEAM'`);
        await queryRunner.query(`ALTER TABLE "project_invites" ADD CONSTRAINT "FK_c422f909ce92e487b363b78eb97" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "project_invites" ADD CONSTRAINT "FK_19b7be343b80a2417639d8c3b91" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "project_invites" ADD CONSTRAINT "FK_4eebb5bad589c66c2186774a881" FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "project_invites" ADD CONSTRAINT "FK_8c1285f38ff4fe7fd9a53cb140a" FOREIGN KEY ("invited_by_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "project_invites" DROP CONSTRAINT "FK_8c1285f38ff4fe7fd9a53cb140a"`);
        await queryRunner.query(`ALTER TABLE "project_invites" DROP CONSTRAINT "FK_4eebb5bad589c66c2186774a881"`);
        await queryRunner.query(`ALTER TABLE "project_invites" DROP CONSTRAINT "FK_19b7be343b80a2417639d8c3b91"`);
        await queryRunner.query(`ALTER TABLE "project_invites" DROP CONSTRAINT "FK_c422f909ce92e487b363b78eb97"`);
        await queryRunner.query(`ALTER TABLE "projects" DROP COLUMN "management"`);
        await queryRunner.query(`DROP TYPE "public"."projects_management_enum"`);
        await queryRunner.query(`DROP INDEX "public"."uq_invite_one_pending_per_project_user"`);
        await queryRunner.query(`DROP TABLE "project_invites"`);
        await queryRunner.query(`DROP TYPE "public"."project_invites_status_enum"`);
    }

}
