#include "ev_system.hpp"

#include <exception>
#include <iostream>

using namespace ev;

int runAutomatedDemo() {
    try {
        std::cout << std::fixed << std::setprecision(2);
        std::cout << "=== EV Charging Station Management System ===\n\n";

        User regularUser{"USR-101", "Aarav", true};
        User secondUser{"USR-102", "Meera", false};
        User ambulanceOperator{"EMR-001", "City Hospital", false};

        Vehicle cityEV{"KA01EV1001", 60.0, 12.0, 0.16, ConnectorType::CCS2, 120.0};
        Vehicle secondEV{"KA01EV2002", 45.0, 38.0, 0.14, ConnectorType::Type2, 11.0};
        Vehicle ambulanceEV{"AMB-EV-01", 90.0, 7.0, 0.24, ConnectorType::CCS2, 180.0, true};

        std::vector<Charger> chargers{
            {"DC-01", ChargerKind::FastDC, ConnectorType::CCS2, 150.0,
             PowerSource::SolarWithGridFallback},
            {"DC-02", ChargerKind::FastDC, ConnectorType::CCS2, 60.0, PowerSource::Grid},
            {"AC-01", ChargerKind::StandardAC, ConnectorType::Type2, 11.0, PowerSource::Solar}
        };
        ChargingStation station{"STN-BLR-01", "GreenCharge Central", chargers};
        logEvent("Station", station.name());

        // 1. Enough to reach charging.
        const auto reach = RangeSafetyService::evaluate(cityEV, 42.0, 20.0);
        std::cout << "\n[Range safety]\n"
                  << "Available range: " << reach.availableRangeKm << " km\n"
                  << "Required with buffer: " << reach.requiredRangeWithBufferKm << " km\n"
                  << reach.recommendation << "\n";

        // 2. Finish charging at a user-supplied deadline.
        const auto plan = TimeBoundScheduler::createPlan(cityEV, station.chargers(), 80.0, 1.5);
        std::cout << "\n[Time-bound plan]\n"
                  << "Charger: " << plan.chargerId
                  << ", energy: " << plan.energyNeededKWh << " kWh"
                  << ", assigned power: " << plan.assignedPowerKW << " kW"
                  << ", duration: " << plan.estimatedHours << " h\n"
                  << "Deadline feasible: " << (plan.deadlineFeasible ? "yes" : "no")
                  << " - " << plan.note << "\n";

        // 3. Budget pricing through overloaded functions.
        PricingEngine pricing;
        const double flatCost = pricing.calculateCost(20.0, 18.0);
        const double timeOfUseCost = pricing.calculateCost(5.0, 15.0, 22.0, 12.0);
        const double solarCost = pricing.calculateCost(20.0, 18.0, 15.0);
        const double budgetEnergy = pricing.maximumEnergyWithinBudget(300.0, 18.0);
        std::cout << "\n[Budget and pricing]\n"
                  << "Flat cost: INR " << flatCost
                  << ", time-of-use cost: INR " << timeOfUseCost
                  << ", solar-discount cost: INR " << solarCost << "\n"
                  << "INR 300 permits at most " << budgetEnergy
                  << " kWh; delivery is capped at this value.\n";

        // 4. Template-based smart priority queue.
        SmartPriorityQueue<QueueRequest, QueueScorePolicy> waitingQueue;
        waitingQueue.push({"REQ-1", regularUser, cityEV, true, false, true, 35.0});
        waitingQueue.push({"REQ-2", secondUser, secondEV, false, false, true, 55.0});
        waitingQueue.push({"REQ-3", ambulanceOperator, ambulanceEV, false, true, true, 25.0});
        std::cout << "\n[Smart queue order]\n";
        while (!waitingQueue.empty()) {
            const auto request = waitingQueue.pop();
            std::cout << request.requestId << " -> " << request.vehicle.registration()
                      << (request.emergency ? " [EMERGENCY]" : "") << '\n';
        }

        // 5. Solar allocation and automatic grid fallback.
        SolarEnergyManager solarManager;
        const auto sunny = solarManager.allocate(regularUser.prefersGreenEnergy(), true,
                                                  45.0, plan.assignedPowerKW, 20.0);
        const auto cloudy = solarManager.allocate(regularUser.prefersGreenEnergy(), true,
                                                   4.0, plan.assignedPowerKW, 2.0);
        std::cout << "\n[Solar allocation]\n"
                  << "Sunny: " << toString(sunny.source) << ", discount "
                  << sunny.discountPercent << "% - " << sunny.explanation << '\n'
                  << "Cloudy: " << toString(cloudy.source) << ", discount "
                  << cloudy.discountPercent << "% - " << cloudy.explanation << "\n";

        // 6. Emergency override with pause, notice, and compensation.
        Session ordinarySession{"SES-100", regularUser, cityEV, "DC-01", 80.0, 800.0};
        ordinarySession.setState(SessionState::Charging);
        ordinarySession.addDeliveredEnergy(8.5);
        std::vector<Session> activeSessions{ordinarySession};
        Session emergencySession{"SES-911", ambulanceOperator, ambulanceEV, "WAITING",
                                 60.0, 2000.0, true};
        EmergencyOverrideService overrideService;
        const auto overrideResult = overrideService.apply(emergencySession, activeSessions,
                                                          station.chargers());
        std::cout << "\n[Emergency override]\n"
                  << "Applied: " << (overrideResult.applied ? "yes" : "no")
                  << ", released charger: " << overrideResult.releasedChargerId
                  << ", paused session: " << overrideResult.pausedSessionId
                  << ", credit: INR " << overrideResult.compensationCredit << '\n'
                  << overrideResult.notice << '\n';

        std::cout << "\nSimulation completed successfully.\n";
        return 0;
    } catch (const std::exception& error) {
        std::cerr << "Fatal error: " << error.what() << '\n';
        return 1;
    }
}

namespace {
template <typename T>
T readValue(const std::string& prompt) {
    T value{};
    while (true) {
        std::cout << prompt;
        if (std::cin >> value) return value;
        std::cout << "Invalid input. Try again.\n";
        std::cin.clear();
        std::cin.ignore(std::numeric_limits<std::streamsize>::max(), '\n');
    }
}

std::string readText(const std::string& prompt) {
    std::cout << prompt;
    std::string value;
    std::getline(std::cin >> std::ws, value);
    return value;
}

Vehicle readVehicle(bool emergency = false) {
    const auto registration = readText("Registration: ");
    const double capacity = readValue<double>("Battery capacity (kWh): ");
    const double soc = readValue<double>("Current SoC (%): ");
    const double maxRate = readValue<double>("Maximum charge rate (kW): ");
    const int port = readValue<int>("Connector [1=Type2, 2=CCS2, 3=CHAdeMO]: ");
    const auto connector = port == 1 ? ConnectorType::Type2
                         : port == 3 ? ConnectorType::CHAdeMO : ConnectorType::CCS2;
    return {registration, capacity, soc, 0.17, connector, maxRate, emergency};
}
} // namespace

int main() {
    std::cout << std::fixed << std::setprecision(2);
    std::vector<Charger> chargers{
        {"DC-SOLAR", ChargerKind::FastDC, ConnectorType::CCS2, 150, PowerSource::SolarWithGridFallback},
        {"DC-GRID", ChargerKind::FastDC, ConnectorType::CCS2, 60, PowerSource::Grid},
        {"AC-SOLAR", ChargerKind::StandardAC, ConnectorType::Type2, 22, PowerSource::Solar},
        {"CHA-GRID", ChargerKind::FastDC, ConnectorType::CHAdeMO, 50, PowerSource::Grid}
    };
    ChargingStation station{"STN-01", "GreenRoute Central", chargers};
    QueueManager queue;
    SolarPowerUnit solar{80, 200, 30};
    PricingEngine pricing;
    std::vector<Session> sessions;
    User demoUser{"DEMO", "Demo Driver", true};
    Vehicle demoEV{"DEMO-EV", 60, 25, 0.17, ConnectorType::CCS2, 100};
    sessions.emplace_back("SES-1", demoUser, demoEV, "DC-SOLAR", 80, 1000);
    sessions.back().setState(SessionState::Charging);
    int requestId = 1;

    while (true) {
        try {
            std::cout << "\n=== EV Charging Management System ===\n"
                      << "1. Charge within time\n2. Budget-based charging\n"
                      << "3. Add vehicle to smart queue\n4. View smart queue\n"
                      << "5. Serve next vehicle\n6. Simulate solar charging\n"
                      << "7. Emergency priority override\n8. View slots/sessions\n"
                      << "9. Run complete automated demo\n0. Exit\n";
            const int option = readValue<int>("Choice: ");
            if (option == 0) break;
            if (option == 1) {
                const auto vehicle = readVehicle();
                const double target = readValue<double>("Target SoC (%): ");
                const double hours = readValue<double>("Hours until departure: ");
                const auto plan = TimeBoundScheduler::createPlan(vehicle, station.chargers(), target, hours);
                std::cout << "Energy " << plan.energyNeededKWh << " kWh, slot " << plan.chargerId
                          << ", rate " << plan.assignedPowerKW << " kW, time "
                          << plan.estimatedHours << " h, feasible: "
                          << (plan.deadlineFeasible ? "yes" : "no") << "\n" << plan.note << '\n';
            } else if (option == 2) {
                const double budget = readValue<double>("Budget (INR): ");
                const double rate = readValue<double>("Tariff (INR/kWh): ");
                const double wanted = readValue<double>("Requested energy (kWh): ");
                const double delivered = std::min(wanted, pricing.maximumEnergyWithinBudget(budget, rate));
                std::cout << "Delivered " << delivered << " kWh; cost INR "
                          << pricing.calculateCost(delivered, rate) << ". "
                          << (delivered < wanted ? "Stopped at budget limit." : "Request fully supplied.") << '\n';
            } else if (option == 3) {
                const bool emergency = readValue<int>("Emergency? [1=yes, 0=no]: ") != 0;
                const auto vehicle = readVehicle(emergency);
                User user{readText("User ID: "), readText("Name: "), true};
                const std::string id = "REQ-" + std::to_string(requestId++);
                queue.addRequest({id, user, vehicle,
                    readValue<int>("Pre-booked? [1/0]: ") != 0, emergency, true,
                    readValue<double>("Estimated service minutes: ")});
                std::cout << id << " added to the priority queue.\n";
            } else if (option == 4) {
                QueueScorePolicy score;
                int rank = 1;
                for (const auto& item : queue.orderedRequests())
                    std::cout << rank++ << ". " << item.requestId << " | "
                              << item.vehicle.registration() << " | SoC "
                              << item.vehicle.currentSocPercent() << "% | priority "
                              << score(item) << (item.emergency ? " | EMERGENCY" : "") << '\n';
                if (queue.empty()) std::cout << "Queue is empty.\n";
            } else if (option == 5) {
                const auto next = queue.serveNext();
                std::cout << "Now serving " << next.requestId << " (" << next.vehicle.registration() << ").\n";
            } else if (option == 6) {
                const double sun = readValue<double>("Sunlight factor (0..1): ");
                const double hours = readValue<double>("Generation hours: ");
                const double requested = readValue<double>("Requested power (kW): ");
                solar.simulateGeneration(sun, hours);
                SolarEnergyManager manager;
                const auto result = manager.allocate(true, sun > 0, solar.availablePowerKW(sun),
                                                     requested, solar.storedEnergyKWh());
                std::cout << "Solar output " << solar.availablePowerKW(sun) << " kW, stored "
                          << solar.storedEnergyKWh() << " kWh, source " << toString(result.source)
                          << ", discount " << result.discountPercent << "%\n" << result.explanation << '\n';
            } else if (option == 7) {
                const auto vehicle = readVehicle(true);
                User operatorUser{readText("Operator ID: "), readText("Organization: "), false};
                Session urgent{"SES-E", operatorUser, vehicle, "WAITING", 60, 5000, true};
                const auto result = EmergencyOverrideService{}.apply(urgent, sessions, station.chargers());
                std::cout << result.notice << '\n';
                if (result.applied) sessions.push_back(urgent);
            } else if (option == 8) {
                for (const auto& charger : station.chargers())
                    std::cout << charger.id() << " | " << toString(charger.connector()) << " | "
                              << charger.maxPowerKW() << " kW | " << toString(charger.powerSource()) << '\n';
                for (const auto& session : sessions)
                    std::cout << session.id() << " | " << session.vehicle().registration() << " | "
                              << session.chargerId() << " | " << toString(session.state()) << '\n';
            } else if (option == 9) {
                runAutomatedDemo();
            } else std::cout << "Unknown option.\n";
        } catch (const std::exception& error) {
            std::cout << "Operation failed: " << error.what() << '\n';
        }
    }
    std::cout << "Goodbye.\n";
    return 0;
}
