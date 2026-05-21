import { useState, useEffect } from 'react';
import Navbar from '../../components/Navbar';
import api from '../../api/client';
import { LayoutDashboard, Users, CreditCard, Leaf, TrendingUp, CalendarDays, Filter } from 'lucide-react';
import { Row, Col, Card, Statistic, Typography, Table, Tag, Select, DatePicker, Button, Space, Modal } from 'antd';
import './Admin.css';

const { Title, Text } = Typography;
const { RangePicker } = DatePicker;

export default function Dashboard() {
  const [data, setData] = useState(null);
  const [inventoryForecast, setInventoryForecast] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState('today');
  const [customRange, setCustomRange] = useState(null);

  useEffect(() => {
    if (filterType !== 'custom') {
      fetchDashboard(filterType);
    }
  }, [filterType]);

  const fetchDashboard = async (type = 'today', custom = null) => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.append('filter_type', type);
      if (type === 'custom' && custom && custom[0] && custom[1]) {
        params.append('custom_start', custom[0].format('YYYY-MM-DD'));
        params.append('custom_end', custom[1].format('YYYY-MM-DD'));
      }
      const statsRes = await api.get(`/api/admin/dashboard?${params.toString()}`);
      setData(statsRes.data);
      
      // Fetch inventory forecast separately
      const invRes = await api.get('/api/admin/inventory/forecast');
      setInventoryForecast(invRes.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleApplyCustom = () => {
    if (customRange && customRange[0] && customRange[1]) {
      fetchDashboard('custom', customRange);
    }
  };

  // We only show loading initially when there is no data at all
  if (loading && !data) return (
    <div className="layout">
      <Navbar />
      <div className="loading-center"><div className="spinner" /></div>
    </div>
  );

  const stats = data?.stats || {};
  const dailySales = data?.daily_sales || [];

  return (
    <div className="layout">
      <Navbar />
      
      <main className="main-content container admin-container">
        <div className="admin-header">
          <div className="admin-header-left">
            <Title level={2} className="admin-page-title">
              <LayoutDashboard size={24} className="admin-title-icon" />
              Dashboard Overview
            </Title>
            <p className="text-secondary">Welcome back, Admin. Here's what's happening {filterType === 'today' ? 'today' : filterType === '7days' ? 'in the last 7 days' : filterType === 'month' ? 'this month' : filterType === 'year' ? 'this year' : 'in the selected period'}.</p>
          </div>
          <div className="admin-header-actions">
            <Space wrap>
              <Select
                value={filterType}
                onChange={setFilterType}
                style={{ width: 140 }}
                options={[
                  { label: 'Today', value: 'today' },
                  { label: 'Last 7 Days', value: '7days' },
                  { label: 'Month', value: 'month' },
                  { label: 'Yearly', value: 'year' },
                  { label: 'Custom', value: 'custom' },
                ]}
              />
              {filterType === 'custom' && (
                <>
                  <RangePicker 
                    value={customRange} 
                    onChange={setCustomRange}
                    format="YYYY-MM-DD"
                  />
                  <Button type="primary" onClick={handleApplyCustom} icon={<Filter size={14} />}>
                    Apply
                  </Button>
                </>
              )}
            </Space>
          </div>
        </div>

        <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
          <Col xs={12} sm={12} md={6}>
            <Card bordered={false}>
              <Statistic 
                title={<div style={{ display:'flex', alignItems:'center', gap:8 }}><TrendingUp size={16}/> Total Revenue</div>} 
                value={stats.total_revenue} 
                precision={2}
                prefix="₹" 
                valueStyle={{ color: 'var(--green-700)', fontWeight: 600 }}
              />
            </Card>
          </Col>
          <Col xs={12} sm={12} md={6}>
            <Card bordered={false}>
              <Statistic 
                title={<div style={{ display:'flex', alignItems:'center', gap:8 }}><CreditCard size={16}/> Total Bookings</div>} 
                value={stats.total_bookings} 
              />
            </Card>
          </Col>
          <Col xs={12} sm={12} md={6}>
            <Card bordered={false}>
              <Statistic 
                title={<div style={{ display:'flex', alignItems:'center', gap:8 }}><Users size={16}/> Customers</div>} 
                value={stats.total_users} 
              />
            </Card>
          </Col>
          <Col xs={12} sm={12} md={6}>
            <Card bordered={false}>
              <Statistic 
                title={<div style={{ display:'flex', alignItems:'center', gap:8 }}><Leaf size={16}/> Waste Scans</div>} 
                value={stats.waste_submissions} 
                precision={0}
                valueStyle={{ color: 'var(--orange-600)', fontWeight: 600 }}
              />
            </Card>
          </Col>
        </Row>

        <Row gutter={[24, 24]}>
          <Col xs={24} lg={12}>
            <Card title="Revenue Trend" bordered={false} className="chart-card">
              <div style={{ opacity: loading ? 0.5 : 1, width: '100%', height: '240px', position: 'relative' }}>
                {dailySales.length > 0 ? (
                  <>
                    <svg viewBox="0 0 100 100" preserveAspectRatio="none" style={{ width: '100%', height: 'calc(100% - 30px)', overflow: 'visible' }}>
                      <defs>
                        <linearGradient id="areaGradient" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="var(--green-500)" stopOpacity="0.3" />
                          <stop offset="100%" stopColor="var(--green-500)" stopOpacity="0" />
                        </linearGradient>
                      </defs>
                      <path
                        fill="url(#areaGradient)"
                        d={`M 0,100 ${dailySales.map((d, i) => {
                          const maxRev = Math.max(...dailySales.map(day => day.revenue), 100);
                          const x = (i / Math.max(1, dailySales.length - 1)) * 100;
                          const y = maxRev > 0 ? 100 - ((d.revenue / maxRev) * 100) : 100;
                          return `L ${x},${y}`;
                        }).join(' ')} L 100,100 Z`}
                      />
                      <polyline
                        fill="none"
                        stroke="var(--green-600)"
                        strokeWidth="2.5"
                        strokeLinejoin="round"
                        vectorEffect="non-scaling-stroke"
                        points={dailySales.map((d, i) => {
                          const maxRev = Math.max(...dailySales.map(day => day.revenue), 100);
                          const x = (i / Math.max(1, dailySales.length - 1)) * 100;
                          const y = maxRev > 0 ? 100 - ((d.revenue / maxRev) * 100) : 100;
                          return `${x},${y}`;
                        }).join(' ')}
                      />
                      {dailySales.map((d, i) => {
                        const maxRev = Math.max(...dailySales.map(day => day.revenue), 100);
                        const x = (i / Math.max(1, dailySales.length - 1)) * 100;
                        const y = maxRev > 0 ? 100 - ((d.revenue / maxRev) * 100) : 100;
                        return (
                          <circle
                            key={`${d.date}-${i}`}
                            cx={x}
                            cy={y}
                            r="3"
                            vectorEffect="non-scaling-stroke"
                            fill="white"
                            stroke="var(--green-700)"
                            strokeWidth="2"
                          >
                            <title>{`₹${Number(d.revenue).toFixed(2)} on ${new Date(d.date).toLocaleDateString()}`}</title>
                          </circle>
                        );
                      })}
                    </svg>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 10, fontSize: '10px', color: 'var(--text-muted)' }}>
                      {dailySales.length > 5 ? (
                        <>
                        <span>{new Date(dailySales[0].date).toLocaleDateString(undefined, data?.is_monthwise ? { month: 'short', year: 'numeric' } : { month: 'short', day: 'numeric' })}</span>
                        <span>{new Date(dailySales[Math.floor(dailySales.length/2)].date).toLocaleDateString(undefined, data?.is_monthwise ? { month: 'short' } : { month: 'short', day: 'numeric' })}</span>
                        <span>{new Date(dailySales[dailySales.length-1].date).toLocaleDateString(undefined, data?.is_monthwise ? { month: 'short', year: 'numeric' } : { month: 'short', day: 'numeric' })}</span>
                        </>
                      ) : (
                        dailySales.map((d, i) => <span key={i}>{new Date(d.date).toLocaleDateString(undefined, data?.is_monthwise ? { month: 'short' } : { month: 'short', day: 'numeric' })}</span>)
                      )}
                    </div>
                  </>
                ) : (
                  <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%', color: 'var(--text-muted)' }}>No Analytics Available</div>
                )}
              </div>
            </Card>
          </Col>
          
          <Col xs={24} lg={12}>
            <Card title="Forecast vs Actual Sales" bordered={false} className="chart-card">
              <div style={{ opacity: loading ? 0.5 : 1, width: '100%', height: '240px' }}>
                {(data?.forecast_sales || []).length > 0 ? (
                  <div className="bar-chart" style={{ height: '200px', marginTop: '10px', display: 'flex', alignItems: 'flex-end', gap: '8px' }}>
                    {(data?.forecast_sales || []).map((d, i) => {
                      const maxVal = Math.max(...(data?.forecast_sales || []).map(day => Math.max(Number(day.revenue) || 0, Number(day.predicted_revenue) || 0)), 100);
                      const actualPct = (Number(d.revenue) / maxVal) * 100;
                      const predPct = (Number(d.predicted_revenue) / maxVal) * 100;
                      return (
                        <div key={`forecast-${d.date}-${i}`} className="bar-col" style={{ display: 'flex', flexDirection: 'column', height: '100%', flex: 1 }}>
                          <div className="bar-wrap" style={{ flex: 1, display: 'flex', alignItems: 'flex-end', gap: '2px', width: '100%', minHeight: '150px' }}>
                             <div className="bar" style={{ height: `${Math.max(predPct, 2)}%`, background: '#3b82f6', flex: 1, borderRadius: '2px 2px 0 0' }} title={`Predicted: ₹${Number(d.predicted_revenue).toFixed(2)}`}></div>
                             <div className="bar" style={{ height: `${Math.max(actualPct, 0)}%`, background: 'var(--green-500)', flex: 1, borderRadius: '2px 2px 0 0', opacity: 0.7 }} title={`Actual: ₹${Number(d.revenue).toFixed(2)}`}></div>
                          </div>
                          <span className="bar-label" style={{ marginTop: '8px', fontSize: '10px' }}>
                            {new Date(d.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%', color: 'var(--text-muted)' }}>No Forecast Data</div>
                )}
                <div style={{ display: 'flex', justifyContent: 'center', gap: '16px', fontSize: '11px', color: 'var(--text-muted)', marginTop: 12 }}>
                  <Space><div style={{ width: 8, height: 8, background: 'var(--green-500)', borderRadius: 2, opacity: 0.7 }}></div> Actual</Space>
                  <Space><div style={{ width: 8, height: 8, background: '#3b82f6', borderRadius: 2 }}></div> Forecast</Space>
                </div>
              </div>
            </Card>
          </Col>
        </Row>

      </main>
    </div>
  );
}
