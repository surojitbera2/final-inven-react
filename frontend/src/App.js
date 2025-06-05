import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useForm } from 'react-hook-form';
import toast, { Toaster } from 'react-hot-toast';
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend, ArcElement } from 'chart.js';
import { Bar, Doughnut } from 'react-chartjs-2';
import './App.css';

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend, ArcElement);

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

// Set up axios defaults
axios.defaults.headers.common['Authorization'] = localStorage.getItem('token') ? `Bearer ${localStorage.getItem('token')}` : '';

// Auth Context
const AuthContext = React.createContext();

const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('token');
    const userData = localStorage.getItem('user');
    
    if (token && userData) {
      setUser(JSON.parse(userData));
      axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    }
    setLoading(false);
  }, []);

  const login = async (username, password) => {
    try {
      const response = await axios.post(`${API}/login`, { username, password });
      const { access_token, user: userData } = response.data;
      
      localStorage.setItem('token', access_token);
      localStorage.setItem('user', JSON.stringify(userData));
      axios.defaults.headers.common['Authorization'] = `Bearer ${access_token}`;
      
      setUser(userData);
      toast.success('Login successful!');
      return true;
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Login failed');
      return false;
    }
  };

  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    delete axios.defaults.headers.common['Authorization'];
    setUser(null);
    toast.success('Logged out successfully');
  };

  return (
    <AuthContext.Provider value={{ user, login, logout, loading }}>
      {children}
    </AuthContext.Provider>
  );
};

const useAuth = () => React.useContext(AuthContext);

// Login Component
const Login = () => {
  const { register, handleSubmit, formState: { errors } } = useForm();
  const { login } = useAuth();
  const navigate = useNavigate();

  const onSubmit = async (data) => {
    const success = await login(data.username, data.password);
    if (success) {
      navigate('/dashboard');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-900 to-purple-900 flex items-center justify-center">
      <div className="bg-white p-8 rounded-lg shadow-2xl w-96">
        <div className="text-center mb-6">
          <h1 className="text-3xl font-bold text-gray-800 mb-2">ABC Pvt Ltd</h1>
          <p className="text-gray-600">Inventory Management System</p>
        </div>
        
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div>
            <input
              {...register('username', { required: 'Username is required' })}
              type="text"
              placeholder="Username"
              className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            {errors.username && <p className="text-red-500 text-sm mt-1">{errors.username.message}</p>}
          </div>
          
          <div>
            <input
              {...register('password', { required: 'Password is required' })}
              type="password"
              placeholder="Password"
              className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            {errors.password && <p className="text-red-500 text-sm mt-1">{errors.password.message}</p>}
          </div>
          
          <button
            type="submit"
            className="w-full bg-blue-600 text-white p-3 rounded-lg hover:bg-blue-700 transition duration-200 font-semibold"
          >
            Login
          </button>
        </form>
        
        <div className="mt-4 text-center text-sm text-gray-600">
          <p>Default Admin: admin / admin123</p>
        </div>
      </div>
    </div>
  );
};

// Layout Component
const Layout = ({ children }) => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [activeMenu, setActiveMenu] = useState('dashboard');

  const menuItems = [
    { id: 'dashboard', label: 'Dashboard', icon: '📊' },
    { id: 'vendors', label: 'Vendors', icon: '🏪' },
    { id: 'customers', label: 'Customers', icon: '👥' },
    { id: 'products', label: 'Products', icon: '📦' },
    { id: 'sales', label: 'Sales', icon: '💰' },
    { id: 'stock', label: 'Stock', icon: '📈' },
    ...(user?.role === 'admin' ? [
      { id: 'branches', label: 'Branches', icon: '🏢' },
      { id: 'users', label: 'Users', icon: '👤' },
      { id: 'company', label: 'Company', icon: '⚙️' }
    ] : [])
  ];

  const handleMenuClick = (menuId) => {
    setActiveMenu(menuId);
    navigate(`/${menuId}`);
  };

  return (
    <div className="min-h-screen bg-gray-100 flex">
      {/* Sidebar */}
      <div className="w-64 bg-white shadow-lg">
        <div className="p-6">
          <h1 className="text-xl font-bold text-gray-800">ABC Pvt Ltd</h1>
          <p className="text-sm text-gray-600">Inventory System</p>
        </div>
        
        <nav className="mt-6">
          {menuItems.map((item) => (
            <button
              key={item.id}
              onClick={() => handleMenuClick(item.id)}
              className={`w-full text-left px-6 py-3 flex items-center space-x-3 hover:bg-blue-50 transition duration-200 ${
                activeMenu === item.id ? 'bg-blue-100 border-r-4 border-blue-500' : ''
              }`}
            >
              <span className="text-xl">{item.icon}</span>
              <span className="font-medium">{item.label}</span>
            </button>
          ))}
        </nav>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col">
        {/* Header */}
        <header className="bg-white shadow-sm border-b border-gray-200 px-6 py-4">
          <div className="flex justify-between items-center">
            <h2 className="text-2xl font-semibold text-gray-800 capitalize">{activeMenu}</h2>
            <div className="flex items-center space-x-4">
              <span className="text-gray-600">Welcome, {user?.username}</span>
              <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded-full text-xs font-semibold">
                {user?.role}
              </span>
              <button
                onClick={logout}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition duration-200"
              >
                Logout
              </button>
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 p-6">
          {children}
        </main>
      </div>
    </div>
  );
};

// Dashboard Component
const Dashboard = () => {
  const [dashboardData, setDashboardData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      const response = await axios.get(`${API}/dashboard`);
      setDashboardData(response.data);
    } catch (error) {
      toast.error('Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="flex justify-center items-center h-64">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
    </div>;
  }

  const chartData = {
    labels: dashboardData?.monthly_sales?.map(item => item._id) || [],
    datasets: [
      {
        label: 'Monthly Sales (₹)',
        data: dashboardData?.monthly_sales?.map(item => item.amount) || [],
        backgroundColor: 'rgba(59, 130, 246, 0.5)',
        borderColor: 'rgba(59, 130, 246, 1)',
        borderWidth: 1,
      },
    ],
  };

  const doughnutData = {
    labels: ['Sales', 'Purchase'],
    datasets: [
      {
        data: [dashboardData?.total_sales || 0, dashboardData?.total_purchase || 0],
        backgroundColor: ['#10B981', '#F59E0B'],
        borderWidth: 0,
      },
    ],
  };

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white p-6 rounded-lg shadow-md">
          <div className="flex items-center">
            <div className="p-3 bg-green-100 rounded-full">
              <span className="text-2xl">💰</span>
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Total Sales</p>
              <p className="text-2xl font-bold text-gray-900">₹{dashboardData?.total_sales?.toLocaleString() || 0}</p>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-md">
          <div className="flex items-center">
            <div className="p-3 bg-orange-100 rounded-full">
              <span className="text-2xl">🛒</span>
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Total Purchase</p>
              <p className="text-2xl font-bold text-gray-900">₹{dashboardData?.total_purchase?.toLocaleString() || 0}</p>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-md">
          <div className="flex items-center">
            <div className="p-3 bg-blue-100 rounded-full">
              <span className="text-2xl">📦</span>
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Stock Items</p>
              <p className="text-2xl font-bold text-gray-900">{dashboardData?.stock_count || 0}</p>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-md">
          <div className="flex items-center">
            <div className="p-3 bg-purple-100 rounded-full">
              <span className="text-2xl">📈</span>
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Profit</p>
              <p className="text-2xl font-bold text-gray-900">₹{((dashboardData?.total_sales || 0) - (dashboardData?.total_purchase || 0)).toLocaleString()}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white p-6 rounded-lg shadow-md">
          <h3 className="text-lg font-semibold mb-4">Monthly Sales</h3>
          <Bar data={chartData} options={{ responsive: true, maintainAspectRatio: false }} height={300} />
        </div>

        <div className="bg-white p-6 rounded-lg shadow-md">
          <h3 className="text-lg font-semibold mb-4">Sales vs Purchase</h3>
          <div className="flex justify-center">
            <Doughnut data={doughnutData} options={{ responsive: true, maintainAspectRatio: false }} height={300} />
          </div>
        </div>
      </div>
    </div>
  );
};

// Generic CRUD Component
const CrudComponent = ({ title, apiEndpoint, fields, createFields, showBranchFilter = false }) => {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const { register, handleSubmit, reset, formState: { errors } } = useForm();
  const { user } = useAuth();

  useEffect(() => {
    fetchItems();
  }, []);

  const fetchItems = async () => {
    try {
      const response = await axios.get(`${API}/${apiEndpoint}`);
      setItems(response.data);
    } catch (error) {
      toast.error(`Failed to load ${title.toLowerCase()}`);
    } finally {
      setLoading(false);
    }
  };

  const onSubmit = async (data) => {
    try {
      await axios.post(`${API}/${apiEndpoint}`, data);
      toast.success(`${title} created successfully!`);
      reset();
      setShowForm(false);
      fetchItems();
    } catch (error) {
      toast.error(error.response?.data?.detail || `Failed to create ${title.toLowerCase()}`);
    }
  };

  if (loading) {
    return <div className="flex justify-center items-center h-64">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
    </div>;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-gray-900">{title}</h2>
        <button
          onClick={() => setShowForm(!showForm)}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition duration-200"
        >
          {showForm ? 'Cancel' : `Add ${title.slice(0, -1)}`}
        </button>
      </div>

      {/* Add Form */}
      {showForm && (
        <div className="bg-white p-6 rounded-lg shadow-md">
          <h3 className="text-lg font-semibold mb-4">Add New {title.slice(0, -1)}</h3>
          <form onSubmit={handleSubmit(onSubmit)} className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {(createFields || fields).map((field) => (
              <div key={field.key}>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {field.label}
                </label>
                {field.type === 'select' ? (
                  <select
                    {...register(field.key, { required: `${field.label} is required` })}
                    className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="">Select {field.label}</option>
                    {field.options?.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    {...register(field.key, { required: `${field.label} is required` })}
                    type={field.type || 'text'}
                    className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                )}
                {errors[field.key] && (
                  <p className="text-red-500 text-sm mt-1">{errors[field.key].message}</p>
                )}
              </div>
            ))}
            <div className="md:col-span-2">
              <button
                type="submit"
                className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition duration-200"
              >
                Create {title.slice(0, -1)}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Items List */}
      <div className="bg-white rounded-lg shadow-md overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                {fields.map((field) => (
                  <th
                    key={field.key}
                    className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                  >
                    {field.label}
                  </th>
                ))}
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Created
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {items.map((item) => (
                <tr key={item.id} className="hover:bg-gray-50">
                  {fields.map((field) => (
                    <td key={field.key} className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {field.render ? field.render(item[field.key], item) : item[field.key]}
                    </td>
                  ))}
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {new Date(item.created_at).toLocaleDateString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        
        {items.length === 0 && (
          <div className="text-center py-8 text-gray-500">
            No {title.toLowerCase()} found. Create your first one!
          </div>
        )}
      </div>
    </div>
  );
};

// Vendors Component
const Vendors = () => {
  const fields = [
    { key: 'name', label: 'Name' },
    { key: 'address', label: 'Address' },
    { key: 'phone', label: 'Phone' }
  ];

  return (
    <CrudComponent
      title="Vendors"
      apiEndpoint="vendors"
      fields={fields}
    />
  );
};

// Customers Component
const Customers = () => {
  const fields = [
    { key: 'name', label: 'Name' },
    { key: 'address', label: 'Address' },
    { key: 'phone', label: 'Phone' }
  ];

  return (
    <CrudComponent
      title="Customers"
      apiEndpoint="customers"
      fields={fields}
    />
  );
};

// Products Component
const Products = () => {
  const [vendors, setVendors] = useState([]);

  useEffect(() => {
    fetchVendors();
  }, []);

  const fetchVendors = async () => {
    try {
      const response = await axios.get(`${API}/vendors`);
      setVendors(response.data);
    } catch (error) {
      console.error('Failed to load vendors');
    }
  };

  const fields = [
    { key: 'name', label: 'Product Name' },
    { key: 'vendor_id', label: 'Vendor', render: (vendorId) => {
      const vendor = vendors.find(v => v.id === vendorId);
      return vendor ? vendor.name : 'Unknown Vendor';
    }},
    { key: 'quantity', label: 'Quantity' },
    { key: 'purchase_price', label: 'Purchase Price', render: (price) => `₹${price}` },
    { key: 'selling_price', label: 'Selling Price', render: (price) => `₹${price}` }
  ];

  const createFields = [
    { key: 'name', label: 'Product Name' },
    { 
      key: 'vendor_id', 
      label: 'Vendor', 
      type: 'select',
      options: vendors.map(vendor => ({ value: vendor.id, label: vendor.name }))
    },
    { key: 'quantity', label: 'Quantity', type: 'number' },
    { key: 'purchase_price', label: 'Purchase Price', type: 'number', step: '0.01' },
    { key: 'selling_price', label: 'Selling Price', type: 'number', step: '0.01' }
  ];

  return (
    <CrudComponent
      title="Products"
      apiEndpoint="products"
      fields={fields}
      createFields={createFields}
    />
  );
};

// Sales Component
const Sales = () => {
  const [sales, setSales] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saleItems, setSaleItems] = useState([{ product_id: '', quantity: 1, selling_price: 0 }]);
  const { register, handleSubmit, reset, watch, setValue } = useForm();

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [salesRes, customersRes, productsRes] = await Promise.all([
        axios.get(`${API}/sales`),
        axios.get(`${API}/customers`),
        axios.get(`${API}/products`)
      ]);
      
      setSales(salesRes.data);
      setCustomers(customersRes.data);
      setProducts(productsRes.data);
    } catch (error) {
      toast.error('Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const addSaleItem = () => {
    setSaleItems([...saleItems, { product_id: '', quantity: 1, selling_price: 0 }]);
  };

  const removeSaleItem = (index) => {
    setSaleItems(saleItems.filter((_, i) => i !== index));
  };

  const updateSaleItem = (index, field, value) => {
    const updated = [...saleItems];
    updated[index][field] = value;
    
    if (field === 'product_id') {
      const product = products.find(p => p.id === value);
      if (product) {
        updated[index].selling_price = product.selling_price;
      }
    }
    
    setSaleItems(updated);
  };

  const onSubmit = async (data) => {
    try {
      const saleData = {
        customer_id: data.customer_id,
        items: saleItems.map(item => ({
          product_id: item.product_id,
          quantity: parseInt(item.quantity),
          selling_price: parseFloat(item.selling_price)
        }))
      };

      await axios.post(`${API}/sales`, saleData);
      toast.success('Sale created successfully!');
      reset();
      setSaleItems([{ product_id: '', quantity: 1, selling_price: 0 }]);
      setShowForm(false);
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to create sale');
    }
  };

  const downloadInvoice = async (saleId) => {
    try {
      const response = await axios.get(`${API}/sales/${saleId}/invoice`, {
        responseType: 'blob'
      });
      
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `invoice_${saleId}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      toast.error('Failed to download invoice');
    }
  };

  if (loading) {
    return <div className="flex justify-center items-center h-64">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
    </div>;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-gray-900">Sales / Invoices</h2>
        <button
          onClick={() => setShowForm(!showForm)}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition duration-200"
        >
          {showForm ? 'Cancel' : 'Create Sale'}
        </button>
      </div>

      {/* Sale Form */}
      {showForm && (
        <div className="bg-white p-6 rounded-lg shadow-md">
          <h3 className="text-lg font-semibold mb-4">Create New Sale</h3>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            {/* Customer Selection */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Customer</label>
              <select
                {...register('customer_id', { required: 'Customer is required' })}
                className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Select Customer</option>
                {customers.map((customer) => (
                  <option key={customer.id} value={customer.id}>
                    {customer.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Sale Items */}
            <div>
              <div className="flex justify-between items-center mb-2">
                <label className="block text-sm font-medium text-gray-700">Sale Items</label>
                <button
                  type="button"
                  onClick={addSaleItem}
                  className="px-3 py-1 bg-green-600 text-white rounded text-sm hover:bg-green-700"
                >
                  Add Item
                </button>
              </div>
              
              {saleItems.map((item, index) => (
                <div key={index} className="grid grid-cols-1 md:grid-cols-4 gap-2 mb-2 p-3 border rounded-lg">
                  <select
                    value={item.product_id}
                    onChange={(e) => updateSaleItem(index, 'product_id', e.target.value)}
                    className="p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Select Product</option>
                    {products.map((product) => (
                      <option key={product.id} value={product.id}>
                        {product.name} (Stock: {product.quantity})
                      </option>
                    ))}
                  </select>
                  
                  <input
                    type="number"
                    value={item.quantity}
                    onChange={(e) => updateSaleItem(index, 'quantity', e.target.value)}
                    placeholder="Quantity"
                    min="1"
                    className="p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                  
                  <input
                    type="number"
                    value={item.selling_price}
                    onChange={(e) => updateSaleItem(index, 'selling_price', e.target.value)}
                    placeholder="Price"
                    step="0.01"
                    className="p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                  
                  <div className="flex items-center space-x-2">
                    <span className="text-sm text-gray-600">
                      Total: ₹{(item.quantity * item.selling_price).toFixed(2)}
                    </span>
                    {saleItems.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeSaleItem(index)}
                        className="px-2 py-1 bg-red-600 text-white rounded text-sm hover:bg-red-700"
                      >
                        Remove
                      </button>
                    )}
                  </div>
                </div>
              ))}
              
              <div className="text-right mt-4">
                <span className="text-lg font-semibold">
                  Grand Total: ₹{saleItems.reduce((total, item) => total + (item.quantity * item.selling_price), 0).toFixed(2)}
                </span>
              </div>
            </div>

            <button
              type="submit"
              className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition duration-200"
            >
              Create Sale
            </button>
          </form>
        </div>
      )}

      {/* Sales List */}
      <div className="bg-white rounded-lg shadow-md overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Invoice #</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Customer</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Total Amount</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {sales.map((sale) => {
                const customer = customers.find(c => c.id === sale.customer_id);
                return (
                  <tr key={sale.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {sale.invoice_number}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {customer?.name || 'Unknown'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      ₹{sale.total_amount.toFixed(2)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {new Date(sale.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      <button
                        onClick={() => downloadInvoice(sale.id)}
                        className="px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 transition duration-200"
                      >
                        Download PDF
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        
        {sales.length === 0 && (
          <div className="text-center py-8 text-gray-500">
            No sales found. Create your first sale!
          </div>
        )}
      </div>
    </div>
  );
};

// Stock Component
const Stock = () => {
  const [stockData, setStockData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStockData();
  }, []);

  const fetchStockData = async () => {
    try {
      const response = await axios.get(`${API}/stock`);
      setStockData(response.data);
    } catch (error) {
      toast.error('Failed to load stock data');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="flex justify-center items-center h-64">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
    </div>;
  }

  return (
    <div className="space-y-6">
      {/* Summary Card */}
      <div className="bg-white p-6 rounded-lg shadow-md">
        <h3 className="text-lg font-semibold mb-4">Stock Summary</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="text-center">
            <p className="text-3xl font-bold text-blue-600">{stockData?.stock_items?.length || 0}</p>
            <p className="text-gray-600">Product Types</p>
          </div>
          <div className="text-center">
            <p className="text-3xl font-bold text-green-600">
              {stockData?.stock_items?.reduce((total, item) => total + item.total_quantity, 0) || 0}
            </p>
            <p className="text-gray-600">Total Quantity</p>
          </div>
          <div className="text-center">
            <p className="text-3xl font-bold text-purple-600">₹{stockData?.total_stock_value?.toLocaleString() || 0}</p>
            <p className="text-gray-600">Total Stock Value</p>
          </div>
        </div>
      </div>

      {/* Stock Table */}
      <div className="bg-white rounded-lg shadow-md overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-semibold">Stock Details</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Product Name</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Quantity</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Purchase Value</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Selling Value</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Potential Profit</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {stockData?.stock_items?.map((item, index) => (
                <tr key={index} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    {item._id}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {item.total_quantity}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    ₹{item.total_value.toFixed(2)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    ₹{item.selling_value.toFixed(2)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-green-600 font-medium">
                    ₹{(item.selling_value - item.total_value).toFixed(2)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        
        {(!stockData?.stock_items || stockData.stock_items.length === 0) && (
          <div className="text-center py-8 text-gray-500">
            No stock data found. Add some products first!
          </div>
        )}
      </div>
    </div>
  );
};

// Protected Route Component
const ProtectedRoute = ({ children }) => {
  const { user, loading } = useAuth();

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
    </div>;
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return <Layout>{children}</Layout>;
};

// Main App Component
function App() {
  return (
    <AuthProvider>
      <Router>
        <div className="App">
          <Toaster position="top-right" />
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
            <Route path="/vendors" element={<ProtectedRoute><Vendors /></ProtectedRoute>} />
            <Route path="/customers" element={<ProtectedRoute><Customers /></ProtectedRoute>} />
            <Route path="/products" element={<ProtectedRoute><Products /></ProtectedRoute>} />
            <Route path="/sales" element={<ProtectedRoute><Sales /></ProtectedRoute>} />
            <Route path="/stock" element={<ProtectedRoute><Stock /></ProtectedRoute>} />
          </Routes>
        </div>
      </Router>
    </AuthProvider>
  );
}

export default App;
