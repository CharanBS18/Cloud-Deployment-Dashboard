# ☁️ Cloud Deployment Dashboard & AWS Learning Sandbox

Welcome to the **Cloud Deployment Dashboard**! This project is an interactive, hands-on learning sandbox designed to teach real cloud engineering and devops basics. It comprises:
1. A fully functional **Node.js + Express API** and **React Web App** that enables user accounts, file uploads, storage tracking, and live telemetry log streaming.
2. A built-in **AWS SSH Terminal Simulator** that lets you walk through the command-line setup of launching a server on AWS EC2 before deploying it live.
3. Interactive architecture visuals and IAM policy builders to master AWS security groups and object storage access.

---

## 🧱 Cloud Deployment Architecture

```
                                      +---------------------------------------------+
                                      |            AWS EC2 Virtual Server           |
                                      |                                             |
Public User ----> [Route 53 DNS] ----> [Nginx Reverse Proxy] ----> [Express API]    |
                                      |      (Port 80/443)            (Port 5000)   |
                                      +------------------------------------+--------+
                                                                           |
                                                                           |
                                                                           v
                                                                   [Amazon S3 Bucket]
                                                                    (Object Storage)
```

---

## 🚀 Quick Start (Local Development)

### 1. Pre-requisites
- **Node.js** (v18.x or higher)
- **npm** (v9.x or higher)

### 2. Installation
Install all dependencies in the root directory:
```bash
npm run install:all
```
*This installs root dependencies (`concurrently`), backend node modules, and frontend React packages.*

### 3. Run the Development Servers
Launch both the backend API and frontend Vite server concurrently:
```bash
npm run dev
```
- **Frontend App**: [http://localhost:5173](http://localhost:5173)
- **Backend API**: [http://localhost:5000](http://localhost:5000)

*Log in or create a developer account in the app UI to unlock the dashboard panels.*

---

## 📖 Step-by-Step AWS Deployment Handbook

Below is the complete blueprint to deploy this application to live Amazon Web Services (AWS) infrastructure.

---

### Phase 1: Launch & Configure AWS EC2 Server
1. **AWS Console**: Log in to AWS and navigate to **EC2 Dashboard**.
2. **Launch Instance**:
   - **Name**: `cloud-deployment-dashboard`
   - **OS (AMI)**: `Ubuntu Server 22.04 LTS (HVM), SSD Volume Type`
   - **Instance Type**: `t2.micro` (Free Tier Eligible)
   - **Key Pair**: Create a new key pair (.pem) named `my-ec2-key.pem` and download it to your local machine.
3. **Security Groups (Firewall)**:
   Create a Security Group with these **Inbound Rules**:
   - `SSH` | Port `22` | Source: `My IP` (Protects server from brute-force attempts)
   - `HTTP` | Port `80` | Source: `Anywhere-IPv4 (0.0.0.0/0)`
   - `HTTPS` | Port `443` | Source: `Anywhere-IPv4 (0.0.0.0/0)`

---

### Phase 2: Establish SSH connection
Open your local terminal, move to the folder containing your downloaded `.pem` key, and execute:

```bash
# 1. Modify file permissions so the key is private (required by SSH clients)
chmod 400 my-ec2-key.pem

# 2. Connect to the EC2 server (replace with your EC2 public IPv4 address)
ssh -i my-ec2-key.pem ubuntu@YOUR_EC2_PUBLIC_IP
```

---

### Phase 3: Setup Node.js Environment & PM2
Once logged into your Ubuntu EC2 server console, run the following to install Node.js and PM2:

```bash
# 1. Refresh package cache list
sudo apt update

# 2. Download and install Node.js runtime v18.x
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt install -y nodejs

# 3. Verify installation
node -v && npm -v

# 4. Install PM2 (Process Manager 2) globally
sudo npm install -g pm2
```

---

### Phase 4: Clone App & Start Backend
Clone your codebase onto the EC2 virtual machine and configure environmental variables:

```bash
# 1. Clone repository
git clone https://github.com/YOUR_GITHUB_USER/YOUR_REPO_NAME.git
cd YOUR_REPO_NAME

# 2. Install backend dependencies
cd backend
npm install

# 3. Create production .env file
nano .env
```
Inside the editor, write your production variables:
```env
PORT=5000
JWT_SECRET=use_a_very_long_secure_random_string_here
# Option S3 configs (fill these if connecting S3 bucket)
AWS_ACCESS_KEY_ID=your-aws-access-key-id
AWS_SECRET_ACCESS_KEY=your-aws-secret-access-key
AWS_REGION=us-east-1
AWS_S3_BUCKET=your-cloud-dashboard-bucket
```
Press `Ctrl+O`, `Enter` to write files, then `Ctrl+X` to exit nano.

Now start your server process running in the background:
```bash
# 4. Start backend with PM2
pm2 start server.js --name "cloud-dashboard"

# 5. Set up PM2 to auto-start on server reboot
pm2 startup systemd
# Copy-paste the command printed in your console output by the above step, then run:
pm2 save
```

---

### Phase 5: Nginx Reverse Proxy Setup
Currently, your app runs internally on port 5000. We will set up Nginx web server to listen to incoming public traffic on port 80 (HTTP) and route it internally to port 5000.

```bash
# 1. Install Nginx
sudo apt install nginx -y

# 2. Open default config file
sudo nano /etc/nginx/sites-available/default
```

Replace the contents of the `server` block with the following reverse-proxy directives:

```nginx
server {
    listen 80 default_server;
    listen [::]:80 default_server;

    server_name _;

    location / {
        proxy_pass http://127.0.0.1:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```
Save and exit the editor (`Ctrl+O`, `Enter`, `Ctrl+X`).

```bash
# 3. Validate Nginx syntax
sudo nginx -t

# 4. Restart Nginx service
sudo systemctl restart nginx
```
Now, if you visit `http://YOUR_EC2_PUBLIC_IP` in your browser, Nginx will proxy public HTTP traffic directly into your Node.js application!

---

### Phase 6: Amazon S3 & IAM Role Configuration
To persist uploaded files on scalable cloud object storage:
1. **S3 Bucket Creation**:
   - Open **Amazon S3 Dashboard**.
   - Create a bucket: `cloud-deployment-dashboard-bucket` in your desired region.
   - De-select **"Block all public access"** (if you want public URLs to be accessible directly) or set up signed URLs.
2. **Access Policy**: Add a bucket policy to allow public reads for uploaded assets:
   ```json
   {
     "Version": "2012-10-17",
     "Statement": [
       {
         "Sid": "PublicReadGetObject",
         "Effect": "Allow",
         "Principal": "*",
         "Action": "s3:GetObject",
         "Resource": "arn:aws:s3:::your-bucket-name/*"
       }
     ]
   }
   ```
3. **IAM User Access**:
   - Open **IAM Console** and create a new **User** named `server-uploader`.
   - Attach an inline policy granting `s3:PutObject` and `s3:DeleteObject` permissions targeting your bucket resource.
   - Generate **Access Key ID** and **Secret Access Key** under Security Credentials tab, then update the EC2 `backend/.env` file with these keys. Run `pm2 restart cloud-dashboard`.

---

### Phase 7: Automate Deployments (CI/CD Pipeline)
To auto-deploy changes every time you push code to GitHub:
1. Create a GitHub Action configuration file: `.github/workflows/deploy.yml`
2. Configure it to SSH into your EC2 using credentials saved in your repository **GitHub Secrets** (`EC2_SSH_KEY`, `EC2_HOST`, `EC2_USERNAME`):
   ```yaml
   name: Deploy to EC2
   on:
     push:
       branches: [ main ]
   jobs:
     deploy:
       runs-on: ubuntu-latest
       steps:
       - name: Deploy via SSH
         uses: appleboy/ssh-action@master
         with:
           host: ${{ secrets.EC2_HOST }}
           username: ${{ secrets.EC2_USERNAME }}
           key: ${{ secrets.EC2_SSH_KEY }}
           script: |
             cd /var/www/your-app-repo
             git pull origin main
             cd backend
             npm install
             pm2 restart cloud-dashboard
   ```

You are now a certified cloud practitioner with hands-on networking, server administration, and infrastructure skills! 🚀
# Cloud-Deployment-Dashboard
