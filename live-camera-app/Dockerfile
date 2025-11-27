FROM node:22

WORKDIR /usr/app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy source code
COPY . .

# Expose the application port
EXPOSE 3000

CMD ["npm", "start"]