FROM gcc:14 AS build
RUN apt-get update && apt-get install -y --no-install-recommends cmake git make && rm -rf /var/lib/apt/lists/*
WORKDIR /src
COPY . .
RUN cmake -S . -B /build -DEV_BUILD_WEB_API=ON -DBUILD_TESTING=OFF -DCMAKE_BUILD_TYPE=Release && cmake --build /build -j2 --target ev_web_api
FROM debian:bookworm-slim
RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates wget && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY --from=build /build/ev_web_api /app/ev_web_api
COPY frontend /app/frontend
EXPOSE 18080
CMD ["/app/ev_web_api"]
