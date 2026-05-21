import { useState, useEffect } from 'react';
import Navbar from '../../components/Navbar';
import dayjs from 'dayjs';
import api, { BASE_URL } from '../../api/client';
import { Award, Ticket, LeafyGreen, RotateCcw, UploadCloud, Coins, ReceiptText, ChefHat } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { Row, Col, Card, Typography, Upload, Button, message, Tag, List, Statistic, Space, Modal, Table, Divider, Input } from 'antd';
import './Rewards.css';

const { Title, Paragraph, Text } = Typography;
const { Dragger } = Upload;

export default function Rewards() {
  const { user, refreshUser } = useAuth();
  const [coupons, setCoupons] = useState([]);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploadLoading, setUploadLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [billModalOpen, setBillModalOpen] = useState(false);
  const [selectedBill, setSelectedBill] = useState(null);
  const [billLoading, setBillLoading] = useState(false);
  const [activeBooking, setActiveBooking] = useState(null);
  const [payMode, setPayMode] = useState(false);
  const [couponCode, setCouponCode] = useState("");
  const [payLoading, setPayLoading] = useState(false);
  const [couponLoading, setCouponLoading] = useState(false);
  const [bookingScanDone, setBookingScanDone] = useState(false);
  const [lastScanResult, setLastScanResult] = useState(null); // persisted scan result for current booking

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [cRes, hRes, bRes] = await Promise.all([
        api.get('/api/user/coupons'),
        api.get('/api/user/waste-history'),
        api.get('/api/user/bookings')
      ]);
      setCoupons(cRes.data);
      setHistory(hRes.data);
      
      const today = dayjs().format('YYYY-MM-DD');
      const tomorrow = dayjs().add(1, 'day').format('YYYY-MM-DD');
      const yesterday = dayjs().subtract(1, 'day').format('YYYY-MM-DD');

      const allBookings = bRes.data || [];
      const active = allBookings.find(b => b.status === 'active');
      const potentialBookings = allBookings.filter(b => 
        (b.date === today || b.date === tomorrow || b.date === yesterday) && 
        b.status !== 'cancelled' && b.status !== 'past'
      );

      const current = active || potentialBookings[0];
      
      setActiveBooking(current);

      // Check if a waste scan already exists for this booking
      if (current) {
        const existingScan = (hRes.data || []).find(
          item => item.booking_id && item.booking_id === current._id
        );
        const alreadyScanned = !!existingScan;
        setBookingScanDone(alreadyScanned);
        // If scan done, load persisted result from history so the image stays visible
        if (alreadyScanned && existingScan) {
          setLastScanResult({
            image_url: existingScan.image_url || null,
            waste_percentage: existingScan.waste_percentage != null
              ? (existingScan.waste_percentage <= 1
                  ? parseFloat((existingScan.waste_percentage * 100).toFixed(1))
                  : parseFloat(existingScan.waste_percentage))
              : 0,
            points_earned: existingScan.points_earned || 0,
            message: existingScan.message || 'Your plate scan result is shown below.',
            coupon_generated: existingScan.coupon_generated || false,
            reward: existingScan.reward || null,
          });
        }
      } else {
        setBookingScanDone(false);
        setLastScanResult(null);
      }
      
      if (refreshUser) await refreshUser();
    } catch (err) {
      console.error(err);
      message.error("Failed to load rewards data");
    } finally {
      setLoading(false);
    }
  };

  const handleShowBill = async (bookingId) => {
    if (!bookingId) return;
    setBillLoading(true);
    setBillModalOpen(true);
    try {
      const res = await api.get(`/api/user/bookings/${bookingId}`);
      setSelectedBill(res.data);
    } catch (err) {
      console.error(err);
      message.error("Failed to load bill details");
      setBillModalOpen(false);
    } finally {
      setBillLoading(false);
    }
  };

  const handleRequestCurrentBill = async () => {
    if (!activeBooking) return;
    setBillLoading(true);
    try {
        await api.patch(`/api/user/bookings/${activeBooking._id}/request-bill`);
        message.success("Bill requested! You can now scan your plate to earn rewards.");
        fetchData(); // Refresh statuses and fetch detailed bill for inline view
    } catch (err) {
        message.error("Failed to request bill");
    } finally {
        setBillLoading(false);
    }
  };

  const handleApplyCouponToBill = async () => {
    if (!activeBooking || !couponCode) return;
    setCouponLoading(true);
    try {
        const res = await api.patch(`/api/user/bookings/${activeBooking._id}/apply-coupon`, {
            coupon_code: couponCode
        });
        message.success(res.data.message);
        setCouponCode("");
        fetchData();
    } catch (err) {
        message.error(err.response?.data?.detail || "Failed to apply coupon");
    } finally {
        setCouponLoading(false);
    }
  };

  const handleProcessPayment = async () => {
    if (!activeBooking) return;
    setPayLoading(true);
    try {
        await api.patch(`/api/user/bookings/${activeBooking._id}/pay`);
        message.success("Payment confirmed! Hope you had a wonderful meal.");
        setPayMode(false);
        fetchData();
    } catch (err) {
        message.error("Payment failed");
    } finally {
        setPayLoading(false);
    }
  };

  const renderBillContent = (bill, isInline = false) => {
    if (!bill) return null;
    const isPaid = bill.bill_status === 'paid';
    
    return (
      <div className="bill-container">
        {payMode && isInline ? (
            <div className="payment-flow-container animate-in">
                <div style={{ textAlign: 'center', marginBottom: 24 }}>
                    <Title level={4}>Final Checkout</Title>
                    <Text type="secondary">Apply your rewards and pay securely</Text>
                </div>

                {!bill.discount_applied && (
                    <div style={{ marginBottom: 24 }}>
                        <Text strong style={{ display: 'block', marginBottom: 8 }}>Have a coupon code?</Text>
                        <Space.Compact style={{ width: '100%' }}>
                            <Input 
                                placeholder="Enter coupon code (e.g. SAVEFOOD_...)" 
                                value={couponCode}
                                onChange={(e) => setCouponCode(e.target.value)}
                            />
                            <Button type="primary" onClick={handleApplyCouponToBill} loading={couponLoading}>Apply</Button>
                        </Space.Compact>
                    </div>
                )}

                <div style={{ background: 'var(--beige-50)', padding: 20, borderRadius: 12, border: '1px solid var(--beige-200)', marginBottom: 24, textAlign: 'center' }}>
                    <Text type="secondary">Amount to Pay</Text>
                    <Title level={2} style={{ margin: '4px 0', color: 'var(--green-700)' }}>₹{bill.total_amount?.toFixed(2)}</Title>
                    {bill.discount_applied > 0 && <Tag color="green">Discount Applied: ₹{bill.discount_applied.toFixed(2)}</Tag>}
                </div>

                <div style={{ textAlign: 'center', marginBottom: 24 }}>
                    <Text strong style={{ display: 'block', marginBottom: 16 }}>Scan to Pay via UPI</Text>
                    <div style={{ 
                        background: 'white', 
                        padding: 16, 
                        display: 'inline-block', 
                        borderRadius: 12, 
                        border: '1px solid var(--beige-200)',
                        boxShadow: '0 4px 12px rgba(0,0,0,0.05)'
                    }}>
                        <img 
                            src={`https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=upi://pay?pa=veora@upi%26pn=VeoraFineDining%26am=${bill.total_amount}%26cu=INR`} 
                            alt="Payment QR"
                            style={{ width: 180, height: 180 }}
                        />
                    </div>
                    <div style={{ marginTop: 12 }}>
                        <Text type="secondary" style={{ fontSize: '0.8rem' }}>Accepted: GPay, PhonePe, Paytm, etc.</Text>
                    </div>
                </div>

                <Space direction="vertical" style={{ width: '100%' }}>
                    <Button type="primary" size="large" block onClick={handleProcessPayment} loading={payLoading}>
                        Confirm Payment
                    </Button>
                    <Button type="text" block onClick={() => setPayMode(false)}>Back to Bill</Button>
                </Space>
            </div>
        ) : (
            <>
                <div style={{ marginBottom: 20, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
                <div>
                    <Text type="secondary" style={{ display: 'block' }}>Date & Time</Text>
                    <Text strong>{dayjs(bill.date).format('MMMM D, YYYY')} at {bill.time}</Text>
                </div>
                <div style={{ textAlign: 'right' }}>
                    <Text type="secondary" style={{ display: 'block' }}>Booking ID</Text>
                    <Text style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{bill._id}</Text>
                </div>
                </div>

                <Divider style={{ margin: '12px 0' }} />

                <Table 
                dataSource={bill.dishes || []}
                pagination={false}
                rowKey={(record, index) => index}
                size="small"
                columns={[
                    { 
                    title: 'Dish', 
                    dataIndex: 'name', 
                    key: 'name',
                    render: (text) => (
                        <Space>
                        <ChefHat size={14} />
                        {text}
                        </Space>
                    )
                    },
                    { 
                    title: 'Qty', 
                    dataIndex: 'qty', 
                    key: 'qty',
                    width: 60,
                    render: (qty) => <Text>x{qty || 1}</Text>
                    },
                    { 
                    title: 'Price', 
                    dataIndex: 'price', 
                    key: 'price',
                    width: 90,
                    render: (price) => `₹${price || 0}`
                    },
                    {
                    title: 'Total',
                    key: 'total',
                    width: 100,
                    align: 'right',
                    render: (_, record) => `₹${((record.qty || 1) * (record.price || 0)).toFixed(2)}`
                    }
                ]}
                />

                <div style={{ marginTop: 24, padding: '16px', borderRadius: 12, background: 'var(--beige-50)', border: '1px solid var(--beige-100)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                    <Text type="secondary">Subtotal</Text>
                    <Text strong>₹{(bill.total_amount + (bill.discount_applied || 0)).toFixed(2)}</Text>
                </div>
                {bill.discount_applied > 0 && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                    <Text type="secondary">Discount Applied</Text>
                    <Text type="danger" strong>-₹{bill.discount_applied.toFixed(2)}</Text>
                    </div>
                )}
                <Divider style={{ margin: '12px 0' }} />
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Title level={4} style={{ margin: 0 }}>Total Amount</Title>
                    <Title level={3} style={{ margin: 0, color: 'var(--green-700)' }}>₹{bill.total_amount?.toFixed(2)}</Title>
                </div>
                </div>
                
                {isInline && !isPaid && (
                    <Button 
                        type="primary" 
                        size="large" 
                        block 
                        style={{ marginTop: 20, height: 48, fontWeight: 600, background: 'var(--green-700)' }}
                        onClick={() => setPayMode(true)}
                    >
                        Pay Now
                    </Button>
                )}

                {isPaid && (
                    <div style={{ marginTop: 20, textAlign: 'center', padding: 12, background: '#f6ffed', border: '1px solid #b7eb8f', borderRadius: 8 }}>
                        <Text strong style={{ color: '#52c41a' }}>PAID</Text>
                    </div>
                )}

                <div style={{ marginTop: 16, textAlign: 'center' }}>
                <Text type="secondary" italic style={{ fontSize: '0.8rem' }}>
                    Thank you for dining sustainably with Veora!
                </Text>
                </div>
            </>
        )}
      </div>
    );
  };

  const draggerProps = {
    name: 'image',
    multiple: false,
    showUploadList: false,
    customRequest: async (options) => {
      const { file, onSuccess, onError } = options;
      setUploadLoading(true);
      const formData = new FormData();
      formData.append('image', file);

      try {
        const res = await api.post('/api/user/upload-waste', formData);
        setResult(res.data);
        if (res.data.coupon_generated) {
           message.success(`Incredible! You reached 500 points and earned a new coupon!`);
        } else {
           message.success(`Analysis complete! You earned ${res.data.points_earned} points!`);
        }
        await fetchData();
        onSuccess("ok");
      } catch (err) {
        message.error(err.response?.data?.detail || 'Upload failed');
        onError(err);
      } finally {
        setUploadLoading(false);
      }
    },
    beforeUpload: (file) => {
      const isJpgOrPng = file.type === 'image/jpeg' || file.type === 'image/png';
      if (!isJpgOrPng) message.error('You can only upload JPG/PNG file!');
      return isJpgOrPng || Upload.LIST_IGNORE;
    }
  };

  return (
    <div className="layout">
      <Navbar />
      
      <main className="main-content container" style={{ paddingTop: '48px' }}>
        <Row gutter={[24, 24]}>
          <Col xs={24} md={16}>
            {activeBooking && (activeBooking.bill_status === 'none' || !activeBooking.bill_status) && (
              <Card 
                bordered={false} 
                style={{ 
                  marginBottom: 24, 
                  background: 'var(--green-50)', 
                  border: '1px solid var(--green-100)',
                  borderRadius: 16 
                }}
              >
                <Row align="middle" gutter={16}>
                  <Col flex="1">
                    <Title level={4} style={{ margin: 0, color: 'var(--green-800)' }}>Ready to finish your meal?</Title>
                    <Text type="secondary">Request your bill and start earning sustainability rewards.</Text>
                  </Col>
                  <Col>
                    <Button 
                      type="primary" 
                      size="large" 
                      icon={<ReceiptText size={18} />}
                      onClick={handleRequestCurrentBill}
                      loading={billLoading}
                    >
                      Request Bill
                    </Button>
                  </Col>
                </Row>
              </Card>
            )}

            {activeBooking && (activeBooking.bill_status === 'order_requested' || activeBooking.bill_status === 'paid') && (
              <Card 
                bordered={false} 
                className="animate-in"
                title={
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontFamily: 'Playfair Display', fontSize: 20 }}>
                    <ReceiptText size={20} color="var(--green-600)" />
                    Your Current Bill
                  </div>
                }
                style={{ marginBottom: 24, borderRadius: 16 }}
              >
                {renderBillContent(activeBooking, true)}
              </Card>
            )}

            {(!activeBooking || activeBooking.bill_status === 'order_requested') && (
              <div className="animate-in">
                <Title level={2} style={{ fontFamily: 'Playfair Display' }}>Earn Rewards</Title>
                <Paragraph>
                  Upload a clear photo of your finished plate. Our AI will analyze the remaining food. 
                  The less waste we detect, the more reward points you earn!
                </Paragraph>

                <Card bordered={false} className="upload-card">
                  {/* Show result if just scanned OR if already scanned (persisted from history) */}
                  {(result || (bookingScanDone && lastScanResult)) ? (
                    <div className="analysis-result-container" style={{ padding: '1rem 0' }}>
                      {bookingScanDone && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16, background: 'var(--green-50)', padding: '10px 16px', borderRadius: 10, border: '1px solid var(--green-100)' }}>
                          <LeafyGreen size={18} color="var(--green-600)" />
                          <Text style={{ color: 'var(--green-700)', fontWeight: 600 }}>Scan submitted — result visible until your order is completed.</Text>
                        </div>
                      )}
                      <Row gutter={[32, 32]} align="middle">
                        <Col xs={24} md={10}>
                          <div className="result-image-wrapper" style={{ borderRadius: '12px', overflow: 'hidden', boxShadow: '0 4px 20px rgba(0,0,0,0.08)', border: '1px solid var(--beige-200)' }}>
                            {(() => {
                              const displayResult = result || lastScanResult;
                              return displayResult?.image_url ? (
                                <img 
                                  src={`${BASE_URL}${displayResult.image_url}`} 
                                  alt="Analyzed Plate" 
                                  crossOrigin="anonymous"
                                  style={{ width: '100%', height: 'auto', display: 'block' }} 
                                />
                              ) : (
                                <div style={{ width: '100%', height: 200, background: 'var(--beige-100)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                  <LeafyGreen size={48} color="var(--beige-400)" />
                                </div>
                              );
                            })()}
                          </div>
                        </Col>
                        <Col xs={24} md={14} style={{ textAlign: 'left' }}>
                          {(() => {
                            const displayResult = result || lastScanResult;
                            return (
                              <Space direction="vertical" size="small" style={{ width: '100%' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
                                  <Award size={32} color="var(--orange-500)" />
                                  <Title level={3} style={{ margin: 0 }}>Analysis Complete</Title>
                                </div>
                                <Paragraph style={{ fontSize: '1.1rem', color: 'var(--text-secondary)' }}>{displayResult.message}</Paragraph>
                                
                                <div style={{ background: 'var(--beige-50)', padding: '20px', borderRadius: '12px', marginTop: '16px', border: '1px solid var(--beige-100)' }}>
                                  <Row gutter={24}>
                                    <Col span={12}>
                                      <Statistic title="Waste Detected" value={`${displayResult.waste_percentage}%`} valueStyle={{ fontWeight: '700' }} />
                                    </Col>
                                    <Col span={12}>
                                      <Statistic title="Points Earned" value={`+${displayResult.points_earned}`} valueStyle={{ color: 'var(--green-600)', fontWeight: '700' }} />
                                    </Col>
                                  </Row>
                                </div>

                                {displayResult.coupon_generated && displayResult.reward && (
                                  <div style={{ marginTop: '20px', padding: '16px', background: 'linear-gradient(135deg, #fff9f0 0%, #fff1e0 100%)', borderRadius: '12px', border: '1px dashed var(--orange-300)' }}>
                                    <Statistic 
                                      title="New Coupon Unlocked!" 
                                      value={displayResult.reward.code} 
                                      valueStyle={{ fontFamily: 'monospace', fontWeight: 'bold', color: 'var(--orange-600)', fontSize: '1.5rem' }} 
                                    />
                                    <Text type="secondary" style={{ fontSize: '0.8rem' }}>Save {displayResult.reward.discount} on your next visit!</Text>
                                  </div>
                                )}
                              </Space>
                            );
                          })()}
                        </Col>
                      </Row>
                    </div>
                  ) : (
                    <Dragger {...draggerProps} disabled={uploadLoading}>
                      <p className="ant-upload-drag-icon">
                        <UploadCloud size={48} color="var(--green-600)" />
                      </p>
                      <Title level={4}>Click or drag image to this area</Title>
                      <Paragraph type="secondary">Support sustainability. Upload a picture of your finished meal.</Paragraph>
                      <Button type="primary" loading={uploadLoading} style={{ marginTop: 16 }}>
                        Analyze Plate
                      </Button>
                    </Dragger>
                  )}
                </Card>
              </div>
            )}

            <Title level={3} style={{ fontFamily: 'Playfair Display', marginTop: 40 }}>Waste History</Title>
            <Card bordered={false} bodyStyle={{ padding: 0 }}>
              <List
                loading={loading}
                dataSource={history}
                renderItem={item => (
                  <List.Item style={{ padding: '16px 24px' }}>
                    <List.Item.Meta
                      avatar={<LeafyGreen size={24} color={item.waste_percentage < 0.15 ? 'var(--green-600)' : 'var(--orange-500)'} />}
                      title={<Text strong>Waste: {(item.waste_percentage * 100).toFixed(1)}%</Text>}
                      description={new Date(item.timestamp).toLocaleDateString()}
                    />
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <Tag color="green">+{item.points_earned} pts</Tag>
                      {item.booking_id && (
                        <Button 
                          size="small" 
                          icon={<ReceiptText size={14} />} 
                          onClick={() => handleShowBill(item.booking_id)}
                          style={{ fontSize: '0.75rem' }}
                        >
                          Show Bill
                        </Button>
                      )}
                    </div>
                  </List.Item>
                )}
              />
            </Card>
          </Col>

          <Col xs={24} md={8}>
            <Card bordered={false} className="points-highlight-card" style={{ marginBottom: 24, background: 'linear-gradient(135deg, var(--beige-100) 0%, var(--beige-200) 100%)', borderRadius: ' var(--radius-lg)' }}>
              <Statistic 
                title={<Text strong style={{ color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', fontSize: '0.75rem' }}>Your Total Reward Points</Text>}
                value={user?.total_points || 0} 
                prefix={<Coins size={28} color="var(--orange-500)" style={{ marginRight: 8 }} />}
                valueStyle={{ color: 'var(--green-700)', fontWeight: '800', fontSize: '2.5rem', fontFamily: 'Playfair Display' }}
              />
              <Paragraph type="secondary" style={{ fontSize: '0.8rem', marginTop: 8, marginBottom: 0 }}>
                Eat sustainably to earn more!
              </Paragraph>
            </Card>
            
            <Title level={3} style={{ fontFamily: 'Playfair Display' }}>My Coupons</Title>
            {loading ? (
              <div className="loading-center"><div className="spinner" /></div>
            ) : coupons.length === 0 ? (
              <Card bordered={false} style={{ textAlign: 'center', padding: '20px' }}>
                <Ticket size={32} color="var(--text-muted)" style={{ marginBottom: 16 }} />
                <Paragraph type="secondary">No active coupons yet. Go ahead and scan a plate!</Paragraph>
              </Card>
            ) : (
              <div className="coupons-grid">
                {coupons.map(c => (
                  <Card key={c._id} bordered style={{ marginBottom: 16, borderColor: c.status === 'used' ? 'var(--beige-200)' : 'var(--green-200)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Text strong style={{ fontSize: '1.2rem', color: c.status === 'used' ? 'var(--text-muted)' : 'var(--green-700)' }}>
                        Save {c.discount_value}%
                      </Text>
                      {c.status === 'active' ? <Tag color="green">Active</Tag> : <Tag>Used</Tag>}
                    </div>
                    <Paragraph copyable style={{ margin: '8px 0', fontFamily: 'monospace', background: 'var(--beige-50)', padding: '4px 8px', borderRadius: 4, display: 'inline-block' }}>
                      {c.code}
                    </Paragraph>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
                      <Text type="secondary" style={{ fontSize: '0.7rem' }}>
                        Earned: {new Date(c.created_at).toLocaleDateString()}
                      </Text>
                      {c.expiry_date && (
                        <Text type="danger" style={{ fontSize: '0.7rem' }}>
                          Expires: {new Date(c.expiry_date).toLocaleDateString()}
                        </Text>
                      )}
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </Col>
        </Row>
      </main>

      <Modal
        title={
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontFamily: 'Playfair Display', fontSize: 24, margin: '8px 0' }}>
            <ReceiptText size={24} color="var(--green-600)" />
            Order Bill Details
          </div>
        }
        open={billModalOpen}
        onCancel={() => setBillModalOpen(false)}
        footer={[
          <Button key="close" type="primary" onClick={() => setBillModalOpen(false)}>
            Close
          </Button>
        ]}
        width={600}
        loading={billLoading}
      >
        {renderBillContent(selectedBill) || (
          <div style={{ padding: '40px 0', textAlign: 'center' }}>
            <RotateCcw className="spinner" size={24} style={{ marginBottom: 16 }} />
            <Paragraph>Fetching your bill details...</Paragraph>
          </div>
        )}
      </Modal>
    </div>
  );
}
