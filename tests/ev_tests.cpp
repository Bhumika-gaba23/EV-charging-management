#include "ev_system.hpp"

#include <cmath>
#include <iostream>
#include <stdexcept>

namespace {
void check(bool condition, const char* message) {
    if (!condition) throw std::runtime_error(message);
}
bool near(double a, double b) { return std::abs(a - b) < 1e-8; }
}

int main() {
    using namespace ev;
    try {
        User user{"U1", "Driver", true};
        Vehicle vehicle{"EV1", 60, 20, 0.2, ConnectorType::CCS2, 100};
        std::vector<Charger> chargers{
            {"DC60", ChargerKind::FastDC, ConnectorType::CCS2, 60, PowerSource::Grid},
            {"DC150", ChargerKind::FastDC, ConnectorType::CCS2, 150, PowerSource::Grid},
            {"AC11", ChargerKind::StandardAC, ConnectorType::Type2, 11, PowerSource::Solar}
        };

        check(RangeSafetyService::evaluate(vehicle, 50).canReach, "Range boundary should be safe");
        check(!RangeSafetyService::evaluate(vehicle, 51).canReach, "Range buffer must reject unsafe trip");
        const auto feasible = TimeBoundScheduler::createPlan(vehicle, chargers, 80, 1);
        check(feasible.deadlineFeasible && feasible.chargerId == "DC60", "Select smallest sufficient charger");
        check(near(feasible.assignedPowerKW, 40) && near(feasible.estimatedHours, 1), "Finish at requested deadline");
        const auto impossible = TimeBoundScheduler::createPlan(vehicle, chargers, 80, 0.1);
        check(!impossible.deadlineFeasible && impossible.chargerId == "DC150", "Impossible deadline must use fastest charger");
        check(near(impossible.assignedPowerKW, 100), "Respect vehicle power limit");
        Vehicle incompatible{"EV2", 50, 10, 0.2, ConnectorType::CHAdeMO, 50};
        check(TimeBoundScheduler::createPlan(incompatible, chargers, 80, 1).chargerId == "NONE", "Reject incompatible ports");
        check(near(TimeBoundScheduler::createPlan(vehicle, chargers, 20, 1).energyNeededKWh, 0), "Already satisfied target");

        PricingEngine pricing;
        check(near(pricing.calculateCost(20, 18), 360), "Flat pricing");
        check(near(pricing.calculateCost(5, 15, 22, 12), 290), "Time-of-use pricing");
        check(near(pricing.calculateCost(20, 18, 15), 306), "Solar pricing");
        check(near(pricing.maximumEnergyWithinBudget(300, 20, 5), 10), "Subtract delivered energy from budget allowance");
        check(near(pricing.maximumEnergyWithinBudget(100, 20, 6), 0), "Exhausted budget cannot deliver more energy");

        SmartPriorityQueue<QueueRequest, QueueScorePolicy> queue;
        QueueRequest ordinary{"ordinary", user, vehicle, false, false, true, 30};
        QueueRequest booked = ordinary;
        booked.requestId = "booked";
        booked.preBooked = true;
        QueueRequest emergency = ordinary;
        emergency.requestId = "emergency";
        emergency.emergency = true;
        queue.push(ordinary); queue.push(booked); queue.push(emergency);
        check(queue.pop().requestId == "emergency", "Emergency should lead queue");
        check(queue.pop().requestId == "booked", "Booking should precede equivalent unbooked request");
        check(queue.pop().requestId == "ordinary", "Ordinary request retained");
        queue.push(ordinary); booked = ordinary; booked.requestId = "second"; queue.push(booked);
        check(queue.pop().requestId == "ordinary", "Equal priority must preserve FIFO");
        queue.pop();
        bool emptyRejected = false;
        try { queue.pop(); } catch (const std::underflow_error&) { emptyRejected = true; }
        check(emptyRejected, "Empty queue must throw");

        SolarEnergyManager solar;
        check(solar.allocate(true, true, 50, 40, 0).source == PowerSource::Solar, "Solar supply");
        check(solar.allocate(true, true, 4, 40, 0).source == PowerSource::SolarWithGridFallback, "Cloud fallback");
        check(solar.allocate(true, false, 0, 40, 0).source == PowerSource::Grid, "Night fallback");

        Session ordinarySession{"S1", user, vehicle, "DC150", 80, 500};
        ordinarySession.setState(SessionState::Charging);
        Vehicle ambulance{"AMB", 90, 7, 0.24, ConnectorType::CCS2, 180, true};
        Session urgent{"S2", user, ambulance, "WAITING", 60, 1000};
        std::vector<Session> active{ordinarySession};
        EmergencyOverrideService overrides;
        auto result = overrides.apply(urgent, active, chargers);
        check(result.applied && active[0].state() == SessionState::Paused, "Pause ordinary session");
        check(urgent.state() == SessionState::Charging && urgent.chargerId() == "DC150", "Allocate emergency charger");
        check(result.compensationCredit > 0 && !result.notice.empty(), "Provide compensation and notice");
        active = {urgent};
        Session anotherUrgent{"S3", user, ambulance, "WAITING", 60, 1000};
        check(!overrides.apply(anotherUrgent, active, chargers).applied, "Never preempt an emergency session");
        check(!overrides.apply(ordinarySession, active, chargers).applied, "Reject unauthorized override");

        std::cout << "All EV feature checks passed.\n";
        return 0;
    } catch (const std::exception& error) {
        std::cerr << "Feature check failed: " << error.what() << '\n';
        return 1;
    }
}
