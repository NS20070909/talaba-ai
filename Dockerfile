FROM node:20-bullseye

RUN apt-get update && apt-get install -y \
    poppler-utils \
    libreoffice \
    libreoffice-writer \
    libreoffice-core \
    libreoffice-common \
    ghostscript \
    fonts-dejavu \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package*.json ./

RUN npm install

COPY . .

RUN npm run build

ENV SOFFICE_PATH=/usr/bin/soffice

EXPOSE 8080

CMD ["npm", "start"]