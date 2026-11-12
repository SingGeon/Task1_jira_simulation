import { MigrationInterface, QueryRunner } from "typeorm";

export class AddSubtasks1794425390538 implements MigrationInterface {
    name = 'AddSubtasks1794425390538'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "tasks" ADD "parent_id" uuid`);
        await queryRunner.query(`ALTER TYPE "public"."tasks_type_enum" RENAME TO "tasks_type_enum_old"`);
        await queryRunner.query(`CREATE TYPE "public"."tasks_type_enum" AS ENUM('EPIC', 'STORY', 'TASK', 'BUG', 'SUBTASK')`);
        await queryRunner.query(`ALTER TABLE "tasks" ALTER COLUMN "type" DROP DEFAULT`);
        await queryRunner.query(`ALTER TABLE "tasks" ALTER COLUMN "type" TYPE "public"."tasks_type_enum" USING "type"::"text"::"public"."tasks_type_enum"`);
        await queryRunner.query(`ALTER TABLE "tasks" ALTER COLUMN "type" SET DEFAULT 'TASK'`);
        await queryRunner.query(`DROP TYPE "public"."tasks_type_enum_old"`);
        await queryRunner.query(`CREATE INDEX "IDX_b03c99063a4eaf084f069a4d5a" ON "tasks" ("parent_id") `);
        await queryRunner.query(`ALTER TABLE "tasks" ADD CONSTRAINT "FK_b03c99063a4eaf084f069a4d5a7" FOREIGN KEY ("parent_id") REFERENCES "tasks"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "tasks" DROP CONSTRAINT "FK_b03c99063a4eaf084f069a4d5a7"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_b03c99063a4eaf084f069a4d5a"`);
        await queryRunner.query(`CREATE TYPE "public"."tasks_type_enum_old" AS ENUM('EPIC', 'STORY', 'TASK', 'BUG')`);
        await queryRunner.query(`ALTER TABLE "tasks" ALTER COLUMN "type" DROP DEFAULT`);
        await queryRunner.query(`ALTER TABLE "tasks" ALTER COLUMN "type" TYPE "public"."tasks_type_enum_old" USING "type"::"text"::"public"."tasks_type_enum_old"`);
        await queryRunner.query(`ALTER TABLE "tasks" ALTER COLUMN "type" SET DEFAULT 'TASK'`);
        await queryRunner.query(`DROP TYPE "public"."tasks_type_enum"`);
        await queryRunner.query(`ALTER TYPE "public"."tasks_type_enum_old" RENAME TO "tasks_type_enum"`);
        await queryRunner.query(`ALTER TABLE "tasks" DROP COLUMN "parent_id"`);
    }

}
