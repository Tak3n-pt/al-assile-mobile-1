FROM node:20-alpine

RUN apk add --no-cache python3 make g++ wget ca-certificates

# Install Litestream
RUN ARCH=$(uname -m); \
    if [ "$ARCH" = "x86_64" ]; then LS_ARCH="amd64"; else LS_ARCH="arm64"; fi; \
    wget -qO /tmp/ls.tar.gz "https://github.com/benbjohnson/litestream/releases/download/v0.3.13/litestream-v0.3.13-linux-${LS_ARCH}.tar.gz" \
    && tar -xzf /tmp/ls.tar.gz -C /usr/local/bin \
    && rm /tmp/ls.tar.gz

WORKDIR /app

# Install server dependencies
COPY package*.json ./
RUN npm install

# Copy server
COPY server/ ./server/

# Install and build mobile frontend
COPY mobile/package*.json ./mobile/
RUN cd mobile && npm install

COPY mobile/ ./mobile/
RUN cd mobile && npm run build

# Litestream config and startup script
COPY litestream.yml /etc/litestream.yml
COPY start.sh /start.sh
RUN chmod +x /start.sh

EXPOSE 3000

CMD ["/start.sh"]
