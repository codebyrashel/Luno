# Use Node.js as the base image
FROM node:20-slim

# Install Python, ffmpeg, and yt-dlp
RUN apt-get update && apt-get install -y \
    python3 \
    python3-pip \
    ffmpeg \
    && rm -rf /var/lib/apt/lists/* \
    && pip3 install yt-dlp --break-system-packages

# Set working directory inside container
WORKDIR /app

# Copy package files first (for better caching)
COPY package*.json ./

# Install Node.js dependencies
RUN npm ci

# Copy your entire bot code
COPY . .

# Start your bot
CMD ["node", "index.js"]