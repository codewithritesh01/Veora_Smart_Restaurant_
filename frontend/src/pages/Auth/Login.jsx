import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { Leaf, Mail, Lock } from 'lucide-react';
import { Form, Input, Button, Alert } from 'antd';
import './Auth.css';

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const onFinish = async (values) => {
    setLoading(true);
    setError('');
    try {
      const user = await login(values.email, values.password);
      if (user.role === 'admin') navigate('/admin/dashboard');
      else navigate('/menu');
    } catch (err) {
      setError(err.response?.data?.detail || 'Login failed. Please check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-left">
        <div className="auth-brand">
          <Leaf size={32} className="auth-brand-icon" />
          <h1>Veora</h1>
        </div>
        <h2 className="auth-tagline">Fine Dining,<br />Redefined.</h2>
        <p className="auth-sub">Experience culinary excellence with a conscience. Every bite matters.</p>
        <div className="auth-features">
          <div className="auth-feature">🌿 Farm-to-table philosophy</div>
          <div className="auth-feature">⭐ Earn rewards with every meal</div>
          <div className="auth-feature">🪑 Seamless table reservations</div>
        </div>
      </div>

      <div className="auth-right">
        <div className="auth-card">
          <div className="auth-card-header">
            <h2>Welcome back</h2>
            <p>Sign in to your Veora account</p>
          </div>

          {error && <Alert message={error} type="error" showIcon style={{ marginBottom: 20 }} />}

          <Form
            name="login"
            layout="vertical"
            onFinish={onFinish}
            autoComplete="off"
            id="login-form"
            size="large"
          >
            <Form.Item
              name="email"
              label="Email address"
              rules={[
                { required: true, message: 'Please input your email!' },
                { type: 'email', message: 'Please enter a valid email!' }
              ]}
            >
              <Input prefix={<Mail size={16} className="text-muted" />} placeholder="your@email.com" />
            </Form.Item>

            <Form.Item
              name="password"
              label="Password"
              rules={[{ required: true, message: 'Please input your password!' }]}
            >
              <Input.Password prefix={<Lock size={16} className="text-muted" />} placeholder="Enter your password" />
            </Form.Item>

            <Form.Item>
              <Button type="primary" htmlType="submit" block loading={loading} className="btn-lg">
                Sign In
              </Button>
            </Form.Item>
          </Form>

          <p className="auth-switch">
            Don't have an account?{' '}
            <Link to="/signup" className="auth-link">Create one</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
