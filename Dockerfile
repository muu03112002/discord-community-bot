FROM node:18

WORKDIR /app

# 依存関係のインストール前に環境変数を設定
ENV NODE_OPTIONS=--no-warnings

COPY package.json ./
RUN npm install

COPY . .

CMD ["node", "index.js"]
