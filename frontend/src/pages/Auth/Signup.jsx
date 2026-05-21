import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { Leaf, Mail, Lock, User, Phone } from 'lucide-react';
import { Form, Input, Button, Alert, message } from 'antd';
import './Auth.css';

export default function Signup() {
  const { register, login } = useAuth();
  const navigate = useNavigate();
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const onFinish = async (values) => {
    setLoading(true);
    setError('');
    try {
      // Force role to 'user' on signup
      const payload = { ...values, role: 'user' };
      await register(payload);
      const user = await login(values.email, values.password);
      message.success('Account created successfully!');
      
      if (user.role === 'admin') navigate('/admin/dashboard');
      else navigate('/menu');
    } catch (err) {
      setError(err.response?.data?.detail || 'Registration failed. Please try again.');
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
        <h2 className="auth-tagline">Join the<br />Veora Family.</h2>
        <p className="auth-sub">Enjoy exclusive rewards, table reservations, and personalized dining experiences.</p>
        <div className="auth-features">
          <div className="auth-feature">🎟️ Earn coupons by reducing food waste</div>
          <div className="auth-feature">🌿 Support sustainable dining</div>
          <div className="auth-feature">🍽️ Reserve your table in seconds</div>
        </div>
      </div>

      <div className="auth-right">
        <div className="auth-card">
          <div className="auth-card-header">
            <h2>Create Account</h2>
            <p>Start your Veora journey today</p>
          </div>

          {error && <Alert message={error} type="error" showIcon style={{ marginBottom: 20 }} />}

          <Form
            name="signup"
            layout="vertical"
            onFinish={onFinish}
            autoComplete="off"
            id="signup-form"
            size="large"
          >
            <Form.Item
              name="name"
              label="Full Name"
              rules={[{ required: true, message: 'Please input your full name!', min: 2 }]}
            >
              <Input prefix={<User size={16} className="text-muted" />} placeholder="John Doe" />
            </Form.Item>

            <Form.Item
              name="email"
              label="Email Address"
              rules={[
                { required: true, message: 'Please input your email!' },
                { type: 'email', message: 'Please enter a valid email!' }
              ]}
            >
              <Input prefix={<Mail size={16} className="text-muted" />} placeholder="your@email.com" />
            </Form.Item>

            <Form.Item
              name="mobile"
              label="Mobile (optional)"
            >
              <Input prefix={<Phone size={16} className="text-muted" />} placeholder="+91 98765 43210" />
            </Form.Item>

            <Form.Item
              name="password"
              label="Password"
              rules={[{ required: true, message: 'Please input your password!', min: 6 }]}
            >
              <Input.Password prefix={<Lock size={16} className="text-muted" />} placeholder="Min. 6 characters" />
            </Form.Item>

            <Form.Item>
              <Button type="primary" htmlType="submit" block loading={loading} className="btn-lg">
                Create Account
              </Button>
            </Form.Item>
          </Form>

          <p className="auth-switch">
            Already have an account?{' '}
            <Link to="/login" className="auth-link">Sign in</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
