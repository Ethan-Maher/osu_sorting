import express from 'express';
import type { Request, Response } from 'express';
import cors from 'cors';
import { PrismaClient } from '@prisma/client';

const app = express();
const prisma = new PrismaClient();
const PORT = process.env.PORT || 4000;

app.use(cors({
  origin: 'https://osu-sorting.vercel.app',
  credentials: true,
}));
app.use(express.json());

// Get all clothing items by categoryId, ordered
app.get('/api/items/:categoryId', async (req: Request, res: Response) => {
  const { categoryId } = req.params;
  try {
    const items = await prisma.clothingItem.findMany({
      where: { categoryId },
      orderBy: { order: 'asc' },
    });
    res.json(items);
  } catch (e) {
    res.status(500).json({ error: 'Failed to fetch items' });
  }
});

// Add a new clothing item
app.post('/api/items', async (req: Request, res: Response) => {
  const { categoryId, brand, size, price, sku } = req.body;
  // Validate all fields
  if (
    !categoryId || !brand || !size || price === undefined || !sku ||
    typeof brand !== 'string' || typeof size !== 'string' ||
    typeof sku !== 'string' ||
    typeof price !== 'number' || isNaN(price)
  ) {
    return res.status(400).json({ error: 'All fields are required and must be valid.' });
  }
  // Set color based on price (using color chart)
  const colorChart: { [key: number]: string } = {
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
  let itemColor = colorChart[price] || '';

  try {
    // Find current max order for this category
    const maxOrder = await prisma.clothingItem.aggregate({
      where: { categoryId },
      _max: { order: true },
    });
    const order = (maxOrder._max?.order || 0) + 1;
    const item = await prisma.clothingItem.create({
      data: { categoryId, brand, size, price, color: itemColor, sku, order },
    });
    res.json(item);
  } catch (e) {
    res.status(500).json({ error: 'Failed to create item.' });
  }
});

// Edit an item
app.put('/api/items/:id', async (req: Request, res: Response) => {
  const { id } = req.params;
  const { brand, size, price, sku } = req.body;
  if (
    !brand || !size || price === undefined || !sku ||
    typeof brand !== 'string' || typeof size !== 'string' ||
    typeof sku !== 'string' ||
    typeof price !== 'number' || isNaN(price)
  ) {
    return res.status(400).json({ error: 'All fields are required and must be valid.' });
  }
  // Set color based on price (using color chart)
  const colorChart: { [key: number]: string } = {
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
  let itemColor = colorChart[price] || '';

  try {
    const item = await prisma.clothingItem.update({
      where: { id },
      data: { brand, size, price, color: itemColor, sku },
    });
    res.json(item);
  } catch (e) {
    res.status(500).json({ error: 'Failed to update item.' });
  }
});

// Delete an item and re-order remaining
app.delete('/api/items/:id', async (req: Request, res: Response) => {
  const { id } = req.params;
  try {
    const deleted = await prisma.clothingItem.delete({ where: { id } });
    // Reorder remaining items of this category
    const items = await prisma.clothingItem.findMany({
      where: { categoryId: deleted.categoryId },
      orderBy: { order: 'asc' },
    });
    await Promise.all(items.map((item: { id: string }, idx: number) =>
      prisma.clothingItem.update({ where: { id: item.id }, data: { order: idx + 1 } })
    ));
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: 'Failed to delete item.' });
  }
});

// Reorder items (accepts array of ids in new order)
app.post('/api/items/:categoryId/reorder', async (req: Request, res: Response) => {
  const { categoryId } = req.params;
  const { ids } = req.body; // array of item ids in new order
  try {
    await Promise.all(ids.map((id: string, idx: number) =>
      prisma.clothingItem.update({ where: { id }, data: { order: idx + 1 } })
    ));
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: 'Failed to reorder items.' });
  }
});

// Category endpoints
app.get('/api/categories', async (req: Request, res: Response) => {
  try {
    const categories = await prisma.category.findMany({ orderBy: { name: 'asc' } });
    res.json(categories);
  } catch (e) {
    res.status(500).json({ error: 'Failed to fetch categories.' });
  }
});

app.post('/api/categories', async (req: Request, res: Response) => {
  const { name } = req.body;
  if (!name || typeof name !== 'string' || !name.trim()) {
    return res.status(400).json({ error: 'Name is required' });
  }
  try {
    const category = await prisma.category.create({ data: { name: name.trim() } });
    res.json(category);
  } catch (e) {
    res.status(400).json({ error: 'Category already exists or invalid' });
  }
});

// Delete a category and its associated items
app.delete('/api/categories/:id', async (req: Request, res: Response) => {
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
  } catch (e) {
    res.status(400).json({ error: 'Failed to delete category' });
  }
});

app.listen(PORT, () => {
  console.log(`Backend running on port ${PORT}`);
}); 