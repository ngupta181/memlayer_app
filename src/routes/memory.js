import { Router } from 'express';
import { getMemoriesCollection } from '../config/db.js';
import { getEmbedding, cosineSimilarity } from '../services/embeddings.js';
import { requireBearerAuth } from '../middleware/auth.js';
import { ObjectId } from 'mongodb';

const router = Router();

// Enhanced memory creation with new fields
router.post('/', requireBearerAuth, async (req, res) => {
	const { 
		content, 
		title = null, 
		type = 'note', 
		tags = [], 
		category = null,
		folder = null,
		importance = 1, 
		metadata = null 
	} = req.body || {};
	
	if (!content) {
		return res.status(400).json({ detail: 'content required' });
	}
	
	// Validate type
	const validTypes = ['note', 'task', 'idea', 'code', 'link', 'snippet', 'document'];
	if (!validTypes.includes(type)) {
		return res.status(400).json({ detail: 'Invalid memory type' });
	}
	
	try {
		const col = await getMemoriesCollection();
		const embedding = await getEmbedding(content);
		
		// Auto-generate title if not provided
		const autoTitle = title || content.substring(0, 50) + (content.length > 50 ? '...' : '');
		
		// Auto-suggest tags if none provided
		const autoTags = tags.length === 0 ? await suggestTags(content) : tags;
		
		// Auto-categorize if not provided
		const autoCategory = category || await categorizeContent(content, type);
		
		const doc = { 
			user_id: req.authUser.user_id, 
			content, 
			title: autoTitle,
			type,
			tags: autoTags,
			category: autoCategory,
			folder,
			importance, 
			metadata: {
				...(metadata || {}),
				source: 'api',
				created_via: 'manual',
				word_count: content.split(' ').length,
				character_count: content.length
			}, 
			embedding, 
			created_at: new Date(),
			updated_at: new Date(),
			accessed_at: new Date(),
			access_count: 0
		};
		
		const result = await col.insertOne(doc);
		return res.json({ 
			status: 'ok', 
			id: String(result.insertedId), 
			message: 'Memory stored successfully',
			memory: {
				id: String(result.insertedId),
				title: autoTitle,
				type,
				tags: autoTags,
				category: autoCategory
			}
		});
	} catch (err) {
		console.error(err);
		return res.status(500).json({ detail: 'Internal error' });
	}
});

// Enhanced search with filters and hybrid search
router.get('/search', requireBearerAuth, async (req, res) => {
	const { 
		query,
		type,
		tags,
		category,
		folder,
		min_importance,
		max_importance,
		date_from,
		date_to,
		sort_by = 'relevance',
		sort_order = 'desc'
	} = req.query;
	
	const limit = parseInt(req.query.limit ?? '10', 10);
	
	if (!query) {
		return res.status(400).json({ detail: 'query required' });
	}
	
	try {
		const col = await getMemoriesCollection();
		
		// Build filter query
		const filterQuery = { user_id: req.authUser.user_id };
		
		if (type) filterQuery.type = type;
		if (category) filterQuery.category = category;
		if (folder) filterQuery.folder = folder;
		if (min_importance) filterQuery.importance = { $gte: parseInt(min_importance) };
		if (max_importance) {
			filterQuery.importance = filterQuery.importance || {};
			filterQuery.importance.$lte = parseInt(max_importance);
		}
		if (date_from || date_to) {
			filterQuery.created_at = {};
			if (date_from) filterQuery.created_at.$gte = new Date(date_from);
			if (date_to) filterQuery.created_at.$lte = new Date(date_to);
		}
		if (tags) {
			const tagArray = tags.split(',').map(t => t.trim());
			filterQuery.tags = { $in: tagArray };
		}
		
		const cursor = col.find(filterQuery);
		const queryVec = await getEmbedding(String(query));
		const results = [];
		
		await cursor.forEach((doc) => {
			// Semantic similarity score
			const semanticScore = cosineSimilarity(queryVec, doc.embedding);
			
			// Keyword matching score
			const keywordScore = calculateKeywordScore(query, doc.content, doc.title, doc.tags);
			
			// Hybrid score (weighted combination)
			const hybridScore = (semanticScore * 0.7) + (keywordScore * 0.3);
			
			results.push({
				id: String(doc._id),
				title: doc.title,
				content: doc.content,
				type: doc.type,
				tags: doc.tags || [],
				category: doc.category,
				folder: doc.folder,
				relevance: hybridScore,
				semantic_score: semanticScore,
				keyword_score: keywordScore,
				importance: doc.importance ?? 1,
				created_at: doc.created_at?.toISOString() || new Date().toISOString(),
				updated_at: doc.updated_at?.toISOString() || new Date().toISOString(),
				access_count: doc.access_count || 0
			});
		});
		
		// Sort results
		if (sort_by === 'relevance') {
			results.sort((a, b) => b.relevance - a.relevance);
		} else if (sort_by === 'importance') {
			results.sort((a, b) => b.importance - a.importance);
		} else if (sort_by === 'date') {
			results.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
		} else if (sort_by === 'access_count') {
			results.sort((a, b) => b.access_count - a.access_count);
		}
		
		if (sort_order === 'asc') {
			results.reverse();
		}
		
		const memories = results.slice(0, limit);
		
		// Update access count for returned memories
		const memoryIds = memories.map(m => m.id);
		const validObjectIds = memoryIds.filter(id => ObjectId.isValid(id));
		
		if (validObjectIds.length > 0) {
			await col.updateMany(
				{ _id: { $in: validObjectIds.map(id => new ObjectId(id)) } },
				{ $inc: { access_count: 1 }, $set: { accessed_at: new Date() } }
			);
		}
		
		return res.json({ 
			memories, 
			total: results.length, 
			query, 
			limit,
			filters: {
				type, tags, category, folder, min_importance, max_importance, date_from, date_to
			},
			sort: { by: sort_by, order: sort_order }
		});
	} catch (err) {
		console.error(err);
		return res.status(500).json({ detail: 'Internal error' });
	}
});

// Enhanced statistics endpoint
router.get('/stats', requireBearerAuth, async (req, res) => {
	try {
		const col = await getMemoriesCollection();
		const memories = await col.find({ user_id: req.authUser.user_id }).toArray();
		
		if (memories.length === 0) {
			return res.json({ 
				total_memories: 0, 
				avg_importance: 0.0, 
				most_recent_date: null, 
				oldest_date: null,
				type_distribution: {},
				category_distribution: {},
				top_tags: [],
				recent_activity: null,
				storage_usage: '0 KB'
			});
		}
		
		const total = memories.length;
		const avg = memories.reduce((acc, m) => acc + (m.importance ?? 1), 0) / total;
		const dates = memories.map((m) => m.created_at ?? new Date());
		const mostRecent = new Date(Math.max(...dates.map((d) => new Date(d).getTime()))).toISOString();
		const oldest = new Date(Math.min(...dates.map((d) => new Date(d).getTime()))).toISOString();
		
		// Type distribution
		const typeDistribution = {};
		memories.forEach(m => {
			const type = m.type || 'note';
			typeDistribution[type] = (typeDistribution[type] || 0) + 1;
		});
		
		// Category distribution
		const categoryDistribution = {};
		memories.forEach(m => {
			const category = m.category || 'general';
			categoryDistribution[category] = (categoryDistribution[category] || 0) + 1;
		});
		
		// Top tags
		const tagCounts = {};
		memories.forEach(m => {
			(m.tags || []).forEach(tag => {
				tagCounts[tag] = (tagCounts[tag] || 0) + 1;
			});
		});
		const topTags = Object.entries(tagCounts)
			.sort(([,a], [,b]) => b - a)
			.slice(0, 10)
			.map(([tag]) => tag);
		
		// Recent activity (memories accessed in last 7 days)
		const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
		const recentActivity = memories.filter(m => 
			m.accessed_at && new Date(m.accessed_at) > sevenDaysAgo
		).length;
		
		// Storage usage estimation
		const totalChars = memories.reduce((acc, m) => acc + (m.content?.length || 0), 0);
		const storageUsage = `${Math.round(totalChars / 1024)} KB`;
		
		return res.json({ 
			total_memories: total, 
			avg_importance: Number(avg.toFixed(1)), 
			most_recent_date: mostRecent, 
			oldest_date: oldest,
			type_distribution: typeDistribution,
			category_distribution: categoryDistribution,
			top_tags: topTags,
			recent_activity: recentActivity,
			storage_usage: storageUsage
		});
	} catch (err) {
		console.error(err);
		return res.status(500).json({ detail: 'Internal error' });
	}
});

// Get memory by ID
router.get('/:id', requireBearerAuth, async (req, res) => {
	const { id } = req.params;
	
	// Validate ObjectId format
	if (!ObjectId.isValid(id)) {
		return res.status(400).json({ detail: 'Invalid memory ID format' });
	}
	
	try {
		const col = await getMemoriesCollection();
		const memory = await col.findOne({ _id: new ObjectId(id), user_id: req.authUser.user_id });
		
		if (!memory) {
			return res.status(404).json({ detail: 'Memory not found' });
		}
		
		// Update access count
		await col.updateOne(
			{ _id: new ObjectId(id) },
			{ $inc: { access_count: 1 }, $set: { accessed_at: new Date() } }
		);
		
		return res.json({
			id: String(memory._id),
			title: memory.title,
			content: memory.content,
			type: memory.type,
			tags: memory.tags || [],
			category: memory.category,
			folder: memory.folder,
			importance: memory.importance,
			metadata: memory.metadata,
			created_at: memory.created_at?.toISOString() || new Date().toISOString(),
			updated_at: memory.updated_at?.toISOString() || new Date().toISOString(),
			accessed_at: memory.accessed_at?.toISOString() || new Date().toISOString(),
			access_count: memory.access_count || 0
		});
	} catch (err) {
		console.error(err);
		return res.status(500).json({ detail: 'Internal error' });
	}
});

// Update memory
router.put('/:id', requireBearerAuth, async (req, res) => {
	const { id } = req.params;
	const { 
		content,
		title,
		type,
		tags,
		category,
		folder,
		importance,
		metadata
	} = req.body;
	
	// Validate ObjectId format
	if (!ObjectId.isValid(id)) {
		return res.status(400).json({ detail: 'Invalid memory ID format' });
	}
	
	try {
		const col = await getMemoriesCollection();
		
		// Check if memory exists and belongs to user
		const existingMemory = await col.findOne({ _id: new ObjectId(id), user_id: req.authUser.user_id });
		if (!existingMemory) {
			return res.status(404).json({ detail: 'Memory not found' });
		}
		
		// Prepare update object
		const updateObj = { updated_at: new Date() };
		
		if (content !== undefined) {
			updateObj.content = content;
			updateObj.embedding = await getEmbedding(content);
			updateObj.metadata = {
				...(existingMemory.metadata || {}),
				...(metadata || {}),
				word_count: content.split(' ').length,
				character_count: content.length,
				last_updated_via: 'api'
			};
		}
		
		if (title !== undefined) updateObj.title = title;
		if (type !== undefined) updateObj.type = type;
		if (tags !== undefined) updateObj.tags = tags;
		if (category !== undefined) updateObj.category = category;
		if (folder !== undefined) updateObj.folder = folder;
		if (importance !== undefined) updateObj.importance = importance;
		if (metadata !== undefined && content === undefined) {
			updateObj.metadata = { ...(existingMemory.metadata || {}), ...metadata };
		}
		
		const result = await col.updateOne(
			{ _id: new ObjectId(id) },
			{ $set: updateObj }
		);
		
		if (result.modifiedCount === 0) {
			return res.status(400).json({ detail: 'No changes made' });
		}
		
		return res.json({ 
			status: 'ok', 
			message: 'Memory updated successfully',
			id: String(id)
		});
	} catch (err) {
		console.error(err);
		return res.status(500).json({ detail: 'Internal error' });
	}
});

// Delete memory
router.delete('/:id', requireBearerAuth, async (req, res) => {
	const { id } = req.params;
	
	// Validate ObjectId format
	if (!ObjectId.isValid(id)) {
		return res.status(400).json({ detail: 'Invalid memory ID format' });
	}
	
	try {
		const col = await getMemoriesCollection();
		const result = await col.deleteOne({ _id: new ObjectId(id), user_id: req.authUser.user_id });
		
		if (result.deletedCount === 0) {
			return res.status(404).json({ detail: 'Memory not found' });
		}
		
		return res.json({ 
			status: 'ok', 
			message: 'Memory deleted successfully',
			id: String(id)
		});
	} catch (err) {
		console.error(err);
		return res.status(500).json({ detail: 'Internal error' });
	}
});

// List memories with pagination and filters
router.get('/', requireBearerAuth, async (req, res) => {
	const { 
		type,
		tags,
		category,
		folder,
		min_importance,
		max_importance,
		date_from,
		date_to,
		sort_by = 'created_at',
		sort_order = 'desc',
		page = 1,
		limit = 20
	} = req.query;
	
	try {
		const col = await getMemoriesCollection();
		
		// Build filter query
		const filterQuery = { user_id: req.authUser.user_id };
		
		if (type) filterQuery.type = type;
		if (category) filterQuery.category = category;
		if (folder) filterQuery.folder = folder;
		if (min_importance) filterQuery.importance = { $gte: parseInt(min_importance) };
		if (max_importance) {
			filterQuery.importance = filterQuery.importance || {};
			filterQuery.importance.$lte = parseInt(max_importance);
		}
		if (date_from || date_to) {
			filterQuery.created_at = {};
			if (date_from) filterQuery.created_at.$gte = new Date(date_from);
			if (date_to) filterQuery.created_at.$lte = new Date(date_to);
		}
		if (tags) {
			const tagArray = tags.split(',').map(t => t.trim());
			filterQuery.tags = { $in: tagArray };
		}
		
		// Build sort object
		const sortObj = {};
		sortObj[sort_by] = sort_order === 'desc' ? -1 : 1;
		
		// Calculate pagination
		const skip = (parseInt(page) - 1) * parseInt(limit);
		
		const memories = await col.find(filterQuery)
			.sort(sortObj)
			.skip(skip)
			.limit(parseInt(limit))
			.toArray();
		
		const total = await col.countDocuments(filterQuery);
		
		const formattedMemories = memories.map(memory => ({
			id: String(memory._id),
			title: memory.title,
			content: memory.content,
			type: memory.type,
			tags: memory.tags || [],
			category: memory.category,
			folder: memory.folder,
			importance: memory.importance,
			created_at: memory.created_at?.toISOString() || new Date().toISOString(),
			updated_at: memory.updated_at?.toISOString() || new Date().toISOString(),
			access_count: memory.access_count || 0
		}));
		
		return res.json({
			memories: formattedMemories,
			pagination: {
				page: parseInt(page),
				limit: parseInt(limit),
				total,
				pages: Math.ceil(total / parseInt(limit))
			},
			filters: {
				type, tags, category, folder, min_importance, max_importance, date_from, date_to
			},
			sort: { by: sort_by, order: sort_order }
		});
	} catch (err) {
		console.error(err);
		return res.status(500).json({ detail: 'Internal error' });
	}
});

// Bulk remove memories
router.delete('/bulk', requireBearerAuth, async (req, res) => {
	const { 
		type,
		tags,
		category,
		folder,
		min_importance,
		max_importance,
		date_from,
		date_to,
		confirm = false
	} = req.body;
	
	if (!confirm) {
		return res.status(400).json({ 
			detail: 'Bulk delete requires confirmation. Set confirm=true to proceed.',
			warning: 'This operation will permanently delete multiple memories. Use with caution.'
		});
	}
	
	try {
		const col = await getMemoriesCollection();
		
		// Build filter query
		const filterQuery = { user_id: req.authUser.user_id };
		
		if (type) filterQuery.type = type;
		if (category) filterQuery.category = category;
		if (folder) filterQuery.folder = folder;
		if (min_importance) filterQuery.importance = { $gte: parseInt(min_importance) };
		if (max_importance) {
			filterQuery.importance = filterQuery.importance || {};
			filterQuery.importance.$lte = parseInt(max_importance);
		}
		if (date_from || date_to) {
			filterQuery.created_at = {};
			if (date_from) filterQuery.created_at.$gte = new Date(date_from);
			if (date_to) filterQuery.created_at.$lte = new Date(date_to);
		}
		if (tags) {
			const tagArray = tags.split(',').map(t => t.trim());
			filterQuery.tags = { $in: tagArray };
		}
		
		// First, get the count of memories that would be deleted
		const countToDelete = await col.countDocuments(filterQuery);
		
		if (countToDelete === 0) {
			return res.json({
				status: 'ok',
				message: 'No memories found matching the criteria',
				deleted_count: 0,
				filters: filterQuery
			});
		}
		
		// Perform the bulk delete
		const result = await col.deleteMany(filterQuery);
		
		return res.json({
			status: 'ok',
			message: `Successfully deleted ${result.deletedCount} memories`,
			deleted_count: result.deletedCount,
			filters: filterQuery
		});
	} catch (err) {
		console.error(err);
		return res.status(500).json({ detail: 'Internal error' });
	}
});

// Remove memories by IDs

router.delete('/remove', requireBearerAuth, async (req, res) => {
	const { memory_ids, confirm = false } = req.body;
	
	if (!memory_ids || !Array.isArray(memory_ids) || memory_ids.length === 0) {
		return res.status(400).json({ detail: 'memory_ids array is required' });
	}
	
	if (!confirm) {
		return res.status(400).json({ 
			detail: 'Remove operation requires confirmation. Set confirm=true to proceed.',
			warning: 'This operation will permanently delete the specified memories.'
		});
	}
	
	try {
		const col = await getMemoriesCollection();
		
		// Validate ObjectIds
		const validIds = memory_ids.filter(id => ObjectId.isValid(id));
		const invalidIds = memory_ids.filter(id => !ObjectId.isValid(id));
		
		if (validIds.length === 0) {
			return res.status(400).json({ 
				detail: 'No valid memory IDs provided',
				invalid_ids: invalidIds
			});
		}
		
		// Convert to ObjectIds
		const objectIds = validIds.map(id => new ObjectId(id));
		
		// Delete memories that belong to the user
		const result = await col.deleteMany({
			_id: { $in: objectIds },
			user_id: req.authUser.user_id
		});
		
		return res.json({
			status: 'ok',
			message: `Successfully deleted ${result.deletedCount} memories`,
			deleted_count: result.deletedCount,
			requested_count: memory_ids.length,
			valid_ids: validIds,
			invalid_ids: invalidIds
		});
	} catch (err) {
		console.error(err);
		return res.status(500).json({ detail: 'Internal error' });
	}
});

// Helper functions
async function suggestTags(content) {
	// Simple tag suggestion based on content analysis
	const words = content.toLowerCase()
		.replace(/[^\w\s]/g, '')
		.split(/\s+/)
		.filter(word => word.length > 3);
	
	const wordFreq = {};
	words.forEach(word => {
		wordFreq[word] = (wordFreq[word] || 0) + 1;
	});
	
	const suggestedTags = Object.entries(wordFreq)
		.sort(([,a], [,b]) => b - a)
		.slice(0, 5)
		.map(([word]) => word);
	
	return suggestedTags;
}

async function categorizeContent(content, type) {
	// Simple categorization based on content and type
	const text = content.toLowerCase();
	
	if (type === 'code' || text.includes('function') || text.includes('class')) {
		return 'development';
	} else if (type === 'task' || text.includes('todo') || text.includes('task')) {
		return 'tasks';
	} else if (text.includes('idea') || text.includes('concept')) {
		return 'ideas';
	} else if (text.includes('note') || text.includes('remember')) {
		return 'notes';
	} else {
		return 'general';
	}
}

function calculateKeywordScore(query, content, title, tags) {
	const queryWords = query.toLowerCase().split(/\s+/);
	const contentWords = content.toLowerCase().split(/\s+/);
	const titleWords = (title || '').toLowerCase().split(/\s+/);
	const tagWords = (tags || []).join(' ').toLowerCase().split(/\s+/);
	
	let score = 0;
	
	queryWords.forEach(queryWord => {
		// Content matches (weight: 1)
		const contentMatches = contentWords.filter(word => word.includes(queryWord)).length;
		score += contentMatches;
		
		// Title matches (weight: 3)
		const titleMatches = titleWords.filter(word => word.includes(queryWord)).length;
		score += titleMatches * 3;
		
		// Tag matches (weight: 2)
		const tagMatches = tagWords.filter(word => word.includes(queryWord)).length;
		score += tagMatches * 2;
	});
	
	return Math.min(score / queryWords.length, 1); // Normalize to 0-1
}

export default router;


