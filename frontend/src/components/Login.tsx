import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import './Login.css';
import osuLogo from '../assets/osu.png';

interface LoginProps {
  onLogin?: () => void;
}

const Login: React.FC<LoginProps> = ({ onLogin }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Demo credentials: username: admin, password: password
    if (username === 'admin' && password === 'password') {
      setError('');
      if (onLogin) onLogin();
      navigate('/dashboard');
    } else {
      setError('Invalid username or password');
    }
  };

  return (
    <div className="login-bg">
      <div className="login-container card">
        <img src={osuLogo} alt="Ohio State Logo" className="osu-logo" />
        <div className="osu-login-header">Ohio State Clothing Inventory</div>
        <div className="osu-login-sub">Member Login</div>
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Username</label>
            <input
              type="text"
              value={username}
              onChange={e => setUsername(e.target.value)}
              required
              className="form-input"
            />
          </div>
          <div className="form-group">
            <label>Password</label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              className="form-input"
            />
          </div>
          {error && <div style={{ color: 'red', marginBottom: '1rem' }}>{error}</div>}
          <button type="submit" className="login-btn">Login</button>
        </form>
      </div>
    </div>
  );
};

export default Login; 