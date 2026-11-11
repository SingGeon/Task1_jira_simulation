import { MigrationInterface, QueryRunner } from "typeorm";

export class AddTaskActivities1794423583047 implements MigrationInterface {
    name = 'AddTaskActivities1794423583047'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "task_activities" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "task_id" uuid NOT NULL, "actor_id" uuid NOT NULL, "actor_name" character varying(120) NOT NULL, "field" character varying(40) NOT NULL, "from_value" text, "to_value" text, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL, CONSTRAINT "PK_b7b39b92ce3a5cd42cf81a0dd3a" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_6c16dbc1f4693fc90f1a7f87a9" ON "task_activities" ("task_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_41e3b3af30f59234457df463b7" ON "task_activities" ("actor_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_8c5bcff65f50b611693a58ac04" ON "task_activities" ("created_at") `);
        await queryRunner.query(`ALTER TABLE "task_activities" ADD CONSTRAINT "FK_6c16dbc1f4693fc90f1a7f87a96" FOREIGN KEY ("task_id") REFERENCES "tasks"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "task_activities" ADD CONSTRAINT "FK_41e3b3af30f59234457df463b7d" FOREIGN KEY ("actor_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "task_activities" DROP CONSTRAINT "FK_41e3b3af30f59234457df463b7d"`);
        await queryRunner.query(`ALTER TABLE "task_activities" DROP CONSTRAINT "FK_6c16dbc1f4693fc90f1a7f87a96"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_8c5bcff65f50b611693a58ac04"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_41e3b3af30f59234457df463b7"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_6c16dbc1f4693fc90f1a7f87a9"`);
        await queryRunner.query(`DROP TABLE "task_activities"`);
    }

}
