FROM debian:bookworm-slim AS build
RUN apt-get update && apt-get install -y --no-install-recommends g++ cmake git make libsqlite3-dev ca-certificates && rm -rf /var/lib/apt/lists/*
WORKDIR /src
COPY . .
RUN cmake -S . -B /build -DEV_BUILD_WEB_API=ON -DBUILD_TESTING=OFF -DCMAKE_BUILD_TYPE=Release && cmake --build /build -j2 --target ev_web_api
FROM debian:bookworm-slim
RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates wget libsqlite3-0 libstdc++6 && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY --from=build /build/ev_web_api /app/ev_web_api
COPY frontend /app/frontend
COPY database/seed/customer_catalog.json /app/customer_catalog.json
ENV CHARGEFLOW_CATALOG_FILE=/app/customer_catalog.json CHARGEFLOW_BIND_ADDRESS=0.0.0.0 CHARGEFLOW_CUSTOMER_DB=/data/pluggo.sqlite3
EXPOSE 18080
CMD ["/app/ev_web_api"]
