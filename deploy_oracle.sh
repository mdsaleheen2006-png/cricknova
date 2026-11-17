#!/bin/bash
set -e

echo "=========================================================="
echo "🚀 CRICKNOVA - Oracle Cloud Always Free 1-Click Deployment"
echo "=========================================================="

# 1. Update system & install docker if not installed
if ! command -v docker &> /dev/null; then
    echo "📦 Installing Docker & Docker Compose..."
    sudo apt-get update -y
    sudo apt-get install -y ca-certificates curl gnupg lsb-release git
    sudo mkdir -p /etc/apt/keyrings
    curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg --yes
    echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
    sudo apt-get update -y
    sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin
    sudo systemctl enable docker
    sudo systemctl start docker
fi

# 2. Fix Ubuntu / Oracle Cloud firewall (iptables / ufw) to allow incoming web traffic
echo "🔓 Configuring firewall for Port 80 & 8000..."
sudo iptables -I INPUT 6 -m state --state NEW -p tcp --dport 80 -j ACCEPT 2>/dev/null || true
sudo iptables -I INPUT 6 -m state --state NEW -p tcp --dport 8000 -j ACCEPT 2>/dev/null || true
sudo iptables -I INPUT 6 -m state --state NEW -p tcp --dport 443 -j ACCEPT 2>/dev/null || true

# 3. Build & Run CrickNova Docker Container
echo "🏗️ Building and running CrickNova container..."
sudo docker compose down 2>/dev/null || sudo docker-compose down 2>/dev/null || true
sudo docker compose up -d --build || sudo docker-compose up -d --build

SERVER_IP=$(curl -s -4 ifconfig.me || curl -s -4 icanhazip.com || echo "your-server-ip")

echo ""
echo "=========================================================="
echo "✅ CRICKNOVA IS NOW RUNNING 24/7 ON ORACLE CLOUD!"
echo "🌐 Open your browser and visit: http://$SERVER_IP"
echo "=========================================================="
