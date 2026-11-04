#!/bin/sh
set -eu
repo_root=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
cd "$repo_root"
if command -v cmake >/dev/null 2>&1; then
  cmake -S . -B build-web-demo -DEV_BUILD_WEB_API=ON -DBUILD_TESTING=ON
  cmake --build build-web-demo -j2
else
  mkdir -p build-web-demo/_deps
  if [ ! -d build-web-demo/_deps/crow-src/include ]; then
    git clone --depth 1 --branch v1.3.4 https://github.com/CrowCpp/Crow.git build-web-demo/_deps/crow-src
  fi
  if [ ! -d build-web-demo/_deps/asio-src/asio/include ]; then
    git clone --depth 1 --branch asio-1-30-2 https://github.com/chriskohlhoff/asio.git build-web-demo/_deps/asio-src
  fi
  task_compiler=${CXX:-clang++}
  "$task_compiler" -std=c++17 -DASIO_STANDALONE -DASIO_NO_DEPRECATED \
    "-DEV_FRONTEND_DIR=\"$repo_root/frontend\"" \
    "-DEV_CATALOG_FILE=\"$repo_root/database/seed/customer_catalog.json\"" \
    -Iinclude -Ibuild-web-demo/_deps/crow-src/include -Ibuild-web-demo/_deps/asio-src/asio/include \
    src/api_server.cpp src/customer_api.cpp src/ev_system.cpp -lsqlite3 -o build-web-demo/ev_web_api
  "$task_compiler" -std=c++17 -Iinclude tests/ev_tests.cpp src/ev_system.cpp -o build-web-demo/ev_tests
fi
