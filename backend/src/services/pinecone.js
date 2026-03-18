import { Pinecone } from "@pinecone-database/pinecone";

const INDEX_NAME    = process.env.PINECONE_INDEX ?? "devfix-errors";
const DIMENSION     = 768;       // matches text-embedding-004
const SIMILARITY_THRESHOLD = 0.75; // minimum score to include as context

let pineconeIndex = null; // cached after first init

/**
 * Initialises the Pinecone client and creates the index if it doesn't exist.
 * Safe to call multiple times — after the first call it's a no-op.
 * If PINECONE_API_KEY is not set, logs a warning and returns false.
 */
export async function initPinecone() {
  if (!process.env.PINECONE_API_KEY) {
    console.warn("PINECONE_API_KEY not set — similarity search disabled.");
    return false;
  }

  const pc = new Pinecone({ apiKey: process.env.PINECONE_API_KEY });

  // Create index if it doesn't already exist
  const { indexes = [] } = await pc.listIndexes();
  const exists = indexes.some((i) => i.name === INDEX_NAME);

  if (!exists) {
    console.log(`Creating Pinecone index "${INDEX_NAME}"…`);
    await pc.createIndex({
      name: INDEX_NAME,
      dimension: DIMENSION,
      metric: "cosine",
      spec: {
        serverless: { cloud: "aws", region: "us-east-1" },
      },
    });
    // Wait for index to be ready (can take ~30 s on a cold start)
    await waitUntilReady(pc);
  }

  pineconeIndex = pc.index(INDEX_NAME);
  console.log(`Pinecone ready — index: "${INDEX_NAME}"`);
  return true;
}

async function waitUntilReady(pc, maxWaitMs = 60_000) {
  const start = Date.now();
  while (Date.now() - start < maxWaitMs) {
    const desc = await pc.describeIndex(INDEX_NAME);
    if (desc.status?.ready) return;
    await new Promise((r) => setTimeout(r, 3000));
  }
  throw new Error(`Pinecone index "${INDEX_NAME}" did not become ready in time.`);
}

function getIndex() {
  if (!pineconeIndex) throw new Error("Pinecone not initialised.");
  return pineconeIndex;
}

/**
 * Stores one analysis vector in Pinecone.
 * @param {object} opts
 * @param {string}   opts.id           MongoDB _id (used as vector ID)
 * @param {number[]} opts.embedding    768-dim float array
 * @param {string}   opts.errorMessage
 * @param {string}   opts.rootCause
 * @param {string[]} opts.fix
 */
export async function upsertVector({ id, embedding, errorMessage, rootCause, fix }) {
  if (!pineconeIndex) return; // graceful no-op if Pinecone not configured

  await getIndex().upsert([{
    id: id.toString(),
    values: embedding,
    metadata: {
      errorMessage: errorMessage.slice(0, 1000),
      rootCause:    rootCause.slice(0, 500),
      // Arrays aren't supported in Pinecone metadata — store as JSON string
      fix:          JSON.stringify(fix).slice(0, 1000),
    },
  }]);
}

/**
 * Finds the top-K most similar past errors.
 * Returns [] if Pinecone is not configured or no results exceed the threshold.
 *
 * @param {number[]} embedding   Query vector
 * @param {number}   topK        Max candidates to fetch (default 3)
 * @returns {Promise<Array<{ score: number, errorMessage: string, rootCause: string, fix: string[] }>>}
 */
export async function querySimilar(embedding, topK = 3) {
  if (!pineconeIndex) return [];

  const response = await getIndex().query({
    vector: embedding,
    topK,
    includeMetadata: true,
  });

  return (response.matches ?? [])
    .filter((m) => m.score >= SIMILARITY_THRESHOLD)
    .map((m) => ({
      score:        m.score,
      errorMessage: m.metadata.errorMessage ?? "",
      rootCause:    m.metadata.rootCause ?? "",
      fix:          JSON.parse(m.metadata.fix ?? "[]"),
    }));
}
