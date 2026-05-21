import { useState, useEffect, useMemo, useRef } from 'react';
import Navbar from '../../components/Navbar';
import api from '../../api/client';
import { ShoppingBag, CalendarDays, Filter, RefreshCw, ChefHat, Lock, Unlock, CheckCircle, Search as SearchIcon } from 'lucide-react';
import { Row, Col, Card, Typography, Table, Tag, Tabs, DatePicker, Button, Input, Select, Statistic, Space, message, Modal, Form, Checkbox, InputNumber, Badge, App } from 'antd';
import dayjs from 'dayjs';
import './Admin.css';

const { Title, Text } = Typography;
const { RangePicker } = DatePicker;

export default function AdminSales() {
  return (
    <App>
      <AdminSalesContent />
    </App>
  );
}

function AdminSalesContent() {
  const { message: msg } = App.useApp();
  // ── Sales state ──
  const [sales, setSales] = useState([]);
  const [salesLoading, setSalesLoading] = useState(true);
  const [salesDate, setSalesDate] = useState(dayjs());
  const [salesRange, setSalesRange] = useState(null);
  const [paymentFilter, setPaymentFilter] = useState(null);
  const [searchText, setSearchText] = useState('');
  const [searchedColumn, setSearchedColumn] = useState('');
  const searchInput = useRef(null);

  // ── Bookings state ──
  const [bookings, setBookings] = useState([]);
  const [bookingsLoading, setBookingsLoading] = useState(false);
  const [bookingRange, setBookingRange] = useState(null);

  // ── Active tab ──
  const [activeTab, setActiveTab] = useState('sold');

  // ── Quick Check-in state ──
  const [isCheckInVisible, setIsCheckInVisible] = useState(false);
  const [checkInLoading, setCheckInLoading] = useState(false);
  const [checkInForm] = Form.useForm();
  
  // ── Order Details state ──
  const [selectedBooking, setSelectedBooking] = useState(null);
  const [isOrderModalOpen, setIsOrderModalOpen] = useState(false);
  const [modalLoading, setModalLoading] = useState(false);
  const [completingIds, setCompletingIds] = useState(new Set()); // Track in-progress completions

  useEffect(() => {
    // On mount, fetch today's sales (backend already defaults, but we pass it anyway for UI consistency)
    fetchSales(dayjs().format('DD-MM-YYYY'));
  }, []);

  useEffect(() => {
    if (activeTab === 'active_bookings') {
      fetchBookings('active');
    } else if (activeTab === 'future') {
      fetchBookings('future');
    }
  }, [activeTab, bookingRange]);

  // ── Fetch sales ──
  const fetchSales = async (dateStr, fromDate, toDate, payment) => {
    setSalesLoading(true);
    try {
      const params = new URLSearchParams();
      if (dateStr) params.append('date', dateStr);
      if (fromDate) params.append('from_date', fromDate);
      if (toDate) params.append('to_date', toDate);
      if (payment) params.append('payment_method', payment);
      const queryStr = params.toString() ? `?${params.toString()}` : '';
      const res = await api.get(`/api/admin/sales${queryStr}`);
      setSales(res.data.sales || []);
    } catch (err) {
      console.error(err);
      msg.error('Failed to load sales');
      setSales([]);
    } finally {
      setSalesLoading(false);
    }
  };

  // ── Fetch bookings ──
  const fetchBookings = async (status) => {
    setBookingsLoading(true);
    try {
      const params = new URLSearchParams();
      if (status) params.append('status', status);
      if (bookingRange && bookingRange[0]) params.append('from_date', bookingRange[0].format('YYYY-MM-DD'));
      if (bookingRange && bookingRange[1]) params.append('to_date', bookingRange[1].format('YYYY-MM-DD'));
      const queryStr = params.toString() ? `?${params.toString()}` : '';
      const res = await api.get(`/api/admin/bookings${queryStr}`);
      const data = res.data || [];
      setBookings(data);
      return data;
    } catch (err) {
      console.error(err);
      msg.error('Failed to load bookings');
      setBookings([]);
      return [];
    } finally {
      setBookingsLoading(false);
    }
  };

  // ── Sales stats ──
  const salesStats = useMemo(() => {
    const totalRevenue = sales.reduce((sum, s) => sum + (s.total_bill || 0), 0);
    const totalOrders = sales.length;
    const avgBill = totalOrders > 0 ? totalRevenue / totalOrders : 0;
    return { totalRevenue, totalOrders, avgBill };
  }, [sales]);

  const handleApplySalesFilter = () => {
    if (salesDate) fetchSales(salesDate.format('DD-MM-YYYY'), null, null, paymentFilter);
    else if (salesRange && salesRange[0] && salesRange[1]) fetchSales(null, salesRange[0].format('DD-MM-YYYY'), salesRange[1].format('DD-MM-YYYY'), paymentFilter);
    else fetchSales(null, null, null, paymentFilter);
  };

  const handleResetSalesFilter = () => {
    setSalesDate(null);
    setSalesRange(null);
    setPaymentFilter(null);
    fetchSales();
  };

  const handleMakeActive = async (record) => {
    try {
      const today = dayjs().format('YYYY-MM-DD');
      await api.patch(`/api/admin/bookings/${record._id}`, {
        date: today,
        status: 'active',
        bill_status: 'none',
      });
      msg.success('Guest checked-in! Booking is now Active.');
      setActiveTab('active_bookings');
      fetchBookings('active');
    } catch (err) {
      console.error(err);
      msg.error('Failed to check-in guest');
    }
  };

  const handleQuickCheckIn = async (values) => {
    setCheckInLoading(true);
    try {
      const payload = {
        ...values,
        date: values.date.format('YYYY-MM-DD')
      };
      await api.post('/api/admin/bookings/check-in', payload);
      msg.success('Guest Checked-in Successfully!');
      setIsCheckInVisible(false);
      checkInForm.resetFields();
      setActiveTab('active_bookings');
      fetchBookings('active');
    } catch (err) {
        msg.error(err.response?.data?.detail || 'No matching booking found');
    } finally {
        setCheckInLoading(false);
    }
  };

  const handleToggleLock = async (record) => {
    try {
        const res = await api.patch(`/api/admin/bookings/${record._id}/lock`);
        msg.success(res.data.message);
        // Refresh the selected booking if we are in the modal
        if (selectedBooking && selectedBooking._id === record._id) {
            setSelectedBooking(prev => ({ ...prev, is_locked: res.data.is_locked }));
        }
        // Refresh the list
        fetchBookings('active');
    } catch (err) {
        msg.error('Failed to toggle lock status');
    }
  };

  const handleSearch = (selectedKeys, confirm, dataIndex) => {
    confirm();
    setSearchText(selectedKeys[0]);
    setSearchedColumn(dataIndex);
  };

  const handleReset = (clearFilters) => {
    clearFilters();
    setSearchText('');
  };

  const getColumnSearchProps = (dataIndex, title) => ({
    filterDropdown: ({ setSelectedKeys, selectedKeys, confirm, clearFilters, close }) => (
      <div style={{ padding: 8 }} onKeyDown={(e) => e.stopPropagation()}>
        <Input
          ref={searchInput}
          placeholder={`Search ${title || dataIndex}`}
          value={selectedKeys[0]}
          onChange={(e) => setSelectedKeys(e.target.value ? [e.target.value] : [])}
          onPressEnter={() => handleSearch(selectedKeys, confirm, dataIndex)}
          style={{ marginBottom: 8, display: 'block' }}
        />
        <Space>
          <Button
            type="primary"
            onClick={() => handleSearch(selectedKeys, confirm, dataIndex)}
            icon={<SearchIcon size={14} />}
            size="small"
            style={{ width: 90 }}
          >
            Search
          </Button>
          <Button
            onClick={() => clearFilters && handleReset(clearFilters)}
            size="small"
            style={{ width: 90 }}
          >
            Reset
          </Button>
          <Button
            type="link"
            size="small"
            onClick={() => {
              confirm({ closeDropdown: false });
              setSearchText(selectedKeys[0]);
              setSearchedColumn(dataIndex);
            }}
          >
            Filter
          </Button>
          <Button
            type="link"
            size="small"
            onClick={() => {
              close();
            }}
          >
            close
          </Button>
        </Space>
      </div>
    ),
    filterIcon: (filtered) => (
      <SearchIcon size={14} style={{ color: filtered ? 'var(--green-600)' : undefined }} />
    ),
    onFilter: (value, record) => {
      const targetValue = record[dataIndex] ? record[dataIndex].toString().toLowerCase() : '';
      return targetValue.includes(value.toLowerCase());
    },
    onFilterDropdownOpenChange: (visible) => {
      if (visible) {
        setTimeout(() => searchInput.current?.select(), 100);
      }
    },
    render: (text) =>
      searchedColumn === dataIndex ? (
        <Text strong style={{ color: 'var(--green-700)' }}>{text}</Text>
      ) : (
        text
      ),
  });

  const salesColumns = [
    { 
      title: 'Sale ID', 
      key: 'id', 
      width: 120,
      ...getColumnSearchProps('id', 'Sale ID'),
      render: (_, r) => <Text code>{r.id || r.order_id?.slice(-6).toUpperCase() || '—'}</Text>
    },
    { title: 'Date', dataIndex: 'Date', key: 'Date', width: 120, sorter: (a, b) => dayjs(a.Date, 'DD-MM-YYYY').unix() - dayjs(b.Date, 'DD-MM-YYYY').unix() },
    { 
      title: 'Customer', 
      key: 'customer', 
      width: 160,
      ...getColumnSearchProps('customer_id', 'Customer'),
      render: (_, r) => r.customer_id || r.customer_name || '—'
    },
    { title: 'Bill (₹)', dataIndex: 'total_bill', key: 'total_bill', width: 120, sorter: (a, b) => a.total_bill - b.total_bill, render: val => <Text strong>₹{Number(val).toFixed(2)}</Text> },
    { 
      title: 'Payment', 
      dataIndex: 'payment_method', 
      key: 'payment_method', 
      width: 120,
      filters: [
        { text: 'Online', value: 'Online' },
        { text: 'Cash', value: 'Cash' },
      ],
      onFilter: (value, record) => record.payment_method === value,
    },
    {
      title: 'Payment Status',
      key: 'payment_status',
      width: 140,
      render: () => <Tag color="green">✔ Complete</Tag>
    },
    {
      title: 'Order Status',
      key: 'order_status',
      width: 130,
      render: () => <Tag color="green">✔ Completed</Tag>
    },
  ];

  const bookingColumns = [
    { 
      title: 'Guest Name', 
      dataIndex: 'name', 
      key: 'name', 
      ...getColumnSearchProps('name', 'Guest'),
      render: val => <Text strong>{val}</Text> 
    },
    { 
      title: 'Email', 
      dataIndex: 'email', 
      key: 'email', 
      ellipsis: true,
      ...getColumnSearchProps('email', 'Email')
    },
    { 
      title: 'Phone', 
      dataIndex: 'phone', 
      key: 'phone', 
      width: 130,
      ...getColumnSearchProps('phone', 'Phone')
    },
    { title: 'Date', dataIndex: 'date', key: 'date', width: 110, sorter: (a, b) => dayjs(a.date).unix() - dayjs(b.date).unix() },
    { title: 'Time', dataIndex: 'time', key: 'time', width: 100 },
    { title: 'Guests', dataIndex: 'guests', key: 'guests', width: 90, sorter: (a, b) => a.guests - b.guests },
    { 
        title: 'Pre-orders', 
        dataIndex: 'dishes', 
        key: 'dishes', 
        render: (dishes) => (
            <div style={{ maxWidth: 170, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {(dishes || []).map((d, idx) => (
                  <Tag color="green" key={idx} style={{ marginBottom: 4 }}>
                    {typeof d === 'string' ? d : `${d.name} ${d.qty > 1 ? `x${d.qty}` : ''}`}
                  </Tag>
                ))}
            </div>
        )
    },
    { 
        title: 'Status', 
        key: 'status', 
        width: 140,
        filters: [
          { text: '📍 Today', value: 'today' },
          { text: '📅 Upcoming', value: 'upcoming' },
        ],
        onFilter: (value, record) => {
          const today = dayjs().format('YYYY-MM-DD');
          return value === 'today' ? record.date === today : record.date > today;
        },
        render: (_, record) => {
            const today = dayjs().format('YYYY-MM-DD');
            if (record.date === today) return <Tag color="orange">📍 Today</Tag>;
            return <Tag color="blue">📅 Upcoming</Tag>;
        }
    },
    {
        title: 'Action',
        key: 'action',
        width: 140,
        render: (_, record) => (
          <Button
            type="primary"
            size="small"
            icon={<CheckCircle size={14} />}
            style={{ backgroundColor: 'var(--green-600)', borderColor: 'var(--green-600)' }}
            onClick={() => handleMakeActive(record)}
          >
            Check-in
          </Button>
        )
    }
  ];

  // Specific columns for Active bookings
  const activeBookingColumns = [
    { 
      title: 'Guest Name', 
      dataIndex: 'name', 
      key: 'name', 
      ...getColumnSearchProps('name', 'Guest'),
      render: val => <Text strong>{val}</Text> 
    },
    { 
      title: 'Email', 
      dataIndex: 'email', 
      key: 'email', 
      ellipsis: true,
      ...getColumnSearchProps('email', 'Email')
    },
    { 
      title: 'Phone', 
      dataIndex: 'phone', 
      key: 'phone', 
      width: 130,
      ...getColumnSearchProps('phone', 'Phone')
    },
    { title: 'Date', dataIndex: 'date', key: 'date', width: 110, sorter: (a, b) => dayjs(a.date).unix() - dayjs(b.date).unix() },
    { title: 'Time', dataIndex: 'time', key: 'time', width: 80 },
    { title: 'Guests', dataIndex: 'guests', key: 'guests', width: 80, sorter: (a, b) => a.guests - b.guests },
    { 
        title: 'Pre-orders', 
        dataIndex: 'dishes', 
        key: 'dishes', 
        render: (dishes) => (
            <div style={{ maxWidth: 170, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {(dishes || []).map((d, idx) => (
                  <Tag color="green" key={idx} style={{ marginBottom: 4 }}>
                    {typeof d === 'string' ? d : `${d.name} ${d.qty > 1 ? `x${d.qty}` : ''}`}
                  </Tag>
                ))}
            </div>
        )
    },
    { 
        title: 'Order Status', 
        dataIndex: 'bill_status', 
        key: 'bill_status',
        width: 160,
        filters: [
          { text: 'Active', value: 'none' },
          { text: 'Order Requested', value: 'order_requested' },
          { text: 'Paid', value: 'paid' },
        ],
        onFilter: (value, record) => (record.bill_status || 'none') === value,
        render: (status, record) => {
          const isPastPaid = record.status === 'past' && record.bill_status === 'paid';
          return (
            <Space wrap>
              <Tag color={status === 'order_requested' ? 'orange' : status === 'paid' ? 'green' : 'blue'}>
                {status === 'order_requested' ? 'NEW ORDER REQUESTED' : status === 'paid' ? 'PAID' : 'Active'}
              </Tag>
              {isPastPaid && <Tag color="gold">⚡ Pending Completion</Tag>}
              {record.is_locked && <Tag color="volcano" icon={<Lock size={12} />}>Locked</Tag>}
            </Space>
          );
        }
    },
    {
        title: 'Action',
        key: 'action',
        width: 140,
        render: (_, record) => {
          const isPaid = record.bill_status === 'paid';
          return (
            <Space direction="vertical" size="small" style={{ width: '100%' }}>
              <Button 
                  type="primary" 
                  size="small" 
                  block
                  onClick={async () => { 
                      setModalLoading(true);
                      setIsOrderModalOpen(true);
                      setSelectedBooking(record); // Set initial record
                      try {
                          const res = await api.get(`/api/admin/bookings/${record._id}`);
                          setSelectedBooking(res.data);
                      } catch (err) {
                          msg.error('Failed to fetch latest order details');
                      } finally {
                          setModalLoading(false);
                      }
                  }}
              >
                  View Order
              </Button>
              {isPaid && (
                  <Button 
                    type="primary" 
                    size="small" 
                    icon={<CheckCircle size={14} />} 
                    style={{ backgroundColor: 'var(--green-600)', borderColor: 'var(--green-600)' }}
                    block
                    loading={completingIds.has(record._id)}
                    disabled={completingIds.has(record._id)}
                    onClick={async () => {
                        // Optimistically remove from list immediately
                        setCompletingIds(prev => new Set([...prev, record._id]));
                        setBookings(prev => prev.filter(b => b._id !== record._id));
                        try {
                            await api.patch(`/api/admin/bookings/${record._id}/complete`);
                            msg.success("Order marked as completed!");
                            fetchSales(); // Refresh the sales records list
                        } catch (err) {
                            msg.error(err.response?.data?.detail || "Failed to complete order");
                            // Revert optimistic removal on failure
                            fetchBookings('active');
                        } finally {
                            setCompletingIds(prev => { const s = new Set(prev); s.delete(record._id); return s; });
                        }
                    }}
                  >
                    Mark Completed
                  </Button>
              )}
            </Space>
          );
        }
    }
  ];

  return (
    <div className="layout">
      <Navbar />
        
        <main className="main-content container admin-container">
          <div className="admin-header">
            <div className="admin-header-left">
              <Title level={2} className="admin-page-title">
                <ShoppingBag size={24} className="admin-title-icon" />
                Sales & Bookings
              </Title>
              <p className="text-secondary">Track revenue and manage reservations.</p>
            </div>
            <div className="admin-header-actions">
              <Space wrap>
                <Button icon={<RefreshCw size={18} />} onClick={() => {
                  if (activeTab === 'sold') fetchSales(salesDate ? salesDate.format('DD-MM-YYYY') : dayjs().format('DD-MM-YYYY'));
                  else if (activeTab === 'active_bookings') fetchBookings('active');
                  else if (activeTab === 'future') fetchBookings('future');
                }}>
                  Refresh
                </Button>
                <Button type="primary" icon={<CalendarDays size={18} />} onClick={() => setIsCheckInVisible(true)}>
                  Quick Check-in
                </Button>
              </Space>
            </div>
          </div>

          <Tabs
            activeKey={activeTab}
            onChange={(key) => {
              setActiveTab(key);
              if (key === 'sold') {
                fetchSales(salesDate ? salesDate.format('DD-MM-YYYY') : dayjs().format('DD-MM-YYYY'));
              }
            }}
            items={[
              {
                key: 'sold',
                label: '💰 Sales Records',
                children: (
                  <>
                    {/* Stats row */}
                    <Row gutter={[16, 16]} style={{ marginBottom: 20 }}>
                      <Col xs={12} sm={8} md={6}>
                        <Card variant="borderless" className="mini-stat-card">
                          <Statistic title="Total Revenue" value={salesStats.totalRevenue} precision={2} prefix="₹" styles={{ content: { color: 'var(--green-700)', fontWeight: 600 } }} />
                        </Card>
                      </Col>
                      <Col xs={12} sm={8} md={6}>
                        <Card variant="borderless" className="mini-stat-card">
                          <Statistic title="Total Orders" value={salesStats.totalOrders} />
                        </Card>
                      </Col>
                      <Col xs={24} sm={8} md={6}>
                        <Card variant="borderless" className="mini-stat-card">
                          <Statistic title="Avg Bill" value={salesStats.avgBill} precision={2} prefix="₹" />
                        </Card>
                      </Col>
                    </Row>

                    <Card variant="borderless" size="small" style={{ marginBottom: 16 }}>
                      <Space wrap>
                        <DatePicker value={salesDate} onChange={d => { setSalesDate(d); setSalesRange(null); }} format="DD-MM-YYYY" placeholder="Date" style={{ width: 140 }} />
                        <RangePicker value={salesRange} onChange={r => { setSalesRange(r); setSalesDate(null); }} format="DD-MM-YYYY" />
                        <Button type="primary" onClick={handleApplySalesFilter}>Apply</Button>
                        <Button onClick={handleResetSalesFilter}>Reset</Button>
                      </Space>
                    </Card>
                    <Card variant="borderless" styles={{ body: { padding: 0 } }}>
                      <Table columns={salesColumns} dataSource={sales} rowKey="_id" loading={salesLoading} scroll={{ x: 900 }} pagination={{ pageSize: 10 }} />
                    </Card>
                  </>
                ),
              },
              {
                key: 'active_bookings',
                label: '📋 Active Bookings',
                children: (
                  <Card variant="borderless" styles={{ body: { padding: 0 } }}>
                    <Table columns={activeBookingColumns} dataSource={bookings} rowKey="_id" loading={bookingsLoading} scroll={{ x: 1200 }} />
                  </Card>
                ),
              },
              {
                key: 'future',
                label: '📅 Reservations / Upcoming',
                children: (
                  <Card variant="borderless" styles={{ body: { padding: 0 } }}>
                    <Table columns={bookingColumns} dataSource={bookings} rowKey="_id" loading={bookingsLoading} scroll={{ x: 1000 }} />
                  </Card>
                ),
              },
            ]}
          />

          <Modal
            title="Search Reservation & Check-in"
            open={isCheckInVisible}
            onCancel={() => setIsCheckInVisible(false)}
            footer={null}
            destroyOnHidden
          >
            <Form 
              form={checkInForm} 
              layout="vertical" 
              onFinish={handleQuickCheckIn}
              initialValues={{ date: dayjs(), is_walkin: false, guests: 2 }}
            >
              <Form.Item name="is_walkin" valuePropName="checked" style={{ marginBottom: 16 }}>
                <Checkbox>Walk-in Guest (No Reservation)</Checkbox>
              </Form.Item>

              <Form.Item 
                noStyle 
                shouldUpdate={(prev, curr) => prev.is_walkin !== curr.is_walkin}
              >
                {({ getFieldValue }) => (
                  getFieldValue('is_walkin') && (
                    <Form.Item name="name" label="Guest Name" rules={[{ required: true }]}>
                      <Input placeholder="Enter guest name" />
                    </Form.Item>
                  )
                )}
              </Form.Item>

              <Form.Item 
                name="email" 
                label="Guest Email" 
                rules={[
                  { required: true, message: 'Please input the guest email!' },
                  { type: 'email', message: 'Please enter a valid guest email!' }
                ]}
              >
                <Input placeholder="email@example.com" />
              </Form.Item>
              <Form.Item 
                name="phone" 
                label="Phone Number" 
                rules={[{ required: true, message: 'Please input the registered phone number!' }]}
              >
                <Input placeholder="Enter registered phone number" />
              </Form.Item>
              
              <Row gutter={16}>
                <Col span={8}>
                  <Form.Item name="date" label="Date" rules={[{ required: true }]}>
                    <DatePicker style={{ width: '100%' }} format="YYYY-MM-DD" />
                  </Form.Item>
                </Col>
                <Col span={8}>
                  <Form.Item name="time" label="Time" rules={[{ required: true }]}>
                    <Select options={['12:00 PM', '1:00 PM', '7:00 PM', '8:00 PM', '9:00 PM'].map(t => ({ label: t, value: t }))} />
                  </Form.Item>
                </Col>
                <Col span={8}>
                  <Form.Item name="guests" label="Guests" rules={[{ required: true }]}>
                    <InputNumber min={1} style={{ width: '100%' }} />
                  </Form.Item>
                </Col>
              </Row>

              <Form.Item style={{ textAlign: 'right', marginBottom: 0, marginTop: 16 }}>
                <Space>
                  <Button onClick={() => setIsCheckInVisible(false)}>Cancel</Button>
                  <Form.Item noStyle shouldUpdate={(prev, curr) => prev.is_walkin !== curr.is_walkin}>
                    {({ getFieldValue }) => (
                      <Button type="primary" htmlType="submit" loading={checkInLoading}>
                        {getFieldValue('is_walkin') ? 'Instant Check-in' : 'Confirm Check-in'}
                      </Button>
                    )}
                  </Form.Item>
                </Space>
              </Form.Item>
            </Form>
          </Modal>

          {/* Order Details Modal for Active Bookings */}
          <Modal
            title={`Order Details - ${selectedBooking?.name}`}
            open={isOrderModalOpen}
            onCancel={() => setIsOrderModalOpen(false)}
            footer={[
              <Button 
                  key="lock" 
                  danger={!selectedBooking?.is_locked}
                  icon={selectedBooking?.is_locked ? <Unlock size={16} /> : <Lock size={16} />} 
                  onClick={() => handleToggleLock(selectedBooking)}
                  style={{ float: 'left' }}
              >
                  {selectedBooking?.is_locked ? 'Unlock Order' : 'Lock Order'}
              </Button>,
              <Button key="close" onClick={() => setIsOrderModalOpen(false)}>Close</Button>
            ]}
            width={600}
            loading={modalLoading}
          >
            {selectedBooking && (
              <div style={{ opacity: modalLoading ? 0.5 : 1, transition: 'opacity 0.3s' }}>
                <div style={{ marginBottom: 20, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Text type="secondary">Session: <Tag color="blue">Active ({selectedBooking.time})</Tag></Text>
                  <div style={{ textAlign: 'right' }}>
                    <Text type="secondary" style={{ display: 'block', fontSize: '11px' }}>Current Total</Text>
                    <Text strong style={{ fontSize: '1.5rem', color: 'var(--green-700)' }}>₹{selectedBooking.total_amount || 0}</Text>
                  </div>
                </div>
                
                <Table 
                  dataSource={selectedBooking.dishes || []}
                  pagination={false}
                  rowKey={(record, index) => index}
                  size="small"
                  columns={[
                    { 
                      title: 'Item', 
                      dataIndex: 'name', 
                      key: 'name',
                      render: (text, record) => (
                          <Space>
                              <ChefHat size={14} />
                              {typeof record === 'string' ? record : record.name}
                          </Space>
                      )
                    },
                    { 
                      title: 'Qty', 
                      dataIndex: 'qty', 
                      key: 'qty',
                      width: 70,
                      render: (qty) => <Tag>x{qty || 1}</Tag>
                    },
                    { 
                      title: 'Price', 
                      dataIndex: 'price', 
                      key: 'price',
                      width: 100,
                      render: (price) => `₹${price || 0}`
                    },
                    {
                      title: 'Subtotal',
                      key: 'subtotal',
                      width: 120,
                      align: 'right',
                      render: (_, record) => {
                        const qty = record.qty || 1;
                        const price = record.price || 0;
                        return <Text strong>{`₹${(qty * price).toFixed(2)}`}</Text>;
                      }
                    }
                  ]}
                />
              </div>
            )}
          </Modal>

        </main>
    </div>
  );
}
