import bcrypt from "bcryptjs";
import { db, entitiesTable, employeesTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { logger } from "./logger";

export async function seedDefaultAdmin() {
  try {
    // Ensure a default entity exists
    let entity = await db.query.entitiesTable.findFirst();
    if (!entity) {
      const [created] = await db
        .insert(entitiesTable)
        .values({
          name: "Hope NeuroTrauma & MultiSpeciality Hospital",
          type: "hospital",
          owner: "Abinash Singh",
          email: "abinashsingh@gmail.com",
        })
        .returning();
      entity = created;
      logger.info({ entityId: entity.id }, "Default entity created");
    }

    // Check if this admin already exists
    const existing = await db.query.employeesTable.findFirst({
      where: eq(employeesTable.username, "abinashsingh"),
    });

    const pinHash = await bcrypt.hash("1234", 12);

    if (!existing) {
      await db.insert(employeesTable).values({
        entityId: entity.id,
        empCode: "ADMIN001",
        name: "Abinash Singh",
        username: "abinashsingh",
        email: "abinashsingh@gmail.com",
        role: "admin",
        department: "Administration",
        pinHash,
        isActive: true,
      });
      logger.info("Default admin account created (username: abinashsingh)");
    } else if (!existing.isActive) {
      // Re-activate if somehow disabled
      await db
        .update(employeesTable)
        .set({ isActive: true, pinHash })
        .where(eq(employeesTable.username, "abinashsingh"));
      logger.info("Default admin account re-activated");
    }
  } catch (err) {
    // Log but don't crash the server — DB may not be migrated yet on first boot
    logger.warn({ err }, "seedDefaultAdmin: skipped (database may not be ready)");
  }
}
