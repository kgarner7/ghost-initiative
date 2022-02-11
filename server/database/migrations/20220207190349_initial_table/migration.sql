-- CreateTable
CREATE TABLE "Character" (
    "name" TEXT NOT NULL,
    "dex" SMALLINT NOT NULL,
    "hidden" BOOLEAN NOT NULL,
    "player" BOOLEAN NOT NULL,
    "roll" SMALLINT,
    "wis" SMALLINT NOT NULL,

    CONSTRAINT "Character_pkey" PRIMARY KEY ("name")
);
