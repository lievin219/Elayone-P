-- CreateTable
CREATE TABLE "EventSong" (
    "id" TEXT NOT NULL,
    "rehearsalId" TEXT NOT NULL,
    "songId" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EventSong_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "EventSong_rehearsalId_songId_key" ON "EventSong"("rehearsalId", "songId");

-- AddForeignKey
ALTER TABLE "EventSong" ADD CONSTRAINT "EventSong_rehearsalId_fkey" FOREIGN KEY ("rehearsalId") REFERENCES "Rehearsal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventSong" ADD CONSTRAINT "EventSong_songId_fkey" FOREIGN KEY ("songId") REFERENCES "Song"("id") ON DELETE CASCADE ON UPDATE CASCADE;
