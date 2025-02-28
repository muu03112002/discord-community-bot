FROM node:18

WORKDIR /app

# 依存関係のインストール前に環境変数を設定
ENV NODE_OPTIONS="--no-warnings --experimental-modules"

COPY package.json ./
COPY polyfill.js ./
RUN npm install

COPY . .

CMD ["npm", "start"]
