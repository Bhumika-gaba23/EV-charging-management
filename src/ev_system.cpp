#include "ev_system.hpp"

#include <sstream>

namespace ev {
namespace {

void requireInRange(double value, double minimum, double maximum, const char* name) {
    if (!std::isfinite(value) || value < minimum || value > maximum) {
        throw std::invalid_argument(std::string(name) + " is outside its valid range");
    }
}

void requirePositive(double value, const char* name) {
    if (!std::isfinite(value) || value <= 0.0) {
        throw std::invalid_argument(std::string(name) + " must be positive");
    }
}

} // namespace

std::string toString(ConnectorType value) {
    switch (value) {
        case ConnectorType::Type2: return "Type 2";
        case ConnectorType::CCS2: return "CCS2";
        case ConnectorType::CHAdeMO: return "CHAdeMO";
    }
    return "Unknown";
}

std::string toString(PowerSource value) {
    switch (value) {
        case PowerSource::Grid: return "Grid";
        case PowerSource::Solar: return "Solar";
        case PowerSource::SolarWithGridFallback: return "Solar + grid fallback";
    }
    return "Unknown";
}

std::string toString(SessionState value) {
    switch (value) {
        case SessionState::Scheduled: return "Scheduled";
        case SessionState::Charging: return "Charging";
        case SessionState::Paused: return "Paused";
        case SessionState::Completed: return "Completed";
        case SessionState::Cancelled: return "Cancelled";
    }
    return "Unknown";
}

Vehicle::Vehicle() : Vehicle("UNREGISTERED", 1.0, 0.0, 0.15, ConnectorType::CCS2, 1.0) {}

Vehicle::Vehicle(std::string registration, double batteryCapacityKWh,
                 double currentSocPercent, double efficiencyKWhPerKm,
                 ConnectorType connector, double maxChargeRateKW,
                 bool emergencyVehicle)
    : registration_(std::move(registration)), batteryCapacityKWh_(batteryCapacityKWh),
      currentSocPercent_(currentSocPercent), efficiencyKWhPerKm_(efficiencyKWhPerKm),
      connector_(connector), maxChargeRateKW_(maxChargeRateKW),
      emergencyVehicle_(emergencyVehicle) {
    if (registration_.empty()) throw std::invalid_argument("Registration cannot be empty");
    requirePositive(batteryCapacityKWh_, "Battery capacity");
    requireInRange(currentSocPercent_, 0.0, 100.0, "State of charge");
    requirePositive(efficiencyKWhPerKm_, "Vehicle efficiency");
    requirePositive(maxChargeRateKW_, "Maximum charging rate");
}

Vehicle::Vehicle(const Vehicle& other) = default;
Vehicle::~Vehicle() = default;
const std::string& Vehicle::registration() const noexcept { return registration_; }
double Vehicle::batteryCapacityKWh() const noexcept { return batteryCapacityKWh_; }
double Vehicle::currentSocPercent() const noexcept { return currentSocPercent_; }
double Vehicle::efficiencyKWhPerKm() const noexcept { return efficiencyKWhPerKm_; }
ConnectorType Vehicle::connector() const noexcept { return connector_; }
double Vehicle::maxChargeRateKW() const noexcept { return maxChargeRateKW_; }
bool Vehicle::isEmergencyVehicle() const noexcept { return emergencyVehicle_; }
void Vehicle::setSocPercent(double value) {
    requireInRange(value, 0.0, 100.0, "State of charge");
    currentSocPercent_ = value;
}

User::User() : User("UNKNOWN", "Unknown user") {}
User::User(std::string id, std::string name, bool prefersGreenEnergy)
    : id_(std::move(id)), name_(std::move(name)), prefersGreenEnergy_(prefersGreenEnergy) {
    if (id_.empty() || name_.empty()) throw std::invalid_argument("User id and name cannot be empty");
}
User::User(const User& other) = default;
User::~User() = default;
const std::string& User::id() const noexcept { return id_; }
const std::string& User::name() const noexcept { return name_; }
bool User::prefersGreenEnergy() const noexcept { return prefersGreenEnergy_; }

ReachabilityResult RangeSafetyService::evaluate(const Vehicle& vehicle,
                                                double distanceKm,
                                                double safetyBufferPercent) {
    requireInRange(distanceKm, 0.0, 100000.0, "Distance");
    requireInRange(safetyBufferPercent, 0.0, 200.0, "Safety buffer");
    const double usableEnergy = vehicle.batteryCapacityKWh() * vehicle.currentSocPercent() / 100.0;
    const double availableRange = usableEnergy / vehicle.efficiencyKWhPerKm();
    const double requiredRange = distanceKm * (1.0 + safetyBufferPercent / 100.0);
    const bool safe = availableRange >= requiredRange;
    return {safe, availableRange, requiredRange,
            safe ? "Proceed to the selected station."
                 : "CRITICAL: request a mobile charger or navigate to a closer intermediate node."};
}

Charger::Charger() : Charger("UNASSIGNED", ChargerKind::StandardAC,
                             ConnectorType::Type2, 1.0, PowerSource::Grid) {}
Charger::Charger(std::string id, ChargerKind kind, ConnectorType connector,
                 double maxPowerKW, PowerSource source, bool available)
    : id_(std::move(id)), kind_(kind), connector_(connector), maxPowerKW_(maxPowerKW),
      powerSource_(source), available_(available) {
    if (id_.empty()) throw std::invalid_argument("Charger id cannot be empty");
    requirePositive(maxPowerKW_, "Charger power");
}
Charger::Charger(const Charger& other) = default;
Charger::~Charger() = default;
const std::string& Charger::id() const noexcept { return id_; }
ChargerKind Charger::kind() const noexcept { return kind_; }
ConnectorType Charger::connector() const noexcept { return connector_; }
double Charger::maxPowerKW() const noexcept { return maxPowerKW_; }
PowerSource Charger::powerSource() const noexcept { return powerSource_; }
bool Charger::isAvailable() const noexcept { return available_; }
bool Charger::isCompatible(const Vehicle& vehicle) const noexcept { return connector_ == vehicle.connector(); }
void Charger::setAvailable(bool value) noexcept { available_ = value; }
void Charger::setPowerSource(PowerSource value) noexcept { powerSource_ = value; }

ChargingPlan TimeBoundScheduler::createPlan(const Vehicle& vehicle,
                                            const std::vector<Charger>& chargers,
                                            double targetSocPercent,
                                            double availableHours,
                                            double chargingEfficiency) {
    requireInRange(targetSocPercent, vehicle.currentSocPercent(), 100.0, "Target state of charge");
    requirePositive(availableHours, "Available time");
    requireInRange(chargingEfficiency, 0.01, 1.0, "Charging efficiency");

    const double energy = vehicle.batteryCapacityKWh() *
                          (targetSocPercent - vehicle.currentSocPercent()) / 100.0;
    if (energy <= 1e-9) return {"NONE", 0.0, 0.0, 0.0, true, "Target is already satisfied."};
    const double requiredInputPower = energy / (availableHours * chargingEfficiency);

    const Charger* best = nullptr;
    double bestPower = std::numeric_limits<double>::max();
    const Charger* fastest = nullptr;
    double fastestPower = 0.0;
    for (const auto& charger : chargers) {
        if (!charger.isAvailable() || !charger.isCompatible(vehicle)) continue;
        const double usablePower = std::min(charger.maxPowerKW(), vehicle.maxChargeRateKW());
        if (usablePower > fastestPower) { fastest = &charger; fastestPower = usablePower; }
        if (usablePower >= requiredInputPower && usablePower < bestPower) {
            best = &charger;
            bestPower = usablePower;
        }
    }
    if (!best) best = fastest;
    if (!best) return {"NONE", energy, 0.0, 0.0, false, "No compatible charger is available."};

    const double capacity = std::min(best->maxPowerKW(), vehicle.maxChargeRateKW());
    const bool feasible = capacity + 1e-9 >= requiredInputPower;
    const double assignedPower = feasible ? requiredInputPower : capacity;
    const double hours = energy / (assignedPower * chargingEfficiency);
    return {best->id(), energy, assignedPower, hours, feasible,
            feasible ? "Power is throttled to finish at the requested deadline."
                     : "Deadline cannot be guaranteed; fastest compatible charger assigned."};
}

double PricingEngine::calculateCost(double energyKWh, double flatRatePerKWh) const {
    if (energyKWh < 0.0 || flatRatePerKWh < 0.0) throw std::invalid_argument("Energy and rate cannot be negative");
    return energyKWh * flatRatePerKWh;
}
double PricingEngine::calculateCost(double peakEnergyKWh, double offPeakEnergyKWh,
                                    double peakRate, double offPeakRate) const {
    if (peakEnergyKWh < 0.0 || offPeakEnergyKWh < 0.0 || peakRate < 0.0 || offPeakRate < 0.0)
        throw std::invalid_argument("Energy and rates cannot be negative");
    return peakEnergyKWh * peakRate + offPeakEnergyKWh * offPeakRate;
}
double PricingEngine::calculateCost(double energyKWh, double baseRatePerKWh,
                                    double solarDiscountPercent) const {
    requireInRange(solarDiscountPercent, 0.0, 100.0, "Solar discount");
    return calculateCost(energyKWh, baseRatePerKWh) * (1.0 - solarDiscountPercent / 100.0);
}
double PricingEngine::maximumEnergyWithinBudget(double budget, double ratePerKWh,
                                                double alreadyDeliveredKWh) const {
    if (budget < 0.0 || alreadyDeliveredKWh < 0.0) throw std::invalid_argument("Budget and energy cannot be negative");
    requirePositive(ratePerKWh, "Rate");
    return std::max(0.0, budget / ratePerKWh - alreadyDeliveredKWh);
}

Session::Session() : Session("UNASSIGNED", User{}, Vehicle{}, "NONE", 0.0, 0.0) {}
Session::Session(std::string id, User user, Vehicle vehicle, std::string chargerId,
                 double targetSocPercent, double budget, bool emergency)
    : id_(std::move(id)), user_(std::move(user)), vehicle_(std::move(vehicle)),
      chargerId_(std::move(chargerId)), targetSocPercent_(targetSocPercent), budget_(budget),
      emergency_(emergency || vehicle_.isEmergencyVehicle()) {
    if (id_.empty() || chargerId_.empty()) throw std::invalid_argument("Session and charger ids cannot be empty");
    requireInRange(targetSocPercent_, 0.0, 100.0, "Target state of charge");
    if (budget_ < 0.0) throw std::invalid_argument("Budget cannot be negative");
}
Session::Session(const Session& other) = default;
Session::~Session() = default;
const std::string& Session::id() const noexcept { return id_; }
const User& Session::user() const noexcept { return user_; }
const Vehicle& Session::vehicle() const noexcept { return vehicle_; }
const std::string& Session::chargerId() const noexcept { return chargerId_; }
SessionState Session::state() const noexcept { return state_; }
double Session::targetSocPercent() const noexcept { return targetSocPercent_; }
double Session::budget() const noexcept { return budget_; }
double Session::deliveredEnergyKWh() const noexcept { return deliveredEnergyKWh_; }
bool Session::isEmergency() const noexcept { return emergency_; }
void Session::setState(SessionState value) noexcept { state_ = value; }
void Session::setChargerId(std::string value) {
    if (value.empty()) throw std::invalid_argument("Charger id cannot be empty");
    chargerId_ = std::move(value);
}
void Session::addDeliveredEnergy(double kWh) {
    if (kWh < 0.0) throw std::invalid_argument("Delivered energy cannot be negative");
    deliveredEnergyKWh_ += kWh;
}

double QueueScorePolicy::operator()(const QueueRequest& request) const {
    double score = 0.0;
    if (request.emergency || request.vehicle.isEmergencyVehicle()) score += 1000.0;
    if (request.vehicle.currentSocPercent() < 10.0) score += 300.0;
    else if (request.vehicle.currentSocPercent() < 20.0) score += 150.0;
    score += request.preBooked ? 100.0 : 0.0;
    score += request.compatibleChargerAvailable ? 40.0 : -200.0;
    score += std::max(0.0, 60.0 - request.estimatedServiceMinutes) * 0.25;
    const auto waitMinutes = std::chrono::duration_cast<std::chrono::minutes>(
        std::chrono::system_clock::now() - request.arrivalTime).count();
    score += std::min(120.0, static_cast<double>(std::max<decltype(waitMinutes)>(0, waitMinutes))) * 0.5;
    return score;
}

void QueueManager::addRequest(const QueueRequest& request) {
    requests_.push_back(request);
}

std::vector<QueueRequest> QueueManager::orderedRequests() const {
    auto ordered = requests_;
    std::stable_sort(ordered.begin(), ordered.end(), [&](const auto& left, const auto& right) {
        const double leftScore = scorePolicy_(left);
        const double rightScore = scorePolicy_(right);
        if (leftScore != rightScore) return leftScore > rightScore;
        return left.arrivalTime < right.arrivalTime;
    });
    return ordered;
}

QueueRequest QueueManager::serveNext() {
    if (requests_.empty()) throw std::underflow_error("Cannot serve an empty queue");
    const auto ordered = orderedRequests();
    const auto nextId = ordered.front().requestId;
    auto match = std::find_if(requests_.begin(), requests_.end(), [&](const auto& request) {
        return request.requestId == nextId;
    });
    QueueRequest result = *match;
    requests_.erase(match);
    return result;
}

bool QueueManager::empty() const noexcept { return requests_.empty(); }
std::size_t QueueManager::size() const noexcept { return requests_.size(); }

SolarPowerUnit::SolarPowerUnit() : SolarPowerUnit(1.0, 0.0, 0.0) {}

SolarPowerUnit::SolarPowerUnit(double peakOutputKW, double storageCapacityKWh,
                               double storedEnergyKWh)
    : peakOutputKW_(peakOutputKW), storageCapacityKWh_(storageCapacityKWh),
      storedEnergyKWh_(storedEnergyKWh) {
    requirePositive(peakOutputKW_, "Peak solar output");
    if (storageCapacityKWh_ < 0.0 || storedEnergyKWh_ < 0.0 ||
        storedEnergyKWh_ > storageCapacityKWh_) {
        throw std::invalid_argument("Invalid solar storage values");
    }
}

void SolarPowerUnit::simulateGeneration(double sunlightFactor, double hours) {
    requireInRange(sunlightFactor, 0.0, 1.0, "Sunlight factor");
    if (hours < 0.0) throw std::invalid_argument("Generation hours cannot be negative");
    storedEnergyKWh_ = std::min(storageCapacityKWh_,
        storedEnergyKWh_ + peakOutputKW_ * sunlightFactor * hours);
}

double SolarPowerUnit::availablePowerKW(double sunlightFactor) const {
    requireInRange(sunlightFactor, 0.0, 1.0, "Sunlight factor");
    return peakOutputKW_ * sunlightFactor;
}

double SolarPowerUnit::peakOutputKW() const noexcept { return peakOutputKW_; }
double SolarPowerUnit::storedEnergyKWh() const noexcept { return storedEnergyKWh_; }

SolarAllocation SolarEnergyManager::allocate(bool userWantsGreenEnergy, bool sunlightHours,
                                              double solarOutputKW, double requestedPowerKW,
                                              double storageAvailableKWh) const {
    if (solarOutputKW < 0.0 || storageAvailableKWh < 0.0) throw std::invalid_argument("Solar values cannot be negative");
    requirePositive(requestedPowerKW, "Requested power");
    if (!userWantsGreenEnergy) return {PowerSource::Grid, requestedPowerKW, 0.0, "Grid selected by user preference."};
    if (sunlightHours && solarOutputKW >= requestedPowerKW)
        return {PowerSource::Solar, requestedPowerKW, 15.0, "Fully supplied by live solar generation."};
    if ((sunlightHours && solarOutputKW > 0.0) || storageAvailableKWh > 0.0)
        return {PowerSource::SolarWithGridFallback, requestedPowerKW, 7.5,
                "Solar/storage is used first; grid automatically covers any shortfall."};
    return {PowerSource::Grid, requestedPowerKW, 0.0, "Solar unavailable; switched safely to grid power."};
}

EmergencyOverrideResult EmergencyOverrideService::apply(Session& emergencySession,
                                                         std::vector<Session>& activeSessions,
                                                         const std::vector<Charger>& chargers) const {
    if (!emergencySession.isEmergency())
        return {false, "", "", 0.0, "Override rejected: session is not emergency-authorized."};

    Session* candidate = nullptr;
    double candidatePower = -1.0;
    for (auto& active : activeSessions) {
        if (active.isEmergency() || active.state() != SessionState::Charging) continue;
        auto charger = std::find_if(chargers.begin(), chargers.end(), [&](const Charger& c) {
            return c.id() == active.chargerId() && c.isCompatible(emergencySession.vehicle());
        });
        if (charger != chargers.end() && charger->maxPowerKW() > candidatePower) {
            candidate = &active;
            candidatePower = charger->maxPowerKW();
        }
    }
    if (!candidate) return {false, "", "", 0.0, "No safely preemptible compatible session found."};

    candidate->setState(SessionState::Paused);
    emergencySession.setChargerId(candidate->chargerId());
    emergencySession.setState(SessionState::Charging);
    const double credit = 50.0; // Configurable service-level compensation in INR.
    return {true, candidate->chargerId(), candidate->id(), credit,
            "Non-urgent session paused with notice, queue protection, and INR 50 credit."};
}

ChargingStation::ChargingStation() : ChargingStation("UNKNOWN", "Unnamed station", {}) {}
ChargingStation::ChargingStation(std::string id, std::string name, std::vector<Charger> chargers)
    : id_(std::move(id)), name_(std::move(name)), chargers_(std::move(chargers)) {
    if (id_.empty() || name_.empty()) throw std::invalid_argument("Station id and name cannot be empty");
}
ChargingStation::ChargingStation(const ChargingStation& other) = default;
ChargingStation::~ChargingStation() = default;
const std::string& ChargingStation::id() const noexcept { return id_; }
const std::string& ChargingStation::name() const noexcept { return name_; }
const std::vector<Charger>& ChargingStation::chargers() const noexcept { return chargers_; }
std::optional<std::reference_wrapper<Charger>> ChargingStation::findAvailableCharger(const Vehicle& vehicle) {
    auto match = std::find_if(chargers_.begin(), chargers_.end(), [&](const Charger& charger) {
        return charger.isAvailable() && charger.isCompatible(vehicle);
    });
    if (match == chargers_.end()) return std::nullopt;
    return std::ref(*match);
}

} // namespace ev
