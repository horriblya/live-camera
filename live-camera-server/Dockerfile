FROM node:22

WORKDIR /usr/app

# Copy package files
COPY package*.json ./

# Install dependencies from package.json
RUN npm install

# Copy source code
COPY . .

# Expose the application port
EXPOSE 3001

CMD ["node", "server.js"]