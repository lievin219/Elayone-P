-- CreateTable
CREATE TABLE "EventInvitation" (
    "id" TEXT NOT NULL,
    "rehearsalId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EventInvitation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "EventInvitation_rehearsalId_userId_key" ON "EventInvitation"("rehearsalId", "userId");

-- AddForeignKey
ALTER TABLE "EventInvitation" ADD CONSTRAINT "EventInvitation_rehearsalId_fkey" FOREIGN KEY ("rehearsalId") REFERENCES "Rehearsal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventInvitation" ADD CONSTRAINT "EventInvitation_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
