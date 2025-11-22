FROM node:20

WORKDIR /app

COPY package*.json ./

RUN npm install && npm install -g pm2

COPY . .

EXPOSE 3000

CMD ["pm2-runtime", "start", "server.js", "-i", "max"]
