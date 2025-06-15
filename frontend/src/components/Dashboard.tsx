import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { FaTrash } from 'react-icons/fa';
import './Dashboard.css';
import osuLogo from '../assets/osu.png';

const API_URL = 'http://localhost:4000/api/categories';

interface Category {
  id: string;
  name: string;
}

const Dashboard: React.FC = () => {
  const [categories, setCategories] = useState<Category[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [newCategory, setNewCategory] = useState('');
  const [error, setError] = useState('');

  // Fetch categories from backend
  useEffect(() => {
    fetchCategories();
  }, []);

  const fetchCategories = async () => {
    const res = await fetch(API_URL);
    const data = await res.json();
    setCategories(data);
  };

  const handleAddCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!newCategory.trim()) {
      setError('Category name is required');
      return;
    }
    try {
      const res = await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newCategory }),
      });
      const data = await res.json();
      if (res.ok) {
        setCategories(prev => [...prev, data].sort((a, b) => a.name.localeCompare(b.name)));
        setShowModal(false);
        setNewCategory('');
      } else {
        setError(data.error || 'Error adding category');
      }
    } catch {
      setError('Error adding category');
    }
  };

  const handleDeleteCategory = async (id: string, name: string) => {
    // First confirmation
    if (!window.confirm(`Are you sure you want to delete "${name}"? This will also delete all items in this category.`)) {
      return;
    }
    // Second, more serious confirmation
    if (!window.confirm(`This action is permanent and cannot be undone. Delete category "${name}" and all its items?`)) {
      return;
    }
    try {
      const res = await fetch(`${API_URL}/${id}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        setCategories(prev => prev.filter(cat => cat.id !== id));
      } else {
        const data = await res.json();
        setError(data.error || 'Error deleting category');
      }
    } catch {
      setError('Error deleting category');
    }
  };

  return (
    <div className="dashboard-bg">
      <div className="dashboard-container">
        <img src={osuLogo} alt="Ohio State Logo" className="osu-logo" />
        <h2 className="osu-header">Clothing Categories</h2>
        <button className="osu-btn" style={{ marginBottom: 18 }} onClick={() => setShowModal(true)}>
          + Add Category
        </button>
        {error && <div style={{ color: 'red', marginBottom: 12 }}>{error}</div>}
        <div className="category-list">
          {categories.map((cat) => (
            <div key={cat.id} className="category-card-container">
              <Link to={`/clothing/${cat.id}`} className="category-card">
                {cat.name}
              </Link>
              <button 
                className="delete-btn"
                onClick={() => handleDeleteCategory(cat.id, cat.name)}
                title="Delete category"
              >
                <FaTrash />
              </button>
            </div>
          ))}
        </div>
        {showModal && (
          <div className="modal-bg">
            <div className="modal-card glass">
              <h3>Add New Category</h3>
              <form onSubmit={handleAddCategory}>
                <input
                  type="text"
                  value={newCategory}
                  onChange={e => setNewCategory(e.target.value)}
                  placeholder="Category name"
                  style={{ width: '100%', padding: '0.7rem', borderRadius: 8, border: '1.5px solid #c7d2fe', fontSize: '1.1rem', marginBottom: 12 }}
                  autoFocus
                />
                {error && <div style={{ color: 'red', marginBottom: 8 }}>{error}</div>}
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                  <button type="button" className="osu-btn osu-btn-gray" onClick={() => { setShowModal(false); setError(''); }}>Cancel</button>
                  <button type="submit" className="osu-btn">Add</button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Dashboard; 