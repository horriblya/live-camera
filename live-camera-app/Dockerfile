FROM node:22

WORKDIR /usr/app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy source code
COPY . .

ENV PORT=30001

# Expose the application port
EXPOSE 30001

CMD ["npm", "start"]