# syntax=docker/dockerfile:1.3

ARG TARGET=agent
# Builder stage
FROM debian:12-slim AS builder
ARG ZTM_VERSION
ARG TARGETARCH

# Install dependencies and download the binary
RUN apt-get update && apt-get install -y curl tar && rm -rf /var/lib/apt/lists/*
RUN ARCH=$TARGETARCH && \
    if [ "$TARGETARCH" = "amd64" ]; then ARCH="x86_64"; fi && \
    mkdir -p /ztm && \
    curl -sL https://github.com/flomesh-io/ztm/releases/download/v${ZTM_VERSION}/ztm-aio-v${ZTM_VERSION}-generic_linux-${ARCH}.tar.gz \
    | tar -xz -C /ztm

RUN chmod +x /ztm/bin/ztm

# Final stage (base image for both hub and agent)
FROM debian:12-slim AS minimal

# Create user and setup environment
RUN useradd -m -d /home/ztm ztm && \
    mkdir -p /etc/ztm /permit && \
    chown -R ztm:ztm /home/ztm /etc/ztm /permit

COPY --from=builder /ztm/bin/ztm /usr/local/bin/ztm
RUN chmod +x /usr/local/bin/ztm
WORKDIR /home/ztm

# Hub stage
FROM minimal AS hub

# Set environment variables
ENV ZTM_NAMES=${ZTM_NAMES:-0.0.0.0}
ENV ZTM_PORT=${ZTM_PORT:-8888}

# Expose the required port
EXPOSE ${ZTM_PORT}

# Copy entrypoint script and set permissions
COPY hub-docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

# Change ownership to ztm user
RUN chown ztm:ztm /usr/local/bin/docker-entrypoint.sh

# Switch to ztm user
USER ztm

# Entrypoint to start the services
ENTRYPOINT ["/usr/local/bin/docker-entrypoint.sh"]

# Agent stage
FROM minimal AS agent

# Set environment variables
ENV ZTM_JOIN_MESH=${ZTM_JOIN_MESH}
ENV ZTM_ENDPOINT=${ZTM_ENDPOINT}

ENV ZTM_PORT=${ZTM_PORT:-7777}
ENV ZTM_PERMIT=${ZTM_PERMIT:-/permit}

# Expose the required port
EXPOSE ${ZTM_PORT}

# Copy entrypoint script and set permissions
COPY agent-docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

# Change ownership to ztm user
RUN chown ztm:ztm /usr/local/bin/docker-entrypoint.sh

# Switch to ztm user
USER ztm

# Entrypoint to start the services
ENTRYPOINT ["/usr/local/bin/docker-entrypoint.sh"]

FROM ${TARGET}
