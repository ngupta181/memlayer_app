import express from 'express';
import dotenv from 'dotenv';
dotenv.config();
import memoryRouter from './routes/memory.js';
import relationsRouter from './routes/relations.js';
import usersRouter from './routes/users.js';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(express.json());

// Serve static files
app.use(express.static(path.join(__dirname, 'public')));

app.get('/health', (req, res) => {
	res.json({ status: 'ok' });
});

// Serve the main page
app.get('/', (req, res) => {
	res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.use('/memory', memoryRouter);
app.use('/relations', relationsRouter);
app.use('/users', usersRouter);

export default app;


