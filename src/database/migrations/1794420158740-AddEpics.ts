import { MigrationInterface, QueryRunner } from "typeorm";

export class AddEpics1794420158740 implements MigrationInterface {
    name = 'AddEpics1794420158740'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "tasks" ADD "epic_id" uuid`);
        await queryRunner.query(`ALTER TYPE "public"."tasks_type_enum" RENAME TO "tasks_type_enum_old"`);
        await queryRunner.query(`CREATE TYPE "public"."tasks_type_enum" AS ENUM('EPIC', 'STORY', 'TASK', 'BUG')`);
        await queryRunner.query(`ALTER TABLE "tasks" ALTER COLUMN "type" DROP DEFAULT`);
        await queryRunner.query(`ALTER TABLE "tasks" ALTER COLUMN "type" TYPE "public"."tasks_type_enum" USING "type"::"text"::"public"."tasks_type_enum"`);
        await queryRunner.query(`ALTER TABLE "tasks" ALTER COLUMN "type" SET DEFAULT 'TASK'`);
        await queryRunner.query(`DROP TYPE "public"."tasks_type_enum_old"`);
        await queryRunner.query(`CREATE INDEX "IDX_3cf518f29b352b448ebcc3947f" ON "tasks" ("epic_id") `);
        await queryRunner.query(`ALTER TABLE "tasks" ADD CONSTRAINT "FK_3cf518f29b352b448ebcc3947f3" FOREIGN KEY ("epic_id") REFERENCES "tasks"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "tasks" DROP CONSTRAINT "FK_3cf518f29b352b448ebcc3947f3"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_3cf518f29b352b448ebcc3947f"`);
        await queryRunner.query(`CREATE TYPE "public"."tasks_type_enum_old" AS ENUM('STORY', 'TASK', 'BUG')`);
        await queryRunner.query(`ALTER TABLE "tasks" ALTER COLUMN "type" DROP DEFAULT`);
        await queryRunner.query(`ALTER TABLE "tasks" ALTER COLUMN "type" TYPE "public"."tasks_type_enum_old" USING "type"::"text"::"public"."tasks_type_enum_old"`);
        await queryRunner.query(`ALTER TABLE "tasks" ALTER COLUMN "type" SET DEFAULT 'TASK'`);
        await queryRunner.query(`DROP TYPE "public"."tasks_type_enum"`);
        await queryRunner.query(`ALTER TYPE "public"."tasks_type_enum_old" RENAME TO "tasks_type_enum"`);
        await queryRunner.query(`ALTER TABLE "tasks" DROP COLUMN "epic_id"`);
    }

}
