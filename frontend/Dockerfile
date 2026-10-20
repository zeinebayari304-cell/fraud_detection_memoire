# 1) Construction de l'interface React (Vite)
FROM node:22-slim AS build
WORKDIR /app

COPY package.json package-lock.json ./
# Le fichier de verrouillage ne liste pas les binaires natifs de rolldown pour
# toutes les plateformes (bogue npm connu) : on installe celui de Linux.
RUN npm ci --legacy-peer-deps --no-audit --no-fund \
    && version=$(node -p "require('./node_modules/rolldown/package.json').version") \
    && arch=$(node -p "process.arch") \
    && npm install --no-save --legacy-peer-deps --no-audit --no-fund \
       "@rolldown/binding-linux-${arch}-gnu@${version}"

COPY . .
# L'API est jointe par le même domaine, sous /api (proxy nginx).
ARG VITE_API_URL=/api
ENV VITE_API_URL=${VITE_API_URL}
RUN npm run build

# 2) Service des fichiers statiques + proxy vers l'API
FROM nginx:1.27-alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
