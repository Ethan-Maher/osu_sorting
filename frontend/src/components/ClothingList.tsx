import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import osuLogo from '../assets/osu.png';
import { FaArrowLeft, FaEdit, FaTrash, FaArrowUp, FaArrowDown, FaPlus, FaFileExport, FaSearch, FaTimes } from 'react-icons/fa';
import './ClothingList.css';

const API_URL = 'http://localhost:4000/api/items';
const CATEGORY_API_URL = 'http://localhost:4000/api/categories';

// Helper: price to color mapping
const priceToColor = (price: number) => {
  if (price < 5) return 'gray';
  if (price < 10) return 'green';
  if (price < 20) return 'blue';
  if (price < 50) return 'orange';
  return 'red';
};

interface ClothingItem {
  id: string;
  order: number;
  brand: string;
  size: string;
  price: number;
  color: string;
  sku: string;
  categoryId: string;
}

const ClothingList: React.FC = () => {
  const { type: categoryId } = useParams<{ type?: string }>();
  const [categoryName, setCategoryName] = useState('');
  const [items, setItems] = useState<ClothingItem[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [editItem, setEditItem] = useState<ClothingItem | null>(null);
  const [loading, setLoading] = useState(false);
  const [searchSku, setSearchSku] = useState('');
  const navigate = useNavigate();

  // Fetch category name
  useEffect(() => {
    if (!categoryId) return;
    fetch(`${CATEGORY_API_URL}`)
      .then(res => res.json())
      .then((data: { id: string; name: string }[]) => {
        const cat = data.find(c => c.id === categoryId);
        setCategoryName(cat ? cat.name : '');
      });
  }, [categoryId]);

  // Fetch items from backend
  useEffect(() => {
    if (!categoryId) return;
    setLoading(true);
    fetch(`${API_URL}/${categoryId}`)
      .then(res => res.json())
      .then(data => setItems(data))
      .finally(() => setLoading(false));
  }, [categoryId]);

  // Add or update item
  const handleSave = async (item: ClothingItem) => {
    if (editItem) {
      // Edit
      const res = await fetch(`${API_URL}/${item.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          brand: item.brand,
          size: item.size,
          price: item.price,
          color: priceToColor(item.price),
          sku: item.sku,
        }),
      });
      const updated = await res.json();
      setItems(prev => prev.map(i => (i.id === updated.id ? updated : i)));
    } else {
      // Add
      const res = await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          categoryId,
          brand: item.brand,
          size: item.size,
          price: item.price,
          color: priceToColor(item.price),
          sku: item.sku,
        }),
      });
      const created = await res.json();
      setItems(prev => [...prev, created]);
    }
    setShowModal(false);
    setEditItem(null);
  };

  // Remove item
  const handleRemove = async (id: string) => {
    await fetch(`${API_URL}/${id}`, { method: 'DELETE' });
    setItems(prev => prev.filter(i => i.id !== id).map((i, idx) => ({ ...i, order: idx + 1 })));
    // Refetch to ensure order is correct
    fetch(`${API_URL}/${categoryId}`)
      .then(res => res.json())
      .then(data => setItems(data));
  };

  // Reorder items (move up/down)
  const moveItem = async (idx: number, dir: -1 | 1) => {
    const newItems = [...items];
    const targetIdx = idx + dir;
    if (targetIdx < 0 || targetIdx >= newItems.length) return;
    [newItems[idx], newItems[targetIdx]] = [newItems[targetIdx], newItems[idx]];
    // Update order in backend
    await fetch(`${API_URL}/${categoryId}/reorder`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids: newItems.map(i => i.id) }),
    });
    setItems(newItems.map((i, idx) => ({ ...i, order: idx + 1 })));
  };

  // Export to Excel (placeholder)
  const handleExport = () => {
    alert('Export to Excel coming soon!');
  };

  // Filtered items by SKU
  const filteredItems = items.filter(item =>
    item.sku.toLowerCase().includes(searchSku.toLowerCase())
  );

  return (
    <div className="clothing-list-bg">
      <div className="clothing-list-card glass">
        <button className="back-btn" onClick={() => navigate('/dashboard')}><FaArrowLeft /> Back</button>
        <img src={osuLogo} alt="Ohio State Logo" className="osu-logo" />
        <div className="clothing-list-header">
          <h2>
            {categoryName ? `${categoryName} Inventory` : 'Clothing Inventory'}
          </h2>
          <div className="header-divider" />
          <div className="clothing-list-subtitle">Manage, sort, and track donated clothing for OSU.</div>
        </div>
        <div className="clothing-list-actions">
          <div className="sku-search-wrapper">
            <span className="sku-search-icon"><FaSearch /></span>
            <input
              type="text"
              className="sku-search-input"
              placeholder="Search by SKU/Tag..."
              value={searchSku}
              onChange={e => setSearchSku(e.target.value)}
            />
          </div>
          <button onClick={() => setShowModal(true)} className="osu-btn"><FaPlus style={{marginRight: 6}} />Add Item</button>
          <button onClick={handleExport} className="osu-btn osu-btn-gray"><FaFileExport style={{marginRight: 6}} />Export</button>
        </div>
        {loading ? (
          <div style={{ marginTop: 24 }}>Loading...</div>
        ) : (
          <div className="table-responsive">
            <table className="clothing-table">
              <thead>
                <tr>
                  <th>Position</th>
                  <th>Brand</th>
                  <th>Size</th>
                  <th>Price</th>
                  <th>Color</th>
                  <th>SKU/Tag</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredItems.length === 0 && (
                  <tr><td colSpan={7} style={{ textAlign: 'center', color: '#888' }}>No items yet.</td></tr>
                )}
                {filteredItems.map((item, idx) => (
                  <tr key={item.id}>
                    <td>{item.order}</td>
                    <td>{item.brand}</td>
                    <td>{item.size}</td>
                    <td>${item.price.toFixed(2)}</td>
                    <td><span className={`pill-badge pill-${item.color}`}>{item.color}</span></td>
                    <td>{item.sku}</td>
                    <td>
                      <button className="osu-btn osu-btn-sm osu-btn-icon" title="Edit" onClick={() => { setEditItem(item); setShowModal(true); }}><FaEdit /></button>
                      <button className="osu-btn osu-btn-sm osu-btn-icon osu-btn-gray" title="Remove" onClick={() => handleRemove(item.id)}><FaTrash /></button>
                      <button className="osu-btn osu-btn-sm osu-btn-icon osu-btn-gray" title="Move Up" onClick={() => moveItem(idx, -1)} disabled={idx === 0}><FaArrowUp /></button>
                      <button className="osu-btn osu-btn-sm osu-btn-icon osu-btn-gray" title="Move Down" onClick={() => moveItem(idx, 1)} disabled={idx === items.length - 1}><FaArrowDown /></button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {showModal && (
          <ItemModal
            onClose={() => { setShowModal(false); setEditItem(null); }}
            onSave={handleSave}
            initial={editItem}
          />
        )}
      </div>
    </div>
  );
};

// Modal for add/edit item
const ItemModal: React.FC<{
  onClose: () => void;
  onSave: (item: ClothingItem) => void;
  initial?: ClothingItem | null;
}> = ({ onClose, onSave, initial }) => {
  const [brand, setBrand] = useState(initial?.brand || '');
  const [size, setSize] = useState(initial?.size || '');
  const [price, setPrice] = useState(initial?.price || '');
  const [sku, setSku] = useState(initial?.sku || '');
  const color = priceToColor(Number(price) || 0);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({
      id: initial?.id || Math.random().toString(36).substr(2, 9),
      order: initial?.order || 0,
      brand,
      size,
      price: Number(price) || 0,
      color,
      sku,
      categoryId: '', // will be set in parent
    });
  };

  return (
    <div className="modal-bg">
      <div className="modal-card glass">
        <button className="modal-close-btn" onClick={onClose} title="Close"><FaTimes /></button>
        <h3>{initial ? 'Edit' : 'Add'} Clothing Item</h3>
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Brand</label>
            <input value={brand} onChange={e => setBrand(e.target.value)} required />
          </div>
          <div className="form-group">
            <label>Size</label>
            <input value={size} onChange={e => setSize(e.target.value)} required />
          </div>
          <div className="form-group">
            <label>Price</label>
            <input
              type="text"
              inputMode="decimal"
              pattern="[0-9]*[.,]?[0-9]*"
              value={price}
              onChange={e => {
                const val = e.target.value;
                if (val === '' || /^\d*\.?\d*$/.test(val)) setPrice(val);
              }}
              required
            />
          </div>
          <div className="form-group">
            <label>SKU/Tag</label>
            <input value={sku} onChange={e => setSku(e.target.value)} required />
          </div>
          <div className="form-group">
            <label>Color (auto from price)</label>
            <input value={color} readOnly style={{ background: color, color: '#fff', fontWeight: 600 }} />
          </div>
          <div style={{ marginTop: 16, display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
            <button type="button" className="osu-btn osu-btn-gray" onClick={onClose}>Cancel</button>
            <button type="submit" className="osu-btn">Save</button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ClothingList; 