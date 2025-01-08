FROM node:16-alpine

WORKDIR /app

# Create required directories
RUN mkdir -p uploads logs

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install --production

# Copy source
COPY . .

CMD ["npm", "run", "start:worker2"]