import pool from "../utils/db.js";
import type { Contact, IdentifyRequest, IdentifyResponse } from "../types/identifyServiceTypes.js";


const unique = <T>(arr: T[]) => [...new Set(arr)];

async function findMatchingContacts(email: string | null, phoneNumber: string | null): Promise<Contact[]> {
  const conditions: string[] = [];
  const params: string[] = [];

  if (email)       { conditions.push(`email = $${params.push(email)}`); }
  if (phoneNumber) { conditions.push(`phonenumber = $${params.push(phoneNumber)}`); }
  if (!conditions.length) return [];

  const { rows } = await pool.query<Contact>(
    `SELECT * FROM contact WHERE (${conditions.join(" OR ")}) AND deletedat IS NULL`,
    params
  );
  return rows;
}

async function expandCluster(seeds: Contact[]): Promise<Contact[]> {
  const visited = new Set<number>();
  const queue = [...seeds];
  const result: Contact[] = [];

  while (queue.length) {
    const contact = queue.shift()!;
    if (visited.has(contact.id)) continue;
    visited.add(contact.id);
    result.push(contact);

    const rootId = contact.linkprecedence === "primary" ? contact.id : contact.linkedid!;
    const { rows } = await pool.query<Contact>(
      `SELECT * FROM contact WHERE (id = $1 OR linkedid = $1) AND deletedat IS NULL`,
      [rootId]
    );
    for (const row of rows) {
      if (!visited.has(row.id)) queue.push(row);
    }
  }
  return result;
}

async function createContact(
  email: string | null, phoneNumber: string | null,
  linkedId: number | null, linkPrecedence: "primary" | "secondary"
): Promise<Contact> {
  const { rows } = await pool.query<Contact>(
    `INSERT INTO contact (phonenumber, email, linkedid, linkprecedence, createdat, updatedat)
     VALUES ($1, $2, $3, $4, NOW(), NOW()) RETURNING *`,
    [phoneNumber, email, linkedId, linkPrecedence]
  );
  if (!rows[0]) throw new Error("Failed to create contact");
  return rows[0];
}

function buildResponse(allContacts: Contact[], primaryId: number): IdentifyResponse {
  const primary = allContacts.find((c) => c.id === primaryId)!;
  const secondaries = allContacts.filter((c) => c.id !== primaryId);

  return {
    contact: {
      primaryContatctId: primaryId,
      emails: unique([primary.email, ...secondaries.map((c) => c.email)].filter(Boolean) as string[]),
      phoneNumbers: unique([primary.phonenumber, ...secondaries.map((c) => c.phonenumber)].filter(Boolean) as string[]),
      secondaryContactIds: secondaries.map((c) => c.id),
    },
  };
}

// ─── identify ─────────────────────────────────────────────────────────────────

export async function identify(req: IdentifyRequest): Promise<IdentifyResponse> {
  const email = req.email ?? null;
  const phoneNumber = req.phoneNumber ? String(req.phoneNumber) : null;

  if (!email && !phoneNumber) {
    throw new Error("At least one of email or phoneNumber is required.");
  }

  const directMatches = await findMatchingContacts(email, phoneNumber);

  // No matches → new primary
  if (directMatches.length === 0) {
    const contact = await createContact(email, phoneNumber, null, "primary");
    return buildResponse([contact], contact.id);
  }

  let allContacts = await expandCluster(directMatches);
  const primaries = allContacts
    .filter((c) => c.linkprecedence === "primary")
    .sort((a, b) => new Date(a.createdat).getTime() - new Date(b.createdat).getTime());

  const primary = primaries[0];
  if (!primary) throw new Error("No primary contact found in cluster");

  // Multiple primaries → merge under the oldest one
  if (primaries.length > 1) {
    for (const p of primaries.slice(1)) {
      await pool.query(
        `UPDATE contact SET linkedid = $1, updatedat = NOW() WHERE linkedid = $2 AND deletedat IS NULL`,
        [primary.id, p.id]
      );
      await pool.query(
        `UPDATE contact SET linkprecedence = 'secondary', linkedid = $1, updatedat = NOW() WHERE id = $2`,
        [primary.id, p.id]
      );
    }
    allContacts = await expandCluster([primary]);
  }

  // Add secondary if the request carries new info
  const hasNewInfo =
    (email && !allContacts.some((c) => c.email === email)) ||
    (phoneNumber && !allContacts.some((c) => c.phonenumber === phoneNumber));

  if (hasNewInfo) {
    allContacts.push(await createContact(email, phoneNumber, primary.id, "secondary"));
  }

  return buildResponse(allContacts, primary.id);
}