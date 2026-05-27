FROM node:20-bullseye

RUN apt-get update && apt-get install -y \
    libreoffice \
    libreoffice-writer \
    libreoffice-core \
    libreoffice-common \
    libreoffice-java-common \
    default-jre \
    ghostscript \
    fonts-dejavu \
    && apt-get clean

WORKDIR /app

COPY package*.json ./

RUN npm install

COPY . .

RUN npm run build

ENV SOFFICE_PATH=/usr/bin/soffice

EXPOSE 8080

CMD ["npm", "start"]