FROM node:20-alpine

WORKDIR /app
ENV NODE_ENV=production
ENV MCP_TRANSPORT=http
ENV HOST=0.0.0.0
ENV PORT=3000

COPY package*.json ./
RUN npm ci --omit=dev --ignore-scripts

COPY server.mjs README.md LICENSE CHANGELOG.md .env.example ./

EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3000)+'/healthz').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "server.mjs"]
