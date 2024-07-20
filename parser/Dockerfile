FROM node:latest

COPY parser/package.json parser/package-lock.json ./
RUN npm install

COPY ./ ./

WORKDIR "/parser"

CMD ["npm", "run", "start"]