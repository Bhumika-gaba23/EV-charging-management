FROM debian:bookworm-slim AS build
RUN apt-get update && apt-get install -y --no-install-recommends g++ cmake git make libsqlite3-dev ca-certificates && rm -rf /var/lib/apt/lists/*
WORKDIR /src
COPY CMakeLists.txt ./
COPY include ./include
COPY src ./src
COPY tests/ev_tests.cpp ./tests/ev_tests.cpp
COPY database/seed/customer_catalog.json ./database/seed/customer_catalog.json
RUN cmake -S . -B /build -DEV_BUILD_WEB_API=ON -DBUILD_TESTING=OFF -DCMAKE_BUILD_TYPE=Release && cmake --build /build -j2 --target ev_web_api

FROM debian:bookworm-slim
RUN apt-get update && apt-get install -y --no-install-recommends nginx python3 python3-venv libsqlite3-0 libstdc++6 ca-certificates && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY ocpp-simulator/requirements.txt /app/requirements.txt
RUN python3 -m venv /app/venv && /app/venv/bin/pip install --no-cache-dir -r /app/requirements.txt
COPY --from=build /build/ev_web_api /app/ev_web_api
COPY frontend /app/frontend
COPY database/seed/customer_catalog.json /app/customer_catalog.json
COPY ocpp-simulator/customer_simulator.py /app/customer_simulator.py
COPY deployment/host.py deployment/nginx.conf.template /app/
ENV CHARGEFLOW_CATALOG_FILE=/app/customer_catalog.json CHARGEFLOW_CUSTOMER_DB=/data/pluggo.sqlite3 CHARGEFLOW_COOKIE_SECURE=1
EXPOSE 10000
CMD ["/app/venv/bin/python", "/app/host.py"]
