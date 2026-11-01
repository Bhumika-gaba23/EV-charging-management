cmake_minimum_required(VERSION 3.16)
project(EVChargingStationManagement LANGUAGES CXX)

option(EV_BUILD_WEB_API "Build the Crow HTTP API and web dashboard server" OFF)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_CXX_EXTENSIONS OFF)

add_executable(ev_charging
    src/main.cpp
    src/ev_system.cpp
)

target_include_directories(ev_charging PRIVATE include)

if(MSVC)
    target_compile_options(ev_charging PRIVATE /W4 /permissive-)
else()
    target_compile_options(ev_charging PRIVATE -Wall -Wextra -Wpedantic)
endif()

if(EV_BUILD_WEB_API)
    include(FetchContent)
    set(CROW_BUILD_EXAMPLES OFF CACHE BOOL "" FORCE)
    set(CROW_BUILD_TESTS OFF CACHE BOOL "" FORCE)
    set(CROW_ENABLE_COMPRESSION OFF CACHE BOOL "" FORCE)
    set(CROW_ENABLE_SSL OFF CACHE BOOL "" FORCE)
    FetchContent_Declare(
        asio
        GIT_REPOSITORY https://github.com/chriskohlhoff/asio.git
        GIT_TAG asio-1-30-2
        GIT_SHALLOW TRUE
    )
    FetchContent_MakeAvailable(asio)
    set(ASIO_INCLUDE_DIR "${asio_SOURCE_DIR}/asio/include" CACHE PATH "Asio headers" FORCE)
    FetchContent_Declare(
        Crow
        GIT_REPOSITORY https://github.com/CrowCpp/Crow.git
        GIT_TAG v1.3.4
        GIT_SHALLOW TRUE
    )
    FetchContent_MakeAvailable(Crow)

    add_executable(ev_web_api src/api_server.cpp src/ev_system.cpp)
    target_include_directories(ev_web_api PRIVATE include)
    target_link_libraries(ev_web_api PRIVATE Crow::Crow)
    if(WIN32)
        target_link_libraries(ev_web_api PRIVATE ws2_32 mswsock)
    endif()
    target_compile_definitions(ev_web_api PRIVATE
        EV_FRONTEND_DIR="${CMAKE_SOURCE_DIR}/frontend"
    )
endif()

include(CTest)
if(BUILD_TESTING)
    add_executable(ev_tests tests/ev_tests.cpp src/ev_system.cpp)
    target_include_directories(ev_tests PRIVATE include)
    add_test(NAME ev_feature_checks COMMAND ev_tests)
endif()
