import { useState, useEffect } from 'react';
import Navbar from '../../components/Navbar';
import api, { BASE_URL } from '../../api/client';
import { Settings2, Plus, Trash2, Edit } from 'lucide-react';
import { Row, Col, Card, Typography, Table, Tag, Button, Modal, Form, Input, InputNumber, Switch, message, Popconfirm } from 'antd';
import './Admin.css';

const { Title } = Typography;

export default function AdminMenu() {
  const [menu, setMenu] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [form] = Form.useForm();

  useEffect(() => {
    fetchMenu();
  }, []);

  const fetchMenu = async () => {
    try {
      const res = await api.get('/api/admin/menu');
      setMenu(res.data);
    } catch (err) {
      console.error(err);
      message.error("Failed to load menu");
    } finally {
      setLoading(false);
    }
  };

  const handleSaveItem = async (values) => {
    try {
      if (editingItem) {
        await api.patch(`/api/admin/menu/${editingItem.id}`, values);
        message.success('Item updated');
      } else {
        await api.post('/api/admin/menu', values);
        message.success('Item added');
      }
      setModalOpen(false);
      fetchMenu();
    } catch (err) {
      message.error('Operation failed');
    }
  };

  const handleDelete = async (id) => {
    try {
      await api.delete(`/api/admin/menu/${id}`);
      message.success('Item deleted');
      fetchMenu();
    } catch (err) {
      message.error('Delete failed');
    }
  };

  const openAddModal = () => {
    setEditingItem(null);
    form.resetFields();
    form.setFieldsValue({ available: true, price: 0 });
    setModalOpen(true);
  };

  const openEditModal = (item) => {
    setEditingItem(item);
    form.setFieldsValue(item);
    setModalOpen(true);
  };

  const columns = [
    {
      title: 'Item Name',
      key: 'name',
      filterSearch: true,
      filters: [...new Set(menu.map(m => m.name))].map(n => ({ text: n, value: n })),
      onFilter: (value, record) => record.name.includes(value),
      render: (_, record) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {record.image_url ? (
            <img src={record.image_url.startsWith('http') ? record.image_url : `${BASE_URL}${record.image_url}`} alt="" style={{ width: 40, height: 40, borderRadius: 8, objectFit: 'cover' }} />
          ) : (
            <div style={{ width: 40, height: 40, borderRadius: 8, background: 'var(--beige-200)' }} />
          )}
          <div>
            <div style={{ fontWeight: 600 }}>{record.name}</div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{record.category}</div>
          </div>
        </div>
      )
    },
    {
       title: 'Category',
       dataIndex: 'category',
       key: 'category',
       filters: [...new Set(menu.map(m => m.category))].filter(Boolean).map(c => ({ text: c, value: c })),
       onFilter: (value, record) => record.category === value,
    },
    {
      title: 'Price',
      dataIndex: 'price',
      key: 'price',
      sorter: (a, b) => a.price - b.price,
      render: val => `₹${val}`
    },
    {
      title: 'Status',
      key: 'available',
      render: (_, record) => record.available ? <Tag color="green">Available</Tag> : <Tag color="red">Sold Out</Tag>
    },
    {
      title: 'Actions',
      key: 'actions',
      render: (_, record) => (
        <div style={{ display: 'flex', gap: 8 }}>
          <Button type="text" size="small" icon={<Edit size={16} />} onClick={() => openEditModal(record)} />
          <Popconfirm title="Delete this item?" onConfirm={() => handleDelete(record.id)}>
            <Button type="text" size="small" danger icon={<Trash2 size={16} />} />
          </Popconfirm>
        </div>
      )
    }
  ];

  return (
    <div className="layout">
      <Navbar />
      
      <main className="main-content container admin-container">
        <div className="admin-header">
          <div className="admin-header-left">
            <Title level={2} className="admin-page-title">
              <Settings2 size={24} className="admin-title-icon" />
              Menu Management
            </Title>
            <p className="text-secondary">Add, edit, or remove items from the digital menu.</p>
          </div>
          <div className="admin-header-actions">
            <Button type="primary" icon={<Plus size={18} />} onClick={openAddModal} block>
              Add New Item
            </Button>
          </div>
        </div>

        <Card bordered={false} styles={{ body: { padding: 0 } }}>
          <Table 
            columns={columns} 
            dataSource={menu} 
            rowKey="id" 
            loading={loading}
            pagination={{ pageSize: 15 }}
            scroll={{ x: 800 }}
          />
        </Card>
      </main>

      <Modal
        title={editingItem ? "Edit Menu Item" : "Add Menu Item"}
        open={modalOpen}
        onCancel={() => setModalOpen(false)}
        footer={null}
      >
        <Form form={form} layout="vertical" onFinish={handleSaveItem}>
          <Form.Item name="name" label="Item Name" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="price" label="Price (₹)" rules={[{ required: true }]}>
                <InputNumber style={{ width: '100%' }} min={0} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="category" label="Category" rules={[{ required: true }]}>
                <Input placeholder="e.g. Starters" />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item name="description" label="Description">
            <Input.TextArea rows={3} />
          </Form.Item>

          <Form.Item name="image_url" label="Image URL">
            <Input />
          </Form.Item>

          <Form.Item name="food_type" label="Dietary Preference">
            <Input placeholder="Veg / Non-Veg" />
          </Form.Item>

          <Form.Item name="available" label="Available" valuePropName="checked">
            <Switch />
          </Form.Item>

          <Form.Item style={{ marginBottom: 0, textAlign: 'right' }}>
            <Button onClick={() => setModalOpen(false)} style={{ marginRight: 8 }}>Cancel</Button>
            <Button type="primary" htmlType="submit">Save Item</Button>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
