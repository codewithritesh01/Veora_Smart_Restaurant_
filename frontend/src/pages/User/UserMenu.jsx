import { useState, useEffect } from 'react';
import Navbar from '../../components/Navbar';
import dayjs from 'dayjs';
import api, { BASE_URL } from '../../api/client';
import { Search, Flame, Leaf, CookingPot, CalendarDays, ShoppingCart, ReceiptText, ChefHat, PlusCircle, ArrowDown, ChevronDown } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { Form, Input, Card, Modal, Row, Col, Typography, Tag, Select, DatePicker, TimePicker, InputNumber, Button, Space, message } from 'antd';
import './UserMenu.css';

const { Title, Text, Paragraph } = Typography;

export default function UserMenu() {
  const { user } = useAuth();
  const [menu, setMenu] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('All');
  const [search, setSearch] = useState('');
  const [itemQuantities, setItemQuantities] = useState({}); // { itemName: qty }
  
  const [isBookingModalOpen, setBookingModalOpen] = useState(false);
  const [isViewBookingsOpen, setViewBookingsOpen] = useState(false);
  const [isCheckInVisible, setIsCheckInVisible] = useState(false);
  const [isCartMinimized, setIsCartMinimized] = useState(false);
  const [myBookings, setMyBookings] = useState([]);
  const [bookingLoading, setBookingLoading] = useState(false);
  const [viewLoading, setViewLoading] = useState(false);
  const [form] = Form.useForm();

  useEffect(() => {
    fetchMenu();
    fetchMyBookings();
  }, []);

  const fetchMenu = async () => {
    try {
      const res = await api.get('/api/user/menu');
      setMenu(res.data);
    } catch (err) {
      console.error(err);
      message.error("Failed to load menu");
    } finally {
      setLoading(false);
    }
  };

  const categories = ['All', ...new Set(menu.map(i => i.category))];
  const filteredMenu = menu.filter(item => {
    const matchesCat = filter === 'All' || item.category === filter;
    const matchesSearch = item.name.toLowerCase().includes(search.toLowerCase());
    return matchesCat && matchesSearch;
  });

  const fetchMyBookings = async () => {
    setViewLoading(true);
    try {
      const res = await api.get('/api/user/bookings');
      setMyBookings(res.data);
    } catch (err) {
      message.error("Failed to load your bookings");
    } finally {
      setViewLoading(false);
    }
  };

  const handleCancelBooking = async (id) => {
    try {
      await api.patch(`/api/user/bookings/${id}/cancel`);
      message.success("Reservation cancelled successfully");
      fetchMyBookings();
    } catch (err) {
      message.error("Failed to cancel reservation");
    }
  };

  const handleRequestBill = async (id) => {
    try {
      await api.patch(`/api/user/bookings/${id}/request-bill`);
      message.success("Bill requested! A server will be with you shortly.");
      fetchMyBookings();
    } catch (err) {
      message.error("Failed to request bill");
    }
  };

  const handleAddDishToOrder = async (bookingId, dishName, qty = 1) => {
    try {
      await api.patch(`/api/user/bookings/${bookingId}/add-items`, { 
        dishes: [{ name: dishName, qty: qty }] 
      });
      message.success(`${dishName} added to cart`);
      fetchMyBookings();
    } catch (err) {
      message.error("Failed to add item to order");
    }
  };

  const updateItemQty = (name, delta) => {
    setItemQuantities(prev => {
      const current = prev[name] || 1;
      const next = Math.max(1, current + delta);
      return { ...prev, [name]: next };
    });
  };

  const handleUpdateCartQty = async (bookingId, dishName, delta) => {
    try {
      await api.patch(`/api/user/bookings/${bookingId}/update-item-qty`, { 
        dish_name: dishName, 
        delta: delta 
      });
      fetchMyBookings();
    } catch (err) {
      message.error("Failed to update quantity");
    }
  };

  const handleBookTable = async (values) => {
    setBookingLoading(true);
    try {
      const payload = {
        date: values.date.format('YYYY-MM-DD'),
        time: values.time.format('HH:mm'),
        guests: values.guests,
        dishes: values.dishes || [],
        name: user?.name,
        email: user?.email,
        phone: user?.mobile,
        coupon_code: values.coupon_code || null,
        special_requests: values.special_requests || ""
      };
      
      const res = await api.post('/api/user/book-table', payload);
      message.success(`Table booked successfully! ${res.data.discount_applied > 0 ? `Discount applied: ₹${res.data.discount_applied}` : ''}`);
      setBookingModalOpen(false);
      form.resetFields();
    } catch (err) {
      message.error(err.response?.data?.detail || 'Booking failed');
    } finally {
      setBookingLoading(false);
    }
  };

  return (
    <div className="layout">
      <Navbar />
      
      <main className="main-content container">
        <div className="um-hero-section">
          <div className="um-hero-content text-center">
            <Tag color="orange" style={{ borderRadius: '20px', padding: '4px 12px', marginBottom: '16px' }}>
              <Flame size={12} style={{ display: 'inline', marginRight: 4 }} /> Try our seasonal specials
            </Tag>
            <Title level={1} className="hero-title">A Symphony of Flavors</Title>
            <Paragraph className="hero-subtitle">
              Sustainably sourced, perfectly crafted. Experience fine dining that cares for the planet.
            </Paragraph>
            <Space size="middle">
              <Button type="primary" size="large" onClick={() => setBookingModalOpen(true)}>
                Reserve a Table
              </Button>
              <Button size="large" onClick={() => { setViewBookingsOpen(true); fetchMyBookings(); }}>
                My Reservations
              </Button>
            </Space>
          </div>
        </div>

        {/* --- Floating Live Cart --- */}
        {(() => {
          const today = dayjs().format('YYYY-MM-DD');
          const tomorrow = dayjs().add(1, 'day').format('YYYY-MM-DD');
          const yesterday = dayjs().subtract(1, 'day').format('YYYY-MM-DD');

          // 1. Prioritize ANY booking that is explicitly 'active' (checked-in) and not paid/completed
          const activeBooking = myBookings.find(b => 
            b.status === 'active' && 
            b.bill_status !== 'paid' && 
            b.status !== 'completed'
          );
          
          // 2. Fallback to bookings for today/yesterday/tomorrow (handling timezone shifts)
          // Exclude cancelled, completed, and paid sessions
          const potentialBookings = myBookings.filter(b => 
            (b.date === today || b.date === tomorrow || b.date === yesterday) && 
            b.status !== 'cancelled' &&
            b.status !== 'completed' &&
            b.bill_status !== 'paid'
          );

          const todayBooking = activeBooking || 
                               potentialBookings.find(b => b.status === 'active') ||
                               potentialBookings.find(b => b.dishes && b.dishes.length > 0) || 
                               potentialBookings[0];
          
          if (!todayBooking) return null;
          
          // Hide widget once bill is paid or session is completed
          if (todayBooking.bill_status === 'paid' || todayBooking.status === 'completed') return null;

          return (
            <Card className={`live-cart-widget active ${isCartMinimized ? 'minimized' : ''}`}>
              <div 
                className="cart-header" 
                onClick={() => setIsCartMinimized(!isCartMinimized)}
                style={{ cursor: 'pointer', transition: 'all 0.3s' }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1 }}>
                    <ShoppingCart size={20} />
                    <Title level={5} style={{ margin: 0, color: 'inherit', fontSize: '1rem' }}>Live Order</Title>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <ChevronDown 
                        size={16} 
                        style={{ 
                            transform: isCartMinimized ? 'rotate(180deg)' : 'rotate(0deg)', 
                            transition: 'transform 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275)' 
                        }} 
                    />
                    <Text style={{ fontSize: '0.75rem', color: 'inherit', fontWeight: 500 }}>
                        {isCartMinimized ? 'Order More' : 'Hide'}
                    </Text>
                </div>
              </div>

              {!isCartMinimized && (
              <div className="cart-active-content">
                <div className="cart-items-list">
                  {todayBooking.dishes?.length > 0 ? (
                    todayBooking.dishes.map((d, i) => {
                      const name = typeof d === 'string' ? d : d.name;
                      const qty = typeof d === 'string' ? 1 : d.qty;
                      return (
                        <div key={i} className="cart-item">
                          <ChefHat size={14} style={{ flexShrink: 0 }} />
                          <Text ellipsis style={{ flex: 1, marginRight: 8 }}>
                            {name}
                          </Text>
                          <Space size={4} className="cart-qty-control">
                            <Button 
                              size="small" 
                              type="text" 
                              className="cart-qty-btn"
                              disabled={todayBooking.is_locked}
                              onClick={() => handleUpdateCartQty(todayBooking._id, name, -1)}
                            >
                              -
                            </Button>
                            <Text strong style={{ minWidth: 16, textAlign: 'center', fontSize: '0.85rem' }}>{qty}</Text>
                            <Button 
                              size="small" 
                              type="text" 
                              className="cart-qty-btn"
                              onClick={() => handleUpdateCartQty(todayBooking._id, name, 1)}
                            >
                              +
                            </Button>
                          </Space>
                        </div>
                      );
                    })
                  ) : (
                    <Text type="secondary" italic style={{ fontSize: '0.8rem' }}>No items pre-ordered</Text>
                  )}
                </div>
                
                <div className="cart-footer">
                  <div className="cart-total-line">
                    <Text type="secondary">Total:</Text>
                    <Text strong style={{ fontSize: '1.1rem', color: 'var(--green-700)' }}>
                      ₹{todayBooking.total_amount || 0}
                    </Text>
                  </div>
                    <Button 
                      type="primary" 
                      icon={<ReceiptText size={16} />} 
                      style={{ width: '100%', marginTop: 8 }}
                      loading={loading}
                      disabled={todayBooking.bill_status === 'order_requested' && !todayBooking.is_locked}
                      onClick={() => handleRequestBill(todayBooking._id)}
                    >
                      {todayBooking.is_locked 
                        ? (todayBooking.bill_status === 'order_requested' ? 'Bill Requested' : 'Request Final Bill')
                        : (todayBooking.bill_status === 'order_requested' ? 'Order Requested' : 'Confirm & Request Order')
                      }
                    </Button>
                </div>
              </div>
              )}
            </Card>
          );
        })()}

        <div className="menu-controls">
          <div className="category-pills">
            {categories.map(c => (
              <Button 
                key={c} 
                onClick={() => setFilter(c)}
                shape="round"
                type={filter === c ? 'primary' : 'default'}
              >
                {c}
              </Button>
            ))}
          </div>
          <div className="menu-search">
            <Input 
              placeholder="Search dishes..." 
              prefix={<Search size={16} className="text-muted" />}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ width: 250, borderRadius: 20 }}
            />
          </div>
        </div>

        {loading ? (
          <div className="loading-center"><div className="spinner" /></div>
        ) : (
          <Row gutter={[24, 32]}>
            {filteredMenu.map(item => (
              <Col xs={24} sm={12} md={8} lg={6} key={item.id}>
                <Card 
                  hoverable
                  cover={
                    <div className="menu-card-image">
                      <img 
                        alt={item.name} 
                        src={item.image_url ? (item.image_url.startsWith('http') ? item.image_url : `${BASE_URL}${item.image_url}`) : 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=500&q=80'} 
                        className="menu-img" 
                      />
                      <div className="menu-card-badge">
                        <Tag color={item.food_type === 'Veg' ? 'green' : 'red'}>
                          {item.food_type || 'Veg'}
                        </Tag>
                      </div>
                    </div>
                  }
                  className="menu-card"
                  bodyStyle={{ padding: '20px 16px' }}
                >
                  <div className="menu-card-header">
                    <Title level={5} className="menu-item-name">{item.name}</Title>
                    <span className="menu-price">₹{item.price}</span>
                  </div>
                  <div className="menu-card-footer">
                    <span className="menu-category-tag">{item.category}</span>
                    {(() => {
                      const today = dayjs().format('YYYY-MM-DD');
                      const tomorrow = dayjs().add(1, 'day').format('YYYY-MM-DD');
                      const yesterday = dayjs().subtract(1, 'day').format('YYYY-MM-DD');

                      // Prioritize 'active' status, then date match — exclude paid/completed
                      const activeBooking = myBookings.find(b => 
                        b.status === 'active' && 
                        b.bill_status !== 'paid' && 
                        b.status !== 'completed'
                      );
                      const todayBooking = activeBooking || myBookings.find(b => 
                        (b.date === today || b.date === tomorrow || b.date === yesterday) && 
                        b.status !== 'cancelled' &&
                        b.status !== 'completed' &&
                        b.bill_status !== 'paid'
                      );

                      // Only show Add button for active, unpaid sessions
                      const canAddItems = todayBooking && 
                        todayBooking.bill_status !== 'paid' && 
                        todayBooking.status !== 'completed' &&
                        todayBooking.status === 'active'; // Must be checked in by admin

                      if (canAddItems) {
                        const currentQty = itemQuantities[item.name] || 1;
                        return (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'flex-end' }}>
                            <Button 
                              type="primary" 
                              size="small" 
                              shape="round" 
                              icon={<PlusCircle size={14} />}
                              onClick={() => handleAddDishToOrder(todayBooking._id, item.name, 1)}
                            >
                              Add
                            </Button>
                          </div>
                        );
                      }
                      return null;
                    })()}
                  </div>
                </Card>
              </Col>
            ))}
          </Row>
        )}
      </main>

      <Modal
        title={
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontFamily: 'Playfair Display', fontSize: 24, margin: '8px 0 16px' }}>
            <CookingPot size={24} color="var(--green-600)" />
            Reserve Your Experience
          </div>
        }
        open={isBookingModalOpen}
        onCancel={() => setBookingModalOpen(false)}
        footer={null}
        width={600}
      >
        <Form form={form} layout="vertical" onFinish={handleBookTable}>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="date" label="Date" rules={[{ required: true, message: 'Select a date' }]}>
                <DatePicker style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="time" label="Time" rules={[{ required: true, message: 'Select a time' }]}>
                <TimePicker format="HH:mm" style={{ width: '100%' }} />
              </Form.Item>
            </Col>
          </Row>
          
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="guests" label="Number of Guests" rules={[{ required: true }]}>
                <InputNumber min={1} max={20} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="coupon_code" label="Coupon Code (Optional)">
                <Input placeholder="e.g. SAVEFOOD_123" />
              </Form.Item>
            </Col>
          </Row>
          
          
          <Form.Item name="dishes" label="Pre-order Dishes (Optional)">
            <Select 
              mode="multiple" 
              placeholder="Select dishes you'd like to have" 
              style={{ width: '100%' }}
              options={menu.map(item => ({ label: item.name, value: item.name }))}
            />
          </Form.Item>
          
          <Form.Item name="special_requests" label="Special Requests (Optional)">
            <Input.TextArea rows={3} placeholder="Allergies, seating preferences..." />
          </Form.Item>
          
          <Form.Item style={{ marginBottom: 0, textAlign: 'right' }}>
            <Button onClick={() => setBookingModalOpen(false)} style={{ marginRight: 8 }}>
              Cancel
            </Button>
            <Button type="primary" htmlType="submit" loading={bookingLoading}>
              Confirm Reservation
            </Button>
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title={
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontFamily: 'Playfair Display', fontSize: 24, margin: '8px 0 16px' }}>
            <CalendarDays size={24} color="var(--green-600)" />
            My Reservations
          </div>
        }
        open={isViewBookingsOpen}
        onCancel={() => setViewBookingsOpen(false)}
        footer={null}
        width={700}
      >
        {viewLoading ? (
          <div className="loading-center"><div className="spinner" /></div>
        ) : myBookings.length === 0 ? (
          <div className="text-center py-8">
            <Paragraph type="secondary">You have no active reservations.</Paragraph>
            <Button type="link" onClick={() => { setViewBookingsOpen(false); setBookingModalOpen(true); }}>
              Book a table now
            </Button>
          </div>
        ) : (
          <div className="bookings-list">
            {myBookings.map(b => (
              <Card 
                key={b._id} 
                style={{ marginBottom: '24px', border: '1.5px solid #d4b896' }} 
                size="small"
                title={<Text strong>{dayjs(b.date).format('dddd, MMMM D, YYYY')}</Text>}
                extra={
                  <Space>
                    {(b.bill_status === 'paid' || b.status === 'past' || b.status === 'completed') && (
                      <Tag color="success">Completed</Tag>
                    )}
                    {b.status === 'active' && <Tag color="green">In Service</Tag>}
                    <Tag color="blue">{b.time}</Tag>
                  </Space>
                }
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div style={{ flex: 1 }}>
                    <Paragraph className="mb-1">Guests: <Text strong>{b.guests}</Text></Paragraph>
                    {b.dishes && b.dishes.length > 0 && (
                      <div style={{ marginBottom: 12 }}>
                        <Text type="secondary" style={{ display: 'block', marginBottom: 4, fontSize: '0.8rem' }}>Ordered Food:</Text>
                        <Space wrap>
                          {b.dishes.map((d, i) => (
                            <Tag key={i} color="green" style={{ borderRadius: 12 }}>
                              {typeof d === 'string' ? d : `${d.name} x${d.qty}`}
                            </Tag>
                          ))}
                        </Space>
                      </div>
                    )}
                    <div style={{ marginTop: 16, paddingTop: 12, borderTop: '1px dashed var(--beige-300)' }}>
                      <Text type="secondary">Estimated Total Amount:</Text>
                      <Title level={4} style={{ margin: 0, color: 'var(--green-700)' }}>₹{b.total_amount || 0}</Title>
                    </div>
                    {b.bill_status === 'order_requested' && (
                      <Tag color="orange" style={{ marginTop: 8 }}>Order Status: Requested</Tag>
                    )}
                  </div>
                  {b.status === 'upcoming' && (
                    <Button danger ghost onClick={() => handleCancelBooking(b._id)}>
                      Cancel
                    </Button>
                  )}
                </div>
              </Card>
            ))}
          </div>
        )}
      </Modal>
    </div>
  );
}
