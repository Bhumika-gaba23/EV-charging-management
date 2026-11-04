#include "ev_system.hpp"
#include "customer_api.hpp"
#include <crow.h>

#include <algorithm>
#include <cstdlib>
#include <fstream>
#include <mutex>
#include <sstream>

using namespace ev;

namespace {

std::vector<Charger> chargers{
    {"A1", ChargerKind::FastDC, ConnectorType::CCS2, 150, PowerSource::SolarWithGridFallback},
    {"A2", ChargerKind::FastDC, ConnectorType::CCS2, 60, PowerSource::Grid},
    {"B1", ChargerKind::StandardAC, ConnectorType::Type2, 22, PowerSource::Solar},
    {"B2", ChargerKind::FastDC, ConnectorType::CHAdeMO, 50, PowerSource::Grid}
};

std::vector<QueueRequest> waiting{
    {"REQ-1", {"E1", "Emergency Operator"}, {"AMB EV 04", 90, 8, .24, ConnectorType::CCS2, 180, true}, false, true, true, 25},
    {"REQ-2", {"U2", "Urgent Driver"}, {"KA 04 NX 8821", 60, 12, .17, ConnectorType::CCS2, 100}, true, false, true, 35},
    {"REQ-3", {"U3", "Regular Driver"}, {"KA 02 EV 3105", 45, 31, .16, ConnectorType::Type2, 11}, false, false, true, 50}
};

std::mutex stateMutex;
SolarPowerUnit solar{80, 200, 136};
int nextRequest = 4;
int nextVehicle = 2;
int nextSession = 1;

struct VehicleProfile {
    std::string id;
    std::string userId;
    std::string registration;
    std::string type;
    double batteryCapacityKWh{};
    double currentSoc{};
    ConnectorType connector{ConnectorType::CCS2};
    double maxChargeRateKW{};
};

struct AppSession {
    std::string id;
    std::string userId;
    std::string vehicleId;
    std::string chargerId;
    std::string status{"charging"};
    double currentSoc{};
    double targetSoc{};
    double powerKW{};
    double energyKWh{};
    double cost{};
    double solarPercent{68};
    double maximumBudget{};
    std::string departureTime;
    std::string idempotencyKey;
};

std::vector<VehicleProfile> vehicleProfiles{
    {"EV-1001", "USR-101", "KA 01 EV 1001", "car", 60, 24, ConnectorType::CCS2, 150}
};
std::vector<AppSession> appSessions;
const std::string demoToken = "chargeflow-demo-token";

bool authorized(const crow::request& request) {
    return request.get_header_value("Authorization") == "Bearer " + demoToken;
}

crow::response unauthorized() {
    crow::json::wvalue value;
    value["ok"] = false;
    value["error"] = "Missing or invalid bearer token";
    crow::response response(401, value.dump());
    response.set_header("Content-Type", "application/json; charset=utf-8");
    return response;
}

double number(const crow::json::rvalue& body, const char* key, double fallback) {
    return body.has(key) ? body[key].d() : fallback;
}

std::string text(const crow::json::rvalue& body, const char* key, std::string fallback = {}) {
    return body.has(key) ? std::string(body[key].s()) : std::move(fallback);
}

bool boolean(const crow::json::rvalue& body, const char* key, bool fallback = false) {
    return body.has(key) ? body[key].b() : fallback;
}

ConnectorType connectorFrom(const std::string& value) {
    if (value == "Type 2" || value == "Type2") return ConnectorType::Type2;
    if (value == "CHAdeMO") return ConnectorType::CHAdeMO;
    return ConnectorType::CCS2;
}

crow::response jsonResponse(crow::json::wvalue value, int code = 200) {
    crow::response response(code, value.dump());
    response.set_header("Content-Type", "application/json; charset=utf-8");
    return response;
}

crow::response errorResponse(const std::string& message, int code = 400) {
    crow::json::wvalue value;
    value["ok"] = false;
    value["error"] = message;
    return jsonResponse(std::move(value), code);
}

crow::response fileResponse(const std::string& relative, const std::string& contentType) {
    const char* configured = std::getenv("CHARGEFLOW_FRONTEND_DIR");
    const std::string path = std::string(configured ? configured : EV_FRONTEND_DIR) + "/" + relative;
    std::ifstream file(path, std::ios::binary);
    if (!file) return crow::response(404, "Frontend asset not found");
    std::ostringstream content;
    content << file.rdbuf();
    crow::response response(200, content.str());
    response.set_header("Content-Type", contentType);
    response.set_header("Cache-Control", "no-cache");
    return response;
}

crow::json::wvalue queueJson() {
    QueueScorePolicy policy;
    auto ordered = waiting;
    std::stable_sort(ordered.begin(), ordered.end(), [&](const auto& left, const auto& right) {
        const double a = policy(left), b = policy(right);
        return a == b ? left.arrivalTime < right.arrivalTime : a > b;
    });
    crow::json::wvalue::list items;
    for (std::size_t i = 0; i < ordered.size(); ++i) {
        crow::json::wvalue item;
        item["id"] = ordered[i].requestId;
        item["registration"] = ordered[i].vehicle.registration();
        item["soc"] = ordered[i].vehicle.currentSocPercent();
        item["emergency"] = ordered[i].emergency;
        item["preBooked"] = ordered[i].preBooked;
        item["priority"] = policy(ordered[i]);
        item["rank"] = static_cast<int>(i + 1);
        items.push_back(std::move(item));
    }
    crow::json::wvalue result;
    result["ok"] = true;
    result["items"] = std::move(items);
    return result;
}

crow::json::wvalue vehicleJson(const VehicleProfile& vehicle) {
    crow::json::wvalue result;
    result["id"] = vehicle.id;
    result["registration"] = vehicle.registration;
    result["type"] = vehicle.type;
    result["batteryCapacityKWh"] = vehicle.batteryCapacityKWh;
    result["currentSoc"] = vehicle.currentSoc;
    result["connector"] = toString(vehicle.connector);
    result["maxChargeRateKW"] = vehicle.maxChargeRateKW;
    return result;
}

crow::json::wvalue sessionJson(const AppSession& session) {
    crow::json::wvalue result;
    result["id"] = session.id;
    result["vehicleId"] = session.vehicleId;
    result["chargerId"] = session.chargerId;
    result["status"] = session.status;
    result["currentSoc"] = session.currentSoc;
    result["targetSoc"] = session.targetSoc;
    result["powerKW"] = session.powerKW;
    result["energyKWh"] = session.energyKWh;
    result["cost"] = session.cost;
    result["solarPercent"] = session.solarPercent;
    result["maximumBudget"] = session.maximumBudget;
    result["departureTime"] = session.departureTime;
    result["estimatedCompletionMinutes"] = session.powerKW > 0
        ? std::max(0.0, (session.targetSoc - session.currentSoc) * .6 / session.powerKW * 60.0)
        : 0.0;
    return result;
}

} // namespace

int main() {
    crow::SimpleApp app;
    pluggo::registerCustomerApi(app);

    CROW_WEBSOCKET_ROUTE(app, "/ocpp")
        .onopen([](crow::websocket::connection& connection) {
            std::cout << "{\"event\":\"ocpp_connected\",\"remote\":\""
                      << connection.get_remote_ip() << "\"}\n";
        })
        .onclose([](crow::websocket::connection&, const std::string& reason, uint16_t) {
            std::cout << "{\"event\":\"ocpp_disconnected\",\"reason\":\"" << reason << "\"}\n";
        })
        .onmessage([](crow::websocket::connection& connection, const std::string& message, bool isBinary) {
            if (isBinary) return;
            const auto packet = crow::json::load(message);
            if (!packet || packet.size() < 4 || packet[0].i() != 2) return;
            const std::string id = std::string(packet[1].s());
            const std::string action = std::string(packet[2].s());
            std::string payload = "{}";
            if (action == "BootNotification")
                payload = "{\"currentTime\":\"2026-11-01T18:00:00Z\",\"interval\":10,\"status\":\"Accepted\"}";
            else if (action == "Heartbeat")
                payload = "{\"currentTime\":\"2026-11-01T18:00:00Z\"}";
            connection.send_text("[3,\"" + id + "\"," + payload + "]");
            std::cout << "{\"event\":\"ocpp_message\",\"action\":\"" << action << "\"}\n";
        });

    CROW_ROUTE(app, "/")([] { return fileResponse("index.html", "text/html; charset=utf-8"); });
    CROW_ROUTE(app, "/styles.css")([] { return fileResponse("styles.css", "text/css; charset=utf-8"); });
    CROW_ROUTE(app, "/theme.css")([] { return fileResponse("theme.css", "text/css; charset=utf-8"); });
    CROW_ROUTE(app, "/dashboard.css")([] { return fileResponse("dashboard.css", "text/css; charset=utf-8"); });
    CROW_ROUTE(app, "/portal.css")([] { return fileResponse("portal.css", "text/css; charset=utf-8"); });
    CROW_ROUTE(app, "/api-client.js")([] { return fileResponse("api-client.js", "text/javascript; charset=utf-8"); });
    CROW_ROUTE(app, "/portal.js")([] { return fileResponse("portal.js", "text/javascript; charset=utf-8"); });
    CROW_ROUTE(app, "/operator.html")([] { return fileResponse("operator.html", "text/html; charset=utf-8"); });
    CROW_ROUTE(app, "/chargeflow.css")([] { return fileResponse("chargeflow.css", "text/css; charset=utf-8"); });
    CROW_ROUTE(app, "/reference-layout.css")([] { return fileResponse("reference-layout.css", "text/css; charset=utf-8"); });
    CROW_ROUTE(app, "/wallet.css")([] { return fileResponse("wallet.css", "text/css; charset=utf-8"); });
    CROW_ROUTE(app, "/cargo-model.js")([] { return fileResponse("cargo-model.js", "text/javascript; charset=utf-8"); });
    CROW_ROUTE(app, "/performance-profile.js")([] { return fileResponse("performance-profile.js", "text/javascript; charset=utf-8"); });
    CROW_ROUTE(app, "/session-summary.js")([] { return fileResponse("session-summary.js", "text/javascript; charset=utf-8"); });
    CROW_ROUTE(app, "/customer-api.js")([] { return fileResponse("customer-api.js", "text/javascript; charset=utf-8"); });
    CROW_ROUTE(app, "/chargeflow.js")([] { return fileResponse("chargeflow.js", "text/javascript; charset=utf-8"); });
    CROW_ROUTE(app, "/google-stations.js")([] { return fileResponse("google-stations.js", "text/javascript; charset=utf-8"); });
    CROW_ROUTE(app, "/demo-data.js")([] { return fileResponse("demo-data.js", "text/javascript; charset=utf-8"); });
    CROW_ROUTE(app, "/vehicle-scene.js")([] { return fileResponse("vehicle-scene.js", "text/javascript; charset=utf-8"); });

    // Only known presentation assets are exposed; never resolve arbitrary paths.
    const auto presentationAsset = [](const std::string& relative) {
        const std::vector<std::string> allowed{
            "assets/chargeflow.svg", "assets/pluggo.svg", "assets/fonts/montserrat-variable.ttf",
            "assets/models/car.glb", "assets/models/scooter.glb", "assets/models/bike.glb",
            "assets/models/car-poster.png", "assets/models/scooter-poster.png",
            "assets/models/bike-poster.png",
            "assets/paper-car-silver.png", "assets/paper-scooter-silver.png",
            "assets/paper-bike-silver.png", "assets/paper-car-chrome.png",
            "assets/paper-scooter-chrome.png", "assets/paper-bike-chrome.png",
            "assets/paper-cut-vehicles.png", "vendor/three.module.min.js",
            "vendor/three.core.min.js", "vendor/OrbitControls.js",
            "vendor/leaflet.js", "vendor/leaflet.css",
            "vendor/RoomEnvironment.js", "vendor/GLTFLoader.js",
            "vendor/utils/BufferGeometryUtils.js"
        };
        if (std::find(allowed.begin(), allowed.end(), relative) == allowed.end())
            return crow::response(404, "Frontend asset not found");
        const auto extension = relative.substr(relative.find_last_of('.') + 1);
        const std::string type = extension == "css" ? "text/css; charset=utf-8"
            : extension == "js" ? "text/javascript; charset=utf-8"
            : extension == "svg" ? "image/svg+xml"
            : extension == "ttf" ? "font/ttf"
            : extension == "glb" ? "model/gltf-binary" : "image/png";
        return fileResponse(relative, type);
    };
    CROW_ROUTE(app, "/assets/<path>")([presentationAsset](const std::string& path) {
        return presentationAsset("assets/" + path);
    });
    CROW_ROUTE(app, "/vendor/<path>")([presentationAsset](const std::string& path) {
        return presentationAsset("vendor/" + path);
    });

    CROW_ROUTE(app, "/api/health")([] {
        crow::json::wvalue result;
        result["ok"] = true;
        result["service"] = "ChargeFlow C++ API";
        return jsonResponse(std::move(result));
    });

    CROW_ROUTE(app, "/api/station")([] { return pluggo::customerOperatorStation(); });

    CROW_ROUTE(app, "/api/plan").methods(crow::HTTPMethod::POST)([](const crow::request& request) {
        try {
            const auto body = crow::json::load(request.body);
            if (!body) return errorResponse("Invalid JSON body");
            Vehicle vehicle{text(body, "registration", "WEB-EV"), number(body, "capacity", 60),
                number(body, "soc", 20), .17, connectorFrom(text(body, "connector", "CCS2")),
                number(body, "maxRate", 150)};
            const auto plan = TimeBoundScheduler::createPlan(vehicle, chargers,
                number(body, "target", 80), number(body, "hours", 2));
            crow::json::wvalue result;
            result["ok"] = true;
            result["energyKWh"] = plan.energyNeededKWh;
            result["powerKW"] = plan.assignedPowerKW;
            result["durationHours"] = plan.estimatedHours;
            result["chargerId"] = plan.chargerId;
            result["feasible"] = plan.deadlineFeasible;
            result["note"] = plan.note;
            return jsonResponse(std::move(result));
        } catch (const std::exception& error) { return errorResponse(error.what()); }
    });

    CROW_ROUTE(app, "/api/budget").methods(crow::HTTPMethod::POST)([](const crow::request& request) {
        try {
            const auto body = crow::json::load(request.body);
            if (!body) return errorResponse("Invalid JSON body");
            PricingEngine pricing;
            const double budget = number(body, "budget", 0);
            const double rate = number(body, "tariff", 18);
            const double requested = number(body, "requestedEnergy", 0);
            const double delivered = std::min(requested, pricing.maximumEnergyWithinBudget(budget, rate));
            crow::json::wvalue result;
            result["ok"] = true;
            result["deliveredEnergyKWh"] = delivered;
            result["cost"] = pricing.calculateCost(delivered, rate);
            result["budgetLimited"] = delivered + 1e-9 < requested;
            return jsonResponse(std::move(result));
        } catch (const std::exception& error) { return errorResponse(error.what()); }
    });

    CROW_ROUTE(app, "/api/queue")([] {
        std::lock_guard<std::mutex> lock(stateMutex);
        return jsonResponse(queueJson());
    });

    CROW_ROUTE(app, "/api/queue").methods(crow::HTTPMethod::POST)([](const crow::request& request) {
        try {
            const auto body = crow::json::load(request.body);
            if (!body) return errorResponse("Invalid JSON body");
            std::lock_guard<std::mutex> lock(stateMutex);
            const bool emergency = text(body, "urgency", "normal") == "emergency";
            const bool urgent = text(body, "urgency", "normal") == "urgent";
            const std::string id = "REQ-" + std::to_string(nextRequest++);
            Vehicle vehicle{text(body, "registration", "NEW-EV"), 60, number(body, "soc", 20),
                .17, ConnectorType::CCS2, 100, emergency};
            waiting.push_back({id, {"WEB", "Web Driver"}, vehicle, urgent, emergency, true, 35});
            return jsonResponse(queueJson(), 201);
        } catch (const std::exception& error) { return errorResponse(error.what()); }
    });

    CROW_ROUTE(app, "/api/queue/serve").methods(crow::HTTPMethod::POST)([](const crow::request&) {
        std::lock_guard<std::mutex> lock(stateMutex);
        if (waiting.empty()) return errorResponse("Queue is empty", 409);
        QueueScorePolicy policy;
        auto best = std::max_element(waiting.begin(), waiting.end(), [&](const auto& a, const auto& b) {
            return policy(a) < policy(b);
        });
        const std::string served = best->vehicle.registration();
        waiting.erase(best);
        auto result = queueJson();
        result["served"] = served;
        return jsonResponse(std::move(result));
    });

    CROW_ROUTE(app, "/api/solar/simulate").methods(crow::HTTPMethod::POST)([](const crow::request& request) {
        try {
            const auto body = crow::json::load(request.body);
            if (!body) return errorResponse("Invalid JSON body");
            const double sunlight = number(body, "sunlight", .68);
            const double hours = number(body, "hours", 1);
            const double requested = number(body, "requestedPowerKW", 60);
            std::lock_guard<std::mutex> lock(stateMutex);
            solar.simulateGeneration(sunlight, hours);
            const auto allocation = SolarEnergyManager{}.allocate(true, sunlight > 0,
                solar.availablePowerKW(sunlight), requested, solar.storedEnergyKWh());
            crow::json::wvalue result;
            result["ok"] = true;
            result["outputKW"] = solar.availablePowerKW(sunlight);
            result["storedKWh"] = solar.storedEnergyKWh();
            result["gridDependencyPercent"] = std::max(0.0, 100.0 - sunlight * 100.0);
            result["source"] = toString(allocation.source);
            result["discountPercent"] = allocation.discountPercent;
            result["carbonOffsetKg"] = solar.availablePowerKW(sunlight) * hours * .7;
            return jsonResponse(std::move(result));
        } catch (const std::exception& error) { return errorResponse(error.what()); }
    });

    CROW_ROUTE(app, "/api/emergency").methods(crow::HTTPMethod::POST)([](const crow::request& request) {
        const auto body = crow::json::load(request.body);
        if (!body) return errorResponse("Invalid JSON body");
        crow::json::wvalue result;
        result["ok"] = true;
        result["applied"] = true;
        result["vehicle"] = text(body, "registration", "EMERGENCY EV");
        result["chargerId"] = "A1";
        result["pausedVehicle"] = "KA 01 EV 1001";
        result["compensationCredit"] = 50;
        result["message"] = "Emergency override applied. The regular session keeps first queue position.";
        return jsonResponse(std::move(result));
    });

    // Mobile application API. The demo token keeps the sample self-contained;
    // replace it with OAuth/OIDC validation before production deployment.
    CROW_ROUTE(app, "/api/auth/login").methods(crow::HTTPMethod::POST)([](const crow::request& request) {
        const auto body = crow::json::load(request.body);
        if (!body || text(body, "email").empty() || text(body, "password").empty())
            return errorResponse("Email and password are required");
        crow::json::wvalue result;
        result["ok"] = true;
        result["accessToken"] = demoToken;
        result["tokenType"] = "Bearer";
        result["expiresIn"] = 3600;
        result["userId"] = "USR-101";
        result["warning"] = "Development token only. Configure OAuth/OIDC for production.";
        return jsonResponse(std::move(result));
    });

    CROW_ROUTE(app, "/api/stations")([] {
        crow::json::wvalue station;
        station["id"] = "STN-01";
        station["name"] = "GreenRoute Central";
        station["location"] = "BLR-01";
        station["online"] = true;
        station["availableChargers"] = 1;
        station["totalChargers"] = static_cast<int>(chargers.size());
        crow::json::wvalue::list items;
        items.push_back(std::move(station));
        crow::json::wvalue result;
        result["ok"] = true;
        result["items"] = std::move(items);
        return jsonResponse(std::move(result));
    });

    CROW_ROUTE(app, "/api/chargers/<string>")([](const std::string& id) {
        const auto match = std::find_if(chargers.begin(), chargers.end(), [&](const Charger& charger) {
            return charger.id() == id;
        });
        if (match == chargers.end()) return errorResponse("Charger not found", 404);
        crow::json::wvalue result;
        result["ok"] = true;
        result["id"] = match->id();
        result["stationId"] = "STN-01";
        result["connector"] = toString(match->connector());
        result["maximumPowerKW"] = match->maxPowerKW();
        result["source"] = toString(match->powerSource());
        result["available"] = match->isAvailable();
        return jsonResponse(std::move(result));
    });

    CROW_ROUTE(app, "/api/vehicles").methods(crow::HTTPMethod::GET)([](const crow::request& request) {
        if (!authorized(request)) return unauthorized();
        std::lock_guard<std::mutex> lock(stateMutex);
        crow::json::wvalue::list items;
        for (const auto& vehicle : vehicleProfiles) items.push_back(vehicleJson(vehicle));
        crow::json::wvalue result;
        result["ok"] = true;
        result["items"] = std::move(items);
        return jsonResponse(std::move(result));
    });

    CROW_ROUTE(app, "/api/vehicles").methods(crow::HTTPMethod::POST)([](const crow::request& request) {
        if (!authorized(request)) return unauthorized();
        try {
            const auto body = crow::json::load(request.body);
            if (!body) return errorResponse("Invalid JSON body");
            VehicleProfile profile;
            profile.id = "EV-" + std::to_string(1000 + nextVehicle++);
            profile.userId = "USR-101";
            profile.registration = text(body, "registration");
            profile.type = text(body, "type", "car");
            profile.batteryCapacityKWh = number(body, "batteryCapacityKWh", 60);
            profile.currentSoc = number(body, "currentSoc", 20);
            profile.connector = connectorFrom(text(body, "connector", "CCS2"));
            profile.maxChargeRateKW = number(body, "maxChargeRateKW", 100);
            Vehicle validation{profile.registration, profile.batteryCapacityKWh, profile.currentSoc,
                .17, profile.connector, profile.maxChargeRateKW};
            std::lock_guard<std::mutex> lock(stateMutex);
            vehicleProfiles.push_back(profile);
            auto result = vehicleJson(vehicleProfiles.back());
            result["ok"] = true;
            return jsonResponse(std::move(result), 201);
        } catch (const std::exception& error) { return errorResponse(error.what()); }
    });

    CROW_ROUTE(app, "/api/charging/start").methods(crow::HTTPMethod::POST)([](const crow::request& request) {
        if (!authorized(request)) return unauthorized();
        try {
            const auto body = crow::json::load(request.body);
            if (!body) return errorResponse("Invalid JSON body");
            std::lock_guard<std::mutex> lock(stateMutex);
            const std::string vehicleId = text(body, "vehicleId");
            const auto vehicle = std::find_if(vehicleProfiles.begin(), vehicleProfiles.end(), [&](const auto& item) {
                return item.id == vehicleId;
            });
            if (vehicle == vehicleProfiles.end()) return errorResponse("Vehicle profile not found", 404);
            const std::string chargerId = text(body, "chargerId");
            const auto charger = std::find_if(chargers.begin(), chargers.end(), [&](const auto& item) {
                return item.id() == chargerId;
            });
            if (charger == chargers.end()) return errorResponse("Charger not found", 404);
            Vehicle domainVehicle{vehicle->registration, vehicle->batteryCapacityKWh, vehicle->currentSoc,
                .17, vehicle->connector, vehicle->maxChargeRateKW};
            if (!charger->isCompatible(domainVehicle)) return errorResponse("Vehicle and charger connectors are incompatible", 409);
            const double target = number(body, "targetSoc", 80);
            const double hours = std::max(.25, number(body, "availableHours", 2));
            const auto plan = TimeBoundScheduler::createPlan(domainVehicle, chargers, target, hours);
            AppSession session;
            session.id = "SES-" + std::to_string(200 + nextSession++);
            session.userId = "USR-101";
            session.vehicleId = vehicle->id;
            session.chargerId = plan.chargerId == "NONE" ? chargerId : plan.chargerId;
            session.currentSoc = vehicle->currentSoc;
            session.targetSoc = target;
            session.powerKW = plan.assignedPowerKW;
            session.maximumBudget = number(body, "maximumBudget", 1000);
            session.departureTime = text(body, "departureTime");
            appSessions.push_back(session);
            auto result = sessionJson(appSessions.back());
            result["ok"] = true;
            result["deadlineFeasible"] = plan.deadlineFeasible;
            result["note"] = plan.note;
            return jsonResponse(std::move(result), 201);
        } catch (const std::exception& error) { return errorResponse(error.what()); }
    });

    CROW_ROUTE(app, "/api/charging/stop").methods(crow::HTTPMethod::POST)([](const crow::request& request) {
        if (!authorized(request)) return unauthorized();
        const auto body = crow::json::load(request.body);
        if (!body) return errorResponse("Invalid JSON body");
        std::lock_guard<std::mutex> lock(stateMutex);
        const std::string sessionId = text(body, "sessionId");
        const auto session = std::find_if(appSessions.begin(), appSessions.end(), [&](const auto& item) {
            return item.id == sessionId;
        });
        if (session == appSessions.end()) return errorResponse("Session not found", 404);
        session->status = "stopped";
        auto result = sessionJson(*session);
        result["ok"] = true;
        return jsonResponse(std::move(result));
    });

    CROW_ROUTE(app, "/api/sessions/<string>")([](const crow::request& request, const std::string& id) {
        if (!authorized(request)) return unauthorized();
        std::lock_guard<std::mutex> lock(stateMutex);
        const auto session = std::find_if(appSessions.begin(), appSessions.end(), [&](const auto& item) {
            return item.id == id;
        });
        if (session == appSessions.end()) return errorResponse("Session not found", 404);
        auto result = sessionJson(*session);
        result["ok"] = true;
        return jsonResponse(std::move(result));
    });

    CROW_ROUTE(app, "/api/sessions/<string>/live")([](const crow::request& request, const std::string& id) {
        if (!authorized(request)) return unauthorized();
        std::lock_guard<std::mutex> lock(stateMutex);
        const auto session = std::find_if(appSessions.begin(), appSessions.end(), [&](const auto& item) {
            return item.id == id;
        });
        if (session == appSessions.end()) return errorResponse("Session not found", 404);
        auto result = sessionJson(*session);
        result["ok"] = true;
        result["updateSource"] = "charger-meter-adapter";
        return jsonResponse(std::move(result));
    });

    // Development adapter for OCPP MeterValues/TransactionEvent data. A real
    // OCPP service should authenticate the charging station before calling it.
    CROW_ROUTE(app, "/api/charger-adapter/meter-values").methods(crow::HTTPMethod::POST)([](const crow::request& request) {
        if (request.get_header_value("X-Charger-Key") != "development-charger-key")
            return errorResponse("Invalid charger key", 401);
        const auto body = crow::json::load(request.body);
        if (!body) return errorResponse("Invalid JSON body");
        std::lock_guard<std::mutex> lock(stateMutex);
        const std::string sessionId = text(body, "sessionId");
        const auto session = std::find_if(appSessions.begin(), appSessions.end(), [&](const auto& item) {
            return item.id == sessionId;
        });
        if (session == appSessions.end()) return errorResponse("Session not found", 404);
        session->currentSoc = std::clamp(number(body, "currentSoc", session->currentSoc), 0.0, 100.0);
        session->powerKW = std::max(0.0, number(body, "powerKW", session->powerKW));
        session->energyKWh = std::max(session->energyKWh, number(body, "energyKWh", session->energyKWh));
        session->solarPercent = std::clamp(number(body, "solarPercent", session->solarPercent), 0.0, 100.0);
        session->cost = number(body, "cost", session->energyKWh * 18.0);
        if (session->currentSoc >= session->targetSoc || session->cost >= session->maximumBudget)
            session->status = "completed";
        auto result = sessionJson(*session);
        result["ok"] = true;
        return jsonResponse(std::move(result));
    });

    CROW_ROUTE(app, "/api/ready")([] { return pluggo::customerReadiness(); });
    CROW_ROUTE(app, "/metrics")([] { crow::response r(200, "# HELP chargeflow_up Service availability\n# TYPE chargeflow_up gauge\nchargeflow_up 1\n# HELP chargeflow_active_sessions Active sessions\n# TYPE chargeflow_active_sessions gauge\nchargeflow_active_sessions " + std::to_string(appSessions.size()) + "\n"); r.set_header("Content-Type","text/plain; version=0.0.4"); return r; });
    CROW_ROUTE(app, "/api/v1/stations")([] { crow::json::wvalue::list items; crow::json::wvalue s; s["id"]="STN-01";s["name"]="GreenRoute Central";s["location"]="BLR-01";s["online"]=true;items.push_back(std::move(s));crow::json::wvalue r;r["ok"]=true;r["items"]=std::move(items);return jsonResponse(std::move(r)); });
    CROW_ROUTE(app, "/api/v1/stations/<string>/chargers")([](const std::string& stationId) { if(stationId!="STN-01")return errorResponse("Station not found",404);crow::json::wvalue::list items;for(const auto& c:chargers){crow::json::wvalue x;x["id"]=c.id();x["connector"]=toString(c.connector());x["maximumPowerKW"]=c.maxPowerKW();x["source"]=toString(c.powerSource());x["available"]=c.isAvailable();items.push_back(std::move(x));}crow::json::wvalue r;r["ok"]=true;r["items"]=std::move(items);return jsonResponse(std::move(r)); });
    CROW_ROUTE(app, "/api/v1/tariffs/current")([] { crow::json::wvalue r;r["ok"]=true;r["stationId"]="STN-01";r["currency"]="INR";r["ratePerKWh"]=18.0;r["solarDiscountPercent"]=15.0;return jsonResponse(std::move(r)); });
    CROW_ROUTE(app, "/api/v1/sessions/history")([](const crow::request& request){if(!authorized(request))return unauthorized();std::lock_guard<std::mutex> lock(stateMutex);crow::json::wvalue::list items;for(const auto& s:appSessions)items.push_back(sessionJson(s));crow::json::wvalue r;r["ok"]=true;r["items"]=std::move(items);return jsonResponse(std::move(r));});
    CROW_ROUTE(app, "/api/v1/sessions/<string>")([](const crow::request& request,const std::string& id){if(!authorized(request))return unauthorized();std::lock_guard<std::mutex> lock(stateMutex);auto s=std::find_if(appSessions.begin(),appSessions.end(),[&](const auto& x){return x.id==id;});if(s==appSessions.end())return errorResponse("Session not found",404);auto r=sessionJson(*s);r["ok"]=true;return jsonResponse(std::move(r));});
    CROW_ROUTE(app, "/api/v1/sessions/<string>/stop").methods(crow::HTTPMethod::POST)([](const crow::request& request,const std::string& id){if(!authorized(request))return unauthorized();std::lock_guard<std::mutex> lock(stateMutex);auto s=std::find_if(appSessions.begin(),appSessions.end(),[&](const auto& x){return x.id==id;});if(s==appSessions.end())return errorResponse("Session not found",404);s->status="stopped";auto r=sessionJson(*s);r["ok"]=true;return jsonResponse(std::move(r));});
    CROW_ROUTE(app, "/api/v1/sessions").methods(crow::HTTPMethod::POST)([](const crow::request& request){if(!authorized(request))return unauthorized();const auto body=crow::json::load(request.body);if(!body)return errorResponse("Invalid JSON body");const std::string key=request.get_header_value("Idempotency-Key");if(key.empty())return errorResponse("Idempotency-Key header is required",400);std::lock_guard<std::mutex> lock(stateMutex);const std::string vehicleId=text(body,"vehicleId");auto vehicle=std::find_if(vehicleProfiles.begin(),vehicleProfiles.end(),[&](const auto& x){return x.id==vehicleId;});if(vehicle==vehicleProfiles.end())return errorResponse("Vehicle profile not found",404);for(const auto& s:appSessions)if(s.idempotencyKey==key){auto r=sessionJson(s);r["ok"]=true;r["idempotentReplay"]=true;return jsonResponse(std::move(r),200);}Vehicle dv{vehicle->registration,vehicle->batteryCapacityKWh,vehicle->currentSoc,.17,vehicle->connector,vehicle->maxChargeRateKW};const double target=number(body,"targetSoc",80);const auto plan=TimeBoundScheduler::createPlan(dv,chargers,target,std::max(.25,number(body,"availableHours",2)));AppSession s;s.id="SES-"+std::to_string(200+nextSession++);s.userId="USR-101";s.vehicleId=vehicleId;s.chargerId=plan.chargerId;s.currentSoc=vehicle->currentSoc;s.targetSoc=target;s.powerKW=plan.assignedPowerKW;s.maximumBudget=number(body,"maximumBudget",1000);s.departureTime=text(body,"departureTime");s.idempotencyKey=key;appSessions.push_back(s);auto r=sessionJson(appSessions.back());r["ok"]=true;r["deadlineFeasible"]=plan.deadlineFeasible;return jsonResponse(std::move(r),201);});

    std::cout << "ChargeFlow web portal: http://localhost:18080\n";
    const char* port = std::getenv("CHARGEFLOW_PORT");
    const char* bind = std::getenv("CHARGEFLOW_BIND_ADDRESS");
    app.bindaddr(bind ? bind : "127.0.0.1").port(port ? std::stoi(port) : 18080).multithreaded().run();
}
