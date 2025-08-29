import dotenv from 'dotenv';
dotenv.config();

const PROVIDER = process.env.EMBEDDINGS_PROVIDER || 'LOCAL';

let extractorPromise = null;
async function getLocalExtractor() {
	if (!extractorPromise) {
		const { pipeline } = await import('@xenova/transformers');
		extractorPromise = pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2');
	}
	return extractorPromise;
}

export async function getEmbedding(text) {
	if (PROVIDER === 'LOCAL') {
		const extractor = await getLocalExtractor();
		const output = await extractor(text, { pooling: 'mean', normalize: true });
		return Array.from(output.data);
	} else if (PROVIDER === 'OPENAI') {
		const { default: OpenAI } = await import('openai');
		const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
		const resp = await client.embeddings.create({
			model: 'text-embedding-3-small',
			input: text
		});
		return resp.data[0].embedding;
	} else {
		throw new Error('Unknown embeddings provider');
	}
}

export function cosineSimilarity(a, b) {
	const len = Math.min(a.length, b.length);
	let dot = 0;
	let normA = 0;
	let normB = 0;
	for (let i = 0; i < len; i++) {
		const va = a[i];
		const vb = b[i];
		dot += va * vb;
		normA += va * va;
		normB += vb * vb;
	}
	const denom = Math.sqrt(normA) * Math.sqrt(normB) || 1;
	return dot / denom;
}


