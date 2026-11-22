FROM debian:bookworm-slim AS build
RUN apt-get update && apt-get install -y --no-install-recommends g++ cmake git make libsqlite3-dev libcurl4-openssl-dev libssl-dev ca-certificates && rm -rf /var/lib/apt/lists/*
WORKDIR /src
COPY CMakeLists.txt ./
COPY include ./include
COPY src ./src
COPY tests/ev_tests.cpp ./tests/ev_tests.cpp
COPY database/seed/customer_catalog.json ./database/seed/customer_catalog.json
RUN cmake -S . -B /build -DEV_BUILD_WEB_API=ON -DBUILD_TESTING=OFF -DCMAKE_BUILD_TYPE=Release && cmake --build /build -j2 --target ev_web_api

FROM debian:bookworm-slim AS litestream
ARG LITESTREAM_VERSION=v0.3.13
RUN apt-get update && apt-get install -y --no-install-recommends curl ca-certificates && rm -rf /var/lib/apt/lists/*
RUN set -eu; arch="$(dpkg --print-architecture)"; \
    case "$arch" in \
      amd64) sum=eb75a3de5cab03875cdae9f5f539e6aedadd66607003d9b1e7a9077948818ba0 ;; \
      arm64) sum=9585f5a508516bd66af2b2376bab4de256a5ef8e2b73ec760559e679628f2d59 ;; \
      *) echo "Unsupported architecture $arch" >&2; exit 1 ;; \
    esac; \
    curl -fsSL -o /tmp/litestream.tgz "https://github.com/benbjohnson/litestream/releases/download/${LITESTREAM_VERSION}/litestream-${LITESTREAM_VERSION}-linux-${arch}.tar.gz"; \
    echo "$sum  /tmp/litestream.tgz" | sha256sum -c -; \
    tar -xzf /tmp/litestream.tgz -C /usr/local/bin litestream

FROM debian:bookworm-slim
RUN apt-get update && apt-get install -y --no-install-recommends nginx python3 python3-venv libsqlite3-0 libcurl4 libssl3 libstdc++6 ca-certificates && rm -rf /var/lib/apt/lists/*
COPY --from=litestream /usr/local/bin/litestream /usr/local/bin/litestream
WORKDIR /app
COPY ocpp-simulator/requirements.txt /app/requirements.txt
COPY ocpp-gateway/requirements.txt /app/gateway-requirements.txt
RUN python3 -m venv /app/venv && /app/venv/bin/pip install --no-cache-dir -r /app/requirements.txt -r /app/gateway-requirements.txt
COPY --from=build /build/ev_web_api /app/ev_web_api
COPY frontend /app/frontend
COPY database/seed/customer_catalog.json /app/customer_catalog.json
COPY database/seed/public_stations.json /app/public_stations.json
COPY ocpp-simulator/customer_simulator.py /app/customer_simulator.py
COPY ocpp-gateway/gateway.py /app/gateway.py
COPY deployment/host.py deployment/nginx.conf.template /app/
ENV CHARGEFLOW_CATALOG_FILE=/app/customer_catalog.json CHARGEFLOW_PUBLIC_STATIONS_FILE=/app/public_stations.json CHARGEFLOW_CUSTOMER_DB=/data/pluggo.sqlite3 CHARGEFLOW_COOKIE_SECURE=1
EXPOSE 10000
CMD ["/app/venv/bin/python", "/app/host.py"]
