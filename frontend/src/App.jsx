import React, { useState, useEffect, useRef } from 'react';
import { 
  Server, Database, Upload, Activity, ShieldAlert, LogOut, Terminal, 
  HardDrive, RefreshCw, FileText, Trash2, Key, Cpu, Layers, Lock, 
  Play, Check, FileCode, ExternalLink, ShieldCheck, ChevronRight
} from 'lucide-react';

const API_URL = "http://51.21.243.194:5000";
const API_BASE = import.meta.env.VITE_API_URL || API_URL + '/api';

export default function App() {
  const [token, setToken] = useState(localStorage.getItem('token') || '');
  const [user, setUser] = useState(null);
  const [activeView, setActiveView] = useState('dashboard');
  const [files, setFiles] = useState([]);
  const [stats, setStats] = useState(null);
  const [logs, setLogs] = useState([]);
  const [cpuHistory, setCpuHistory] = useState(Array(20).fill(10));
  const [latencyHistory, setLatencyHistory] = useState(Array(20).fill(15));
  const [drawerNode, setDrawerNode] = useState(null);

  // Authentication State
  const [isLogin, setIsLogin] = useState(true);
  const [usernameInput, setUsernameInput] = useState('');
  const [passwordInput, setPasswordInput] = useState('');
  const [authError, setAuthError] = useState('');

  // SSE Stream log state
  const sseRef = useRef(null);

  // Load user data on startup
  useEffect(() => {
    if (token) {
      localStorage.setItem('token', token);
      fetchUser();
    } else {
      localStorage.removeItem('token');
      setUser(null);
    }
  }, [token]);

  // Fetch logged in user profile
  const fetchUser = async () => {
    try {
      const res = await fetch(`${API_BASE}/auth/me`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setUser(data);
      } else {
        setToken(''); // Reset token if invalid
      }
    } catch (err) {
      console.error('Auth error:', err);
    }
  };

  // Poll server metrics & stream logs when logged in
  useEffect(() => {
    if (!token) return;

    // Load initial stats & files
    fetchStats();
    fetchFiles();

    // Poll stats every 3 seconds
    const interval = setInterval(fetchStats, 3000);

    // Initialize SSE Log stream
    sseRef.current = new EventSource(`${API_BASE}/monitor/logs/stream`);
    
    sseRef.current.onmessage = (event) => {
      const log = JSON.parse(event.data);
      setLogs(prev => [log, ...prev].slice(0, 100)); // Keep last 100 logs
    };

    return () => {
      clearInterval(interval);
      if (sseRef.current) sseRef.current.close();
    };
  }, [token]);

  // Update CPU/Latency histories when stats updates
  useEffect(() => {
    if (stats) {
      setCpuHistory(prev => [...prev.slice(1), stats.system.cpuUsage]);
      
      // Extract latest request latency if any, or generate natural latency
      const latestLog = logs[0];
      const latencyVal = (latestLog && latestLog.duration) ? latestLog.duration : Math.floor(Math.random() * 10) + 12;
      setLatencyHistory(prev => [...prev.slice(1), latencyVal]);
    }
  }, [stats]);

  const fetchStats = async () => {
    try {
      const res = await fetch(`${API_BASE}/monitor/stats`);
      if (res.ok) {
        const data = await res.json();
        setStats(data);
      }
    } catch (err) {
      console.error('Error fetching server stats:', err);
    }
  };

  const fetchFiles = async () => {
    try {
      const res = await fetch(`${API_BASE}/uploads`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setFiles(data);
      }
    } catch (err) {
      console.error('Error fetching uploads:', err);
    }
  };

  // Handle Authentication submit
  const handleAuth = async (e) => {
    e.preventDefault();
    setAuthError('');
    const endpoint = isLogin ? 'login' : 'signup';
    
    try {
      const res = await fetch(`${API_BASE}/auth/${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: usernameInput, password: passwordInput })
      });
      
      const data = await res.json();
      if (res.ok) {
        setToken(data.token);
      } else {
        setAuthError(data.error || 'Authentication failed');
      }
    } catch (err) {
      setAuthError('Connection backend error. Ensure local backend server is running.');
    }
  };

  const handleLogout = () => {
    setToken('');
    setUser(null);
  };

  if (!token) {
    return (
      <div className="auth-container">
        <div className="auth-card">
          <div className="auth-logo">☁️</div>
          <h1 className="auth-title">Cloud Deploy Sandbox</h1>
          <p className="auth-subtitle">
            {isLogin ? 'Login to monitor cloud deployment' : 'Create an account to begin cloud labs'}
          </p>

          {authError && (
            <div className="error-message">
              <ShieldAlert size={16} />
              <span>{authError}</span>
            </div>
          )}

          <form onSubmit={handleAuth}>
            <div className="form-group">
              <label className="form-label">Username</label>
              <input 
                type="text" 
                className="form-input" 
                value={usernameInput}
                onChange={(e) => setUsernameInput(e.target.value)}
                placeholder="developer" 
                required 
              />
            </div>
            <div className="form-group">
              <label className="form-label">Password</label>
              <input 
                type="password" 
                className="form-input" 
                value={passwordInput}
                onChange={(e) => setPasswordInput(e.target.value)}
                placeholder="••••••••" 
                required 
              />
            </div>
            <button type="submit" className="btn-primary">
              {isLogin ? 'Log In' : 'Sign Up'}
            </button>
          </form>

          <div className="auth-toggle">
            {isLogin ? "Don't have an account? " : "Already have an account? "}
            <span className="auth-toggle-link" onClick={() => setIsLogin(!isLogin)}>
              {isLogin ? 'Register now' : 'Log in here'}
            </span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="app-container">
      {/* Sidebar Navigation */}
      <nav className="sidebar">
        <div className="sidebar-brand">
          <span className="sidebar-logo">☁️</span>
          <span className="sidebar-title">AWS Deploy Labs</span>
        </div>
        
        <ul className="sidebar-menu">
          <li 
            className={`sidebar-item ${activeView === 'dashboard' ? 'active' : ''}`}
            onClick={() => setActiveView('dashboard')}
          >
            <Layers size={18} />
            <span>Dashboard</span>
          </li>
          <li 
            className={`sidebar-item ${activeView === 'architecture' ? 'active' : ''}`}
            onClick={() => setActiveView('architecture')}
          >
            <Cpu size={18} />
            <span>Architecture Map</span>
          </li>
          <li 
            className={`sidebar-item ${activeView === 'ssh' ? 'active' : ''}`}
            onClick={() => setActiveView('ssh')}
          >
            <Terminal size={18} />
            <span>SSH Simulator</span>
          </li>
          <li 
            className={`sidebar-item ${activeView === 'monitoring' ? 'active' : ''}`}
            onClick={() => setActiveView('monitoring')}
          >
            <Activity size={18} />
            <span>Live Monitor & Logs</span>
          </li>
          <li 
            className={`sidebar-item ${activeView === 'iam' ? 'active' : ''}`}
            onClick={() => setActiveView('iam')}
          >
            <Key size={18} />
            <span>IAM & Security</span>
          </li>
        </ul>

        {user && (
          <div className="sidebar-user">
            <div className="user-info">
              <div className="user-avatar">
                {user.username.substring(0, 2).toUpperCase()}
              </div>
              <span className="user-name" title={user.username}>{user.username}</span>
            </div>
            <button className="btn-logout" onClick={handleLogout} title="Log Out">
              <LogOut size={18} />
            </button>
          </div>
        )}
      </nav>

      {/* Main Panel Content */}
      <main className="main-content">
        <header className="main-header">
          <div className="header-title-container">
            <h2 className="header-title">
              {activeView === 'dashboard' && 'Deployment Console'}
              {activeView === 'architecture' && 'AWS Cloud Architecture'}
              {activeView === 'ssh' && 'EC2 Linux SSH Simulator'}
              {activeView === 'monitoring' && 'CloudWatch Server Health'}
              {activeView === 'iam' && 'IAM Access Controls'}
            </h2>
          </div>

          <div className="infra-status-bar">
            <div className="status-badge" title="Express server local status">
              <div className="status-dot active"></div>
              <span>API: Online</span>
            </div>
            <div className="status-badge" title="Simulated Database Connection status">
              <div className={`status-dot ${stats?.cloud?.database === 'healthy' ? 'active' : 'pending'}`}></div>
              <span>DB: {stats?.cloud?.database === 'healthy' ? 'Connected' : 'Degraded'}</span>
            </div>
            <div className="status-badge" title="S3 connection state">
              <div className={`status-dot ${stats?.cloud?.s3?.configured ? 'active' : 'pending'}`}></div>
              <span>S3: {stats?.cloud?.s3?.configured ? 'AWS S3' : 'Fallback Local'}</span>
            </div>
          </div>
        </header>

        <div className="page-body">
          {activeView === 'dashboard' && (
            <DashboardHome 
              files={files} 
              fetchFiles={fetchFiles} 
              token={token} 
              stats={stats}
            />
          )}
          {activeView === 'architecture' && (
            <ArchitectureMap 
              drawerNode={drawerNode} 
              setDrawerNode={setDrawerNode} 
              stats={stats}
            />
          )}
          {activeView === 'ssh' && <SshSimulator />}
          {activeView === 'monitoring' && (
            <MonitoringPanel 
              stats={stats} 
              logs={logs} 
              cpuHistory={cpuHistory} 
              latencyHistory={latencyHistory}
            />
          )}
          {activeView === 'iam' && <IamDesigner stats={stats} />}
        </div>
      </main>
    </div>
  );
}

// ==========================================
// 1. DASHBOARD VIEW (Console)
// ==========================================
function DashboardHome({ files, fetchFiles, token, stats }) {
  const [dragActive, setDragActive] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadError, setUploadError] = useState('');
  const fileInputRef = useRef(null);

  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      uploadFile(e.dataTransfer.files[0]);
    }
  };

  const onFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      uploadFile(e.target.files[0]);
    }
  };

  const uploadFile = async (file) => {
    setUploadError('');
    setUploadProgress(10);
    
    const formData = new FormData();
    formData.append('file', file);

    try {
      setUploadProgress(50);
      const res = await fetch(`${API_BASE}/upload`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData
      });

      if (res.ok) {
        setUploadProgress(100);
        fetchFiles();
        setTimeout(() => setUploadProgress(0), 1500);
      } else {
        const err = await res.json();
        setUploadError(err.error || 'Upload failed');
        setUploadProgress(0);
      }
    } catch (err) {
      setUploadError('Network error uploading file');
      setUploadProgress(0);
    }
  };

  const deleteFile = async (id) => {
    try {
      const res = await fetch(`${API_BASE}/uploads/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        fetchFiles();
      }
    } catch (err) {
      console.error('Error deleting file:', err);
    }
  };

  const triggerInput = () => {
    fileInputRef.current.click();
  };

  const formatSize = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <div className="dashboard-grid">
      <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
        
        {/* Metric widgets banner */}
        <div className="infra-cards-container">
          <div className="mini-card">
            <span className="mini-card-label">Server Platform</span>
            <span className="mini-card-value">{stats?.system?.platform ? stats.system.platform.toUpperCase() : 'LINUX/EC2'}</span>
            <Server size={18} className="mini-card-icon" />
          </div>
          <div className="mini-card">
            <span className="mini-card-label">CPU Utilization</span>
            <span className="mini-card-value">{stats?.system?.cpuUsage ? `${stats.system.cpuUsage}%` : '8.2%'}</span>
            <Cpu size={18} className="mini-card-icon" />
          </div>
          <div className="mini-card">
            <span className="mini-card-label">Database Connected</span>
            <span className="mini-card-value">JSON-DB (SQLite ready)</span>
            <Database size={18} className="mini-card-icon" style={{ color: '#10b981' }} />
          </div>
          <div className="mini-card">
            <span className="mini-card-label">Total Files Deployed</span>
            <span className="mini-card-value">{files.length} uploads</span>
            <HardDrive size={18} className="mini-card-icon" style={{ color: '#3b82f6' }} />
          </div>
        </div>

        {/* File Manager Card */}
        <div className="card">
          <div className="card-header">
            <h3 className="card-title">
              <HardDrive size={18} style={{ color: '#ff9900' }} />
              Deployed Storage Manager
            </h3>
            <button className="btn-icon" onClick={fetchFiles} title="Sync metadata">
              <RefreshCw size={14} />
            </button>
          </div>

          <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '16px' }}>
            This panel lists the records registered in your database. Files are saved in **AWS S3** or fall back to your backend **EC2 disk** folder (`backend/uploads/`) depending on credentials configuration.
          </p>

          {files.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-muted)', fontSize: '14px' }}>
              No files uploaded yet. Drag a file on the right side to deploy.
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table className="file-list">
                <thead>
                  <tr>
                    <th>Filename</th>
                    <th>Storage Provider</th>
                    <th>Size</th>
                    <th>Date Uploaded</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {files.map(file => (
                    <tr key={file.id}>
                      <td className="file-name-cell">
                        <FileText size={16} style={{ color: 'var(--text-muted)' }} />
                        <span title={file.originalName}>{file.originalName}</span>
                      </td>
                      <td>
                        {file.isS3 ? (
                          <span className="file-badge-s3">AWS S3 BUCKET</span>
                        ) : (
                          <span className="file-badge-local">EC2 LOCAL DISK</span>
                        )}
                      </td>
                      <td>{formatSize(file.size)}</td>
                      <td>{new Date(file.createdAt).toLocaleDateString()}</td>
                      <td>
                        <div style={{ display: 'flex', gap: '8px' }}>
                          <a 
                            href={file.url.startsWith('/') ? `http://localhost:5001${file.url}` : file.url} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="btn-icon" 
                            title="Open direct file link"
                          >
                            <ExternalLink size={14} />
                          </a>
                          <button 
                            className="btn-icon delete" 
                            onClick={() => deleteFile(file.id)}
                            title="Remove file from cloud storage"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Right Column: Upload widget */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
        <div className="card" style={{ flex: 1 }}>
          <div className="card-header">
            <h3 className="card-title">
              <Upload size={18} style={{ color: '#ff9900' }} />
              Cloud File Deployment
            </h3>
          </div>

          <div 
            className={`upload-zone ${dragActive ? 'dragging' : ''}`}
            onDragEnter={handleDrag}
            onDragOver={handleDrag}
            onDragLeave={handleDrag}
            onDrop={handleDrop}
            onClick={triggerInput}
          >
            <input 
              type="file" 
              ref={fileInputRef} 
              onChange={onFileChange} 
              className="file-input" 
            />
            <Upload className="upload-icon" />
            <p className="upload-text">Drag and drop file here, or click to upload</p>
            <p className="upload-subtext">Supports images, pdfs, audio or archives</p>
          </div>

          {uploadProgress > 0 && (
            <div style={{ marginTop: '20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '6px' }}>
                <span>Uploading to S3 server...</span>
                <span>{uploadProgress}%</span>
              </div>
              <div style={{ width: '100%', height: '4px', backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: '2px' }}>
                <div style={{ 
                  width: `${uploadProgress}%`, 
                  height: '100%', 
                  backgroundColor: 'var(--aws-orange)', 
                  borderRadius: '2px',
                  transition: 'width 0.2s ease-in-out'
                }}></div>
              </div>
            </div>
          )}

          {uploadError && (
            <div className="error-message" style={{ marginTop: '20px', marginBottom: 0 }}>
              <ShieldAlert size={16} />
              <span>{uploadError}</span>
            </div>
          )}

          <div style={{ marginTop: '24px', fontSize: '13px', color: 'var(--text-secondary)', display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
              <Check size={14} style={{ color: 'var(--success-green)', marginTop: '2px', flexShrink: 0 }} />
              <span>Direct-to-S3 uploads run standard multipart forms processed securely on EC2 server instance.</span>
            </div>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
              <Check size={14} style={{ color: 'var(--success-green)', marginTop: '2px', flexShrink: 0 }} />
              <span>Supports files up to 10MB default multer configuration restrictions.</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ==========================================
// 2. ARCHITECTURE MAP VIEW
// ==========================================
function ArchitectureMap({ drawerNode, setDrawerNode, stats }) {
  const isS3Configured = stats?.cloud?.s3?.configured;

  // Static Details data for the Drawer
  const nodeDetails = {
    user: {
      title: "Public Web Client (User)",
      description: "Representing public internet traffic (browsers/users) requesting your application pages or pushing files.",
      role: "Triggers HTTP requests. Obtains HTML/CSS/JS resources and contacts APIs directly via DNS name.",
      guide: "Public routes resolve to the EC2 public IPv4 address (or domain name assigned via Amazon Route 53).",
      config: "Host header: cloud-dashboard.example.com\nIncoming Port: 80 / 443"
    },
    route53: {
      title: "Amazon Route 53 (DNS Service)",
      description: "Highly available and scalable Cloud Domain Name System (DNS) service.",
      role: "Translates human-readable domain names (e.g. cloud-dashboard.com) into EC2 numerical IPv4 addresses (e.g. 54.210.85.12).",
      guide: "In the Route 53 Console, create a Hosted Zone for your domain. Add an 'A Record' linking your domain prefix to the elastic IP of your EC2 instance.",
      config: "Record Type: A\nName: @ (root) / app\nValue: 54.210.85.12 (EC2 Elastic IP)\nTTL: 300 seconds"
    },
    nginx: {
      title: "Nginx Reverse Proxy & HTTP Server",
      description: "An open-source high-performance HTTP web server and reverse proxy that manages incoming server requests.",
      role: "Receives requests on public ports 80/443 and redirects them to internal Node.js port 5000. It secures backend servers, handles SSL termination, and loads static assets fast.",
      guide: "Edit `/etc/nginx/sites-available/default` on your Ubuntu EC2 and configure a proxy_pass parameter.",
      config: "server {\n  listen 80;\n  server_name _;\n\n  location / {\n    proxy_pass http://localhost:5000;\n    proxy_http_version 1.1;\n    proxy_set_header Upgrade $http_upgrade;\n    proxy_set_header Connection 'upgrade';\n    proxy_set_header Host $host;\n    proxy_cache_bypass $http_upgrade;\n  }\n}"
    },
    ec2: {
      title: "Amazon EC2 Instance (Ubuntu Linux)",
      description: "Elastic Compute Cloud (EC2) provides resizable, secure virtual servers in the cloud.",
      role: "Hosts the running Node.js process and static client builds. Acts as the virtual server computer that handles requests and uploads.",
      guide: "Launch an EC2 instance using the Ubuntu Server AMI. Secure it via Security Groups, letting port 22 (SSH), 80 (HTTP), and 443 (HTTPS) pass through.",
      config: "AMI: Ubuntu Server 22.04 LTS\nInstance Type: t2.micro (Free Tier eligible)\nPorts Open: 22 (SSH), 80 (HTTP), 443 (HTTPS)"
    },
    pm2: {
      title: "PM2 Express API Backend Service",
      description: "Node.js Express backend script managed dynamically by PM2 Daemon Process Manager.",
      role: "Receives requests from Nginx. Manages backend REST logic, authenticates JWT tokens, reads/writes JSON database file, and communicates with Amazon S3 client.",
      guide: "Use PM2 so the backend does not shut down when you exit SSH session. Run `pm2 start server.js` to run server continuously.",
      config: "PM2 Process Name: cloud-dashboard\nEngine: Node.js v18+\nPort bind: 127.0.0.1:5000\nAutostart: pm2 startup && pm2 save"
    },
    database: {
      title: "Database Engine (SQLite/PostgreSQL)",
      description: "The persistent structured storage layer for user credentials and upload file metadata records.",
      role: "Locally writes user accounts, hashed passwords, and active upload URL pointers. Demonstrates relational CRUD schemas.",
      guide: "We use local file structures in dev. When deploying to AWS, you can install PostgreSQL on the EC2 instance or set up an Amazon RDS instance for database isolation.",
      config: "Dev: local JSON file-system database\nProd: SQLite file or AWS RDS PostgreSQL\nTables: USERS (id, username, pwhash), UPLOADS (id, userId, originalName, url, isS3)"
    },
    s3: {
      title: "Amazon S3 (Simple Storage Service)",
      description: "Object storage service built to store and retrieve any amount of data from anywhere.",
      role: "Stores uploaded images and files. Isolates heavy asset files off the EC2 instance server disk storage to increase speed and scalability.",
      guide: "Create a bucket in S3 console. Block public access or set custom public read permissions using Bucket Policies. Access via IAM Node Access Keys.",
      config: "S3 Action: putObject, deleteObject\nS3 Bucket policy:\n{\n  \"Version\": \"2012-10-17\",\n  \"Statement\": [\n    {\n      \"Effect\": \"Allow\",\n      \"Principal\": \"*\",\n      \"Action\": \"s3:GetObject\",\n      \"Resource\": \"arn:aws:s3:::your-bucket/*\"\n    }\n  ]\n}"
    }
  };

  return (
    <div className="card" style={{ position: 'relative' }}>
      <div className="card-header">
        <h3 className="card-title">
          <Cpu size={18} style={{ color: '#ff9900' }} />
          Live AWS Deployment Architecture
        </h3>
        <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Click components to inspect configuration details</span>
      </div>

      <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '24px' }}>
        This diagram represents the flow of network traffic and access controls in the cloud app. Public users query DNS, resolve to Nginx on EC2, which reverse-proxies requests into the Node backend. Media storage is routed out to Amazon S3.
      </p>

      {/* SVG Architecture Diagram */}
      <div className="arch-map-container">
        <svg viewBox="0 0 800 450" className="arch-canvas">
          {/* Gradients definitions */}
          <defs>
            <linearGradient id="glow-orange" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#ff9900" />
              <stop offset="100%" stopColor="#ffcc00" />
            </linearGradient>
            <linearGradient id="glow-blue" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#3b82f6" />
              <stop offset="100%" stopColor="#06b6d4" />
            </linearGradient>
          </defs>

          {/* Links/Connection paths */}
          {/* User to Route 53 (DNS Lookup) */}
          <path d="M 90 225 Q 165 140 240 225" fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth="2" className="arch-link" />
          {/* User to Nginx (Port 80/443 HTTP) */}
          <path d="M 90 225 L 340 225" fill="none" stroke="var(--accent-blue)" strokeWidth="2.5" className="arch-link" />
          
          {/* Nginx to Node.js Backend */}
          <path d="M 440 225 L 530 225" fill="none" stroke="var(--accent-cyan)" strokeWidth="2.5" className="arch-link" />
          
          {/* Node.js Backend to S3 (AWS SDK write) */}
          <path d="M 610 225 Q 675 140 700 210" fill="none" stroke={isS3Configured ? "var(--aws-orange)" : "rgba(255,255,255,0.15)"} strokeWidth="2.5" className="arch-link" style={{ strokeDasharray: isS3Configured ? '6' : 'none' }} />
          
          {/* Node.js Backend to Database */}
          <path d="M 570 260 L 570 340" fill="none" stroke="var(--success-green)" strokeWidth="2" className="arch-link" />

          {/* NODES REPRESENTATION */}
          
          {/* Node: USER */}
          <g className="arch-node" onClick={() => setDrawerNode(nodeDetails.user)}>
            <circle cx="90" cy="225" r="35" fill="#1f2937" stroke="#3b82f6" strokeWidth="2" />
            <text x="90" y="220" textAnchor="middle" fill="#fff" fontSize="24">👤</text>
            <text x="90" y="280" textAnchor="middle" fill="var(--text-primary)" fontSize="13" fontWeight="bold">User / Client</text>
            <text x="90" y="295" textAnchor="middle" fill="var(--text-muted)" fontSize="11">Browser Client</text>
          </g>

          {/* Node: Route 53 (Top mid) */}
          <g className="arch-node" onClick={() => setDrawerNode(nodeDetails.route53)}>
            <rect x="200" y="55" width="80" height="70" rx="8" fill="#1e1b4b" stroke="#3b82f6" strokeWidth="1.5" />
            <text x="240" y="90" textAnchor="middle" fill="#fff" fontSize="24">🌐</text>
            <text x="240" y="145" textAnchor="middle" fill="var(--text-primary)" fontSize="13" fontWeight="bold">Route 53</text>
            <text x="240" y="160" textAnchor="middle" fill="var(--text-muted)" fontSize="11">DNS Resolution</text>
          </g>

          {/* Cloud Container boundary representing AWS EC2 Server Instance */}
          <rect x="310" y="120" width="310" height="290" rx="16" fill="rgba(255, 255, 255, 0.01)" stroke="var(--border-color)" strokeWidth="1.5" strokeDasharray="4 4" />
          <text x="325" y="140" fill="var(--text-muted)" fontSize="11" fontWeight="bold">AWS EC2 INSTANCE (Ubuntu Server)</text>

          {/* Node: Nginx Proxy */}
          <g className="arch-node" onClick={() => setDrawerNode(nodeDetails.nginx)}>
            <circle cx="390" cy="225" r="35" fill="#022c22" stroke="#10b981" strokeWidth="2" />
            <text x="390" y="220" textAnchor="middle" fill="#fff" fontSize="24">⚙️</text>
            <text x="390" y="280" textAnchor="middle" fill="var(--text-primary)" fontSize="13" fontWeight="bold">Nginx</text>
            <text x="390" y="295" textAnchor="middle" fill="var(--text-muted)" fontSize="11">Proxy Pass (80)</text>
          </g>

          {/* Node: Node/Express (PM2 Daemon) */}
          <g className="arch-node" onClick={() => setDrawerNode(nodeDetails.pm2)}>
            <circle cx="570" cy="225" r="35" fill="#1e1b2f" stroke="var(--accent-cyan)" strokeWidth="2" />
            <text x="570" y="220" textAnchor="middle" fill="#fff" fontSize="24">🟢</text>
            <text x="570" y="280" textAnchor="middle" fill="var(--text-primary)" fontSize="13" fontWeight="bold">Express API</text>
            <text x="570" y="295" textAnchor="middle" fill="var(--text-muted)" fontSize="11">Port 5000 (PM2)</text>
          </g>

          {/* Node: Database (Bottom right in EC2) */}
          <g className="arch-node" onClick={() => setDrawerNode(nodeDetails.database)}>
            <rect x="530" y="325" width="80" height="70" rx="8" fill="#064e3b" stroke="var(--success-green)" strokeWidth="1.5" />
            <text x="570" y="360" textAnchor="middle" fill="#fff" fontSize="22">💾</text>
            <text x="570" y="415" textAnchor="middle" fill="var(--text-primary)" fontSize="13" fontWeight="bold">Local Database</text>
            <text x="570" y="430" textAnchor="middle" fill="var(--text-muted)" fontSize="11">SQLite / JSON File</text>
          </g>

          {/* Node: AWS S3 Bucket (Far right) */}
          <g className="arch-node" onClick={() => setDrawerNode(nodeDetails.s3)}>
            <circle cx="720" cy="225" r="35" fill={isS3Configured ? "#2d1b02" : "#111"} stroke={isS3Configured ? "var(--aws-orange)" : "rgba(255,255,255,0.1)"} strokeWidth="2" />
            <text x="720" y="220" textAnchor="middle" fill="#fff" fontSize="24">🪣</text>
            <text x="720" y="280" textAnchor="middle" fill={isS3Configured ? "var(--text-primary)" : "var(--text-muted)"} fontSize="13" fontWeight="bold">Amazon S3</text>
            <text x="720" y="295" textAnchor="middle" fill="var(--text-muted)" fontSize="11">{isS3Configured ? 'Connected Bucket' : 'Disabled'}</text>
          </g>
        </svg>
      </div>

      {/* Slide-out Node Detail Drawer */}
      {drawerNode && (
        <>
          <div className="backdrop" onClick={() => setDrawerNode(null)}></div>
          <div className="drawer open">
            <div className="drawer-header">
              <h3 className="drawer-title">{drawerNode.title}</h3>
              <button className="drawer-close" onClick={() => setDrawerNode(null)}>✕</button>
            </div>
            
            <div className="drawer-body">
              <div>
                <strong style={{ display: 'block', marginBottom: '4px', color: 'var(--text-primary)' }}>Description</strong>
                <p style={{ color: 'var(--text-secondary)' }}>{drawerNode.description}</p>
              </div>

              <div>
                <strong style={{ display: 'block', marginBottom: '4px', color: 'var(--text-primary)' }}>System Role</strong>
                <p style={{ color: 'var(--text-secondary)' }}>{drawerNode.role}</p>
              </div>

              <div>
                <strong style={{ display: 'block', marginBottom: '4px', color: 'var(--text-primary)' }}>AWS Guide Integration</strong>
                <p style={{ color: 'var(--text-secondary)' }}>{drawerNode.guide}</p>
              </div>

              <div>
                <strong style={{ display: 'block', marginBottom: '6px', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <FileCode size={14} />
                  Configuration Template
                </strong>
                <pre className="drawer-code">{drawerNode.config}</pre>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// ==========================================
// 3. INTERACTIVE SSH TERMINAL SIMULATOR
// ==========================================
function SshSimulator() {
  const [currentStep, setCurrentStep] = useState(0);
  const [terminalHistory, setTerminalHistory] = useState([
    { type: 'system', text: 'Welcome to the EC2 Deployment Simulator.' },
    { type: 'system', text: 'To begin, establish an SSH tunnel to your server node. Execute step 1.' }
  ]);
  const [terminalInput, setTerminalInput] = useState('');
  const [nanoVisible, setNanoVisible] = useState(false);
  const [nanoContent, setNanoContent] = useState('');
  const terminalEndRef = useRef(null);

  const guideSteps = [
    {
      title: "SSH Server Connection",
      cmd: "ssh -i key.pem ubuntu@54.210.85.12",
      desc: "Connect to your newly initialized EC2 server using your private key and Ubuntu user.",
      output: [
        "The authenticity of host '54.210.85.12' can't be established.",
        "ECDSA key fingerprint is SHA256:7uK+aP98K1d...",
        "Are you sure you want to continue connecting (yes/no)? yes",
        "Warning: Permanently added '54.210.85.12' (ECDSA) to the list of known hosts.",
        "Welcome to Ubuntu 22.04 LTS (GNU/Linux 5.15.0-generic x86_64)",
        "ubuntu@ip-172-31-41-105:~$ "
      ]
    },
    {
      title: "Refresh Package Catalog",
      cmd: "sudo apt update",
      desc: "Update apt indices to ensure package installations obtain the latest releases.",
      output: [
        "Hit:1 http://us-east-1.ec2.archive.ubuntu.com/ubuntu jammy InRelease",
        "Get:2 http://security.ubuntu.com/ubuntu jammy-security InRelease [110 kB]",
        "Fetched 110 kB in 1s (95.1 kB/s)",
        "Reading package lists... Done",
        "Building dependency tree... Done",
        "ubuntu@ip-172-31-41-105:~$ "
      ]
    },
    {
      title: "Install Node.js Runtime",
      cmd: "curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash - && sudo apt install -y nodejs",
      desc: "Retrieve the NodeSource setup script and install Node.js along with npm package manager.",
      output: [
        "## Installing the NodeSource Node.js 18.x repo...",
        "## Confirming system release... Ubuntu Jammy",
        "## Running apt-get update...",
        "Selecting previously unselected package nodejs.",
        "Unpacking nodejs (18.16.0-1nodesource1)...",
        "Setting up nodejs (18.16.0-1nodesource1)...",
        "Node.js successfully installed! npm v9.5.1",
        "ubuntu@ip-172-31-41-105:~$ "
      ]
    },
    {
      title: "Install PM2 globally",
      cmd: "sudo npm install -g pm2",
      desc: "PM2 guarantees your backend runs 24/7. It restarts processes if they crash and restarts on reboot.",
      output: [
        "npm WARN deprecated uuid@3.4.0: Please upgrade to version 7 or higher...",
        "added 184 packages, and audited 185 packages in 4s",
        "PM2 Process Daemon successfully started.",
        "ubuntu@ip-172-31-41-105:~$ "
      ]
    },
    {
      title: "Start PM2 Server Process",
      cmd: "pm2 start server.js --name \"cloud-dashboard\"",
      desc: "Run the Express server process. It binds port 5000 inside the background runtime daemon.",
      output: [
        "┌────┬───────────────────┬──────────┬──────┬───────────┬──────────┬──────────┐",
        "│ id │ name              │ mode     │ status│ cpu       │ memory   │ watching │",
        "├────┼───────────────────┼──────────┼──────┼───────────┼──────────┼──────────┤",
        "│ 0  │ cloud-dashboard   │ fork     │ online│ 0.1%      │ 32.5mb   │ disabled │",
        "└────┴───────────────────┴──────────┴──────┴───────────┴──────────┴──────────┘",
        "Use `pm2 show <id>` to inspect details.",
        "ubuntu@ip-172-31-41-105:~$ "
      ]
    },
    {
      title: "Install Nginx Web Server",
      cmd: "sudo apt install nginx -y",
      desc: "Retrieve and install Nginx, which will serve as our internet-facing reverse proxy server.",
      output: [
        "Reading package lists... Done",
        "Setting up nginx (1.18.0-6ubuntu14)...",
        "Systemctl starting nginx...",
        "nginx daemon active and listening on port 80.",
        "ubuntu@ip-172-31-41-105:~$ "
      ]
    },
    {
      title: "Configure Nginx Reverse Proxy",
      cmd: "sudo nano /etc/nginx/sites-available/default",
      desc: "Open Nano editor to direct public port 80 traffic internally to port 5000.",
      output: [],
      special: 'nano'
    },
    {
      title: "Reload Nginx Daemon",
      cmd: "sudo systemctl restart nginx",
      desc: "Flush configurations and restart the Nginx service to load the new proxy guidelines.",
      output: [
        "Restarting nginx service...",
        "Validation successful. Nginx active and running config.",
        "Deployment Complete! Your site is live.",
        "ubuntu@ip-172-31-41-105:~$ "
      ]
    }
  ];

  useEffect(() => {
    // Scroll terminal to bottom
    if (terminalEndRef.current) {
      terminalEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [terminalHistory, nanoVisible]);

  const handleCommandSubmit = (e) => {
    e.preventDefault();
    if (!terminalInput.trim()) return;

    const cmd = terminalInput.trim();
    const step = guideSteps[currentStep];

    setTerminalHistory(prev => [...prev, { type: 'input', text: cmd }]);
    setTerminalInput('');

    // Check if the command matches the expected step command
    if (cmd === step.cmd) {
      executeStep(step);
    } else {
      setTerminalHistory(prev => [
        ...prev, 
        { type: 'error', text: `Command not recognized. Expected command: "${step.cmd}"` },
        { type: 'system', text: `Tip: You can click the "Autofill" button inside the sidebar instructions to execute the command.` }
      ]);
    }
  };

  const executeStep = (step) => {
    if (step.special === 'nano') {
      setTerminalHistory(prev => [...prev, { type: 'system', text: 'Launching Nginx file editor...' }]);
      setTimeout(() => {
        setNanoContent(`# Nginx reverse proxy configuration
server {
    listen 80 default_server;
    listen [::]:80 default_server;

    server_name _;

    location / {
        # Redirect port 80 traffic to node server on port 5000
        proxy_pass http://localhost:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}`);
        setNanoVisible(true);
      }, 800);
    } else {
      setTerminalHistory(prev => [...prev, { type: 'system', text: 'Executing...' }]);
      
      setTimeout(() => {
        setTerminalHistory(prev => [
          ...prev.slice(0, -1), // Remove the "Executing..." line
          ...step.output.map(line => ({ 
            type: line.includes('ubuntu@') ? 'input-prompt' : 'output', 
            text: line 
          }))
        ]);
        
        setCurrentStep(prev => prev + 1);
      }, 1000);
    }
  };

  const saveNano = () => {
    setNanoVisible(false);
    setTerminalHistory(prev => [
      ...prev,
      { type: 'output', text: 'File "/etc/nginx/sites-available/default" written successfully. Nano Closed.' },
      { type: 'input-prompt', text: 'ubuntu@ip-172-31-41-105:~$ ' }
    ]);
    setCurrentStep(prev => prev + 1);
  };

  const autofillCommand = (cmd) => {
    setTerminalInput(cmd);
  };

  const resetSimulator = () => {
    setCurrentStep(0);
    setNanoVisible(false);
    setTerminalHistory([
      { type: 'system', text: 'Welcome to the EC2 Deployment Simulator.' },
      { type: 'system', text: 'To begin, establish an SSH tunnel to your server node. Execute step 1.' }
    ]);
  };

  return (
    <div className="terminal-layout">
      {/* Left panel: Guide instructions */}
      <div className="terminal-guide-card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h4 style={{ fontSize: '15px', fontWeight: 'bold' }}>Linux Instructions</h4>
          {currentStep > 0 && (
            <button onClick={resetSimulator} className="btn-icon" style={{ fontSize: '11px', color: 'var(--aws-orange)' }}>
              Reset Lab
            </button>
          )}
        </div>

        {guideSteps.map((step, idx) => (
          <div 
            key={idx} 
            className={`guide-step ${currentStep === idx ? 'active' : ''} ${currentStep > idx ? 'completed' : ''}`}
          >
            <div className="step-header">
              <span className={`step-num ${currentStep === idx ? 'active' : ''} ${currentStep > idx ? 'completed' : ''}`}>
                Step {idx + 1} {currentStep > idx && '✓'}
              </span>
            </div>
            <h5 className="step-title">{step.title}</h5>
            <p className="step-desc" style={{ marginTop: '4px' }}>{step.desc}</p>
            
            {currentStep === idx && !nanoVisible && (
              <div className="step-command" onClick={() => autofillCommand(step.cmd)} title="Click to copy into terminal">
                <span>{step.cmd}</span>
                <Play size={12} style={{ opacity: 0.7 }} />
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Right panel: Live Terminal Interface */}
      <div className="terminal-window">
        <div className="terminal-header">
          <div className="terminal-dots">
            <span className="terminal-dot-btn red"></span>
            <span className="terminal-dot-btn yellow"></span>
            <span className="terminal-dot-btn green"></span>
          </div>
          <span>ubuntu@AWS-EC2-Ubuntu-Instance: ~</span>
          <Terminal size={14} />
        </div>

        {nanoVisible ? (
          <div className="nano-editor">
            <div className="nano-header">GNU nano 6.2 - /etc/nginx/sites-available/default</div>
            <textarea 
              className="nano-content" 
              value={nanoContent}
              onChange={(e) => setNanoContent(e.target.value)}
            />
            <div className="nano-footer">
              <span>^G Get Help  ^O Write Out  ^W Where Is  ^K Cut    ^J Justify  ^C Cur Pos</span>
              <button 
                onClick={saveNano} 
                style={{ 
                  backgroundColor: '#fff', 
                  color: '#000', 
                  border: 'none', 
                  padding: '2px 8px', 
                  fontWeight: 'bold', 
                  borderRadius: '3px',
                  cursor: 'pointer' 
                }}
              >
                Ctrl+O & Save Config
              </button>
            </div>
          </div>
        ) : (
          <div className="terminal-body">
            {terminalHistory.map((line, idx) => {
              if (line.type === 'input') {
                return (
                  <div key={idx} className="terminal-line">
                    <span className="terminal-prompt">{currentStep === 0 ? '$' : 'ubuntu@ip-172-31-41-105:~$'}</span>
                    <span style={{ color: '#fff' }}>{line.text}</span>
                  </div>
                );
              }
              if (line.type === 'input-prompt') {
                return (
                  <div key={idx} className="terminal-line">
                    <span className="terminal-prompt">{line.text}</span>
                  </div>
                );
              }
              return (
                <div key={idx} className={`terminal-line ${line.type}`}>
                  {line.text}
                </div>
              );
            })}
            
            {currentStep < guideSteps.length ? (
              <form onSubmit={handleCommandSubmit} className="terminal-prompt-line">
                <span className="terminal-prompt">
                  {currentStep === 0 ? 'guest@localhost:~$' : 'ubuntu@ip-172-31-41-105:~$'}
                </span>
                <input 
                  type="text" 
                  className="terminal-input"
                  value={terminalInput}
                  onChange={(e) => setTerminalInput(e.target.value)}
                  autoFocus
                  placeholder={guideSteps[currentStep] ? `type: "${guideSteps[currentStep].cmd}"` : ''}
                />
              </form>
            ) : (
              <div style={{ color: 'var(--success-green)', fontWeight: 'bold', marginTop: '10px' }}>
                🎉 AWS EC2 Nginx Server configured successfully! PM2 process online.
              </div>
            )}
            <div ref={terminalEndRef}></div>
          </div>
        )}
      </div>
    </div>
  );
}

// ==========================================
// 4. METRICS & LOGS PANEL
// ==========================================
function MonitoringPanel({ stats, logs, cpuHistory, latencyHistory }) {
  // Helpers to draw path for custom SVG chart
  const getSvgPath = (data, width = 450, height = 150, maxVal = 100) => {
    const pointsCount = data.length;
    if (pointsCount === 0) return '';
    
    const xStep = width / (pointsCount - 1);
    
    return data.map((val, idx) => {
      const x = idx * xStep;
      // SVG Y-coordinate starts from top, so we subtract scaled value from height
      const y = height - (Math.min(val, maxVal) / maxVal) * (height - 20) - 10;
      return `${idx === 0 ? 'M' : 'L'} ${x} ${y}`;
    }).join(' ');
  };

  const getSvgFillPath = (linePath, width = 450, height = 150) => {
    if (!linePath) return '';
    return `${linePath} L ${width} ${height} L 0 ${height} Z`;
  };

  const maxCpu = 100;
  const maxLatency = 50; // ms scale for charts

  const cpuPath = getSvgPath(cpuHistory, 450, 150, maxCpu);
  const cpuFill = getSvgFillPath(cpuPath, 450, 150);

  const latencyPath = getSvgPath(latencyHistory, 450, 150, maxLatency);
  const latencyFill = getSvgFillPath(latencyPath, 450, 150);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <div className="monitor-grid">
        
        {/* CPU Chart */}
        <div className="card">
          <div className="card-header">
            <h3 className="card-title">
              <Cpu size={16} style={{ color: '#ff9900' }} />
              EC2 instance CPU Utilization (%)
            </h3>
            <span style={{ fontSize: '12px', color: 'var(--success-green)' }}>
              Real-time update: {stats?.system?.cpuUsage ? `${stats.system.cpuUsage}%` : 'Polling...'}
            </span>
          </div>

          <div className="chart-svg-container">
            <span className="chart-value-label">{stats?.system?.cpuUsage ? `${stats.system.cpuUsage}%` : '8.2%'} CPU</span>
            <svg viewBox="0 0 450 150" className="chart-svg">
              <defs>
                <linearGradient id="chart-gradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--aws-orange)" stopOpacity="0.4" />
                  <stop offset="100%" stopColor="var(--aws-orange)" stopOpacity="0" />
                </linearGradient>
              </defs>
              {/* Grid Lines */}
              <line x1="0" y1="30" x2="450" y2="30" className="chart-grid-line" />
              <line x1="0" y1="75" x2="450" y2="75" className="chart-grid-line" />
              <line x1="0" y1="120" x2="450" y2="120" className="chart-grid-line" />
              
              {/* Fill area */}
              <path d={cpuFill} className="chart-gradient-fill" />
              
              {/* Line path */}
              <path d={cpuPath} className="chart-data-line" />
            </svg>
          </div>
        </div>

        {/* Latency Chart */}
        <div className="card">
          <div className="card-header">
            <h3 className="card-title">
              <Activity size={16} style={{ color: '#06b6d4' }} />
              API Server Request Latency (ms)
            </h3>
            <span style={{ fontSize: '12px', color: 'var(--accent-cyan)' }}>
              Latest Request: {logs[0]?.duration ? `${logs[0].duration}ms` : '15ms'}
            </span>
          </div>

          <div className="chart-svg-container">
            <span className="chart-value-label" style={{ color: 'var(--accent-cyan)' }}>
              {logs[0]?.duration ? `${logs[0].duration}ms` : '12ms'} Latency
            </span>
            <svg viewBox="0 0 450 150" className="chart-svg">
              <defs>
                <linearGradient id="latency-gradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--accent-cyan)" stopOpacity="0.4" />
                  <stop offset="100%" stopColor="var(--accent-cyan)" stopOpacity="0" />
                </linearGradient>
              </defs>
              {/* Grid Lines */}
              <line x1="0" y1="30" x2="450" y2="30" className="chart-grid-line" />
              <line x1="0" y1="75" x2="450" y2="75" className="chart-grid-line" />
              <line x1="0" y1="120" x2="450" y2="120" className="chart-grid-line" />
              
              {/* Fill area */}
              <path d={latencyFill} className="chart-gradient-fill" fill="url(#latency-gradient)" />
              
              {/* Line path */}
              <path d={latencyPath} className="chart-data-line" style={{ stroke: 'var(--accent-cyan)' }} />
            </svg>
          </div>
        </div>

      </div>

      {/* Live Server request logs terminal */}
      <div className="card">
        <div className="card-header">
          <h3 className="card-title">
            <Terminal size={18} style={{ color: '#10b981' }} />
            Live Cloud Server HTTP Logs (Express middleware stream)
          </h3>
          <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Connected to server-sent events stream</span>
        </div>

        <div className="logs-terminal">
          {logs.length === 0 ? (
            <div style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '50px' }}>
              No incoming server traffic logged yet. Navigate, register, or upload files to see logs stream in.
            </div>
          ) : (
            logs.map((log, idx) => (
              <div key={idx} className="log-entry">
                <span className="log-timestamp">[{new Date(log.timestamp || Date.now()).toLocaleTimeString()}]</span>
                {log.type === 'info' ? (
                  <span style={{ color: 'var(--accent-cyan)' }}>{log.message}</span>
                ) : (
                  <>
                    <span className={`log-method ${log.method}`}>{log.method}</span>
                    <span className="log-url">{log.url}</span>
                    <span className={`log-status ${log.status >= 500 ? 'server-error' : log.status >= 400 ? 'client-error' : 'success'}`}>
                      {log.status}
                    </span>
                    <span className="log-latency">{log.duration}ms</span>
                  </>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

// ==========================================
// 5. IAM & SECURITY DESIGNER VIEW
// ==========================================
function IamDesigner({ stats }) {
  const [selectedPermissions, setSelectedPermissions] = useState({
    getObject: true,
    putObject: true,
    deleteObject: false,
    listBucket: false
  });

  const availablePermissions = [
    {
      key: 'getObject',
      action: 's3:GetObject',
      desc: 'Allows users to read/download files from the S3 bucket.'
    },
    {
      key: 'putObject',
      action: 's3:PutObject',
      desc: 'Allows the EC2 backend server to upload files to the S3 bucket.'
    },
    {
      key: 'deleteObject',
      action: 's3:DeleteObject',
      desc: 'Allows the EC2 backend server to delete files from the S3 bucket.'
    },
    {
      key: 'listBucket',
      action: 's3:ListBucket',
      desc: 'Allows listing all metadata/objects inside the bucket (administrative).'
    }
  ];

  const handleTogglePermission = (key) => {
    setSelectedPermissions(prev => ({
      ...prev,
      [key]: !prev[key]
    }));
  };

  // Generate IAM Bucket Policy JSON based on active selections
  const generatePolicyJson = () => {
    const actions = [];
    if (selectedPermissions.getObject) actions.push("s3:GetObject");
    if (selectedPermissions.putObject) actions.push("s3:PutObject");
    if (selectedPermissions.deleteObject) actions.push("s3:DeleteObject");
    if (selectedPermissions.listBucket) actions.push("s3:ListBucket");

    const policy = {
      Version: "2012-10-17",
      Statement: [
        {
          Sid: "VisualEditor0",
          Effect: "Allow",
          Principal: {
            AWS: "arn:aws:iam::123456789012:role/EC2-Server-S3-Role"
          },
          Action: actions.length === 1 ? actions[0] : actions,
          Resource: [
            "arn:aws:s3:::cloud-deployment-dashboard-bucket",
            "arn:aws:s3:::cloud-deployment-dashboard-bucket/*"
          ]
        }
      ]
    };

    return JSON.stringify(policy, null, 2);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <div className="iam-builder-container">
        
        {/* Perms Selector */}
        <div className="card">
          <div className="card-header">
            <h3 className="card-title">
              <Key size={18} style={{ color: '#ff9900' }} />
              IAM Policy Visual Designer
            </h3>
          </div>

          <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '20px' }}>
            IAM (Identity and Access Management) defines permissions. Select what API functions the EC2 instance is authorized to perform against your Amazon S3 storage buckets.
          </p>

          <div className="permission-list">
            {availablePermissions.map(perm => (
              <div 
                key={perm.key}
                className={`permission-checkbox-card ${selectedPermissions[perm.key] ? 'selected' : ''}`}
                onClick={() => handleTogglePermission(perm.key)}
              >
                <input 
                  type="checkbox" 
                  className="checkbox-input"
                  checked={selectedPermissions[perm.key]}
                  onChange={() => {}} // Controlled via card click
                />
                <div className="permission-details">
                  <span className="permission-action">{perm.action}</span>
                  <span className="permission-desc">{perm.desc}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* JSON Policy Output */}
        <div className="card" style={{ display: 'flex', flexDirection: 'column' }}>
          <div className="card-header">
            <h3 className="card-title">
              <ShieldCheck size={18} style={{ color: '#ff9900' }} />
              AWS Bucket Policy JSON Document
            </h3>
          </div>

          <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '16px' }}>
            This policy must be pasted into the S3 bucket "Bucket Policy" configuration panel within the AWS console to grant access.
          </p>

          <pre style={{ 
            flex: 1, 
            fontFamily: 'var(--font-mono)', 
            fontSize: '12px', 
            backgroundColor: '#05070c', 
            padding: '16px', 
            borderRadius: '6px',
            color: '#a9b1d6',
            border: '1px solid var(--border-color)',
            overflowX: 'auto'
          }}>
            {generatePolicyJson()}
          </pre>
        </div>

      </div>

      {/* EC2 security group rules info card */}
      <div className="card">
        <div className="card-header">
          <h3 className="card-title">
            <Lock size={18} style={{ color: '#ef4444' }} />
            EC2 Security Group Networking Configuration
          </h3>
        </div>

        <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '16px' }}>
          Security groups act as a virtual firewall for your EC2 instance to control inbound and outbound traffic. For this deployment dashboard application to work correctly on AWS, configure these security group rules:
        </p>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
          
          <div style={{ border: '1px solid var(--border-color)', borderRadius: '8px', padding: '16px', backgroundColor: 'rgba(255, 255, 255, 0.01)' }}>
            <span style={{ display: 'block', fontSize: '11px', color: 'var(--text-muted)', fontWeight: 'bold' }}>PORT 22 (SSH)</span>
            <span style={{ display: 'block', fontSize: '16px', fontWeight: 'bold', color: 'var(--aws-orange)', margin: '4px 0' }}>Admin Console</span>
            <p style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
              Allows you to connect to the shell command line of the server. Restrict this to **"My IP"** in production for security.
            </p>
          </div>

          <div style={{ border: '1px solid var(--border-color)', borderRadius: '8px', padding: '16px', backgroundColor: 'rgba(255, 255, 255, 0.01)' }}>
            <span style={{ display: 'block', fontSize: '11px', color: 'var(--text-muted)', fontWeight: 'bold' }}>PORT 80 (HTTP)</span>
            <span style={{ display: 'block', fontSize: '16px', fontWeight: 'bold', color: 'var(--success-green)', margin: '4px 0' }}>Web Traffic</span>
            <p style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
              Open to **"Anywhere (0.0.0.0/0)"** so browsers can load your Nginx front page. Nginx forwards this to backend.
            </p>
          </div>

          <div style={{ border: '1px solid var(--border-color)', borderRadius: '8px', padding: '16px', backgroundColor: 'rgba(255, 255, 255, 0.01)' }}>
            <span style={{ display: 'block', fontSize: '11px', color: 'var(--text-muted)', fontWeight: 'bold' }}>PORT 443 (HTTPS)</span>
            <span style={{ display: 'block', fontSize: '16px', fontWeight: 'bold', color: 'var(--accent-blue)', margin: '4px 0' }}>Secure Web Traffic</span>
            <p style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
              Open to **"Anywhere (0.0.0.0/0)"**. Required if you bind an SSL Certificate to Nginx (e.g. using Certbot/Let's Encrypt).
            </p>
          </div>

        </div>
      </div>
    </div>
  );
}
