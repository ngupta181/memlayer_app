import 'dotenv/config';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';

const MEMORY_API_URL = process.env.MEMORY_API_URL || 'http://localhost:3000';
const API_KEY = process.env.API_KEY; // must be provided via env

async function postJson(url, body) {
	const resp = await fetch(url, {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
			'Authorization': `Bearer ${API_KEY}`,
		},
		body: JSON.stringify(body),
	});
	return resp;
}

async function getJson(url, params = {}) {
	const qs = new URLSearchParams(params).toString();
	const resp = await fetch(`${url}?${qs}`, {
		headers: {
			'Authorization': `Bearer ${API_KEY}`,
		},
	});
	return resp;
}

async function putJson(url, body) {
	const resp = await fetch(url, {
		method: 'PUT',
		headers: {
			'Content-Type': 'application/json',
			'Authorization': `Bearer ${API_KEY}`,
		},
		body: JSON.stringify(body),
	});
	return resp;
}

async function deleteJson(url, params = {}) {
	const qs = new URLSearchParams(params).toString();
	const resp = await fetch(`${url}?${qs}`, {
		method: 'DELETE',
		headers: {
			'Authorization': `Bearer ${API_KEY}`,
		},
	});
	return resp;
}

const mcpServer = new McpServer({ name: 'memory-storage', version: '1.0.0' });

// Enhanced memory storage with new fields
mcpServer.registerTool('store_memory', {
	description: 'Store a new memory about the current project or task with enhanced metadata.',
	inputSchema: {
		content: z.string().describe('The memory content to store'),
		title: z.string().optional().describe('Optional title for the memory'),
		type: z.enum(['note', 'task', 'idea', 'code', 'link', 'snippet', 'document']).default('note').describe('Type of memory'),
		tags: z.array(z.string()).optional().describe('Tags for categorization'),
		category: z.string().optional().describe('Category for organization'),
		folder: z.string().optional().describe('Folder path for hierarchical organization'),
		importance: z.number().int().min(1).max(5).default(2).describe('Importance 1-5'),
	},
}, async ({ content, title, type = 'note', tags = [], category, folder, importance = 2 }) => {
	try {
		const payload = {
			content,
			title,
			type,
			tags,
			category,
			folder,
			importance,
			metadata: { source: 'cursor_mcp', timestamp: Date.now() / 1000 },
		};
		const resp = await postJson(`${MEMORY_API_URL}/memory`, payload);
		if (resp.ok) {
			const result = await resp.json();
			const memoryId = result.id || 'unknown';
			const memory = result.memory || {};
			return {
				content: [{ type: 'text', text: `✅ Memory stored successfully!

Memory ID: ${memoryId}
Title: ${memory.title || 'Auto-generated'}
Type: ${memory.type}
Tags: ${memory.tags?.join(', ') || 'Auto-suggested'}
Category: ${memory.category || 'Auto-categorized'}
Importance: ${importance}/5
` }],
			};
		}
		return { content: [{ type: 'text', text: `❌ Failed to store memory: ${resp.status} ${await resp.text()}` }] };
	} catch (e) {
		return { content: [{ type: 'text', text: `❌ Error storing memory: ${e.message}` }] };
	}
});

// Create relation between memories
mcpServer.registerTool('create_relation', {
	description: 'Create a relation between two memories (source -> target).',
	inputSchema: {
		source_id: z.string().describe('Source memory ID'),
		target_id: z.string().describe('Target memory ID'),
		type: z.string().default('relates_to').describe('Relation type'),
		weight: z.number().int().default(1).describe('Relation weight (1-5)'),
		metadata: z.record(z.any()).optional().describe('Additional metadata')
	},
}, async ({ source_id, target_id, type = 'relates_to', weight = 1, metadata = {} }) => {
	try {
		const resp = await postJson(`${MEMORY_API_URL}/relations`, { source_id, target_id, type, weight, metadata });
		if (!resp.ok) {
			return { content: [{ type: 'text', text: `❌ Failed to create relation: ${resp.status} ${await resp.text()}` }] };
		}
		const result = await resp.json();
		return { content: [{ type: 'text', text: `🔗 Relation created (ID: ${result.id}) ${source_id} -[${type}]-> ${target_id}` }] };
	} catch (e) {
		return { content: [{ type: 'text', text: `❌ Error creating relation: ${e.message}` }] };
	}
});

// List relations
mcpServer.registerTool('list_relations', {
	description: 'List relations for a user with optional filters.',
	inputSchema: {
		source_id: z.string().optional(),
		target_id: z.string().optional(),
		type: z.string().optional(),
	},
}, async ({ source_id, target_id, type }) => {
	try {
		const params = {};
		if (source_id) params.source_id = source_id;
		if (target_id) params.target_id = target_id;
		if (type) params.type = type;
		const resp = await getJson(`${MEMORY_API_URL}/relations`, params);
		if (!resp.ok) {
			return { content: [{ type: 'text', text: `❌ Failed to list relations: ${resp.status} ${await resp.text()}` }] };
		}
		const result = await resp.json();
		const lines = ['🔗 Relations:\n'];
		(result.relations || []).forEach((r, i) => lines.push(`${i + 1}. (${r.type}) ${r.source_id} -> ${r.target_id} [id=${r.id}]`));
		return { content: [{ type: 'text', text: lines.join('\n') }] };
	} catch (e) {
		return { content: [{ type: 'text', text: `❌ Error listing relations: ${e.message}` }] };
	}
});

// Delete a relation
mcpServer.registerTool('delete_relation', {
	description: 'Delete a relation by ID.',
	inputSchema: {
		relation_id: z.string().describe('Relation ID')
	},
}, async ({ relation_id }) => {
	try {
		const resp = await deleteJson(`${MEMORY_API_URL}/relations/${relation_id}`);
		if (!resp.ok) {
			return { content: [{ type: 'text', text: `❌ Failed to delete relation: ${resp.status} ${await resp.text()}` }] };
		}
		return { content: [{ type: 'text', text: `🗑️ Relation deleted (ID: ${relation_id})` }] };
	} catch (e) {
		return { content: [{ type: 'text', text: `❌ Error deleting relation: ${e.message}` }] };
	}
});

// Get graph data
mcpServer.registerTool('get_graph', {
	description: 'Get graph (nodes/edges) for the user to visualize relationships.',
	inputSchema: {
		limit: z.number().int().default(100)
	}
}, async ({ limit = 100 }) => {
	try {
		const resp = await getJson(`${MEMORY_API_URL}/relations/graph`, { limit });
		if (!resp.ok) {
			return { content: [{ type: 'text', text: `❌ Failed to get graph: ${resp.status} ${await resp.text()}` }] };
		}
		const graph = await resp.json();
		const summary = `📈 Graph: ${graph.nodes?.length || 0} nodes, ${graph.edges?.length || 0} edges`;
		return { content: [{ type: 'text', text: summary }] };
	} catch (e) {
		return { content: [{ type: 'text', text: `❌ Error getting graph: ${e.message}` }] };
	}
});

// Enhanced search with filters
mcpServer.registerTool('search_memories', {
	description: 'Search for relevant memories with advanced filtering options.',
	inputSchema: {
		query: z.string(),
		type: z.string().optional().describe('Filter by memory type'),
		tags: z.string().optional().describe('Comma-separated tags to filter by'),
		category: z.string().optional().describe('Filter by category'),
		folder: z.string().optional().describe('Filter by folder'),
		min_importance: z.number().optional().describe('Minimum importance level'),
		max_importance: z.number().optional().describe('Maximum importance level'),
		date_from: z.string().optional().describe('Start date (YYYY-MM-DD)'),
		date_to: z.string().optional().describe('End date (YYYY-MM-DD)'),
		sort_by: z.enum(['relevance', 'importance', 'date', 'access_count']).default('relevance').describe('Sort field'),
		sort_order: z.enum(['asc', 'desc']).default('desc').describe('Sort order'),
		limit: z.number().int().default(10),
	},
}, async ({ query, type, tags, category, folder, min_importance, max_importance, date_from, date_to, sort_by = 'relevance', sort_order = 'desc', limit = 10 }) => {
	try {
		const params = { query, limit };
		if (type) params.type = type;
		if (tags) params.tags = tags;
		if (category) params.category = category;
		if (folder) params.folder = folder;
		if (min_importance) params.min_importance = min_importance;
		if (max_importance) params.max_importance = max_importance;
		if (date_from) params.date_from = date_from;
		if (date_to) params.date_to = date_to;
		if (sort_by) params.sort_by = sort_by;
		if (sort_order) params.sort_order = sort_order;

		const resp = await getJson(`${MEMORY_API_URL}/memory/search`, params);
		if (!resp.ok) {
			return { content: [{ type: 'text', text: `❌ Failed to search memories: ${resp.status} ${await resp.text()}` }] };
		}
		const results = await resp.json();
		const memories = results.memories || [];
		const total = results.total ?? memories.length;
		
		if (memories.length === 0) {
			return { content: [{ type: 'text', text: `🔍 No memories found for query: '${query}'` }] };
		}
		
		const lines = [`🔍 Search results for '${query}' (showing ${memories.length} of ${total} results):\n`];
		memories.forEach((m, i) => {
			lines.push(`${i + 1}. ${m.title || 'Untitled'} (ID: ${m.id})`);
			lines.push(`   Type: ${m.type} | Category: ${m.category || 'None'} | Folder: ${m.folder || 'Root'}`);
			lines.push(`   Tags: ${m.tags?.join(', ') || 'None'}`);
			lines.push(`   Relevance: ${Number(m.relevance).toFixed(2)} | Importance: ${m.importance}/5 | Access Count: ${m.access_count}`);
			lines.push(`   Created: ${m.created_at} | Updated: ${m.updated_at}`);
			lines.push(`   Content: ${m.content.substring(0, 100)}${m.content.length > 100 ? '...' : ''}`);
			lines.push('');
		});
		
		return { content: [{ type: 'text', text: lines.join('\n') }] };
	} catch (e) {
		return { content: [{ type: 'text', text: `❌ Error searching memories: ${e.message}` }] };
	}
});

// Get memory by ID
mcpServer.registerTool('get_memory', {
	description: 'Retrieve a specific memory by its ID.',
	inputSchema: {
		memory_id: z.string().describe('The ID of the memory to retrieve')
	},
}, async ({ memory_id }) => {
	try {
		const resp = await getJson(`${MEMORY_API_URL}/memory/${memory_id}`);
		if (!resp.ok) {
			return { content: [{ type: 'text', text: `❌ Failed to get memory: ${resp.status} ${await resp.text()}` }] };
		}
		const memory = await resp.json();
		
		const text = `📄 Memory Details (ID: ${memory.id})

Title: ${memory.title || 'Untitled'}
Type: ${memory.type}
Category: ${memory.category || 'None'}
Folder: ${memory.folder || 'Root'}
Tags: ${memory.tags?.join(', ') || 'None'}
Importance: ${memory.importance}/5
Access Count: ${memory.access_count}

Created: ${memory.created_at}
Updated: ${memory.updated_at}
Last Accessed: ${memory.accessed_at}

Content:
${memory.content}`;
		
		return { content: [{ type: 'text', text }] };
	} catch (e) {
		return { content: [{ type: 'text', text: `❌ Error getting memory: ${e.message}` }] };
	}
});

// Update memory
mcpServer.registerTool('update_memory', {
	description: 'Update an existing memory with new content or metadata.',
	inputSchema: {
		memory_id: z.string().describe('The ID of the memory to update'),
		content: z.string().optional().describe('New content for the memory'),
		title: z.string().optional().describe('New title for the memory'),
		type: z.enum(['note', 'task', 'idea', 'code', 'link', 'snippet', 'document']).optional().describe('New type'),
		tags: z.array(z.string()).optional().describe('New tags'),
		category: z.string().optional().describe('New category'),
		folder: z.string().optional().describe('New folder'),
		importance: z.number().int().min(1).max(5).optional().describe('New importance level')
	},
}, async ({ memory_id, content, title, type, tags, category, folder, importance }) => {
	try {
		const payload = {};
		if (content !== undefined) payload.content = content;
		if (title !== undefined) payload.title = title;
		if (type !== undefined) payload.type = type;
		if (tags !== undefined) payload.tags = tags;
		if (category !== undefined) payload.category = category;
		if (folder !== undefined) payload.folder = folder;
		if (importance !== undefined) payload.importance = importance;

		const resp = await putJson(`${MEMORY_API_URL}/memory/${memory_id}`, payload);
		if (!resp.ok) {
			return { content: [{ type: 'text', text: `❌ Failed to update memory: ${resp.status} ${await resp.text()}` }] };
		}
		const result = await resp.json();
		
		return { content: [{ type: 'text', text: `✅ Memory updated successfully! (ID: ${result.id})` }] };
	} catch (e) {
		return { content: [{ type: 'text', text: `❌ Error updating memory: ${e.message}` }] };
	}
});

// Delete memory
mcpServer.registerTool('delete_memory', {
	description: 'Delete a memory by its ID.',
	inputSchema: {
		memory_id: z.string().describe('The ID of the memory to delete')
	},
}, async ({ memory_id }) => {
	try {
		const resp = await deleteJson(`${MEMORY_API_URL}/memory/${memory_id}`);
		if (!resp.ok) {
			return { content: [{ type: 'text', text: `❌ Failed to delete memory: ${resp.status} ${await resp.text()}` }] };
		}
		const result = await resp.json();
		
		return { content: [{ type: 'text', text: `✅ Memory deleted successfully! (ID: ${result.id})` }] };
	} catch (e) {
		return { content: [{ type: 'text', text: `❌ Error deleting memory: ${e.message}` }] };
	}
});

// Bulk remove memories by filters
mcpServer.registerTool('bulk_remove_memories', {
	description: 'Remove multiple memories based on filters (type, tags, category, etc.).',
	inputSchema: {
		type: z.string().optional().describe('Filter by memory type'),
		tags: z.string().optional().describe('Comma-separated tags to filter by'),
		category: z.string().optional().describe('Filter by category'),
		folder: z.string().optional().describe('Filter by folder'),
		min_importance: z.number().optional().describe('Minimum importance level'),
		max_importance: z.number().optional().describe('Maximum importance level'),
		date_from: z.string().optional().describe('Start date (YYYY-MM-DD)'),
		date_to: z.string().optional().describe('End date (YYYY-MM-DD)'),
		confirm: z.boolean().default(false).describe('Confirmation flag - must be true to proceed'),
	},
}, async ({ type, tags, category, folder, min_importance, max_importance, date_from, date_to, confirm = false }) => {
	try {
		if (!confirm) {
			return { content: [{ type: 'text', text: `⚠️ Bulk remove requires confirmation. Set confirm=true to proceed.\n\nThis operation will permanently delete multiple memories matching the specified filters. Use with caution.` }] };
		}

		const payload = { confirm: true };
		if (type) payload.type = type;
		if (tags) payload.tags = tags;
		if (category) payload.category = category;
		if (folder) payload.folder = folder;
		if (min_importance) payload.min_importance = min_importance;
		if (max_importance) payload.max_importance = max_importance;
		if (date_from) payload.date_from = date_from;
		if (date_to) payload.date_to = date_to;

		const resp = await deleteJson(`${MEMORY_API_URL}/memory/bulk`, payload);
		if (!resp.ok) {
			return { content: [{ type: 'text', text: `❌ Failed to bulk remove memories: ${resp.status} ${await resp.text()}` }] };
		}
		const result = await resp.json();
		
		return { content: [{ type: 'text', text: `✅ ${result.message}\n\nDeleted: ${result.deleted_count} memories\nFilters applied: ${JSON.stringify(result.filters, null, 2)}` }] };
	} catch (e) {
		return { content: [{ type: 'text', text: `❌ Error bulk removing memories: ${e.message}` }] };
	}
});

// Remove memories by IDs
mcpServer.registerTool('remove_memories_by_ids', {
	description: 'Remove specific memories by their IDs.',
	inputSchema: {
		memory_ids: z.array(z.string()).describe('Array of memory IDs to remove'),
		confirm: z.boolean().default(false).describe('Confirmation flag - must be true to proceed')
	},
}, async ({ memory_ids, confirm = false }) => {
	try {
		if (!confirm) {
			return { content: [{ type: 'text', text: `⚠️ Remove operation requires confirmation. Set confirm=true to proceed.\n\nThis operation will permanently delete the specified memories:\n${memory_ids.join(', ')}` }] };
		}

		const payload = { memory_ids, confirm: true };

		const resp = await deleteJson(`${MEMORY_API_URL}/memory/remove`, payload);
		if (!resp.ok) {
			return { content: [{ type: 'text', text: `❌ Failed to remove memories: ${resp.status} ${await resp.text()}` }] };
		}
		const result = await resp.json();
		
		let message = `✅ ${result.message}\n\n`;
		message += `Requested: ${result.requested_count} memories\n`;
		message += `Deleted: ${result.deleted_count} memories\n`;
		
		if (result.invalid_ids && result.invalid_ids.length > 0) {
			message += `Invalid IDs: ${result.invalid_ids.join(', ')}\n`;
		}
		
		return { content: [{ type: 'text', text: message }] };
	} catch (e) {
		return { content: [{ type: 'text', text: `❌ Error removing memories: ${e.message}` }] };
	}
});

// List memories with pagination and filters
mcpServer.registerTool('list_memories', {
	description: 'List memories with pagination and filtering options.',
	inputSchema: {
		type: z.string().optional().describe('Filter by memory type'),
		tags: z.string().optional().describe('Comma-separated tags to filter by'),
		category: z.string().optional().describe('Filter by category'),
		folder: z.string().optional().describe('Filter by folder'),
		min_importance: z.number().optional().describe('Minimum importance level'),
		max_importance: z.number().optional().describe('Maximum importance level'),
		date_from: z.string().optional().describe('Start date (YYYY-MM-DD)'),
		date_to: z.string().optional().describe('End date (YYYY-MM-DD)'),
		sort_by: z.enum(['created_at', 'updated_at', 'importance', 'access_count']).default('created_at').describe('Sort field'),
		sort_order: z.enum(['asc', 'desc']).default('desc').describe('Sort order'),
		page: z.number().int().default(1).describe('Page number'),
		limit: z.number().int().default(20).describe('Items per page')
	},
}, async ({ type, tags, category, folder, min_importance, max_importance, date_from, date_to, sort_by = 'created_at', sort_order = 'desc', page = 1, limit = 20 }) => {
	try {
		const params = { page, limit, sort_by, sort_order };
		if (type) params.type = type;
		if (tags) params.tags = tags;
		if (category) params.category = category;
		if (folder) params.folder = folder;
		if (min_importance) params.min_importance = min_importance;
		if (max_importance) params.max_importance = max_importance;
		if (date_from) params.date_from = date_from;
		if (date_to) params.date_to = date_to;

		const resp = await getJson(`${MEMORY_API_URL}/memory`, params);
		if (!resp.ok) {
			return { content: [{ type: 'text', text: `❌ Failed to list memories: ${resp.status} ${await resp.text()}` }] };
		}
		const results = await resp.json();
		const memories = results.memories || [];
		const pagination = results.pagination || {};
		
		if (memories.length === 0) {
			return { content: [{ type: 'text', text: `📋 No memories found with the specified filters.` }] };
		}
		
		const lines = [`📋 Memory List (Page ${pagination.page} of ${pagination.pages}, ${pagination.total} total):\n`];
		memories.forEach((m, i) => {
			lines.push(`${i + 1}. ${m.title || 'Untitled'} (ID: ${m.id})`);
			lines.push(`   Type: ${m.type} | Category: ${m.category || 'None'} | Folder: ${m.folder || 'Root'}`);
			lines.push(`   Tags: ${m.tags?.join(', ') || 'None'}`);
			lines.push(`   Importance: ${m.importance}/5 | Access Count: ${m.access_count}`);
			lines.push(`   Created: ${m.created_at} | Updated: ${m.updated_at}`);
			lines.push(`   Content: ${m.content.substring(0, 80)}${m.content.length > 80 ? '...' : ''}`);
			lines.push('');
		});
		
		lines.push(`Page ${pagination.page} of ${pagination.pages} (${pagination.total} total memories)`);
		
		return { content: [{ type: 'text', text: lines.join('\n') }] };
	} catch (e) {
		return { content: [{ type: 'text', text: `❌ Error listing memories: ${e.message}` }] };
	}
});

// Enhanced statistics
mcpServer.registerTool('get_memory_stats', {
	description: 'Get comprehensive statistics about stored memories for a user.',
	inputSchema: {},
}, async () => {
	try {
		const resp = await getJson(`${MEMORY_API_URL}/memory/stats`);
		if (!resp.ok) {
			return { content: [{ type: 'text', text: `❌ Failed to get memory stats: ${resp.status} ${await resp.text()}` }] };
		}
		const stats = await resp.json();
		const total = stats.total_memories ?? 0;
		const avg = stats.avg_importance ?? 0;
		const mostRecent = stats.most_recent_date ?? 'None';
		const oldest = stats.oldest_date ?? 'None';
		
		const msg = `📊 Memory Statistics:

Total Memories: ${total}
Average Importance: ${Number(avg).toFixed(1)}/5
Most Recent: ${mostRecent}
Oldest: ${oldest}

Type Distribution: ${stats.type_distribution ? Object.entries(stats.type_distribution).map(([k,v]) => `${k}: ${v}`).join(', ') : 'N/A'}
Category Distribution: ${stats.category_distribution ? Object.entries(stats.category_distribution).map(([k,v]) => `${k}: ${v}`).join(', ') : 'N/A'}
Top Tags: ${stats.top_tags ? stats.top_tags.join(', ') : 'N/A'}

Recent Activity: ${stats.recent_activity || 'N/A'}
Storage Usage: ${stats.storage_usage || 'N/A'}`;
		
		return { content: [{ type: 'text', text: msg }] };
	} catch (e) {
		return { content: [{ type: 'text', text: `❌ Error getting memory stats: ${e.message}` }] };
	}
});

// Search suggestions
mcpServer.registerTool('get_search_suggestions', {
	description: 'Get search suggestions based on existing memories.',
	inputSchema: {
		query: z.string().describe('Partial query to get suggestions for'),
		limit: z.number().int().default(5).describe('Number of suggestions to return')
	},
}, async ({ query, limit = 5 }) => {
	try {
		// This would typically call a dedicated suggestions endpoint
		// For now, we'll use the search endpoint with a small limit
		const resp = await getJson(`${MEMORY_API_URL}/memory/search`, { 
			query, 
			limit: Math.min(limit * 2, 10)
		});
		
		if (!resp.ok) {
			return { content: [{ type: 'text', text: `❌ Failed to get suggestions: ${resp.status} ${await resp.text()}` }] };
		}
		
		const results = await resp.json();
		const memories = results.memories || [];
		
		if (memories.length === 0) {
			return { content: [{ type: 'text', text: `💡 No suggestions found for: '${query}'` }] };
		}
		
		const suggestions = memories.slice(0, limit).map(m => m.title || m.content.substring(0, 50));
		const lines = [`💡 Search suggestions for '${query}':\n`];
		suggestions.forEach((suggestion, i) => {
			lines.push(`${i + 1}. ${suggestion}`);
		});
		
		return { content: [{ type: 'text', text: lines.join('\n') }] };
	} catch (e) {
		return { content: [{ type: 'text', text: `❌ Error getting suggestions: ${e.message}` }] };
	}
});

const transport = new StdioServerTransport();
await mcpServer.connect(transport);
console.log('memlayer server running (stdio)');


