import { Router } from 'express';
import { ObjectId } from 'mongodb';
import { getMemoriesCollection, getRelationsCollection } from '../config/db.js';
import { requireBearerAuth } from '../middleware/auth.js';

const router = Router();

// Relation schema:
// { _id, user_id, source_id, target_id, type, weight, created_at, metadata }

router.post('/', requireBearerAuth, async (req, res) => {
	const { source_id, target_id, type = 'relates_to', weight = 1, metadata = {} } = req.body || {};
	if (!source_id || !target_id) {
		return res.status(400).json({ detail: 'source_id and target_id required' });
	}
	if (!ObjectId.isValid(source_id) || !ObjectId.isValid(target_id)) {
		return res.status(400).json({ detail: 'Invalid source_id or target_id' });
	}
	try {
		const memories = await getMemoriesCollection();
		const user_id = req.authUser.user_id;
		const [src, tgt] = await Promise.all([
			memories.findOne({ _id: new ObjectId(source_id), user_id }),
			memories.findOne({ _id: new ObjectId(target_id), user_id })
		]);
		if (!src || !tgt) {
			return res.status(404).json({ detail: 'Source or target memory not found for user' });
		}
		const relations = await getRelationsCollection();
		const now = new Date();
		const doc = { user_id, source_id, target_id, type, weight, metadata, created_at: now, updated_at: now };
		const result = await relations.insertOne(doc);
		return res.json({ status: 'ok', id: String(result.insertedId), relation: { id: String(result.insertedId), ...doc } });
	} catch (err) {
		console.error(err);
		return res.status(500).json({ detail: 'Internal error' });
	}
});

router.get('/', requireBearerAuth, async (req, res) => {
	const { source_id, target_id, type } = req.query;
	try {
		const relations = await getRelationsCollection();
		const filter = { user_id: req.authUser.user_id };
		if (source_id) filter.source_id = source_id;
		if (target_id) filter.target_id = target_id;
		if (type) filter.type = type;
		const items = await relations.find(filter).toArray();
		return res.json({ relations: items.map(r => ({ id: String(r._id), ...r })) });
	} catch (err) {
		console.error(err);
		return res.status(500).json({ detail: 'Internal error' });
	}
});

router.delete('/:id', requireBearerAuth, async (req, res) => {
	const { id } = req.params;
	if (!ObjectId.isValid(id)) {
		return res.status(400).json({ detail: 'Invalid relation id' });
	}
	try {
		const relations = await getRelationsCollection();
		const result = await relations.deleteOne({ _id: new ObjectId(id), user_id: req.authUser.user_id });
		if (result.deletedCount === 0) {
			return res.status(404).json({ detail: 'Relation not found' });
		}
		return res.json({ status: 'ok', id });
	} catch (err) {
		console.error(err);
		return res.status(500).json({ detail: 'Internal error' });
	}
});

// Graph data for visualization
router.get('/graph', requireBearerAuth, async (req, res) => {
	const { limit = '100' } = req.query;
	try {
		const [memoriesCol, relationsCol] = await Promise.all([
			getMemoriesCollection(),
			getRelationsCollection()
		]);
		const nodes = await memoriesCol
			.find({ user_id: req.authUser.user_id })
			.project({ _id: 1, title: 1, type: 1, category: 1, importance: 1 })
			.limit(parseInt(limit))
			.toArray();
		const nodeIds = new Set(nodes.map(n => String(n._id)));
		const edges = await relationsCol
			.find({ user_id: req.authUser.user_id, source_id: { $in: Array.from(nodeIds) }, target_id: { $in: Array.from(nodeIds) } })
			.toArray();

		return res.json({
			nodes: nodes.map(n => ({
				id: String(n._id),
				label: n.title || 'Untitled',
				data: { type: n.type, category: n.category, importance: n.importance }
			})),
			edges: edges.map(e => ({ id: String(e._id), source: e.source_id, target: e.target_id, type: e.type, weight: e.weight || 1 }))
		});
	} catch (err) {
		console.error(err);
		return res.status(500).json({ detail: 'Internal error' });
	}
});

export default router;


