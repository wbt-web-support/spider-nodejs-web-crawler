# Use Node.js 18 Alpine for smaller image size
FROM node:18-alpine

# Install system dependencies for Rust compilation
RUN apk add --no-cache \
    python3 \
    make \
    g++ \
    curl \
    wget \
    openssl-dev \
    cargo \
    rustc

# Set working directory
WORKDIR /app

# Copy package files first for better caching
COPY package*.json ./

# Install only production dependencies
RUN npm install --omit=optional --omit=dev

# Copy source code
COPY . .

# Build Rust components
RUN cargo build --release

# Expose port
EXPOSE 3001

# Set environment variables
ENV NODE_ENV=production
ENV PORT=3001

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:3001/health || exit 1

# Start the application directly
CMD ["node", "simple-api.js"]