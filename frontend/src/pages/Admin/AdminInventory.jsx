import { useState, useEffect } from 'react';
import Navbar from '../../components/Navbar';
import api from '../../api/client';
import { LayoutList, Filter, Plus, AlertCircle, CheckCircle2, Search } from 'lucide-react';
import { Row, Col, Card, Typography, Table, Tag, DatePicker, Button, Select, Space, message, Modal, Form, Input, InputNumber } from 'antd';
import dayjs from 'dayjs';
import './Admin.css';

const { Title, Text } = Typography;
const { RangePicker } = DatePicker;

export default function AdminInventory() {
  const [data, setData] = useState({ usage: [], additions: [], planning: [] });
  const [loading, setLoading] = useState(true);
  
  // Filters
  const [filterType, setFilterType] = useState('today');
  const [customRange, setCustomRange] = useState(null);

  // Add Item Modal
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form] = Form.useForm();

  // Fetch Logic
  const fetchInventory = async (type = filterType, custom = customRange, showLoader = true) => {
    if (showLoader) setLoading(true);
    try {
      const params = new URLSearchParams();
      params.append('filter_type', type);
      if (type === 'custom' && custom && custom[0] && custom[1]) {
        params.append('custom_start', custom[0].format('YYYY-MM-DD'));
        params.append('custom_end', custom[1].format('YYYY-MM-DD'));
      }
      const res = await api.get(`/api/admin/inventory?${params.toString()}`);
      setData(res.data || { usage: [], additions: [], planning: [] });
    } catch (err) {
      console.error(err);
      message.error('Failed to load inventory');
    } finally {
      if (showLoader) setLoading(false);
    }
  };

  useEffect(() => {
    fetchInventory();
  }, []);

  const getColumnSearchProps = (dataIndex) => ({
    filterDropdown: ({ setSelectedKeys, selectedKeys, confirm, clearFilters }) => (
      <div style={{ padding: 8 }}>
        <Input
          placeholder={`Search ${dataIndex}`}
          value={selectedKeys[0]}
          onChange={e => setSelectedKeys(e.target.value ? [e.target.value] : [])}
          onPressEnter={() => confirm()}
          style={{ marginBottom: 8, display: 'block' }}
        />
        <Space>
          <Button
            type="primary"
            onClick={() => confirm()}
            icon={<Search size={14} />}
            size="small"
            style={{ width: 90 }}
          >
            Search
          </Button>
          <Button onClick={() => clearFilters()} size="small" style={{ width: 90 }}>
            Reset
          </Button>
        </Space>
      </div>
    ),
    filterIcon: (filtered) => (
      <Search size={16} style={{ color: filtered ? '#1890ff' : undefined }} />
    ),
    onFilter: (value, record) =>
      record[dataIndex]
        ? record[dataIndex].toString().toLowerCase().includes(value.toLowerCase())
        : '',
  });

  // Handle Add Item
  const handleAddItem = async (values) => {
    setSubmitting(true);
    try {
      await api.post('/api/admin/inventory', values);
      message.success('Inventory recorded successfully');
      setIsModalVisible(false);
      form.resetFields();
      fetchInventory();
    } catch (err) {
      console.error(err);
      message.error('Failed to add inventory item');
    } finally {
      setSubmitting(false);
    }
  };

  const formatValue = (v, unit) => {
    if (unit?.toLowerCase() === 'pcs' || unit?.toLowerCase() === 'units') {
      return Math.round(v);
    }
    return v;
  };

  const additionsColumns = [
    { 
      title: 'Date', 
      dataIndex: 'date', 
      key: 'date', 
      width: 110,
      sorter: (a, b) => dayjs(a.date, 'DD-MM-YYYY').unix() - dayjs(b.date, 'DD-MM-YYYY').unix(),
    },
    { 
      title: 'Ingredient', 
      dataIndex: 'ingredient', 
      key: 'ingredient', 
      render: t => <Text strong>{t}</Text>,
      ...getColumnSearchProps('ingredient'),
      sorter: (a, b) => a.ingredient.localeCompare(b.ingredient),
    },
    { 
      title: 'Existing Stock', 
      dataIndex: 'existing', 
      key: 'existing', 
      render: (v, r) => `${formatValue(v, r.unit)} ${r.unit}`,
      sorter: (a, b) => a.existing - b.existing,
    },
    { 
      title: 'Added', 
      dataIndex: 'added', 
      key: 'added', 
      render: (v, r) => <Text style={{ color: 'var(--green-600)' }}>+{formatValue(v, r.unit)} {r.unit}</Text>,
      sorter: (a, b) => a.added - b.added,
    },
    { 
      title: 'Total', 
      dataIndex: 'total', 
      key: 'total', 
      render: (v, r) => <Text strong>{formatValue(v, r.unit)} {r.unit}</Text>,
      sorter: (a, b) => a.total - b.total,
    },
  ];

  const usageColumns = [
    { 
      title: 'Date', 
      dataIndex: 'date', 
      key: 'date', 
      width: 110,
      sorter: (a, b) => dayjs(a.date, 'DD-MM-YYYY').unix() - dayjs(b.date, 'DD-MM-YYYY').unix(),
    },
    { 
      title: 'Ingredient', 
      dataIndex: 'ingredient', 
      key: 'ingredient', 
      render: t => <Text strong>{t}</Text>,
      ...getColumnSearchProps('ingredient'),
      sorter: (a, b) => a.ingredient.localeCompare(b.ingredient),
    },
    { 
      title: 'Stock Available', 
      dataIndex: 'stock', 
      key: 'stock', 
      render: (v, r) => `${formatValue(v, r.unit)} ${r.unit}`,
      sorter: (a, b) => a.stock - b.stock,
    },
    { 
      title: 'Used', 
      dataIndex: 'used', 
      key: 'used', 
      render: (v, r) => <Text type="danger">{formatValue(v, r.unit)} {r.unit}</Text>,
      sorter: (a, b) => a.used - b.used,
    },
    { 
      title: 'Balance Stock', 
      dataIndex: 'balance_stock', 
      key: 'balance_stock', 
      render: (v, r) => <Text strong style={{ color: 'var(--green-700)' }}>{formatValue(v, r.unit)} {r.unit}</Text>,
      sorter: (a, b) => a.balance_stock - b.balance_stock,
    },
  ];

  const planningColumns = [
    { 
      title: 'Ingredient', 
      dataIndex: 'ingredient', 
      key: 'ingredient', 
      render: t => <Text strong>{t}</Text>,
      ...getColumnSearchProps('ingredient'),
      sorter: (a, b) => a.ingredient.localeCompare(b.ingredient),
    },
    { 
      title: 'Current Stock', 
      dataIndex: 'stock', 
      key: 'stock', 
      render: (v, r) => <Text strong>{formatValue(v, r.unit)} {r.unit}</Text>,
      sorter: (a, b) => a.stock - b.stock,
    },
    { 
      title: 'Next 3 Days Required', 
      dataIndex: 'required_3d', 
      key: 'required_3d', 
      render: (v, r) => <Tag color="blue">{formatValue(v, r.unit)} {r.unit}</Tag>,
      sorter: (a, b) => a.required_3d - b.required_3d,
    },
    { 
      title: 'Status', 
      dataIndex: 'status', 
      key: 'status',
      filters: [
        { text: 'Critical', value: 'critical' },
        { text: 'Shortage', value: 'shortage' },
        { text: 'Sufficient', value: 'sufficient' },
      ],
      onFilter: (value, record) => record.status === value,
      sorter: (a, b) => {
        const priority = { 'critical': 0, 'shortage': 1, 'sufficient': 2 };
        return (priority[a.status] ?? 3) - (priority[b.status] ?? 3);
      },
      render: (s) => (
        <Tag color={s === 'critical' ? 'red' : s === 'shortage' ? 'orange' : 'green'} icon={s !== 'sufficient' ? <AlertCircle size={14} /> : <CheckCircle2 size={14}/>}>
          {s.toUpperCase()}
        </Tag>
      )
    },
  ];

  return (
    <div className="layout">
      <Navbar />
      
      <main className="main-content container admin-container">
        <div className="admin-header">
          <div className="admin-header-left">
            <Title level={2} className="admin-page-title">
              <LayoutList size={24} className="admin-title-icon" />
              Inventory Management
            </Title>
            <p className="text-secondary">Comprehensive tracking for usage and procurement planning.</p>
          </div>
          <div className="admin-header-actions">
            <Button type="primary" icon={<Plus size={16} />} onClick={() => setIsModalVisible(true)} block>
              Add Daily Usage / Inventory
            </Button>
          </div>
        </div>

        <Row gutter={[24, 24]}>
          <Col xs={24} lg={13}>
            <Space direction="vertical" size={24} style={{ width: '100%' }}>
              <Card title="Today's Inventory Added" bordered={false} styles={{ body: { padding: 0 } }}>
                <Table 
                   columns={additionsColumns} 
                   dataSource={data.additions} 
                   loading={loading} 
                   pagination={false} 
                   size="middle"
                   scroll={{ x: 600 }}
                   locale={{ emptyText: 'No stock added today' }}
                />
              </Card>

              <Card title="Today's Inventory Usage" bordered={false} styles={{ body: { padding: 0 } }}>
                <Table 
                   columns={usageColumns} 
                   dataSource={data.usage} 
                   loading={loading} 
                   pagination={false} 
                   size="middle"
                   scroll={{ x: 600 }}
                   locale={{ emptyText: 'No usage recorded today' }}
                />
              </Card>
            </Space>
          </Col>
          
          <Col xs={24} lg={11}>
            <Card title="3-Day Planning & Status" bordered={false} styles={{ body: { padding: 0 } }}>
              <Table 
                 columns={planningColumns} 
                 dataSource={data.planning} 
                 loading={loading} 
                 pagination={false} 
                 size="middle"
                 scroll={{ x: 500 }}
              />
            </Card>
          </Col>
        </Row>

        <Modal
          title="Record Daily Usage / New Stock"
          open={isModalVisible}
          onCancel={() => setIsModalVisible(false)}
          footer={null}
          destroyOnClose
        >
          <Form
            form={form}
            layout="vertical"
            onFinish={handleAddItem}
            initialValues={{ threshold: 10, unit: 'kg', used: 0 }}
          >
            <Form.Item name="ingredient" label="Ingredient Name" rules={[{ required: true }]}>
              <Input placeholder="e.g. Tomatoes" />
            </Form.Item>

            <Row gutter={16}>
              <Col span={12}>
                <Form.Item name="stock" label="Stock Available" rules={[{ required: true }]}>
                  <InputNumber style={{ width: '100%' }} min={0} />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item name="used" label="Already Used Today">
                  <InputNumber style={{ width: '100%' }} min={0} />
                </Form.Item>
              </Col>
            </Row>

            <Row gutter={16}>
              <Col span={12}>
                <Form.Item name="unit" label="Unit" rules={[{ required: true }]}>
                  <Select options={[
                    { value: 'kg', label: 'kg' }, { value: 'L', label: 'L' }, { value: 'units', label: 'units' }
                  ]} />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item name="threshold" label="Min Threshold" rules={[{ required: true }]}>
                  <InputNumber style={{ width: '100%' }} min={0} />
                </Form.Item>
              </Col>
            </Row>

            <Form.Item style={{ marginBottom: 0, textAlign: 'right', marginTop: 16 }}>
              <Space>
                <Button onClick={() => setIsModalVisible(false)}>Cancel</Button>
                <Button type="primary" htmlType="submit" loading={submitting}>Save Record</Button>
              </Space>
            </Form.Item>
          </Form>
        </Modal>

      </main>
    </div>
  );
}
