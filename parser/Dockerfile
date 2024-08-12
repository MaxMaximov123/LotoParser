FROM --platform=linux/amd64 node:18.17

RUN apt-get update && apt-get install -y \
    # for dev purpose
    vim

RUN apt-get update \
	&& apt-get install -y wget gnupg ca-certificates \
	&& wget -q -O - https://dl-ssl.google.com/linux/linux_signing_key.pub | apt-key add - \
	&& sh -c 'echo "deb [arch=amd64] http://dl.google.com/linux/chrome/deb/ stable main" >> /etc/apt/sources.list.d/google.list' \
	&& apt-get update \
	&& apt-get install -y google-chrome-stable \
	&& rm -rf /var/lib/apt/lists/* \
	&& wget --quiet https://raw.githubusercontent.com/vishnubob/wait-for-it/master/wait-for-it.sh -O /usr/sbin/wait-for-it.sh \
	&& chmod +x /usr/sbin/wait-for-it.sh

RUN npm install -g \
	npm@7


WORKDIR /app

COPY parser/package.json parser/package-lock.json ./
RUN npm i -g knex
RUN npm install

ENV IS_HEADLESS=true
ENV IS_DOCKERIZED=true


COPY parser/ ./

CMD ["npm", "run", "start"]
