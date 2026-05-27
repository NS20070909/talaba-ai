FROM node:20-bullseye

RUN apt-get update && apt-get install -y \
    libreoffice \
    libreoffice-writer \
    libreoffice-core \
    libreoffice-common \
    ghostscript \
    fonts-dejavu \
    python3 \
    python3-pip \
    && apt-get clean

RUN pip3 install pdf2docx

WORKDIR /app

COPY package*.json ./

RUN npm install

COPY . .

RUN npm run build

ENV SOFFICE_PATH=/usr/bin/soffice

EXPOSE 8080

CMD ["npm", "start"]