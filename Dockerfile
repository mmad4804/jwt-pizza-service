# Stage 1: Build dependencies
FROM --platform=$BUILDPLATFORM node:22-alpine AS build
WORKDIR /usr/src/app
COPY package*.json ./
# Install ALL dependencies (including dev) for any potential build scripts
RUN npm ci

# Stage 2: Final Runtime
FROM node:22-alpine
WORKDIR /usr/src/app

# Copy everything from the build stage
COPY --from=build /usr/src/app/node_modules ./node_modules
COPY . .

# Since bcrypt is the problem, we force a re-install/re-build of JUST bcrypt 
# to ensure it matches the target architecture (ARM64)
RUN apk add --no-cache make gcc g++ python3 \
    && npm rebuild bcrypt --build-from-source \
    && apk del make gcc g++ python3

EXPOSE 80
CMD ["node", "index.js", "80"]