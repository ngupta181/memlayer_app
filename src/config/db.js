import dotenv from 'dotenv';
import { MongoClient } from 'mongodb';

dotenv.config();

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017';
const DB_NAME = process.env.DB_NAME || 'memlayer';

const client = new MongoClient(MONGO_URI, { ignoreUndefined: true });
let dbInstance = null;

export async function getDb() {
	if (!dbInstance) {
		await client.connect();
		dbInstance = client.db(DB_NAME);
	}
	return dbInstance;
}

export async function getMemoriesCollection() {
	const db = await getDb();
	return db.collection('memories');
}


export async function getRelationsCollection() {
	const db = await getDb();
	return db.collection('relations');
}

export async function getUsersCollection() {
	const db = await getDb();
	return db.collection('users');
}



