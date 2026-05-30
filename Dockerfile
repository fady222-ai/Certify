FROM node:18-alpine

WORKDIR /app

RUN apk add --no-cache python3 make g++

COPY package.json .
RUN npm install --production

COPY . .

# مجلد البيانات الثابت — يُربط بـ Persistent Volume على Railway
# DB_PATH و UPLOADS_DIR يشيران لهذا المجلد
RUN mkdir -p /data/uploads

EXPOSE 3000

ENV PERSISTENT_DIR=/data
# CENTRAL_SERVER_URL مطلوب — يُضبط في Railway Variables ولا قيمة افتراضية له
# (إن لم يُضبط، التفعيل ومزامنة الكيانات ستفشل بصراحة)

CMD ["node", "app.js"]
