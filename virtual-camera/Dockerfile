FROM node:22

WORKDIR /app

# Install system dependencies FIRST (these change rarely)
RUN apt-get update && apt-get install -y ffmpeg && rm -rf /var/lib/apt/lists/*

# Copy package files (these change relatively rarely)
COPY package*.json ./

# Install npm dependencies (these change rarely)
RUN npm install

# Copy source code LAST (this changes frequently)
COPY . .

# Expose the application port
EXPOSE 8080

CMD ["node", "server.js"]