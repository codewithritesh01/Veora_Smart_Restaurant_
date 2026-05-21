import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { Leaf, LogOut, Menu as MenuIcon, X, ChevronRight } from 'lucide-react';
import { Layout, Menu, Button } from 'antd';
import './Navbar.css';

const { Header } = Layout;

export default function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Lock body scroll when mobile menu is open
  useEffect(() => {
    if (mobileMenuOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => { document.body.style.overflow = 'unset'; };
  }, [mobileMenuOpen]);

  // Close menu on route change
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [location.pathname]);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const adminMenu = [
    { key: '/admin/dashboard', label: <Link to="/admin/dashboard">Dashboard</Link> },
    { key: '/admin/inventory', label: <Link to="/admin/inventory">Inventory</Link> },
    { key: '/admin/menu', label: <Link to="/admin/menu">Manage Menu</Link> },
    { key: '/admin/sales', label: <Link to="/admin/sales">Sales</Link> },
  ];

  const userMenu = [
    { key: '/menu', label: <Link to="/menu">Explore Menu</Link> },
    { key: '/rewards', label: <Link to="/rewards">My Rewards</Link> },
  ];

  const currentMenu = user?.role === 'admin' ? adminMenu : userMenu;

  return (
    <>
    <Header className="veora-navbar">
      <Link to="/" className="nav-brand">
        <Leaf size={24} className="nav-brand-icon" />
        <span className="nav-brand-text">Veora</span>
      </Link>

      <div className="nav-menu-container">
        <Menu 
          mode="horizontal" 
          selectedKeys={[location.pathname]} 
          items={currentMenu} 
          className="nav-menu"
          disabledOverflow
        />
      </div>

      <div className="nav-actions">
        <span className="nav-user-greeting">
          Welcome, {user?.name?.split(' ')[0] || 'Guest'}
        </span>
        <Button 
          type="text" 
          icon={<LogOut size={16} />} 
          onClick={handleLogout}
          className="nav-logout-btn"
        >
          Sign Out
        </Button>
        {/* Hamburger button - only visible on mobile */}
        <button
          className="nav-hamburger"
          onClick={() => setMobileMenuOpen(prev => !prev)}
          aria-label="Toggle menu"
        >
          {mobileMenuOpen ? <X size={22} /> : <MenuIcon size={22} />}
        </button>
      </div>
    </Header>

    {/* Mobile dropdown menu */}
    {mobileMenuOpen && (
      <>
        <div className="nav-mobile-overlay" onClick={() => setMobileMenuOpen(false)} />
        <div className="nav-mobile-dropdown">
          {currentMenu.map(item => (
            <div
              key={item.key}
              className={`nav-mobile-item${location.pathname === item.key ? ' active' : ''}`}
            >
              <div style={{ flex: 1 }}>{item.label}</div>
              <ChevronRight size={16} opacity={0.5} />
            </div>
          ))}
          <div className="nav-mobile-item nav-mobile-logout" onClick={() => { handleLogout(); setMobileMenuOpen(false); }}>
            <LogOut size={16} style={{ marginRight: 12 }} />
            <div style={{ flex: 1 }}>Sign Out</div>
            <ChevronRight size={16} opacity={0.5} />
          </div>
        </div>
      </>
    )}
    </>
  );
}
