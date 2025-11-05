FROM node:18-alpine

WORKDIR /app

COPY package.json package.json

RUN npm install

COPY tsconfig.json tsconfig.json
COPY src ./src

RUN npm run build

ENV PORT=1234
ENV DAYTONA_API_URL=https://app.daytona.io/api

EXPOSE ${PORT}

CMD ["node", "dist/index.js"]
