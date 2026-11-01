#pragma once

#include <algorithm>
#include <chrono>
#include <cmath>
#include <cstddef>
#include <cstdint>
#include <functional>
#include <iomanip>
#include <iostream>
#include <limits>
#include <optional>
#include <queue>
#include <stdexcept>
#include <string>
#include <utility>
#include <vector>

namespace ev {

enum class ConnectorType { Type2, CCS2, CHAdeMO };
enum class ChargerKind { StandardAC, FastDC };
enum class PowerSource { Grid, Solar, SolarWithGridFallback };
enum class SessionState { Scheduled, Charging, Paused, Completed, Cancelled };

std::string toString(ConnectorType value);
std::string toString(PowerSource value);
std::string toString(SessionState value);

class Vehicle {
public:
    Vehicle();
    Vehicle(std::string registration, double batteryCapacityKWh,
            double currentSocPercent, double efficiencyKWhPerKm,
            ConnectorType connector, double maxChargeRateKW,
            bool emergencyVehicle = false);
    Vehicle(const Vehicle& other);
    Vehicle& operator=(const Vehicle& other) = default;
    ~Vehicle();

    const std::string& registration() const noexcept;
    double batteryCapacityKWh() const noexcept;
    double currentSocPercent() const noexcept;
    double efficiencyKWhPerKm() const noexcept;
    ConnectorType connector() const noexcept;
    double maxChargeRateKW() const noexcept;
    bool isEmergencyVehicle() const noexcept;
    void setSocPercent(double value);

private:
    std::string registration_;
    double batteryCapacityKWh_{};
    double currentSocPercent_{};
    double efficiencyKWhPerKm_{};
    ConnectorType connector_{ConnectorType::CCS2};
    double maxChargeRateKW_{};
    bool emergencyVehicle_{};
};

class User {
public:
    User();
    User(std::string id, std::string name, bool prefersGreenEnergy = false);
    User(const User& other);
    User& operator=(const User& other) = default;
    ~User();

    const std::string& id() const noexcept;
    const std::string& name() const noexcept;
    bool prefersGreenEnergy() const noexcept;

private:
    std::string id_;
    std::string name_;
    bool prefersGreenEnergy_{};
};

struct ReachabilityResult {
    bool canReach{};
    double availableRangeKm{};
    double requiredRangeWithBufferKm{};
    std::string recommendation;
};

class RangeSafetyService {
public:
    static ReachabilityResult evaluate(const Vehicle& vehicle,
                                       double distanceKm,
                                       double safetyBufferPercent = 20.0);
};

class Charger {
public:
    Charger();
    Charger(std::string id, ChargerKind kind, ConnectorType connector,
            double maxPowerKW, PowerSource source, bool available = true);
    Charger(const Charger& other);
    Charger& operator=(const Charger& other) = default;
    ~Charger();

    const std::string& id() const noexcept;
    ChargerKind kind() const noexcept;
    ConnectorType connector() const noexcept;
    double maxPowerKW() const noexcept;
    PowerSource powerSource() const noexcept;
    bool isAvailable() const noexcept;
    bool isCompatible(const Vehicle& vehicle) const noexcept;
    void setAvailable(bool value) noexcept;
    void setPowerSource(PowerSource value) noexcept;

private:
    std::string id_;
    ChargerKind kind_{ChargerKind::StandardAC};
    ConnectorType connector_{ConnectorType::Type2};
    double maxPowerKW_{};
    PowerSource powerSource_{PowerSource::Grid};
    bool available_{true};
};

struct ChargingPlan {
    std::string chargerId;
    double energyNeededKWh{};
    double assignedPowerKW{};
    double estimatedHours{};
    bool deadlineFeasible{};
    std::string note;
};

class TimeBoundScheduler {
public:
    static ChargingPlan createPlan(const Vehicle& vehicle,
                                   const std::vector<Charger>& chargers,
                                   double targetSocPercent,
                                   double availableHours,
                                   double chargingEfficiency = 0.90);
};

class PricingEngine {
public:
    // Flat-rate overload.
    double calculateCost(double energyKWh, double flatRatePerKWh) const;
    // Time-of-use overload: peak energy and off-peak energy are priced separately.
    double calculateCost(double peakEnergyKWh, double offPeakEnergyKWh,
                         double peakRate, double offPeakRate) const;
    // Solar overload: applies a percentage eco discount to a base rate.
    double calculateCost(double energyKWh, double baseRatePerKWh,
                         double solarDiscountPercent) const;

    double maximumEnergyWithinBudget(double budget, double ratePerKWh,
                                     double alreadyDeliveredKWh = 0.0) const;
};

class Session {
public:
    Session();
    Session(std::string id, User user, Vehicle vehicle, std::string chargerId,
            double targetSocPercent, double budget, bool emergency = false);
    Session(const Session& other);
    Session& operator=(const Session& other) = default;
    ~Session();

    const std::string& id() const noexcept;
    const User& user() const noexcept;
    const Vehicle& vehicle() const noexcept;
    const std::string& chargerId() const noexcept;
    SessionState state() const noexcept;
    double targetSocPercent() const noexcept;
    double budget() const noexcept;
    double deliveredEnergyKWh() const noexcept;
    bool isEmergency() const noexcept;
    void setState(SessionState value) noexcept;
    void setChargerId(std::string value);
    void addDeliveredEnergy(double kWh);

private:
    std::string id_;
    User user_;
    Vehicle vehicle_;
    std::string chargerId_;
    SessionState state_{SessionState::Scheduled};
    double targetSocPercent_{};
    double budget_{};
    double deliveredEnergyKWh_{};
    bool emergency_{};
};

struct QueueRequest {
    std::string requestId;
    User user;
    Vehicle vehicle;
    bool preBooked{};
    bool emergency{};
    bool compatibleChargerAvailable{};
    double estimatedServiceMinutes{};
    std::chrono::system_clock::time_point arrivalTime{std::chrono::system_clock::now()};
};

struct QueueScorePolicy {
    double operator()(const QueueRequest& request) const;
};

class QueueManager {
public:
    QueueManager() = default;
    QueueManager(const QueueManager&) = default;

    void addRequest(const QueueRequest& request);
    QueueRequest serveNext();
    std::vector<QueueRequest> orderedRequests() const;
    bool empty() const noexcept;
    std::size_t size() const noexcept;

private:
    std::vector<QueueRequest> requests_;
    QueueScorePolicy scorePolicy_;
};

// Generic max-priority queue. A policy object makes the scoring rule replaceable.
template <typename T, typename ScorePolicy>
class SmartPriorityQueue {
private:
    struct Node {
        T item;
        double score{};
        std::size_t sequence{};
    };

    struct Compare {
        bool operator()(const Node& left, const Node& right) const {
            // Exact ordering is required by std::priority_queue: an epsilon
            // comparison can produce non-transitive ordering for close scores.
            if (left.score != right.score) {
                return left.score < right.score;
            }
            return left.sequence > right.sequence; // FIFO tie-breaker for fairness.
        }
    };

public:
    SmartPriorityQueue() = default;
    explicit SmartPriorityQueue(ScorePolicy policy) : policy_(std::move(policy)) {}
    SmartPriorityQueue(const SmartPriorityQueue&) = default;
    ~SmartPriorityQueue() = default;

    void push(const T& item) {
        queue_.push(Node{item, policy_(item), nextSequence_++});
    }

    T pop() {
        if (queue_.empty()) {
            throw std::underflow_error("Cannot pop an empty smart queue");
        }
        T result = queue_.top().item;
        queue_.pop();
        return result;
    }

    const T& top() const {
        if (queue_.empty()) {
            throw std::underflow_error("Cannot inspect an empty smart queue");
        }
        return queue_.top().item;
    }

    bool empty() const noexcept { return queue_.empty(); }
    std::size_t size() const noexcept { return queue_.size(); }

private:
    std::priority_queue<Node, std::vector<Node>, Compare> queue_;
    ScorePolicy policy_{};
    std::size_t nextSequence_{};
};

// Function template used for type-safe event output.
template <typename T>
void logEvent(const std::string& label, const T& value) {
    std::cout << "[EVENT] " << label << ": " << value << '\n';
}

struct SolarAllocation {
    PowerSource source{PowerSource::Grid};
    double availablePowerKW{};
    double discountPercent{};
    std::string explanation;
};

class SolarPowerUnit {
public:
    SolarPowerUnit();
    SolarPowerUnit(double peakOutputKW, double storageCapacityKWh,
                   double storedEnergyKWh = 0.0);
    SolarPowerUnit(const SolarPowerUnit&) = default;

    void simulateGeneration(double sunlightFactor, double hours);
    double availablePowerKW(double sunlightFactor) const;
    double peakOutputKW() const noexcept;
    double storedEnergyKWh() const noexcept;

private:
    double peakOutputKW_{};
    double storageCapacityKWh_{};
    double storedEnergyKWh_{};
};

class SolarEnergyManager {
public:
    SolarAllocation allocate(bool userWantsGreenEnergy, bool sunlightHours,
                             double solarOutputKW, double requestedPowerKW,
                             double storageAvailableKWh) const;
};

struct EmergencyOverrideResult {
    bool applied{};
    std::string releasedChargerId;
    std::string pausedSessionId;
    double compensationCredit{};
    std::string notice;
};

class EmergencyOverrideService {
public:
    EmergencyOverrideResult apply(Session& emergencySession,
                                  std::vector<Session>& activeSessions,
                                  const std::vector<Charger>& chargers) const;
};

class ChargingStation {
public:
    ChargingStation();
    ChargingStation(std::string id, std::string name, std::vector<Charger> chargers);
    ChargingStation(const ChargingStation& other);
    ChargingStation& operator=(const ChargingStation& other) = default;
    ~ChargingStation();

    const std::string& id() const noexcept;
    const std::string& name() const noexcept;
    const std::vector<Charger>& chargers() const noexcept;
    std::optional<std::reference_wrapper<Charger>> findAvailableCharger(const Vehicle& vehicle);

private:
    std::string id_;
    std::string name_;
    std::vector<Charger> chargers_;
};

} // namespace ev
