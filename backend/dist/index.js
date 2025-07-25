"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const client_1 = require("@prisma/client");
const app = (0, express_1.default)();
const prisma = new client_1.PrismaClient();
const PORT = process.env.PORT || 4000;
app.use((0, cors_1.default)({
    origin: 'https://osu-sorting.vercel.app',
    credentials: true,
}));
app.use(express_1.default.json());
// Get all clothing items by categoryId, ordered
app.get('/api/items/:categoryId', async (req, res) => {
    const { categoryId } = req.params;
    try {
        const items = await prisma.clothingItem.findMany({
            where: { categoryId },
            orderBy: { order: 'asc' },
        });
        res.json(items);
    }
    catch (e) {
        res.status(500).json({ error: 'Failed to fetch items' });
    }
});
// Get only unsold items by categoryId
app.get('/api/items/:categoryId/current', async (req, res) => {
    const { categoryId } = req.params;
    try {
        const items = await prisma.clothingItem.findMany({
            where: { categoryId, sold: false },
            orderBy: { order: 'asc' },
        });
        res.json(items);
    }
    catch (e) {
        res.status(500).json({ error: 'Failed to fetch current items' });
    }
});
// Get only sold items by categoryId
app.get('/api/items/:categoryId/sold', async (req, res) => {
    const { categoryId } = req.params;
    try {
        const items = await prisma.clothingItem.findMany({
            where: { categoryId, sold: true },
            orderBy: { order: 'asc' },
        });
        res.json(items);
    }
    catch (e) {
        res.status(500).json({ error: 'Failed to fetch sold items' });
    }
});
// Add a new clothing item
app.post('/api/items', async (req, res) => {
    var _a;
    const { categoryId, brand, size, price, sku, sold } = req.body;
    // Validate all fields
    if (!categoryId || !brand || !size || price === undefined || !sku ||
        typeof brand !== 'string' || typeof size !== 'string' ||
        typeof sku !== 'string' ||
        typeof price !== 'number' || isNaN(price)) {
        return res.status(400).json({ error: 'All fields are required and must be valid.' });
    }
    // Set color based on price (using color chart)
    const colorChart = {
        9: 'Red',
        4: 'Orange',
        10: 'Yellow',
        6: 'Green',
        7: 'Blue',
        5: 'Indigo',
        8: 'Violet',
        3: 'Pink',
        11: 'royal blue',
        12: 'light blue',
        2: 'lime',
        15: 'Peach',
        20: 'teal',
    };
    let itemColor = colorChart[Math.round(price)] || 'gray';
    try {
        // Find current max order for this category
        const maxOrder = await prisma.clothingItem.aggregate({
            where: { categoryId },
            _max: { order: true },
        });
        const order = (((_a = maxOrder._max) === null || _a === void 0 ? void 0 : _a.order) || 0) + 1;
        const item = await prisma.clothingItem.create({
            data: { categoryId, brand, size, price, color: itemColor, sku, order, sold: sold === true },
        });
        res.json(item);
    }
    catch (e) {
        res.status(500).json({ error: 'Failed to create item.' });
    }
});
// Edit an item
app.put('/api/items/:id', async (req, res) => {
    const { id } = req.params;
    const { brand, size, price, sku } = req.body;
    if (!brand || !size || price === undefined || !sku ||
        typeof brand !== 'string' || typeof size !== 'string' ||
        typeof sku !== 'string' ||
        typeof price !== 'number' || isNaN(price)) {
        return res.status(400).json({ error: 'All fields are required and must be valid.' });
    }
    // Set color based on price (using color chart)
    const colorChart = {
        9: 'Red',
        4: 'Orange',
        10: 'Yellow',
        6: 'Green',
        7: 'Blue',
        5: 'Indigo',
        8: 'Violet',
        3: 'Pink',
        11: 'royal blue',
        12: 'light blue',
        2: 'lime',
        15: 'Peach',
        20: 'teal',
    };
    let itemColor = colorChart[Math.round(price)] || 'gray';
    try {
        const item = await prisma.clothingItem.update({
            where: { id },
            data: { brand, size, price, color: itemColor, sku },
        });
        res.json(item);
    }
    catch (e) {
        res.status(500).json({ error: 'Failed to update item.' });
    }
});
// Update sold status of an item
app.put('/api/items/:id/sold', async (req, res) => {
    var _a;
    const { id } = req.params;
    const { sold } = req.body;
    if (typeof sold !== 'boolean') {
        return res.status(400).json({ error: 'Sold status must be a boolean.' });
    }
    try {
        const item = await prisma.clothingItem.update({
            where: { id },
            data: { sold },
        });
        res.json(item);
    }
    catch (e) {
        console.error('Error updating sold status:', e);
        // Check if it's a "not found" error
        if (e.code === 'P2025' || ((_a = e.message) === null || _a === void 0 ? void 0 : _a.includes('Record to update not found'))) {
            return res.status(404).json({ error: 'Item not found.' });
        }
        res.status(500).json({ error: 'Failed to update sold status.' });
    }
});
// Delete an item and re-order remaining
app.delete('/api/items/:id', async (req, res) => {
    const { id } = req.params;
    try {
        const deleted = await prisma.clothingItem.delete({ where: { id } });
        // Reorder remaining items of this category
        const items = await prisma.clothingItem.findMany({
            where: { categoryId: deleted.categoryId },
            orderBy: { order: 'asc' },
        });
        await Promise.all(items.map((item, idx) => prisma.clothingItem.update({ where: { id: item.id }, data: { order: idx + 1 } })));
        res.json({ success: true });
    }
    catch (e) {
        res.status(500).json({ error: 'Failed to delete item.' });
    }
});
// Reorder items (accepts array of ids in new order)
app.post('/api/items/:categoryId/reorder', async (req, res) => {
    const { categoryId } = req.params;
    const { ids } = req.body; // array of item ids in new order
    try {
        await Promise.all(ids.map((id, idx) => prisma.clothingItem.update({ where: { id }, data: { order: idx + 1 } })));
        res.json({ success: true });
    }
    catch (e) {
        res.status(500).json({ error: 'Failed to reorder items.' });
    }
});
// Category endpoints
app.get('/api/categories', async (req, res) => {
    try {
        const categories = await prisma.category.findMany({ orderBy: { name: 'asc' } });
        res.json(categories);
    }
    catch (e) {
        res.status(500).json({ error: 'Failed to fetch categories.' });
    }
});
app.post('/api/categories', async (req, res) => {
    const { name } = req.body;
    if (!name || typeof name !== 'string' || !name.trim()) {
        return res.status(400).json({ error: 'Name is required' });
    }
    try {
        const category = await prisma.category.create({ data: { name: name.trim() } });
        res.json(category);
    }
    catch (e) {
        res.status(400).json({ error: 'Category already exists or invalid' });
    }
});
// Delete a category and its associated items
app.delete('/api/categories/:id', async (req, res) => {
    const { id } = req.params;
    try {
        // First delete all items in this category
        await prisma.clothingItem.deleteMany({
            where: { categoryId: id }
        });
        // Then delete the category
        await prisma.category.delete({
            where: { id }
        });
        res.json({ success: true });
    }
    catch (e) {
        res.status(400).json({ error: 'Failed to delete category' });
    }
});
app.listen(PORT, () => {
    console.log(`Backend running on port ${PORT}`);
});
