import { and, desc, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { acousticProjects, InsertUser, users } from "../drizzle/schema";
import type { AcousticProjectSnapshot } from "../shared/acoustics";
import { hydrateProjectSnapshot, serializeProjectSnapshot } from "../shared/projectPersistence";
import { ENV } from './_core/env';

let _db: ReturnType<typeof drizzle> | null = null;

// Lazily create the drizzle instance so local tooling can run without a DB.
export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) {
    throw new Error("User openId is required for upsert");
  }

  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }

  try {
    const values: InsertUser = {
      openId: user.openId,
    };
    const updateSet: Record<string, unknown> = {};

    const textFields = ["name", "email", "loginMethod"] as const;
    type TextField = (typeof textFields)[number];

    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };

    textFields.forEach(assignNullable);

    if (user.lastSignedIn !== undefined) {
      values.lastSignedIn = user.lastSignedIn;
      updateSet.lastSignedIn = user.lastSignedIn;
    }
    if (user.role !== undefined) {
      values.role = user.role;
      updateSet.role = user.role;
    } else if (user.openId === ENV.ownerOpenId) {
      values.role = 'admin';
      updateSet.role = 'admin';
    }

    if (!values.lastSignedIn) {
      values.lastSignedIn = new Date();
    }

    if (Object.keys(updateSet).length === 0) {
      updateSet.lastSignedIn = new Date();
    }

    await db.insert(users).values(values).onDuplicateKeyUpdate({
      set: updateSet,
    });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get user: database not available");
    return undefined;
  }

  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);

  return result.length > 0 ? result[0] : undefined;
}

export async function listAcousticProjects(ownerId: number) {
  const db = await getDb();
  if (!db) return [];
  const projects = await db.select().from(acousticProjects).where(eq(acousticProjects.ownerId, ownerId)).orderBy(desc(acousticProjects.updatedAt));
  return projects.map((project) => ({ ...project, snapshot: hydrateProjectSnapshot(project.snapshot) }));
}

export async function saveAcousticProject(input: {
  id?: number;
  ownerId: number;
  name: string;
  snapshot: AcousticProjectSnapshot;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  const snapshot = serializeProjectSnapshot(input.snapshot);
  if (input.id) {
    await db.update(acousticProjects).set({ name: input.name, snapshot }).where(and(eq(acousticProjects.id, input.id), eq(acousticProjects.ownerId, input.ownerId)));
    const saved = await db.select().from(acousticProjects).where(and(eq(acousticProjects.id, input.id), eq(acousticProjects.ownerId, input.ownerId))).limit(1);
    return saved[0] ? { ...saved[0], snapshot: hydrateProjectSnapshot(saved[0].snapshot) } : undefined;
  }
  await db.insert(acousticProjects).values({ ownerId: input.ownerId, name: input.name, snapshot });
  const saved = await db.select().from(acousticProjects).where(eq(acousticProjects.ownerId, input.ownerId)).orderBy(desc(acousticProjects.id)).limit(1);
  return saved[0] ? { ...saved[0], snapshot: hydrateProjectSnapshot(saved[0].snapshot) } : undefined;
}
