# Base image for nodejs (latest LTS version)
FROM node:lts

# Set the shell to bash
SHELL ["/bin/bash", "-c"]

# Add nano to the image for config convenience
RUN apt-get update && apt-get install -y nano

# Create app directory
WORKDIR /usr/src/app

# Copy in the app source code
COPY . .

# Rename template-config-docker-only.json to config.json
RUN mv config/template-config-docker-only.json config/config.json

# Install the production dependencies
RUN npm ci --only=production

# Set the node environment to production
ENV NODE_ENV production

# Set the node max heap memory to 6GB
# This is very overkill, but this makes sure a heap memory error doesn't occur
ENV NODE_OPTIONS --max-old-space-size=6144

# Define the app run command
CMD [ "npm", "run", "start" ]