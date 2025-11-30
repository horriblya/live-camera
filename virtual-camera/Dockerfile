FROM node:22

WORKDIR /app

# Copy package files
COPY package*.json ./

RUN npm install

# Copy source code
COPY . .

# ffmpeg
RUN apt-get update && apt-get install -y ffmpeg

# Expose the application port
EXPOSE 8080

CMD ["node", "server.js"]