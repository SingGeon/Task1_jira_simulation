import { MigrationInterface, QueryRunner } from "typeorm";

export class AddEpicHue1794480390023 implements MigrationInterface {
    name = 'AddEpicHue1794480390023'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "tasks" ADD "hue" smallint`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "tasks" DROP COLUMN "hue"`);
    }

}
